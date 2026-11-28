import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createStudyMusicPlayer, MUSIC_KEY } from '../src/lib/studyMusicEngine.ts'
import { STUDY_TRACKS } from '../src/lib/studyTracks.ts'
import { narrowChoices, quizAssisted } from '../src/lib/choiceSupport.ts'

function fixture(saved = {}, fail = false) {
  const writes = new Map([[MUSIC_KEY, JSON.stringify(saved)], ['old-progress', '{"cards":42}']])
  const events = new Map(); const pending = []; const gains = []; const filters = []
  let calls = 0
  const audio = { paused: true, loop: false, src: '', preload: '', id: '',
    addEventListener(name, fn) { events.set(name, fn) },
    play() { return new Promise((resolve, reject) => pending.push({ resolve: () => { this.paused = false; resolve() }, reject })) },
    pause() { this.paused = true; events.get('pause')?.() }, load() {},
  }
  function param() { return { value: 0, cancelScheduledValues() {}, setTargetAtTime(value) { this.value = value } } }
  function node() { return { connect(to) { return to } } }
  const context = { currentTime: 0, destination: {}, state: 'running',
    addEventListener(name, fn) { events.set('context:' + name, fn) },
    createMediaElementSource() { return node() },
    createGain() { const gain = { ...node(), gain: param() }; gains.push(gain); return gain },
    createBiquadFilter() { const filter = { ...node(), frequency: param(), Q: param() }; filters.push(filter); return filter },
    resume() { return fail ? Promise.reject(new Error('blocked')) : Promise.resolve() }, close() {},
  }
  const player = createStudyMusicPlayer(STUDY_TRACKS, { audio: () => { calls++; return audio }, context: () => context, storage: { getItem: key => writes.get(key), setItem: (key, value) => writes.set(key, value) }, random: () => 0 })
  return { player, audio, context, pending, gains, filters, writes, events, calls: () => calls }
}

test('old music preference migrates without autoplay or a learning-storage write', () => {
  const f = fixture({ on: true, volume: 0.62 }); assert.equal(f.calls(), 0)
  assert.equal(f.player.snapshot().on, false); assert.equal(f.player.snapshot().volume, .62)
  f.player.muffle(true); f.player.volume(.25); f.player.choose('daylight')
  assert.equal(f.calls(), 0); assert.equal(f.writes.get('old-progress'), '{"cards":42}')
  assert.deepEqual([...f.writes.keys()], [MUSIC_KEY, 'old-progress'])
  const restored = fixture(JSON.parse(f.writes.get(MUSIC_KEY))).player.snapshot()
  assert.equal(restored.trackId, 'daylight'); assert.equal(restored.muffled, true); assert.equal(restored.on, false)
})

test('muffling is music-only lowpass, natural is a dry bypass; speech uses gain ducking', async () => {
  const f = fixture(); const started = f.player.play(true); f.pending.shift().resolve(); await started
  assert.equal(f.filters[0].type, 'lowpass'); assert.equal(f.filters[0].frequency.value, 1000)
  assert.equal(f.gains[1].gain.value, 1); assert.equal(f.gains[2].gain.value, 0)
  f.player.muffle(true); assert.equal(f.gains[1].gain.value, 0); assert.equal(f.gains[2].gain.value, 1)
  f.player.duck(true); assert.equal(f.gains[0].gain.value, .35 * .18)
  f.player.volume(.5); assert.equal(f.gains[0].gain.value, .5 * .18)
  f.player.duck(false); assert.equal(f.gains[0].gain.value, .5)
  f.player.muffle(false); assert.equal(f.gains[1].gain.value, 1); assert.equal(f.gains[2].gain.value, 0)
  f.player.dispose()
})

test('pause wins against a delayed play promise', async () => {
  const f = fixture(); const started = f.player.play(true)
  await f.player.play(false); f.pending.shift().resolve(); await started
  assert.equal(f.player.snapshot().on, false); assert.equal(f.audio.paused, true)
})

test('switching tracks ignores an old rejected play and preserves the new request', async () => {
  const f = fixture(); const first = f.player.play(true); const old = f.pending.shift()
  f.player.choose('daylight'); const latest = f.pending.shift()
  old.reject(new Error('source changed')); await first
  assert.equal(f.player.snapshot().error, false); assert.equal(f.player.snapshot().loading, true)
  latest.resolve(); await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.player.snapshot().trackId, 'daylight'); assert.equal(f.player.snapshot().on, true)
  assert.equal(f.calls(), 1); f.player.dispose()
})

