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
/**
 * Migration never reschedules. Bootstrap only at a real observed review.
 * `delayDays` is a return date the learner chose (how badly they forgot, how much help they needed);
 * the memory model still updates from the rating.
 */
export function schedule(card: Card, rating: Rating, now = Date.now(), placement = false, delayDays?: number): Card {
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
  const chosen = delayDays !== undefined && Number.isFinite(delayDays)
  if (chosen) interval = delayDays
  interval = Math.min(365, Math.max(1 / 1440, interval))
  const due = now + interval * DAY
  if (!chosen && interval !== (next.due.getTime() - now) / DAY) {
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

/** The model's chance (0–1) that the word is still remembered right now; null before the first review. */
export function recallChance(card: Card | undefined, now = Date.now()): number | null {
  if (!card || card.lastReview === undefined) return null
  if (card.memory?.last_review !== undefined) {
    const elapsed = Math.max(0, (now - card.memory.last_review) / DAY)
    return model.forgetting_curve(elapsed, Math.max(card.memory.stability, 0.01))
  }
  return model.forgetting_curve(Math.max(0, (now - card.lastReview) / DAY), Math.max(card.interval, 0.01))
}

function startOfDay(at: number) {
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

/** "in 10 min", "tomorrow", "in 5 days": when the word comes back, in words. */
export function whenText(due: number, now = Date.now()): string {
  const minutes = Math.max(1, Math.round((due - now) / 60_000))
  if (minutes < 60) return t('in {n} min', { n: minutes })
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY)
  if (days <= 0) return t('in {n} h', { n: Math.max(1, Math.round(minutes / 60)) })
  if (days === 1) return t('tomorrow')
  if (days === 2) return t('the day after tomorrow')
  if (days < 45) return t('in {n} days', { n: days })
  return t('in {n} months', { n: Math.round(days / 30) })
}
