import { neon } from '@neondatabase/serverless'

const MAX_BODY_BYTES = 2_500_000
const PROFILE_PATTERN = /^[a-z0-9_-]{1,40}$/
const PROGRESS_KEY = 'yulu.hsk4a.v1'

const DEVICE_SCORE_KEYS = new Set([
  'yulu.hsk1.v1',
  'yulu.jiaocheng.v1',
  'yulu.kerja.v1',
  'yulu.magang.v1',
  'yulu.interview.v1',
  'yulu.books.v1',
  'yulu.books.journal.v1',
  'yulu.jiayin.v1',
  'yulu.jiayin.english.v1',
  'yulu.history.v1',
  'yulu.learner-graph.v1',
  'yulu.learning-checkpoints.v1',
])

export interface CloudSyncRow {
  syncId: string
  payload: Record<string, unknown>
  activityScore: number
  updatedAt: number
}

export interface CloudSyncAdapter {
  enabled: boolean
  read: (syncId: string) => Promise<CloudSyncRow | null>
  write: (row: CloudSyncRow) => Promise<void>
}

function send(res: any, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.end(JSON.stringify(body))
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function tryParseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isMainProgressKey(k: string): boolean {
  if (k === PROGRESS_KEY) return true
  if (!k.startsWith(PROGRESS_KEY + '.')) return false
  if (k.includes('.before-') || k.endsWith('.pending') || k.includes('.server-before-v2')) return false
  return true
}

function scoreDeviceJson(val: unknown): number {
  if (Array.isArray(val)) return val.length * 10
  if (!isPlainRecord(val)) return 0
  let score = 0
  for (const [k, v] of Object.entries(val)) {
    if (k === 'version' || k === 'updatedAt') continue
    if (k === 'unlockedLesson' || k === 'unlockedChapter') {
      if (typeof v === 'number' && Number.isFinite(v) && v > 1) score += (v - 1) * 15
      continue
    }
    if (Array.isArray(v)) {
      score += v.length * 10
    } else if (isPlainRecord(v)) {
      for (const nested of Object.values(v)) {
        if (Array.isArray(nested)) score += nested.length * 10
        else if (isPlainRecord(nested)) score += Object.keys(nested).length * 10
        else if (typeof nested === 'string' && nested.trim()) score += 10
        else if (typeof nested === 'number' && nested > 0) score += 5
      }
    } else if (typeof v === 'string' && v.trim()) {
      score += 10
    } else if (typeof v === 'number' && Number.isFinite(v) && v > 0 && k !== 'currentLesson') {
      score += 5
    } else if (typeof v === 'number' && k === 'currentLesson' && v > 1) {
      score += 10
    }
  }
  return score
}

export function computeBackupActivityScore(rawOrParsed: unknown): number {
  const parsed = typeof rawOrParsed === 'string' ? tryParseJson(rawOrParsed) : rawOrParsed
  if (!isPlainRecord(parsed)) return 0
  let entries: Record<string, unknown> | null = null
  if (parsed.format === 'yulu-progress-backup' && isPlainRecord(parsed.entries)) {
    entries = parsed.entries
  } else if ('cards' in parsed || 'lessonsDone' in parsed || 'xp' in parsed) {
    entries = { [PROGRESS_KEY]: parsed }
  }
  if (!entries) return 0

  let total = 0
  for (const [k, rawVal] of Object.entries(entries)) {
    if (isMainProgressKey(k)) {
      const p = tryParseJson(rawVal)
      if (!isPlainRecord(p)) continue
      const xp = typeof p.xp === 'number' && Number.isFinite(p.xp) ? Math.max(0, Math.round(p.xp)) : 0
      const lessons = Array.isArray(p.lessonsDone) ? p.lessonsDone.length : 0
      const cards = isPlainRecord(p.cards) ? Object.keys(p.cards).length : 0
      const mastery = isPlainRecord(p.mastery) ? Object.keys(p.mastery).length : 0
      const events =
        isPlainRecord(p.learning) && isPlainRecord(p.learning.events)
          ? Object.keys(p.learning.events).length
          : 0
      const pathDone = isPlainRecord(p.pathDone) ? Object.keys(p.pathDone).length : 0
      const starred = Array.isArray(p.starred) ? p.starred.length : 0
      const graphNodes =
        isPlainRecord(p.learnerGraph) && isPlainRecord(p.learnerGraph.nodes)
          ? Object.keys(p.learnerGraph.nodes).length
          : 0
      const unlocked =
        typeof p.unlockedLesson === 'number' && Number.isFinite(p.unlockedLesson) && p.unlockedLesson > 1
          ? (p.unlockedLesson - 1) * 15
          : 0
      total +=
        xp +
        lessons * 100 +
        cards * 20 +
        mastery * 10 +
        events * 15 +
        pathDone * 25 +
        starred * 5 +
        graphNodes * 10 +
        unlocked
      continue
    }

    if (DEVICE_SCORE_KEYS.has(k) || k.startsWith('yulu.hsk-writing.v1:')) {
      total += scoreDeviceJson(tryParseJson(rawVal))
      continue
    }

    if (k === 'yulu.course-entered.v1' && rawVal === '1') {
      total += 1
    }
  }
  return total
}

async function readJsonBody(req: any): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) {
        return { ok: false, status: 413, error: 'payload_too_large' }
      }
      try {
        return { ok: true, data: JSON.parse(req.body) }
      } catch {
        return { ok: false, status: 400, error: 'invalid_json' }
      }
    }
    if (Buffer.isBuffer(req.body)) {
      if (req.body.byteLength > MAX_BODY_BYTES) {
        return { ok: false, status: 413, error: 'payload_too_large' }
      }
      try {
        return { ok: true, data: JSON.parse(req.body.toString('utf8')) }
      } catch {
        return { ok: false, status: 400, error: 'invalid_json' }
      }
    }
    const serializedLen = Buffer.byteLength(JSON.stringify(req.body), 'utf8')
    if (serializedLen > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: 'payload_too_large' }
    }
    return { ok: true, data: req.body }
  }

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.byteLength
    if (size > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: 'payload_too_large' }
    }
    chunks.push(buf)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return { ok: false, status: 400, error: 'empty_body' }
  try {
    return { ok: true, data: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400, error: 'invalid_json' }
  }
}

