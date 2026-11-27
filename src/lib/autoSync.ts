import {
  clearAllLearningStorage,
  computeBackupActivityScore,
  exportLearningStorage,
  importLearningStorage,
} from './progressStorage.ts'

export const CLOUD_HYDRATED_EVENT = 'yulu:cloud-hydrated'
export const LOCAL_PROGRESS_EVENT = 'yulu:local-progress'
export const CLOUD_META_KEY = 'yulu.cloud-sync-meta.v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

export interface CloudSyncMeta {
  updatedAt: number
  fingerprint: string
  activityScore: number
}

export interface CloudSyncResponse {
  ok: boolean
  enabled: boolean
  action?: 'saved' | 'pulled' | 'conflict'
  backup?: Record<string, unknown> | null
  updatedAt?: number
  activityScore?: number
}

export type CloudSyncStatus = 'pending' | 'saved' | 'offline' | 'local'

export type SyncResult = {
  status: CloudSyncStatus
  hydrated: boolean
  updatedAt: number
}

function extractBackupResetAt(
  backup: Record<string, unknown> | null | undefined,
  key: string,
): number {
  if (!backup || typeof backup !== 'object') return 0
  const entries = (backup as { entries?: unknown }).entries
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return 0
  const raw = (entries as Record<string, unknown>)[key]
  if (typeof raw !== 'string' || !raw) return 0
  try {
    const parsed = JSON.parse(raw) as { resetAt?: unknown } | null
    return parsed && typeof parsed.resetAt === 'number' && Number.isFinite(parsed.resetAt)
      ? parsed.resetAt
      : 0
  } catch {
    return 0
  }
}

function readMeta(storage: StorageLike): CloudSyncMeta {
  try {
    const raw = storage.getItem(CLOUD_META_KEY)
    if (!raw) return { updatedAt: 0, fingerprint: '', activityScore: 0 }
    const parsed = JSON.parse(raw) as Partial<CloudSyncMeta>
    return {
      updatedAt:
        typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
      fingerprint: typeof parsed.fingerprint === 'string' ? parsed.fingerprint : '',
      activityScore:
        typeof parsed.activityScore === 'number' && Number.isFinite(parsed.activityScore)
          ? parsed.activityScore
          : 0,
    }
  } catch {
    return { updatedAt: 0, fingerprint: '', activityScore: 0 }
  }
}

function writeMeta(storage: StorageLike, meta: CloudSyncMeta): void {
  try {
    storage.setItem(CLOUD_META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore storage quota limits */
  }
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSortValue)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(record).sort()) {
    out[k] = stableSortValue(record[k])
  }
  return out
}

/**
 * Compute a deterministic fingerprint of `yulu-progress-backup` ignoring volatile
 * `exportedAt` timestamps and internal `.before-*` / `.pending` keys.
 */
export function fingerprintBackup(rawOrParsed: string | Record<string, unknown>): string {
  try {
    const parsed = typeof rawOrParsed === 'string' ? JSON.parse(rawOrParsed) : rawOrParsed
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ''
    const obj = parsed as Record<string, unknown>
    if (obj.format === 'yulu-progress-backup' && obj.entries && typeof obj.entries === 'object') {
      const cleaned: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(obj.entries as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        if (k.includes('.before-') || k.endsWith('.pending') || k === CLOUD_META_KEY) continue
        if (typeof v === 'string') {
          try {
            cleaned[k] = stableSortValue(JSON.parse(v))
          } catch {
            cleaned[k] = v
          }
        } else {
          cleaned[k] = stableSortValue(v)
        }
      }
      return JSON.stringify(cleaned)
    }
    return JSON.stringify(stableSortValue(obj))
  } catch {
    return ''
  }
}

function dispatchCloudHydrated(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(CLOUD_HYDRATED_EVENT))
  } catch {
    /* ignore in restricted test globals */
  }
}

async function fetchJsonWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs = 8000,
): Promise<{ ok: boolean; status: number; data: CloudSyncResponse | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      ...init,
      cache: 'no-store',
      signal: init.signal ?? controller.signal,
    })
    let data: CloudSyncResponse | null = null
    try {
      data = (await res.json()) as CloudSyncResponse
    } catch {
      data = null
    }
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

function defaultEndpoint(profile = 'default'): string {
  return profile && profile !== 'default'
    ? `/api/cloud-sync?profile=${encodeURIComponent(profile)}`
    : '/api/cloud-sync'
}

