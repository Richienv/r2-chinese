import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decodeHandwritingModel } from '../src/lib/handwriting.ts'
import { describeStroke, diagnoseCharacter, diagnoseWord, reviewDrawing, strokeAdvice } from '../src/lib/handwriting-review.ts'

const data = readFileSync(new URL('../src/assets/handwriting/medians.bin', import.meta.url))
const model = decodeHandwritingModel(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
const template = (character) => model.templates.find((entry) => entry.character === character)

/** Ink traced from the real corpus strokes, as a person would draw at some size and place. */
function ink(character, { scale = 240, x = 30, y = 40, noise = 0, drop = [], add = [], move = {} } = {}) {
  return template(character).strokes
    .map((stroke, s) => ({ s, stroke }))
    .filter(({ s }) => !drop.includes(s))
    .map(({ s, stroke }) => Array.from({ length: stroke.length / 2 }, (_, i) => [
      stroke[i * 2] * scale + x + Math.sin(i * 2.5 + s) * noise + (move[s]?.[0] ?? 0) * scale,
      stroke[i * 2 + 1] * scale + y + Math.cos(i * 2.1 + s) * noise + (move[s]?.[1] ?? 0) * scale,
    ]))
    .concat(add)
}

test('strokes are described in plain words with a position', () => {
  const words = template('三').strokes.map(describeStroke)
  assert.deepEqual(words.map((word) => word.split(' ')[0] + ' ' + word.split(' ')[1]), ['horizontal stroke', 'horizontal stroke', 'horizontal stroke'])
  assert.match(words[0], /at the top/)
  assert.match(words[2], /at the bottom/)
  const ten = template('十').strokes.map(describeStroke)
  assert.match(ten[0], /^horizontal stroke/)
  assert.match(ten[1], /^vertical stroke/)
  assert.ok(template('人').strokes.map(describeStroke).some((word) => /left-falling/.test(word)))
  assert.ok(template('人').strokes.map(describeStroke).some((word) => /right-falling/.test(word)))
})

for (const character of ['法', '律', '你', '好', '木']) {
  test(`${character}: a correct drawing is read correctly and no stroke is reported as missing, extra or off`, () => {
    for (const options of [{}, { scale: 120, x: 200, y: 90, noise: 2 }]) {
      const diagnosis = diagnoseCharacter(ink(character, options), model, character)
      assert.equal(diagnosis.known, true)
      assert.equal(diagnosis.assessment.status, 'correct')
      assert.equal(diagnosis.drawnStrokes, diagnosis.expectedStrokes)
      assert.deepEqual(diagnosis.strokes.filter((stroke) => stroke.status !== 'ok'), [])
      assert.deepEqual(diagnosis.extraStrokes, [])
      assert.deepEqual(strokeAdvice(diagnosis), [])
    }
  })
}

// Ground truth: remove a known stroke from the real corpus drawing and the diagnosis must name that stroke.
for (const [character, dropped] of [['法', 7], ['律', 0], ['律', 3], ['木', 1], ['好', 2], ['你', 6], ['日', 1], ['水', 3]]) {
  test(`${character}: leaving out stroke ${dropped + 1} is reported as exactly that stroke`, () => {
    for (const noise of [0, 3]) {
      const diagnosis = diagnoseCharacter(ink(character, { drop: [dropped], noise }), model, character)
      assert.equal(diagnosis.drawnStrokes, diagnosis.expectedStrokes - 1)
      const missing = diagnosis.strokes.filter((stroke) => stroke.status === 'missing').map((stroke) => stroke.index)
      assert.deepEqual(missing, [dropped + 1], `${character} (noise ${noise}) expected stroke ${dropped + 1}, got ${JSON.stringify(diagnosis)}`)
      assert.notEqual(diagnosis.assessment.status, 'correct', 'an incomplete character must not pass')
      assert.ok(strokeAdvice(diagnosis).some((line) => line.includes(`stroke ${dropped + 1} of ${diagnosis.expectedStrokes}`)))
    }
  })
}

// The safety property that matters more than any single hit: a stroke is never blamed unless it is the right one.
test('the diagnosis never names the wrong stroke as missing, across every stroke of several characters', () => {
  let named = 0, shortlisted = 0, silent = 0
  for (const character of ['法', '律', '木', '好', '你', '三', '日', '水', '国', '我', '们']) {
    const strokeCount = template(character).strokes.length
    for (let dropped = 0; dropped < strokeCount; dropped++) {
      for (const noise of [0, 3]) {
        const diagnosis = diagnoseCharacter(ink(character, { drop: [dropped], noise }), model, character)
        const missing = diagnosis.strokes.filter((stroke) => stroke.status === 'missing').map((stroke) => stroke.index)
        if (missing.length) {
          named++
          assert.deepEqual(missing, [dropped + 1], `${character} drop ${dropped + 1} (noise ${noise}) was blamed on ${missing}`)
        } else if (diagnosis.possiblyMissing.length) {
          shortlisted++
          assert.ok(diagnosis.possiblyMissing.includes(dropped + 1), `${character} drop ${dropped + 1} (noise ${noise}) shortlist ${diagnosis.possiblyMissing} omits the real one`)
          assert.equal(diagnosis.unlocatedMissing, 1)
        } else {
          silent++
          assert.equal(diagnosis.unlocatedMissing, 1, `${character} drop ${dropped + 1}: a shortage must at least be reported`)
        }
      }
    }
  }
  // Most strokes can be named outright; the rest are honestly vague rather than wrong.
  assert.ok(named > shortlisted + silent, `named ${named}, shortlisted ${shortlisted}, silent ${silent}`)
})

test('三: when the shortage cannot be placed it says so instead of accusing a stroke', () => {
  const diagnosis = diagnoseCharacter(ink('三', { drop: [2] }), model, '三')
  assert.equal(diagnosis.drawnStrokes, 2)
  assert.equal(diagnosis.expectedStrokes, 3)
  assert.equal(diagnosis.unlocatedMissing, 1)
  assert.deepEqual(diagnosis.strokes.filter((stroke) => stroke.status === 'missing'), [])
  assert.match(strokeAdvice(diagnosis)[0], /1 stroke short/)
})

test('律: two near-identical horizontals give a short list that contains the real one', () => {
  const diagnosis = diagnoseCharacter(ink('律', { drop: [5] }), model, '律')
  assert.equal(diagnosis.unlocatedMissing, 1)
  assert.ok(diagnosis.possiblyMissing.includes(6))
  assert.ok(diagnosis.possiblyMissing.length >= 2 && diagnosis.possiblyMissing.length <= 3)
  assert.match(strokeAdvice(diagnosis)[0], /It is one of: .*stroke 6/)
})

test('an extra stroke is found by its position among the strokes drawn', () => {
  const stray = [[40, 60], [250, 280]]
  const diagnosis = diagnoseCharacter(ink('法', { add: [stray] }), model, '法')
  assert.equal(diagnosis.drawnStrokes, 9)
  assert.deepEqual(diagnosis.extraStrokes, [9])
  assert.ok(strokeAdvice(diagnosis).some((line) => /Remove the extra stroke \(stroke 9 of what you drew; this character has 8\)/.test(line)))
})

test('a stroke drawn in the wrong place is reported as off, with the others left alone', () => {
  const diagnosis = diagnoseCharacter(ink('好', { move: { 0: [0.5, 0.45] } }), model, '好')
  const off = diagnosis.strokes.filter((stroke) => stroke.status === 'off').map((stroke) => stroke.index)
  assert.ok(off.includes(1), `stroke 1 should be flagged, got ${JSON.stringify(diagnosis.strokes)}`)
  assert.equal(diagnosis.strokes.filter((stroke) => stroke.status === 'missing').length, 0)
})

test('a confidently different character is named, with the expected one never used to rank it', () => {
  const diagnosis = diagnoseCharacter(ink('律'), model, '法')
  assert.equal(diagnosis.assessment.status, 'incorrect')
  assert.equal(diagnosis.assessment.recognized, '律')
  assert.equal(diagnosis.candidates[0].character, '律')
  assert.equal(diagnosis.candidates.length, 3)
})

test('empty ink and characters outside the corpus are handled without guessing', () => {
  const empty = diagnoseCharacter([], model, '法')
  assert.equal(empty.drawnStrokes, 0)
  assert.deepEqual(empty.strokes, [])
  const rare = diagnoseCharacter(ink('法'), model, '\u{2A6A5}')
  assert.equal(rare.known, false)
  assert.equal(rare.expectedStrokes, null)
})

test('a word review ties every requirement to what was drawn and says what to fix', () => {
  const context = { task: 'Draw the word that means "law"', characterCount: 2 }
  const good = reviewDrawing(context, diagnoseWord([ink('法'), ink('律')], model, '法律'))
  assert.equal(good.verdict, 'passed')
  assert.equal(good.issues.length, 0)

  const missingStroke = reviewDrawing(context, diagnoseWord([ink('法'), ink('律', { drop: [0] })], model, '法律'))
  assert.equal(missingStroke.verdict, 'revise')
  assert.equal(missingStroke.checks.find((entry) => entry.id === 'char-1-reads').status, 'pass')
  const second = missingStroke.checks.find((entry) => entry.id === 'char-2-reads')
  assert.notEqual(second.status, 'pass')
  const strokes = missingStroke.checks.find((entry) => entry.id === 'char-2-strokes')
  assert.equal(strokes.decisive, true, 'a wrong stroke count decides when the character is not read as correct')
  assert.equal(strokes.status, 'fail')
  assert.match(strokes.fix, /stroke 1 of 9/)
  assert.equal(strokes.found, '8 strokes drawn')
  assert.equal(strokes.expected, '9 strokes')

  const wrong = reviewDrawing(context, diagnoseWord([ink('法'), ink('三')], model, '法律'))
  assert.equal(wrong.verdict, 'revise')
  const wrongRead = wrong.checks.find((entry) => entry.id === 'char-2-reads')
  assert.equal(wrongRead.status, 'fail')
  assert.equal(wrongRead.found, 'Read as 三')
  assert.equal(wrongRead.expected, '律')

  const incomplete = reviewDrawing(context, diagnoseWord([ink('法'), []], model, '法律'))
  assert.equal(incomplete.checks.find((entry) => entry.id === 'drawn-all').status, 'fail')
  assert.equal(incomplete.checks.find((entry) => entry.id === 'drawn-all').found, '1 of 2 drawn')
})
