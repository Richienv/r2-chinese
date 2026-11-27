import {
  initLearning,
  wordState,
  activeEvents,
  type LearningData,
  type LearningState,
} from './learningEngine.ts'
import { mergeLearnerGraphs, normalizeLearnerGraph, type LearnerGraphState } from './learnerGraph.ts'
export const PROGRESS_KEY = 'yulu.hsk4a.v1'
export function progressKey(userId?: string) {
  return userId ? PROGRESS_KEY + '.' + userId : PROGRESS_KEY
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

const DEVICE_KEYS = new Set([
  'yulu.jiaocheng.v1',
  'yulu.kerja.v1',
  'yulu.magang.v1',
  'yulu.interview.v1',
  'yulu.books.v1',
  'yulu.books.journal.v1',
  'yulu.books.selected.v1',
  'yulu.jiayin.v1',
  'yulu.jiayin.english.v1',
  'yulu.history.v1',
  'yulu.step.v1',
  'yulu.learning-checkpoints.v1',
  'yulu.learner-graph.v1',
  'yulu.beast.v1',
  'yulu.course.v1',
  'yulu.course-entered.v1',
  'yulu.lang.v1',
])

const MERGEABLE_JSON_KEYS = new Set([
  'yulu.jiaocheng.v1',
  'yulu.kerja.v1',
  'yulu.magang.v1',
  'yulu.interview.v1',
  'yulu.books.v1',
  'yulu.books.journal.v1',
  'yulu.jiayin.v1',
  'yulu.jiayin.english.v1',
  'yulu.history.v1',
  'yulu.learning-checkpoints.v1',
])

function accountSuffixForKey(key: string): string {
  return key === PROGRESS_KEY ? 'local' : key.slice(PROGRESS_KEY.length + 1)
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function tryParseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function mergeJsonArrays(left: unknown[], right: unknown[]): unknown[] {
  const out: unknown[] = []
  const seen = new Set<string>()
  for (const item of [...left, ...right]) {
    const token =
      item === null || typeof item !== 'object' ? `${typeof item}:${String(item)}` : JSON.stringify(item)
    if (seen.has(token)) continue
    seen.add(token)
    out.push(item)
  }
  return out.length > 400 ? out.slice(-400) : out
}

function mergeJsonRecords(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const a = left[k]
    const b = right[k]
    if (a === undefined) {
      out[k] = b
      continue
    }
    if (b === undefined) {
      out[k] = a
      continue
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      out[k] = mergeJsonArrays(a, b)
    } else if (isPlainRecord(a) && isPlainRecord(b)) {
      out[k] = mergeJsonRecords(a, b)
    } else if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
      out[k] = Math.max(a, b)
    } else if (typeof a === 'boolean' && typeof b === 'boolean') {
      out[k] = a || b
    } else if (typeof b === 'string' && b.length === 0 && typeof a === 'string' && a.length > 0) {
      out[k] = a
    } else {
      out[k] = b
    }
  }
  return out
}

function scoreDeviceJson(val: unknown): number {
  if (Array.isArray(val)) return val.length * 10
  if (!isPlainRecord(val)) return 0
  let score = 0
  for (const [k, v] of Object.entries(val)) {
    if (k === 'version' || k === 'updatedAt') continue
    if (k === 'unlockedLesson' || k === 'unlockedChapter') {
      if (typeof v === 'number' && Number.isFinite(v) && v > 1) score += (v - 1) * 15
      continue
    }
    if (Array.isArray(v)) {
      score += v.length * 10
    } else if (isPlainRecord(v)) {
      for (const nested of Object.values(v)) {
        if (Array.isArray(nested)) score += nested.length * 10
        else if (isPlainRecord(nested)) score += Object.keys(nested).length * 10
        else if (typeof nested === 'string' && nested.trim()) score += 10
        else if (typeof nested === 'number' && nested > 0) score += 5
      }
    } else if (typeof v === 'string' && v.trim()) {
      score += 10
    } else if (typeof v === 'number' && Number.isFinite(v) && v > 0 && k !== 'currentLesson') {
      score += 5
    } else if (typeof v === 'number' && k === 'currentLesson' && v > 1) {
      score += 10
    }
  }
  return score
}

