import { useCallback, useSyncExternalStore } from 'react'

/** Books path progress — never written into HSK / Kerja / Jiaocheng / Magang / Interview keys. */
export const BOOKS_PROGRESS_KEY = 'yulu.books.v1'

export const BOOKS_COURSE = {
  title: 'Books',
  titleZh: 'Books',
  blurb: 'Five books, one idea at a time',
} as const

/** One playable path node per chapter. */
export const LESSON_NODE = 'lesson' as const

export type BooksSittingKind = 'idea' | 'remember' | 'check' | 'try' | 'example'

export interface BooksTerm {
  en: string
  hook?: string
}

export interface BooksSitting {
  id: string
  kind: BooksSittingKind
  titleEn: string
  bodyEn: string
  terms?: BooksTerm[]
  prompt?: string
  choices?: string[]
  answer?: number
}

export type BooksBeat = BooksSitting

export interface BooksChapter {
  id: string
  index: number
  part: number
  partTitleEn: string
  titleEn: string
  sittings: BooksSitting[]
  /** Same items as sittings when the file includes both. Non-empty beats win. */
  beats?: BooksBeat[]
}

export type BooksNode = typeof LESSON_NODE

const SITTING_KINDS = new Set<BooksSittingKind>(['idea', 'remember', 'check', 'try', 'example'])

export const SITTING_KIND_LABEL: Record<BooksSittingKind, string> = {
  idea: 'Idea',
  remember: 'Remember',
  check: 'Check',
  try: 'Try',
  example: 'Example',
}

type GlobModule = { default: unknown } | unknown

/**
 * Chapter files land in parallel. Each glob is empty until that folder exists.
 * A file that is not a chapter object is skipped.
 */
const chapterModules = {
  ...import.meta.glob('../data/books/offers/ch-*.json', { eager: true }),
  ...import.meta.glob('../data/books/hours/ch-*.json', { eager: true }),
  ...import.meta.glob('../data/books/hyperfocus/ch-*.json', { eager: true }),
  ...import.meta.glob('../data/books/weekend/ch-*.json', { eager: true }),
  ...import.meta.glob('../data/books/workweek/ch-*.json', { eager: true }),
} as Record<string, GlobModule>

function asTerms(raw: unknown): BooksTerm[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const terms: BooksTerm[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const t = item as Record<string, unknown>
    if (typeof t.en !== 'string' || !t.en.trim()) continue
    const term: BooksTerm = { en: t.en.trim() }
    if (typeof t.hook === 'string' && t.hook.trim()) term.hook = t.hook.trim()
    terms.push(term)
  }
  return terms.length > 0 ? terms : undefined
}

function asChoices(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length < 2) return undefined
  if (!raw.every((c) => typeof c === 'string')) return undefined
  return raw
}

function asSitting(raw: unknown): BooksSitting | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id.trim()) return null
  if (typeof o.kind !== 'string' || !SITTING_KINDS.has(o.kind as BooksSittingKind)) return null
  if (typeof o.titleEn !== 'string') return null
  if (typeof o.bodyEn !== 'string') return null

  const sitting: BooksSitting = {
    id: o.id.trim(),
    kind: o.kind as BooksSittingKind,
    titleEn: o.titleEn,
    bodyEn: o.bodyEn,
  }
  const terms = asTerms(o.terms)
  if (terms) sitting.terms = terms
  if (typeof o.prompt === 'string') sitting.prompt = o.prompt
  const choices = asChoices(o.choices)
  if (choices) sitting.choices = choices
  if (typeof o.answer === 'number' && Number.isInteger(o.answer)) sitting.answer = o.answer
  return sitting
}

function parseSittingList(raw: unknown): BooksSitting[] {
  if (!Array.isArray(raw)) return []
  const out: BooksSitting[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const sitting = asSitting(item)
    if (!sitting || seen.has(sitting.id)) continue
    seen.add(sitting.id)
    out.push(sitting)
  }
  return out
}