export interface SyncOptions {
  storage: StorageLike
  key: string
  profile?: string
  fetchImpl?: typeof fetch
  onHydrated?: () => void
  force?: boolean
  keepalive?: boolean
}

async function postBackup(
  fetchImpl: typeof fetch,
  endpoint: string,
  backupObj: Record<string, unknown>,
  expectedUpdatedAt: number,
  options?: { force?: boolean; keepalive?: boolean },
): Promise<{ ok: boolean; data: CloudSyncResponse | null }> {
  const payloadStr = JSON.stringify({
    backup: backupObj,
    expectedUpdatedAt,
    ...(options?.force ? { force: true } : {}),
  })
  const useKeepalive = Boolean(options?.keepalive && payloadStr.length < 58_000)
  const res = await fetchJsonWithTimeout(
    fetchImpl,
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadStr,
      ...(useKeepalive ? { keepalive: true } : {}),
    },
    useKeepalive ? 5000 : 8000,
  )
  return { ok: res.ok, data: res.data }
}

/**
 * Bidirectional auto-sync with Neon cloud storage:
 * 1) Pulls remote snapshot first (never allowing an empty client to overwrite cloud).
 * 2) Non-destructively merges remote snapshot into `storage` if anything new arrived.
 * 3) Pushes merged superset back if local has newer/additional progress.
 */
