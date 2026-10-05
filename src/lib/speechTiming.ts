/** Word boundaries from the synthesizer, in audio seconds and UTF-16 offsets. */
export interface WordTiming {
  start: number
  duration: number
  charIndex: number
  charLength: number
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
