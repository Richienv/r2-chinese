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
import { type Card, type Rating, type Skill } from '../lib/srs'
import { setSpeechEnabled } from '../lib/speech'
import { setSfxEnabled } from '../lib/sfx'
import { saveProgress } from '../lib/sync'
import { encounter, normalizeMastery, type MasteryRecord, type RecallInput } from '../lib/mastery'

import {
  initLearning,
  creditProgress,
  enqueueWords,
  eventFor,
  applyEvent,
  undoEvent,
  type LearningState,
  type ReviewEvent,
} from '../lib/learningEngine'
import {
  progressKey,
  readProgress,
  persistProgress,
  mergeProgress,
  exportLearningStorage,
} from '../lib/progressStorage'
import { t } from '../lib/i18n'

/** localStorage cache is namespaced per account so switching users can't mix data. */

export type PathNode = 't1' | 't2' | 't3' | 't4' | 't5' | 'wrap'

const PATH_NODES: readonly PathNode[] = ['t1', 't2', 't3', 't4', 't5', 'wrap']

function isPathNode(v: unknown): v is PathNode {
  return PATH_NODES.includes(v as PathNode)
}

/** Old 4-node path → 课文-units. Lesson-1 Words maps to 课文1 so progress is kept. */
function migrateNode(node: string): PathNode | undefined {
  if (isPathNode(node)) return node
  if (node === 'words') return 't1'
  if (node === 'sentences') return 't2'
  if (node === 'things') return 't3'
  if (node === 'checkpoint' || node === 'test') return 'wrap'
  return undefined
}

/** Coerce a leftover or partial blob onto `{ [lesson]: PathNode[] }`. */
function normalizePathDone(parsed: Partial<Persisted> | null | undefined): Record<string, PathNode[]> {
  const out: Record<string, PathNode[]> = {}
  const raw = parsed?.pathDone
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (!Array.isArray(v)) continue
      const nodes = [
        ...new Set(
          v
            .map((n) => (typeof n === 'string' ? migrateNode(n) : undefined))
            .filter((n): n is PathNode => !!n),
        ),
      ]
      if (nodes.length) out[k] = nodes
    }
  }
  // One-session leftover from an earlier `nodesDone: "1:words"` sketch — do not keep that key.
  const leftover = (parsed as { nodesDone?: unknown } | null | undefined)?.nodesDone
  if (Array.isArray(leftover)) {
    for (const key of leftover) {
      if (typeof key !== 'string') continue
      const [lesson, node] = key.split(':')
      const mapped = node ? migrateNode(node) : undefined
      if (!lesson || !mapped) continue
      const list = out[lesson] ?? []
      if (!list.includes(mapped)) out[lesson] = [...list, mapped]
    }
  }
  return out
}

/** Merge a partial persisted blob (from storage or the server) onto the defaults. */
export function normalize(parsed: Partial<Persisted> | null | undefined): Persisted {
  if (!parsed) return empty
  const result = {
    ...empty,
    ...parsed,
    prefs: { ...empty.prefs, ...parsed.prefs },
    pathDone: normalizePathDone(parsed),
    mastery: normalizeMastery(parsed.mastery, parsed.cards, parsed.starred),
  }
  return { ...result, learning: initLearning(result) }
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
  resetAt?: number
  starChanges?: Record<string, { at: number; on: boolean }>
  updatedAt?: number
  learning?: LearningState
  lessonsDone: number[]
  xp: number
  /** dayKey → what was practised that day; keys double as the streak record */
  log: Record<string, DayLog>
  cards: Record<string, Card>
  /** words saved for rapid drilling, most recently starred first */
  starred: string[]
  /** Automatically kept retrieval evidence; independent of deliberate favourites. */
  mastery: Record<string, MasteryRecord>
  /** where an interrupted lesson left off, so it can be resumed */
  inProgress: { lesson: number; step: number } | null
  /** last bottom-tab, restored on reload */
  lastTab: string
  /**
   * Path nodes finished per lesson. Key is String(lesson), e.g. { "1": ["t1"] }.
   * Additive — older saves without this key normalize to {}. Never finishLesson.
   */
  pathDone: Record<string, PathNode[]>
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
  mastery: {},
  inProgress: null,
  lastTab: 'home',
  pathDone: {},
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
    const key = progressKey(userId)
    return normalize(readProgress(localStorage, key) as Partial<Persisted> | undefined)
  } catch {
    return empty
  }
}

