import { useCallback, useMemo, useSyncExternalStore } from 'react'

/** Interview path progress — never written into HSK / Kerja / Jiaocheng / Magang keys. */
const PROGRESS_KEY = 'yulu.interview.v1'

export const INTERVIEW_BOOK = {
  title: '总办',
  titleZh: '总办',
  blurb: 'Tonight · 18:00',
} as const

/** One playable path node per chapter. */
export const LESSON_NODE = 'lesson' as const

export type InterviewSittingKind =
  | 'idea'
  | 'remember'
  | 'watch'
  | 'try'
  | 'interview'
  | 'example'
  | 'check'

export interface InterviewTerm {
  zh: string
  en: string
  hook?: string
}

export interface InterviewSitting {
  id: string
  kind: InterviewSittingKind
  titleEn: string
  bodyEn: string
  sourceNote?: string
  mandarin?: string
  terms?: InterviewTerm[]
  prompt?: string
  choices?: string[]
  answer?: number
}

export type InterviewBeat = InterviewSitting

export interface InterviewChapter {
  id: string
  index: number
  part: number
  partTitleEn: string
  titleEn: string
  titleSource: string
  sourcePages: string
  when: string
  sittings: InterviewSitting[]
  beats?: InterviewBeat[]
}

export type InterviewNode = typeof LESSON_NODE | string

const SITTING_KINDS = new Set<InterviewSittingKind>([
  'idea',
  'remember',
  'watch',
  'try',
  'interview',
  'example',
  'check',
])

