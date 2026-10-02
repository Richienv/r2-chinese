import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { assessHandwriting, assessHandwritingWord, decodeHandwritingModel, normalizeInk, recognizeHandwriting, resampleStroke } from '../src/lib/handwriting.ts'

const data = readFileSync(new URL('../src/assets/handwriting/medians.bin', import.meta.url))
const model = decodeHandwritingModel(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
const provenance = JSON.parse(readFileSync(new URL('../src/assets/handwriting/provenance.json', import.meta.url)))

test('local corpus is the attributed universal 9,574-character data, not a lesson-answer dictionary', () => {
  assert.equal(model.templates.length, 9574)
  assert.equal(createHash('sha256').update(data).digest('hex'), provenance.corpus_sha256)
  assert.match(model.notice, /Arphic Public License/)
  for (const character of ['法', '律', '俩', '三', '我', '你', '龍', '鬱']) assert.ok(model.templates.some((entry) => entry.character === character))
})

test('normalization ignores translation and uniform scale but keeps relative stroke placement', () => {
  const drawing = [[[10, 30], [70, 30]], [[40, 0], [40, 80]]]
  const moved = drawing.map((stroke) => stroke.map(([x, y]) => [x * 3 + 200, y * 3 - 90]))
  assert.deepEqual(normalizeInk(drawing), normalizeInk(moved))
  const sampled = resampleStroke([[0, 0], [50, 0], [50, 50]], 5)
  assert.deepEqual(sampled, [[0, 0], [25, 0], [50, 0], [50, 25], [50, 50]])
})

for (const character of ['法', '律', '俩', '三', '我', '你']) {
  test(`${character} remains among top candidates across different sizes, translation and noisy curved traces`, () => {
    const source = model.templates.find((entry) => entry.character === character)
    for (const [scale, x, y, noise] of [[210, 34, 59, 3], [92, 230, -150, 2], [440, -200, 370, 7]]) {
      const drawing = source.strokes.map((stroke, s) => Array.from({ length: stroke.length / 2 }, (_, i) => [
        stroke[i * 2] * scale + x + Math.sin(i * 2.5 + s) * noise,
        stroke[i * 2 + 1] * scale + y + Math.cos(i * 2.1 + s) * noise,
      ]))
      const candidates = recognizeHandwriting(drawing, model)
      assert.ok(candidates.slice(0, 5).some((candidate) => candidate.character === character), `${character} missing from top 5: ${candidates.map((candidate) => candidate.character).join('')}`)
      assert.ok(candidates.every((candidate, i) => i === 0 || candidate.distance >= candidates[i - 1].distance))
    }
  })
}

const independentDrawings = {
  '三': [[[80, 75], [220, 72]], [[100, 160], [210, 161]], [[50, 252], [250, 250]]],
  '十': [[[60, 144], [264, 147]], [[162, 44], [158, 276]]],
  '人': [[[184, 57], [155, 155], [89, 252]], [[157, 140], [207, 199], [266, 249]]],
  '木': [[[54, 115], [265, 114]], [[157, 47], [157, 274]], [[154, 121], [111, 184], [46, 251]], [[174, 129], [219, 181], [277, 236]]],
}
test('independent hand-authored traces classify against the full corpus, without passing any expected answer', () => {
  for (const [character, drawing] of Object.entries(independentDrawings)) assert.equal(recognizeHandwriting(drawing, model)[0].character, character)
  for (const character of ['三', '十', '人']) {
    assert.equal(assessHandwriting(independentDrawings[character], model, character).status, 'correct')
    const mismatch = assessHandwriting(independentDrawings[character], model, '好')
    assert.equal(mismatch.status, 'incorrect')
    assert.equal(mismatch.recognized, character)
  }
})

test('empty and invalid input returns no candidates; corrupt corpus is rejected', () => {
  assert.deepEqual(recognizeHandwriting([], model), [])
  assert.deepEqual(recognizeHandwriting([[[NaN, 4]]], model), [])
  assert.throws(() => decodeHandwritingModel(new ArrayBuffer(20)), /Unsupported/)
  assert.throws(() => decodeHandwritingModel(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength - 1)), /Invalid|Incomplete/)
})

