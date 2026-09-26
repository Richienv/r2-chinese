import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { registerVocab, type Example } from './content'
import type { TeachPhase, WordHook } from './teach'
import type { LessonText, TextLine, Vocab } from './types'
import type { Question } from './quiz'

/** Kerja path progress — never written into `yulu.hsk4a.v1`. */
const PROGRESS_KEY = 'yulu.kerja.v1'

/** Words taught per path sitting (生词 chunk). */
export const WORDS_PER_SITTING = 4

export const KERJA_BOOK = {
  title: '1000 words',
  titleZh: '把话说清楚，把事情做好。',
  edition: 'Field edition 2026',
  blurb: 'Workplace Mandarin for HR and management',
} as const

export interface KerjaExample {
  zh: string
  pinyin: string
  en: string
}

export interface KerjaWord {
  zh: string
  pinyin: string
  pos: string
  en: string
  note: string
  when: string
  usage: string
  example: KerjaExample
}

export interface KerjaDialogue {
  label: string
  headingZh: string
  headingEn: string
  type: 'dialogue' | 'passage'
  lines: TextLine[]
}

export interface KerjaNote {
  title: string
  body: string
  example?: KerjaExample | null
}

export interface KerjaChapter {
  id: string
  index: number
  titleZh: string
  titleEn: string
  sourcePages: string
  words: KerjaWord[]
  dialogues: KerjaDialogue[]
  notes: KerjaNote[]
}

/** Local Kerja path ids — word chunks are `w0`, `w1`, … (not HSK PathNode). */
export type KerjaWordNode = `w${number}`
export type KerjaNode = KerjaWordNode | 't2' | 't3' | 'wrap'

const BEAT_LABEL: Record<'t2' | 't3' | 'wrap' | 't4' | 't5', { en: string; zh: string }> = {
  t2: { en: 'Dialogue', zh: '对话' },
  t3: { en: 'Notes', zh: '笔记' },
  t4: { en: 'Extra', zh: '补充' },
  t5: { en: 'Extra', zh: '补充' },
  wrap: { en: 'Wrap-up', zh: '整理' },
}

/** Labels for fixed beats (word chunks use dynamic 生词 N). */
export const KERJA_NODE_LABEL: Record<string, { en: string; zh: string }> = {
  t1: { en: 'Words', zh: '生词' },
  ...BEAT_LABEL,
}

export function isKerjaWordNode(node: string): node is KerjaWordNode {
  return /^w\d+$/.test(node)
}

export function wordChunkIndex(node: KerjaWordNode): number {
  return Number(node.slice(1))
}

export function wordChunksForChapter(ch: KerjaChapter): KerjaWordNode[] {
  const n = ch.words.length
  if (n <= 0) return []
  const count = Math.ceil(n / WORDS_PER_SITTING)
  return Array.from({ length: count }, (_, i) => `w${i}` as KerjaWordNode)
}

export function wordsForNode(ch: KerjaChapter, node: KerjaNode): KerjaWord[] {
  if (!isKerjaWordNode(node)) return []
  const start = wordChunkIndex(node) * WORDS_PER_SITTING
  return ch.words.slice(start, start + WORDS_PER_SITTING)
}

export function isKerjaNode(node: string): node is KerjaNode {
  return isKerjaWordNode(node) || node === 't2' || node === 't3' || node === 'wrap'
}

/** Coerce overlay/legacy ids onto a playable Kerja node. */
export function asKerjaNode(node: string): KerjaNode | null {
  if (isKerjaNode(node)) return node
  if (node === 't1') return 'w0'
  return null
}

type GlobModule = { default: KerjaChapter } | KerjaChapter

const chapterModules = import.meta.glob('../data/kerja/units/chapter-*.json', {
  eager: true,
}) as Record<string, GlobModule>

function asChapter(mod: GlobModule): KerjaChapter | null {
  const raw = mod && typeof mod === 'object' && 'default' in mod ? mod.default : (mod as KerjaChapter)
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.index !== 'number' || !raw.id) return null
  return {
    id: String(raw.id),
    index: raw.index,
    titleZh: raw.titleZh ?? '',
    titleEn: raw.titleEn ?? '',
    sourcePages: raw.sourcePages ?? '',
    words: Array.isArray(raw.words) ? raw.words : [],
    dialogues: Array.isArray(raw.dialogues) ? raw.dialogues : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
  }
}

/** Every `chapter-*.json` under units/, sorted by index. Empty when none exist yet. */
export const kerjaChapters: KerjaChapter[] = Object.values(chapterModules)
  .map(asChapter)
  .filter((c): c is KerjaChapter => !!c)
  .sort((a, b) => a.index - b.index)

export function getKerjaChapter(index: number): KerjaChapter | undefined {
  return kerjaChapters.find((c) => c.index === index)
}