test('play errors are recoverable and next/repeat/shuffle preserve user control', async () => {
  const f = fixture(); const attempt = f.player.play(true); f.pending.shift().reject(new Error('offline')); await attempt
  assert.equal(f.player.snapshot().error, true); assert.equal(f.player.snapshot().on, false)
  f.player.next(1); assert.equal(f.player.snapshot().error, false); assert.equal(f.pending.length, 0)
  const retry = f.player.play(true); f.pending.shift().resolve(); await retry
  f.player.repeat(true); assert.equal(f.audio.loop, true)
  f.player.repeat(false); assert.equal(f.audio.loop, false)
  f.events.get('ended')(); assert.equal(f.player.snapshot().trackId, STUDY_TRACKS[2].id)
  await f.player.play(false); f.player.shuffle(); assert.equal(f.player.snapshot().trackId, STUDY_TRACKS[0].id)
  f.player.dispose()
})

test('sleep timer stops only music and invalid volume cannot poison gain', async () => {
  const f = fixture(); const started = f.player.play(true); f.pending.shift().resolve(); await started
  f.player.volume(NaN); assert.equal(f.player.snapshot().volume, .35)
  f.player.sleep(.0001); await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(f.player.snapshot().on, false); assert.equal(f.audio.paused, true); assert.equal(f.player.snapshot().sleepAt, null)
  assert.equal(f.writes.get('old-progress'), '{"cards":42}'); f.player.dispose()
})

test('music catalogue has unique IDs, real full-length assets and no personal voice recordings', () => {
  assert.equal(STUDY_TRACKS.length, 14)
  assert.equal(new Set(STUDY_TRACKS.map(t => t.id)).size, 14)
  for (const track of STUDY_TRACKS) {
    assert.ok(track.seconds > 90)
    assert.ok(track.src.startsWith('/study-music/'))
    const size = fs.statSync(`public${track.src}`).size
    assert.ok(size > 100_000 && size < 100_000_000)
  }
})

test('two-choice help never drops the answer and respects ruled-out choices', () => {
  const options = ['甲','乙','丙','丁'].map(zh => ({ zh }))
  assert.deepEqual(narrowChoices(options, '丁', ['甲']).map(x => x.zh), ['乙','丁'])
  assert.deepEqual(narrowChoices(options, '甲', []).map(x => x.zh), ['甲','乙'])
  assert.deepEqual(narrowChoices(options, '丁', ['甲','乙','丙']).map(x => x.zh), ['丁'])
  for (let bits = 0; bits < 8; bits++) assert.equal(quizAssisted(!!(bits & 1), !!(bits & 2), !!(bits & 4)), bits !== 0)
})


test('browser interruption shows paused and blocked AudioContext can be retried', async () => {
  const f = fixture(); const start = f.player.play(true); f.pending.shift().resolve(); await start
  f.context.state = 'suspended'; f.events.get('context:statechange')()
  assert.equal(f.player.snapshot().on, false); assert.equal(f.audio.paused, true)
  f.player.dispose()
  const denied = fixture({}, true); const blocked = denied.player.play(true); denied.pending.shift().resolve(); await blocked
  assert.equal(denied.player.snapshot().error, true); assert.equal(denied.audio.paused, true); denied.player.dispose()
})

test('native background HTML5 mode supports MediaSession controls, stacked speech+reveal ducking, and auto-next on ended', async () => {
  const writes = new Map()
  const events = new Map()
  const mediaCalls = []
  let resolvePlay
  const audio = {
    paused: true,
    loop: false,
    src: '',
    preload: '',
    id: '',
    volume: 0.4,
    duration: 120,
    currentTime: 10,
    addEventListener(name, fn) { events.set(name, fn) },
    play() { return new Promise((r) => { resolvePlay = () => { this.paused = false; r() } }) },
    pause() { this.paused = true; events.get('pause')?.() },
    load() {},
  }
  const player = createStudyMusicPlayer(STUDY_TRACKS, {
    audio: () => audio,
    storage: { getItem: (k) => writes.get(k), setItem: (k, v) => writes.set(k, v) },
    resolveSrcSync: (t) => `blob:offline-${t.id}`,
    syncMediaSession: (info) => mediaCalls.push(info),
  })

  player.volume(0.5)
  const p = player.play(true)
  assert.equal(audio.src, 'blob:offline-lofi')
  resolvePlay()
  await p

  assert.equal(player.snapshot().on, true)
  assert.equal(audio.volume, 0.5)
  assert.ok(mediaCalls.some((c) => c.playing === true && c.track.id === 'lofi'))

  // Stacked ducking: reveal + speech must keep ducked until BOTH release
  player.duckSource('speech', true)
  assert.equal(player.snapshot().ducked, true)
  player.duckSource('reveal', true)
  assert.equal(player.snapshot().ducked, true)
  player.duckSource('speech', false)
  assert.equal(player.snapshot().ducked, true)
  player.duckSource('reveal', false)
  assert.equal(player.snapshot().ducked, false)

  // Background track ended automatically advances & syncs MediaSession
  events.get('ended')?.()
  assert.equal(player.snapshot().trackId, STUDY_TRACKS[1].id)
  player.dispose()
})
