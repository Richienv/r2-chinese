/** A separate music bus with native background HTML5 playback + multi-reason speech/reveal ducking. */
export const MUSIC_KEY = 'yulu.study-music.v1'

export interface MusicTrack {
  id: string
  src: string
  title?: string
  artist?: string
  seconds?: number
}

export interface MusicState {
  on: boolean
  loading: boolean
  trackId: string
  volume: number
  muffled: boolean
  repeat: boolean
  ducked: boolean
  error: boolean
  sleepAt: number | null
}

type Dependencies = {
  audio: () => HTMLAudioElement
  context?: () => AudioContext
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  random?: () => number
  resolveSrcSync?: (track: MusicTrack) => string | null
  resolveSrc?: (track: MusicTrack) => Promise<string>
  onTrackActivate?: (track: MusicTrack) => void
  syncMediaSession?: (opts: {
    track: MusicTrack
    playing: boolean
    position?: number
    duration?: number
    onPlay: () => void
    onPause: () => void
    onPrev: () => void
    onNext: () => void
    onSeek: (time: number) => void
  }) => void
}

const clamp = (n: number) => Math.max(0, Math.min(1, n))

export function createStudyMusicPlayer(tracks: readonly MusicTrack[], deps: Dependencies) {
  if (!tracks.length) throw new Error('Music library is empty')
  let state: MusicState = {
    on: false,
    loading: false,
    trackId: tracks[0].id,
    volume: 0.35,
    muffled: false,
    repeat: false,
    ducked: false,
    error: false,
    sleepAt: null,
  }
  try {
    const saved = JSON.parse(deps.storage?.getItem(MUSIC_KEY) ?? '{}')
    if (saved && typeof saved === 'object') {
      state.volume = typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? clamp(saved.volume) : 0.35
      state.trackId = tracks.some((t) => t.id === saved.trackId) ? saved.trackId : tracks[0].id
      state.muffled = saved.muffled === true
      state.repeat = saved.repeat === true
      // Intentionally ignore the old saved `on`: starting always requires a user tap.
    }
  } catch {
    /* A malformed preference must not prevent studying. */
  }

  let node: HTMLAudioElement | undefined
  let context: AudioContext | undefined
  let master: GainNode | undefined
  let dry: GainNode | undefined
  let wet: GainNode | undefined
  let volumeTimer: ReturnType<typeof setInterval> | undefined
  let generation = 0
  let intended = false
  let sleepTimer: ReturnType<typeof setTimeout> | undefined
  let lastPosSync = 0
  const duckReasons = new Set<string>()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((fn) => fn())

  const currentTrack = () => tracks.find((t) => t.id === state.trackId) ?? tracks[0]

  function save() {
    try {
      deps.storage?.setItem(
        MUSIC_KEY,
        JSON.stringify({
          volume: state.volume,
          trackId: state.trackId,
          muffled: state.muffled,
          repeat: state.repeat,
        }),
      )
    } catch {
      /* Playback still works when preference storage is full. */
    }
  }

  function ramp(param: AudioParam, value: number, time = 0.08) {
    if (!context) return
    const now = context.currentTime
    param.cancelScheduledValues(now)
    param.setTargetAtTime(value, now, time)
  }

  function targetNativeVolume(): number {
    return clamp(state.volume * (state.ducked ? 0.18 : 1) * (state.muffled ? 0.65 : 1))
  }

  function syncNativeVolume(immediate = false) {
    if (!node) return
    const target = targetNativeVolume()
    if (immediate || typeof setInterval === 'undefined') {
      try {
        node.volume = target
      } catch {
        /* Some mobile OS browsers treat HTMLAudioElement.volume as read-only. */
      }
      return
    }
    clearInterval(volumeTimer)
    let step = 0
    const startVol = typeof node.volume === 'number' && Number.isFinite(node.volume) ? node.volume : target
    const steps = 6
    volumeTimer = setInterval(() => {
      step++
      if (!node) {
        clearInterval(volumeTimer)
        return
      }
      const nextVol = startVol + (target - startVol) * (step / steps)
      try {
        node.volume = clamp(nextVol)
      } catch {
        clearInterval(volumeTimer)
      }
      if (step >= steps) clearInterval(volumeTimer)
    }, 24)
  }

  function mix(immediate = false) {
    if (master && dry && wet) {
      ramp(master.gain, state.volume * (state.ducked ? 0.18 : 1), state.ducked ? 0.035 : 0.16)
      ramp(dry.gain, state.muffled ? 0 : 1)
      ramp(wet.gain, state.muffled ? 1 : 0)
      return
    }
    syncNativeVolume(immediate)
  }

  function pushMediaSession(playing: boolean) {
    if (!deps.syncMediaSession) return
    const track = currentTrack()
    const dur =
      node && typeof node.duration === 'number' && Number.isFinite(node.duration) && node.duration > 0
        ? node.duration
        : track.seconds
    const pos =
      node && typeof node.currentTime === 'number' && Number.isFinite(node.currentTime) ? node.currentTime : 0
    deps.syncMediaSession({
      track,
      playing,
      duration: dur,
      position: pos,
      onPlay: () => void play(true),
      onPause: () => void play(false),
      onPrev: () => next(-1),
      onNext: () => next(1),
      onSeek: (time) => {
        if (!node || !Number.isFinite(time)) return
        try {
          node.currentTime = Math.max(0, time)
          pushMediaSession(!node.paused)
        } catch {
          /* ignore out-of-range seek */
        }
      },
    })
  }

  async function assignSource(audioEl: HTMLAudioElement, track: MusicTrack, reqId: number) {
    const resolved = deps.resolveSrc ? await deps.resolveSrc(track) : track.src
    if (reqId !== generation) return
    if (audioEl.src !== resolved) {
      audioEl.src = resolved
      audioEl.load()
    }
    deps.onTrackActivate?.(track)
  }

  function prepare() {
    const track = currentTrack()
    if (!node) {
      node = deps.audio()
      node.preload = 'auto'
      node.id = 'yulu-study-music'
      node.src = track.src
      node.addEventListener('ended', () => {
        if (intended) next(1)
      })
      node.addEventListener('error', () => {
        generation++
        intended = false
        state = { ...state, on: false, loading: false, error: true }
        pushMediaSession(false)
        emit()
      })
      node.addEventListener('pause', () => {
        if (!state.loading && state.on) {
          state = { ...state, on: false }
          pushMediaSession(false)
          emit()
        }
      })
      node.addEventListener('play', () => {
        pushMediaSession(true)
      })
      node.addEventListener('loadedmetadata', () => {
        pushMediaSession(!node?.paused)
      })
      node.addEventListener('timeupdate', () => {
        const now = Date.now()
        if (now - lastPosSync > 4000) {
          lastPosSync = now
          pushMediaSession(!node?.paused)
        }
      })
    }
    if (deps.context && !context) {
      const ctx = deps.context()
      const source = ctx.createMediaElementSource(node)
      const gain = ctx.createGain()
      const clean = ctx.createGain()
      const soft = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1000
      filter.Q.value = 0.707
      gain.gain.value = state.volume * (state.ducked ? 0.18 : 1)
      clean.gain.value = state.muffled ? 0 : 1
      soft.gain.value = state.muffled ? 1 : 0
      source.connect(clean).connect(gain)
      source.connect(filter).connect(soft).connect(gain)
      gain.connect(ctx.destination)
      context = ctx
      master = gain
      dry = clean
      wet = soft
      ctx.addEventListener('statechange', () => {
        if (ctx.state !== 'running' && state.on && !state.loading) void play(false)
      })
    }
    node.loop = state.repeat
    mix(true)
    return node
  }

  async function play(nextOn: boolean) {
    const request = ++generation
    intended = nextOn
    if (!nextOn) {
      state = { ...state, on: false, loading: false }
      node?.pause()
      pushMediaSession(false)
      emit()
      return
    }
    state = { ...state, loading: true, error: false }
    emit()
    try {
      const audio = prepare()
      const syncSrc = deps.resolveSrcSync?.(currentTrack())
      if (syncSrc && audio.src !== syncSrc) {
        audio.src = syncSrc
        audio.load()
      }
      deps.onTrackActivate?.(currentTrack())

      // Invoke play() synchronously in the same user gesture before awaiting anything (iOS Safari requirement).
      if (context) {
        await Promise.all([context.resume(), audio.play()])
      } else {
        await audio.play()
      }
      if (request !== generation) {
        if (!intended) audio.pause()
        return
      }
      // Warm cache in background for future offline replays without interrupting active playback
      if (!syncSrc && deps.resolveSrc) {
        void deps.resolveSrc(currentTrack())
      }
      state = { ...state, on: !audio.paused, loading: false }
      pushMediaSession(!audio.paused)
      emit()
    } catch {
      if (request !== generation) return
      intended = false
      node?.pause()
      state = { ...state, on: false, loading: false, error: true }
      pushMediaSession(false)
      emit()
    }
  }

  function choose(id: string) {
    const track = tracks.find((t) => t.id === id)
    if (!track || id === state.trackId) return
    const resume = intended
    const reqId = ++generation
    state = { ...state, trackId: id, on: false, loading: false, error: false }
    if (node) {
      node.pause()
      if (deps.resolveSrc && !resume) {
        void assignSource(node, track, reqId)
      } else {
        node.src = track.src
        node.load()
      }
    }
    deps.onTrackActivate?.(track)
    save()
    pushMediaSession(false)
    emit()
    if (resume) void play(true)
  }

  function next(direction: number) {
    const index = tracks.findIndex((t) => t.id === state.trackId)
    choose(tracks[(index + direction + tracks.length) % tracks.length].id)
  }

  function shuffle() {
    const other = tracks.filter((t) => t.id !== state.trackId)
    if (other.length) {
      choose(other[Math.min(other.length - 1, Math.floor((deps.random?.() ?? Math.random()) * other.length))].id)
    }
  }

  function sleep(minutes: number) {
    clearTimeout(sleepTimer)
    const duration = Number.isFinite(minutes) && minutes > 0 ? minutes * 60000 : 0
    state = { ...state, sleepAt: duration ? Date.now() + duration : null }
    emit()
    if (duration) {
      sleepTimer = setTimeout(() => {
        state = { ...state, sleepAt: null }
        void play(false)
      }, duration)
    }
  }

  function checkSleep() {
    if (state.sleepAt && Date.now() >= state.sleepAt) {
      sleep(0)
      void play(false)
    }
  }

  function duckSource(reason: string, active: boolean) {
    if (active) duckReasons.add(reason)
    else duckReasons.delete(reason)
    const nextDucked = duckReasons.size > 0
    if (nextDucked === state.ducked) return
    state = { ...state, ducked: nextDucked }
    mix()
    emit()
  }

  return {
    snapshot: () => ({ ...state }),
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    play,
    choose,
    next,
    shuffle,
    sleep,
    checkSleep,
    volume(value: number) {
      if (!Number.isFinite(value)) return
      state = { ...state, volume: clamp(value) }
      mix(true)
      save()
      emit()
    },
    muffle(value: boolean) {
      state = { ...state, muffled: value }
      mix(true)
      save()
      emit()
    },
    repeat(value: boolean) {
      state = { ...state, repeat: value }
      if (node) node.loop = value
      save()
      emit()
    },
    duckSource,
    duck(value: boolean) {
      duckSource('speech', value)
    },
    dispose() {
      generation++
      intended = false
      clearTimeout(sleepTimer)
      clearInterval(volumeTimer)
      node?.pause()
      void context?.close()
      listeners.clear()
    },
  }
}