export function createCloudSyncHandler(adapterOrFactory: CloudSyncAdapter | (() => CloudSyncAdapter)) {
  return async function handler(req: any, res: any): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      return send(res, 405, { ok: false, error: 'method_not_allowed' })
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    const rawProfile = url.searchParams.get('profile')?.trim() ?? 'default'
    if (!PROFILE_PATTERN.test(rawProfile)) {
      return send(res, 400, { ok: false, error: 'invalid_profile' })
    }
    const syncId = `yulu:${rawProfile}`

    const adapter = typeof adapterOrFactory === 'function' ? adapterOrFactory() : adapterOrFactory
    if (!adapter.enabled) {
      return send(res, 200, {
        ok: true,
        enabled: false,
        backup: null,
        updatedAt: 0,
        activityScore: 0,
      })
    }

    try {
      if (req.method === 'GET') {
        const existing = await adapter.read(syncId)
        return send(res, 200, {
          ok: true,
          enabled: true,
          backup: existing?.payload ?? null,
          updatedAt: Number(existing?.updatedAt ?? 0),
          activityScore: Number(existing?.activityScore ?? 0),
        })
      }

      const bodyRes = await readJsonBody(req)
      if (!bodyRes.ok) {
        return send(res, bodyRes.status, { ok: false, error: bodyRes.error })
      }
      if (!isPlainRecord(bodyRes.data)) {
        return send(res, 400, { ok: false, error: 'invalid_body' })
      }

      const backup = bodyRes.data.backup
      if (
        !isPlainRecord(backup) ||
        backup.format !== 'yulu-progress-backup' ||
        !isPlainRecord(backup.entries)
      ) {
        return send(res, 400, { ok: false, error: 'invalid_backup_format' })
      }

      const expectedUpdatedAt =
        typeof bodyRes.data.expectedUpdatedAt === 'number' &&
        Number.isFinite(bodyRes.data.expectedUpdatedAt)
          ? bodyRes.data.expectedUpdatedAt
          : 0
      const force = bodyRes.data.force === true
      const incomingScore = computeBackupActivityScore(backup)

      const existing = await adapter.read(syncId)
      const existingScore = Number(existing?.activityScore ?? 0)
      const existingUpdatedAt = Number(existing?.updatedAt ?? 0)

      // Anti-loss guard #1: never let an empty device erase real saved cloud progress.
      if (existing && existingScore > 0 && incomingScore === 0 && !force) {
        return send(res, 200, {
          ok: true,
          enabled: true,
          action: 'pulled',
          backup: existing.payload,
          updatedAt: existingUpdatedAt,
          activityScore: existingScore,
        })
      }

      // Anti-loss guard #2: optimistic concurrency conflict prompts client merge before retry.
      if (existing && existingScore > 0 && existingUpdatedAt > expectedUpdatedAt && !force) {
        return send(res, 200, {
          ok: true,
          enabled: true,
          action: 'conflict',
          backup: existing.payload,
          updatedAt: existingUpdatedAt,
          activityScore: existingScore,
        })
      }

      const now = Math.max(Date.now(), existingUpdatedAt + 1)
      await adapter.write({
        syncId,
        payload: backup,
        activityScore: incomingScore,
        updatedAt: now,
      })

      return send(res, 200, {
        ok: true,
        enabled: true,
        action: 'saved',
        updatedAt: now,
        activityScore: incomingScore,
      })
    } catch {
      return send(res, 503, { ok: false, error: 'cloud_sync_unavailable' })
    }
  }
}