/**
 * Score how much real study activity a Yulu backup JSON carries so an empty
 * browser/PWA can never overwrite real progress on another device.
 */
export function computeBackupActivityScore(rawOrParsed: string | Record<string, unknown>): number {
  const parsed = typeof rawOrParsed === 'string' ? tryParseJson(rawOrParsed) : rawOrParsed
  if (!isPlainRecord(parsed)) return 0
  let entries: Record<string, unknown> | null = null
  if (parsed.format === 'yulu-progress-backup' && isPlainRecord(parsed.entries)) {
    entries = parsed.entries
  } else if ('cards' in parsed || 'lessonsDone' in parsed || 'xp' in parsed) {
    entries = { [PROGRESS_KEY]: parsed }
  }
  if (!entries) return 0

  let total = 0
  for (const [k, rawVal] of Object.entries(entries)) {
    if (isMainProgressKey(k)) {
      const p = tryParseJson(rawVal)
      if (!isPlainRecord(p)) continue
      const xp = typeof p.xp === 'number' && Number.isFinite(p.xp) ? Math.max(0, Math.round(p.xp)) : 0
      const lessons = Array.isArray(p.lessonsDone) ? p.lessonsDone.length : 0
      const cards = isPlainRecord(p.cards) ? Object.keys(p.cards).length : 0
      const mastery = isPlainRecord(p.mastery) ? Object.keys(p.mastery).length : 0
      const events =
        isPlainRecord(p.learning) && isPlainRecord(p.learning.events)
          ? Object.keys(p.learning.events).length
          : 0
      const pathDone = isPlainRecord(p.pathDone) ? Object.keys(p.pathDone).length : 0
      const starred = Array.isArray(p.starred) ? p.starred.length : 0
      const graphNodes =
        isPlainRecord(p.learnerGraph) && isPlainRecord(p.learnerGraph.nodes)
          ? Object.keys(p.learnerGraph.nodes).length
          : 0
      const unlocked =
        typeof p.unlockedLesson === 'number' && Number.isFinite(p.unlockedLesson) && p.unlockedLesson > 1
          ? (p.unlockedLesson - 1) * 15
          : 0
      total +=
        xp +
        lessons * 100 +
        cards * 20 +
        mastery * 10 +
        events * 15 +
        pathDone * 25 +
        starred * 5 +
        graphNodes * 10 +
        unlocked
      continue
    }

    if (k === 'yulu.learner-graph.v1' || MERGEABLE_JSON_KEYS.has(k) || k.startsWith('yulu.hsk-writing.v1:')) {
      total += scoreDeviceJson(tryParseJson(rawVal))
      continue
    }

    if (k === 'yulu.course-entered.v1' && rawVal === '1') {
      total += 1
    }
  }
  return total
}

function isMainProgressKey(k: string): boolean {
  if (k === PROGRESS_KEY) return true
  if (!k.startsWith(PROGRESS_KEY + '.')) return false
  if (k.includes('.before-') || k.endsWith('.pending') || k.includes('.server-before-v2')) return false
  return true
}

function hasMainActivity(p: unknown): p is Record<string, unknown> & Partial<Progress> {
  if (!isPlainRecord(p)) return false
  const xp = typeof p.xp === 'number' && Number.isFinite(p.xp) ? p.xp : 0
  const lessonsDone = Array.isArray(p.lessonsDone) ? p.lessonsDone : []
  const cards = isPlainRecord(p.cards) ? Object.keys(p.cards) : []
  const mastery = isPlainRecord(p.mastery) ? Object.keys(p.mastery) : []
  const pathDone = isPlainRecord(p.pathDone) ? Object.keys(p.pathDone) : []
  return xp > 0 || lessonsDone.length > 0 || cards.length > 0 || mastery.length > 0 || pathDone.length > 0
}

