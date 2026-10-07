import type { HandwritingWordAssessment, InkDrawing } from './handwriting'
import { t } from './i18n.ts'

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
  const list = positions.join(', ')
  if (assessment.status === 'uncertain') {
    return !positions.length ? t('I can’t confidently read your characters. Redraw with clearer, separate strokes, or type the word. This attempt isn’t scored.')
      : positions.length === 1 ? t('I can’t confidently read character {list}. Redraw with clearer, separate strokes, or type the word. This attempt isn’t scored.', { list })
        : t('I can’t confidently read characters {list}. Redraw with clearer, separate strokes, or type the word. This attempt isn’t scored.', { list })
  }
  return !positions.length ? t('The drawing for your characters doesn’t match the lesson word. Revisit it and try again.')
    : positions.length === 1 ? t('The drawing for character {list} doesn’t match the lesson word. Revisit it and try again.', { list })
      : t('The drawing for characters {list} doesn’t match the lesson word. Revisit it and try again.', { list })
}
