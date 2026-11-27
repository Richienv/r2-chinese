// Web Audio API synthesizer for Yulu's Legendary Beast Reveal cinema:
// - 0.00s..1.15s: rising spirit energy + jade sparkle ticks
// - 1.15s: sub-bass shockwave impact + wind burst
// - 1.18s..2.75s: Chinese pentatonic celestial fanfare tuned by rarity
import type { BeastRarity } from './beastStages'

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

function makeContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as AudioWindow
  const Ctor = w.AudioContext || w.webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor()
  } catch {
    return null
  }
}

// Major pentatonic fanfare chords (D-E-F#-A-B / C-D-E-G-A) with shimmering overtones
const BEAST_CHORDS: Record<BeastRarity, { chord: number[]; arp: number[] }> = {
  rare: {
    chord: [261.63, 329.63, 392.0, 440.0, 587.33],
    arp: [523.25, 587.33, 659.25, 783.99, 1046.5],
  },
  epic: {
    chord: [293.66, 369.99, 440.0, 493.88, 659.25],
    arp: [587.33, 659.25, 739.99, 880.0, 1174.66],
  },
  gold: {
    chord: [196.0, 293.66, 392.0, 493.88, 587.33, 659.25],
    arp: [587.33, 783.99, 880.0, 987.77, 1174.66, 1567.98],
  },
  legendary: {
    chord: [220.0, 293.66, 392.0, 440.0, 587.33, 659.25, 880.0],
    arp: [523.25, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1760.0],
  },
}

export function playBeastRevealSound(rarity: BeastRarity): () => void {
  const ctx = makeContext()
  if (!ctx) return () => {}

  let closed = false
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.24, ctx.currentTime)
  master.connect(ctx.destination)

  const now = ctx.currentTime + 0.02
  const burstAt = now + 1.15

  // 1) Spirit charge riser
  const riser = ctx.createOscillator()
  const riserFilter = ctx.createBiquadFilter()
  const riserGain = ctx.createGain()
  riser.type = 'sawtooth'
  riser.frequency.setValueAtTime(64, now)
  riser.frequency.exponentialRampToValueAtTime(220, burstAt)
  riserFilter.type = 'lowpass'
  riserFilter.frequency.setValueAtTime(190, now)
  riserFilter.frequency.exponentialRampToValueAtTime(2100, burstAt)
  riserGain.gain.setValueAtTime(0.0001, now)
  riserGain.gain.exponentialRampToValueAtTime(0.18, now + 0.96)
  riserGain.gain.exponentialRampToValueAtTime(0.0001, burstAt + 0.04)
  riser.connect(riserFilter).connect(riserGain).connect(master)
  riser.start(now)
  riser.stop(burstAt + 0.06)

  // Accelerating jade spirit ticks
  ;[0.12, 0.34, 0.54, 0.72, 0.87, 0.99, 1.08].forEach((offset, idx) => {
    const t = now + offset
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    const freq = 587.33 + idx * 140
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.22, t + 0.09)
    g.gain.setValueAtTime(0.001, t)
    g.gain.linearRampToValueAtTime(0.08 + idx * 0.015, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
    osc.connect(g).connect(master)
    osc.start(t)
    osc.stop(t + 0.12)
  })

  // 2) Impact gong / sub drop at 1.15s
  const sub = ctx.createOscillator()
  const subGain = ctx.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(145, burstAt)
  sub.frequency.exponentialRampToValueAtTime(36, burstAt + 0.52)
  subGain.gain.setValueAtTime(0.5, burstAt)
  subGain.gain.exponentialRampToValueAtTime(0.0001, burstAt + 0.56)
  sub.connect(subGain).connect(master)
  sub.start(burstAt)
  sub.stop(burstAt + 0.58)

  try {
    const sampleRate = ctx.sampleRate || 44100
    const len = Math.floor(sampleRate * 0.6)
    const buf = ctx.createBuffer(1, len, sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.2))
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.Q.setValueAtTime(1.1, burstAt)
    nf.frequency.setValueAtTime(2200, burstAt)
    nf.frequency.exponentialRampToValueAtTime(280, burstAt + 0.58)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.3, burstAt)
    ng.gain.exponentialRampToValueAtTime(0.0001, burstAt + 0.6)
    noise.connect(nf).connect(ng).connect(master)
    noise.start(burstAt)
  } catch {
    /* ignore buffer issues */
  }

  // 3) Pentatonic dragon fanfare & chime cascade
  const cfg = BEAST_CHORDS[rarity]
  cfg.chord.forEach((freq, i) => {
    const t = burstAt + 0.03 + i * 0.025
    const a = ctx.createOscillator()
    const b = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    a.type = 'triangle'
    b.type = 'sine'
    a.frequency.setValueAtTime(freq, t)
    b.frequency.setValueAtTime(freq * 1.004, t)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2600, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.11 / Math.max(1, cfg.chord.length * 0.45), t + 0.08)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55)
    a.connect(filter)
    b.connect(filter)
    filter.connect(g).connect(master)
    a.start(t)
    b.start(t)
    a.stop(t + 1.6)
    b.stop(t + 1.6)
  })

  cfg.arp.forEach((freq, idx) => {
    const t = burstAt + 0.18 + idx * 0.075
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.085, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72)
    osc.connect(g).connect(master)
    osc.start(t)
    osc.stop(t + 0.76)
  })

  const timer = window.setTimeout(() => {
    if (!closed) {
      closed = true
      void ctx.close().catch(() => {})
    }
  }, 3400)

  return () => {
    window.clearTimeout(timer)
    if (!closed) {
      closed = true
      try {
        master.gain.setValueAtTime(0.0001, ctx.currentTime)
      } catch {}
      void ctx.close().catch(() => {})
    }
  }
}

export function playBeastTapChime(): void {
  const ctx = makeContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }
  const now = ctx.currentTime + 0.01
  ;[783.99, 1174.66].forEach((freq, idx) => {
    const t = now + idx * 0.055
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.001, t)
    g.gain.linearRampToValueAtTime(0.085, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    osc.connect(g).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.28)
  })
  window.setTimeout(() => {
    void ctx.close().catch(() => {})
  }, 450)
}
