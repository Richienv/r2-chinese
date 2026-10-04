import test from 'node:test'
import assert from 'node:assert/strict'
import { getSpeechSnapshot, speak, speakLines, stopSpeech, subscribeSpeech } from '../src/lib/speech.ts'

function audioEnvironment() {
  const keys = ['Audio', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'SpeechSynthesisUtterance']
  const prior = Object.fromEntries(keys.map((key) => [key, globalThis[key]]))
  const clips = []
  class FakeAudio extends EventTarget {
    currentTime = 0
    src = ''
    paused = true
    setAttribute() {}
    play() {
      this.paused = false
      clips.push(this.src)
      this.timer = setTimeout(() => { this.currentTime = 3; this.paused = true; this.dispatchEvent(new Event('ended')) }, 30)
      return Promise.resolve()
    }
    pause() { this.paused = true; clearTimeout(this.timer) }
  }
  globalThis.Audio = FakeAudio
  globalThis.window = { speechSynthesis: { cancel() {}, getVoices() { return [] }, speak() {} } }
  globalThis.document = { body: { appendChild() {} } }
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => { fn(0) }, 1)
  globalThis.cancelAnimationFrame = clearTimeout
  globalThis.fetch = async () => new Response(JSON.stringify({ audio: 'AA==', words: [{ start: 0, duration: 1, charIndex: 0, charLength: 1 }, { start: .01, duration: 1, charIndex: 1, charLength: 1 }] }))
  return { clips, restore() { stopSpeech(); for (const key of keys) { if (prior[key] === undefined) delete globalThis[key]; else globalThis[key] = prior[key] } } }
}

test('real media completion advances ordered dialogue lines and publishes playing word/line state', async () => {
  const env = audioEnvironment()
  const events = []
  const lines = []
  const unsubscribe = subscribeSpeech(() => events.push(getSpeechSnapshot()))
  try {
    const complete = await speakLines([{ text: '你好' }, { text: '谢谢' }], { group: 'test-dialogue', trackWords: true, onLine: (index) => lines.push(index) })
    assert.equal(complete, true)
    assert.deepEqual(lines, [0, 1])
    assert.equal(env.clips.length, 2)
    assert.ok(events.some((event) => event.status === 'playing' && event.group === 'test-dialogue' && event.charIndex === 0))
    assert.equal(getSpeechSnapshot().status, 'idle')
  } finally { unsubscribe(); env.restore() }
})

test('stop settles pending synthesis immediately and late downloads never start stale playback', async () => {
  const env = audioEnvironment()
  let respond
  try {
    globalThis.fetch = () => new Promise((resolve) => { respond = resolve })
    const playing = speak('取消这个', { trackWords: true })
    assert.equal(getSpeechSnapshot().status, 'loading')
    stopSpeech()
    assert.equal(await playing, false)
    respond(new Response(JSON.stringify({ audio: 'AA==', words: [] })))
    await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal(env.clips.length, 0)
    assert.equal(getSpeechSnapshot().status, 'idle')
  } finally { env.restore() }
})

test('browser voice cancellation cannot hang a playlist when speech onend is omitted', async () => {
  const env = audioEnvironment()
  let utterance
  try {
    globalThis.fetch = async () => new Response('', { status: 502 })
    globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    globalThis.window.speechSynthesis.speak = (value) => { utterance = value; value.onstart() }
    const playing = speak('浏览器朗读', { trackWords: true })
    await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal(utterance.text, '浏览器朗读')
    stopSpeech()
    assert.equal(await playing, false)
    assert.equal(getSpeechSnapshot().status, 'idle')
  } finally { env.restore() }
})
