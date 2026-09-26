let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    return ctx
  } catch {
    return null
  }
}

async function ensureRunning(audio: AudioContext): Promise<void> {
  if (audio.state === 'suspended') {
    try {
      await audio.resume()
    } catch {
      /* ignore */
    }
  }
}

function tone(
  audio: AudioContext,
  master: GainNode,
  when: number,
  freq: number,
  dur: number,
  peak: number,
  type: OscillatorType,
) {
  const osc = audio.createOscillator()
  const g = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, when)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(peak, when + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(when)
  osc.stop(when + dur + 0.02)
}

/** A small major arpeggio, about a second. Call from a click. */
export function playCorrect(): void {
  try {
    const audio = getCtx()
    if (!audio) return
    void ensureRunning(audio).then(() => {
      try {
        const now = audio.currentTime
        const master = audio.createGain()
        master.gain.setValueAtTime(0.22, now)
        master.connect(audio.destination)
        const notes = [523.25, 659.25, 783.99, 1046.5]
        notes.forEach((freq, i) => {
          const at = now + i * 0.16
          tone(audio, master, at, freq, 0.72, 0.2, 'sine')
          tone(audio, master, at, freq * 2, 0.4, 0.04, 'triangle')
        })
      } catch {
        /* never throw */
      }
    })
  } catch {
    /* never throw */
  }
}

/** Two soft falling notes. Call from a click. */
export function playWrong(): void {
  try {
    const audio = getCtx()
    if (!audio) return
    void ensureRunning(audio).then(() => {
      try {
        const now = audio.currentTime
        const master = audio.createGain()
        master.gain.setValueAtTime(0.2, now)
        master.connect(audio.destination)
        tone(audio, master, now, 311, 0.28, 0.16, 'sine')
        tone(audio, master, now + 0.12, 196, 0.36, 0.12, 'sine')
      } catch {
        /* never throw */
      }
    })
  } catch {
    /* never throw */
  }
}
