import type { ExerciseStep } from './exercises'
import { buildRecheck } from './dialogue-check'
import { applyOverlay, type Overlay } from './localize'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { isValidChineseExample, registerExamples, registerVocab, type Example } from './content'
import { getLang, t } from './i18n.ts'
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
  blurb: t('Yang Jizhou · parts 1 & 2 as one path'),
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
  t1: { en: t('Words'), zh: '生词' },
  t2: { en: t('Dialogue'), zh: '对话' },
  t3: { en: t('Notes'), zh: '笔记' },
  t4: { en: t('Extra'), zh: '补充' },
  t5: { en: t('Extra'), zh: '补充' },
  wrap: { en: t('Wrap-up'), zh: '整理' },
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

// Indonesian meanings, translations and notes, applied once when the lessons load.
if (getLang() === 'id') {
  const overlays = import.meta.glob('../data/i18n/id/jiaocheng-part*-lesson-*.json', { eager: true }) as Record<string, { default: Overlay }>
  for (const part of ['part1', 'part2'] as const) {
    for (const [path, mod] of Object.entries(part === 'part1' ? part1Modules : part2Modules)) {
      const overlay = overlays[path.replace(`../data/jiaocheng/${part}/`, `../data/i18n/id/jiaocheng-${part}-`)]
      if (overlay) applyOverlay('default' in mod ? mod.default : mod, overlay.default)
    }
  }
}

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
    when: w.when ?? '',
    usage: w.usage ?? '',
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
  if (!isValidChineseExample(w.example)) return null
  return { zh: w.example.zh, pinyin: w.example.pinyin ?? '', en: w.example.en ?? '' }
}

export function noteExample(n: JiaochengNote): Example | null {
  if (!n.example?.zh?.trim()) return null
  return { zh: n.example.zh, pinyin: n.example.pinyin ?? '', en: n.example.en ?? '' }
}

