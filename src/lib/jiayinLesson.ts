import { answerChunks, buildJiayinQuiz, jiayinRecallPrompt, type JiayinExerciseAttempt, type JiayinItem, type JiayinProgress, type JiayinQuiz, type JiayinUnit, type JiayinWord } from './jiayinPractice.ts'
import type { GrammarExample, Vocab } from './types.ts'

export const JIAYIN_LEARNING_STAGES = ['Kenali', 'Pahami', 'Ingat', 'Jawab sendiri', 'Ulangi'] as const
export type JiayinLearningStage = typeof JIAYIN_LEARNING_STAGES[number]
export interface JiayinLesson { id: string; unit: JiayinUnit; item: JiayinItem; words: JiayinWord[] }
export type JiayinLessonStep =
  | { id: string; kind: 'orient'; phase: JiayinLearningStage }
  | { id: string; kind: 'teach'; phase: JiayinLearningStage; word: JiayinWord; beat: 'meet' | 'remember' }
  | { id: string; kind: 'read'; phase: JiayinLearningStage; chunk: number }
  | { id: string; kind: 'pattern'; phase: JiayinLearningStage }
  | { id: string; kind: 'word'; phase: JiayinLearningStage; word: JiayinWord }
  | { id: string; kind: 'sentence'; phase: JiayinLearningStage; chunk: number }
  | { id: string; kind: 'answer'; phase: JiayinLearningStage }
  | { id: string; kind: 'check'; phase: JiayinLearningStage; quiz: JiayinQuiz }
  | { id: string; kind: 'complete'; phase: JiayinLearningStage }

