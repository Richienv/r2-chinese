import type { Rating } from './srs.ts'

/** Card lessons are offset per book: HSK 4 as is, Kerja + 1000, 汉语教程 + 3000. */
export type Book = 'hsk' | 'kerja' | 'jiaocheng'
export type RecallStyle = 'meaning' | 'dictation' | 'sentence'

export function bookOf(lesson: number | undefined): { book: Book; unit: number } {
  const n = lesson ?? 0
  if (n >= 3000) return { book: 'jiaocheng', unit: n - 3000 }
  if (n >= 1000) return { book: 'kerja', unit: n - 1000 }
  return { book: 'hsk', unit: n }
}

/** HSK 4 writes from the meaning, 汉语教程 is dictation, Kerja fills the word into a work sentence. */
export const BOOK_STYLE: Record<Book, RecallStyle> = { hsk: 'meaning', jiaocheng: 'dictation', kerja: 'sentence' }

/** How badly a word was forgotten decides when it returns. */
export type Forget = 'blank' | 'fuzzy' | 'almost'
export const FORGET_LEVELS: readonly Forget[] = ['blank', 'fuzzy', 'almost']
export const FORGET_DELAY: Record<Forget, number | undefined> = { blank: undefined, fuzzy: 1, almost: 2 }

export interface RecallChoice {
  key: Rating | Forget | 'continue'
  rating: Rating
  delayDays?: number
}

/** A right answer after one hint counts as Hard; after two it simply comes back tomorrow. */
export function hintedChoice(hints: number): RecallChoice {
  return hints >= 2 ? { key: 'continue', rating: 'hard', delayDays: 1 } : { key: 'continue', rating: 'hard' }
}

export function recallChoices({
  failed,
  hints,
  selfMode,
  allowed,
}: {
  /** A wrong check, "I don't know", or the answer shown by the hint ladder. */
  failed: boolean
  hints: number
  selfMode: boolean
  allowed: readonly Rating[]
}): RecallChoice[] {
  if (selfMode) return allowed.map((rating) => ({ key: rating, rating }))
  if (failed) return FORGET_LEVELS.map((level) => ({ key: level, rating: 'again', delayDays: FORGET_DELAY[level] }))
  if (hints > 0) return [hintedChoice(hints)]
  return (['hard', 'good', 'easy'] as const).map((rating) => ({ key: rating, rating }))
}

const DAY_MIN = 24 * 60
/** Now, 1 day, 1 week, 1 month and 6 months sit evenly on the timeline. */
export const TIMELINE_STOPS = [0, DAY_MIN, 7 * DAY_MIN, 30 * DAY_MIN, 182 * DAY_MIN] as const

/** Position (0–1) of a return date: evenly spaced stops, logarithmic between them. */
export function timelinePosition(due: number, now: number): number {
  const minutes = Math.max(0, (due - now) / 60_000)
  const step = 1 / (TIMELINE_STOPS.length - 1)
  if (minutes <= TIMELINE_STOPS[1]) return (step * Math.log1p(minutes)) / Math.log1p(TIMELINE_STOPS[1])
  for (let i = 1; i < TIMELINE_STOPS.length - 1; i++) {
    const from = TIMELINE_STOPS[i], to = TIMELINE_STOPS[i + 1]
    if (minutes <= to) return step * (i + Math.log(minutes / from) / Math.log(to / from))
  }
  return 1
}
