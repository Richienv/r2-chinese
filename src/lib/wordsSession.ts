import {
  exampleFor,
  getLesson,
  lessons,
  sameCharWords,
  sittingHint,
  teachableVocab,
  textNodeIndex,
  textSitting,
  TEXT_NODES,
  type Example,
} from './content'
import { buildRecheck } from './dialogue-check'
import { clozeQuestion, sentenceQuestions, vocabQuestions, type Question } from './quiz'
import { wordHook, type TeachPhase, type WordHook } from './teach'
import type { LessonText, Vocab } from './types'
import type { PathNode } from '../store/store'

export const SESSION_HEARTS = 3
export const ITEM_XP = 10
export const NODE_BONUS_XP = 15
export const PATH_NODES: PathNode[] = [...TEXT_NODES, 'wrap']

export type SessionStep =
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
  | { kind: 'note'; id: string; title: string; body: string; example: Example | null; kicker?: string; n: number; of: number }
  | { kind: 'quiz'; id: string; question: Question; example: Example | null; n: number; of: number }
  | { kind: 'complete' }

export const TEACH_GLOSS = { showPinyin: true, showEnglish: true } as const

export function sessionExample(zh: string, lesson?: number): Example | null {
  return exampleFor(zh, lesson)
}

export function teachVocab(lesson: number): Vocab[] {
  return teachableVocab(getLesson(lesson))
}

export function isSessionOpen(lesson: number, node: PathNode): boolean {
  return lessons.some((l) => l.lesson === lesson) && PATH_NODES.includes(node)
}

export function nextPlayable(isDone: (lesson: number, node: PathNode) => boolean): {
  lesson: number
  node: PathNode
} {
  for (const l of lessons) {
    for (const node of PATH_NODES) {
      if (!isDone(l.lesson, node)) return { lesson: l.lesson, node }
    }
  }
  return { lesson: lessons[lessons.length - 1].lesson, node: 'wrap' }
}

/** Current sitting or a finished one (replay). Locked-ahead nodes stay closed. */
export function isNodePlayable(
  lesson: number,
  node: PathNode,
  isDone: (lesson: number, node: PathNode) => boolean,
): boolean {
  if (!isSessionOpen(lesson, node)) return false
  if (isDone(lesson, node)) return true
  const next = nextPlayable(isDone)
  return next.lesson === lesson && next.node === node
}

/** Textbook overlay is only for a lesson the learner has reached. */
export function isLessonReached(
  lesson: number,
  isDone: (lesson: number, node: PathNode) => boolean,
): boolean {
  const next = nextPlayable(isDone)
  return lesson <= next.lesson || PATH_NODES.some((n) => isDone(lesson, n))
}

export const NODE_LABEL: Record<PathNode, { en: string; zh: string }> = {
  t1: { en: 'Text 1', zh: '课文1' },
  t2: { en: 'Text 2', zh: '课文2' },
  t3: { en: 'Text 3', zh: '课文3' },
  t4: { en: 'Text 4', zh: '课文4' },
  t5: { en: 'Text 5', zh: '课文5' },
  wrap: { en: 'Wrap-up', zh: '整理' },
}

/** Path chip: 课文 N + first new word, or 整理. */
export function nodeCaption(lesson: number, node: PathNode): { en: string; zh: string; hint: string } {
  const label = NODE_LABEL[node]
  if (node === 'wrap') return { ...label, hint: '比一比' }
  const hint = sittingHint(getLesson(lesson), textNodeIndex(node))
  return { ...label, hint }
}

function numberSteps(draft: Array<Exclude<SessionStep, { kind: 'complete' }>>): SessionStep[] {
  const words = [...new Set(draft.filter((s) => s.kind === 'teach').map((s) => s.word.zh))]
  const counts = { read: 0, note: 0, quiz: 0, recall: 0, dialogue: 0, recheck: 0, produce: 0 }
  const ofs = {
    read: draft.filter((s) => s.kind === 'read').length,
    note: draft.filter((s) => s.kind === 'note').length,
    quiz: draft.filter((s) => s.kind === 'quiz').length,
    recall: draft.filter((s) => s.kind === 'recall').length,
    dialogue: draft.filter((s) => s.kind === 'dialogue').length,
    recheck: draft.filter((s) => s.kind === 'recheck').length,
    produce: draft.filter((s) => s.kind === 'produce').length,
  }
  const steps: SessionStep[] = draft.map((s) => {
    if (s.kind === 'teach') return { ...s, n: words.indexOf(s.word.zh) + 1, of: words.length }
    return { ...s, n: ++counts[s.kind], of: ofs[s.kind] }
  })
  steps.push({ kind: 'complete' })
  return steps
}

