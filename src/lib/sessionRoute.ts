import { rng, seedOf, shuffle } from './seeded.ts'

/** A presentation route. It never records a review or changes a memory schedule. */
export interface RoutableStep { kind: string; id?: string; phase?: string; word?: { zh: string }; n?: number; of?: number }
export const isPracticeStep = (step: RoutableStep) => ['recall', 'quiz', 'dialogue', 'recheck', 'produce', 'exercise'].includes(step.kind)
export function compactStepId(id?: string): string | undefined {
  return id?.replace(/^(hook|example|seal):/, 'meet:')
}
/** No checkpoint must start at zero, never at the completion step without an ID. */
export function resumeSessionIndex(steps: readonly RoutableStep[], stepId?: string): number {
  if (!stepId) return 0
  const saved = compactStepId(stepId)
  return Math.max(0, steps.findIndex(step => step.id === saved))
}
export function compactLessonSteps<T extends RoutableStep>(steps: readonly T[]): T[] {
  const words = steps.filter(step => step.kind === 'teach' && step.phase === 'meet')
  const knowledge = steps.filter(step => step.kind === 'read' || step.kind === 'note')
  return [
    ...words.map((step, index) => ({ ...step, n: index + 1, of: words.length })),
    ...knowledge,
    ...steps.filter(isPracticeStep),
    ...steps.filter(step => step.kind === 'complete'),
  ]
}
/** A word that needed help comes back at most this many extra times in one sitting. */
export const MAX_REPEATS = 2
const REPEAT_GAP = 2

/**
 * Every word in this block is retrieved once, in a different order from how it was taught,
 * then up to two line checks, one sentence, and one spoken dialogue when the block has them.
 */
export function practiceRound(steps: readonly RoutableStep[]): string[] {
  const ids = (kind: string) => steps.filter(step => step.kind === kind && step.id).map(step => step.id!)
  const exercises = ids('exercise')
  // A word built from its characters in this round is not typed again straight after.
  const built = new Set(exercises.filter(id => id.startsWith(BUILD_PREFIX)).map(id => id.slice(BUILD_PREFIX.length)))
  const recalls = steps.filter(step => step.kind === 'recall' && step.id && !built.has(step.word?.zh ?? '')).map(step => step.id!)
  let mixed = recalls.length > 2 ? shuffle(recalls, rng(seedOf(recalls.join('|')))) : recalls
  // The last word taught is still in working memory; don't open with it.
  if (mixed.length > 2 && mixed[0] === recalls[recalls.length - 1]) mixed = [...mixed.slice(1), mixed[0]]
  // Easy to hard: recognise and use first, build, then produce from memory.
  const early = exercises.filter(id => !id.startsWith('ex3:'))
  const late = exercises.filter(id => id.startsWith('ex3:'))
  return [...early, ...late, ...mixed, ...ids('quiz').slice(0, 2), ...ids('produce').slice(0, 1), ...ids('dialogue').slice(0, 1)]
}

const BUILD_PREFIX = 'ex3:build:'

export interface ComposedPractice<E extends RoutableStep> {
  groups: { words: string[]; exercises: E[] }[]
  context: E[]
  produce: E[]
}

/** Sittings with more new words than this are split into waves of practice. */
export const LONG_SITTING = 12
/** Groups of new words per wave in a long sitting (two groups ≈ eight words). */
export const WAVE_GROUPS = 2

/**
 * Duolingo rhythm: meet up to four words, recognise them straight away, meet the
 * next few, then read, then one mixed round from easy to hard. A long sitting
 * (30 words in one Jiaocheng text) closes a wave after every eight words: build
 * and recall those eight, then go on. Steps the composer did not cover keep their
 * compact order, so nothing from the book is dropped.
 */
export function duoLessonSteps<T extends RoutableStep, E extends RoutableStep>(steps: readonly T[], composed: ComposedPractice<E>): (T | E)[] {
  const meets = steps.filter(step => step.kind === 'teach' && step.phase === 'meet')
  const numbered = meets.map((step, index) => ({ ...step, n: index + 1, of: meets.length }))
  const long = meets.length > LONG_SITTING
  const placed = new Set<string>()
  const moved = new Set<T | E>()
  const out: (T | E)[] = []
  let wave: string[] = []
  composed.groups.forEach((group, index) => {
    const groupMeets = numbered.filter(step => group.words.includes(step.word?.zh ?? '') && !placed.has(step.id ?? ''))
    groupMeets.forEach(step => placed.add(step.id ?? ''))
    out.push(...groupMeets, ...group.exercises)
    if (!long) return
    wave.push(...group.words)
    if (index % WAVE_GROUPS !== WAVE_GROUPS - 1 && index !== composed.groups.length - 1) return
    const inWave = (step: T | E) => wave.includes(step.word?.zh ?? '')
    const production = [
      ...composed.produce.filter(inWave),
      ...steps.filter(step => step.kind === 'recall' && inWave(step)),
    ]
    production.forEach(step => moved.add(step))
    out.push(...production)
    wave = []
  })
  const rest = numbered.filter(step => !placed.has(step.id ?? ''))
  return [
    ...rest,
    ...out,
    ...steps.filter(step => step.kind === 'read' || step.kind === 'note'),
    ...composed.context,
    ...composed.produce.filter(step => !moved.has(step)),
    ...steps.filter(step => isPracticeStep(step) && !moved.has(step)),
    ...steps.filter(step => step.kind === 'complete'),
  ]
}

/** The contiguous run of practice steps that contains `index`. */
export function practiceBlock<T extends RoutableStep>(steps: readonly T[], index: number): { start: number; end: number; steps: T[] } | null {
  if (!isPracticeStep(steps[index])) return null
  let start = index
  while (start > 0 && isPracticeStep(steps[start - 1])) start--
  let end = index
  while (end + 1 < steps.length && isPracticeStep(steps[end + 1])) end++
  return { start, end, steps: steps.slice(start, end + 1) }
}

/** Ask `id` again after a couple of other items, so the retry is a real retrieval. */
export function requeue(queue: readonly string[], pos: number, id: string): string[] {
  const at = Math.min(queue.length, pos + 1 + REPEAT_GAP)
  return [...queue.slice(0, at), id, ...queue.slice(at)]
}
export function resumePracticeIds(steps: readonly RoutableStep[], stepId?: string, saved?: string[]): string[] | null {
  if (saved) {
    const valid = [...new Set(saved)].filter(id => steps.some(step => isPracticeStep(step) && step.id === id))
    return valid.length ? valid : null
  }
  // Legacy saves reopen the exact activity, without putting a new gate in front of it.
  const old = steps.find(step => step.id === stepId && isPracticeStep(step))
  if (!old) return null
  return steps.filter(step => step.kind === old.kind && step.id).slice(steps.filter(step => step.kind === old.kind).indexOf(old)).slice(0, old.kind === 'recall' || old.kind === 'quiz' ? 3 : 1).map(step => step.id!)
}
export function nextSessionIndex(steps: readonly RoutableStep[], index: number, selected: readonly string[] | null): number {
  if (!isPracticeStep(steps[index])) return Math.min(index + 1, steps.length - 1)
  const next = steps.findIndex((step, position) => position > index && !!step.id && !!selected?.includes(step.id))
  return next >= 0 ? next : steps.length - 1
}