export const SITTING_KIND_LABEL: Record<InterviewSittingKind | 'wrap', string> = {
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

const chapterModules = import.meta.glob('../data/interview/ch-*.json', {
  eager: true,
}) as Record<string, GlobModule>

function asSitting(raw: unknown): InterviewSitting | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id.trim()) return null
  if (typeof o.kind !== 'string' || !SITTING_KINDS.has(o.kind as InterviewSittingKind)) return null
  if (typeof o.titleEn !== 'string') return null
  if (typeof o.bodyEn !== 'string') return null

  const sitting: InterviewSitting = {
    id: o.id.trim(),
    kind: o.kind as InterviewSittingKind,
    titleEn: o.titleEn,
    bodyEn: o.bodyEn,
  }
  if (typeof o.sourceNote === 'string') sitting.sourceNote = o.sourceNote
  if (typeof o.mandarin === 'string') sitting.mandarin = o.mandarin
  if (Array.isArray(o.terms)) {
    const terms: InterviewTerm[] = []
    for (const item of o.terms) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const t = item as Record<string, unknown>
      if (typeof t.zh !== 'string' || typeof t.en !== 'string') continue
      const term: InterviewTerm = { zh: t.zh, en: t.en }
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

function parseSittingList(raw: unknown): InterviewSitting[] {
  if (!Array.isArray(raw)) return []
  const out: InterviewSitting[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const s = asSitting(item)
    if (!s || seen.has(s.id)) continue
    seen.add(s.id)
    out.push(s)
  }
  return out
}

function asChapter(mod: GlobModule): InterviewChapter | null {
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

  const chapter: InterviewChapter = {
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

export const interviewChapters: InterviewChapter[] = Object.values(chapterModules)
  .map(asChapter)
  .filter((c): c is InterviewChapter => !!c)
  .sort((a, b) => a.index - b.index)

export function getInterviewChapter(index: number): InterviewChapter | undefined {
  return interviewChapters.find((c) => c.index === index)
}

export function chapterBeats(ch: InterviewChapter): InterviewBeat[] {
  if (ch.beats && ch.beats.length > 0) return ch.beats
  return ch.sittings
}

export function nodesForChapter(_ch: InterviewChapter): InterviewNode[] {
  return [LESSON_NODE]
}

export function interviewParts(): {
  part: number
  titleEn: string
  chapters: InterviewChapter[]
}[] {
  const map = new Map<number, { part: number; titleEn: string; chapters: InterviewChapter[] }>()
  for (const ch of interviewChapters) {
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

export function nodeLabelInterview(ch: InterviewChapter, _node: InterviewNode): string {
  return ch.titleEn || ch.titleSource || `Chapter ${ch.index}`
}

export type InterviewSessionStep =
  | {
      kind: 'idea'
      id: string
      beat: InterviewBeat
      beatNum: number
      beatOf: number
    }
  | {
      kind: 'term'
      id: string
      beat: InterviewBeat
      term: InterviewTerm
      termNum: number
      termOf: number
      beatNum: number
      beatOf: number
    }
  | {
      kind: 'say'
      id: string
      beat: InterviewBeat
      mandarin: string
      beatNum: number
      beatOf: number
    }
  | {
      kind: 'quiz'
      id: string
      beat: InterviewBeat
      prompt: string
      choices: string[]
      answer: number
      beatNum: number
      beatOf: number
    }
  | { kind: 'complete' }

function validTerms(beat: InterviewBeat): InterviewTerm[] {
  return beat.terms?.filter((t) => t.zh.trim() && t.en.trim()) ?? []
}

export function buildInterviewSteps(chapterIndex: number, node: InterviewNode): InterviewSessionStep[] {
  const ch = getInterviewChapter(chapterIndex)
  if (!ch || node !== LESSON_NODE) return [{ kind: 'complete' }]

  const beats = chapterBeats(ch)
  if (beats.length === 0) return [{ kind: 'complete' }]

  const beatOf = beats.length
  const steps: InterviewSessionStep[] = []

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

export function interviewPlayableCount(steps: InterviewSessionStep[]): number {
  return Math.max(1, steps.filter((s) => s.kind !== 'complete').length)
}

interface InterviewPersisted {
  pathDone: Record<string, InterviewNode[]>
}

const emptyProgress: InterviewPersisted = { pathDone: {} }

function loadProgress(): InterviewPersisted {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return emptyProgress
    const parsed = JSON.parse(raw) as Partial<{ pathDone: Record<string, unknown> }>
    if (!parsed?.pathDone || typeof parsed.pathDone !== 'object') return emptyProgress
    const pathDone: Record<string, InterviewNode[]> = {}
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

function writeProgress(next: InterviewPersisted) {
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

export function useInterviewProgress() {
  const state = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot)

  const isNodeDone = useCallback(
    (chapter: number, node: InterviewNode) => {
      const done = state.pathDone[String(chapter)] ?? []
      return done.includes(node)
    },
    [state.pathDone],
  )

  const markNodeDone = useCallback((chapter: number, node: InterviewNode) => {
    const key = String(chapter)
    const prev = progressCache.pathDone[key] ?? []
    if (prev.includes(node)) return
    writeProgress({
      pathDone: { ...progressCache.pathDone, [key]: [...prev, node] },
    })
  }, [])

  const nextPlayable = useMemo(() => {
    for (const ch of interviewChapters) {
      if (!isNodeDone(ch.index, LESSON_NODE)) {
        return { chapter: ch.index, node: LESSON_NODE as InterviewNode }
      }
    }
    const last = interviewChapters[interviewChapters.length - 1]
    return last
      ? { chapter: last.index, node: LESSON_NODE as InterviewNode }
      : { chapter: 1, node: LESSON_NODE as InterviewNode }
  }, [isNodeDone, state.pathDone])

  const isNodePlayable = useCallback(
    (chapter: number, node: InterviewNode) => {
      const ch = getInterviewChapter(chapter)
      if (!ch || node !== LESSON_NODE) return false
      if (isNodeDone(chapter, LESSON_NODE)) return true
      return nextPlayable.chapter === chapter && nextPlayable.node === LESSON_NODE
    },
    [isNodeDone, nextPlayable],
  )

  const isChapterReached = useCallback(
    (chapter: number) => {
      if (interviewChapters.length === 0) return false
      const ch = getInterviewChapter(chapter)
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
