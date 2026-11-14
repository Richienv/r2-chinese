import test from 'node:test'
import assert from 'node:assert/strict'
import { repairParts, repairAnswer, guidedPrompt } from '../src/lib/repair.ts'
test('correct sentence runs stay fixed and only the typo is editable', () => {
  const parts = repairParts('我喜欢中果', '我喜欢中国')
  assert.deepEqual(parts, [
    { kind: 'keep', text: '我喜欢中' },
    { kind: 'edit', original: '果', target: '国' },
  ])
  assert.equal(repairAnswer(parts, { 1: '国' }), '我喜欢中国')
})
test('missing, extra and repeated characters stay aligned', () => {
  for (const [answer, target] of [
    ['我喜欢国', '我喜欢中国'],
    ['我我喜欢中国', '我喜欢中国'],
    ['法律', '法律'],
    ['律法', '法律'],
    ['', '你好'],
  ]) {
    const parts = repairParts(answer, target),
      edits = Object.fromEntries(parts.map((p, i) => [i, p.kind === 'edit' ? p.target : '']))
    assert.equal(repairAnswer(parts, edits), target)
  }
})
test('one-word scaffolding preserves the original sentence and hides only the selected lesson word', () => {
  assert.deepEqual(guidedPrompt('我们应该遵守法律。', ['法律']), {
    prefix: '我们应该遵守',
    target: '法律',
    suffix: '。',
  })
  assert.equal(guidedPrompt('你好。', ['学习']), null)
})
test('long answers are never silently truncated by the repair editor', () => {
  const response = '我们'.repeat(350) + '中果',
    target = '我们'.repeat(350) + '中国'
  const parts = repairParts(response, target),
    edits = Object.fromEntries(parts.flatMap((p, i) => (p.kind === 'edit' ? [[i, p.target]] : [])))
  assert.equal(repairAnswer(parts, {}), response)
  assert.equal(repairAnswer(parts, edits), target)
})