// Independently transcribed from the actual five-stroke user screenshot. The
// upper right stroke joins the child's top and hook; no font median is copied.
const looseFiveStrokeHao = [
  [[439, 418], [420, 492], [393, 565], [357, 642], [420, 697], [500, 764], [569, 831], [629, 878]],
  [[555, 470], [553, 528], [550, 570], [528, 622], [500, 665], [461, 719], [405, 766], [347, 810], [277, 846]],
  [[329, 469], [480, 469], [642, 469]],
  [[680, 377], [862, 377], [680, 443], [721, 524], [755, 633], [783, 752], [798, 827], [741, 824]],
  [[670, 554], [815, 554]],
]

function sourceDrawing(character) {
  return model.templates.find((entry) => entry.character === character).strokes.map((stroke) => Array.from({ length: 16 }, (_, i) => [stroke[i * 2] * 240 + 30, stroke[i * 2 + 1] * 240 + 40]))
}

test('the real loose five-stroke screenshot ranks independently as 好 across the whole corpus', () => {
  assert.equal(recognizeHandwriting(looseFiveStrokeHao, model)[0].character, '好')
  const scaled = looseFiveStrokeHao.map((stroke) => stroke.map(([x, y]) => [x * 0.3 - 40, y * 0.3 + 170]))
  assert.equal(recognizeHandwriting(scaled, model)[0].character, '好')
  const reordered = [looseFiveStrokeHao[4], looseFiveStrokeHao[0], looseFiveStrokeHao[2], looseFiveStrokeHao[1], looseFiveStrokeHao[3]]
  assert.equal(recognizeHandwriting(reordered, model)[0].character, '好')
  for (const drawing of [looseFiveStrokeHao, scaled, reordered]) {
    assert.equal(assessHandwriting(drawing, model, '好').status, 'correct')
    // Target changes the verdict, never recognition or the score.
    const wrongTarget = assessHandwriting(drawing, model, '妈')
    assert.equal(wrongTarget.status, 'incorrect')
    assert.equal(wrongTarget.recognized, '好')
  }
})

test('loose finger writing tolerates unequal proportions and pointer jitter without target conditioning', () => {
  for (let seed = 0; seed < 5; seed++) {
    const drawing = looseFiveStrokeHao.map((stroke, s) => stroke.map(([x, y], i) => [
      x * (seed % 2 ? 0.84 : 1.15) + Math.sin(i * 1.72 + s + seed) * 6,
      y * (seed % 2 ? 1.1 : 0.92) + Math.cos(i * 2.01 + s + seed) * 6,
    ]))
    assert.equal(recognizeHandwriting(drawing, model, 1)[0].character, '好')
    assert.equal(assessHandwriting(drawing, model, '好').status, 'correct')
  }
})

test('source-connected top and hook strokes remain recognized without an exact stroke count', () => {
  const canonical = sourceDrawing('好')
  const connected = [...canonical.slice(0, 3), [...canonical[3], ...canonical[4]], canonical[5]]
  const result = assessHandwriting(connected, model, '好')
  assert.equal(result.status, 'correct')
  assert.equal(result.recognized, '好')
})

test('blind assessment distinguishes neighboring glyphs and does not accept missing strokes or scribbles', () => {
  for (const [written, expected] of [['未', '末'], ['末', '未'], ['土', '士'], ['士', '土'], ['木', '本'], ['三', '二'], ['妈', '好'], ['你', '他'], ['女', '好'], ['子', '好'], ['如', '好'], ['奴', '好'], ['术', '好'], ['扑', '好']]) {
    const result = assessHandwriting(sourceDrawing(written), model, expected)
    assert.equal(result.status, 'incorrect', `${written} must not pass as ${expected}`)
    assert.equal(result.recognized, written)
  }
  assert.notEqual(assessHandwriting(sourceDrawing('好').slice(0, -1), model, '好').status, 'correct')
  const scribble = [[[10, 10], [250, 260], [30, 240], [270, 40], [20, 50], [280, 250], [100, 30]]]
  assert.equal(assessHandwriting(scribble, model, '好').status, 'uncertain')
  assert.equal(assessHandwriting([], model, '好').status, 'uncertain')
})