let schemaReadyUrl = ''
let schemaReadyPromise: Promise<void> | null = null

async function ensureSchema(url: string, sql: ReturnType<typeof neon>): Promise<void> {
  if (schemaReadyPromise && schemaReadyUrl === url) return schemaReadyPromise
  schemaReadyUrl = url
  schemaReadyPromise = (async () => {
    // Dedicated isolated `yulu` schema keeps unrelated `public` tables untouched.
    await sql`CREATE SCHEMA IF NOT EXISTS yulu`
    await sql`
      CREATE TABLE IF NOT EXISTS yulu.cloud_sync (
        sync_id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        activity_score BIGINT NOT NULL DEFAULT 0,
        updated_at BIGINT NOT NULL
      )
    `
  })().catch((err) => {
    schemaReadyPromise = null
    throw err
  })
  return schemaReadyPromise
}

function getNeonAdapter(): CloudSyncAdapter {
  const url = (process.env.YULU_DATABASE_URL || process.env.DATABASE_URL || '').trim()
  if (!url) {
    return {
      enabled: false,
      read: async () => null,
      write: async () => {},
    }
  }
  const sql = neon(url)
  return {
    enabled: true,
    read: async (syncId) => {
      await ensureSchema(url, sql)
      const rows = (await sql`
        SELECT sync_id, payload, activity_score, updated_at
        FROM yulu.cloud_sync
        WHERE sync_id = ${syncId}
        LIMIT 1
      `) as Array<{
        sync_id: string
        payload: unknown
        activity_score: string | number
        updated_at: string | number
      }>
      const row = rows[0]
      if (!row) return null
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
      if (!isPlainRecord(payload)) return null
      return {
        syncId: row.sync_id,
        payload,
        activityScore: Number(row.activity_score ?? 0),
        updatedAt: Number(row.updated_at ?? 0),
      }
    },
    write: async (row) => {
      await ensureSchema(url, sql)
      const jsonPayload = JSON.stringify(row.payload)
      await sql`
        INSERT INTO yulu.cloud_sync (sync_id, payload, activity_score, updated_at)
        VALUES (${row.syncId}, ${jsonPayload}::jsonb, ${row.activityScore}, ${row.updatedAt})
        ON CONFLICT (sync_id) DO UPDATE SET
          payload = EXCLUDED.payload,
          activity_score = EXCLUDED.activity_score,
          updated_at = EXCLUDED.updated_at
      `
    },
  }
}

export default createCloudSyncHandler(getNeonAdapter)
