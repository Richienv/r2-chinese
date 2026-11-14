const CACHE = 'yulu-voice-v2'
const MAX_CLIPS = 96
/** Optional device cache. Quota/private-mode failures must never stop playback. */
export async function audioResponse(url: string): Promise<Response> {
  let bucket: Cache | undefined
  try {
    if (typeof caches !== 'undefined') {
      bucket = await caches.open(CACHE)
      const hit = await bucket.match(url)
      if (hit) return hit
    }
  } catch {
    /* Network remains available when browser caching is disabled. */
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (response.ok && bucket) {
      try {
        await bucket.put(url, response.clone())
        const keys = await bucket.keys()
        await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_CLIPS)).map((k) => bucket!.delete(k)))
      } catch {
        /* An optional cache cannot block the requested clip. */
      }
    }
    return response
  } finally {
    clearTimeout(timer)
  }
}
/** Mandarin first; never silently choose a Cantonese voice from a broad zh match. */
export function mandarinVoice<T extends { lang: string; name: string }>(voices: T[]): T | undefined {
  const rank = (lang: string) => {
    const l = lang.replace(/_/g, '-').toLowerCase()
    return l === 'zh-cn' ? 0 : l === 'zh-hans' ? 1 : l === 'zh-tw' ? 2 : l === 'zh-sg' ? 3 : 99
  }
  return voices.filter((v) => rank(v.lang) < 99).sort((a, b) => rank(a.lang) - rank(b.lang))[0]
}
export function speechChunks(text: string, max = 350): Array<{ text: string; offset: number }> {
  const chunks: Array<{ text: string; offset: number }> = []
  let offset = 0
  while (offset < text.length) {
    let end = Math.min(text.length, offset + max)
    if (end < text.length) {
      const segment = text.slice(offset, end),
        boundary = Math.max(
          segment.lastIndexOf('。'),
          segment.lastIndexOf('！'),
          segment.lastIndexOf('？'),
          segment.lastIndexOf('，'),
          segment.lastIndexOf(' '),
        )
      if (boundary > max / 2) end = offset + boundary + 1
      if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--
    }
    chunks.push({ text: text.slice(offset, end), offset })
    offset = end
  }
  return chunks
}
