import type { WordTiming } from './speechTiming.ts'

/**
 * The publisher's own recordings of HSK Standard Course 4A. Each entry points
 * at a stretch of one track: a whole speaker turn, or one vocabulary word.
 * Timestamps only. The audio itself is fetched by scripts/fetch-book-audio.mjs.
 */
export interface ClipEntry {
  /** Track id, e.g. "L01-2" is lesson 1, text 2. */
  f: string
  /** Seconds into the track. */
  s: number
  e: number
  /** Measured word spans for lines: [charIndex, charLength, start, duration], start relative to `s`. */
  w?: Array<[number, number, number, number]>
}

export interface AudioManifest {
  version: number
  lines: Record<string, ClipEntry>
  words: Record<string, ClipEntry>
}

export interface BookClip {
  url: string
  start: number
  end: number
  words: WordTiming[]
  /** Called when the recording cannot be loaded, so later lookups stop trying it. */
  fail: () => void
}

/** Chinese text compared with all whitespace removed, so layout never decides a match. */
export function clipKey(text: string): string {
  return text.replace(/\s+/g, '')
}

export function trackUrl(base: string, file: string): string {
  return `${base.replace(/\/*$/, '/')}${file}.mp3`
}

function normalize(entries: Record<string, ClipEntry>): Map<string, ClipEntry> {
  const map = new Map<string, ClipEntry>()
  for (const [text, entry] of Object.entries(entries)) map.set(clipKey(text), entry)
  return map
}

/**
 * Resolves exact book text to a recorded clip. Anything that is not an exact
 * line or vocabulary word of the book returns null and keeps the synthesized voice.
 */
export function createClipResolver(manifest: AudioManifest, base: string, isReady: () => boolean = () => true) {
  const lines = normalize(manifest.lines)
  const words = normalize(manifest.words)
  const broken = new Set<string>()
  return function resolve(text: string): BookClip | null {
    if (!isReady()) return null
    const key = clipKey(text)
    const hit = lines.get(key) ?? words.get(key)
    if (!hit || broken.has(hit.f)) return null
    return {
      url: trackUrl(base, hit.f),
      start: hit.s,
      end: hit.e,
      words: (hit.w ?? []).map(([charIndex, charLength, start, duration]) => ({ charIndex, charLength, start, duration })),
      fail: () => { broken.add(hit.f) },
    }
  }
}
