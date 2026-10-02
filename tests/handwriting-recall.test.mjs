import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { blankWordInk, handwritingRecallEvidence, handwritingRetryMessage, replaceCharacterInk, wordInkComplete } from '../src/lib/handwriting-recall.ts'

const ink = [[[40, 60], [230, 64]], [[150, 20], [150, 280]]]

test('two- and three-character words wait for every drawing and allow editing earlier glyphs', () => {
  for (const count of [2, 3]) {
    let drawings = blankWordInk(count)
    assert.equal(wordInkComplete(drawings), false)
    for (let position = 0; position < count; position++) {
      drawings = replaceCharacterInk(drawings, position, ink)
      assert.equal(wordInkComplete(drawings), position === count - 1)
    }
    const laterCharacters = drawings.slice(1)
    drawings = replaceCharacterInk(drawings, 0, [])
    assert.equal(wordInkComplete(drawings), false)
    assert.deepEqual(drawings.slice(1), laterCharacters)
    drawings = replaceCharacterInk(drawings, 0, ink)
    assert.equal(wordInkComplete(drawings), true)
  }
  assert.equal(wordInkComplete([]), false)
  assert.equal(wordInkComplete([[[]]]), false)
})

test('saved character ink is independent of the mutable pointer stroke and other character positions', () => {
  const strokes = [[[10, 20], [90, 20]]]
  const blank = blankWordInk(3)
  const saved = replaceCharacterInk(blank, 0, strokes)
  strokes[0].push([130, 20])
  strokes[0][0][0] = 999
  assert.deepEqual(saved[0], [[[10, 20], [90, 20]]])
  assert.deepEqual(blank, [[], [], []])
  assert.equal(saved[1], blank[1])
  assert.equal(replaceCharacterInk(saved, 8, ink), saved)
})

test('ambiguous handwriting produces no knowledge evidence, while definitive judgments do', () => {
  assert.equal(handwritingRecallEvidence('uncertain'), undefined)
  assert.equal(handwritingRecallEvidence('incorrect'), false)
  assert.equal(handwritingRecallEvidence('correct'), true)
})

test('retry feedback names only positions; even classifier glyphs and reasons remain blind', () => {
  const characters = [
    { status: 'correct', recognized: '法', distance: .1, margin: .1, reason: '法 recognized' },
    { status: 'incorrect', recognized: '三', distance: .1, margin: .1, reason: 'Expected 律, read 三' },
  ]
  const wrong = handwritingRetryMessage({ status: 'incorrect', characters, recognized: '法三', reason: 'Expected 法律' })
  assert.match(wrong, /character 2/)
  assert.doesNotMatch(wrong, /[\u3400-\u9fff]/)
  const uncertain = handwritingRetryMessage({ status: 'uncertain', characters: [{ ...characters[1], status: 'uncertain' }], recognized: null, reason: 'Could be 法 or 律' })
  assert.match(uncertain, /isn’t scored/)
  assert.doesNotMatch(uncertain, /[\u3400-\u9fff]/)
})

test('the actual writing pad renders numbered progress and ink tools without any candidates or typed answer', async () => {
  const component = fileURLToPath(new URL('../src/components/HandwritingPad.tsx', import.meta.url))
  const directory = mkdtempSync(join(tmpdir(), 'hsk-blind-ink-'))
  try {
    const result = await build({
      stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {HandwritingPad} from ${JSON.stringify(component)}; export function renderPad(drawing) { return renderToStaticMarkup(React.createElement(HandwritingPad, {drawing, onChange:()=>{}, position:2, total:3})); }`, resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx' },
      bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
      plugins: [{ name: 'ui-static-assets', setup(builder) {
        builder.onResolve({ filter: /\.(css|bin|TXT)(\?url)?$/ }, (args) => ({ path: args.path, namespace: 'static-asset' }))
        builder.onLoad({ filter: /.*/, namespace: 'static-asset' }, () => ({ contents: 'export default "local-asset"', loader: 'js' }))
      } }],
    })
    const output = join(directory, 'pad.cjs')
    writeFileSync(output, result.outputFiles[0].contents)
    const { renderPad } = createRequire(import.meta.url)(output)
    const html = renderPad(ink)
    assert.match(html, /Character 2 of 3/)
    assert.match(html, /Draw character 2 of 3/)
    assert.match(html, /Undo stroke/)
    assert.match(html, /Clear character/)
    assert.doesNotMatch(html, /handwriting-candidate|Ranked handwriting|Choose a matching|<input|[\u3400-\u9fff]/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
