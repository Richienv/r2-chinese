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
  createEmptyGraph,
  getLearnerGraphSnapshot,
  mergeLearnerGraphs,
  normalizeLearnerGraph,
  recordExamOutcome,
  recordRecallOutcome,
  recordSkippedLessons,
  replaceLearnerGraph,
  subscribeLearnerGraph,
  unskipLessonInGraph,
  type CourseKey,
  type ExamOutcomeInput,
  type LearnerGraphState,
} from '../lib/learnerGraph'
import {
  clearAllLearningStorage,
  progressKey,
  readProgress,
  persistProgress,
  mergeProgress,
  exportLearningStorage,
  importLearningStorage,
} from '../lib/progressStorage'
import {
  CLOUD_HYDRATED_EVENT,
  forcePushCloudReset,
  LOCAL_PROGRESS_EVENT,
  pushToCloudIfChanged,
  syncWithCloud,
} from '../lib/autoSync'
import { resetBeastPrefs } from '../lib/beastPrefs'
import { isCoreBookVocab } from '../lib/content'
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

function graphCourseOf(lessonOffset: number): { course: CourseKey; unit: number } {
  if (lessonOffset >= 3000) return { course: 'jiaocheng', unit: lessonOffset - 3000 }
  if (lessonOffset >= 1000) return { course: 'kerja', unit: lessonOffset - 1000 }
  return { course: 'hsk4a', unit: lessonOffset }
}

