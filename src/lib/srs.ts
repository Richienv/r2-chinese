import { t } from './i18n.ts'
import { createEmptyCard, fsrs, Rating as Grade, State, type Card as FsrsCard } from 'ts-fsrs'
export type Rating = 'again' | 'hard' | 'good' | 'easy'
export type Skill = 'recall' | 'reading' | 'listening' | 'speaking' | 'writing'
export const DAY = 86_400_000
export const SCHEDULER = 'fsrs-6/ts-fsrs@5.2.3/yulu-2'
export interface Card {
  zh: string
  lesson: number
  ease: number
  interval: number
  due: number
  reps: number
  skill?: Skill
  lastReview?: number
  baseline?: boolean
  provenance?: 'legacy' | 'observed' | 'placement'
  memory?: Omit<FsrsCard, 'due' | 'last_review'> & { due: number; last_review?: number }
}
const model = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
  enable_short_term: true,
})
const grades = { again: Grade.Again, hard: Grade.Hard, good: Grade.Good, easy: Grade.Easy } as const
export function newCard(zh: string, lesson: number, now = Date.now()): Card {
  return { zh, lesson, ease: 2.5, interval: 0, due: now, reps: 0, provenance: 'observed' }
}
/** Migration never reschedules. Bootstrap only at a real observed review. */
export function schedule(card: Card, rating: Rating, now = Date.now(), placement = false): Card {
  if (card.lastReview !== undefined && now < card.lastReview) return card
  const baseline = placement && !card.baseline
  if (card.lastReview !== undefined && now < card.due && rating !== 'again' && !baseline) return card
  const input: FsrsCard = card.memory
    ? {
        ...card.memory,
        due: new Date(card.memory.due),
        last_review: card.memory.last_review === undefined ? undefined : new Date(card.memory.last_review),
      }
    : createEmptyCard(new Date(now))
  const next = model.next(input, new Date(now), grades[rating]).card
  let interval = (next.due.getTime() - now) / DAY
  const pass = rating === 'good' || rating === 'easy'
  if (!card.memory && pass && card.interval > 0) interval = Math.max(interval, Math.min(365, card.interval))
  if (baseline && pass) interval = Math.max(interval, 14)
  interval = Math.min(365, Math.max(1 / 1440, interval))
  const due = now + interval * DAY
  if (interval !== (next.due.getTime() - now) / DAY) {
    next.stability = Math.max(next.stability, interval)
    next.scheduled_days = interval
    next.state = State.Review
  }
  return {
    ...card,
    interval,
    due,
    reps: card.reps + 1,
    lastReview: now,
    baseline: baseline || card.baseline,
    provenance: placement
      ? 'placement'
      : card.memory
        ? card.provenance
        : card.reps > 0
          ? 'legacy'
          : 'observed',
    memory: { ...next, due, last_review: now },
  }
}
export function dueCards(cards: Card[], now = Date.now()): Card[] {
  return cards
    .filter((c) => Number.isFinite(c.due) && c.due <= now)
    .sort((a, b) => a.due - b.due || a.lesson - b.lesson)
}
export function intervalText(due: number, now = Date.now()): string {
  const minutes = Math.max(1, Math.round((due - now) / 60_000))
  if (minutes < 60) return t('{n} min', { n: minutes })
  if (minutes < 1440) return t('{n} h', { n: Math.round(minutes / 60) })
  const days = Math.round(minutes / 1440)
  return days < 60 ? t('{n} d', { n: days }) : t('{n} mo', { n: Math.round(days / 30) })
}
export function memoryTier(card?: Card): 'new' | 'learning' | 'stable' | 'strong' | 'maintained' {
  if (!card || (!card.lastReview && !card.reps)) return 'new'
  return card.interval >= 180
    ? 'maintained'
    : card.interval >= 60
      ? 'strong'
      : card.interval >= 14
        ? 'stable'
        : 'learning'
}
