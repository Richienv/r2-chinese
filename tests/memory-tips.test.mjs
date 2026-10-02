import test from 'node:test'
import assert from 'node:assert/strict'
import { memoryTips } from '../src/lib/memoryTips.ts'

test('memory tips blank every target occurrence without rewriting the book line', () => {
  const word = { zh: '法律', pinyin: 'fǎlǜ', en: 'law', pos: 'n.', note: '' }
  const example = { zh: '我学法律，因为我喜欢法律。', pinyin: '', en: 'I study law because I like law.' }
  const tips = memoryTips(word, example)
  const recall = tips.find((tip) => tip.title === 'Retrieve it inside the book line')
  assert.equal(recall.cue, '我学____，因为我喜欢____。')
  assert.ok(!recall.cue.includes(word.zh))
  assert.ok(tips.length >= 5)
  assert.ok(tips.find((tip) => tip.title === 'Give the shape a cue').body.includes('not an etymology'))
})

test('every course gets useful memory cues without inventing a missing source example', () => {
  const word = { zh: '项目', pinyin: 'xiàng mù', en: 'project', pos: 'n.', note: '' }
  const tips = memoryTips(word, null)
  assert.ok(tips.length >= 3)
  assert.ok(tips.some((tip) => tip.body.includes('project')))
  assert.ok(!tips.some((tip) => tip.title === 'Retrieve it inside the book line'))
  assert.equal(memoryTips(word, { zh: '你好。', pinyin: 'nǐ hǎo', en: 'Hello.' }).some((tip) => tip.title === 'Retrieve it inside the book line'), false)
})