/** Merge a partial persisted blob (from storage or the server) onto the defaults. */
export function normalize(parsed: Partial<Persisted> | null | undefined): Persisted {
  if (!parsed) return empty
  const result = {
    ...empty,
    ...parsed,
    prefs: { ...empty.prefs, ...parsed.prefs },
    pathDone: normalizePathDone(parsed),
    skippedLessons: Array.isArray(parsed.skippedLessons)
      ? [...new Set(parsed.skippedLessons.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))]
      : [],
    unlockedLesson:
      typeof parsed.unlockedLesson === 'number' && Number.isFinite(parsed.unlockedLesson) && parsed.unlockedLesson >= 1
        ? parsed.unlockedLesson
        : 1,
    learnerGraph: normalizeLearnerGraph(parsed.learnerGraph),
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
  /** HSK lessons skipped via Skip-Level (never faked as completed; words carry over to Active Recall). */
  skippedLessons: number[]
  /** Highest HSK lesson explicitly jumped to via Skip-Level. */
  unlockedLesson: number
  /** Real-time learner knowledge, confusion, grammar, and skip-carryover graph. */
  learnerGraph: LearnerGraphState
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
  skippedLessons: [],
  unlockedLesson: 1,
  learnerGraph: createEmptyGraph(0),
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
  syncNow: () => Promise<'saved' | 'offline' | 'local'>
  exportProgress: () => void
  importProgress: (
    rawJson: string,
  ) => { ok: true; restoredKeys: number; xp: number; words: number } | { ok: false; error: string }
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
  /** Skip earlier HSK lessons into Active Recall without marking words comfortable or mastered. */
  skipToHskLesson: (
    targetLesson: number,
    skippedSpecs: Array<{ lesson: number; title: string; words: { zh: string }[]; grammarPoints: string[] }>,
  ) => void
  unskipHskLesson: (lesson: number) => void
  /** Enqueue skipped words from Jiaocheng / Kerja into SRS + Learner Graph without fake mastery. */
  enqueueSkippedWords: (
    lessonOffset: number,
    skippedSpecs: Array<{ course: CourseKey; lesson: number; title?: string; words: { zh: string }[]; grammarPoints?: string[] }>,
  ) => void
  unskipCourseLessonInGraph: (course: CourseKey, lesson: number) => void
  recordNearSynonymConfusion: (targetZh: string, typedZh: string, lesson?: number, course?: CourseKey) => void
  recordExamAttemptInGraph: (input: ExamOutcomeInput) => void
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
  const [state, setReactState] = useState<Persisted>(() => {
    if (initial) return normalize(initial)
    const loaded = load(userId)
    const storedGraph = getLearnerGraphSnapshot()
    if (Object.keys(storedGraph.nodes).length || Object.keys(storedGraph.edges).length) {
      return { ...loaded, learnerGraph: mergeLearnerGraphs(loaded.learnerGraph, storedGraph) }
    }
    return loaded
  })
  const latest = useRef(state)
  const [storageProblem, setStorageProblem] = useState(false)
  const [syncStatus, setSyncStatus] = useState(userId ? 'pending' : 'pending')
  const initialPullDoneRef = useRef(false)
  const cloudSyncRunningRef = useRef(false)
  const dirtySincePullRef = useRef(false)
  const key = progressKey(userId)
  const applyCloudHydration = useCallback(() => {
    const next = load(userId)
    const storedGraph = getLearnerGraphSnapshot()
    const hydrated =
      !initial &&
      (Object.keys(storedGraph.nodes).length || Object.keys(storedGraph.edges).length)
        ? { ...next, learnerGraph: mergeLearnerGraphs(next.learnerGraph, storedGraph) }
        : next
    latest.current = hydrated
    setReactState(hydrated)
    if (!initial) replaceLearnerGraph(hydrated.learnerGraph)
    setStorageProblem(false)
  }, [userId, initial])

  const setState = useCallback(
    (update: (s: Persisted) => Persisted): boolean => {
      const next = update(latest.current)
      if (next === latest.current) return true
      const prevGraph = latest.current.learnerGraph
      const saved = { ...next, updatedAt: Date.now() }
      try {
        persistProgress(localStorage, key, saved)
      } catch {
        setStorageProblem(true)
        return false
      }
      latest.current = saved
      if (!initial && saved.learnerGraph !== prevGraph) {
        replaceLearnerGraph(saved.learnerGraph)
      }
      setReactState(saved)
      setStorageProblem(false)
      if (initialPullDoneRef.current) dirtySincePullRef.current = true
      return true
    },
    [key, initial],
  )
  // Keep standalone localStorage learnerGraph mirror aligned when running in browser mode.
  useEffect(() => {
    if (initial) return
    replaceLearnerGraph(latest.current.learnerGraph)
  }, [initial])
  useEffect(() => {
    if (initial) return
    return subscribeLearnerGraph(() => {
      const snap = getLearnerGraphSnapshot()
      if (snap.updatedAt > (latest.current.learnerGraph?.updatedAt ?? 0)) {
        setState((s) => ({ ...s, learnerGraph: mergeLearnerGraphs(s.learnerGraph, snap) }))
      }
    })
  }, [initial, setState])
  const exportProgress = useCallback(() => {
    const file = new Blob([exportLearningStorage(localStorage, key)], { type: 'application/json' })
    const url = URL.createObjectURL(file),
      anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'yulu-progress-backup.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [key])
  const importProgress = useCallback(
    (rawJson: string) => {
      const res = importLearningStorage(localStorage, key, rawJson)
      if (!res.ok) return res
      const next = load(userId)
      setState(() => next)
      if (!initial) replaceLearnerGraph(next.learnerGraph)
      return {
        ok: true as const,
        restoredKeys: res.restoredKeys,
        xp: next.xp,
        words: Object.keys(next.cards).length,
      }
    },
    [key, userId, setState, initial],
  )
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
  const syncNow = useCallback(async (): Promise<'saved' | 'offline' | 'local'> => {
    if (userId) {
      setSyncStatus('pending')
      try {
        const merged = await saveProgress(userId, latest.current, (a, b) =>
          mergeProgress(normalize(a), normalize(b)),
        )
        if (merged) {
          const combined = mergeProgress(latest.current, merged)
          if (JSON.stringify(combined) !== JSON.stringify(latest.current)) setState(() => combined)
        }
        setSyncStatus('saved')
        return 'saved'
      } catch {
        setSyncStatus('offline')
        return 'offline'
      }
    }
    if (initial || typeof window === 'undefined') return 'local'
    setSyncStatus('pending')
    const res = await syncWithCloud({
      storage: localStorage,
      key,
      onHydrated: applyCloudHydration,
    })
    initialPullDoneRef.current = true
    setSyncStatus(res.status)
    return res.status === 'pending' ? 'offline' : res.status
  }, [userId, initial, key, applyCloudHydration, setState])

  // Bidirectional automatic cloud sync when Supabase auth is inactive (default on yulu.trolive.id).
  useEffect(() => {
    if (userId || initial || typeof window === 'undefined') return
    let cancelled = false
    let pushTimer: ReturnType<typeof setTimeout> | undefined

    const runPull = async () => {
      if (cancelled || cloudSyncRunningRef.current) return
      cloudSyncRunningRef.current = true
      try {
        const res = await syncWithCloud({
          storage: localStorage,
          key,
          onHydrated: applyCloudHydration,
        })
        initialPullDoneRef.current = true
        dirtySincePullRef.current = false
        if (!cancelled) setSyncStatus(res.status)
      } catch {
        initialPullDoneRef.current = true
        if (!cancelled) setSyncStatus('offline')
      } finally {
        cloudSyncRunningRef.current = false
      }
    }

    const runPush = async (keepalive = false) => {
      if (cancelled || !initialPullDoneRef.current) return
      if (cloudSyncRunningRef.current && !keepalive) return
      if (!keepalive) cloudSyncRunningRef.current = true
      try {
        const res = await pushToCloudIfChanged({
          storage: localStorage,
          key,
          onHydrated: applyCloudHydration,
          keepalive,
        })
        dirtySincePullRef.current = false
        if (!cancelled) setSyncStatus(res.status)
      } catch {
        if (!cancelled) setSyncStatus('offline')
      } finally {
        if (!keepalive) cloudSyncRunningRef.current = false
      }
    }

    const schedulePush = () => {
      if (cancelled || !initialPullDoneRef.current) return
      clearTimeout(pushTimer)
      pushTimer = setTimeout(() => {
        void runPush(false)
      }, 1800)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(pushTimer)
        void runPush(true)
      } else if (document.visibilityState === 'visible') {
        void runPull()
      }
    }

    const onPageHide = () => {
      clearTimeout(pushTimer)
      void runPush(true)
    }

    const onOnline = () => {
      void runPull()
    }

    const onLocalProgress = () => {
      dirtySincePullRef.current = true
      schedulePush()
    }

    const onCloudHydrated = () => {
      applyCloudHydration()
    }

    void runPull()
    const periodic = setInterval(() => {
      if (document.visibilityState === 'visible') void runPush(false)
    }, 30_000)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('online', onOnline)
    window.addEventListener(LOCAL_PROGRESS_EVENT, onLocalProgress)
    window.addEventListener(CLOUD_HYDRATED_EVENT, onCloudHydrated)

    return () => {
      cancelled = true
      clearTimeout(pushTimer)
      clearInterval(periodic)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('online', onOnline)
      window.removeEventListener(LOCAL_PROGRESS_EVENT, onLocalProgress)
      window.removeEventListener(CLOUD_HYDRATED_EVENT, onCloudHydrated)
    }
  }, [userId, initial, key, applyCloudHydration])

  useEffect(() => {
    if (userId || initial || typeof window === 'undefined') return
    if (!initialPullDoneRef.current || !dirtySincePullRef.current) return
    const timer = setTimeout(() => {
      void pushToCloudIfChanged({
        storage: localStorage,
        key,
        onHydrated: applyCloudHydration,
      }).then((res) => setSyncStatus(res.status))
    }, 1800)
    return () => clearTimeout(timer)
  }, [userId, initial, key, state, applyCloudHydration])

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
      const core = words.filter((w) => isCoreBookVocab(w.zh))
      if (!core.length) return
      setState((s) => enqueueWords(s, lesson, core))
    },
    [setState],
  )

  const encounterWord = useCallback((zh: string, lesson: number) => {
    if (!zh.trim() || !isCoreBookVocab(zh)) return
    setState((s) => {
      return {
        ...s,
        mastery: { ...s.mastery, [zh]: encounter(s.mastery[zh], zh, lesson) },
      }
    })
  }, [])

  const recordRecall = useCallback(
    (zh: string, input: RecallInput) => {
      if (!zh.trim() || !isCoreBookVocab(zh)) return
      const lessonOffset = latest.current.cards[zh]?.lesson ?? latest.current.mastery[zh]?.lesson ?? 0
      const event = eventFor(zh, lessonOffset, input)
      const { course, unit } = graphCourseOf(lessonOffset)
      setState((s) => {
        const applied = applyEvent(s, event)
        return {
          ...applied,
          learnerGraph: recordRecallOutcome(applied.learnerGraph, {
            zh,
            correct: input.correct,
            assisted: !!input.assisted,
            mode: input.mode,
            course,
            lesson: unit || undefined,
            at: event.at,
          }),
        }
      })
    },
    [setState],
  )

  const finishLesson = useCallback((lesson: number, words: { zh: string }[], xp: number) => {
    const core = words.filter((w) => isCoreBookVocab(w.zh))
    setState((s) => {
      const next = creditProgress(enqueueWords(s, lesson, core), {
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
        skippedLessons: s.skippedLessons.filter((n) => n !== lesson),
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
        const { course, unit } = graphCourseOf(event.lesson)
        const learnerGraph = recordRecallOutcome(next.learnerGraph, {
          zh,
          correct: rating !== 'again',
          assisted: !!options.assisted,
          mode: event.skill,
          course,
          lesson: unit || undefined,
          at: event.at,
        })
        return { ...next, learnerGraph, xp: s.xp + event.xp, log: bump(s.log, { cards: 1 }) }
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
      const nextNodes = [...prev, node]
      const allDone = PATH_NODES.every((n) => nextNodes.includes(n))
      return {
        ...s,
        pathDone: { ...s.pathDone, [key]: nextNodes },
        skippedLessons: allDone ? s.skippedLessons.filter((n) => n !== lesson) : s.skippedLessons,
      }
    })
  }, [])

  const skipToHskLesson = useCallback(
    (
      targetLesson: number,
      skippedSpecs: Array<{ lesson: number; title: string; words: { zh: string }[]; grammarPoints: string[] }>,
    ) => {
      if (targetLesson <= 1) return
      const now = Date.now()
      setState((s) => {
        let next = s
        const newlySkipped: number[] = []
        const graphSpecs: Array<{ lesson: number; title: string; words: string[]; grammarPoints: string[] }> = []
        for (const spec of skippedSpecs) {
          if (spec.lesson >= targetLesson) continue
          const nodes = next.pathDone[String(spec.lesson)] ?? []
          const alreadyDone =
            next.lessonsDone.includes(spec.lesson) || PATH_NODES.every((n) => nodes.includes(n))
          if (alreadyDone) continue
          newlySkipped.push(spec.lesson)
          const coreWords = spec.words.filter((w) => isCoreBookVocab(w.zh))
          next = enqueueWords(next, spec.lesson, coreWords, now)
          graphSpecs.push({
            lesson: spec.lesson,
            title: spec.title,
            words: coreWords.map((w) => w.zh),
            grammarPoints: spec.grammarPoints,
          })
        }
        const skippedLessons = [...new Set([...next.skippedLessons, ...newlySkipped])].sort((a, b) => a - b)
        const learnerGraph = graphSpecs.length
          ? recordSkippedLessons(next.learnerGraph, { course: 'hsk4a', lessons: graphSpecs, at: now })
          : next.learnerGraph
        return {
          ...next,
          skippedLessons,
          unlockedLesson: Math.max(next.unlockedLesson ?? 1, targetLesson),
          learnerGraph,
        }
      })
    },
    [setState],
  )

  const unskipHskLesson = useCallback(
    (lesson: number) => {
      setState((s) => ({
        ...s,
        skippedLessons: s.skippedLessons.filter((n) => n !== lesson),
        learnerGraph: unskipLessonInGraph(s.learnerGraph, { course: 'hsk4a', lesson }),
      }))
    },
    [setState],
  )

  const enqueueSkippedWords = useCallback(
    (
      lessonOffset: number,
      skippedSpecs: Array<{ course: CourseKey; lesson: number; title?: string; words: { zh: string }[]; grammarPoints?: string[] }>,
    ) => {
      if (!skippedSpecs.length) return
      const now = Date.now()
      setState((s) => {
        let next = s
        for (const spec of skippedSpecs) {
          next = enqueueWords(next, lessonOffset + spec.lesson, spec.words.filter((w) => isCoreBookVocab(w.zh)), now)
        }
        const course = skippedSpecs[0].course
        const learnerGraph = recordSkippedLessons(next.learnerGraph, {
          course,
          lessons: skippedSpecs.map((spec) => ({
            lesson: spec.lesson,
            title: spec.title,
            words: spec.words.filter((w) => isCoreBookVocab(w.zh)).map((w) => w.zh),
            grammarPoints: spec.grammarPoints,
          })),
          at: now,
        })
        return { ...next, learnerGraph }
      })
    },
    [setState],
  )

  const unskipCourseLessonInGraph = useCallback(
    (course: CourseKey, lesson: number) => {
      setState((s) => ({
        ...s,
        learnerGraph: unskipLessonInGraph(s.learnerGraph, { course, lesson }),
      }))
    },
    [setState],
  )

  const recordNearSynonymConfusion = useCallback(
    (targetZh: string, typedZh: string, lesson?: number, course?: CourseKey) => {
      if (!targetZh.trim() || !typedZh.trim()) return
      setState((s) => {
        const offset = s.cards[targetZh]?.lesson ?? s.mastery[targetZh]?.lesson ?? lesson ?? 0
        const resolved = course ? { course, unit: lesson ?? 0 } : graphCourseOf(offset)
        return {
          ...s,
          learnerGraph: recordRecallOutcome(s.learnerGraph, {
            zh: targetZh,
            correct: false,
            assisted: true,
            mode: 'synonym-confusion',
            course: resolved.course,
            lesson: resolved.unit || undefined,
            confusedWith: typedZh,
          }),
        }
      })
    },
    [setState],
  )

  const recordExamAttemptInGraph = useCallback(
    (input: ExamOutcomeInput) => {
      setState((s) => ({
        ...s,
        learnerGraph: recordExamOutcome(s.learnerGraph, input),
      }))
    },
    [setState],
  )

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
    const freshGraph = createEmptyGraph(Date.now())
    const freshState: Persisted = {
      ...empty,
      learnerGraph: freshGraph,
      resetAt: Date.now(),
      learning: initLearning(empty),
    }
    if (!initial) {
      clearAllLearningStorage(localStorage, key)
      replaceLearnerGraph(freshGraph)
      resetBeastPrefs()
      try {
        persistProgress(localStorage, key, freshState)
      } catch {
        setStorageProblem(true)
        return
      }
    }
    dirtySincePullRef.current = false
    latest.current = freshState
    setState(() => freshState)
    if (!initial && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LOCAL_PROGRESS_EVENT))
      if (!userId) {
        setSyncStatus('pending')
        void forcePushCloudReset({
          storage: localStorage,
          key,
          onHydrated: applyCloudHydration,
        }).then((res) => setSyncStatus(res.status))
      }
    }
  }, [key, setState, initial, userId, applyCloudHydration])

  const value = useMemo<Store>(() => {
    const cardList = Object.values(state.cards)
    const practiceDays = Object.keys(state.log)
    return {
      ...state,
      storageProblem,
      syncStatus,
      syncNow,
      exportProgress,
      importProgress,
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
      skipToHskLesson,
      unskipHskLesson,
      enqueueSkippedWords,
      unskipCourseLessonInGraph,
      recordNearSynonymConfusion,
      recordExamAttemptInGraph,
      setPref,
      reset,
    }
  }, [
    state,
    storageProblem,
    syncStatus,
    syncNow,
    exportProgress,
    importProgress,
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
    skipToHskLesson,
    unskipHskLesson,
    enqueueSkippedWords,
    unskipCourseLessonInGraph,
    recordNearSynonymConfusion,
    recordExamAttemptInGraph,
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
