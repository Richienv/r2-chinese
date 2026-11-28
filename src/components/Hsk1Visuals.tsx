import { useCallback, useEffect, useId, useRef, useState } from 'react'
import HanziWriter, { type CharacterJson } from 'hanzi-writer'
import type { BasicStrokeGuide } from '../data/hsk1Strokes'
import introStrokeData from '../data/strokes/intro.json'
import { playCorrect, playTick, playWrong } from '../lib/sfx'
import { StrokeWord } from './StrokeWord'

const DATA_VERSION = '2.0.1'
const charJsonCache = new Map<string, CharacterJson>()

function validCharData(value: unknown): value is CharacterJson {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<CharacterJson>
  return (
    Array.isArray(data.strokes) &&
    data.strokes.length > 0 &&
    data.strokes.every((s) => typeof s === 'string') &&
    Array.isArray(data.medians) &&
    data.medians.length === data.strokes.length
  )
}

async function fetchCharData(char: string, signal: AbortSignal): Promise<CharacterJson> {
  const bundled = (introStrokeData as Record<string, CharacterJson>)[char]
  if (bundled) return bundled
  const cached = charJsonCache.get(char)
  if (cached) return cached
  const res = await fetch(
    `https://cdn.jsdelivr.net/npm/hanzi-writer-data@${DATA_VERSION}/${encodeURIComponent(char)}.json`,
    { signal },
  )
  if (!res.ok) throw new Error('Stroke data unavailable')
  const json: unknown = await res.json()
  if (!validCharData(json)) throw new Error('Invalid stroke JSON')
  charJsonCache.set(char, json)
  return json
}

const TONE_PATHS: Record<number, { d: string; end: [number, number] }> = {
  1: { d: 'M 18 18 L 124 18', end: [124, 18] },
  2: { d: 'M 18 48 Q 70 42 124 16', end: [124, 16] },
  3: { d: 'M 18 46 Q 52 70 78 66 Q 104 62 124 28', end: [124, 28] },
  4: { d: 'M 18 16 Q 70 36 124 70', end: [124, 70] },
  0: { d: 'M 46 44 Q 70 40 94 44', end: [94, 44] },
}

export function ToneWaveSvg({
  tone,
  colorHex,
  playing = false,
  size = 138,
}: {
  tone: 0 | 1 | 2 | 3 | 4 | number
  colorHex: string
  playing?: boolean
  size?: number
}) {
  const cfg = TONE_PATHS[tone] ?? TONE_PATHS[1]
  const h = Math.round(size * 0.6)
  return (
    <svg
      className={`hsk1-tone-wave${playing ? ' is-playing' : ''}`}
      width={size}
      height={h}
      viewBox="0 0 140 84"
      role="img"
      aria-label={`Kontur Nada ${tone === 0 ? 'Netral' : tone}`}
    >
      <line x1="12" y1="18" x2="128" y2="18" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 4" />
      <line x1="12" y1="44" x2="128" y2="44" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 4" />
      <line x1="12" y1="70" x2="128" y2="70" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="4" y="21" fontSize="8" fontWeight="700" fill="#94a3b8">
        5
      </text>
      <text x="4" y="47" fontSize="8" fontWeight="700" fill="#94a3b8">
        3
      </text>
      <text x="4" y="73" fontSize="8" fontWeight="700" fill="#94a3b8">
        1
      </text>
      <path d={cfg.d} fill="none" stroke={colorHex} strokeOpacity="0.2" strokeWidth="10" strokeLinecap="round" />
      <path
        className="hsk1-wave-stroke"
        d={cfg.d}
        fill="none"
        stroke={colorHex}
        strokeWidth="5"
        strokeLinecap="round"
        pathLength={100}
      />
      <circle cx={cfg.end[0]} cy={cfg.end[1]} r="5.5" fill={colorHex} />
      {tone === 0 && <circle cx="70" cy="42" r="6" fill={colorHex} opacity="0.65" />}
    </svg>
  )
}

export function BasicStrokeSvg({
  stroke,
  playKey = 0,
  size = 132,
}: {
  stroke: BasicStrokeGuide
  playKey?: number
  size?: number
}) {
  const markerId = useId()
  return (
    <svg
      key={`${stroke.id}-${playKey}`}
      className="hsk1-stroke-guide-svg"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Arah goresan ${stroke.nameId} (${stroke.zh})`}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 1 1 L 8 5 L 1 9 z" fill={stroke.colorHex} />
        </marker>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="14" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      <line x1="50" y1="6" x2="50" y2="94" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="6" y1="50" x2="94" y2="50" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="8" y1="8" x2="92" y2="92" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="92" y1="8" x2="8" y2="92" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
      <path
        d={stroke.svgPath}
        fill="none"
        stroke={stroke.colorHex}
        strokeOpacity="0.16"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="hsk1-stroke-anim-path"
        d={stroke.svgPath}
        fill="none"
        stroke={stroke.colorHex}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#${markerId})`}
        pathLength={100}
      />
      <circle cx={stroke.startDot[0]} cy={stroke.startDot[1]} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
    </svg>
  )
}

