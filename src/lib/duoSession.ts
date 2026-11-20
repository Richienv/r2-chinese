import { exampleFor, segmentForGloss, vocabIndex } from './content'
import { composeSitting, type ExerciseStep, type ExSentence, type ExSource, type ExWord } from './exercises'
import { duoLessonSteps, type RoutableStep } from './sessionRoute'

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
export function withMixedPractice<T extends SourceStep>(steps: T[], seed: string, coursePool: readonly ExWord[] = []): (T | ExerciseStep)[] {
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
  const composed = composeSitting(words, lines, {
    pool: [...coursePool, ...bookPool()],
    segment: (zh) => segmentForGloss(zh).map((token) => token.text),
    seed,
  }, meetWords)
  return duoLessonSteps<T, ExerciseStep>(steps, composed)
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
