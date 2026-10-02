import { useCallback, useMemo, useSyncExternalStore } from 'react'

/** Magang path progress — never written into HSK / Kerja / Jiaocheng keys. */
const PROGRESS_KEY = 'yulu.magang.v1'

export const MAGANG_BOOK = {
  title: 'Magang AI',
  titleZh: 'Magang AI',
  blurb: 'Internship book · study it slowly',
} as const

/** One playable path node per chapter. */
export const LESSON_NODE = 'lesson' as const

export type MagangSittingKind =
  | 'idea'
  | 'remember'
  | 'watch'
  | 'try'
  | 'interview'
  | 'example'
  | 'check'

export interface MagangTerm {
  zh: string
  en: string
  hook?: string
}

/** Sitting / beat item — same shape for sittings and optional beats. */
export interface MagangSitting {
  id: string
  kind: MagangSittingKind
  titleEn: string
  bodyEn: string
  sourceNote?: string
  mandarin?: string
  terms?: MagangTerm[]
  prompt?: string
  choices?: string[]
  answer?: number
}

export type MagangBeat = MagangSitting

export interface MagangChapter {
  id: string
  index: number
  part: number
  partTitleEn: string
  titleEn: string
  titleSource: string
  sourcePages: string
  when: string
  sittings: MagangSitting[]
  /** Optional lesson beats; when non-empty, preferred over sittings. */
  beats?: MagangBeat[]
}

/** Path node id — always `lesson` for Magang chapters. */
export type MagangNode = typeof LESSON_NODE | string

const SITTING_KINDS = new Set<MagangSittingKind>([
  'idea',
  'remember',
  'watch',
  'try',
  'interview',
  'example',
  'check',
])

export const SITTING_KIND_LABEL: Record<MagangSittingKind | 'wrap', string> = {
  idea: 'Idea',
  remember: 'Remember',
  watch: 'Watch',
  try: 'Try',
  interview: 'Interview',
  example: 'Example',
  check: 'Check',
  wrap: 'Wrap-up',
}

type GlobModule = { default: unknown } | unknown

const chapterModules = import.meta.glob('../data/magang/ch-*.json', {
  eager: true,
}) as Record<string, GlobModule>

function asSitting(raw: unknown): MagangSitting | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id.trim()) return null
  if (typeof o.kind !== 'string' || !SITTING_KINDS.has(o.kind as MagangSittingKind)) return null
  if (typeof o.titleEn !== 'string') return null
  if (typeof o.bodyEn !== 'string') return null

  const sitting: MagangSitting = {
    id: o.id.trim(),
    kind: o.kind as MagangSittingKind,
    titleEn: o.titleEn,
    bodyEn: o.bodyEn,
  }
  if (typeof o.sourceNote === 'string') sitting.sourceNote = o.sourceNote
  if (typeof o.mandarin === 'string') sitting.mandarin = o.mandarin
  if (Array.isArray(o.terms)) {
    const terms: MagangTerm[] = []
    for (const item of o.terms) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const t = item as Record<string, unknown>
      if (typeof t.zh !== 'string' || typeof t.en !== 'string') continue
      const term: MagangTerm = { zh: t.zh, en: t.en }
      if (typeof t.hook === 'string') term.hook = t.hook
      terms.push(term)
    }
    if (terms.length > 0) sitting.terms = terms
  }
  if (typeof o.prompt === 'string') sitting.prompt = o.prompt
  if (Array.isArray(o.choices)) {
    sitting.choices = o.choices.filter((c): c is string => typeof c === 'string')
  }
  if (typeof o.answer === 'number' && Number.isFinite(o.answer)) {
    sitting.answer = Math.floor(o.answer)
  }
  return sitting
}

function parseSittingList(raw: unknown): MagangSitting[] {
  if (!Array.isArray(raw)) return []
  const out: MagangSitting[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const s = asSitting(item)
    if (!s || seen.has(s.id)) continue
    seen.add(s.id)
    out.push(s)
  }
  return out
}

function asChapter(mod: GlobModule): MagangChapter | null {
  const raw =
    mod && typeof mod === 'object' && 'default' in (mod as object)
      ? (mod as { default: unknown }).default
      : mod
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.index !== 'number' || !Number.isFinite(o.index)) return null
  if (typeof o.id !== 'string' && typeof o.id !== 'number') return null

  const sittings = parseSittingList(o.sittings)
  const beats = parseSittingList(o.beats)

  const chapter: MagangChapter = {
    id: String(o.id),
    index: o.index,
    part: typeof o.part === 'number' && Number.isFinite(o.part) ? o.part : 1,
    partTitleEn: typeof o.partTitleEn === 'string' ? o.partTitleEn : '',
    titleEn: typeof o.titleEn === 'string' ? o.titleEn : '',
    titleSource: typeof o.titleSource === 'string' ? o.titleSource : '',
    sourcePages: typeof o.sourcePages === 'string' ? o.sourcePages : '',
    when: typeof o.when === 'string' ? o.when : '',
    sittings,
  }
  if (beats.length > 0) chapter.beats = beats
  return chapter
}

