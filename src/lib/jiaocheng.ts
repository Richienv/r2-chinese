import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { registerVocab, type Example } from './content'
import type { TeachPhase, WordHook } from './teach'
import type { LessonText, TextLine, Vocab } from './types'
import type { PathNode } from '../store/store'
import type { Question } from './quiz'

/** Jiaocheng path progress — never written into `yulu.hsk4a.v1` or `yulu.kerja.v1`. */
const PROGRESS_KEY = 'yulu.jiaocheng.v1'

export const JIAOCHENG_BOOK = {
  title: '汉语教程 Level 2',
  titleZh: '汉语教程 · 第二册',
  edition: '第3版 · 上+下',
  blurb: 'Yang Jizhou · parts 1 & 2 as one path',
} as const

export interface JiaochengExample {
  zh: string
  pinyin: string
  en: string
}

export interface JiaochengWord {
  zh: string
  pinyin: string
  pos: string
  en: string
  note: string
  when: string
  usage: string
  example: JiaochengExample
}

export interface JiaochengDialogue {
  label: string
  headingZh: string
  headingEn: string
  type: 'dialogue' | 'passage'
  lines: TextLine[]
}

export interface JiaochengNote {
  title: string
  body: string
  example?: JiaochengExample | null
}

export interface JiaochengLesson {
  id: string
  book: '2-1' | '2-2'
  /** Sequential path position across both parts (1-based). */
  index: number
  bookLesson: number
  titleZh: string
  titleEn: string
  sourcePages: string
  words: JiaochengWord[]
  dialogues: JiaochengDialogue[]
  notes: JiaochengNote[]
}

/** Path beats for one lesson. t4/t5 unused so HSK PathNode typing still fits. */
export const JIAOCHENG_NODES: PathNode[] = ['t1', 't2', 't3', 'wrap']

export const JIAOCHENG_NODE_LABEL: Record<PathNode, { en: string; zh: string }> = {
  t1: { en: 'Words', zh: '生词' },
  t2: { en: 'Dialogue', zh: '对话' },
  t3: { en: 'Notes', zh: '笔记' },
  t4: { en: 'Extra', zh: '补充' },
  t5: { en: 'Extra', zh: '补充' },
  wrap: { en: 'Wrap-up', zh: '整理' },
}

type GlobModule = { default: RawLesson } | RawLesson

interface RawLesson {
  id?: string
  book?: string
  index?: number
  bookLesson?: number
  titleZh?: string
  titleEn?: string
  sourcePages?: string
  words?: JiaochengWord[]
  dialogues?: JiaochengDialogue[]
  notes?: JiaochengNote[]
}

const part1Modules = import.meta.glob('../data/jiaocheng/part1/lesson-*.json', {
  eager: true,
}) as Record<string, GlobModule>

const part2Modules = import.meta.glob('../data/jiaocheng/part2/lesson-*.json', {
  eager: true,
}) as Record<string, GlobModule>

function asRaw(mod: GlobModule): RawLesson | null {
  const raw = mod && typeof mod === 'object' && 'default' in mod ? mod.default : (mod as RawLesson)
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.index !== 'number' || !raw.id) return null
  return raw
}

function normalizeBook(book: string | undefined, fallback: '2-1' | '2-2'): '2-1' | '2-2' {
  if (book === '2-1' || book === '2-2') return book
  return fallback
}

function parsePart(modules: Record<string, GlobModule>, fallbackBook: '2-1' | '2-2'): RawLesson[] {
  return Object.values(modules)
    .map(asRaw)
    .filter((c): c is RawLesson => !!c)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((raw) => ({ ...raw, book: normalizeBook(raw.book, fallbackBook) }))
}