export async function syncWithCloud(opts: SyncOptions): Promise<SyncResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const endpoint = defaultEndpoint(opts.profile)
  const meta = readMeta(opts.storage)

  let getRes: { ok: boolean; status: number; data: CloudSyncResponse | null }
  try {
    getRes = await fetchJsonWithTimeout(fetchImpl, endpoint, { method: 'GET' })
  } catch {
    return { status: 'offline', hydrated: false, updatedAt: meta.updatedAt }
  }

  if (!getRes.ok || !getRes.data) {
    return { status: 'offline', hydrated: false, updatedAt: meta.updatedAt }
  }
  if (!getRes.data.enabled) {
    return { status: 'local', hydrated: false, updatedAt: meta.updatedAt }
  }

  const remoteUpdatedAt = Number(getRes.data.updatedAt ?? 0)
  const remoteScore = Number(getRes.data.activityScore ?? 0)
  const remoteBackup = getRes.data.backup ?? null

  const localRaw = exportLearningStorage(opts.storage, opts.key)
  const localObj = JSON.parse(localRaw) as Record<string, unknown>
  const localScore = computeBackupActivityScore(localObj)
  const localFp = fingerprintBackup(localObj)

  let hydrated = false
  let remoteFp = remoteBackup ? fingerprintBackup(remoteBackup) : ''

  const remoteResetAt = extractBackupResetAt(remoteBackup, opts.key)
  const localResetAt = extractBackupResetAt(localObj, opts.key)
  if (remoteBackup && remoteResetAt > localResetAt) {
    clearAllLearningStorage(opts.storage, opts.key)
    importLearningStorage(opts.storage, opts.key, JSON.stringify(remoteBackup))
    opts.onHydrated?.()
    dispatchCloudHydrated()
    writeMeta(opts.storage, {
      updatedAt: remoteUpdatedAt,
      fingerprint: remoteFp,
      activityScore: remoteScore,
    })
    return { status: 'saved', hydrated: true, updatedAt: remoteUpdatedAt }
  }

  if (remoteBackup && (remoteScore > 0 || computeBackupActivityScore(remoteBackup) > 0)) {
    if (localScore === 0 || remoteFp !== localFp) {
      const imported = importLearningStorage(opts.storage, opts.key, JSON.stringify(remoteBackup))
      if (imported.ok) {
        hydrated = true
        opts.onHydrated?.()
        dispatchCloudHydrated()
      }
    }

    const afterRaw = exportLearningStorage(opts.storage, opts.key)
    const afterObj = JSON.parse(afterRaw) as Record<string, unknown>
    const afterScore = computeBackupActivityScore(afterObj)
    const afterFp = fingerprintBackup(afterObj)

    writeMeta(opts.storage, {
      updatedAt: remoteUpdatedAt,
      fingerprint: remoteFp || afterFp,
      activityScore: Math.max(remoteScore, afterScore),
    })

    // If local held additional progress that wasn't on cloud yet, push the merged superset back.
    if (afterScore > 0 && afterFp !== remoteFp) {
      try {
        const pushRes = await postBackup(fetchImpl, endpoint, afterObj, remoteUpdatedAt)
        if (pushRes.ok && pushRes.data?.enabled) {
          if (pushRes.data.action === 'saved') {
            const nextAt = Number(pushRes.data.updatedAt ?? remoteUpdatedAt)
            writeMeta(opts.storage, {
              updatedAt: nextAt,
              fingerprint: afterFp,
              activityScore: Number(pushRes.data.activityScore ?? afterScore),
            })
            return { status: 'saved', hydrated, updatedAt: nextAt }
          }
          if (
            (pushRes.data.action === 'conflict' || pushRes.data.action === 'pulled') &&
            pushRes.data.backup
          ) {
            const reimported = importLearningStorage(
              opts.storage,
              opts.key,
              JSON.stringify(pushRes.data.backup),
            )
            if (reimported.ok) {
              hydrated = true
              opts.onHydrated?.()
              dispatchCloudHydrated()
            }
            const mergedRaw = exportLearningStorage(opts.storage, opts.key)
            const mergedObj = JSON.parse(mergedRaw) as Record<string, unknown>
            const mergedFp = fingerprintBackup(mergedObj)
            const conflictAt = Number(pushRes.data.updatedAt ?? remoteUpdatedAt)
            remoteFp = fingerprintBackup(pushRes.data.backup)
            if (mergedFp !== remoteFp && computeBackupActivityScore(mergedObj) > 0) {
              const retryRes = await postBackup(fetchImpl, endpoint, mergedObj, conflictAt)
              if (retryRes.ok && retryRes.data?.action === 'saved') {
                const retryAt = Number(retryRes.data.updatedAt ?? conflictAt)
                writeMeta(opts.storage, {
                  updatedAt: retryAt,
                  fingerprint: mergedFp,
                  activityScore: Number(retryRes.data.activityScore ?? afterScore),
                })
                return { status: 'saved', hydrated, updatedAt: retryAt }
              }
            }
            writeMeta(opts.storage, {
              updatedAt: conflictAt,
              fingerprint: mergedFp,
              activityScore: Math.max(afterScore, Number(pushRes.data.activityScore ?? 0)),
            })
            return { status: 'saved', hydrated, updatedAt: conflictAt }
          }
        }
      } catch {
        return { status: 'offline', hydrated, updatedAt: remoteUpdatedAt }
      }
    }

    return { status: 'saved', hydrated, updatedAt: remoteUpdatedAt }
  }

  // Cloud is currently empty — upload local progress if we have real study activity.
  if (localScore > 0) {
    try {
      const pushRes = await postBackup(fetchImpl, endpoint, localObj, remoteUpdatedAt)
      if (!pushRes.ok || !pushRes.data) {
        return { status: 'offline', hydrated: false, updatedAt: remoteUpdatedAt }
      }
      if (!pushRes.data.enabled) {
        return { status: 'local', hydrated: false, updatedAt: remoteUpdatedAt }
      }
      if (pushRes.data.action === 'saved') {
        const savedAt = Number(pushRes.data.updatedAt ?? Date.now())
        writeMeta(opts.storage, {
          updatedAt: savedAt,
          fingerprint: localFp,
          activityScore: localScore,
        })
        return { status: 'saved', hydrated: false, updatedAt: savedAt }
      }
      if (
        (pushRes.data.action === 'conflict' || pushRes.data.action === 'pulled') &&
        pushRes.data.backup
      ) {
        const imported = importLearningStorage(
          opts.storage,
          opts.key,
          JSON.stringify(pushRes.data.backup),
        )
        if (imported.ok) {
          hydrated = true
          opts.onHydrated?.()
          dispatchCloudHydrated()
        }
        const mergedObj = JSON.parse(exportLearningStorage(opts.storage, opts.key)) as Record<
          string,
          unknown
        >
        const mergedFp = fingerprintBackup(mergedObj)
        const serverAt = Number(pushRes.data.updatedAt ?? 0)
        const retryRes = await postBackup(fetchImpl, endpoint, mergedObj, serverAt)
        const finalAt =
          retryRes.ok && retryRes.data?.action === 'saved'
            ? Number(retryRes.data.updatedAt ?? serverAt)
            : serverAt
        writeMeta(opts.storage, {
          updatedAt: finalAt,
          fingerprint: mergedFp,
          activityScore: computeBackupActivityScore(mergedObj),
        })
        return { status: 'saved', hydrated, updatedAt: finalAt }
      }
    } catch {
      return { status: 'offline', hydrated: false, updatedAt: remoteUpdatedAt }
    }
  }

  writeMeta(opts.storage, {
    updatedAt: remoteUpdatedAt,
    fingerprint: localFp,
    activityScore: localScore,
  })
  return { status: 'saved', hydrated: false, updatedAt: remoteUpdatedAt }
}