function withProgressDefaults(raw: Record<string, unknown>): Progress {
  return {
    ...(raw as Partial<Progress>),
    xp: typeof raw.xp === 'number' && Number.isFinite(raw.xp) ? raw.xp : 0,
    lessonsDone: Array.isArray(raw.lessonsDone)
      ? raw.lessonsDone.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      : [],
    starred: Array.isArray(raw.starred) ? raw.starred.filter((s): s is string => typeof s === 'string') : [],
    log: isPlainRecord(raw.log) ? (raw.log as Progress['log']) : {},
    cards: isPlainRecord(raw.cards) ? (raw.cards as Progress['cards']) : {},
    mastery: isPlainRecord(raw.mastery) ? (raw.mastery as Progress['mastery']) : {},
    pathDone: isPlainRecord(raw.pathDone) ? (raw.pathDone as Progress['pathDone']) : {},
  }
}

export function backupBeforeMigration(storage: StorageLike, key: string): void {
  const raw = storage.getItem(key)
  if (!raw || storage.getItem(key + '.before-v2')) return
  storage.setItem(key + '.before-v2', raw)
}
export function persistProgress(storage: StorageLike, key: string, state: unknown): void {
  backupBeforeMigration(storage, key)
  const prior = storage.getItem(key)
  if (prior) {
    const parsed = JSON.parse(prior)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Invalid progress: export before recovery')
  }
  const raw = JSON.stringify(state)
  storage.setItem(key + '.pending', raw)
  storage.setItem(key, raw)
  try {
    storage.removeItem(key + '.pending')
  } catch {
    /* Main record is durable; a stale pending record is harmless. */
  }
}
export function exportLearningStorage(storage: StorageLike, key: string): string {
  const entries: Record<string, string> = {}
  const deviceKeys = new Set(DEVICE_KEYS)
  deviceKeys.add('yulu.hsk-writing.v1:' + accountSuffixForKey(key))
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (
      k &&
      (deviceKeys.has(k) ||
        k === key ||
        k.startsWith(key + '.before-') ||
        k === key + '.pending' ||
        k === key + '.server-before-v2')
    )
      entries[k] = storage.getItem(k) ?? ''
  }
  return JSON.stringify(
    { format: 'yulu-progress-backup', version: 2, exportedAt: new Date().toISOString(), entries },
    null,
    2,
  )
}

export type ImportResult =
  | { ok: true; restoredKeys: number; mainProgress: Record<string, unknown> | null }
  | { ok: false; error: string }

/**
 * Restore an exported `yulu-progress-backup.json` (or raw progress JSON) into `storage`.
 * Merges cleanly with any existing non-empty progress so no active device data is lost.
 */
