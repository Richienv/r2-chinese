import {
  initLearning,
  wordState,
  activeEvents,
  type LearningData,
  type LearningState,
} from './learningEngine.ts'
export const PROGRESS_KEY = 'yulu.hsk4a.v1'
export function progressKey(userId?: string) {
  return userId ? PROGRESS_KEY + '.' + userId : PROGRESS_KEY
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
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
  const deviceKeys = new Set([
    'yulu.jiaocheng.v1',
    'yulu.kerja.v1',
    'yulu.magang.v1',
    'yulu.interview.v1',
    'yulu.books.v1',
    'yulu.books.journal.v1',
    'yulu.jiayin.v1',
    'yulu.jiayin.english.v1',
    'yulu.history.v1',
    'yulu.step.v1',
    'yulu.learning-checkpoints.v1',
  ])
  const account = key === PROGRESS_KEY ? 'local' : key.slice(PROGRESS_KEY.length + 1)
  deviceKeys.add('yulu.hsk-writing.v1:' + account)
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
type Progress = LearningData & {
  xp: number
  lessonsDone: number[]
  starred: string[]
  log: Record<string, { cards: number; lessons: number }>
  pathDone: Record<string, string[]>
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
  const merged = {
    ...left,
    ...right,
    ...latest,
    learning,
    cards: { ...left.cards, ...right.cards },
    mastery: { ...left.mastery, ...right.mastery },
    lessonsDone: [...new Set([...left.lessonsDone, ...right.lessonsDone])].sort((a, b) => a - b),
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
