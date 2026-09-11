import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { newCard, schedule, type Card, type Rating } from '../lib/srs'
import { setSpeechEnabled } from '../lib/speech'
import { saveProgress } from '../lib/sync'

const KEY = 'yulu.hsk4a.v1'

/** localStorage cache is namespaced per account so switching users can't mix data. */
function storageKey(userId?: string): string {
  return userId ? `${KEY}.${userId}` : KEY
}

/** Merge a partial persisted blob (from storage or the server) onto the defaults. */
export function normalize(parsed: Partial<Persisted> | null | undefined): Persisted {
  if (!parsed) return empty
  return { ...empty, ...parsed, prefs: { ...empty.prefs, ...parsed.prefs } }
}

export interface Prefs {
  showPinyin: boolean
  showEnglish: boolean
  soundOn: boolean
}

export interface DayLog {
  lessons: number
  cards: number
}

export interface Persisted {
  lessonsDone: number[]
  xp: number
  /** dayKey → what was practised that day; keys double as the streak record */
  log: Record<string, DayLog>
  cards: Record<string, Card>
  /** words saved for rapid drilling, most recently starred first */
  starred: string[]
  /** where an interrupted lesson left off, so it can be resumed */
  inProgress: { lesson: number; step: number } | null
  /** last bottom-tab, restored on reload */
  lastTab: string
  prefs: Prefs
}

/** Cards (reviewed or newly met) that count as a finished day. */
export const DAILY_GOAL = 12

const empty: Persisted = {
  lessonsDone: [],
  xp: 0,
  log: {},
  cards: {},
  starred: [],
  inProgress: null,
  lastTab: 'home',
  prefs: { showPinyin: true, showEnglish: true, soundOn: true },
}