function buildTextSteps(lesson: number, node: Exclude<PathNode, 'wrap'>): SessionStep[] {
  const bookLesson = getLesson(lesson)
  const sitting = textSitting(bookLesson, textNodeIndex(node))
  if (!sitting) return [{ kind: 'complete' }]

  const draft: Array<Exclude<SessionStep, { kind: 'complete' }>> = []
  const seenExamples = new Set<string>()

  for (const word of sitting.words) {
    const example = sessionExample(word.zh, lesson)
    const hook = wordHook(word, example, lesson)
    // A source line can introduce several words. Hear it once as a standalone
    // example; the full script and later retrieval still revisit it in context.
    const freshExample = example && !seenExamples.has(example.zh)
    if (example) seenExamples.add(example.zh)
    const phases: TeachPhase[] = freshExample
      ? ['meet', 'hook', 'example', 'seal']
      : ['meet', 'hook', 'seal']
    for (const phase of phases) {
      draft.push({
        kind: 'teach',
        phase,
        id: `${phase}:${node}:${word.zh}`,
        word,
        example,
        hook,
        n: 0,
        of: 0,
      })
    }
  }

  draft.push({
    kind: 'read',
    id: `read:${node}:${sitting.text.label}`,
    text: sitting.text,
    n: 0,
    of: 0,
  })

  // Retrieve after the reading interval, rather than immediately copying the word.
  for (const word of sitting.words) {
    draft.push({ kind: 'recall', id: `recall:${node}:${word.zh}`, word, n: 0, of: 0 })
  }

  if (sitting.text.type === 'dialogue' && sitting.text.lines.length > 1) {
    draft.push({ kind: 'dialogue', id: `speak:${node}`, text: sitting.text, n: 0, of: 0 })
    const used = sitting.words.filter((word) => sitting.text.lines.some((line) => line.zh.includes(word.zh)))
    if (buildRecheck(sitting.text, used).length >= 2) draft.push({ kind: 'recheck', id: `recheck:${node}`, text: sitting.text, words: used, n: 0, of: 0 })
  }

  const checks = sentenceQuestions(bookLesson, 3, sitting.text.lines)
  for (const [i, q] of checks.entries()) {
    draft.push({
      kind: 'quiz',
      id: `line:${node}:${i}`,
      question: q,
      example: q.context ?? null,
      n: 0,
      of: 0,
    })
  }

  const g = sitting.grammar
  if (g) {
    draft.push({
      kind: 'note',
      id: `gram:${node}:${g.point}`,
      title: g.point,
      body: g.explanation,
      example: g.examples[0] ?? null,
      kicker: 'Grammar',
      n: 0,
      of: 0,
    })
    const cloze = clozeQuestion(bookLesson, g)
    if (cloze) {
      draft.push({
        kind: 'quiz',
        id: `cloze:${node}`,
        question: cloze,
        example: cloze.context ?? null,
        n: 0,
        of: 0,
      })
    }
  }

  const productionExample = g?.examples.find((e) => e.zh.trim() && e.en.trim())
    ?? sitting.text.lines.find((line) => line.zh.length >= 4 && line.zh.length <= 75 && line.en.trim())
  if (productionExample) {
    draft.push({
      kind: 'produce', id: `produce:${node}`, example: productionExample,
      words: sitting.words.filter((w) => productionExample.zh.includes(w.zh)).map((w) => w.zh),
      grammar: g ? `${g.point}: ${g.explanation}` : undefined, n: 0, of: 0,
    })
  }

  return numberSteps(draft)
}

function buildWrapSteps(lesson: number): SessionStep[] {
  const bookLesson = getLesson(lesson)
  const draft: Array<Exclude<SessionStep, { kind: 'complete' }>> = []

  for (const [i, pair] of bookLesson.extras.compare.entries()) {
    draft.push({
      kind: 'note',
      id: `cmp:${i}:${pair.a}`,
      title: `${pair.a} / ${pair.b}`,
      body: pair.note,
      example: sessionExample(pair.a, lesson) ?? sessionExample(pair.b, lesson),
      kicker: '比一比',
      n: 0,
      of: 0,
    })
  }

  const same = bookLesson.extras.same_char[0]
  if (same) {
    const words = sameCharWords(bookLesson)
    const names = words.map((w) => w.zh).join('、')
    draft.push({
      kind: 'note',
      id: `same:${same.char}`,
      title: `同字词 · ${same.char}`,
      body: names ? `${same.char}：${names}` : `${same.char} family`,
      example: same.examples[0] ?? null,
      kicker: '同字词',
      n: 0,
      of: 0,
    })
  }

  for (const [i, note] of bookLesson.extras.culture.entries()) {
    draft.push({
      kind: 'note',
      id: `culture:${i}`,
      title: note.title_zh || note.title_en,
      body: note.summary,
      example: null,
      kicker: '文化',
      n: 0,
      of: 0,
    })
  }

  const words = teachableVocab(bookLesson)
  for (const word of words) {
    draft.push({ kind: 'recall', id: `wrap:recall:${word.zh}`, word, n: 0, of: 0 })
  }
  for (const [i, q] of vocabQuestions(bookLesson, 4, words).entries()) {
    draft.push({
      kind: 'quiz',
      id: `wrap:v:${i}:${q.answer}`,
      question: q,
      example: sessionExample(q.answer, lesson),
      n: 0,
      of: 0,
    })
  }
  for (const [i, q] of sentenceQuestions(bookLesson, 2).entries()) {
    draft.push({
      kind: 'quiz',
      id: `wrap:s:${i}`,
      question: q,
      example: q.context ?? null,
      n: 0,
      of: 0,
    })
  }
  const cloze = clozeQuestion(bookLesson)
  if (cloze) {
    draft.push({
      kind: 'quiz',
      id: `wrap:cloze`,
      question: cloze,
      example: cloze.context ?? null,
      n: 0,
      of: 0,
    })
  }

  return numberSteps(draft)
}

export function buildSteps(lesson: number, node: PathNode): SessionStep[] {
  if (node === 'wrap') return buildWrapSteps(lesson)
  return buildTextSteps(lesson, node)
}

export function playableCount(steps: SessionStep[]): number {
  return Math.max(1, steps.filter((s) => s.kind !== 'complete').length)
}

export function sittingWordCount(lesson: number, node: PathNode): number {
  if (node === 'wrap') return teachVocab(lesson).length
  return textSitting(getLesson(lesson), textNodeIndex(node))?.words.length ?? 0
}