/** Every `ch-*.json` under magang/, sorted by index. Empty / invalid files are skipped. */
export const magangChapters: MagangChapter[] = Object.values(chapterModules)
  .map(asChapter)
  .filter((c): c is MagangChapter => !!c)
  .sort((a, b) => a.index - b.index)

export function getMagangChapter(index: number): MagangChapter | undefined {
  return magangChapters.find((c) => c.index === index)
}

/** Prefer non-empty `beats`; otherwise use `sittings` as the lesson beats. */
export function chapterBeats(ch: MagangChapter): MagangBeat[] {
  if (ch.beats && ch.beats.length > 0) return ch.beats
  return ch.sittings
}

export function getSitting(ch: MagangChapter, node: MagangNode): MagangSitting | undefined {
  if (node === LESSON_NODE || node === 'wrap') return undefined
  return ch.sittings.find((s) => s.id === node)
}

/** One playable node per chapter. */
export function nodesForChapter(_ch: MagangChapter): MagangNode[] {
  return [LESSON_NODE]
}

/** Chapters grouped by part for Learn path section labels. */
export function magangParts(): { part: number; titleEn: string; chapters: MagangChapter[] }[] {
  const map = new Map<number, { part: number; titleEn: string; chapters: MagangChapter[] }>()
  for (const ch of magangChapters) {
    let group = map.get(ch.part)
    if (!group) {
      group = { part: ch.part, titleEn: ch.partTitleEn || `Part ${ch.part}`, chapters: [] }
      map.set(ch.part, group)
    }
    if (!group.titleEn && ch.partTitleEn) group.titleEn = ch.partTitleEn
    group.chapters.push(ch)
  }
  return [...map.values()].sort((a, b) => a.part - b.part)
}

export function nodeCaptionMagang(
  ch: MagangChapter,
  _node: MagangNode,
): { en: string; hint: string } {
  return {
    en: ch.titleEn || ch.titleSource || `Chapter ${ch.index}`,
    hint: ch.when || (ch.sourcePages ? `pp. ${ch.sourcePages}` : ''),
  }
}

export function nodeLabelMagang(ch: MagangChapter, _node: MagangNode): string {
  return ch.titleEn || ch.titleSource || `Chapter ${ch.index}`
}

/** One player screen — idea, one term, say-line, or quiz (never stacked terms). */
export type MagangSessionStep =
  | {
      kind: 'idea'
      id: string
      beat: MagangBeat
      beatNum: number
      beatOf: number
    }
  | {
      kind: 'term'
      id: string
      beat: MagangBeat
      term: MagangTerm
      termNum: number
      termOf: number
      beatNum: number
      beatOf: number
    }
  | {
      kind: 'say'
      id: string
      beat: MagangBeat
      mandarin: string
      beatNum: number
      beatOf: number
    }
  | {
      kind: 'quiz'
      id: string
      beat: MagangBeat
      prompt: string
      choices: string[]
      answer: number
      beatNum: number
      beatOf: number
    }
  | { kind: 'complete' }

function validTerms(beat: MagangBeat): MagangTerm[] {
  return beat.terms?.filter((t) => t.zh.trim() && t.en.trim()) ?? []
}

