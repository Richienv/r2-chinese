import { exampleFor, segmentForGloss, vocabIndex } from './content'
import { composeRecognise, composeSitting, type ExerciseStep, type ExSentence, type ExSource, type ExWord } from './exercises'
import { duoLessonSteps, type RoutableStep } from './sessionRoute'
import { prioritizeWords, skippedWordsForRecall, type LearnerGraphState } from './learnerGraph'

/** The fields the three course builders share; read structurally, never mutated. */
interface SourceStep extends RoutableStep {
  word?: { zh: string; pinyin?: string; en?: string; pos?: string }
  example?: { zh: string; pinyin?: string; en?: string } | null
  text?: { lines: { zh: string; pinyin?: string; en?: string }[] }
}

const sentence = (line: { zh: string; pinyin?: string; en?: string }): ExSentence => ({ zh: line.zh, pinyin: line.pinyin ?? '', en: line.en ?? '' })

let hskPool: ExWord[] | null = null
/** Book-wide words for wrong answers. Names and places make unfair options, so they stay out. */
function bookPool(): ExWord[] {
  hskPool ??= vocabIndex
    .filter((v) => v.tag !== 'proper' && v.en)
    .map((v) => ({ zh: v.zh, pinyin: v.pinyin, en: v.en, pos: v.pos }))
  return hskPool
}

/**
 * Turn a course sitting into the mixed Duolingo-style sitting: groups of new words
 * each followed by quick recognition, then reading, then one easy-to-hard round.
 */
export function withMixedPractice<T extends SourceStep>(
  steps: T[],
  seed: string,
  coursePool: readonly ExWord[] = [],
  options?: { graph?: LearnerGraphState; skippedCarryover?: readonly ExSource[] },
): (T | ExerciseStep)[] {
  const words: ExSource[] = []
  const seen = new Set<string>()
  for (const step of steps) {
    if ((step.kind !== 'teach' && step.kind !== 'recall') || !step.word?.zh || seen.has(step.word.zh)) continue
    seen.add(step.word.zh)
    const example = step.example ?? exampleFor(step.word.zh)
    words.push({
      zh: step.word.zh,
      pinyin: step.word.pinyin ?? '',
      en: step.word.en ?? '',
      pos: step.word.pos ?? '',
      example: example?.zh ? sentence(example) : null,
    })
  }
  const meetWords = steps.filter((step) => step.kind === 'teach' && step.phase === 'meet').map((step) => step.word?.zh ?? '')
  const lines = steps.flatMap((step) => {
    if ((step.kind === 'read' || step.kind === 'dialogue') && step.text) return step.text.lines.map(sentence)
    if (step.kind === 'note' && step.example?.zh) return [sentence(step.example)]
    return []
  })
  const fullPool = [...coursePool, ...(options?.skippedCarryover ?? []), ...bookPool()]
  const composed = composeSitting(words, lines, {
    pool: fullPool,
    segment: (zh) => segmentForGloss(zh).map((token) => token.text),
    seed,
  }, meetWords)
  const mixed = duoLessonSteps<T, ExerciseStep>(steps, composed)
  if (!options?.skippedCarryover?.length) return mixed

  const priorityZhs = options.graph
    ? prioritizeWords(options.graph, options.skippedCarryover.map((w) => w.zh))
    : options.skippedCarryover.map((w) => w.zh)
  const carryoverPool = priorityZhs
    .filter((zh) => !seen.has(zh))
    .map((zh) => options.skippedCarryover!.find((w) => w.zh === zh))
    .filter((w): w is ExSource => !!w)
    .slice(0, 2)
  if (!carryoverPool.length) return mixed

  const carryoverExercises = composeRecognise(
    carryoverPool,
    { pool: fullPool, segment: (zh) => segmentForGloss(zh).map((token) => token.text), seed: `${seed}:carryover` },
    2,
    fullPool,
  )
    .filter((ex) => ex.exercise.kind !== 'match')
    .slice(0, 2)
    .map((ex, i) => ({ ...ex, id: `carryover:${i}:${ex.word?.zh ?? ex.id}` }))

  if (!carryoverExercises.length) return mixed
  const completeIndex = mixed.findIndex((s) => s.kind === 'complete')
  if (completeIndex < 0) return [...mixed, ...carryoverExercises]
  return [...mixed.slice(0, completeIndex), ...carryoverExercises, ...mixed.slice(completeIndex)]
}

/** A course's own words as wrong-answer material, ahead of the HSK book. */
export function poolOf(units: readonly { words: readonly { zh: string; pinyin: string; en: string; pos?: string }[] }[]): ExWord[] {
  const seen = new Set<string>()
  const out: ExWord[] = []
  for (const unit of units) {
    for (const word of unit.words) {
      if (!word.zh || !word.en || seen.has(word.zh)) continue
      seen.add(word.zh)
      out.push({ zh: word.zh, pinyin: word.pinyin, en: word.en, pos: word.pos ?? '' })
    }
  }
  return out
}

export function buildSkippedCarryover(
  graph: LearnerGraphState,
  isWordComfortable: (zh: string) => boolean,
  coursePool: readonly ExWord[] = [],
  fallbackResolve?: (zh: string) => ExWord | undefined,
): ExSource[] {
  const poolByZh = new Map<string, ExWord>()
  for (const w of coursePool) {
    if (w.zh && !poolByZh.has(w.zh)) poolByZh.set(w.zh, w)
  }
  const out: ExSource[] = []
  for (const zh of skippedWordsForRecall(graph)) {
    if (isWordComfortable(zh)) continue
    const w = poolByZh.get(zh) ?? fallbackResolve?.(zh)
    if (!w || !w.en) continue
    const ex = exampleFor(w.zh)
    out.push({
      zh: w.zh,
      pinyin: w.pinyin,
      en: w.en,
      pos: w.pos ?? '',
      example: ex?.zh ? sentence(ex) : null,
    })
  }
  return out
}
