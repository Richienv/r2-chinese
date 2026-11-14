/** A presentation route. It never records a review or changes a memory schedule. */
export interface RoutableStep { kind: string; id?: string; phase?: string; word?: { zh: string }; n?: number; of?: number }
export const isPracticeStep = (step: RoutableStep) => ['recall', 'quiz', 'dialogue', 'recheck', 'produce'].includes(step.kind)
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
export interface PracticeChoice { mode: 'words' | 'meaning' | 'sentence'; ids: string[] }
export function practiceChoices(steps: readonly RoutableStep[]): PracticeChoice[] {
  const ids = (kind: string, max: number) => steps.filter(step => step.kind === kind && step.id).slice(0, max).map(step => step.id!)
  const choices: PracticeChoice[] = [
    { mode: 'words', ids: ids('recall', 3) },
    { mode: 'meaning', ids: ids('quiz', 3) },
    { mode: 'sentence', ids: ids('produce', 1).length ? ids('produce', 1) : ids('dialogue', 1) },
  ]
  return choices.filter(choice => choice.ids.length > 0)
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
