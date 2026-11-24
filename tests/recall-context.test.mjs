import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { contextWindow, CONTEXT_MAX } from '../src/lib/recallContext.ts'

const size = (text) => Array.from(text).filter((ch) => ch === '＿' || /\p{Script=Han}/u.test(ch)).length

test('a short sentence is shown whole, with its translation', () => {
  const line = contextWindow('快用纸＿＿。', 'Wipe it quickly with a tissue.')
  assert.deepEqual(line, { zh: '快用纸＿＿。', en: 'Wipe it quickly with a tissue.' })
})

test('a long text shows only the sentence that holds the blank, with its own translation', () => {
  const blank = '今天早上我在地铁站遇到了王静，她这次是来旅游的，我们聊了很久。她＿＿后就去上海工作了，现在过得很好。我们约好下次再见面。'
  const en = 'I met Wang Jing at the subway station this morning, and we talked for a long time. She went to work in Shanghai after graduating, and she is doing well. We agreed to meet again.'
  const line = contextWindow(blank, en)
  assert.equal(line.zh, '她＿＿后就去上海工作了，现在过得很好。')
  assert.equal(line.en, 'She went to work in Shanghai after graduating, and she is doing well.')
})

test('a translation that no longer lines up is dropped, never shown against the wrong text', () => {
  const blank = '今天早上我在地铁站遇到了王静，她这次是来旅游的，我们聊了很久。她＿＿后就去上海工作了，现在过得很好。我们约好下次再见面。'
  const line = contextWindow(blank, 'One sentence only, with no way to match it.')
  assert.equal(line.zh, '她＿＿后就去上海工作了，现在过得很好。')
  assert.equal(line.en, null)
})

test('one very long sentence is cut to the clauses around the blank, with ellipses and no translation', () => {
  const blank = '一到节日，商场也会举办＿种各样的活动，降低价格，这个时候我们也可以买到又便宜又好的东西，大家都很开心。'
  const line = contextWindow(blank, 'On holidays the mall holds many kinds of events.')
  assert.ok(line.zh.includes('＿'))
  assert.ok(size(line.zh) <= CONTEXT_MAX)
  assert.ok(line.zh.startsWith('…') || line.zh.endsWith('…'))
  assert.equal(line.en, null)
})

test('the blank always survives the cut', () => {
  const clause = '这是一个很长很长的句子'
  for (let before = 0; before < 6; before++) {
    for (let after = 0; after < 6; after++) {
      const blank = `${(clause + '，').repeat(before)}我想＿＿他，${(clause + '，').repeat(after)}好。`
      assert.ok(contextWindow(blank).zh.includes('＿'), `before=${before} after=${after}`)
    }
  }
})

test('every HSK word: the sentence never shows the answer, and the card stays readable', async () => {
  const http = createHttpServer()
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { server: http } }, appType: 'custom' })
  try {
    const content = await server.ssrLoadModule('/src/lib/content.ts')
    let checked = 0
    for (const word of content.vocabIndex) {
      const blanked = content.blankedExample(word.zh)
      if (!blanked) continue
      checked++
      assert.ok(!blanked.blank.includes(word.zh), `${word.zh} is still visible: ${blanked.blank}`)
      const card = contextWindow(blanked.blank, blanked.en)
      assert.ok(card.zh.includes('＿'), `${word.zh} lost its blank`)
      assert.ok(size(card.zh) <= CONTEXT_MAX, `${word.zh} card is ${size(card.zh)} characters`)
    }
    assert.ok(checked > 300, `only ${checked} words have a sentence`)
  } finally {
    await server.close()
    http.close()
  }
})