/**
 * Push local progress if it contains real study activity and differs from the last
 * cloud-synced fingerprint. Never allows an empty client to overwrite non-empty cloud data.
 */
export async function pushToCloudIfChanged(opts: SyncOptions): Promise<SyncResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const endpoint = defaultEndpoint(opts.profile)
  const meta = readMeta(opts.storage)

  const localRaw = exportLearningStorage(opts.storage, opts.key)
  const localObj = JSON.parse(localRaw) as Record<string, unknown>
  const localScore = computeBackupActivityScore(localObj)
  const localFp = fingerprintBackup(localObj)

  if (localScore === 0 && !opts.force) {
    return { status: 'saved', hydrated: false, updatedAt: meta.updatedAt }
  }
  if (!opts.force && meta.fingerprint && localFp === meta.fingerprint) {
    return { status: 'saved', hydrated: false, updatedAt: meta.updatedAt }
  }

  let hydrated = false
  try {
    const pushRes = await postBackup(fetchImpl, endpoint, localObj, meta.updatedAt, {
      force: opts.force,
      keepalive: opts.keepalive,
    })
    if (!pushRes.ok || !pushRes.data) {
      return { status: 'offline', hydrated: false, updatedAt: meta.updatedAt }
    }
    if (!pushRes.data.enabled) {
      return { status: 'local', hydrated: false, updatedAt: meta.updatedAt }
    }
    if (pushRes.data.action === 'saved') {
      const nextAt = Number(pushRes.data.updatedAt ?? Date.now())
      writeMeta(opts.storage, {
        updatedAt: nextAt,
        fingerprint: localFp,
        activityScore: Number(pushRes.data.activityScore ?? localScore),
      })
      return { status: 'saved', hydrated: false, updatedAt: nextAt }
    }
    if (
      (pushRes.data.action === 'conflict' || pushRes.data.action === 'pulled') &&
      pushRes.data.backup
    ) {
      const imported = importLearningStorage(
        opts.storage,
        opts.key,
        JSON.stringify(pushRes.data.backup),
      )
      if (imported.ok) {
        hydrated = true
        opts.onHydrated?.()
        dispatchCloudHydrated()
      }
      const serverAt = Number(pushRes.data.updatedAt ?? meta.updatedAt)
      const mergedObj = JSON.parse(exportLearningStorage(opts.storage, opts.key)) as Record<
        string,
        unknown
      >
      const mergedFp = fingerprintBackup(mergedObj)
      const serverFp = fingerprintBackup(pushRes.data.backup)
      if (!opts.keepalive && mergedFp !== serverFp && computeBackupActivityScore(mergedObj) > 0) {
        const retryRes = await postBackup(fetchImpl, endpoint, mergedObj, serverAt)
        if (retryRes.ok && retryRes.data?.action === 'saved') {
          const retryAt = Number(retryRes.data.updatedAt ?? serverAt)
          writeMeta(opts.storage, {
            updatedAt: retryAt,
            fingerprint: mergedFp,
            activityScore: Number(retryRes.data.activityScore ?? localScore),
          })
          return { status: 'saved', hydrated, updatedAt: retryAt }
        }
      }
      writeMeta(opts.storage, {
        updatedAt: serverAt,
        fingerprint: mergedFp,
        activityScore: Math.max(localScore, Number(pushRes.data.activityScore ?? 0)),
      })
      return { status: 'saved', hydrated, updatedAt: serverAt }
    }
    return { status: 'saved', hydrated, updatedAt: meta.updatedAt }
  } catch {
    return { status: 'offline', hydrated, updatedAt: meta.updatedAt }
  }
}

/** Force-push an intentional full reset snapshot so cloud backup restarts cleanly at Lv 1. */
export async function forcePushCloudReset(opts: SyncOptions): Promise<SyncResult> {
  try {
    opts.storage.removeItem(CLOUD_META_KEY)
  } catch {
    /* ignore storage cleanup errors */
  }
  return pushToCloudIfChanged({ ...opts, force: true })
}
