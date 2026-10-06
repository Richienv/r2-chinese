import {
  assessHandwriting, assessHandwritingWord, assignStrokes, normalizeInk, recognizeHandwriting,
  type HandwritingAssessment, type HandwritingCandidate, type HandwritingModel, type HandwritingWordAssessment, type InkDrawing, type StrokeAssignment,
} from './handwriting.ts'
import { buildReview, type Review, type ReviewCheck } from './review.ts'

/**
 * Explaining a drawing, not grading it. Pass or fail still comes from
 * assessHandwriting, which classifies blind against the whole corpus. Everything
 * here is geometry against the expected character's strokes, used to say which
 * stroke is missing, extra or off. It is worded as likely, never as certain.
 */

export type StrokeStatus = 'ok' | 'off' | 'missing'

export interface StrokeFinding {
  /** 1-based, in the character's standard stroke order. */
  index: number
  description: string
  status: StrokeStatus
}

export interface CharacterDiagnosis {
  expected: string
  /** The character exists in the local corpus, so strokes can be compared. */
  known: boolean
  expectedStrokes: number | null
  drawnStrokes: number
  assessment: HandwritingAssessment
  /** What the drawing looks most like, with the expected character left out of the ranking. */
  candidates: HandwritingCandidate[]
  strokes: StrokeFinding[]
  /** 1-based positions among the strokes drawn that match nothing in the character. */
  extraStrokes: number[]
  /** How many strokes are short when they cannot be named with confidence. */
  unlocatedMissing: number
  /** 1-based strokes that could be the missing one, when a few fit equally well. Empty when nothing can be said. */
  possiblyMissing: number[]
  /** Extra strokes that cannot be pointed at with confidence. */
  unlocatedExtra: number
}

/** A stroke is reported as off when its shape cost or its position is clearly beyond loose handwriting. */
const OFF_COST = 0.14
const OFF_OFFSET = 0.2
/**
 * Naming a missing or extra stroke needs two things: the best explanation has to
 * fit well in its own right, and it has to beat the runner-up. Repeated parallel
 * strokes are nearly interchangeable, so a near tie is reported as a short list.
 * (Measured on the real corpus: every correct identification fit at 0.03 or
 * better; the one wrong one fit at 0.07.)
 */
const GOOD_FIT = 0.045
const TIE = 0.01
const WORK_LIMIT = 4_000_000

/** "a horizontal stroke at the bottom": a plain-words name for one stroke of a character. */
export function describeStroke(stroke: Float32Array): string {
  const count = stroke.length / 2
  if (count < 2) return 'dot'
  const x0 = stroke[0], y0 = stroke[1], x1 = stroke[stroke.length - 2], y1 = stroke[stroke.length - 1]
  let length = 0, cx = 0, cy = 0, bend = 0
  const dx = x1 - x0, dy = y1 - y0, chord = Math.hypot(dx, dy) || 1
  for (let i = 0; i < count; i++) {
    const x = stroke[i * 2], y = stroke[i * 2 + 1]
    cx += x; cy += y
    if (i > 0) length += Math.hypot(x - stroke[i * 2 - 2], y - stroke[i * 2 - 1])
    bend = Math.max(bend, Math.abs(dy * (x - x0) - dx * (y - y0)) / chord)
  }
  cx /= count; cy /= count
  let kind: string
  if (length < 0.1) kind = 'dot'
  else {
    const horizontal = Math.abs(dy) < Math.abs(dx) * 0.4
    const vertical = Math.abs(dx) < Math.abs(dy) * 0.4
    kind = horizontal ? 'horizontal stroke'
      : vertical ? (dy >= 0 ? 'vertical stroke' : 'upward stroke')
        : dy > 0 ? (dx < 0 ? 'left-falling stroke' : 'right-falling stroke') : 'rising stroke'
    if (bend > 0.09) kind = `bent ${kind}`
  }
  const vertical = cy < 0.34 ? 'top' : cy > 0.66 ? 'bottom' : ''
  const horizontal = cx < 0.34 ? 'left' : cx > 0.66 ? 'right' : ''
  const place = vertical && horizontal ? `at the ${vertical} ${horizontal}` : vertical ? `at the ${vertical}` : horizontal ? `on the ${horizontal}` : 'in the middle'
  return `${kind} ${place}`
}

function asInk(strokes: Float32Array[]): InkDrawing {
  return strokes.map((stroke) => Array.from({ length: stroke.length / 2 }, (_, i) => [stroke[i * 2], stroke[i * 2 + 1]] as const))
}

function* combinations(total: number, size: number, start = 0, chosen: number[] = []): Generator<number[]> {
  if (chosen.length === size) { yield chosen; return }
  for (let i = start; i < total; i++) yield* combinations(total, size, i + 1, [...chosen, i])
}

function affordable(total: number, size: number): boolean {
  let combos = 1
  for (let i = 0; i < size; i++) combos = combos * (total - i) / (i + 1)
  return combos * total ** 3 * 1.5 <= WORK_LIMIT
}

interface Fit { dropped: number[]; paired: StrokeAssignment['paired']; extraInputs: number[]; cost: number }

