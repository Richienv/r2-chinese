export type Rating = 'again' | 'hard' | 'good' | 'easy'

export interface Card {
  zh: string
  lesson: number
  ease: number
  /** days */
  interval: number
  /** epoch ms */
  due: number
  reps: number
}

const DAY = 86_400_000

export function newCard(zh: string, lesson: number, now = Date.now()): Card {
  return { zh, lesson, ease: 2.5, interval: 0, due: now, reps: 0 }
}

/** SM-2, trimmed to the four ratings the review screen exposes. */
export function schedule(card: Card, rating: Rating, now = Date.now()): Card {
  let { ease, interval } = card
  switch (rating) {
    case 'again':
      ease = Math.max(1.3, ease - 0.2)
      interval = 0
      break
    case 'hard':
      ease = Math.max(1.3, ease - 0.15)
      interval = interval === 0 ? 1 : Math.max(1, interval * 1.2)
      break
    case 'good':
      interval = interval === 0 ? 1 : interval * ease
      break
    case 'easy':
      ease = ease + 0.15
      interval = interval === 0 ? 3 : interval * ease * 1.3
      break
  }
  return {
    ...card,
    ease,
    interval,
    reps: rating === 'again' ? 0 : card.reps + 1,
    // "again" comes back inside the same session rather than tomorrow
    due: rating === 'again' ? now + 60_000 : now + interval * DAY,
  }
}

export function dueCards(cards: Card[], now = Date.now()): Card[] {
  return cards
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due || a.lesson - b.lesson)
}
