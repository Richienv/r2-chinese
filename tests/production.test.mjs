import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeChinese, sourceAssessment, sourceWords, alignChinese, dialogueTurnIndexes, assessProduction } from '../src/lib/production.ts'
import { createMandarinRecognition, canRecognizeMandarin } from '../src/lib/recognition.ts'
import assessHandler from '../api/assess.ts'

const prompt = {
  expectedZh: '他不仅足球踢得好，性格也不错。',
  expectedEn: 'Not only does he play soccer well, his personality is great too.',
  targetWords: ['性格', '足球', '新闻'],
  response: '他不仅足球踢得好 性格也不错!',
}

test('source matching ignores punctuation and spacing, while preserving Hanzi and meaning-sensitive particles', () => {
  assert.equal(normalizeChinese(' 他，Ａ。 '), '他A')
  assert.equal(sourceAssessment(prompt).accepted, true)
  assert.equal(sourceAssessment({ ...prompt, response: '他不仅足球踢得好，性格不错。' }).accepted, null)
  assert.equal(sourceAssessment({ ...prompt, response: '她不仅足球踢得好，性格也不错。' }).accepted, null)
  assert.deepEqual(sourceWords(prompt.expectedZh, prompt.targetWords), ['性格', '足球'])
})

test('a different valid paraphrase is left unverified, never labelled grammatically wrong by string comparison', () => {
  const result = sourceAssessment({ ...prompt, response: '他足球踢得很好，而且性格也很好。' })
  assert.equal(result.accepted, null)
  assert.equal(result.evidence, 'practice')
  assert.match(result.feedback, /may be a valid alternative/)
  assert.deepEqual(result.usedWords, ['性格', '足球'])
  assert.deepEqual(result.missingWords, [])
})

test('alignment describes missing and added characters without inventing grammar errors', () => {
  assert.deepEqual(alignChinese('我爱你。', '我很爱你'), [
    { kind: 'same', text: '我' }, { kind: 'missing', text: '很' }, { kind: 'same', text: '爱你' },
  ])
  assert.deepEqual(alignChinese('我很爱你', '我爱你'), [
    { kind: 'same', text: '我' }, { kind: 'added', text: '很' }, { kind: 'same', text: '爱你' },
  ])
})

test('dialogue selects the requested source speaker and caps each activity at three actual replies', () => {
  const text = { lines: Array.from({ length: 10 }, (_, index) => ({ speaker: index % 2 ? '王静' : '孙月', zh: `句子${index}` })) }
  assert.deepEqual(dialogueTurnIndexes(text, '王静'), [1, 3, 5])
  assert.deepEqual(dialogueTurnIndexes(text, '孙月'), [0, 2, 4])
})

test('source matches need no network; absent grammar service returns transparent practice evidence', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => { throw new Error('source match must not use network') }
    assert.equal((await assessProduction(prompt)).evidence, 'source-match')
    globalThis.fetch = async () => new Response('{}', { status: 503 })
    const result = await assessProduction({ ...prompt, response: '他足球踢得很好，而且性格也很好。' })
    assert.equal(result.accepted, null)
    assert.equal(result.evidence, 'practice')
    assert.match(result.unavailable, /unavailable/)
  } finally { globalThis.fetch = originalFetch }
})

test('recognition is user-started, includes interim Mandarin, replaces repeated finals, and aborts on disposal', () => {
  const originalWindow = globalThis.window
  const instances = []
  class Recognition {
    starts = 0
    stops = 0
    aborts = 0
    constructor() { instances.push(this) }
    start() { this.starts++ }
    stop() { this.stops++ }
    abort() { this.aborts++ }
  }
  const states = []
  const finals = []
  try {
    globalThis.window = { isSecureContext: true, SpeechRecognition: Recognition }
    assert.equal(canRecognizeMandarin(), true)
    const controller = createMandarinRecognition({ onState: (state) => states.push(state), onFinal: (value) => finals.push(value) })
    assert.equal(instances.length, 0)
    controller.start()
    const recognition = instances[0]
    assert.equal(recognition.lang, 'zh-CN')
    assert.equal(recognition.starts, 1)
    recognition.onstart()
    recognition.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: '我爱' } }] })
    assert.equal(states.at(-1).interim, '我爱')
    assert.equal(finals.length, 0)
    recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '我爱中文' } }] })
    recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '我爱中文' } }] })
    assert.equal(finals.at(-1), '我爱中文')
    controller.stop()
    assert.equal(recognition.stops, 1)
    controller.dispose()
    assert.equal(recognition.aborts, 1)
    assert.equal(recognition.onresult, null)
  } finally { globalThis.window = originalWindow }
})

test('unsupported recognition retains a typed fallback without microphone requests', () => {
  const originalWindow = globalThis.window
  try {
    globalThis.window = { isSecureContext: false }
    let snapshot
    const controller = createMandarinRecognition({ onState: (value) => { snapshot = value }, onFinal() { assert.fail('No result expected') } })
    controller.start()
    assert.equal(snapshot.status, 'unsupported')
    assert.match(snapshot.error, /Type below/)
    controller.dispose()
  } finally { globalThis.window = originalWindow }
})

function mockResponse() {
  return { headers: {}, statusCode: 0, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = JSON.parse(body) } }
}

test('grammar route requires server configuration and rejects cross-origin requests', async () => {
  const key = process.env.OPENAI_API_KEY
  try {
    delete process.env.OPENAI_API_KEY
    const absent = mockResponse()
    await assessHandler({ method: 'POST', headers: { 'content-type': 'application/json' }, body: prompt }, absent)
    assert.equal(absent.statusCode, 503)
    process.env.OPENAI_API_KEY = 'test-placeholder'
    const foreign = mockResponse()
    await assessHandler({ method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost:5174', origin: 'https://other.invalid' }, body: prompt }, foreign)
    assert.equal(foreign.statusCode, 403)
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = key
  }
})

test('grammar route uses strict structured output, disables response storage, and accepts a reviewed paraphrase', async () => {
  const key = process.env.OPENAI_API_KEY
  const originalFetch = globalThis.fetch
  try {
    process.env.OPENAI_API_KEY = 'test-placeholder'
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body)
      assert.equal(payload.store, false)
      assert.equal(payload.text.format.type, 'json_schema')
      assert.equal(payload.text.format.strict, true)
      assert.match(payload.instructions, /not the only correct answer/)
      return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ accepted: true, feedback: '而且 links two compatible descriptions naturally.', correctedZh: '他足球踢得很好，而且性格也很好。', issues: [] }) }] }] }))
    }
    const res = mockResponse()
    await assessHandler({ method: 'POST', headers: { 'content-type': 'application/json' }, body: { ...prompt, response: '他足球踢得很好，而且性格也很好。' } }, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.accepted, true)
    assert.equal(res.body.evidence, 'verified')
    assert.equal(res.headers['Cache-Control'], 'no-store')
  } finally {
    globalThis.fetch = originalFetch
    if (key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = key
  }
})