/** Best pairing after leaving some strokes out of one side, because leaving them out re-scales everything else. */
export function fitWithout(drawing: InkDrawing, template: Float32Array[], side: 'template' | 'drawing', size: number): Fit[] | null {
  const total = side === 'template' ? template.length : drawing.length
  if (size < 1 || size > 3 || !affordable(total, size)) return null
  const fits: Fit[] = []
  for (const dropped of combinations(total, size)) {
    if (side === 'template') {
      const kept = template.map((_, i) => i).filter((i) => !dropped.includes(i))
      const reference = normalizeInk(asInk(kept.map((i) => template[i])))
      const result = assignStrokes(normalizeInk(drawing), reference)
      const paired: Fit['paired'] = template.map(() => null)
      kept.forEach((original, slot) => { paired[original] = result.paired[slot] })
      fits.push({ dropped, paired, extraInputs: result.extraInputs, cost: result.distance })
    } else {
      const kept = drawing.map((_, i) => i).filter((i) => !dropped.includes(i))
      const result = assignStrokes(normalizeInk(kept.map((i) => drawing[i])), template)
      const paired = result.paired.map((pair) => pair ? { ...pair, inputIndex: kept[pair.inputIndex] } : null)
      fits.push({ dropped, paired, extraInputs: [...dropped, ...result.extraInputs.map((i) => kept[i])], cost: result.distance })
    }
  }
  return fits.sort((a, b) => a.cost - b.cost)
}

export function diagnoseCharacter(drawing: InkDrawing, model: HandwritingModel, expected: string): CharacterDiagnosis {
  const assessment = assessHandwriting(drawing, model, expected)
  const candidates = recognizeHandwriting(drawing, model, 3)
  const template = model.templates.find((entry) => entry.character === expected)?.strokes
  const drawn = drawing.filter((stroke) => stroke.length > 0)
  const base = { expected, assessment, candidates, drawnStrokes: drawn.length }
  if (!template || !drawn.length) {
    return { ...base, known: !!template, expectedStrokes: template?.length ?? null, strokes: [], extraStrokes: [], unlocatedMissing: 0, possiblyMissing: [], unlocatedExtra: 0 }
  }
  const input = normalizeInk(drawn)
  const describe = template.map(describeStroke)
  let paired: Fit['paired']
  let extraInputs: number[] = []
  let missing = new Set<number>()
  let unlocatedMissing = 0
  let unlocatedExtra = 0
  let possiblyMissing: number[] = []

  if (drawn.length === template.length) {
    paired = assignStrokes(input, template).paired
  } else if (drawn.length < template.length) {
    const size = template.length - drawn.length
    const fits = fitWithout(drawn, template, 'template', size)
    if (fits) {
      const best = fits[0]
      const tied = fits.filter((fit) => fit.cost <= best.cost + TIE)
      paired = best.paired
      if (best.cost > GOOD_FIT) unlocatedMissing = size
      else if (tied.length === 1) missing = new Set(best.dropped)
      else {
        unlocatedMissing = size
        possiblyMissing = [...new Set(tied.flatMap((fit) => fit.dropped))].sort((x, y) => x - y).map((i) => i + 1)
      }
    } else {
      paired = assignStrokes(input, template).paired
      unlocatedMissing = size
    }
  } else {
    const size = drawn.length - template.length
    const fits = fitWithout(drawn, template, 'drawing', size)
    if (fits) {
      const best = fits[0]
      const tied = fits.filter((fit) => fit.cost <= best.cost + TIE)
      paired = best.paired
      if (best.cost > GOOD_FIT || tied.length > 1) unlocatedExtra = size
      else extraInputs = best.extraInputs
    } else {
      paired = assignStrokes(input, template).paired
      unlocatedExtra = size
    }
  }

  const strokes: StrokeFinding[] = template.map((_, index) => {
    const pair = paired[index]
    // A stroke with no partner is only called missing when it is certain which one it is.
    const status: StrokeStatus = missing.has(index) ? 'missing' : !pair ? 'ok' : pair.distance > OFF_COST || pair.offset > OFF_OFFSET ? 'off' : 'ok'
    return { index: index + 1, description: describe[index], status }
  })
  return {
    ...base, known: true, expectedStrokes: template.length, strokes,
    extraStrokes: [...new Set(extraInputs)].sort((x, y) => x - y).map((i) => i + 1), unlocatedMissing, possiblyMissing, unlocatedExtra,
  }
}

export interface WordDiagnosis {
  assessment: HandwritingWordAssessment
  characters: CharacterDiagnosis[]
}