test('partial radicals, omitted screenshot strokes, wrong layout and malformed curves never pass the intended glyph', () => {
  const partial = looseFiveStrokeHao.map((_, omit) => looseFiveStrokeHao.filter((_, i) => i !== omit))
  const mirroredLayout = [
    ...looseFiveStrokeHao.slice(0, 3).map((stroke) => stroke.map(([x, y]) => [x + 430, y])),
    ...looseFiveStrokeHao.slice(3).map((stroke) => stroke.map(([x, y]) => [x - 430, y])),
  ]
  const boxInsteadOfHook = [...looseFiveStrokeHao.slice(0, 3), [[680, 377], [862, 377], [862, 827], [680, 827], [680, 377]], looseFiveStrokeHao[4]]
  for (const drawing of [...partial, looseFiveStrokeHao.slice(0, 3), looseFiveStrokeHao.slice(3), mirroredLayout, boxInsteadOfHook]) {
    assert.notEqual(assessHandwriting(drawing, model, '好').status, 'correct')
  }
  // A loose fragment must not earn a confident recognition just because its
  // two strokes share a graph with several unrelated two-stroke radicals.
  assert.equal(assessHandwriting(looseFiveStrokeHao.slice(3), model, '子').status, 'uncertain')
  for (const character of ['法', '律', '俩', '我', '你', '好']) {
    const source = sourceDrawing(character)
    for (let omit = 0; omit < source.length; omit++) assert.notEqual(assessHandwriting(source.filter((_, i) => i !== omit), model, character).status, 'correct', `${character} with stroke ${omit + 1} omitted must not pass`)
  }
})

test('word assessment has correct, mismatch and uncertain outcomes and never exposes expected Hanzi in reasons', () => {
  const correct = assessHandwritingWord([sourceDrawing('法'), sourceDrawing('律')], model, '法律')
  assert.equal(correct.status, 'correct')
  assert.equal(correct.recognized, '法律')
  const mismatch = assessHandwritingWord([sourceDrawing('法'), sourceDrawing('你')], model, '法律')
  assert.equal(mismatch.status, 'incorrect')
  assert.deepEqual(mismatch.characters.map((character) => character.status), ['correct', 'incorrect'])
  const uncertain = assessHandwritingWord([sourceDrawing('法')], model, '法律')
  assert.equal(uncertain.status, 'uncertain')
  for (const outcome of [correct, mismatch, uncertain]) assert.equal(/[\u3400-\u9fff]/.test(outcome.reason), false)
  assert.equal(assessHandwriting(sourceDrawing('好'), model, '\u{20000}').status, 'uncertain')
})

test('a near-equal neighboring-glyph match stays uncertain for either expected answer', () => {
  const first = model.templates.find((entry) => entry.character === '未').strokes
  const second = model.templates.find((entry) => entry.character === '末').strokes
  const ambiguous = first.map((stroke, s) => Array.from({ length: 16 }, (_, i) => [
    (stroke[i * 2] + second[s][i * 2]) * 120,
    (stroke[i * 2 + 1] + second[s][i * 2 + 1]) * 120,
  ]))
  for (const expected of ['未', '末']) {
    const result = assessHandwriting(ambiguous, model, expected)
    assert.equal(result.status, 'uncertain')
    assert.equal(result.recognized, null)
    assert.ok(result.margin < 0.015)
  }
})

test('worker classifier core completes loose and complex glyphs within a bounded regression budget', (context) => {
  for (const [label, drawing, expected] of [['loose five-stroke glyph', looseFiveStrokeHao, '好'], ['eight-stroke glyph', sourceDrawing('法'), '法'], ['nine-stroke glyph', sourceDrawing('律'), '律']]) {
    const start = performance.now()
    const result = assessHandwriting(drawing, model, expected)
    const elapsed = performance.now() - start
    context.diagnostic(`${label}: ${Math.round(elapsed)} ms on this test host`)
    assert.equal(result.status, 'correct')
    assert.ok(elapsed < 4000, 'Classifier exceeded its regression budget; recognition belongs in a worker.')
  }
})
