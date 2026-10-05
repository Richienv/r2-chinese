import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { listeningScripts, nextListeningScript, learnedHskWords, compositionBundle } from '../src/lib/hskPractice.ts'
import { writingCoverage, reviewComposition } from '../src/lib/composition.ts'
import { alignSpeechBoundaries, parseSpeechMetadata } from '../api/tts.ts'
import { rangesOverlap, timingAt } from '../src/lib/speechTiming.ts'
import assessHandler from '../api/assess.ts'

const { lessons } = JSON.parse(await readFile(new URL('../src/data/hsk4a.json', import.meta.url), 'utf8'))

test('listening combines all 25 exact scripts in lessons 1–5, with ordered speakers and no rewritten text', () => {
  const scripts = listeningScripts(lessons)
  assert.equal(scripts.length, 25)
  assert.equal(scripts.filter((script) => script.text.type === 'dialogue').length, 15)
  assert.deepEqual([...new Set(scripts.map((script) => script.lesson))], [1, 2, 3, 4, 5])
  assert.equal(new Set(scripts.map((script) => script.id)).size, 25)
  for (const script of scripts) assert.ok(lessons.find((lesson) => lesson.lesson === script.lesson).texts.includes(script.text))
  assert.equal(listeningScripts(lessons, 3, 3).length, 5)
})

test('auto-next, repeat one, repeat all and the end of a queue have explicit stopping behavior', () => {
  assert.equal(nextListeningScript(0, 25, true, 'off'), 1)
  assert.equal(nextListeningScript(24, 25, true, 'off'), null)
  assert.equal(nextListeningScript(24, 25, true, 'all'), 0)
  assert.equal(nextListeningScript(7, 25, false, 'all'), null)
  assert.equal(nextListeningScript(7, 25, false, 'script'), 7)
  assert.equal(nextListeningScript(0, 0, true, 'all'), null)
})

test('writing uses only learned/drilled HSK vocabulary and combines lessons without introducing unseen words', () => {
  const a = lessons[0].vocab[0].zh
  const b = lessons[1].vocab[0].zh
  const c = lessons[3].vocab[0].zh
  const pool = learnedHskWords(lessons, [a, b, 'not-in-hsk'], [c, a])
  assert.deepEqual(new Set(pool.map((word) => word.zh)), new Set([a, b, c]))
  const bundle = compositionBundle(pool, { [c]: { state: 'hard', lastPractice: 9 } }, 0)
  assert.equal(bundle[0].zh, c)
  assert.equal(new Set(bundle.map((word) => word.lesson)).size, 3)
  assert.deepEqual(compositionBundle([], {}), [])
})

test('word coverage is separate from grammar and cannot credit substrings or words across punctuation', () => {
  const result = writingCoverage('我的爱好是踢足球。我不仅喜欢足球，也喜欢学习法律。', ['好', '爱好', '不仅', '法律', '俩'])
  assert.deepEqual(new Set(result.used), new Set(['爱好', '不仅', '法律']))
  assert.deepEqual(new Set(result.missing), new Set(['好', '俩']))
  assert.equal(writingCoverage('法。律。', ['法律']).used.length, 0)
})

test('word timing maps real service offsets to repeated source words without guessing positions', () => {
  const data = { Metadata: [
    { Type: 'WordBoundary', Data: { Offset: 1000000, Duration: 2200000, text: { Text: '我' } } },
    { Type: 'WordBoundary', Data: { Offset: 3300000, Duration: 4000000, text: { Text: '法律' } } },
    { Type: 'WordBoundary', Data: { Offset: 9500000, Duration: 4000000, text: { Text: '法律' } } },
    { Type: 'WordBoundary', Data: { Offset: 14000000, Duration: 1, text: { Text: '不存在' } } },
  ] }
  const boundaries = parseSpeechMetadata(`Path:audio.metadata\r\n\r\n${JSON.stringify(data)}`)
  assert.equal(boundaries[0].offset, .1)
  const words = alignSpeechBoundaries('我学法律，喜欢法律。', boundaries)
  assert.deepEqual(words.map((word) => word.charIndex), [0, 2, 7])
  assert.equal(timingAt(words, .05), undefined)
  assert.equal(timingAt(words, 1).charIndex, 7)
  assert.equal(rangesOverlap(2, 2, 3, 1), true)
  assert.equal(rangesOverlap(2, 2, 4, 1), false)
  assert.deepEqual(parseSpeechMetadata('Path:audio.metadata\r\n\r\n{broken'), [])
})

function resMock() {
  return { headers: {}, statusCode: 0, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = JSON.parse(body) } }
}

test('original writing route has no book answer and returns specific grammar reasons, with response storage disabled', async () => {
  const key = process.env.OPENAI_API_KEY
  const fetch = globalThis.fetch
  try {
    process.env.OPENAI_API_KEY = 'test-only'
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body)
      const input = JSON.parse(payload.input)
      assert.equal(input.mode, 'composition')
      assert.equal(input.expectedZh, undefined)
      assert.equal(payload.store, false)
      assert.match(payload.instructions, /ORIGINAL sentences/)
      assert.match(payload.instructions, /missing words must not make accepted false/)
      assert.equal(payload.text.format.schema.properties.corrections.items.additionalProperties, false)
      return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ accepted: false, feedback: 'Place the time before the action.', correctedZh: '我昨天学习法律。', issues: ['Time goes before the verb.'], corrections: [{ original: '学习法律昨天', corrected: '昨天学习法律', why: '昨天 sets the time for the whole action, so it goes before 学习.', rule: 'Subject + time + verb + object' }] }) }] }] }))
    }
    const res = resMock()
    await assessHandler({ method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': 'composition-test' }, body: { mode: 'composition', response: '我学习法律昨天。', targetWords: ['法律', '俩'] } }, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.evidence, 'verified')
    assert.match(res.body.corrections[0].why, /before 学习/)
  } finally {
    globalThis.fetch = fetch
    if (key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = key
  }
})

test('review accepts valid original sentences even with unused words and never invents a local grammar verdict when unavailable', async () => {
  const fetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ accepted: true, correctedZh: '他学习法律。', feedback: '学习 takes 法律 as its object.', corrections: [], evidence: 'verified' }))
    const result = await reviewComposition('他学习法律。', ['法律', '俩'])
    assert.equal(result.accepted, true)
    assert.deepEqual(result.missing, ['俩'])
    globalThis.fetch = async () => new Response('', { status: 503 })
    await assert.rejects(reviewComposition('他学习法律。', ['法律']), /unavailable/)
  } finally { globalThis.fetch = fetch }
})

test('grammar corrections allow removing an extra character instead of rejecting a valid deletion', async () => {
  const key = process.env.OPENAI_API_KEY
  const fetch = globalThis.fetch
  try {
    process.env.OPENAI_API_KEY = 'test-only'
    globalThis.fetch = async () => new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ accepted: false, feedback: '俩 already means two people.', correctedZh: '我们俩学习法律。', issues: ['Remove 个 after 俩.'], corrections: [{ original: '个', corrected: '', why: '俩 combines the number and the person count, so another measure word is redundant.', rule: 'Pronoun + 俩, without 个' }] }) }] }] }))
    const res = resMock()
    await assessHandler({ method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': 'composition-delete-test' }, body: { mode: 'composition', response: '我们俩个学习法律。', targetWords: ['俩', '法律'] } }, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.corrections[0].corrected, '')
  } finally {
    globalThis.fetch = fetch
    if (key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = key
  }
})
