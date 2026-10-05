import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clipKey, createClipResolver, trackUrl } from '../src/lib/bookAudioIndex.ts'
import { getSpeechSnapshot, setClipResolver, speak, speakLines, stopSpeech } from '../src/lib/speech.ts'

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const book = readJson('../src/data/hsk4a.json')
const manifest = readJson('../src/data/hsk4a-audio.json')

const lineOrigin = new Map()
for (const lesson of book.lessons) lesson.texts.forEach((text, index) => {
  for (const line of text.lines) lineOrigin.set(line.zh, `L${String(lesson.lesson).padStart(2, '0')}-${index + 1}`)
})
const wordLesson = new Map()
for (const lesson of book.lessons) for (const word of lesson.vocab) if (!wordLesson.has(word.zh)) wordLesson.set(word.zh, lesson.lesson)

test('every recorded line is a verbatim book line taken from the matching text track', () => {
  for (const [text, entry] of Object.entries(manifest.lines)) {
    assert.equal(lineOrigin.get(text), entry.f, `${text} should come from ${lineOrigin.get(text)}`)
    assert.ok(entry.s >= 0 && entry.e - entry.s >= 0.4 && entry.e - entry.s <= 40, `${entry.f} ${entry.s}-${entry.e} is not a plausible line`)
    let previous = -1
    for (const [charIndex, charLength, start, duration] of entry.w ?? []) {
      assert.ok(charIndex >= 0 && charLength > 0 && charIndex + charLength <= text.length, `word span outside line in ${entry.f}`)
      assert.ok(start >= 0 && duration >= 0 && start <= entry.e - entry.s + 0.5, `word timing outside clip in ${entry.f}`)
      assert.ok(start >= previous, `word timings must be ordered in ${entry.f}`)
      previous = start
    }
  }
})

test('lines within one track never overlap and keep book order', () => {
  const byTrack = new Map()
  for (const [text, entry] of Object.entries(manifest.lines)) {
    byTrack.set(entry.f, [...(byTrack.get(entry.f) ?? []), { text, ...entry }])
  }
  for (const [track, clips] of byTrack) {
    const lines = book.lessons[Number(track.slice(1, 3)) - 1].texts[Number(track.slice(4)) - 1].lines.map((line) => line.zh)
    const ordered = clips.sort((a, b) => a.s - b.s)
    assert.deepEqual(ordered.map((clip) => lines.indexOf(clip.text)), ordered.map((clip) => lines.indexOf(clip.text)).sort((a, b) => a - b), `${track} out of order`)
    for (let i = 1; i < ordered.length; i++) assert.ok(ordered[i].s >= ordered[i - 1].e - 0.001, `${track} clips overlap`)
  }
})

test('every recorded word is a vocabulary word of the lesson that track belongs to', () => {
  for (const [word, entry] of Object.entries(manifest.words)) {
    assert.ok(wordLesson.has(word), `${word} is not in the book vocabulary`)
    assert.equal(Number(entry.f.slice(1, 3)), wordLesson.get(word), `${word} should come from lesson ${wordLesson.get(word)}`)
    assert.ok(entry.e - entry.s >= 0.2 && entry.e - entry.s <= 4, `${word} ${entry.s}-${entry.e} is not a plausible word`)
  }
})

test('the recordings cover the book, so a regression to synthesized voices is noticed', () => {
  const lines = [...lineOrigin.keys()]
  assert.ok(Object.keys(manifest.lines).length / lines.length >= 0.95, 'at least 95% of book lines should be recorded')
  assert.ok(Object.keys(manifest.words).length / wordLesson.size >= 0.95, 'at least 95% of vocabulary should be recorded')
})

const sample = { version: 1, lines: { '你好， 我是小林。': { f: 'L01-2', s: 3.1, e: 5.4, w: [[0, 2, 0, 0.6]] } }, words: { 法律: { f: 'L01-1', s: 59.5, e: 60.5 } } }

test('resolver matches exact book text regardless of whitespace and ignores everything else', () => {
  const resolve = createClipResolver(sample, '/audio/hsk4a/')
  const line = resolve('你好，我是小林。')
  assert.equal(line.url, '/audio/hsk4a/L01-2.mp3')
  assert.deepEqual([line.start, line.end], [3.1, 5.4])
  assert.deepEqual(line.words, [{ charIndex: 0, charLength: 2, start: 0, duration: 0.6 }])
  assert.equal(resolve('法律').url, '/audio/hsk4a/L01-1.mp3')
  assert.equal(resolve('你好'), null, 'a fragment of a line is not the recording')
  assert.equal(resolve('今天天气很好。'), null)
  assert.equal(clipKey(' 你 好\n'), '你好')
  assert.equal(trackUrl('https://cdn.example/a', 'L02-3'), 'https://cdn.example/a/L02-3.mp3')
})

test('resolver stays silent until recordings are installed and drops a track that failed to load', () => {
  let ready = false
  const resolve = createClipResolver(sample, '/audio/hsk4a/', () => ready)
  assert.equal(resolve('法律'), null)
  ready = true
  const clip = resolve('法律')
  assert.ok(clip)
  clip.fail()
  assert.equal(resolve('法律'), null)
  assert.ok(resolve('你好，我是小林。'), 'other tracks are unaffected')
})

