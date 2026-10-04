/** Word boundaries from the synthesizer, in audio seconds and UTF-16 offsets. */
export interface WordTiming {
  start: number
  duration: number
  charIndex: number
  charLength: number
}

export interface SpokenBoundary { text: string; offset: number; duration: number }

export function parseSpeechMetadata(message: string): SpokenBoundary[] {
  const split = message.indexOf('\r\n\r\n')
  if (split < 0 || !message.slice(0, split).includes('Path:audio.metadata')) return []
  try {
    const body = JSON.parse(message.slice(split + 4))
    if (!Array.isArray(body.Metadata)) return []
    return body.Metadata.flatMap((entry: any) => {
      const data = entry?.Data
      if (entry?.Type !== 'WordBoundary' || typeof data?.text?.Text !== 'string' || !Number.isFinite(data.Offset) || !Number.isFinite(data.Duration) || data.Offset < 0 || data.Duration < 0) return []
      const text = data.text.Text.replace(/&(amp|lt|gt|quot|apos);/g, (_: string, key: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[key]!))
      // Edge's metadata uses 100ns ticks. Keep the service timing; never infer
      // word positions from a timer or from the length of a Chinese sentence.
      return [{ text, offset: data.Offset / 10000000, duration: data.Duration / 10000000 }]
    })
  } catch { return [] }
}

export function alignSpeechBoundaries(text: string, boundaries: SpokenBoundary[]): WordTiming[] {
  let cursor = 0
  const words: WordTiming[] = []
  for (const boundary of boundaries) {
    if (!boundary.text || !Number.isFinite(boundary.offset) || boundary.offset < 0) continue
    const index = text.indexOf(boundary.text, cursor)
    if (index < 0) continue
    words.push({ start: boundary.offset, duration: boundary.duration, charIndex: index, charLength: boundary.text.length })
    cursor = index + boundary.text.length
  }
  return words.sort((a, b) => a.start - b.start)
}

export function timingAt(words: WordTiming[], seconds: number): WordTiming | undefined {
  // The current word keeps its focus during the natural breath before the next.
  let low = 0
  let high = words.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >>> 1
    if (words[mid].start <= seconds) { found = mid; low = mid + 1 }
    else high = mid - 1
  }
  return found < 0 ? undefined : words[found]
}

export function rangesOverlap(start: number, length: number, activeStart: number | null, activeLength: number): boolean {
  return activeStart !== null && activeLength > 0 && start < activeStart + activeLength && start + length > activeStart
}
