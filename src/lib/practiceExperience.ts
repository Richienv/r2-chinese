import type { Rating } from './srs'

export const SHORT_DRILL_WORDS = 8
/** Bound the visible round without removing anything from the saved learning trail. */
export function drillSelection(words: readonly string[], all = false): string[] {
  const unique = [...new Set(words.map(word => word.trim()).filter(Boolean))]
  return all ? unique : unique.slice(0, SHORT_DRILL_WORDS)
}

/** Offer only ratings that the existing evidence rules allow. */
export function reviewRatings({ hadMiss, checked, helped, selfMode }: {
  hadMiss: boolean; checked: boolean; helped: boolean; selfMode: boolean
}): Rating[] {
  if (hadMiss) return ['again']
  if (helped || (!checked && !selfMode)) return ['again', 'hard']
  return ['again', 'hard', 'good', 'easy']
}

export function progressAction(due: number, hard: number): 'due' | 'hard' | 'learn' {
  return due > 0 ? 'due' : hard > 0 ? 'hard' : 'learn'
}
