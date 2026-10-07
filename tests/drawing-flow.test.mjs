import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decodeHandwritingModel } from '../src/lib/handwriting.ts'
import { diagnoseWord } from '../src/lib/handwriting-review.ts'
import { drawingTask, inkForRetry, positionsToFix, redrawLabel } from '../src/lib/drawing-flow.ts'
import { reviewTypedWord } from '../src/lib/word-review.ts'

const data = readFileSync(new URL('../src/assets/handwriting/medians.bin', import.meta.url))
const model = decodeHandwritingModel(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
const template = (character) => model.templates.find((entry) => entry.character === character)
function ink(character, { drop = [] } = {}) {
  return template(character).strokes
    .map((stroke, s) => ({ s, stroke }))
    .filter(({ s }) => !drop.includes(s))
    .map(({ stroke }) => Array.from({ length: stroke.length / 2 }, (_, i) => [stroke[i * 2] * 240 + 30, stroke[i * 2 + 1] * 240 + 40]))
}

test('the task is restated from the cue and never contains the answer', () => {
  const word = { en: 'law', pinyin: 'fǎlǜ' }
  assert.equal(drawingTask('meaning', word, 2), 'Draw the word for “law” (2 characters)')
  assert.equal(drawingTask('sound', word, 2), 'Draw the word you hear (2 characters)')
  assert.equal(drawingTask('pinyin', word, 1), 'Draw the word read “fǎlǜ” (1 character)')
  for (const cue of ['meaning', 'sound', 'pinyin']) assert.doesNotMatch(drawingTask(cue, word, 2), /[㐀-鿿]/)
})

test('only characters that did not read correctly are sent back, and they keep ink only when it is close', () => {
  const drawings = [ink('法'), ink('律', { drop: [0] })]
  const diagnosis = diagnoseWord(drawings, model, '法律')
  assert.deepEqual(positionsToFix(diagnosis), [1])
  const kept = inkForRetry(drawings, diagnosis)
  assert.equal(kept[0], drawings[0], 'a correct character is kept as drawn')
  assert.equal(kept[1].length, 8, 'a character one stroke short keeps its ink so the stroke can be added')

  const wrong = [ink('法'), ink('三')]
  const wrongDiagnosis = diagnoseWord(wrong, model, '法律')
  assert.deepEqual(positionsToFix(wrongDiagnosis), [1])
  assert.deepEqual(inkForRetry(wrong, wrongDiagnosis)[1], [], 'a different character starts fresh')

  const clean = diagnoseWord([ink('法'), ink('律')], model, '法律')
  assert.deepEqual(positionsToFix(clean), [])
})

test('the redraw button says exactly what to redraw', () => {
  assert.equal(redrawLabel([1], 2), 'Redraw character 2')
  assert.equal(redrawLabel([0, 1], 2), 'Redraw the word')
  assert.equal(redrawLabel([0, 2], 3), 'Redraw characters 1 and 3')
  assert.equal(redrawLabel([0, 1, 3], 4), 'Redraw characters 1, 2 and 4')
  assert.equal(redrawLabel([0], 1), 'Redraw character 1')
  assert.equal(redrawLabel([], 2), 'Check again')
})

test('a typed word is checked for script, length and each character, without printing the answer', () => {
  const task = 'Type the word for “law”'
  assert.equal(reviewTypedWord(task, '法律', '法律').verdict, 'passed')
  assert.equal(reviewTypedWord(task, ' 法 律。', '法律').verdict, 'passed', 'spacing and punctuation are not part of the word')

  const pinyin = reviewTypedWord(task, 'falv', '法律')
  assert.equal(pinyin.verdict, 'revise')
  assert.equal(pinyin.issues[0].id, 'hanzi')
  assert.deepEqual(pinyin.checks.map((entry) => entry.id), ['hanzi'], 'nothing else can be judged until it is Hanzi')

  const short = reviewTypedWord(task, '法', '法律')
  assert.equal(short.checks.find((entry) => entry.id === 'length').status, 'fail')
  assert.equal(short.checks.find((entry) => entry.id === 'char-1').status, 'pass')
  assert.match(short.checks.find((entry) => entry.id === 'char-2').fix, /missing/)

  const wrong = reviewTypedWord(task, '法立', '法律')
  assert.equal(wrong.verdict, 'revise')
  const second = wrong.checks.find((entry) => entry.id === 'char-2')
  assert.equal(second.status, 'fail')
  assert.equal(second.found, '立')
  assert.equal(second.spoils, true)
  assert.doesNotMatch(second.fix, /律/, 'the fix tells where the mistake is, not the answer')

  const swapped = reviewTypedWord(task, '律法', '法律')
  assert.match(swapped.issues[0].fix, /wrong order/)
})