/** Expand chapter beats into HSK-style screens: idea → one term each → say → quiz. */
export function buildMagangSteps(chapterIndex: number, node: MagangNode): MagangSessionStep[] {
  const ch = getMagangChapter(chapterIndex)
  if (!ch || node !== LESSON_NODE) return [{ kind: 'complete' }]

  const beats = chapterBeats(ch)
  if (beats.length === 0) return [{ kind: 'complete' }]

  const beatOf = beats.length
  const steps: MagangSessionStep[] = []

  for (let bi = 0; bi < beats.length; bi++) {
    const beat = beats[bi]!
    const beatNum = bi + 1

    if (beat.kind === 'check') {
      const choices = beat.choices ?? []
      const answer =
        typeof beat.answer === 'number' && beat.answer >= 0 && beat.answer < choices.length
          ? beat.answer
          : 0
      if (choices.length >= 2) {
        steps.push({
          kind: 'quiz',
          id: `check:${beat.id}`,
          beat,
          prompt: beat.prompt?.trim() || beat.titleEn || 'Choose the best answer',
          choices,
          answer,
          beatNum,
          beatOf,
        })
        continue
      }
    }

    steps.push({
      kind: 'idea',
      id: `idea:${beat.id}`,
      beat,
      beatNum,
      beatOf,
    })

    const terms = validTerms(beat)
    for (let ti = 0; ti < terms.length; ti++) {
      steps.push({
        kind: 'term',
        id: `term:${beat.id}:${ti}`,
        beat,
        term: terms[ti]!,
        termNum: ti + 1,
        termOf: terms.length,
        beatNum,
        beatOf,
      })
    }

    const mandarin = beat.mandarin?.trim() ?? ''
    if (mandarin) {
      steps.push({
        kind: 'say',
        id: `say:${beat.id}`,
        beat,
        mandarin,
        beatNum,
        beatOf,
      })
    }
  }

  steps.push({ kind: 'complete' })
  return steps
}

export function magangPlayableCount(steps: MagangSessionStep[]): number {
  return Math.max(1, steps.filter((s) => s.kind !== 'complete').length)
}

interface MagangPersisted {
  pathDone: Record<string, MagangNode[]>
}

const emptyProgress: MagangPersisted = { pathDone: {} }

function loadProgress(): MagangPersisted {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return emptyProgress
    const parsed = JSON.parse(raw) as Partial<{ pathDone: Record<string, unknown> }>
    if (!parsed?.pathDone || typeof parsed.pathDone !== 'object') return emptyProgress
    const pathDone: Record<string, MagangNode[]> = {}
    for (const [key, nodes] of Object.entries(parsed.pathDone)) {
      if (!Array.isArray(nodes)) continue
      pathDone[key] = nodes.filter((n): n is string => typeof n === 'string')
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

function writeProgress(next: MagangPersisted) {
  progressCache = next
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
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

/** Chapter done if `lesson` is marked, or legacy `wrap` is present. */
export function chapterHasLegacyOrLessonDone(doneNodes: MagangNode[] | undefined): boolean {
  const nodes = doneNodes ?? []
  return nodes.includes(LESSON_NODE) || nodes.includes('wrap')
}

export function useMagangProgress() {
  const state = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot)

  const isNodeDone = useCallback(
    (chapter: number, node: MagangNode) => {
      const done = state.pathDone[String(chapter)] ?? []
      if (node === LESSON_NODE) return chapterHasLegacyOrLessonDone(done)
      return done.includes(node)
    },
    [state.pathDone],
  )

  const markNodeDone = useCallback((chapter: number, node: MagangNode) => {
    const key = String(chapter)
    const prev = progressCache.pathDone[key] ?? []
    if (node === LESSON_NODE && chapterHasLegacyOrLessonDone(prev)) return
    if (prev.includes(node)) return
    writeProgress({
      pathDone: { ...progressCache.pathDone, [key]: [...prev, node] },
    })
  }, [])

  const nextPlayable = useMemo(() => {
    for (const ch of magangChapters) {
      if (!isNodeDone(ch.index, LESSON_NODE)) {
        return { chapter: ch.index, node: LESSON_NODE as MagangNode }
      }
    }
    const last = magangChapters[magangChapters.length - 1]
    return last
      ? { chapter: last.index, node: LESSON_NODE as MagangNode }
      : { chapter: 1, node: LESSON_NODE as MagangNode }
  }, [isNodeDone, state.pathDone])

  const isNodePlayable = useCallback(
    (chapter: number, node: MagangNode) => {
      const ch = getMagangChapter(chapter)
      if (!ch || node !== LESSON_NODE) return false
      if (isNodeDone(chapter, LESSON_NODE)) return true
      // Chapter 1 open; chapter N after N-1 done — nextPlayable walks in order.
      return nextPlayable.chapter === chapter && nextPlayable.node === LESSON_NODE
    },
    [isNodeDone, nextPlayable],
  )

  const isChapterReached = useCallback(
    (chapter: number) => {
      if (magangChapters.length === 0) return false
      const ch = getMagangChapter(chapter)
      if (!ch) return false
      return chapter <= nextPlayable.chapter || isNodeDone(chapter, LESSON_NODE)
    },
    [isNodeDone, nextPlayable.chapter],
  )

  return {
    pathDone: state.pathDone,
    isNodeDone,
    markNodeDone,
    nextPlayable,
    isNodePlayable,
    isChapterReached,
  }
}
