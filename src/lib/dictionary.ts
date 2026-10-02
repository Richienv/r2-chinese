import { entryFromSenses, type CedictShard, type DictionaryEntry } from './dictionary-format'
export type { DictionaryEntry } from './dictionary-format'

const CACHE_KEY = 'yulu.dictionary.cc-cedict.v1'
const REFRESH_MS = 7 * 86_400_000
const shards = new Map<number, Promise<CedictShard>>()
const refreshes = new Map<string, Promise<DictionaryEntry | null>>()
let entries: Record<string, DictionaryEntry> | undefined

function cache(): Record<string, DictionaryEntry> {
  if (entries) return entries
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
    entries = raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw).filter(([zh, entry]) => entry && typeof entry === 'object' && (entry as DictionaryEntry).zh === zh && typeof (entry as DictionaryEntry).en === 'string' && typeof (entry as DictionaryEntry).pinyin === 'string' && Array.isArray((entry as DictionaryEntry).readings) && (entry as DictionaryEntry).source === 'CC-CEDICT')) : {}
  } catch { entries = {} }
  return entries
}

function remember(entry: DictionaryEntry): DictionaryEntry {
  const recent = Object.values({ ...cache(), [entry.zh]: { ...entry, cachedAt: Date.now() } }).sort((a, b) => (b.cachedAt ?? b.refreshedAt ?? 0) - (a.cachedAt ?? a.refreshedAt ?? 0)).slice(0, 250)
  entries = Object.fromEntries(recent.map((word) => [word.zh, word]))
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entries)) } catch { /* memory cache still works */ }
  return entry
}

export function cachedDictionaryEntry(word: string): DictionaryEntry | undefined { return cache()[word] }

/** The bundled source is sharded: tapping a word loads only its small first-character bucket. */
export async function bundledDictionaryEntry(word: string): Promise<DictionaryEntry | null> {
  if (!word) return null
  if (cache()[word]) return cache()[word]
  const bucket = word.codePointAt(0)! % 128
  let loading = shards.get(bucket)
  if (!loading) {
    loading = fetch(`/dictionary/cedict-${bucket.toString(16).padStart(2, '0')}.json`, { cache: 'force-cache' }).then(async (response) => {
      if (!response.ok) throw new Error('Dictionary source could not load')
      return await response.json() as CedictShard
    })
    shards.set(bucket, loading)
    void loading.catch(() => shards.delete(bucket))
  }
  const shard = await loading
  const entry = entryFromSenses(word, shard[word])
  return entry ? remember(entry) : null
}

/** Online refresh stays on the app's origin; the server reads the official open-data export. */
export async function refreshDictionaryEntry(word: string, force = false): Promise<DictionaryEntry | null> {
  const previous = cache()[word]
  if (!force && previous?.refreshedAt && Date.now() - previous.refreshedAt < REFRESH_MS) return previous
  if (refreshes.has(word)) return refreshes.get(word)!
  const request = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 16000)
    try {
      const response = await fetch(`/api/dictionary?word=${encodeURIComponent(word)}`, { signal: controller.signal })
      if (!response.ok) return null
      const data = await response.json() as { entry?: DictionaryEntry | null }
      const entry = data.entry
      if (!entry || entry.zh !== word || !entry.en || !entry.pinyin || !Array.isArray(entry.readings) || entry.source !== 'CC-CEDICT') return null
      return remember({ ...entry, refreshedAt: Date.now() })
    } catch { return null }
    finally { clearTimeout(timeout); refreshes.delete(word) }
  })()
  refreshes.set(word, request)
  return request
}
