import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const temporary = mkdtempSync(path.join(tmpdir(), 'interview-audio-test-'))
const bundle = path.join(temporary, 'audio.cjs')
buildSync({
  stdin: { contents: "export { initBookAudio } from './src/lib/bookAudio.ts'; export { speak, stopSpeech, getSpeechSnapshot, setSpeechEnabled } from './src/lib/speech.ts'", resolveDir: repo, loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', outfile: bundle, define: { 'import.meta.env': '{}' },
})
const audio = createRequire(import.meta.url)(bundle)
const played = []
const fetched = []
let requiresGesture = false
let insideGesture = false
const originals = Object.fromEntries(['Audio', 'window', 'document', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globalThis[key]]))

class Media extends EventTarget {
  src = ''; currentTime = 0; paused = true
  setAttribute() {}
  play() {
    if (requiresGesture && !insideGesture) return Promise.reject(new Error('NotAllowedError: playback requires a user gesture'))
    this.paused = false
    played.push(this.src)
    this.timer = setTimeout(() => { this.currentTime = 9999; this.paused = true; this.dispatchEvent(new Event('ended')) }, 10)
    return Promise.resolve()
  }
  pause() { this.paused = true; clearTimeout(this.timer) }
}

test.before(() => {
  globalThis.Audio = Media
  globalThis.window = {}
  globalThis.document = { body: { appendChild() {} } }
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 1)
  globalThis.cancelAnimationFrame = clearTimeout
  globalThis.fetch = async (url, opts) => {
    fetched.push(String(url))
    if (opts?.method === 'HEAD' && String(url).endsWith('/audio/hsk4a/L01-1.mp3')) return new Response(null, { headers: { 'content-type': 'audio/mpeg' } })
    return new Response('tts failed: 403', { status: 502 })
  }
  audio.initBookAudio()
})
test.after(() => {
  audio.stopSpeech()
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
  rmSync(temporary, { recursive: true, force: true })
})

test('interview words and mixed Chinese answers play when TTS and browser speech are unavailable', async () => {
  const source = JSON.parse(readFileSync(path.join(repo, 'src/data/jiayin.json')))
  const intro = source.units[0].items.find(item => item.id === 'intro-short')
  for (const text of ['海外业务', '我有计算机背景，也有印尼企业的业务和系统落地经验。', intro.answerZh]) {
    played.length = 0; fetched.length = 0
    assert.equal(await audio.speak(text, { trackWords: true }), true, text)
    assert.match(played[0], /^\/audio\/jiayin\/.+\.mp3$/)
    assert.equal(fetched.filter(url => url.startsWith('/api/tts')).length, 0)
    assert.equal(audio.getSpeechSnapshot().status, 'idle')
  }
})

test('installing interview audio keeps exact HSK text on the original publisher recording', async () => {
  const manifest = JSON.parse(readFileSync(path.join(repo, 'src/data/hsk4a-audio.json')))
  const [text, clip] = Object.entries(manifest.lines)[0]
  played.length = 0; fetched.length = 0
  assert.equal(await audio.speak(text), true)
  assert.equal(played[0], `/audio/hsk4a/${clip.f}.mp3`)
  assert.equal(fetched.filter(url => url.startsWith('/api/tts')).length, 0)
})

test('all source words, sentences and full answers have valid deployed audio with matching checksums', () => {
  const source = JSON.parse(readFileSync(path.join(repo, 'src/data/jiayin.json')))
  const manifest = JSON.parse(readFileSync(path.join(repo, 'src/data/jiayin-audio.json')))
  const words = [...source.units.flatMap(unit => unit.vocab), ...source.extraVocab].map(word => word.zh)
  const answers = source.units.flatMap(unit => unit.items).map(item => item.answerZh)
  const chunks = answers.flatMap(text => text.match(/[^。！？]+[。！？]?/g).map(part => part.trim()).filter(Boolean))
  assert.equal(chunks.length, 217)
  const files = new Set()
  for (const [kind, texts] of [['words', words], ['lines', [...chunks, ...answers]]]) {
    for (const text of texts) {
      const clip = manifest[kind][text]
      assert.ok(clip, `${kind}: ${text}`)
      assert.ok(clip.s === 0 && clip.e > 0 && clip.e < 180, text)
      if (files.has(clip.f)) continue
      files.add(clip.f)
      const bytes = readFileSync(path.join(repo, `public/audio/jiayin/${clip.f}.mp3`))
      assert.ok(bytes.length > 500)
      assert.ok(bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0), `${clip.f} must be MPEG audio`)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.sha256)
    }
  }
  assert.ok(files.size > 300)
})

test('interview recordings respect the existing mute setting', async () => {
  played.length = 0
  audio.setSpeechEnabled(false)
  try {
    assert.equal(await audio.speak('海外业务'), false)
    assert.equal(played.length, 0)
    assert.ok(audio.getSpeechSnapshot().error)
  } finally { audio.setSpeechEnabled(true) }
})

test('interview playback starts inside the tap gesture required by mobile Safari', async () => {
  requiresGesture = true
  insideGesture = true
  try {
    const completion = audio.speak('海外业务', { trackWords: true })
    // Safari can revoke the gesture after this synchronous event handler ends.
    insideGesture = false
    assert.equal(await completion, true)
  } finally { requiresGesture = false; insideGesture = false }
})

test('unmapped text keeps the existing neural/browser fallback instead of playing an unrelated interview clip', async () => {
  played.length = 0; fetched.length = 0
  assert.equal(await audio.speak('这句测试没有收录在任何课程音频里面。'), false)
  assert.equal(played.length, 0)
  assert.equal(fetched.filter(url => url.startsWith('/api/tts')).length, 1)
})
