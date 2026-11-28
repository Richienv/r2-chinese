// Web Audio API synthesizer for Yulu's Legendary Beast Reveal cinema:
// - 0.00s..1.25s (Phase 1): rising celestial shimmer + accelerating Pokémon-card drumroll ticks
// - 1.25s (Burst): crisp flash sub-bass drop + wind burst
// - 1.28s..3.35s (Phase 2/3): triumphant multi-layered victory fanfare + pentatonic cascade
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

const BEAST_CHORDS: Record<BeastRarity, { chord: number[]; fanfare: number[]; arp: number[] }> = {
  rare: {
    chord: [261.63, 329.63, 392.0, 523.25],
    fanfare: [523.25, 659.25, 783.99, 1046.5],
    arp: [523.25, 587.33, 659.25, 783.99, 1046.5, 1318.5],
  },
  epic: {
    chord: [293.66, 369.99, 440.0, 587.33],
    fanfare: [587.33, 739.99, 880.0, 1174.66],
    arp: [587.33, 659.25, 739.99, 880.0, 1174.66, 1479.98],
  },
  gold: {
    chord: [196.0, 293.66, 392.0, 493.88, 587.33],
    fanfare: [587.33, 783.99, 987.77, 1174.66],
    arp: [587.33, 783.99, 880.0, 987.77, 1174.66, 1567.98],
  },
  legendary: {
    chord: [220.0, 329.63, 440.0, 523.25, 659.25],
    fanfare: [523.25, 659.25, 783.99, 1046.5],
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
  master.gain.setValueAtTime(0.28, ctx.currentTime)
  master.connect(ctx.destination)

  const now = ctx.currentTime + 0.02
  const burstAt = now + 1.24

  // 1) Suspense rising crystal shimmer + warm bass swell
  const riser = ctx.createOscillator()
  const riserFilter = ctx.createBiquadFilter()
  const riserGain = ctx.createGain()
  riser.type = 'sawtooth'
  riser.frequency.setValueAtTime(72, now)
  riser.frequency.exponentialRampToValueAtTime(260, burstAt)
  riserFilter.type = 'lowpass'
  riserFilter.frequency.setValueAtTime(220, now)
  riserFilter.frequency.exponentialRampToValueAtTime(2400, burstAt)
  riserGain.gain.setValueAtTime(0.0001, now)
  riserGain.gain.exponentialRampToValueAtTime(0.19, now + 1.04)
  riserGain.gain.exponentialRampToValueAtTime(0.0001, burstAt + 0.04)
  riser.connect(riserFilter).connect(riserGain).connect(master)
  riser.start(now)
  riser.stop(burstAt + 0.06)

  // Accelerating drumroll / crystalline ticks into card flip
  ;[0.08, 0.28, 0.46, 0.62, 0.77, 0.9, 1.01, 1.11, 1.18].forEach((offset, idx) => {
    const t = now + offset
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    const freq = 523.25 + idx * 105
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.18, t + 0.08)
    g.gain.setValueAtTime(0.001, t)
    g.gain.linearRampToValueAtTime(0.075 + idx * 0.015, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    osc.connect(g).connect(master)
    osc.start(t)
    osc.stop(t + 0.11)
  })

  // 2) Sub-bass shockwave impact at flip/flash moment (1.24s)
  const sub = ctx.createOscillator()
  const subGain = ctx.createGain()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(165, burstAt)
  sub.frequency.exponentialRampToValueAtTime(38, burstAt + 0.56)
  subGain.gain.setValueAtTime(0.55, burstAt)
  subGain.gain.exponentialRampToValueAtTime(0.0001, burstAt + 0.62)
  sub.connect(subGain).connect(master)
  sub.start(burstAt)
  sub.stop(burstAt + 0.65)

  try {
    const sampleRate = ctx.sampleRate || 44100
    const len = Math.floor(sampleRate * 0.65)
    const buf = ctx.createBuffer(1, len, sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.22))
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.Q.setValueAtTime(1.1, burstAt)
    nf.frequency.setValueAtTime(2400, burstAt)
    nf.frequency.exponentialRampToValueAtTime(320, burstAt + 0.62)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.32, burstAt)
    ng.gain.exponentialRampToValueAtTime(0.0001, burstAt + 0.64)
    noise.connect(nf).connect(ng).connect(master)
    noise.start(burstAt)
  } catch {
    /* ignore noise buffer issues */
  }

  // 3) Triumphant Victory Fanfare Melody (0-0.55s post-burst) + Rich Chord + Pentatonic Chime Cascade
  const cfg = BEAST_CHORDS[rarity]
  cfg.chord.forEach((freq, i) => {
    const t = burstAt + 0.03 + i * 0.024
    const a = ctx.createOscillator()
    const b = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    a.type = 'triangle'
    b.type = 'sine'
    a.frequency.setValueAtTime(freq, t)
    b.frequency.setValueAtTime(freq * 1.0035, t)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2800, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.14 / Math.max(1, cfg.chord.length * 0.42), t + 0.07)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.85)
    a.connect(filter)
    b.connect(filter)
    filter.connect(g).connect(master)
    a.start(t)
    b.start(t)
    a.stop(t + 1.9)
    b.stop(t + 1.9)
  })

  // Crisp Pokémon-style 4-note victory motif (Ta-da-da-DAA!)
  const leadOffsets = [0.02, 0.14, 0.25, 0.38]
  const leadDurs = [0.11, 0.1, 0.12, 0.95]
  cfg.fanfare.forEach((freq, idx) => {
    const t = burstAt + leadOffsets[idx]
    const dur = leadDurs[idx]
    const lead = ctx.createOscillator()
    const overtone = ctx.createOscillator()
    const g = ctx.createGain()
    lead.type = 'triangle'
    overtone.type = 'sine'
    lead.frequency.setValueAtTime(freq, t)
    overtone.frequency.setValueAtTime(freq * 2, t)
    g.gain.setValueAtTime(0.001, t)
    g.gain.linearRampToValueAtTime(idx === 3 ? 0.16 : 0.12, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    lead.connect(g)
    overtone.connect(g)
    g.connect(master)
    lead.start(t)
    overtone.start(t)
    lead.stop(t + dur + 0.04)
    overtone.stop(t + dur + 0.04)
  })

  // Sparkling high chime arpeggio tail
  cfg.arp.forEach((freq, idx) => {
    const t = burstAt + 0.45 + idx * 0.08
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.08, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.78)
    osc.connect(g).connect(master)
    osc.start(t)
    osc.stop(t + 0.82)
  })

  const timer = window.setTimeout(() => {
    if (!closed) {
      closed = true
      void ctx.close().catch(() => {})
    }
  }, 3800)

  return () => {
    window.clearTimeout(timer)
    if (!closed) {
      closed = true
      try {
        master.gain.setValueAtTime(0.0001, ctx.currentTime)
      } catch {
        /* ignore */
      }
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
