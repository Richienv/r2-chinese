import { STUDY_TRACKS, type StudyTrack } from './studyTracks'

export const MUSIC_CACHE_NAME = 'study-music-offline-v1'
export const MUSIC_INDEX_VERSION = 1
const MUSIC_IDB_NAME = 'study-music-idb-v1'
const MUSIC_IDB_STORE = 'tracks'

export interface IndexedMusicTrack extends StudyTrack {
  version: number
  cached: boolean
}

export interface MusicCacheSnapshot {
  tracks: IndexedMusicTrack[]
  cachedCount: number
  totalCount: number
  downloadingId: string | null
  persisted: boolean
  ready: boolean
}

const cachedIds = new Set<string>()
const blobUrls = new Map<string, string>()
const listeners = new Set<() => void>()

let downloadingId: string | null = null
let persisted = false
let ready = false
let prefetchStarted = false
let priorityOverrideId: string | null = null
let queueRunning = false

function emit() {
  listeners.forEach((fn) => fn())
}

function makeSnapshot(): MusicCacheSnapshot {
  return {
    tracks: STUDY_TRACKS.map((t) => ({
      ...t,
      version: MUSIC_INDEX_VERSION,
      cached: cachedIds.has(t.id),
    })),
    cachedCount: cachedIds.size,
    totalCount: STUDY_TRACKS.length,
    downloadingId,
    persisted,
    ready,
  }
}

export function getMusicCacheSnapshot(): MusicCacheSnapshot {
  return makeSnapshot()
}

export function subscribeMusicCache(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function versionedUrl(src: string): string {
  return `${src}?v=${MUSIC_INDEX_VERSION}`
}

async function openCacheStorage(): Promise<Cache | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null
  try {
    return await window.caches.open(MUSIC_CACHE_NAME)
  } catch {
    return null
  }
}

function openMusicIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(MUSIC_IDB_NAME, MUSIC_INDEX_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(MUSIC_IDB_STORE)) {
          db.createObjectStore(MUSIC_IDB_STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbGetBlob(src: string): Promise<Blob | null> {
  const db = await openMusicIdb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(MUSIC_IDB_STORE, 'readonly')
      const req = tx.objectStore(MUSIC_IDB_STORE).get(versionedUrl(src))
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbPutBlob(src: string, blob: Blob): Promise<boolean> {
  const db = await openMusicIdb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(MUSIC_IDB_STORE, 'readwrite')
      const req = tx.objectStore(MUSIC_IDB_STORE).put(blob, versionedUrl(src))
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      req.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

async function idbHasKey(src: string): Promise<boolean> {
  const db = await openMusicIdb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(MUSIC_IDB_STORE, 'readonly')
      const req = tx.objectStore(MUSIC_IDB_STORE).count(versionedUrl(src))
      req.onsuccess = () => resolve((req.result ?? 0) > 0)
      req.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export async function hydrateMusicCacheIndex(): Promise<MusicCacheSnapshot> {
  if (typeof window === 'undefined') return makeSnapshot()
  const cache = await openCacheStorage()
  for (const track of STUDY_TRACKS) {
    let hit = false
    if (cache) {
      try {
        const matched = (await cache.match(versionedUrl(track.src))) ?? (await cache.match(track.src))
        if (matched && matched.ok) hit = true
      } catch {
        /* ignore single cache lookup failure */
      }
    }
    if (!hit) {
      hit = await idbHasKey(track.src)
    }
    if (hit) cachedIds.add(track.id)
  }
  // Pre-warm blob URL for the priority/active track so first tap calls audio.play() synchronously on iOS Safari.
  if (priorityOverrideId && cachedIds.has(priorityOverrideId)) {
    const t = STUDY_TRACKS.find((x) => x.id === priorityOverrideId)
    if (t) void resolvePlayableAudioUrl(t)
  }
  ready = true
  emit()
  return makeSnapshot()
}

/** Synchronous cache lookup for iOS user-gesture audio.play() compliance. */
export function getSyncPlayableAudioUrl(trackId: string): string | null {
  return blobUrls.get(trackId) ?? null
}

export async function getCachedAudioBlob(track: Pick<StudyTrack, 'id' | 'src'>): Promise<Blob | null> {
  if (typeof window === 'undefined') return null
  const cache = await openCacheStorage()
  if (cache) {
    try {
      const res = (await cache.match(versionedUrl(track.src))) ?? (await cache.match(track.src))
      if (res && res.ok) {
        const blob = await res.blob()
        if (blob.size > 0) {
          cachedIds.add(track.id)
          emit()
          return blob
        }
      }
    } catch {
      /* fallback to IDB */
    }
  }
  const idbBlob = await idbGetBlob(track.src)
  if (idbBlob && idbBlob.size > 0) {
    cachedIds.add(track.id)
    emit()
    return idbBlob
  }
  return null
}

/** Cache-first source resolver: returns instant offline blob: URL if cached, or falls back cleanly to network URL. */
export async function resolvePlayableAudioUrl(track: Pick<StudyTrack, 'id' | 'src'>): Promise<string> {
  const existingUrl = blobUrls.get(track.id)
  if (existingUrl) return existingUrl

  const blob = await getCachedAudioBlob(track)
  if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    // Keep at most 3 recent object URLs warm and revoke older ones to keep mobile RAM crisp.
    if (blobUrls.size >= 3) {
      const oldestKey = blobUrls.keys().next().value
      if (oldestKey && oldestKey !== track.id) {
        const oldUrl = blobUrls.get(oldestKey)
        if (oldUrl) {
          try { URL.revokeObjectURL(oldUrl) } catch { /* ignore */ }
        }
        blobUrls.delete(oldestKey)
      }
    }
    const objUrl = URL.createObjectURL(blob)
    blobUrls.set(track.id, objUrl)
    return objUrl
  }

  // Trigger non-blocking priority download for future offline replays
  prioritizeMusicTrackCache(track.id)
  return track.src
}

async function fetchAndStoreTrack(track: StudyTrack): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false
  if (cachedIds.has(track.id)) return true
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false

  downloadingId = track.id
  emit()
  try {
    const response = await fetch(track.src, { cache: 'default' })
    if (!response.ok) return false

    const contentType = response.headers.get('content-type') || 'audio/mp4'
    const cloneForCache = response.clone()
    let stored = false

    const cache = await openCacheStorage()
    if (cache) {
      try {
        const headers = new Headers(cloneForCache.headers)
        if (!headers.has('content-type')) headers.set('content-type', contentType)
        const normalized = new Response(cloneForCache.body, {
          status: 200,
          statusText: 'OK',
          headers,
        })
        await cache.put(versionedUrl(track.src), normalized)
        stored = true
      } catch {
        stored = false
      }
    }

    if (!stored) {
      const blob = await response.blob()
      if (blob.size > 0) {
        stored = await idbPutBlob(track.src, blob)
      }
    }

    if (stored) {
      cachedIds.add(track.id)
      // Pre-warm ObjectURL for first/priority track so synchronous tap playback starts from cache
      if (!blobUrls.has(track.id)) {
        void resolvePlayableAudioUrl(track)
      }
    }
    return stored
  } catch {
    return false
  } finally {
    if (downloadingId === track.id) downloadingId = null
    emit()
  }
}

function buildDownloadOrder(priorityTrackId?: string): StudyTrack[] {
  const ordered: StudyTrack[] = []
  const seen = new Set<string>()
  const add = (track?: StudyTrack) => {
    if (!track || seen.has(track.id) || cachedIds.has(track.id)) return
    seen.add(track.id)
    ordered.push(track)
  }

  if (priorityTrackId) {
    add(STUDY_TRACKS.find((t) => t.id === priorityTrackId))
  }
  // Cache short crisp tracks first (~1.3-3.4MB each -> 10/14 ready within seconds), then longer focus mixes
  for (const t of STUDY_TRACKS) {
    if (t.category === 'track') add(t)
  }
  for (const t of STUDY_TRACKS) {
    add(t)
  }
  return ordered
}

async function runCacheQueue(initialPriorityId?: string) {
  if (queueRunning) return
  queueRunning = true
  try {
    await hydrateMusicCacheIndex()
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      try {
        persisted = await navigator.storage.persist()
        emit()
      } catch {
        /* persistence request is best-effort */
      }
    }

    let nextPriority = initialPriorityId
    while (cachedIds.size < STUDY_TRACKS.length) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break
      const activePriority = priorityOverrideId ?? nextPriority
      priorityOverrideId = null
      nextPriority = undefined

      const queue = buildDownloadOrder(activePriority)
      const nextTrack = queue[0]
      if (!nextTrack) break

      await fetchAndStoreTrack(nextTrack)
      // Yield gently between background downloads so UI/study interactions never stutter
      await new Promise((r) => setTimeout(r, 180))
    }
  } finally {
    queueRunning = false
    downloadingId = null
    emit()
  }
}

/** Non-blocking background pre-cacher for all 14 tracks (starts after initial paint). */
export function initStudyMusicCache(priorityTrackId?: string): void {
  if (typeof window === 'undefined') return
  if (prefetchStarted) {
    if (priorityTrackId) prioritizeMusicTrackCache(priorityTrackId)
    return
  }
  prefetchStarted = true
  if (priorityTrackId) priorityOverrideId = priorityTrackId

  const kickOff = () => {
    void runCacheQueue(priorityTrackId)
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(kickOff, { timeout: 1400 })
  } else {
    globalThis.setTimeout(kickOff, 600)
  }
}

export function prioritizeMusicTrackCache(trackId: string): void {
  if (typeof window === 'undefined' || cachedIds.has(trackId)) return
  priorityOverrideId = trackId
  if (!queueRunning) {
    void runCacheQueue(trackId)
  }
}