export function dayKey(d: Date | number = Date.now()): string {
  const date = typeof d === 'number' ? new Date(d) : d
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${m}-${day}`
}

export function load(userId?: string): Persisted {
  try {
    const stored = localStorage.getItem(storageKey(userId))
    return normalize(stored ? (JSON.parse(stored) as Partial<Persisted>) : null)
  } catch {
    return empty
  }
}

function bump(
  log: Record<string, DayLog>,
  delta: Partial<DayLog>,
): Record<string, DayLog> {
  const key = dayKey()
  const prev = log[key] ?? { lessons: 0, cards: 0 }
  return {
    ...log,
    [key]: {
      lessons: prev.lessons + (delta.lessons ?? 0),
      cards: prev.cards + (delta.cards ?? 0),
    },
  }
}

/** Consecutive practised days counting back from today (or yesterday). */
function streakOf(days: string[]): number {
  const set = new Set(days)
  const cursor = new Date()
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (set.has(dayKey(cursor))) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

interface Store extends Persisted {
  streak: number
  wordsLearned: number
  cardList: Card[]
  today: DayLog
  practiceDays: string[]
  isStarred: (zh: string) => boolean
  toggleStar: (zh: string, lesson: number) => void
  /** credit a rapid-drill session toward the day's goal + streak (no SRS change) */
  logDrill: (reps: number, xp: number) => void
  restoreCard: (zh: string, card: Card) => void
  practiceLog: () => void
  undoLog: () => void
  setLessonProgress: (lesson: number, step: number) => void
  clearLessonProgress: () => void
  setLastTab: (tab: string) => void
  finishLesson: (lesson: number, words: { zh: string }[], xp: number) => void
  rate: (zh: string, rating: Rating) => void
  addCards: (lesson: number, words: { zh: string }[]) => void
  awardXp: (n: number) => void
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({
  children,
  userId,
  initial,
}: {
  children: ReactNode
  /** when signed in, namespaces the cache and enables cloud sync */
  userId?: string
  /** server-provided starting state (overrides the local cache on login) */
  initial?: Persisted
}) {
  const [state, setState] = useState<Persisted>(() => initial ?? load(userId))
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fast local cache (offline + instant reload), namespaced per account.
  useEffect(() => {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  }, [state, userId])

  // Debounced cloud sync so a burst of changes is one write.
  useEffect(() => {
    if (!userId) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => saveProgress(userId, state), 900)
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [state, userId])

  useEffect(() => {
    setSpeechEnabled(state.prefs.soundOn)
  }, [state.prefs.soundOn])

  const addCards = useCallback((lesson: number, words: { zh: string }[]) => {
    setState((s) => {
      const cards = { ...s.cards }
      let added = 0
      for (const w of words) {
        if (!cards[w.zh]) {
          cards[w.zh] = newCard(w.zh, lesson)
          added++
        }
      }
      if (!added) return s
      return { ...s, cards, log: bump(s.log, { cards: added }) }
    })
  }, [])

  const finishLesson = useCallback(
    (lesson: number, words: { zh: string }[], xp: number) => {
      setState((s) => {
        const cards = { ...s.cards }
        let added = 0
        for (const w of words) {
          if (!cards[w.zh]) {
            cards[w.zh] = newCard(w.zh, lesson)
            added++
          }
        }
        return {
          ...s,
          cards,
          xp: s.xp + xp,
          log: bump(s.log, { lessons: 1, cards: added }),
          inProgress: s.inProgress?.lesson === lesson ? null : s.inProgress,
          lessonsDone: s.lessonsDone.includes(lesson)
            ? s.lessonsDone
            : [...s.lessonsDone, lesson].sort((a, b) => a - b),
        }
      })
    },
    [],
  )

  const rate = useCallback((zh: string, rating: Rating) => {
    setState((s) => {
      const card = s.cards[zh]
      if (!card) return s
      return {
        ...s,
        cards: { ...s.cards, [zh]: schedule(card, rating) },
        log: bump(s.log, { cards: 1 }),
      }
    })
  }, [])

  /** Put a card's schedule back exactly as it was (for a review Undo). */
  const restoreCard = useCallback((zh: string, card: Card) => {
    setState((s) => ({ ...s, cards: { ...s.cards, [zh]: card } }))
  }, [])

  /** Credit a rep toward the day without touching any SRS schedule. */
  const practiceLog = useCallback(() => {
    setState((s) => ({ ...s, log: bump(s.log, { cards: 1 }) }))
  }, [])

  /** Reverse one day-credit (for an undone review), never below zero. */
  const undoLog = useCallback(() => {
    setState((s) => {
      const key = dayKey()
      const day = s.log[key]
      if (!day || day.cards <= 0) return s
      return { ...s, log: { ...s.log, [key]: { ...day, cards: day.cards - 1 } } }
    })
  }, [])

  const awardXp = useCallback((n: number) => setState((s) => ({ ...s, xp: s.xp + n })), [])

  const logDrill = useCallback((reps: number, xp: number) => {
    setState((s) => ({ ...s, xp: s.xp + xp, log: bump(s.log, { cards: reps }) }))
  }, [])

  const setLessonProgress = useCallback((lesson: number, step: number) => {
    setState((s) => ({ ...s, inProgress: { lesson, step } }))
  }, [])

  const clearLessonProgress = useCallback(() => {
    setState((s) => (s.inProgress ? { ...s, inProgress: null } : s))
  }, [])

  const setLastTab = useCallback((tab: string) => {
    setState((s) => (s.lastTab === tab ? s : { ...s, lastTab: tab }))
  }, [])

  /**
   * Starring is also the cheapest way a word enters the SRS deck — a learner who
   * saves a word mid-lesson should not have to finish the lesson to drill it.
   */
  const toggleStar = useCallback((zh: string, lesson: number) => {
    setState((s) => {
      const on = s.starred.includes(zh)
      return {
        ...s,
        starred: on ? s.starred.filter((w) => w !== zh) : [zh, ...s.starred],
        cards: on || s.cards[zh] ? s.cards : { ...s.cards, [zh]: newCard(zh, lesson) },
      }
    })
  }, [])

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setState((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }))
  }, [])

  const reset = useCallback(() => setState(empty), [])

  const value = useMemo<Store>(() => {
    const cardList = Object.values(state.cards)
    const practiceDays = Object.keys(state.log)
    return {
      ...state,
      cardList,
      practiceDays,
      today: state.log[dayKey()] ?? { lessons: 0, cards: 0 },
      wordsLearned: cardList.length,
      streak: streakOf(practiceDays),
      isStarred: (zh: string) => state.starred.includes(zh),
      toggleStar,
      logDrill,
      restoreCard,
      practiceLog,
      undoLog,
      setLessonProgress,
      clearLessonProgress,
      setLastTab,
      finishLesson,
      rate,
      addCards,
      awardXp,
      setPref,
      reset,
    }
  }, [
    state,
    finishLesson,
    rate,
    addCards,
    awardXp,
    setPref,
    reset,
    toggleStar,
    logDrill,
    restoreCard,
    practiceLog,
    undoLog,
    setLessonProgress,
    clearLessonProgress,
    setLastTab,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