/** Part 2-1 first (by index), then part 2-2. Empty when no JSON yet. */
export const jiaochengLessons: JiaochengLesson[] = (() => {
  const combined = [...parsePart(part1Modules, '2-1'), ...parsePart(part2Modules, '2-2')]
  return combined.map((raw, i) => ({
    id: String(raw.id),
    book: normalizeBook(raw.book, '2-1'),
    index: i + 1,
    bookLesson: typeof raw.bookLesson === 'number' ? raw.bookLesson : (raw.index ?? i + 1),
    titleZh: raw.titleZh ?? '',
    titleEn: raw.titleEn ?? '',
    sourcePages: raw.sourcePages ?? '',
    words: Array.isArray(raw.words) ? raw.words : [],
    dialogues: Array.isArray(raw.dialogues) ? raw.dialogues : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
  }))
})()

export function getJiaochengLesson(index: number): JiaochengLesson | undefined {
  return jiaochengLessons.find((l) => l.index === index)
}

export function lessonHasContent(lesson: JiaochengLesson, node: PathNode): boolean {
  if (node === 't1') return lesson.words.length > 0
  if (node === 't2') return lesson.dialogues.length > 0
  if (node === 't3') return lesson.notes.length > 0
  if (node === 'wrap') return true
  return false
}

/** Nodes that appear on the path for this lesson (skips empty beats). */
export function nodesForLesson(lesson: JiaochengLesson): PathNode[] {
  const out: PathNode[] = []
  for (const node of JIAOCHENG_NODES) {
    if (node === 'wrap' || lessonHasContent(lesson, node)) out.push(node)
  }
  return out.length ? out : ['wrap']
}

export function toVocab(w: JiaochengWord): Vocab {
  return {
    zh: w.zh,
    pinyin: w.pinyin ?? '',
    pos: w.pos ?? '',
    en: w.en ?? '',
    note: w.note ?? '',
  }
}

export function toLessonText(d: JiaochengDialogue): LessonText {
  return {
    label: d.label || '对话',
    heading_zh: d.headingZh || '',
    heading_en: d.headingEn || '',
    type: d.type === 'passage' ? 'passage' : 'dialogue',
    lines: (d.lines ?? []).map((line) => ({
      speaker: line.speaker ?? '',
      zh: line.zh ?? '',
      pinyin: line.pinyin ?? '',
      en: line.en ?? '',
    })),
  }
}

export function wordExample(w: JiaochengWord): Example | null {
  if (!w.example?.zh?.trim()) return null
  return { zh: w.example.zh, pinyin: w.example.pinyin ?? '', en: w.example.en ?? '' }
}

export function noteExample(n: JiaochengNote): Example | null {
  if (!n.example?.zh?.trim()) return null
  return { zh: n.example.zh, pinyin: n.example.pinyin ?? '', en: n.example.en ?? '' }
}

export function jiaochengHook(w: JiaochengWord): WordHook {
  const when = w.when?.trim() || `Remember ${w.zh} when you need “${w.en || 'this meaning'}”.`
  const usage =
    w.usage?.trim() ||
    w.note?.trim() ||
    `Most Chinese speakers use ${w.zh} for “${w.en || 'this'}”.`
  return { when, usage }
}

export type JiaochengSessionStep =
  | {
      kind: 'teach'
      phase: TeachPhase
      id: string
      word: Vocab
      example: Example | null
      hook: WordHook
      n: number
      of: number
    }
  | { kind: 'read'; id: string; text: LessonText; n: number; of: number }
  | { kind: 'note'; id: string; title: string; body: string; example: Example | null; n: number; of: number }
  | { kind: 'quiz'; id: string; question: Question; n: number; of: number }
  | { kind: 'complete' }

