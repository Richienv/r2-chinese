import type { InkDrawing } from './handwriting.ts'
import type { WordDiagnosis } from './handwriting-review.ts'
import type { DrillCue } from './drillRounds.ts'

/**
 * The drawing task as a loop: instruction, draw, check, feedback, redraw, recheck.
 * These helpers decide what the learner is asked to do and what survives into a retry.
 * Pure on purpose: HanziDrawing only renders these decisions.
 */

/** The instruction, restated so the result can be read against it. It never reveals the answer. */
export function recallTask(verb: 'Draw' | 'Type', cue: DrillCue, word: { en: string; pinyin: string }, characterCount: number): string {
  const size = characterCount === 1 ? '1 character' : `${characterCount} characters`
  if (cue === 'sound') return `${verb} the word you hear (${size})`
  if (cue === 'pinyin') return `${verb} the word read “${word.pinyin}” (${size})`
  return `${verb} the word for “${word.en}” (${size})`
}

export function drawingTask(cue: DrillCue, word: { en: string; pinyin: string }, characterCount: number): string {
  return recallTask('Draw', cue, word, characterCount)
}

/** 0-based positions that still have to be redrawn: everything the check did not read as correct. */
export function positionsToFix(diagnosis: WordDiagnosis): number[] {
  return diagnosis.characters.flatMap((entry, index) => entry.assessment.status === 'correct' ? [] : [index])
}

/**
 * What stays on the pad for the retry. A character that read correctly is kept and locked.
 * One that is close but incomplete (a stroke short or over) is kept so the learner can
 * add or undo one stroke. One that read as something else, or is just unclear, starts fresh.
 */
export function inkForRetry(drawings: InkDrawing[], diagnosis: WordDiagnosis): InkDrawing[] {
  return drawings.map((drawing, index) => {
    const entry = diagnosis.characters[index]
    if (!entry) return drawing
    if (entry.assessment.status === 'correct') return drawing
    const closeButIncomplete = entry.assessment.status === 'uncertain' && entry.known && entry.drawnStrokes > 0 && entry.drawnStrokes !== entry.expectedStrokes
    return closeButIncomplete ? drawing : []
  })
}

/** "Redraw character 2", "Redraw characters 1 and 3", or "Redraw the word" when everything needs it. */
export function redrawLabel(positions: number[], characterCount: number): string {
  if (!positions.length) return 'Check again'
  if (characterCount > 1 && positions.length === characterCount) return 'Redraw the word'
  const numbers = positions.map((position) => position + 1)
  if (numbers.length === 1) return `Redraw character ${numbers[0]}`
  return `Redraw characters ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
}