export function diagnoseWord(drawings: InkDrawing[], model: HandwritingModel, expectedWord: string): WordDiagnosis {
  const expected = Array.from(expectedWord.trim())
  return {
    assessment: assessHandwritingWord(drawings, model, expectedWord),
    characters: expected.map((character, index) => diagnoseCharacter(drawings[index] ?? [], model, character)),
  }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** Plain-language fixes for one character, from most to least certain. */
export function strokeAdvice(diagnosis: CharacterDiagnosis): string[] {
  const advice: string[] = []
  for (const stroke of diagnosis.strokes) if (stroke.status === 'missing') advice.push(`Add the ${stroke.description} (stroke ${stroke.index} of ${diagnosis.expectedStrokes}).`)
  if (diagnosis.unlocatedMissing) {
    const short = `You are ${plural(diagnosis.unlocatedMissing, 'stroke')} short`
    const where = diagnosis.possiblyMissing.map((index) => diagnosis.strokes[index - 1]).filter(Boolean)
    advice.push(where.length
      ? `${short}. It is one of: ${where.map((stroke) => `the ${stroke.description} (stroke ${stroke.index})`).join('; ')}.`
      : `${short}. Count your strokes against the stroke order shown.`)
  }
  if (diagnosis.extraStrokes.length) advice.push(`Remove ${diagnosis.extraStrokes.length === 1 ? 'the extra stroke' : 'the extra strokes'} (stroke${diagnosis.extraStrokes.length === 1 ? '' : 's'} ${diagnosis.extraStrokes.join(', ')} of what you drew; this character has ${diagnosis.expectedStrokes}).`)
  if (diagnosis.unlocatedExtra) advice.push(`You drew ${plural(diagnosis.unlocatedExtra, 'stroke')} too many (this character has ${diagnosis.expectedStrokes}). Count them against the stroke order shown.`)
  // Per-stroke comments are meaningless when the whole character read as a different one.
  if (diagnosis.assessment.status !== 'incorrect') for (const stroke of diagnosis.strokes) if (stroke.status === 'off') advice.push(`Check the ${stroke.description} (stroke ${stroke.index}): it looks out of place.`)
  return advice
}

export interface DrawingContext {
  /** What the learner was asked to do, in their words. */
  task: string
  characterCount: number
}

/** The checks for a drawn word: was it complete, does each character read correctly, and how are the strokes. */
export function reviewDrawing(context: DrawingContext, diagnosis: WordDiagnosis): Review {
  const checks: ReviewCheck[] = []
  const drawnCharacters = diagnosis.characters.filter((entry) => entry.drawnStrokes > 0).length
  checks.push({
    id: 'drawn-all', stage: 'instruction', decisive: true, label: context.characterCount === 1 ? 'The character is drawn' : 'Every character is drawn',
    status: drawnCharacters === context.characterCount ? 'pass' : 'fail',
    found: `${drawnCharacters} of ${context.characterCount} drawn`, expected: `${context.characterCount} character${context.characterCount === 1 ? '' : 's'}`,
    fix: `Draw the ${context.characterCount - drawnCharacters === 1 ? 'missing character' : 'missing characters'} before checking.`,
  })
  diagnosis.characters.forEach((entry, index) => {
    const position = index + 1
    const name = diagnosis.characters.length === 1 ? 'The character' : `Character ${position}`
    const advice = strokeAdvice(entry)
    // The closest look-alike is only worth showing when it is not the answer itself.
    const closest = entry.candidates[0]?.character
    const lookAlike = closest && closest !== entry.expected ? closest : undefined
    const reads = entry.assessment.status
    const countOff = entry.known && entry.drawnStrokes !== entry.expectedStrokes
    checks.push({
      id: `char-${position}-reads`, stage: 'output', decisive: true, spoils: true,
      label: `${name} reads as ${entry.expected}`,
      status: reads === 'correct' ? 'pass' : reads === 'incorrect' ? 'fail' : 'unverified',
      found: reads === 'correct' ? `Read as ${entry.expected}` : reads === 'incorrect' ? `Read as ${entry.assessment.recognized}` : lookAlike ? `Too unclear to read (closest: ${lookAlike})` : 'Too unclear to read',
      expected: entry.expected,
      // The strokes check below carries the specific correction, so this one never repeats it.
      fix: reads === 'incorrect' ? 'This looks like a different character. Redraw it from memory, following the stroke order.'
        : reads === 'uncertain' && !(countOff && advice.length) ? 'Redraw it with clear, separate strokes, or type the word.' : undefined,
    })
    if (entry.known) {
      const counted = entry.drawnStrokes === entry.expectedStrokes
      const coaching = reads !== 'correct' && (!counted || entry.strokes.some((stroke) => stroke.status !== 'ok') || entry.extraStrokes.length > 0)
      // A wrong stroke count is a fact, not an opinion: it decides the review when the
      // character is not read as correct, so an unclear drawing still gets a concrete
      // "revise" instead of "unverified". A single stroke that merely looks out of place
      // only coaches. The score still comes from the classifier alone.
      const wrongCount = reads !== 'correct' && !counted
      checks.push({
        id: `char-${position}-strokes`, stage: 'recall', decisive: wrongCount,
        label: `${name} has the right strokes`,
        status: wrongCount ? 'fail' : coaching ? 'partial' : 'pass',
        found: `${plural(entry.drawnStrokes, 'stroke')} drawn`, expected: `${plural(entry.expectedStrokes ?? 0, 'stroke')}`,
        fix: coaching ? advice.join(' ') || undefined : undefined,
      })
    }
  })
  return buildReview(context.task, checks)
}
