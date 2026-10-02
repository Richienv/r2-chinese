import { gunzipSync } from 'node:zlib'
import { parseCedictWord } from '../src/lib/dictionary-format.ts'

const SOURCE = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'
let source: { text: string; loadedAt: number } | undefined
let loading: Promise<string> | undefined
let failedAt = 0

async function dictionaryText(): Promise<string> {
  if (source && Date.now() - source.loadedAt < 86_400_000) return source.text
  if (loading) return loading
  if (failedAt && Date.now() - failedAt < 60_000) {
    if (source) return source.text
    throw new Error('Dictionary refresh unavailable')
  }
  loading = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 14000)
    try {
      const response = await fetch(SOURCE, { signal: controller.signal })
      if (!response.ok) throw new Error('Dictionary export unavailable')
      const data = Buffer.from(await response.arrayBuffer())
      if (data.byteLength > 12_000_000) throw new Error('Dictionary export too large')
      const text = gunzipSync(data, { maxOutputLength: 32_000_000 }).toString('utf8')
      if (!text.startsWith('# CC-CEDICT')) throw new Error('Unexpected dictionary export')
      source = { text, loadedAt: Date.now() }
      return text
    } catch (error) {
      failedAt = Date.now()
      if (source) return source.text
      throw error
    } finally { clearTimeout(timer); loading = undefined }
  })()
  return loading
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(JSON.stringify({ error: 'Use GET' })); return }
  const url = new URL(req.url ?? '/', 'http://localhost')
  const word = url.searchParams.get('word')?.trim() ?? ''
  if (!/^[\p{Script=Han}·・]{1,30}$/u.test(word)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'A Chinese word is required' })); return }
  try {
    const entry = parseCedictWord(await dictionaryText(), word)
    res.statusCode = 200
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')
    res.end(JSON.stringify({ entry, source: SOURCE }))
  } catch {
    res.statusCode = 503
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify({ error: 'Online refresh unavailable; use the bundled dictionary.' }))
  }
}