export function HanziTracePad({
  char,
  onComplete,
  onMistake,
  size = 188,
}: {
  char: string
  onComplete: () => void
  onMistake?: () => void
  size?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<ReturnType<typeof HanziWriter.create> | null>(null)
  const onCompleteRef = useRef(onComplete)
  const onMistakeRef = useRef(onMistake)
  onCompleteRef.current = onComplete
  onMistakeRef.current = onMistake

  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'fallback'>('loading')
  const [totalStrokes, setTotalStrokes] = useState(0)
  const [doneStrokes, setDoneStrokes] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [runSeed, setRunSeed] = useState(0)

  const beginQuiz = useCallback((writer: ReturnType<typeof HanziWriter.create>) => {
    void writer.quiz({
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      leniency: 1.25,
      onCorrectStroke: (data) => {
        playTick()
        setDoneStrokes(data.strokeNum + 1)
      },
      onMistake: () => {
        playWrong()
        setMistakes((m) => m + 1)
        onMistakeRef.current?.()
      },
      onComplete: () => {
        playCorrect()
        setStatus('done')
        onCompleteRef.current()
      },
    })
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    const ac = new AbortController()
    const timer = window.setTimeout(() => ac.abort(), 8000)

    host.replaceChildren()
    setStatus('loading')
    setDoneStrokes(0)
    setMistakes(0)

    async function mount() {
      try {
        const data = await fetchCharData(char, ac.signal)
        if (disposed || !host) return
        setTotalStrokes(data.strokes.length)

        const writer = HanziWriter.create(host, char, {
          width: size,
          height: size,
          padding: 12,
          showOutline: true,
          showCharacter: false,
          strokeColor: '#0f766e',
          radicalColor: '#be185d',
          outlineColor: '#cbd5e1',
          highlightColor: '#f59e0b',
          highlightCompleteColor: '#10b981',
          drawingColor: '#0f172a',
          drawingWidth: 7,
          strokeAnimationSpeed: 1.7,
          delayBetweenStrokes: 160,
          charDataLoader: () => data,
        })
        writerRef.current = writer
        setStatus('ready')
        beginQuiz(writer)
      } catch {
        if (!disposed) {
          writerRef.current = null
          setStatus('fallback')
        }
      } finally {
        window.clearTimeout(timer)
      }
    }
    void mount()

    return () => {
      disposed = true
      window.clearTimeout(timer)
      ac.abort()
      try {
        writerRef.current?.cancelQuiz()
      } catch {
        /* ignore cleanup errors */
      }
      writerRef.current = null
      host.replaceChildren()
    }
  }, [char, size, runSeed, beginQuiz])

  function handleWatchDemo() {
    const w = writerRef.current
    if (!w) return
    try {
      w.cancelQuiz()
    } catch {
      /* ignore */
    }
    void w.animateCharacter({
      onComplete: () => {
        if (writerRef.current) {
          setStatus('ready')
          setDoneStrokes(0)
          beginQuiz(writerRef.current)
        }
      },
    })
  }

  function handleRestart() {
    setRunSeed((n) => n + 1)
  }

  if (status === 'fallback') {
    return (
      <div className="hsk1-trace-fallback">
        <StrokeWord text={char} autoPlay showAttribution={false} />
        <button
          type="button"
          className="hsk1-btn-primary"
          onClick={() => {
            playCorrect()
            setStatus('done')
            onCompleteRef.current()
          }}
        >
          Saya sudah ikuti urutan goresannya ✓
        </button>
      </div>
    )
  }

  return (
    <div className="hsk1-trace-shell">
      <div className="hsk1-trace-meta">
        <span>
          Goresan: <strong>{doneStrokes}</strong> / {totalStrokes || '…'}
        </span>
        {mistakes > 0 && <span className="hsk1-trace-miss">Bantuan arah aktif ({mistakes}×)</span>}
      </div>

      <div className="hsk1-trace-stage" style={{ width: size, height: size }}>
        <svg className="hsk1-trace-grid" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="2" y="2" width="96" height="96" rx="14" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="50" y1="2" x2="50" y2="98" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="2" y1="50" x2="98" y2="50" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="4" y1="4" x2="96" y2="96" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="96" y1="4" x2="4" y2="96" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
        </svg>
        <div ref={hostRef} className="hsk1-trace-canvas" aria-label={`Area menulis ${char}`} />
      </div>

      <div className="hsk1-trace-controls">
        <button type="button" className="hsk1-mini-pill" onClick={handleWatchDemo}>
          ▶ Tonton Urutan
        </button>
        <button type="button" className="hsk1-mini-pill" onClick={handleRestart}>
          ↺ Ulangi
        </button>
      </div>

      {status === 'done' && (
        <div className="hsk1-trace-success">✨ Rapi banget! Semua {totalStrokes} goresan pas!</div>
      )}
    </div>
  )
}
