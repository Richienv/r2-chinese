import test from 'node:test'
import assert from 'node:assert/strict'
import assessHandler from '../api/assess.ts'
import { assessmentFailure, assessmentStatus, AssessmentServiceError } from '../src/lib/assessmentService.ts'
import { reviewComposition } from '../src/lib/composition.ts'
import { assessProduction } from '../src/lib/production.ts'

function responseMock() {
  return { headers: {}, statusCode: 0, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = JSON.parse(body) } }
}
const prompt = { mode: 'composition', response: '你好。', targetWords: ['法律', '俩', '性格'] }

test('connection status is uncached, spends no model credit, and never exposes server credentials', async () => {
  const fetch = globalThis.fetch
  try {
    globalThis.fetch = () => { assert.fail('Status must not contact the provider') }
    for (const [apiKey, configured] of [[undefined, false], ['   ', false], ['private-test-key', true]]) {
      const res = responseMock()
      await assessHandler({ method: 'GET', headers: {} }, res, { apiKey, model: 'private-model' })
      assert.equal(res.statusCode, 200)
      assert.deepEqual(res.body, { configured })
      assert.equal(res.headers['Cache-Control'], 'no-store')
      assert.doesNotMatch(JSON.stringify(res.body), /private/)
    }
  } finally { globalThis.fetch = fetch }
})

test('status honors origin checks and the declared methods without requiring a JSON request body', async () => {
  const foreign = responseMock()
  await assessHandler({ method: 'GET', headers: { host: 'localhost:5174', origin: 'https://other.invalid' } }, foreign, {})
  assert.equal(foreign.statusCode, 403)
  const unsupported = responseMock()
  await assessHandler({ method: 'DELETE', headers: {} }, unsupported, {})
  assert.equal(unsupported.statusCode, 405)
  assert.equal(unsupported.headers.Allow, 'GET, POST')
})

test('a missing key fails before provider access; newly supplied server config reviews the same draft', async () => {
  const fetch = globalThis.fetch
  const key = process.env.OPENAI_API_KEY
  let calls = 0
  try {
    process.env.OPENAI_API_KEY = 'stale-process-test-key'
    globalThis.fetch = async (_url, options) => {
      calls++
      assert.equal(options.headers.Authorization, 'Bearer fresh-server-test-key')
      assert.equal(JSON.parse(options.body).model, 'gpt-4.1-mini')
      return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ accepted: true, feedback: '你好 is a natural greeting.', correctedZh: '你好。', issues: [], corrections: [] }) }] }] }))
    }
    const req = { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': 'config-reconnect-test' }, body: prompt }
    const missing = responseMock()
    await assessHandler(req, missing, {})
    assert.equal(missing.statusCode, 503)
    assert.equal(missing.body.error, 'assessment_not_configured')
    assert.equal(calls, 0)
    const ready = responseMock()
    await assessHandler(req, ready, { apiKey: ' fresh-server-test-key ' })
    assert.equal(ready.statusCode, 200)
    assert.equal(ready.body.accepted, true)
    assert.equal(ready.body.correctedZh, prompt.response)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = fetch
    if (key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = key
  }
})

test('provider credential, model, billing, rate, and outage failures have distinct safe recovery codes', async () => {
  const fetch = globalThis.fetch
  try {
    for (const [status, code, expectedStatus, expectedCode] of [
      [401, 'invalid_api_key', 503, 'assessment_auth_failed'],
      [403, 'permission_denied', 503, 'assessment_auth_failed'],
      [404, 'model_not_found', 503, 'assessment_model_unavailable'],
      [429, 'insufficient_quota', 429, 'assessment_quota_exceeded'],
      [429, 'rate_limit_exceeded', 429, 'rate_limited'],
      [500, 'provider_failure', 502, 'assessment_service_unavailable'],
    ]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ error: { code, message: 'Do not expose private-test-key or provider internals' } }), { status })
      const res = responseMock()
      await assessHandler({ method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': `failure-${code}` }, body: prompt }, res, { apiKey: 'private-test-key' })
      assert.equal(res.statusCode, expectedStatus)
      assert.deepEqual(res.body, { error: expectedCode })
      assert.doesNotMatch(JSON.stringify(res.body), /private-test-key|internals/)
      assert.equal(res.headers['Retry-After'], expectedCode === 'rate_limited' ? '60' : undefined)
    }
  } finally { globalThis.fetch = fetch }
})

test('a malformed provider answer is an incomplete review, never a grammar verdict', async () => {
  const fetch = globalThis.fetch
  try {
    for (const text of ['{broken', 'null', '{}']) {
      globalThis.fetch = async () => new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text }] }] }))
      const res = responseMock()
      await assessHandler({ method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': `incomplete-${text}` }, body: prompt }, res, { apiKey: 'test-only' })
      assert.equal(res.statusCode, 502)
      assert.deepEqual(res.body, { error: 'assessment_incomplete' })
    }
  } finally { globalThis.fetch = fetch }
})

test('the client distinguishes setup errors from transient outages without displaying provider text', async () => {
  for (const [status, code, needsSetup] of [[503, 'assessment_not_configured', true], [503, 'assessment_auth_failed', true], [429, 'assessment_quota_exceeded', true], [429, 'rate_limited', false], [502, 'assessment_service_unavailable', false]]) {
    const error = await assessmentFailure(new Response(JSON.stringify({ error: code, message: 'private provider details' }), { status }))
    assert.ok(error instanceof AssessmentServiceError)
    assert.equal(error.code, code)
    assert.equal(error.needsSetup, needsSetup)
    assert.doesNotMatch(error.message, /private/)
  }
  assert.equal((await assessmentFailure(new Response('<html>missing route</html>', { status: 404 }))).code, 'assessment_route_missing')
})

test('the client status check sends no learner draft; missing configuration never becomes a false result', async () => {
  const fetch = globalThis.fetch
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/assess')
      assert.equal(options.body, undefined)
      assert.equal(options.cache, 'no-store')
      return new Response(JSON.stringify({ configured: false }))
    }
    assert.deepEqual(await assessmentStatus(), { configured: false })
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'assessment_not_configured' }), { status: 503 })
    await assert.rejects(reviewComposition(prompt.response, prompt.targetWords), (error) => error.code === 'assessment_not_configured' && error.needsSetup)
    const comparison = await assessProduction({ response: '你好。', expectedZh: '我学法律。', expectedEn: 'I study law.', targetWords: ['法律'] })
    assert.equal(comparison.accepted, null)
    assert.equal(comparison.evidence, 'practice')
    assert.match(comparison.unavailable, /not been connected/)
  } finally { globalThis.fetch = fetch }
})

test('network failure has an actionable client error, while an intentional abort remains an abort', async () => {
  const fetch = globalThis.fetch
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
    await assert.rejects(reviewComposition(prompt.response, prompt.targetWords), (error) => error.code === 'assessment_network_error')
    const controller = new AbortController()
    controller.abort()
    const abort = new DOMException('Aborted', 'AbortError')
    globalThis.fetch = async () => { throw abort }
    await assert.rejects(reviewComposition(prompt.response, prompt.targetWords, '', controller.signal), (error) => error === abort)
  } finally { globalThis.fetch = fetch }
})