export function chapterHasContent(ch: KerjaChapter, node: KerjaNode): boolean {
  if (isKerjaWordNode(node)) return wordsForNode(ch, node).length > 0
  if (node === 't2') return ch.dialogues.length > 0
  if (node === 't3') return ch.notes.length > 0
  if (node === 'wrap') return true
  return false
}

/** Nodes that appear on the path for this chapter (word chunks → dialogue → notes → wrap). */
export function nodesForChapter(ch: KerjaChapter): KerjaNode[] {
  const out: KerjaNode[] = [...wordChunksForChapter(ch)]
  if (ch.dialogues.length > 0) out.push('t2')
  if (ch.notes.length > 0) out.push('t3')
  out.push('wrap')
  return out
}

export function toVocab(w: KerjaWord): Vocab {
  return {
    zh: w.zh,
    pinyin: w.pinyin ?? '',
    pos: w.pos ?? '',
    en: w.en ?? '',
    note: w.note ?? '',
  }
}

export function toLessonText(d: KerjaDialogue): LessonText {
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

export function wordExample(w: KerjaWord): Example | null {
  if (!w.example?.zh?.trim()) return null
  return { zh: w.example.zh, pinyin: w.example.pinyin ?? '', en: w.example.en ?? '' }
}

export function noteExample(n: KerjaNote): Example | null {
  if (!n.example?.zh?.trim()) return null
  return { zh: n.example.zh, pinyin: n.example.pinyin ?? '', en: n.example.en ?? '' }
}

export function kerjaHook(w: KerjaWord): WordHook {
  const when = w.when?.trim() || `Remember ${w.zh} when you need “${w.en || 'this meaning'}”.`
  const usage =
    w.usage?.trim() ||
    w.note?.trim() ||
    `Most Chinese speakers use ${w.zh} in workplace talk for “${w.en || 'this'}”.`
  return { when, usage }
}

export type KerjaSessionStep =
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

function numberSteps(draft: Array<Exclude<KerjaSessionStep, { kind: 'complete' }>>): KerjaSessionStep[] {
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
  const steps: KerjaSessionStep[] = draft.map((s) => {
    if (s.kind === 'teach') return { ...s, n: wordOrder.indexOf(s.word.zh) + 1, of: wordOrder.length }
    if (s.kind === 'read') return { ...s, n: ++counts.read, of: ofs.read }
    if (s.kind === 'note') return { ...s, n: ++counts.note, of: ofs.note }
    return { ...s, n: ++counts.quiz, of: ofs.quiz }
  })
  steps.push({ kind: 'complete' })
  return steps
}

function simpleVocabQuiz(words: KerjaWord[], count: number): Question[] {
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
    // rotate so answer isn't always first
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

function pushTeachWords(
  draft: Array<Exclude<KerjaSessionStep, { kind: 'complete' }>>,
  words: KerjaWord[],
  nodeId: string,
) {
  for (const w of words) {
    const word = toVocab(w)
    const example = wordExample(w)
    const hook = kerjaHook(w)
    const phases: TeachPhase[] = example ? ['meet', 'hook', 'example', 'seal'] : ['meet', 'hook', 'seal']
    for (const phase of phases) {
      draft.push({
        kind: 'teach',
        phase,
        id: `${phase}:${nodeId}:${w.zh}`,
        word,
        example,
        hook,
        n: 0,
        of: 0,
      })
    }
  }
}

export function buildKerjaSteps(chapterIndex: number, node: KerjaNode): KerjaSessionStep[] {
  const ch = getKerjaChapter(chapterIndex)
  if (!ch) return [{ kind: 'complete' }]

  const draft: Array<Exclude<KerjaSessionStep, { kind: 'complete' }>> = []

  if (isKerjaWordNode(node)) {
    pushTeachWords(draft, wordsForNode(ch, node), node)
  } else if (node === 't2') {
    for (const [i, d] of ch.dialogues.entries()) {
      draft.push({
        kind: 'read',
        id: `read:t2:${d.label || i}`,
        text: toLessonText(d),
        n: 0,
        of: 0,
      })
    }
  } else if (node === 't3') {
    for (const [i, note] of ch.notes.entries()) {
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
    for (const [i, q] of simpleVocabQuiz(ch.words, 4).entries()) {
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
        title: ch.titleZh || ch.titleEn || `Chapter ${ch.index}`,
        body: 'Chapter wrap-up. More checks appear once words are in this unit.',
        example: null,
        n: 0,
        of: 0,
      })
    }
  }

  if (draft.length === 0) return [{ kind: 'complete' }]
  return numberSteps(draft)
}

export function kerjaPlayableCount(steps: KerjaSessionStep[]): number {
  return Math.max(1, steps.filter((s) => s.kind !== 'complete').length)
}

export function kerjaSittingWordCount(chapterIndex: number, node: KerjaNode): number {
  const ch = getKerjaChapter(chapterIndex)
  if (!ch) return 0
  if (isKerjaWordNode(node)) return wordsForNode(ch, node).length
  if (node === 'wrap') return ch.words.length
  return 0
}

export function nodeCaptionKerja(ch: KerjaChapter, node: KerjaNode): { en: string; zh: string; hint: string } {
  if (isKerjaWordNode(node)) {
    const slice = wordChunkIndex(node) + 1
    const words = wordsForNode(ch, node)
    return {
      en: `Words ${slice}`,
      zh: `生词 ${slice}`,
      hint: words[0]?.zh || `${words.length} words`,
    }
  }
  const label = BEAT_LABEL[node]
  if (node === 't2') return { ...label, hint: ch.dialogues[0]?.headingZh || ch.dialogues[0]?.label || '对话' }
  if (node === 't3') return { ...label, hint: ch.notes[0]?.title || '笔记' }
  return { ...label, hint: 'Check' }
}

export function nodeLabelKerja(node: KerjaNode): { en: string; zh: string } {
  if (isKerjaWordNode(node)) {
    const slice = wordChunkIndex(node) + 1
    return { en: `Words ${slice}`, zh: `生词 ${slice}` }
  }
  return BEAT_LABEL[node]
}

interface KerjaPersisted {
  pathDone: Record<string, KerjaNode[]>
}

const emptyProgress: KerjaPersisted = { pathDone: {} }

/**
 * Expand legacy `t1` (one big words level) into every word-chunk for that chapter
 * so finished chapters stay finished after the split.
 */
function migrateChapterNodes(chapterKey: string, rawNodes: unknown): KerjaNode[] {
  if (!Array.isArray(rawNodes)) return []
  const strings = rawNodes.filter((n): n is string => typeof n === 'string')
  const hadT1 = strings.includes('t1')
  const set = new Set<KerjaNode>()
  for (const n of strings) {
    if (n === 't1') continue
    if (isKerjaNode(n)) set.add(n)
  }
  if (hadT1) {
    const ch = getKerjaChapter(Number(chapterKey))
    if (ch) {
      for (const w of wordChunksForChapter(ch)) set.add(w)
    }
  }
  return [...set]
}

function loadProgress(): KerjaPersisted {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return emptyProgress
    const parsed = JSON.parse(raw) as Partial<{ pathDone: Record<string, unknown> }>
    if (!parsed?.pathDone || typeof parsed.pathDone !== 'object') return emptyProgress
    const pathDone: Record<string, KerjaNode[]> = {}
    for (const [key, nodes] of Object.entries(parsed.pathDone)) {
      pathDone[key] = migrateChapterNodes(key, nodes)
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

function writeProgress(next: KerjaPersisted) {
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

export function useKerjaProgress() {
  const state = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getProgressSnapshot)

  const isNodeDone = useCallback(
    (chapter: number, node: KerjaNode) => (state.pathDone[String(chapter)] ?? []).includes(node),
    [state.pathDone],
  )

  const markNodeDone = useCallback((chapter: number, node: KerjaNode) => {
    const key = String(chapter)
    const prev = progressCache.pathDone[key] ?? []
    if (prev.includes(node)) return
    writeProgress({
      pathDone: { ...progressCache.pathDone, [key]: [...prev, node] },
    })
  }, [])

  const nextPlayable = useMemo(() => {
    for (const ch of kerjaChapters) {
      for (const node of nodesForChapter(ch)) {
        if (!isNodeDone(ch.index, node)) return { chapter: ch.index, node }
      }
    }
    const last = kerjaChapters[kerjaChapters.length - 1]
    return last
      ? { chapter: last.index, node: 'wrap' as KerjaNode }
      : { chapter: 1, node: 'w0' as KerjaNode }
  }, [isNodeDone, state.pathDone])

  const isNodePlayable = useCallback(
    (chapter: number, node: KerjaNode) => {
      const ch = getKerjaChapter(chapter)
      if (!ch || !nodesForChapter(ch).includes(node)) return false
      if (isNodeDone(chapter, node)) return true
      return nextPlayable.chapter === chapter && nextPlayable.node === node
    },
    [isNodeDone, nextPlayable],
  )

  const isChapterReached = useCallback(
    (chapter: number) => {
      if (kerjaChapters.length === 0) return false
      const ch = getKerjaChapter(chapter)
      if (!ch) return false
      return (
        chapter <= nextPlayable.chapter || nodesForChapter(ch).some((n) => isNodeDone(chapter, n))
      )
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

const HANZI = /[\u3400-\u9FFF]/

/** True when a note/example string should get a Hear control (Chinese only). */
export function hearableZh(text: string | undefined | null): string {
  const t = text?.trim() ?? ''
  return t && HANZI.test(t) ? t : ''
}

/** Seed the shared gloss/drill lexicon so Kerja words star into the same list. */
for (const ch of kerjaChapters) {
  for (const w of ch.words) {
    registerVocab(toVocab(w), wordExample(w))
  }
}
