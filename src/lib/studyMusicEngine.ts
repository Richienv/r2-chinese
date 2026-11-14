/** A separate music bus. Lesson speech never passes through this graph. */
export const MUSIC_KEY = 'yulu.study-music.v1'
export interface MusicTrack { id: string; src: string }
export interface MusicState {
  on: boolean; loading: boolean; trackId: string; volume: number; muffled: boolean
  repeat: boolean; ducked: boolean; error: boolean; sleepAt: number | null
}
type Dependencies = {
  audio: () => HTMLAudioElement
  context: () => AudioContext
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  random?: () => number
}
const clamp = (n: number) => Math.max(0, Math.min(1, n))

export function createStudyMusicPlayer(tracks: readonly MusicTrack[], deps: Dependencies) {
  if (!tracks.length) throw new Error('Music library is empty')
  let state: MusicState = { on: false, loading: false, trackId: tracks[0].id, volume: 0.35, muffled: false, repeat: false, ducked: false, error: false, sleepAt: null }
  try {
    const saved = JSON.parse(deps.storage?.getItem(MUSIC_KEY) ?? '{}')
    if (saved && typeof saved === 'object') {
      state.volume = typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? clamp(saved.volume) : 0.35
      state.trackId = tracks.some(t => t.id === saved.trackId) ? saved.trackId : tracks[0].id
      state.muffled = saved.muffled === true
      state.repeat = saved.repeat === true
      // Intentionally ignore the old saved `on`: starting always requires a tap.
    }
  } catch { /* A malformed preference must not prevent studying. */ }
  let node: HTMLAudioElement | undefined
  let context: AudioContext | undefined
  let master: GainNode | undefined
  let dry: GainNode | undefined
  let wet: GainNode | undefined
  let generation = 0
  let intended = false
  let sleepTimer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(fn => fn())
  function save() {
    try {
      deps.storage?.setItem(MUSIC_KEY, JSON.stringify({ volume: state.volume, trackId: state.trackId, muffled: state.muffled, repeat: state.repeat }))
    } catch { /* Playback still works when preference storage is full. */ }
  }
  function ramp(param: AudioParam, value: number, time = 0.08) {
    const now = context!.currentTime
    param.cancelScheduledValues(now)
    param.setTargetAtTime(value, now, time)
  }
  function mix() {
    if (!master || !dry || !wet) return
    ramp(master.gain, state.volume * (state.ducked ? 0.18 : 1), state.ducked ? 0.035 : 0.16)
    ramp(dry.gain, state.muffled ? 0 : 1)
    ramp(wet.gain, state.muffled ? 1 : 0)
  }
  function prepare() {
    if (!node) {
      node = deps.audio()
      node.preload = 'none'
      node.id = 'yulu-study-music'
      node.src = tracks.find(t => t.id === state.trackId)!.src
      node.addEventListener('ended', () => { if (intended) next(1) })
      node.addEventListener('error', () => {
        generation++; intended = false
        state = { ...state, on: false, loading: false, error: true }; emit()
      })
      node.addEventListener('pause', () => {
        if (!state.loading && state.on) { state = { ...state, on: false }; emit() }
      })
    }
    if (!context) {
      const ctx = deps.context()
      const source = ctx.createMediaElementSource(node)
      const gain = ctx.createGain()
      const clean = ctx.createGain()
      const soft = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'; filter.frequency.value = 1000; filter.Q.value = 0.707
      gain.gain.value = state.volume * (state.ducked ? 0.18 : 1)
      clean.gain.value = state.muffled ? 0 : 1; soft.gain.value = state.muffled ? 1 : 0
      source.connect(clean).connect(gain)
      source.connect(filter).connect(soft).connect(gain)
      gain.connect(ctx.destination)
      context = ctx; master = gain; dry = clean; wet = soft
      ctx.addEventListener('statechange', () => {
        if (ctx.state !== 'running' && state.on && !state.loading) void play(false)
      })
    }
    node.loop = state.repeat
    mix()
    return node
  }
  async function play(nextOn: boolean) {
    const request = ++generation
    intended = nextOn
    if (!nextOn) {
      state = { ...state, on: false, loading: false }; node?.pause(); emit(); return
    }
    state = { ...state, loading: true, error: false }; emit()
    try {
      const audio = prepare()
      // Both calls happen in the same user gesture, before either promise awaits.
      await Promise.all([context!.resume(), audio.play()])
      if (request !== generation) { if (!intended) audio.pause(); return }
      state = { ...state, on: !audio.paused, loading: false }; emit()
    } catch {
      if (request !== generation) return
      intended = false; node?.pause()
      state = { ...state, on: false, loading: false, error: true }; emit()
    }
  }
  function choose(id: string) {
    const track = tracks.find(t => t.id === id)
    if (!track || id === state.trackId) return
    const resume = intended
    ++generation
    state = { ...state, trackId: id, on: false, loading: false, error: false }
    if (node) { node.pause(); node.src = track.src; node.load() }
    save(); emit()
    if (resume) void play(true)
  }
  function next(direction: number) {
    const index = tracks.findIndex(t => t.id === state.trackId)
    choose(tracks[(index + direction + tracks.length) % tracks.length].id)
  }
  function shuffle() {
    const other = tracks.filter(t => t.id !== state.trackId)
    if (other.length) choose(other[Math.min(other.length - 1, Math.floor((deps.random?.() ?? Math.random()) * other.length))].id)
  }
  function sleep(minutes: number) {
    clearTimeout(sleepTimer)
    const duration = Number.isFinite(minutes) && minutes > 0 ? minutes * 60000 : 0
    state = { ...state, sleepAt: duration ? Date.now() + duration : null }; emit()
    if (duration) sleepTimer = setTimeout(() => {
      state = { ...state, sleepAt: null }; void play(false)
    }, duration)
  }
  function checkSleep() {
    if (state.sleepAt && Date.now() >= state.sleepAt) { sleep(0); void play(false) }
  }
  return {
    snapshot: () => ({ ...state }),
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    play, choose, next, shuffle, sleep, checkSleep,
    volume(value: number) { if (!Number.isFinite(value)) return; state = { ...state, volume: clamp(value) }; mix(); save(); emit() },
    muffle(value: boolean) { state = { ...state, muffled: value }; mix(); save(); emit() },
    repeat(value: boolean) { state = { ...state, repeat: value }; if (node) node.loop = value; save(); emit() },
    duck(value: boolean) { if (value === state.ducked) return; state = { ...state, ducked: value }; mix(); emit() },
    dispose() { generation++; intended = false; clearTimeout(sleepTimer); node?.pause(); void context?.close(); listeners.clear() },
  }
}
