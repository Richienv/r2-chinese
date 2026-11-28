let ctx: AudioContext | null = null
let enabled = true
let soundGeneration = 0

type Note = {
  frequency: number
  offset?: number
  duration: number
  gain: number
  wave?: OscillatorType
  endFrequency?: number
}

const playing = new Set<{ master: GainNode; oscillators: AudioScheduledSourceNode[] }>()

/** Clips from Richie's sound library (Ocular Cinematic Mechanics, Cute UI). */
const SAMPLES = {
  tick: 0.32,
  slide: 0.3,
  tap: 0.34,
  hint: 0.3,
  open: 0.32,
  lock: 0.42,
  chime: 0.3,
  knock: 0.45,
  shutter: 0.34,
  servo: 0.26,
  complete: 0.32,
} as const
type Sample = keyof typeof SAMPLES
const buffers = new Map<Sample, AudioBuffer>()
const loading = new Map<Sample, Promise<void>>()

function load(audio: AudioContext, name: Sample): Promise<void> {
  const pending = loading.get(name)
  if (pending) return pending
  const next = fetch(`/sfx/${name}.mp3`)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText))))
    .then((data) => audio.decodeAudioData(data))
    .then((buffer) => { buffers.set(name, buffer) })
    .catch(() => { loading.delete(name) })
  loading.set(name, next)
  return next
}

/** Decode every clip once the first gesture has created the context. */
function warm(audio: AudioContext) {
  for (const name of Object.keys(SAMPLES) as Sample[]) void load(audio, name)
}

/** Plays a library clip; the synth `fallback` covers the first gesture before decoding finishes. */
function sample(name: Sample, fallback: () => void, offset = 0): void {
  const audio = getCtx()
  if (!audio) return
  warm(audio)
  const buffer = buffers.get(name)
  if (!buffer) {
    if (offset === 0) fallback()
    return
  }
  const generation = soundGeneration
  const begin = () => {
    if (!enabled || generation !== soundGeneration || audio.state !== 'running') return
    try {
      const source = audio.createBufferSource()
      const master = audio.createGain()
      master.gain.value = SAMPLES[name]
      source.buffer = buffer
      source.connect(master)
      master.connect(audio.destination)
      const sound = { master, oscillators: [source] as AudioScheduledSourceNode[] }
      playing.add(sound)
      source.onended = () => {
        source.disconnect()
        master.disconnect()
        playing.delete(sound)
      }
      source.start(audio.currentTime + 0.005 + offset)
    } catch { /* Sound never blocks learning. */ }
  }
  if (audio.state === 'suspended') {
    void audio.resume().then(begin).catch(() => { /* Sound never blocks learning. */ })
  } else begin()
}

/** Shared with the profile's sound preference. Also silence an in-flight cue. */
export function setSfxEnabled(value: boolean): void {
  if (value !== enabled) soundGeneration += 1
  enabled = value
  if (value || !ctx) return
  const now = ctx.currentTime
  for (const sound of playing) {
    sound.master.gain.cancelScheduledValues(now)
    sound.master.gain.setTargetAtTime(0, now, 0.006)
    for (const oscillator of sound.oscillators) {
      try { oscillator.stop(now + 0.025) } catch { /* Already ended. */ }
    }
  }
}

function getCtx(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null
  try {
    const Audio = window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Audio) return null
    if (!ctx || ctx.state === 'closed') ctx = new Audio()
    return ctx
  } catch {
    return null
  }
}

/** Only invoked by an interaction; the final oscillator owns graph cleanup. */
function play(notes: Note[], volume = 0.2): void {
  const audio = getCtx()
  if (!audio) return
  const generation = soundGeneration
  const begin = () => {
    if (!enabled || generation !== soundGeneration || audio.state !== 'running') return
    const master = audio.createGain()
    master.gain.value = volume
    master.connect(audio.destination)
    const sound = { master, oscillators: [] as OscillatorNode[] }
    playing.add(sound)
    let remaining = notes.length
    const now = audio.currentTime + 0.008
    for (const note of notes) {
      try {
        const oscillator = audio.createOscillator()
        const envelope = audio.createGain()
        const at = now + (note.offset ?? 0)
        oscillator.type = note.wave ?? 'sine'
        oscillator.frequency.setValueAtTime(note.frequency, at)
        if (note.endFrequency) {
          oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, at + note.duration)
        }
        envelope.gain.setValueAtTime(0.0001, at)
        envelope.gain.exponentialRampToValueAtTime(note.gain, at + Math.min(0.012, note.duration / 4))
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + note.duration)
        oscillator.connect(envelope)
        envelope.connect(master)
        sound.oscillators.push(oscillator)
        oscillator.onended = () => {
          oscillator.disconnect()
          envelope.disconnect()
          remaining -= 1
          if (remaining === 0) {
            master.disconnect()
            playing.delete(sound)
          }
        }
        oscillator.start(at)
        oscillator.stop(at + note.duration + 0.015)
      } catch {
        remaining -= 1
        if (remaining === 0) {
          master.disconnect()
          playing.delete(sound)
        }
      }
    }
  }
  if (audio.state === 'suspended') {
    void audio.resume().then(begin).catch(() => { /* Sound never blocks learning. */ })
  } else begin()
}

