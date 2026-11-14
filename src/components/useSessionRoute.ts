import { useState } from 'react'
import { resumeSessionIndex, isPracticeStep, nextSessionIndex, practiceChoices, resumePracticeIds, type RoutableStep } from '../lib/sessionRoute'
import type { LearningCheckpoint } from '../lib/resume'

export function useSessionRoute<T extends RoutableStep>(steps: T[], checkpoint?: LearningCheckpoint) {
  const [i, setI] = useState(() => resumeSessionIndex(steps, checkpoint?.stepId))
  const [selected, setSelected] = useState<string[] | null>(() => resumePracticeIds(steps, checkpoint?.stepId, checkpoint?.practiceIds))
  const raw = steps[Math.min(i, steps.length - 1)]
  const inPractice = isPracticeStep(raw)
  const choosing = inPractice && !selected
  const step = inPractice && selected ? { ...raw, n: Math.max(1, selected.indexOf(raw.id!) + 1), of: selected.length } : raw
  const knowledgeCount = steps.filter(entry => !isPracticeStep(entry) && entry.kind !== 'complete').length
  const practicePosition = inPractice && selected ? Math.max(0, selected.indexOf(raw.id!)) : 0
  const progress = raw.kind === 'complete' ? 100 : Math.min(98, ((inPractice ? knowledgeCount + practicePosition : i) / Math.max(1, knowledgeCount + (selected?.length ?? 1))) * 100)
  return {
    i, step, choosing, inPractice, progress, selected,
    choices: practiceChoices(steps),
    next: () => setI(current => nextSessionIndex(steps, current, selected)),
    finish: () => setI(steps.length - 1),
    choose(ids: string[]) {
      const valid = ids.filter(id => steps.some(entry => entry.id === id && isPracticeStep(entry)))
      if (!valid.length) return
      setSelected(valid)
      setI(steps.findIndex(entry => entry.id === valid[0]))
    },
  }
}