function asChapter(mod: GlobModule): BooksChapter | null {
  const raw =
    mod && typeof mod === 'object' && 'default' in (mod as object)
      ? (mod as { default: unknown }).default
      : mod
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.index !== 'number' || !Number.isFinite(o.index)) return null
  if (typeof o.part !== 'number' || !Number.isFinite(o.part)) return null
  if (typeof o.id !== 'string' && typeof o.id !== 'number') return null

  const sittings = parseSittingList(o.sittings)
  const beats = parseSittingList(o.beats)
  const chapter: BooksChapter = {
    id: String(o.id),
    index: o.index,
    part: o.part,
    partTitleEn: typeof o.partTitleEn === 'string' ? o.partTitleEn : '',
    titleEn: typeof o.titleEn === 'string' ? o.titleEn : '',
    sittings,
  }
  if (beats.length > 0) chapter.beats = beats
  return chapter
}

function dedupeChapters(chapters: BooksChapter[]): BooksChapter[] {
  const seen = new Set<string>()
  const out: BooksChapter[] = []
  for (const ch of chapters) {
    const key = `${ch.part}:${ch.index}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ch)
  }
  return out
}

/** Every valid `ch-*.json`, sorted by part then index. Missing folders and bad files are skipped. */
export const booksChapters: BooksChapter[] = dedupeChapters(
  Object.values(chapterModules)
    .map(asChapter)
    .filter((c): c is BooksChapter => !!c)
    .sort((a, b) => a.part - b.part || a.index - b.index || a.id.localeCompare(b.id)),
)

export function getBooksChapter(part: number, index: number): BooksChapter | undefined {
  return booksChapters.find((c) => c.part === part && c.index === index)
}

/** Stable history lesson id for a chapter. Unique while index stays under 1000. */
export function booksLessonNumber(part: number, index: number): number {
  return part * 1000 + index
}

export function getBooksChapterByLesson(lesson: number): BooksChapter | undefined {
  return booksChapters.find((c) => booksLessonNumber(c.part, c.index) === lesson)
}

/** localStorage pathDone key inside `yulu.books.v1`. */
export function booksProgressKey(part: number, index: number): string {
  return `${part}:${index}`
}

/** Prefer non-empty beats; otherwise sittings. One screen per item. */
export function chapterSittings(ch: BooksChapter): BooksSitting[] {
  if (ch.beats && ch.beats.length > 0) return ch.beats
  return ch.sittings
}

export function nodesForChapter(_ch: BooksChapter): BooksNode[] {
  return [LESSON_NODE]
}

export function booksParts(): { part: number; titleEn: string; chapters: BooksChapter[] }[] {
  const map = new Map<number, { part: number; titleEn: string; chapters: BooksChapter[] }>()
  for (const ch of booksChapters) {
    let group = map.get(ch.part)
    if (!group) {
      group = { part: ch.part, titleEn: ch.partTitleEn || `Book ${ch.part}`, chapters: [] }
      map.set(ch.part, group)
    }
    if (!group.titleEn && ch.partTitleEn) group.titleEn = ch.partTitleEn
    group.chapters.push(ch)
  }
  return [...map.values()].sort((a, b) => a.part - b.part)
}

export function nodeLabelBooks(ch: BooksChapter): string {
  return ch.titleEn || `Chapter ${ch.index}`
}

/**
 * Within a book, chapter N unlocks after the previous chapter in that book.
 * The first chapter of every book is unlocked.
 */
export function previousInBook(ch: BooksChapter): BooksChapter | undefined {
  const siblings = booksChapters.filter((c) => c.part === ch.part)
  const at = siblings.findIndex((c) => c.index === ch.index)
  if (at <= 0) return undefined
  return siblings[at - 1]
}

export type BooksSessionStep =
  | { kind: 'idea'; id: string; sitting: BooksSitting; n: number; of: number }
  | {
      kind: 'quiz'
      id: string
      sitting: BooksSitting
      prompt: string
      choices: string[]
      answer: number
      n: number
      of: number
    }
  | { kind: 'complete' }

function quizFields(
  sitting: BooksSitting,
): { prompt: string; choices: string[]; answer: number } | null {
  if (sitting.kind !== 'check') return null
  const choices = sitting.choices
  if (!choices || choices.length < 2) return null
  if (typeof sitting.answer !== 'number') return null
  if (!Number.isInteger(sitting.answer) || sitting.answer < 0 || sitting.answer >= choices.length) {
    return null
  }
  return {
    prompt: sitting.prompt?.trim() || sitting.titleEn.trim() || 'Choose the best answer',
    choices,
    answer: sitting.answer,
  }
}

/** One player screen per sitting, then a completion step. */
export function buildBooksSteps(part: number, index: number): BooksSessionStep[] {
  const ch = getBooksChapter(part, index)
  if (!ch) return []
  const sittings = chapterSittings(ch)
  if (sittings.length === 0) return []

  const of = sittings.length
  const steps: BooksSessionStep[] = []
  for (let i = 0; i < sittings.length; i++) {
    const sitting = sittings[i]!
    const n = i + 1
    const quiz = quizFields(sitting)
    if (quiz) {
      steps.push({ kind: 'quiz', id: `check:${sitting.id}`, sitting, ...quiz, n, of })
    } else {
      steps.push({ kind: 'idea', id: `idea:${sitting.id}`, sitting, n, of })
    }
  }
  steps.push({ kind: 'complete' })
  return steps
}

export function booksPlayableCount(steps: BooksSessionStep[]): number {
  return Math.max(1, steps.filter((s) => s.kind !== 'complete').length)
}

interface BooksPersisted {
  pathDone: Record<string, BooksNode[]>
}

const emptyProgress: BooksPersisted = { pathDone: {} }

function loadProgress(): BooksPersisted {
  try {
    const raw = localStorage.getItem(BOOKS_PROGRESS_KEY)
    if (!raw) return emptyProgress
    const parsed = JSON.parse(raw) as Partial<{ pathDone: Record<string, unknown> }>
    if (!parsed?.pathDone || typeof parsed.pathDone !== 'object') return emptyProgress
    const pathDone: Record<string, BooksNode[]> = {}
    for (const [key, nodes] of Object.entries(parsed.pathDone)) {
      if (!Array.isArray(nodes)) continue
      pathDone[key] = nodes.filter((n): n is BooksNode => n === LESSON_NODE)
    }
    return { pathDone }
  } catch {
    return emptyProgress
  }
}

let progressCache = loadProgress()
const progressListeners = new Set<() => void>()

function emitProgress() {
  for (const l of progressListeners) l()
}

function writeProgress(next: BooksPersisted) {
  progressCache = next
  try {
    localStorage.setItem(BOOKS_PROGRESS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  emitProgress()
}

function subscribeProgress(cb: () => void) {
  progressListeners.add(cb)
  return () => progressListeners.delete(cb)
}

function getProgressSnapshot() {
  return progressCache
}

export function useBooksProgress() {
  const state = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot)

  const isNodeDone = useCallback(
    (part: number, index: number, node: BooksNode) => {
      const done = state.pathDone[booksProgressKey(part, index)] ?? []
      return done.includes(node)
    },
    [state.pathDone],
  )

  const markNodeDone = useCallback((part: number, index: number, node: BooksNode) => {
    const key = booksProgressKey(part, index)
    const prev = progressCache.pathDone[key] ?? []
    if (prev.includes(node)) return
    writeProgress({
      pathDone: { ...progressCache.pathDone, [key]: [...prev, node] },
    })
  }, [])

  const isNodePlayable = useCallback(
    (part: number, index: number, node: BooksNode) => {
      if (node !== LESSON_NODE) return false
      const ch = getBooksChapter(part, index)
      if (!ch) return false
      if (isNodeDone(part, index, LESSON_NODE)) return true
      const prior = previousInBook(ch)
      if (!prior) return true
      return isNodeDone(prior.part, prior.index, LESSON_NODE)
    },
    [isNodeDone],
  )

  return {
    pathDone: state.pathDone,
    isNodeDone,
    markNodeDone,
    isNodePlayable,
  }
}
