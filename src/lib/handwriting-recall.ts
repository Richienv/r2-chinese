import type { HandwritingWordAssessment, InkDrawing } from './handwriting'

/** Each character keeps independent raw ink, including while revisiting earlier positions. */
export function blankWordInk(characterCount: number): InkDrawing[] {
  return Array.from({ length: Math.max(1, characterCount) }, () => [])
}

export function replaceCharacterInk(drawings: InkDrawing[], position: number, drawing: InkDrawing): InkDrawing[] {
  if (position < 0 || position >= drawings.length) return drawings
  return drawings.map((saved, index) => index === position ? drawing.map((stroke) => stroke.map(([x, y]) => [x, y] as const)) : saved)
}

export function wordInkComplete(drawings: InkDrawing[]): boolean {
  return drawings.length > 0 && drawings.every((drawing) => drawing.length > 0 && drawing.some((stroke) => stroke.length > 0))
}

/** Unreadable ink says nothing about the learner's knowledge. */
export function handwritingRecallEvidence(status: HandwritingWordAssessment['status']): boolean | undefined {
  return status === 'uncertain' ? undefined : status === 'correct'
}

export function handwritingRetryMessage(assessment: HandwritingWordAssessment): string {
  const positions = assessment.characters.flatMap((character, index) => character.status !== 'correct' ? [index + 1] : [])
  const location = positions.length ? `${positions.length === 1 ? 'character' : 'characters'} ${positions.join(', ')}` : 'your characters'
  return assessment.status === 'uncertain'
    ? `I can’t confidently read ${location}. Redraw with clearer, separate strokes, or type the word. This attempt isn’t scored.`
    : `The drawing for ${location} doesn’t match the lesson word. Revisit it and try again.`
}