function numberSteps(draft: Array<Exclude<JiaochengSessionStep, { kind: 'complete' }>>): JiaochengSessionStep[] {
  const wordOrder: string[] = []
  for (const s of draft) {
    if (s.kind === 'teach' && !wordOrder.includes(s.word.zh)) wordOrder.push(s.word.zh)
  }
  const counts = { read: 0, note: 0, quiz: 0 }
  const ofs = {
    read: draft.filter((s) => s.kind === 'read').length,
    note: draft.filter((s) => s.kind === 'note').length,
    quiz: draft.filter((s) => s.kind === 'quiz').length,
  }
  const steps: JiaochengSessionStep[] = draft.map((s) => {
    if (s.kind === 'teach') return { ...s, n: wordOrder.indexOf(s.word.zh) + 1, of: wordOrder.length }
    if (s.kind === 'read') return { ...s, n: ++counts.read, of: ofs.read }
    if (s.kind === 'note') return { ...s, n: ++counts.note, of: ofs.note }
    return { ...s, n: ++counts.quiz, of: ofs.quiz }
  })
  steps.push({ kind: 'complete' })
  return steps
}

function simpleVocabQuiz(words: JiaochengWord[], count: number): Question[] {
  const pool = words.filter((w) => w.zh && w.en && w.en.length < 48)
  if (pool.length < 2) return []
  const out: Question[] = []
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const answer = pool[i]
    const wrong = pool.filter((w) => w.zh !== answer.zh).slice(0, 3)
    while (wrong.length < 3) {
      const pad = pool[(i + wrong.length + 1) % pool.length]
      if (pad.zh !== answer.zh && !wrong.some((w) => w.zh === pad.zh)) wrong.push(pad)
      else break
    }
    const options = [answer, ...wrong]
      .slice(0, 4)
      .map((w) => ({ zh: w.zh, label: w.zh }))
    const rotated = [...options.slice(i % options.length), ...options.slice(0, i % options.length)]
    out.push({
      prompt: `Which word means “${answer.en}”?`,
      options: rotated,
      answer: answer.zh,
      explanation: `${answer.zh} · ${answer.en}`,
    })
  }
  return out
}

export function buildJiaochengSteps(lessonIndex: number, node: PathNode): JiaochengSessionStep[] {
  const lesson = getJiaochengLesson(lessonIndex)
  if (!lesson) return [{ kind: 'complete' }]

  const draft: Array<Exclude<JiaochengSessionStep, { kind: 'complete' }>> = []

  if (node === 't1') {
    for (const w of lesson.words) {
      const word = toVocab(w)
      const example = wordExample(w)
      const hook = jiaochengHook(w)
      const phases: TeachPhase[] = example ? ['meet', 'hook', 'example', 'seal'] : ['meet', 'hook', 'seal']
      for (const phase of phases) {
        draft.push({
          kind: 'teach',
          phase,
          id: `${phase}:t1:${w.zh}`,
          word,
          example,
          hook,
          n: 0,
          of: 0,
        })
      }
    }
  } else if (node === 't2') {
    for (const [i, d] of lesson.dialogues.entries()) {
      draft.push({
        kind: 'read',
        id: `read:t2:${d.label || i}`,
        text: toLessonText(d),
        n: 0,
        of: 0,
      })
    }
  } else if (node === 't3') {
    for (const [i, note] of lesson.notes.entries()) {
      draft.push({
        kind: 'note',
        id: `note:t3:${i}:${note.title}`,
        title: note.title || 'Note',
        body: note.body || '',
        example: noteExample(note),
        n: 0,
        of: 0,
      })
    }
  } else if (node === 'wrap') {
    for (const [i, q] of simpleVocabQuiz(lesson.words, 4).entries()) {
      draft.push({
        kind: 'quiz',
        id: `wrap:v:${i}:${q.answer}`,
        question: q,
        n: 0,
        of: 0,
      })
    }
    if (draft.length === 0) {
      draft.push({
        kind: 'note',
        id: 'wrap:done',
        title: lesson.titleZh || lesson.titleEn || `Lesson ${lesson.bookLesson}`,
        body: 'Lesson wrap-up. More checks appear once words are in this unit.',
        example: null,
        n: 0,
        of: 0,
      })
    }
  }

  if (draft.length === 0) return [{ kind: 'complete' }]
  return numberSteps(draft)
}

export function jiaochengPlayableCount(steps: JiaochengSessionStep[]): number {
  return Math.max(1, steps.filter((s) => s.kind !== 'complete').length)
}