/** The short opening is the first manageable sitting; the source itself is never rewritten. */
export function buildJiayinLessons(units: JiayinUnit[], extra: JiayinWord[] = []): JiayinLesson[] {
  const bank = [...new Map([...units.flatMap(unit => unit.vocab), ...extra].map(word => [word.zh, word])).values()]
  return units.flatMap(unit => {
    const items = unit.id === 1 ? [...unit.items].sort((a, b) => (a.id === 'intro-short' ? -1 : b.id === 'intro-short' ? 1 : 0)) : unit.items
    return items.map(item => {
      const candidates = [...unit.vocab, ...bank].filter(word => item.answerZh.includes(word.zh))
      const words = [...new Map(candidates.map(word => [word.zh, word])).values()].slice(0, 4)
      return { id: item.id, unit, item, words }
    })
  })
}
export function asJiayinVocab(word: JiayinWord): Vocab { return { zh: word.zh, pinyin: word.pinyin, en: word.id, pos: '', note: word.tip } }
export function jiayinSentence(lesson: JiayinLesson, chunk: number): GrammarExample {
  return { zh: answerChunks(lesson.item.answerZh)[chunk], pinyin: lesson.item.chunkPinyin?.[chunk] ?? '', en: lesson.item.chunkId[chunk] }
}
export function jiayinAnswerExample(lesson: JiayinLesson): GrammarExample {
  return { zh: lesson.item.answerZh, pinyin: lesson.item.pinyin ?? lesson.item.chunkPinyin?.join(' ') ?? '', en: lesson.item.answerId }
}
export function buildJiayinLessonSteps(lesson: JiayinLesson): JiayinLessonStep[] {
  const steps: JiayinLessonStep[] = [{ id: `orient:${lesson.id}`, kind: 'orient', phase: 'Kenali' }]
  for (const word of lesson.words) {
    steps.push({ id: `meet:${lesson.id}:${word.zh}`, kind: 'teach', phase: 'Kenali', word, beat: 'meet' })
    steps.push({ id: `remember:${lesson.id}:${word.zh}`, kind: 'teach', phase: 'Pahami', word, beat: 'remember' })
  }
  const chunks = answerChunks(lesson.item.answerZh)
  chunks.forEach((_, chunk) => steps.push({ id: `read:${lesson.id}:${chunk}`, kind: 'read', phase: 'Pahami', chunk }))
  // A grammar example is shown only when this answer actually contains it.
  if (lesson.item.answerZh.includes(lesson.unit.pattern.zh)) steps.push({ id: `pattern:${lesson.id}`, kind: 'pattern', phase: 'Pahami' })
  for (const word of lesson.words) steps.push({ id: `word:${lesson.id}:${word.zh}`, kind: 'word', phase: 'Ingat', word })
  chunks.forEach((_, chunk) => steps.push({ id: `sentence:${lesson.id}:${chunk}`, kind: 'sentence', phase: 'Jawab sendiri', chunk }))
  steps.push({ id: `answer:${lesson.id}`, kind: 'answer', phase: 'Jawab sendiri' })
  const checks = buildJiayinQuiz(lesson.unit).filter(quiz => quiz.id === `question:${lesson.id}` || quiz.id.startsWith('business:'))
  checks.forEach(quiz => steps.push({ id: `check:${lesson.id}:${quiz.id}`, kind: 'check', phase: 'Ulangi', quiz }))
  steps.push({ id: `complete:${lesson.id}`, kind: 'complete', phase: 'Ulangi' })
  return steps
}
export function jiayinExerciseKey(stepId: string): string { return stepId.replace(/^retry:/, '') }
export function lastJiayinExercise(progress: JiayinProgress, stepId: string): JiayinExerciseAttempt | undefined {
  const list = progress.exercises[jiayinExerciseKey(stepId)]
  return list?.[list.length - 1]
}
export function isJiayinExerciseIndependent(attempt: JiayinExerciseAttempt | undefined): boolean {
  return !!attempt && attempt.correct && !attempt.assisted && attempt.evidence !== 'practice'
}
export function jiayinLessonReviewSteps(lesson: JiayinLesson, progress: JiayinProgress, now = Date.now()): JiayinLessonStep[] {
  return buildJiayinLessonSteps(lesson).filter(step => ['word', 'sentence', 'answer', 'check'].includes(step.kind)).filter(step => {
    const last = lastJiayinExercise(progress, step.id)
    return !!last && (!isJiayinExerciseIndependent(last) || now - last.at >= 86_400_000)
  }).sort((a, b) => {
    const left = lastJiayinExercise(progress, a.id); const right = lastJiayinExercise(progress, b.id)
    return Number(isJiayinExerciseIndependent(left)) - Number(isJiayinExerciseIndependent(right)) || (left?.at ?? 0) - (right?.at ?? 0)
  })
}
export function nextJiayinLesson(lessons: JiayinLesson[], progress: JiayinProgress): JiayinLesson | undefined {
  return lessons.find(lesson => !progress.lessonsDone[lesson.id])
}
export function nextJiayinLessonReview(lessons: JiayinLesson[], progress: JiayinProgress, now = Date.now()): JiayinLesson | undefined {
  return lessons.map(lesson => ({ lesson, steps: jiayinLessonReviewSteps(lesson, progress, now) }))
    .filter(entry => entry.steps.length).sort((a, b) => {
      const left = lastJiayinExercise(progress, a.steps[0].id); const right = lastJiayinExercise(progress, b.steps[0].id)
      return Number(isJiayinExerciseIndependent(left)) - Number(isJiayinExerciseIndependent(right)) || (left?.at ?? 0) - (right?.at ?? 0)
    })[0]?.lesson
}
export function jiayinLessonPrompt(lesson: JiayinLesson) { return jiayinRecallPrompt(lesson.item) }
export function appendJiayinRetry(steps: JiayinLessonStep[], step: JiayinLessonStep): JiayinLessonStep[] {
  if (!['word', 'sentence', 'answer', 'check'].includes(step.kind) || step.id.startsWith('retry:') || steps.some(candidate => candidate.id === `retry:${step.id}`)) return steps
  return [...steps.slice(0, -1), { ...step, id: `retry:${step.id}`, phase: 'Ulangi' }, steps[steps.length - 1]]
}
