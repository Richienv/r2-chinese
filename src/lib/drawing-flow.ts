import type { InkDrawing } from './handwriting.ts'
import type { WordDiagnosis } from './handwriting-review.ts'
import type { DrillCue } from './drillRounds.ts'
import { t } from './i18n.ts'

/**
 * The drawing task as a loop: instruction, draw, check, feedback, redraw, recheck.
 * These helpers decide what the learner is asked to do and what survives into a retry.
 * Pure on purpose: HanziDrawing only renders these decisions.
 */

/** The instruction, restated so the result can be read against it. It never reveals the answer. */
export function recallTask(verb: 'Draw' | 'Type', cue: DrillCue, word: { en: string; pinyin: string }, characterCount: number): string {
  const size = characterCount === 1 ? t('{n} character', { n: 1 }) : t('{n} characters', { n: characterCount })
  const draw = verb === 'Draw'
  if (cue === 'sound') return draw ? t('Draw the word you hear ({size})', { size }) : t('Type the word you hear ({size})', { size })
  if (cue === 'pinyin') return draw ? t('Draw the word read “{pinyin}” ({size})', { pinyin: word.pinyin, size }) : t('Type the word read “{pinyin}” ({size})', { pinyin: word.pinyin, size })
  return draw ? t('Draw the word for “{meaning}” ({size})', { meaning: word.en, size }) : t('Type the word for “{meaning}” ({size})', { meaning: word.en, size })
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
  if (!positions.length) return t('Check again')
  if (characterCount > 1 && positions.length === characterCount) return t('Redraw the word')
  const numbers = positions.map((position) => position + 1)
  if (numbers.length === 1) return t('Redraw character {n}', { n: numbers[0] })
  return t('Redraw characters {list} and {last}', { list: numbers.slice(0, -1).join(', '), last: numbers[numbers.length - 1] })
}