export function importLearningStorage(
  storage: StorageLike,
  targetKey: string,
  rawJson: string,
): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    return { ok: false, error: 'invalid-json' }
  }
  if (!isPlainRecord(parsed)) return { ok: false, error: 'unrecognized-format' }

  let rawEntries: Record<string, unknown> | null = null
  if (parsed.format === 'yulu-progress-backup' && isPlainRecord(parsed.entries)) {
    rawEntries = parsed.entries
  } else if ('cards' in parsed || 'lessonsDone' in parsed || 'xp' in parsed) {
    rawEntries = { [targetKey]: JSON.stringify(parsed) }
  }
  if (!rawEntries) return { ok: false, error: 'unrecognized-format' }

  const writingDestKey = 'yulu.hsk-writing.v1:' + accountSuffixForKey(targetKey)
  let restoredKeys = 0
  let bestMain: Record<string, unknown> | null = null
  let bestScore = -1
  let importedGraph: LearnerGraphState | null = null

  for (const [k, rawVal] of Object.entries(rawEntries)) {
    if (isMainProgressKey(k)) {
      let candidate: unknown = rawVal
      if (typeof rawVal === 'string') {
        try {
          candidate = JSON.parse(rawVal)
        } catch {
          continue
        }
      }
      if (!isPlainRecord(candidate)) continue
      const xpVal = typeof candidate.xp === 'number' && Number.isFinite(candidate.xp) ? candidate.xp : 0
      const updated =
        typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : 0
      const score = (k === targetKey ? 1e15 : 0) + xpVal * 1000 + updated
      if (score >= bestScore) {
        bestScore = score
        bestMain = candidate
      }
      continue
    }

    if (k === 'yulu.learner-graph.v1') {
      let gObj: unknown = rawVal
      if (typeof rawVal === 'string') {
        try {
          gObj = JSON.parse(rawVal)
        } catch {
          gObj = null
        }
      }
      if (isPlainRecord(gObj)) {
        const normalized = normalizeLearnerGraph(gObj)
        importedGraph = importedGraph ? mergeLearnerGraphs(importedGraph, normalized) : normalized
        let existingGraph: LearnerGraphState | undefined
        try {
          const cur = storage.getItem(k)
          if (cur) existingGraph = normalizeLearnerGraph(JSON.parse(cur))
        } catch {
          existingGraph = undefined
        }
        const combined = existingGraph ? mergeLearnerGraphs(existingGraph, importedGraph) : importedGraph
        storage.setItem(k, JSON.stringify(combined))
        restoredKeys++
      }
      continue
    }

    if (k.startsWith('yulu.hsk-writing.v1:')) {
      const incomingParsed = tryParseJson(rawVal)
      const existingParsed = tryParseJson(storage.getItem(writingDestKey))
      const strVal =
        isPlainRecord(existingParsed) && isPlainRecord(incomingParsed)
          ? JSON.stringify(mergeJsonRecords(existingParsed, incomingParsed))
          : typeof rawVal === 'string'
            ? rawVal
            : JSON.stringify(rawVal)
      if (typeof strVal === 'string' && strVal.length > 0) {
        storage.setItem(writingDestKey, strVal)
        restoredKeys++
      }
      continue
    }

    if (DEVICE_KEYS.has(k)) {
      let strVal = typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal)
      if (MERGEABLE_JSON_KEYS.has(k)) {
        const incomingParsed = tryParseJson(rawVal)
        const existingParsed = tryParseJson(storage.getItem(k))
        if (isPlainRecord(existingParsed) && isPlainRecord(incomingParsed)) {
          strVal = JSON.stringify(mergeJsonRecords(existingParsed, incomingParsed))
        } else if (Array.isArray(existingParsed) && Array.isArray(incomingParsed)) {
          strVal = JSON.stringify(mergeJsonArrays(existingParsed, incomingParsed))
        }
      } else if (k === 'yulu.course-entered.v1') {
        strVal = storage.getItem(k) === '1' || strVal === '1' ? '1' : strVal
      }
      if (typeof strVal === 'string' && strVal.length > 0) {
        storage.setItem(k, strVal)
        restoredKeys++
      }
    }
  }

  let persistedMain: Record<string, unknown> | null = null
  if (bestMain) {
    const importedDefaults = withProgressDefaults(bestMain)
    const existingRaw = readProgress(storage, targetKey)
    let finalMain: Progress
    if (hasMainActivity(existingRaw) && (existingRaw.resetAt ?? 0) <= (importedDefaults.resetAt ?? 0)) {
      finalMain = mergeProgress(withProgressDefaults(existingRaw), importedDefaults)
    } else if (hasMainActivity(existingRaw)) {
      finalMain = mergeProgress(withProgressDefaults({ ...existingRaw, resetAt: 0 }), {
        ...importedDefaults,
        resetAt: 0,
      })
    } else {
      const { resetAt: _ignoredReset, ...rest } = importedDefaults
      void _ignoredReset
      finalMain = rest as Progress
    }
    if (importedGraph) {
      finalMain.learnerGraph = mergeLearnerGraphs(finalMain.learnerGraph, importedGraph)
    }
    finalMain.updatedAt = Math.max(Date.now(), finalMain.updatedAt ?? 0)
    persistProgress(storage, targetKey, finalMain)
    persistedMain = finalMain as unknown as Record<string, unknown>
    restoredKeys++
  }

  if (restoredKeys === 0) return { ok: false, error: 'no-valid-entries' }
  return { ok: true, restoredKeys, mainProgress: persistedMain }
}
type Progress = LearningData & {
  xp: number
  lessonsDone: number[]
  starred: string[]
  log: Record<string, { cards: number; lessons: number }>
  pathDone: Record<string, string[]>
  skippedLessons?: number[]
  unlockedLesson?: number
  learnerGraph?: LearnerGraphState
  updatedAt?: number
  resetAt?: number
  starChanges?: Record<string, { at: number; on: boolean }>
}
function eventCredits(data: LearningData) {
  const byDay: Record<string, number> = {},
    lessonDays: Record<string, number> = {}
  let xp = 0
  for (const e of activeEvents(data)) {
    xp += e.xp
    if (e.source !== 'review') continue
    const d = new Date(e.at),
      day =
        e.day ??
        d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0')
    byDay[day] = (byDay[day] ?? 0) + 1
  }
  for (const credit of Object.values(initLearning(data).credits ?? {})) {
    xp += credit.xp
    byDay[credit.day] = (byDay[credit.day] ?? 0) + credit.cards
    lessonDays[credit.day] = (lessonDays[credit.day] ?? 0) + credit.lessons
  }
  return { xp, byDay, lessonDays }
}
/** Union durable evidence; keep all legacy achievements and unknown fields. */
export function mergeProgress<T extends Progress>(left: T, right: T): T {
  if ((left.resetAt ?? 0) !== (right.resetAt ?? 0))
    return (left.resetAt ?? 0) > (right.resetAt ?? 0) ? left : right
  const a = initLearning(left),
    b = initLearning(right)
  const latest = (left.updatedAt ?? 0) >= (right.updatedAt ?? 0) ? left : right
  const origins = { ...a.origins }
  for (const [zh, origin] of Object.entries(b.origins)) {
    const prior = origins[zh]
    if (!prior || (origin.card?.reps ?? 0) > (prior.card?.reps ?? 0)) origins[zh] = origin
  }
  const learning: LearningState = {
    version: 2,
    origins,
    credits: { ...a.credits, ...b.credits },
    events: { ...a.events, ...b.events },
    undone: { ...a.undone, ...b.undone },
  }
  const lessonsDone = [...new Set([...left.lessonsDone, ...right.lessonsDone])].sort((a, b) => a - b)
  const doneSet = new Set(lessonsDone)
  const skippedLessons = [...new Set([...(left.skippedLessons ?? []), ...(right.skippedLessons ?? [])])]
    .filter((n) => Number.isFinite(n) && !doneSet.has(n))
    .sort((a, b) => a - b)
  const unlockedLesson = Math.max(left.unlockedLesson ?? 1, right.unlockedLesson ?? 1)
  const hasGraph = Boolean(left.learnerGraph || right.learnerGraph)
  const merged = {
    ...left,
    ...right,
    ...latest,
    learning,
    cards: { ...left.cards, ...right.cards },
    mastery: { ...left.mastery, ...right.mastery },
    lessonsDone,
    ...(skippedLessons.length ? { skippedLessons } : {}),
    ...(unlockedLesson > 1 ? { unlockedLesson } : {}),
    ...(hasGraph ? { learnerGraph: mergeLearnerGraphs(left.learnerGraph, right.learnerGraph) } : {}),
    starred: [...new Set([...left.starred, ...right.starred])],
    pathDone: { ...left.pathDone },
    log: { ...left.log },
    updatedAt: Math.max(left.updatedAt ?? 0, right.updatedAt ?? 0),
  } as T
  const starChanges = { ...left.starChanges }
  for (const [zh, change] of Object.entries(right.starChanges ?? {}))
    if (!starChanges[zh] || change.at >= starChanges[zh].at) starChanges[zh] = change
  merged.starChanges = starChanges
  merged.starred = [
    ...new Set([...merged.starred, ...Object.keys(starChanges).filter((zh) => starChanges[zh].on)]),
  ].filter((zh) => !starChanges[zh] || starChanges[zh].on)
  for (const key of new Set([...Object.keys(left.pathDone), ...Object.keys(right.pathDone)]))
    merged.pathDone[key] = [...new Set([...(left.pathDone[key] ?? []), ...(right.pathDone[key] ?? [])])]
  const ca = eventCredits(left),
    cb = eventCredits(right),
    cc = eventCredits(merged)
  merged.xp = Math.max(0, left.xp - ca.xp, right.xp - cb.xp) + cc.xp
  for (const day of new Set([
    ...Object.keys(left.log),
    ...Object.keys(right.log),
    ...Object.keys(cc.byDay),
  ])) {
    merged.log[day] = {
      lessons:
        Math.max(
          0,
          (left.log[day]?.lessons ?? 0) - (ca.lessonDays[day] ?? 0),
          (right.log[day]?.lessons ?? 0) - (cb.lessonDays[day] ?? 0),
        ) + (cc.lessonDays[day] ?? 0),
      cards:
        Math.max(
          0,
          (left.log[day]?.cards ?? 0) - (ca.byDay[day] ?? 0),
          (right.log[day]?.cards ?? 0) - (cb.byDay[day] ?? 0),
        ) + (cc.byDay[day] ?? 0),
    }
  }
  for (const zh of new Set([...Object.keys(origins), ...Object.values(learning.events).map((e) => e.zh)])) {
    const lm = left.mastery[zh],
      rm = right.mastery[zh]
    if (lm && rm)
      merged.mastery[zh] = {
        ...merged.mastery[zh],
        lastSeen: Math.max(lm.lastSeen, rm.lastSeen),
        encounters: Math.max(lm.encounters, rm.encounters),
      }
    const word = wordState(merged, zh)
    if (word.card) merged.cards[zh] = word.card
    else delete merged.cards[zh]
    if (word.mastery) merged.mastery[zh] = word.mastery
    else delete merged.mastery[zh]
  }
  return merged
}