function bump(log: Record<string, DayLog>, delta: Partial<DayLog>): Record<string, DayLog> {
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
  storageProblem: boolean
  syncStatus: string
  exportProgress: () => void
  reviewWord: (
    zh: string,
    rating: Rating,
    options?: {
      skill?: Skill
      evidence?: ReviewEvent['evidence']
      assisted?: boolean
      eventId?: string
      at?: number
      delayDays?: number
    },
  ) => string | null
  undoReview: (id: string) => boolean
  /** Every encountered word, most recently seen first. */
  learningTrail: string[]
  encounterWord: (zh: string, lesson: number) => void
  recordRecall: (zh: string, input: RecallInput) => void
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
  isNodeDone: (lesson: number, node: PathNode) => boolean
  /** persist a path node; does not call finishLesson */
  markNodeDone: (lesson: number, node: PathNode) => void
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
  const [state, setReactState] = useState<Persisted>(() => (initial ? normalize(initial) : load(userId)))
  const latest = useRef(state)
  const [storageProblem, setStorageProblem] = useState(false)
  const [syncStatus, setSyncStatus] = useState(userId ? 'pending' : 'local')
  const key = progressKey(userId)
  const setState = useCallback(
    (update: (s: Persisted) => Persisted): boolean => {
      const next = update(latest.current)
      if (next === latest.current) return true
      const saved = { ...next, updatedAt: Date.now() }
      try {
        persistProgress(localStorage, key, saved)
      } catch {
        setStorageProblem(true)
        return false
      }
      latest.current = saved
      setReactState(saved)
      setStorageProblem(false)
      return true
    },
    [key],
  )
  const exportProgress = useCallback(() => {
    const file = new Blob([exportLearningStorage(localStorage, key)], { type: 'application/json' })
    const url = URL.createObjectURL(file),
      anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'yulu-progress-backup.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [key])
  // Import is non-destructive: account caches and pre-migration snapshots stay separate.
  useEffect(() => {
    try {
      persistProgress(localStorage, key, latest.current)
    } catch {
      setStorageProblem(true)
    }
  }, [key])
  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return
      try {
        const remote = normalize(JSON.parse(event.newValue))
        const merged = mergeProgress(latest.current, remote)
        if (JSON.stringify(merged) !== JSON.stringify(latest.current)) setState(() => merged)
      } catch {
        /* Preserve the valid in-memory state when a different tab has bad data. */
      }
    }
    window.addEventListener('storage', receive)
    return () => window.removeEventListener('storage', receive)
  }, [key, setState])
  useEffect(() => {
    if (!userId) return
    let cancelled = false,
      running = false
    const flush = async () => {
      if (cancelled || running) return
      running = true
      setSyncStatus('pending')
      try {
        const sent = latest.current
        const merged = await saveProgress(userId, sent, (a, b) => mergeProgress(normalize(a), normalize(b)))
        if (!cancelled) {
          if (merged) {
            const combined = mergeProgress(latest.current, merged)
            if (JSON.stringify(combined) !== JSON.stringify(latest.current)) setState(() => combined)
          }
          setSyncStatus('saved')
        }
      } catch {
        if (!cancelled) setSyncStatus('offline')
      } finally {
        running = false
      }
    }
    const timer = setTimeout(flush, 900),
      retry = setInterval(flush, 30000)
    window.addEventListener('online', flush)
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearInterval(retry)
      window.removeEventListener('online', flush)
    }
  }, [userId, state, setState])

  setSpeechEnabled(state.prefs.soundOn)
  setSfxEnabled(state.prefs.soundOn)

  const addCards = useCallback(
    (lesson: number, words: { zh: string }[]) => {
      setState((s) => enqueueWords(s, lesson, words))
    },
    [setState],
  )

  const encounterWord = useCallback((zh: string, lesson: number) => {
    if (!zh.trim()) return
    setState((s) => {
      return {
        ...s,
        mastery: { ...s.mastery, [zh]: encounter(s.mastery[zh], zh, lesson) },
      }
    })
  }, [])

  const recordRecall = useCallback(
    (zh: string, input: RecallInput) => {
      if (!zh.trim()) return
      const event = eventFor(
        zh,
        latest.current.cards[zh]?.lesson ?? latest.current.mastery[zh]?.lesson ?? 0,
        input,
      )
      setState((s) => applyEvent(s, event))
    },
    [setState],
  )

  const finishLesson = useCallback((lesson: number, words: { zh: string }[], xp: number) => {
    setState((s) => {
      const next = creditProgress(enqueueWords(s, lesson, words), {
        id: crypto.randomUUID(),
        at: Date.now(),
        day: dayKey(),
        xp,
        cards: 0,
        lessons: 1,
        source: 'lesson',
      })
      return {
        ...next,

        inProgress: s.inProgress?.lesson === lesson ? null : s.inProgress,
        lessonsDone: s.lessonsDone.includes(lesson)
          ? s.lessonsDone
          : [...s.lessonsDone, lesson].sort((a, b) => a - b),
      }
    })
  }, [])

  const reviewWord = useCallback(
    (
      zh: string,
      rating: Rating,
      options: {
        skill?: Skill
        evidence?: ReviewEvent['evidence']
        assisted?: boolean
        eventId?: string
        at?: number
        delayDays?: number
      } = {},
    ) => {
      const card = latest.current.cards[zh]
      const event: ReviewEvent = {
        id: options.eventId ?? crypto.randomUUID(),
        zh,
        lesson: card?.lesson ?? latest.current.mastery[zh]?.lesson ?? 0,
        skill: options.skill ?? card?.skill ?? 'recall',
        at: options.at ?? Date.now(),
        day: dayKey(options.at ?? Date.now()),
        rating,
        evidence: options.evidence ?? 'self-report',
        assisted: !!options.assisted,
        source: 'review',
        scheduler: 'fsrs-6/ts-fsrs@5.2.3/yulu-2',
        xp: rating === 'again' ? 0 : 4,
        ...(options.delayDays !== undefined ? { delayDays: options.delayDays } : {}),
      }
      const saved = setState((s) => {
        if (s.learning?.events[event.id]) return s
        const next = applyEvent(s, event)
        return { ...next, xp: s.xp + event.xp, log: bump(s.log, { cards: 1 }) }
      })
      return saved ? event.id : null
    },
    [setState],
  )
  const undoReview = useCallback(
    (id: string) => {
      return setState((s) => {
        const event = s.learning?.events[id]
        if (!event || s.learning?.undone[id]) return s
        const next = undoEvent(s, id),
          day = event.day ?? dayKey(event.at),
          prior = s.log[day]
        return {
          ...next,
          xp: Math.max(0, s.xp - event.xp),
          log: prior ? { ...s.log, [day]: { ...prior, cards: Math.max(0, prior.cards - 1) } } : s.log,
        }
      })
    },
    [setState],
  )
  const rate = useCallback(
    (zh: string, rating: Rating) => {
      reviewWord(zh, rating)
    },
    [reviewWord],
  )

  /** Put a card's schedule back exactly as it was (for a review Undo). */
  const restoreCard = useCallback((zh: string, card: Card) => {
    setState((s) => ({ ...s, cards: { ...s.cards, [zh]: card } }))
  }, [])

  /** Credit a rep toward the day without touching any SRS schedule. */
  const practiceLog = useCallback(() => {
    setState((s) =>
      creditProgress(s, {
        id: crypto.randomUUID(),
        at: Date.now(),
        day: dayKey(),
        xp: 0,
        cards: 1,
        lessons: 0,
        source: 'practice',
      }),
    )
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

  const awardXp = useCallback(
    (n: number) =>
      setState((s) =>
        creditProgress(s, {
          id: crypto.randomUUID(),
          at: Date.now(),
          day: dayKey(),
          xp: n,
          cards: 0,
          lessons: 0,
          source: 'lesson-step',
        }),
      ),
    [setState],
  )

  const isNodeDone = useCallback(
    (lesson: number, node: PathNode) => (state.pathDone[String(lesson)] ?? []).includes(node),
    [state.pathDone],
  )

  const markNodeDone = useCallback((lesson: number, node: PathNode) => {
    const key = String(lesson)
    setState((s) => {
      const prev = s.pathDone[key] ?? []
      if (prev.includes(node)) return s
      return { ...s, pathDone: { ...s.pathDone, [key]: [...prev, node] } }
    })
  }, [])

  const logDrill = useCallback((reps: number, xp: number) => {
    setState((s) =>
      creditProgress(s, {
        id: crypto.randomUUID(),
        at: Date.now(),
        day: dayKey(),
        xp,
        cards: reps,
        lessons: 0,
        source: 'drill',
      }),
    )
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
        starChanges: { ...s.starChanges, [zh]: { at: Date.now(), on: !on } },
        starred: on ? s.starred.filter((w) => w !== zh) : [zh, ...s.starred],

        mastery: s.mastery[zh] ? s.mastery : { ...s.mastery, [zh]: encounter(undefined, zh, lesson) },
      }
    })
  }, [])

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setState((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }))
  }, [])

  const reset = useCallback(() => {
    try {
      localStorage.setItem(key + '.before-reset.' + Date.now(), JSON.stringify(latest.current))
    } catch {
      setStorageProblem(true)
      return
    }
    setState(() => ({ ...empty, resetAt: Date.now(), learning: initLearning(empty) }))
  }, [key, setState])

  const value = useMemo<Store>(() => {
    const cardList = Object.values(state.cards)
    const practiceDays = Object.keys(state.log)
    return {
      ...state,
      storageProblem,
      syncStatus,
      exportProgress,
      reviewWord,
      undoReview,
      learningTrail: Object.values(state.mastery)
        .sort((a, b) => b.lastSeen - a.lastSeen || a.zh.localeCompare(b.zh))
        .map((word) => word.zh),
      encounterWord,
      recordRecall,
      cardList,
      practiceDays,
      today: state.log[dayKey()] ?? { lessons: 0, cards: 0 },
      wordsLearned: Object.values(state.mastery).filter((m) => m.unaidedSuccesses > 0).length,
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
      isNodeDone,
      markNodeDone,
      setPref,
      reset,
    }
  }, [
    state,
    storageProblem,
    syncStatus,
    exportProgress,
    reviewWord,
    undoReview,
    finishLesson,
    rate,
    addCards,
    encounterWord,
    recordRecall,
    awardXp,
    isNodeDone,
    markNodeDone,
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

  return (
    <Ctx.Provider value={value}>
      {children}
      {storageProblem && (
        <div
          className="storage-blocker"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('Progress could not be saved')}
        >
          <div>
            <h2>{t('Progress could not be saved')}</h2>
            <p>{t('Your previous progress is safe. Free some storage before continuing.')}</p>
            <button onClick={exportProgress}>{t('Export progress backup')}</button>
            <button
              onClick={() => {
                try {
                  persistProgress(localStorage, key, latest.current)
                  setStorageProblem(false)
                } catch {}
              }}
            >
              {t('Try saving again')}
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
