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

const playing = new Set<{ master: GainNode; oscillators: OscillatorNode[] }>()

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

/** A bright, compact resolved interval when an answer is retrieved. */
export function playCorrect(): void {
  play([
    { frequency: 523.25, duration: 0.23, gain: 0.28 },
    { frequency: 783.99, offset: 0.065, duration: 0.27, gain: 0.2 },
    { frequency: 1046.5, offset: 0.13, duration: 0.38, gain: 0.15 },
    { frequency: 2093, offset: 0.13, duration: 0.16, gain: 0.025, wave: 'triangle' },
  ])
}

/** A soft descending cue: retry is an invitation, not a punishment. */
export function playWrong(): void {
  play([
    { frequency: 392, duration: 0.2, gain: 0.2 },
    { frequency: 329.63, offset: 0.09, duration: 0.29, gain: 0.15 },
  ], 0.17)
}

export function playReveal(): void {
  play([
    { frequency: 659.25, duration: 0.17, gain: 0.18 },
    { frequency: 987.77, offset: 0.045, duration: 0.24, gain: 0.11 },
  ], 0.16)
}

export function playListen(): void {
  play([
    { frequency: 440, duration: 0.1, gain: 0.18 },
    { frequency: 660, offset: 0.055, duration: 0.16, gain: 0.13 },
  ], 0.16)
}

export function playAdvance(): void {
  play([
    { frequency: 480, endFrequency: 720, duration: 0.09, gain: 0.13, wave: 'triangle' },
    { frequency: 960, offset: 0.035, duration: 0.13, gain: 0.07 },
  ], 0.14)
}

export function playComplete(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  play(notes.flatMap((frequency, index) => [
    { frequency, offset: index * 0.095, duration: 0.52, gain: 0.2 },
    { frequency: frequency * 2, offset: index * 0.095, duration: 0.25, gain: 0.035, wave: 'triangle' as OscillatorType },
  ]), 0.2)
}
