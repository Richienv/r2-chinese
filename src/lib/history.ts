/** Local checkpoint log — separate from course/progress keys. */

const HISTORY_KEY = 'yulu.history.v1'
const MAX_EVENTS = 400
const DEDUPE_MS = 2000

export type HistoryCourse = 'hsk4a' | 'kerja' | 'jiaocheng' | 'magang' | 'interview' | 'books'

export type HistoryEvent = {
  t: number
  course: HistoryCourse
  kind: 'node' | 'quiz' | 'drill'
  lesson: number
  node?: string
  title?: string
  correct?: boolean
  xp?: number
}

function isHistoryCourse(v: unknown): v is HistoryCourse {
  return (
    v === 'hsk4a' ||
    v === 'kerja' ||
    v === 'jiaocheng' ||
    v === 'magang' ||
    v === 'interview' ||
    v === 'books'
  )
}

function isHistoryKind(v: unknown): v is HistoryEvent['kind'] {
  return v === 'node' || v === 'quiz' || v === 'drill'
}

function parseEvent(raw: unknown): HistoryEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.t !== 'number' || !Number.isFinite(o.t)) return null
  if (!isHistoryCourse(o.course)) return null
  if (!isHistoryKind(o.kind)) return null
  if (typeof o.lesson !== 'number' || !Number.isFinite(o.lesson)) return null

  const event: HistoryEvent = {
    t: o.t,
    course: o.course,
    kind: o.kind,
    lesson: o.lesson,
  }
  if (typeof o.node === 'string') event.node = o.node
  if (typeof o.title === 'string') event.title = o.title
  if (typeof o.correct === 'boolean') event.correct = o.correct
  if (typeof o.xp === 'number' && Number.isFinite(o.xp)) event.xp = o.xp
  return event
}

function loadEvents(): HistoryEvent[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: HistoryEvent[] = []
    for (const item of parsed) {
      const event = parseEvent(item)
      if (event) out.push(event)
    }
    return out
  } catch {
    return []
  }
}

function saveEvents(events: HistoryEvent[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(events))
  } catch {
    /* ignore */
  }
}

function sameDedupeKey(a: HistoryEvent, b: Omit<HistoryEvent, 't'>): boolean {
  return (
    a.course === b.course &&
    a.kind === b.kind &&
    a.lesson === b.lesson &&
    a.node === b.node &&
    a.correct === b.correct
  )
}

/** Append a history event (newest first). Caps at 400; swallows storage errors. */
export function recordHistory(event: Omit<HistoryEvent, 't'>): void {
  try {
    const now = Date.now()
    const events = loadEvents()
    const newest = events[0]
    if (
      newest &&
      now - newest.t <= DEDUPE_MS &&
      sameDedupeKey(newest, event)
    ) {
      return
    }
    const next: HistoryEvent[] = [{ ...event, t: now }, ...events].slice(0, MAX_EVENTS)
    saveEvents(next)
  } catch {
    /* ignore */
  }
}

/** History events, newest first. */
export function readHistory(): HistoryEvent[] {
  return loadEvents()
}
