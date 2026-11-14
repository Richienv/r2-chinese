import test from 'node:test'
import assert from 'node:assert/strict'
import { mandarinVoice, speechChunks, audioResponse } from '../src/lib/audioCache.ts'
import { createClipResolver } from '../src/lib/bookAudioIndex.ts'
test('a transient recording failure is retried after a short cooldown', () => {
  let now = 1000
  const resolve = createClipResolver(
    { version: 1, lines: {}, words: { 好: { f: 'one', s: 0, e: 1 } } },
    '/audio',
    () => true,
    () => now,
  )
  resolve('好').fail()
  assert.equal(resolve('好'), null)
  now += 30001
  assert.ok(resolve('好'))
})
test('device fallback prefers Mandarin CN and does not choose Cantonese', () => {
  const cantonese = { lang: 'zh-HK', name: 'HK' },
    taiwan = { lang: 'zh-TW', name: 'TW' },
    mainland = { lang: 'zh-CN', name: 'CN' }
  assert.equal(mandarinVoice([cantonese, taiwan, mainland]), mainland)
  assert.equal(mandarinVoice([cantonese]), undefined)
})
test('long narration is split without dropping text or breaking surrogate pairs', () => {
  const original = '我们学习汉语。你好，欢迎来到杭州！'.repeat(80) + '𠮷'
  const chunks = speechChunks(original)
  assert.equal(chunks.map((c) => c.text).join(''), original)
  for (const chunk of chunks) {
    assert.ok(chunk.text.length <= 350)
    assert.equal(original.slice(chunk.offset, chunk.offset + chunk.text.length), chunk.text)
  }
})
test('optional persistent caching survives cache failures and preserves network response', async () => {
  const fetch = globalThis.fetch,
    caches = globalThis.caches
  globalThis.fetch = async () => new Response('valid-audio', { status: 200 })
  globalThis.caches = {
    open: async () => {
      throw Error('quota')
    },
  }
  try {
    assert.equal(await (await audioResponse('/api/tts?text=test')).text(), 'valid-audio')
  } finally {
    globalThis.fetch = fetch
    if (caches === undefined) delete globalThis.caches
    else globalThis.caches = caches
  }
})
