import { t } from './i18n.ts'

/** Evidence of retrieval, kept separate from exposure, favourites and SRS dates. */
export type MasteryState = 'new' | 'learning' | 'hard' | 'mastered'
export type RecallMode = 'recognition' | 'recall' | 'speaking' | 'writing'

export interface RecallInput {
  correct: boolean
  assisted?: boolean
  mode: RecallMode
}

export interface MasteryRecord {
  zh: string
  lesson: number
  state: MasteryState
  /** Distinct days encountered; reopening a card is not another learning rep. */
  encounters: number
  attempts: number
  successes: number
  /** Attempts involving a hint, an answer reveal or other assistance. */
  hints: number
  /** Unaided production successes since the last miss or assisted attempt. */
  unaidedSuccesses: number
  successDays: string[]
  lastSeen: number
  lastPractice: number | null
  modes: Record<RecallMode, { attempts: number; successes: number }>
}

const MODES: RecallMode[] = ['recognition', 'recall', 'speaking', 'writing']

function practiceDay(now: number): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
}

function emptyModes(): MasteryRecord['modes'] {
  return {
    recognition: { attempts: 0, successes: 0 },
    recall: { attempts: 0, successes: 0 },
    speaking: { attempts: 0, successes: 0 },
    writing: { attempts: 0, successes: 0 },
  }
}

export function newMastery(zh: string, lesson = 0, now = Date.now()): MasteryRecord {
  return {
    zh, lesson, state: 'new', encounters: 1, attempts: 0, successes: 0,
    hints: 0, unaidedSuccesses: 0, successDays: [], lastSeen: now,
    lastPractice: null, modes: emptyModes(),
  }
}

/** Calling this repeatedly on the same day updates recency, never retrieval evidence. */
export function encounter(record: MasteryRecord | undefined, zh: string, lesson = 0, now = Date.now()): MasteryRecord {
  if (!record) return newMastery(zh, lesson, now)
  return {
    ...record,
    lesson: record.lesson || lesson,
    encounters: record.encounters + (practiceDay(record.lastSeen) === practiceDay(now) ? 0 : 1),
    lastSeen: now,
  }
}

/**
 * Recognition can help learning, but never proves production. A miss or hint
 * removes current mastery evidence; it takes retrieval on another day to earn
 * it back. No XP, daily goal or SRS schedule is changed here.
 */
export function recordRetrieval(record: MasteryRecord, input: RecallInput, now = Date.now()): MasteryRecord {
  const assisted = input.assisted === true
  const reliable = input.correct && !assisted
  const production = reliable && input.mode !== 'recognition'
  const unaidedSuccesses = reliable ? record.unaidedSuccesses + (production ? 1 : 0) : 0
  const successDays = reliable
    ? production ? [...new Set([...record.successDays, practiceDay(now)])] : record.successDays
    : []
  const state: MasteryState = !reliable
    ? 'hard'
    : unaidedSuccesses >= 3 && successDays.length >= 2
      ? 'mastered'
      : record.state === 'hard' && !production ? 'hard' : 'learning'
  const mode = record.modes[input.mode]
  return {
    ...record,
    state,
    attempts: record.attempts + 1,
    successes: record.successes + (input.correct ? 1 : 0),
    hints: record.hints + (assisted ? 1 : 0),
    unaidedSuccesses,
    successDays,
    lastSeen: now,
    lastPractice: now,
    modes: {
      ...record.modes,
      [input.mode]: { attempts: mode.attempts + 1, successes: mode.successes + (input.correct ? 1 : 0) },
    },
  }
}

const nonnegative = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** Older decks get an automatic trail, without manufacturing past recall evidence. */
export function normalizeMastery(
  raw: unknown,
  cards: Record<string, { lesson: number }> = {},
  starred: string[] = [],
  now = Date.now(),
): Record<string, MasteryRecord> {
  const records: Record<string, MasteryRecord> = {}
  const cardMap = object(cards) as Record<string, { lesson?: number }>
  const favourites = Array.isArray(starred) ? starred.filter((zh): zh is string => typeof zh === 'string') : []
  for (const [zh, value] of Object.entries(object(raw))) {
    if (!zh.trim()) continue
    const data = object(value)
    const attempts = nonnegative(data.attempts)
    const successes = Math.min(attempts, nonnegative(data.successes))
    const hints = Math.min(attempts, nonnegative(data.hints))
    const unaidedSuccesses = Math.min(successes, nonnegative(data.unaidedSuccesses))
    const successDays = Array.isArray(data.successDays)
      ? [...new Set(data.successDays.filter((day): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)))]
      : []
    const lastSeen = nonnegative(data.lastSeen) || now
    const modes = emptyModes()
    const rawModes = object(data.modes)
    for (const mode of MODES) {
      const detail = object(rawModes[mode])
      modes[mode].attempts = nonnegative(detail.attempts)
      modes[mode].successes = Math.min(modes[mode].attempts, nonnegative(detail.successes))
    }
    // A stale/malformed "mastered" label is never sufficient evidence by itself.
    const state: MasteryState = attempts === 0 ? 'new'
      : data.state === 'hard' ? 'hard'
        : unaidedSuccesses >= 3 && successDays.length >= 2 ? 'mastered' : 'learning'
    records[zh] = {
      zh, lesson: nonnegative(data.lesson) || nonnegative(cardMap[zh]?.lesson),
      state, encounters: Math.max(1, nonnegative(data.encounters)), attempts, successes,
      hints, unaidedSuccesses, successDays, lastSeen,
      lastPractice: attempts ? nonnegative(data.lastPractice) || lastSeen : null,
      modes,
    }
  }
  for (const zh of new Set([...Object.keys(cardMap), ...favourites])) {
    if (zh.trim() && !records[zh]) records[zh] = newMastery(zh, nonnegative(cardMap[zh]?.lesson), now)
  }
  return records
}

export const masteryLabel: Record<MasteryState, string> = {
  new: t('New'), learning: t('Learning'), hard: t('Needs practice'), mastered: t('Mastered'),
}

/** Punctuation and whitespace are harmless; Hanzi themselves must match. */
export function matchesHanzi(actual: string, target: string): boolean {
  const clean = (text: string) => text.normalize('NFKC').replace(/[\s，。！？、,.!?；;：:"“”‘’'()（）]/g, '')
  const answer = clean(actual)
  return answer.length > 0 && answer === clean(target)
}