export function jiaochengSittingWordCount(lessonIndex: number, node: PathNode): number {
  const lesson = getJiaochengLesson(lessonIndex)
  if (!lesson) return 0
  if (node === 't1' || node === 'wrap') return lesson.words.length
  return 0
}

export function nodeCaptionJiaocheng(
  lesson: JiaochengLesson,
  node: PathNode,
): { en: string; zh: string; hint: string } {
  const label = JIAOCHENG_NODE_LABEL[node]
  if (node === 't1') return { ...label, hint: lesson.words[0]?.zh || `${lesson.words.length} words` }
  if (node === 't2') return { ...label, hint: lesson.dialogues[0]?.headingZh || lesson.dialogues[0]?.label || '对话' }
  if (node === 't3') return { ...label, hint: lesson.notes[0]?.title || '笔记' }
  return { ...label, hint: 'Check' }
}

interface JiaochengPersisted {
  pathDone: Record<string, PathNode[]>
}

const emptyProgress: JiaochengPersisted = { pathDone: {} }

function loadProgress(): JiaochengPersisted {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return emptyProgress
    const parsed = JSON.parse(raw) as Partial<JiaochengPersisted>
    if (!parsed?.pathDone || typeof parsed.pathDone !== 'object') return emptyProgress
    return { pathDone: parsed.pathDone }
  } catch {
    return emptyProgress
  }
}

let progressCache = loadProgress()
const progressListeners = new Set<() => void>()

function emitProgress() {
  for (const l of progressListeners) l()
}

function writeProgress(next: JiaochengPersisted) {
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

export function useJiaochengProgress() {
  const state = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot)

  const isNodeDone = useCallback(
    (lesson: number, node: PathNode) => (state.pathDone[String(lesson)] ?? []).includes(node),
    [state.pathDone],
  )

  const markNodeDone = useCallback((lesson: number, node: PathNode) => {
    const key = String(lesson)
    const prev = progressCache.pathDone[key] ?? []
    if (prev.includes(node)) return
    writeProgress({
      pathDone: { ...progressCache.pathDone, [key]: [...prev, node] },
    })
  }, [])

  const nextPlayable = useMemo(() => {
    for (const lesson of jiaochengLessons) {
      for (const node of nodesForLesson(lesson)) {
        if (!isNodeDone(lesson.index, node)) return { lesson: lesson.index, node }
      }
    }
    const last = jiaochengLessons[jiaochengLessons.length - 1]
    return last ? { lesson: last.index, node: 'wrap' as PathNode } : { lesson: 1, node: 't1' as PathNode }
  }, [isNodeDone, state.pathDone])

  const isNodePlayable = useCallback(
    (lesson: number, node: PathNode) => {
      const unit = getJiaochengLesson(lesson)
      if (!unit || !nodesForLesson(unit).includes(node)) return false
      if (isNodeDone(lesson, node)) return true
      return nextPlayable.lesson === lesson && nextPlayable.node === node
    },
    [isNodeDone, nextPlayable],
  )

  const isLessonReached = useCallback(
    (lesson: number) => {
      if (jiaochengLessons.length === 0) return false
      return lesson <= nextPlayable.lesson || JIAOCHENG_NODES.some((n) => isNodeDone(lesson, n))
    },
    [isNodeDone, nextPlayable.lesson],
  )

  return {
    pathDone: state.pathDone,
    isNodeDone,
    markNodeDone,
    nextPlayable,
    isNodePlayable,
    isLessonReached,
  }
}

const HANZI = /[\u3400-\u9FFF]/

/** True when a note/example string should get a Hear control (Chinese only). */
export function hearableZh(text: string | undefined | null): string {
  const t = text?.trim() ?? ''
  return t && HANZI.test(t) ? t : ''
}

/** Seed the shared gloss/drill lexicon so 汉语教程 words star into the same list. */
for (const lesson of jiaochengLessons) {
  for (const w of lesson.words) {
    registerVocab(toVocab(w), wordExample(w))
  }
}