export function jiaochengHook(w: JiaochengWord): WordHook {
  const when = w.when?.trim() || t('Remember {word} when you need “{meaning}”.', { word: w.zh, meaning: w.en || t('this meaning') })
  const usage =
    w.usage?.trim() ||
    w.note?.trim() ||
    t('Most Chinese speakers use {word} for “{meaning}”.', { word: w.zh, meaning: w.en || t('this') })
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
  | { kind: 'recall'; id: string; word: Vocab; n: number; of: number }
  | { kind: 'dialogue'; id: string; text: LessonText; n: number; of: number }
  | { kind: 'recheck'; id: string; text: LessonText; words: Vocab[]; n: number; of: number }
  | { kind: 'produce'; id: string; example: Example; words: string[]; grammar?: string; n: number; of: number }
  | { kind: 'note'; id: string; title: string; body: string; example: Example | null; n: number; of: number }
  | { kind: 'quiz'; id: string; question: Question; n: number; of: number }
  | ExerciseStep
  | { kind: 'complete' }

function numberSteps(draft: Array<Exclude<JiaochengSessionStep, { kind: 'complete' }>>): JiaochengSessionStep[] {
  const wordOrder: string[] = []
  for (const s of draft) {
    if (s.kind === 'teach' && !wordOrder.includes(s.word.zh)) wordOrder.push(s.word.zh)
  }
  const counts = { read: 0, note: 0, quiz: 0, recall: 0, dialogue: 0, recheck: 0, produce: 0, exercise: 0 }
  const ofs = {
    read: draft.filter((s) => s.kind === 'read').length,
    note: draft.filter((s) => s.kind === 'note').length,
    quiz: draft.filter((s) => s.kind === 'quiz').length,
    recall: draft.filter((s) => s.kind === 'recall').length,
    dialogue: draft.filter((s) => s.kind === 'dialogue').length,
    recheck: draft.filter((s) => s.kind === 'recheck').length,
    produce: draft.filter((s) => s.kind === 'produce').length,
    exercise: draft.filter((s) => s.kind === 'exercise').length,
  }
  const steps: JiaochengSessionStep[] = draft.map((s) => {
    if (s.kind === 'teach') return { ...s, n: wordOrder.indexOf(s.word.zh) + 1, of: wordOrder.length }
    return { ...s, n: ++counts[s.kind], of: ofs[s.kind] }
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
      prompt: t('Which word means “{meaning}”?', { meaning: answer.en }),
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
    // Eight words, then those eight are retrieved, then the next eight. A 40-word
    // list is no longer one sitting that only practises the first handful.
    const CHUNK = 8
    for (let start = 0; start < lesson.words.length; start += CHUNK) {
      const slice = lesson.words.slice(start, start + CHUNK)
      for (const w of slice) {
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
      for (const w of slice.filter((w) => w.zh.trim() && w.en.trim())) {
        draft.push({ kind: 'recall', id: `recall:t1:${w.zh}`, word: toVocab(w), n: 0, of: 0 })
      }
    }
    const sourceDialogue = lesson.dialogues.find((d) => lesson.words.some((w) => d.lines.some((line) => line.zh.includes(w.zh))))
    if (sourceDialogue) draft.push({ kind: 'read', id: `read:t1:${sourceDialogue.label}`, text: toLessonText(sourceDialogue), n: 0, of: 0 })
    const example = lesson.words.map(wordExample).find((e) => e?.zh.trim() && e.en.trim())
    if (example) draft.push({ kind: 'produce', id: 'produce:t1', example, words: lesson.words.filter((w) => example.zh.includes(w.zh)).map((w) => w.zh), n: 0, of: 0 })
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
    const texts = lesson.dialogues.map(toLessonText)
    for (const w of lesson.words.filter((w) => w.en.trim() && texts.some((text) => text.lines.some((line) => line.zh.includes(w.zh))))) {
      draft.push({ kind: 'recall', id: `recall:t2:${w.zh}`, word: toVocab(w), n: 0, of: 0 })
    }
    for (const [index, text] of texts.entries()) {
      if (text.type === 'dialogue' && text.lines.length > 1 && text.lines.every((line) => !line.zh.trim() || line.en.trim())) {
        draft.push({ kind: 'dialogue', id: `dialogue:t2:${index}`, text, n: 0, of: 0 })
        const used = lesson.words.filter((w) => text.lines.some((line) => line.zh.includes(w.zh))).map(toVocab)
        if (buildRecheck(text, used).length >= 2) draft.push({ kind: 'recheck', id: `recheck:t2:${index}`, text, words: used, n: 0, of: 0 })
      } else {
        const line = text.lines.find((line) => line.zh.length >= 4 && line.zh.length <= 75 && line.en.trim())
        if (line) draft.push({ kind: 'produce', id: `produce:t2:${index}`, example: line, words: lesson.words.filter((w) => line.zh.includes(w.zh)).map((w) => w.zh), n: 0, of: 0 })
      }
    }
  } else if (node === 't3') {
    for (const [i, note] of lesson.notes.entries()) {
      draft.push({
        kind: 'note',
        id: `note:t3:${i}:${note.title}`,
        title: note.title || t('Note'),
        body: note.body || '',
        example: noteExample(note),
        n: 0,
        of: 0,
      })
    }
    for (const [index, note] of lesson.notes.entries()) {
      const example = noteExample(note)
      if (!example?.en.trim()) continue
      draft.push({ kind: 'produce', id: `produce:t3:${index}`, example, words: lesson.words.filter((w) => example.zh.includes(w.zh)).map((w) => w.zh), grammar: `${note.title}: ${note.body}`, n: 0, of: 0 })
      if (draft.filter((step) => step.kind === 'produce').length >= 2) break
    }
  } else if (node === 'wrap') {
    for (const w of lesson.words.filter((w) => w.zh.trim() && w.en.trim())) {
      draft.push({ kind: 'recall', id: `wrap:recall:${w.zh}`, word: toVocab(w), n: 0, of: 0 })
    }
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
        title: lesson.titleZh || lesson.titleEn || t('Lesson {n}', { n: lesson.bookLesson }),
        body: t('Lesson wrap-up. More checks appear once words are in this unit.'),
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
  if (node === 't1') return { ...label, hint: lesson.words[0]?.zh || t('{n} words', { n: lesson.words.length }) }
  if (node === 't2') return { ...label, hint: lesson.dialogues[0]?.headingZh || lesson.dialogues[0]?.label || '对话' }
  if (node === 't3') return { ...label, hint: lesson.notes[0]?.title || '笔记' }
  return { ...label, hint: t('Check') }
}

export interface JiaochengPersisted {
  pathDone: Record<string, PathNode[]>
  skippedLessons: number[]
  unlockedLesson?: number
}

const emptyProgress: JiaochengPersisted = { pathDone: {}, skippedLessons: [] }

function loadProgress(): JiaochengPersisted {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return emptyProgress
    const parsed = JSON.parse(raw) as Partial<JiaochengPersisted>
    const pathDone = parsed?.pathDone && typeof parsed.pathDone === 'object' && !Array.isArray(parsed.pathDone)
      ? parsed.pathDone
      : {}
    const skippedLessons = Array.isArray(parsed?.skippedLessons)
      ? [...new Set(parsed.skippedLessons.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))]
      : []
    const unlockedLesson =
      typeof parsed?.unlockedLesson === 'number' && Number.isFinite(parsed.unlockedLesson) && parsed.unlockedLesson >= 1
        ? parsed.unlockedLesson
        : undefined
    return { pathDone, skippedLessons, ...(unlockedLesson ? { unlockedLesson } : {}) }
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
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('yulu:local-progress'))
}

if (typeof window !== 'undefined') {
  window.addEventListener('yulu:cloud-hydrated', () => {
    progressCache = loadProgress()
    emitProgress()
  })
}

function subscribeProgress(cb: () => void) {
  progressListeners.add(cb)
  return () => progressListeners.delete(cb)
}

function getProgressSnapshot() {
  return progressCache
}

export function isJiaochengLessonComplete(state: JiaochengPersisted, lessonIndex: number): boolean {
  const unit = getJiaochengLesson(lessonIndex)
  if (!unit) return false
  const doneNodes = state.pathDone[String(lessonIndex)] ?? []
  return nodesForLesson(unit).every((n) => doneNodes.includes(n))
}

export function isJiaochengLessonSkipped(state: JiaochengPersisted, lessonIndex: number): boolean {
  return state.skippedLessons.includes(lessonIndex) && !isJiaochengLessonComplete(state, lessonIndex)
}

export function computeJiaochengNextPlayable(state: JiaochengPersisted): { lesson: number; node: PathNode } {
  for (const lesson of jiaochengLessons) {
    if (isJiaochengLessonSkipped(state, lesson.index)) continue
    const doneNodes = state.pathDone[String(lesson.index)] ?? []
    for (const node of nodesForLesson(lesson)) {
      if (!doneNodes.includes(node)) return { lesson: lesson.index, node }
    }
  }
  const last = jiaochengLessons[jiaochengLessons.length - 1]
  return last ? { lesson: last.index, node: 'wrap' as PathNode } : { lesson: 1, node: 't1' as PathNode }
}

export function isJiaochengNodePlayable(state: JiaochengPersisted, lessonIndex: number, node: PathNode): boolean {
  const unit = getJiaochengLesson(lessonIndex)
  if (!unit) return false
  const nodes = nodesForLesson(unit)
  if (!nodes.includes(node)) return false
  const doneNodes = state.pathDone[String(lessonIndex)] ?? []
  if (doneNodes.includes(node)) return true
  if (isJiaochengLessonSkipped(state, lessonIndex)) return true
  if (state.unlockedLesson && lessonIndex === state.unlockedLesson) {
    const firstOpen = nodes.find((n) => !doneNodes.includes(n))
    if (firstOpen === node) return true
  }
  const next = computeJiaochengNextPlayable(state)
  return next.lesson === lessonIndex && next.node === node
}

export function isJiaochengLessonReached(state: JiaochengPersisted, lessonIndex: number): boolean {
  if (jiaochengLessons.length === 0) return false
  const next = computeJiaochengNextPlayable(state)
  const highest = Math.max(next.lesson, state.unlockedLesson ?? 1)
  if (lessonIndex <= highest || isJiaochengLessonSkipped(state, lessonIndex)) return true
  const doneNodes = state.pathDone[String(lessonIndex)] ?? []
  return doneNodes.length > 0
}

export interface JiaochengSkipSpec {
  course: 'jiaocheng'
  lesson: number
  title: string
  words: { zh: string }[]
  grammarPoints: string[]
}

export function applyJiaochengSkip(
  state: JiaochengPersisted,
  targetLesson: number,
): { nextState: JiaochengPersisted; skippedSpecs: JiaochengSkipSpec[] } {
  const skippedSpecs: JiaochengSkipSpec[] = []
  const nextSkipped = new Set(state.skippedLessons)
  for (const lesson of jiaochengLessons) {
    if (lesson.index >= targetLesson) continue
    if (isJiaochengLessonComplete(state, lesson.index)) continue
    nextSkipped.add(lesson.index)
    skippedSpecs.push({
      course: 'jiaocheng',
      lesson: lesson.index,
      title: lesson.titleEn || lesson.titleZh || `Lesson ${lesson.index}`,
      words: lesson.words.filter((w) => w.zh.trim() && w.en.trim()).map((w) => ({ zh: w.zh })),
      grammarPoints: lesson.notes.map((n) => n.title).filter(Boolean),
    })
  }
  const nextState: JiaochengPersisted = {
    pathDone: state.pathDone,
    skippedLessons: [...nextSkipped].sort((a, b) => a - b),
    unlockedLesson: Math.max(state.unlockedLesson ?? 1, targetLesson),
  }
  return { nextState, skippedSpecs }
}

export function applyJiaochengUnskip(state: JiaochengPersisted, lessonIndex: number): JiaochengPersisted {
  return {
    ...state,
    skippedLessons: state.skippedLessons.filter((n) => n !== lessonIndex),
  }
}

export function useJiaochengProgress() {
  const state = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot)

  const isNodeDone = useCallback(
    (lesson: number, node: PathNode) => (state.pathDone[String(lesson)] ?? []).includes(node),
    [state.pathDone],
  )

  const isLessonSkipped = useCallback(
    (lesson: number) => isJiaochengLessonSkipped(state, lesson),
    [state],
  )

  const markNodeDone = useCallback((lesson: number, node: PathNode) => {
    const key = String(lesson)
    const prev = progressCache.pathDone[key] ?? []
    if (prev.includes(node)) return
    const nextPathDone = { ...progressCache.pathDone, [key]: [...prev, node] }
    const nextState: JiaochengPersisted = {
      ...progressCache,
      pathDone: nextPathDone,
    }
    if (isJiaochengLessonComplete(nextState, lesson)) {
      nextState.skippedLessons = nextState.skippedLessons.filter((n) => n !== lesson)
    }
    writeProgress(nextState)
  }, [])

  const skipToLesson = useCallback((targetLesson: number): JiaochengSkipSpec[] => {
    const { nextState, skippedSpecs } = applyJiaochengSkip(progressCache, targetLesson)
    writeProgress(nextState)
    return skippedSpecs
  }, [])

  const unskipLesson = useCallback((lesson: number) => {
    writeProgress(applyJiaochengUnskip(progressCache, lesson))
  }, [])

  const nextPlayable = useMemo(() => computeJiaochengNextPlayable(state), [state])

  const isNodePlayable = useCallback(
    (lesson: number, node: PathNode) => isJiaochengNodePlayable(state, lesson, node),
    [state],
  )

  const isLessonReached = useCallback(
    (lesson: number) => isJiaochengLessonReached(state, lesson),
    [state],
  )

  return {
    pathDone: state.pathDone,
    skippedLessons: state.skippedLessons,
    unlockedLesson: state.unlockedLesson ?? 1,
    isNodeDone,
    isLessonSkipped,
    markNodeDone,
    skipToLesson,
    unskipLesson,
    nextPlayable,
    isNodePlayable,
    isLessonReached,
  }
}

const HANZI = /[\u3400-\u9FFF]/

/** True when a note/example string should get a Hear control (Chinese only). */
export function hearableZh(text: string | undefined | null): string {
  const trimmed = text?.trim() ?? ''
  return trimmed && HANZI.test(trimmed) ? trimmed : ''
}

/** Seed the shared gloss/drill lexicon so 汉语教程 words star into the same list. */
for (const lesson of jiaochengLessons) {
  for (const w of lesson.words) {
    registerVocab(toVocab(w), wordExample(w))
  }
  for (const d of lesson.dialogues) registerExamples(d.lines)
  for (const n of lesson.notes) if (n.example) registerExamples([n.example])
}
