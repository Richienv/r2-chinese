import { useEffect, useRef, useState } from 'react'

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

/** A real microphone spectrum. No synthetic levels if microphone access fails. */
export function VoiceWaveform({ active, analyser: suppliedAnalyser }: {
  active: boolean
  analyser?: AnalyserNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const pen = canvas?.getContext('2d')
    if (!canvas || !pen) return
    let cancelled = false
    let frame = 0
    let width = 240
    const height = 56
    let stream: MediaStream | undefined
    let audio: AudioContext | undefined
    let source: MediaStreamAudioSourceNode | undefined
    let analyser = suppliedAnalyser
    let samples = new Uint8Array(analyser?.frequencyBinCount ?? 256)
    const levels = Array<number>(40).fill(0)

    const draw = () => {
      pen.clearRect(0, 0, width, height)
      const color = active ? '#c4171a' : '#bdb4a9'
      const barWidth = Math.min(3.5, width / 100)
      const gap = width / levels.length
      if (active && analyser && !reduced) analyser.getByteFrequencyData(samples)
      for (let index = 0; index < levels.length; index += 1) {
        // Speech frequencies, logarithmically sampled; a short release retains texture.
        const bin = Math.min(samples.length - 1, Math.floor(2 + (index / levels.length) ** 1.5 * 100))
        const energy = active && analyser && !reduced ? samples[bin] / 255 : 0
        levels[index] += (energy - levels[index]) * (energy > levels[index] ? 0.46 : 0.12)
        const barHeight = 3 + levels[index] ** 1.4 * 43
        pen.fillStyle = color
        pen.globalAlpha = active ? 0.4 + levels[index] * 0.6 : 0.36
        const x = gap * (index + 0.5) - barWidth / 2
        const y = (height - barHeight) / 2
        pen.beginPath()
        pen.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        pen.fill()
      }
      pen.globalAlpha = 1
    }
    const size = () => {
      width = Math.max(120, canvas.getBoundingClientRect().width)
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      pen.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw()
    }
    const animate = () => {
      if (cancelled) return
      draw()
      frame = requestAnimationFrame(animate)
    }
    size()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null
    observer?.observe(canvas)
    if (!observer) window.addEventListener('resize', size)

    const begin = () => {
      if (cancelled || reduced) return
      samples = new Uint8Array(analyser?.frequencyBinCount ?? 256)
      animate()
    }
    if (active && !reduced) {
      if (analyser) begin()
      else if (navigator.mediaDevices?.getUserMedia) {
        void navigator.mediaDevices.getUserMedia({ audio: true }).then(async (input) => {
          if (cancelled) {
            input.getTracks().forEach((track) => track.stop())
            return
          }
          stream = input
          try {
            const Audio = window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
            if (!Audio) {
              input.getTracks().forEach((track) => track.stop())
              return
            }
            audio = new Audio()
            analyser = audio.createAnalyser()
            analyser.fftSize = 512
            analyser.smoothingTimeConstant = 0.65
            source = audio.createMediaStreamSource(input)
            source.connect(analyser)
            if (audio.state === 'suspended') await audio.resume()
            begin()
          } catch {
            // The speech input remains usable even if visualization is unavailable.
            source?.disconnect()
            analyser?.disconnect()
            stream.getTracks().forEach((track) => track.stop())
            if (audio && audio.state !== 'closed') void audio.close().catch(() => {})
          }
        }).catch(() => { /* Keep a static baseline rather than simulate a microphone. */ })
      }
    }
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      if (!observer) window.removeEventListener('resize', size)
      source?.disconnect()
      if (!suppliedAnalyser) analyser?.disconnect()
      stream?.getTracks().forEach((track) => track.stop())
      if (audio && audio.state !== 'closed') void audio.close().catch(() => {})
    }
  }, [active, reduced, suppliedAnalyser])

  return <div className="voice-waveform" data-active={active} aria-hidden="true">
    <canvas ref={canvasRef} />
  </div>
}

export type RecallState = 'idle' | 'listening' | 'thinking' | 'correct' | 'retry'

const glyphs: Record<RecallState, number[]> = {
  idle: [15, 24, 19, 24, 24, 24, 29, 24, 33, 24],
  listening: [16, 26, 20, 19, 24, 30, 28, 18, 32, 24],
  thinking: [16, 24, 20, 18, 26, 18, 31, 24, 31, 28],
  correct: [14, 24, 19, 29, 22, 32, 28, 24, 35, 16],
  retry: [33, 18, 26, 15, 18, 18, 16, 26, 23, 32],
}
const labels: Record<RecallState, string> = {
  idle: 'Retrieve before revealing',
  listening: 'Listening to your response',
  thinking: 'Checking your response',
  correct: 'Retrieved from memory',
  retry: 'Try retrieving it again',
}

/** A continuous SVG morph with a single, frame-driven burst on retrieval. */
export function RecallFeedback({ state, label }: { state: RecallState; label?: string }) {
  const pathRef = useRef<SVGPolylineElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const particlesRef = useRef<SVGGElement>(null)
  const current = useRef(glyphs.idle.slice())
  const reduced = useReducedMotion()

  useEffect(() => {
    const path = pathRef.current
    const ring = ringRef.current
    const particles = particlesRef.current
    if (!path || !ring || !particles) return
    let frame = 0
    let started = 0
    const from = current.current.slice()
    const target = glyphs[state]
    const children = Array.from(particles.children)
    const plot = (values: number[]) => values.reduce((points, value, index) =>
      points + `${value}${index % 2 === 0 ? ',' : ' '}`, '')
    const duration = reduced ? 0 : state === 'correct' ? 720 : 420
    const update = (time: number) => {
      if (!started) started = time
      const elapsed = time - started
      const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration)
      const eased = 1 - Math.exp(-7 * progress) * Math.cos(8 * progress)
      current.current = target.map((value, index) =>
        progress === 1 ? value : from[index] + (value - from[index]) * eased,
      )
      path.setAttribute('points', plot(current.current))
      ring.style.strokeDashoffset = String((1 - Math.min(1, progress * 1.8)) * 126)
      const burst = Math.max(0, Math.min(1, (progress - 0.1) / 0.8))
      children.forEach((particle, index) => {
        const angle = index / children.length * Math.PI * 2 - Math.PI / 2
        const distance = 18 + (1 - (1 - burst) ** 3) * 17
        particle.setAttribute('cx', String(24 + Math.cos(angle) * distance))
        particle.setAttribute('cy', String(24 + Math.sin(angle) * distance))
        particle.setAttribute('r', String(1.2 * (1 - burst) + 0.2))
        particle.setAttribute('opacity', String(state === 'correct' && !reduced && burst > 0 ? (1 - burst) * 0.75 : 0))
      })
      if (progress < 1) frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [state, reduced])

  return <div className="recall-feedback" data-state={state} role="status" aria-live="polite">
    <svg className="recall-feedback-icon" viewBox="-12 -12 72 72" aria-hidden="true">
      <circle className="recall-feedback-disc" cx="24" cy="24" r="22" />
      <circle ref={ringRef} className="recall-feedback-ring" cx="24" cy="24" r="20" />
      <polyline ref={pathRef} className="recall-feedback-glyph" points="15,24 19,24 24,24 29,24 33,24" />
      <g ref={particlesRef} className="recall-feedback-particles">
        {Array.from({ length: 8 }, (_, index) => <circle key={index} cx="24" cy="24" r="0" opacity="0" />)}
      </g>
    </svg>
    <span>{label ?? labels[state]}</span>
  </div>
}