// speech.ts creates its audio element once per process, so recorders live at module level.
const current = { played: [], fetched: [], failTrack: false }
class FakeAudio extends EventTarget {
  currentTime = 0
  src = ''
  playbackRate = 1
  paused = true
  setAttribute() {}
  play() {
    this.paused = false
    current.played.push({ src: this.src, from: this.currentTime, rate: this.playbackRate })
    if (current.failTrack && !this.src.startsWith('blob:')) {
      this.timer = setTimeout(() => this.dispatchEvent(new Event('error')), 5)
      return Promise.resolve()
    }
    this.timer = setTimeout(() => { this.currentTime = 99; this.paused = true; this.dispatchEvent(new Event('ended')) }, 20)
    return Promise.resolve()
  }
  pause() { this.paused = true; clearTimeout(this.timer) }
}

function audioEnvironment({ failTrack = false } = {}) {
  const keys = ['Audio', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch']
  const prior = Object.fromEntries(keys.map((key) => [key, globalThis[key]]))
  Object.assign(current, { played: [], fetched: [], failTrack })
  globalThis.Audio = FakeAudio
  globalThis.window = { speechSynthesis: { cancel() {}, getVoices() { return [] }, speak() {} } }
  globalThis.document = { body: { appendChild() {} } }
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(0), 1)
  globalThis.cancelAnimationFrame = clearTimeout
  globalThis.fetch = async (url) => { current.fetched.push(String(url)); return new Response(new Blob(['x'], { type: 'audio/mpeg' })) }
  const createObjectURL = URL.createObjectURL
  URL.createObjectURL = () => 'blob:neural'
  return {
    get played() { return current.played },
    get fetched() { return current.fetched },
    restore() {
      stopSpeech(); setClipResolver(() => null); URL.createObjectURL = createObjectURL
      for (const key of keys) { if (prior[key] === undefined) delete globalThis[key]; else globalThis[key] = prior[key] }
    },
  }
}

test('a book line plays the publisher recording from its start time and never calls the synthesizer', async () => {
  const env = audioEnvironment()
  try {
    setClipResolver(createClipResolver(sample, '/audio/hsk4a/'))
    assert.equal(await speak('你好，我是小林。', { rate: -6 }), true)
    assert.equal(env.played.length, 1)
    assert.match(env.played[0].src, /\/audio\/hsk4a\/L01-2\.mp3$/)
    assert.equal(env.played[0].from, 3.1)
    assert.equal(env.played[0].rate, 1)
    assert.ok(!env.fetched.some((url) => url.includes('/api/tts')), 'recorded text must not be synthesized')
    assert.equal(getSpeechSnapshot().status, 'idle')
  } finally { env.restore() }
})

test('the listening speed setting slows the recording instead of switching voices', async () => {
  const env = audioEnvironment()
  try {
    setClipResolver(createClipResolver(sample, '/audio/hsk4a/'))
    for (const rate of [-6, -22, -38]) await speak('法律', { rate })
    assert.deepEqual(env.played.map((play) => play.rate), [1, 0.85, 0.7])
    assert.deepEqual(env.played.map((play) => play.from), [59.5, 59.5, 59.5])
  } finally { env.restore() }
})

test('text that is not in the book still uses the neural voice, and mixed playlists stay in order', async () => {
  const env = audioEnvironment()
  try {
    setClipResolver(createClipResolver(sample, '/audio/hsk4a/'))
    const done = await speakLines([{ text: '你好，我是小林。' }, { text: '这句话不在书里。' }, { text: '法律' }])
    assert.equal(done, true)
    assert.deepEqual(env.played.map((play) => play.src.includes('L01-') ? 'book' : 'neural'), ['book', 'neural', 'book'])
    assert.equal(env.fetched.filter((url) => url.includes('/api/tts')).length, 1)
  } finally { env.restore() }
})

test('a recording that fails to load falls back to the neural voice and is not retried', async () => {
  const env = audioEnvironment({ failTrack: true })
  try {
    setClipResolver(createClipResolver(sample, '/audio/hsk4a/'))
    assert.equal(await speak('法律', { rate: -12 }), true)
    assert.equal(env.fetched.filter((url) => url.includes('/api/tts')).length, 1, 'synthesized instead')
    env.played.length = 0
    assert.equal(await speak('法律', { rate: -12 }), true)
    assert.ok(env.played.every((play) => play.src === 'blob:neural'), 'the broken track is skipped from now on')
  } finally { env.restore() }
})

test('stopping during a recording ends it at once and settles the promise as interrupted', async () => {
  const env = audioEnvironment()
  try {
    setClipResolver(createClipResolver(sample, '/audio/hsk4a/'))
    const playing = speak('你好，我是小林。')
    await new Promise((resolve) => setTimeout(resolve, 2))
    stopSpeech()
    assert.equal(await playing, false)
    assert.equal(getSpeechSnapshot().status, 'idle')
    const next = await speak('法律')
    assert.equal(next, true, 'a later recording still plays after a stop')
  } finally { env.restore() }
})