/** A short buzz on phones, under the same mute switch as the sounds. */
export function haptic(kind: 'good' | 'miss' | 'streak'): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try { navigator.vibrate(kind === 'good' ? [12, 26, 18] : kind === 'streak' ? [14, 30, 14, 30, 26] : [34]) } catch { /* Not every browser allows it. */ }
}

const synth = {
  correct: () => play([
    { frequency: 523.25, duration: 0.23, gain: 0.28 },
    { frequency: 783.99, offset: 0.065, duration: 0.27, gain: 0.2 },
    { frequency: 1046.5, offset: 0.13, duration: 0.38, gain: 0.15 },
    { frequency: 2093, offset: 0.13, duration: 0.16, gain: 0.025, wave: 'triangle' },
  ]),
  wrong: () => play([
    { frequency: 392, duration: 0.2, gain: 0.2 },
    { frequency: 329.63, offset: 0.09, duration: 0.29, gain: 0.15 },
  ], 0.17),
  reveal: () => play([
    { frequency: 659.25, duration: 0.17, gain: 0.18 },
    { frequency: 987.77, offset: 0.045, duration: 0.24, gain: 0.11 },
  ], 0.16),
  listen: () => play([
    { frequency: 440, duration: 0.1, gain: 0.18 },
    { frequency: 660, offset: 0.055, duration: 0.16, gain: 0.13 },
  ], 0.16),
  advance: () => play([
    { frequency: 480, endFrequency: 720, duration: 0.09, gain: 0.13, wave: 'triangle' },
    { frequency: 960, offset: 0.035, duration: 0.13, gain: 0.07 },
  ], 0.14),
  tick: () => play([{ frequency: 1320, duration: 0.05, gain: 0.08, wave: 'triangle' }], 0.12),
  complete: () => {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    play(notes.flatMap((frequency, index) => [
      { frequency, offset: index * 0.095, duration: 0.52, gain: 0.2 },
      { frequency: frequency * 2, offset: index * 0.095, duration: 0.25, gain: 0.035, wave: 'triangle' as OscillatorType },
    ]), 0.2)
  },
}

/** A mechanical lock, then a bright chime: the answer clicked into place. */
export function playCorrect(): void {
  sample('lock', synth.correct)
  sample('chime', () => {}, 0.06)
}

/** A soft double knock: retry is an invitation, not a punishment. */
export function playWrong(): void {
  sample('knock', synth.wrong)
}

/** The answer card opening. */
export function playReveal(): void {
  sample('open', synth.reveal)
}

/** Each hint step: a small mechanical rattle. */
export function playHint(): void {
  sample('hint', synth.reveal)
}

/** One line of a card arriving. */
export function playTick(): void {
  sample('tick', synth.tick)
}

export function playListen(): void {
  sample('tap', synth.listen)
}

/** Moving to the next card. */
export function playAdvance(): void {
  sample('slide', synth.advance)
}

/** A rating button pressed: the date is set. */
export function playRate(): void {
  sample('shutter', synth.advance)
}

/** Practice begins. */
export function playStart(): void {
  sample('servo', synth.advance)
}

export function playComplete(): void {
  sample('complete', synth.complete)
}

/** Ascending pentatonic chime scaled gently with active streak combo (1..8). */
export function playCombo(streak: number): void {
  const tier = Math.max(0, Math.min(8, Math.floor(streak)))
  const root = 523.25 * Math.pow(1.06, tier)
  play(
    [
      { frequency: root, duration: 0.14, gain: 0.22 },
      { frequency: root * 1.25, offset: 0.045, duration: 0.16, gain: 0.18 },
      { frequency: root * 1.5, offset: 0.09, duration: 0.22, gain: 0.15 },
      ...(tier >= 3
        ? [{ frequency: root * 2, offset: 0.135, duration: 0.2, gain: 0.09, wave: 'triangle' as OscillatorType }]
        : []),
    ],
    0.22,
  )
  if (tier >= 3) haptic('streak')
}