/** Recover an interrupted write without letting an older pending record beat the main save. */
export function readProgress(storage: StorageLike, key: string): unknown {
  const raw = storage.getItem(key),
    pending = storage.getItem(key + '.pending')
  const parse = (value: string | null) => {
    if (!value) return undefined
    try {
      return JSON.parse(value)
    } catch {
      return undefined
    }
  }
  const main = parse(raw),
    next = parse(pending)
  if (next && (!main || (next.updatedAt ?? 0) >= (main.updatedAt ?? 0))) return next
  return main
}

const RESETTABLE_KEYS = [
  'yulu.jiaocheng.v1',
  'yulu.kerja.v1',
  'yulu.magang.v1',
  'yulu.interview.v1',
  'yulu.books.v1',
  'yulu.books.journal.v1',
  'yulu.books.selected.v1',
  'yulu.jiayin.v1',
  'yulu.jiayin.english.v1',
  'yulu.history.v1',
  'yulu.step.v1',
  'yulu.learning-checkpoints.v1',
  'yulu.learner-graph.v1',
  'yulu.beast.v1',
] as const

/** Clear all course, history, graph, and Beast progress keys cleanly on intentional reset. */
export function clearAllLearningStorage(storage: StorageLike, mainKey: string): void {
  const toRemove = new Set<string>([
    mainKey,
    `${mainKey}.pending`,
    `${mainKey}.server-before-v2`,
    `yulu.hsk-writing.v1:${accountSuffixForKey(mainKey)}`,
    ...RESETTABLE_KEYS,
  ])
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && k.startsWith(`${mainKey}.before-`)) {
      toRemove.add(k)
    }
  }
  for (const k of toRemove) {
    try {
      storage.removeItem(k)
    } catch {
      /* ignore per-key removal issues */
    }
  }
}
