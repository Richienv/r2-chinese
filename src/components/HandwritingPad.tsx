import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import dictionaryUrl from '../assets/handwriting/medians.bin?url'
import licenseUrl from '../assets/handwriting/ARPHICPL.TXT?url'
import { assessHandwritingWord, loadHandwritingModel, type HandwritingModel, type HandwritingWordAssessment, type InkDrawing, type InkPoint, type InkStroke } from '../lib/handwriting'
import '../styles/handwriting.css'

const SIZE = 320

/** Capture ink only. Recognition never displays suggestions during recall. */
export function HandwritingPad({ drawing, onChange, disabled = false, position = 1, total = 1 }: {
  drawing: InkDrawing
  onChange: (drawing: InkDrawing) => void
  disabled?: boolean
  position?: number
  total?: number
}) {
  const panel = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const activePointer = useRef<number | null>(null)
  const liveStroke = useRef<InkStroke>([])
  const completedStrokes = useRef<InkDrawing>(drawing)
  const [drawingStroke, setDrawingStroke] = useState(false)

  useEffect(() => {
    // Only opening the pad scrolls. Drawing and changing character must keep
    // the writing surface in the same place beneath the learner's hand.
    const frame = window.requestAnimationFrame(() => {
      const section = panel.current
      const body = section?.closest<HTMLElement>('.overlay-body')
      if (!section || !body) return
      const top = body.scrollTop + section.getBoundingClientRect().top - body.getBoundingClientRect().top - 24
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      body.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  function redraw() {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const ratio = element.width / SIZE
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, SIZE, SIZE)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#322621'
    context.fillStyle = '#322621'
    context.lineWidth = 5.5
    for (const stroke of [...completedStrokes.current, liveStroke.current]) {
      if (!stroke.length) continue
      if (stroke.length === 1) {
        context.beginPath(); context.arc(stroke[0][0], stroke[0][1], 2.75, 0, Math.PI * 2); context.fill()
      } else {
        context.beginPath(); context.moveTo(stroke[0][0], stroke[0][1])
        for (const [x, y] of stroke.slice(1)) context.lineTo(x, y)
        context.stroke()
      }
    }
  }

  useEffect(() => {
    completedStrokes.current = drawing
    liveStroke.current = []
    activePointer.current = null
    setDrawingStroke(false)
    redraw()
  }, [drawing, position])

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const resize = () => {
      const width = element.getBoundingClientRect().width || SIZE
      element.width = Math.round(width * (window.devicePixelRatio || 1))
      element.height = element.width
      redraw()
    }
    resize()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function point(event: PointerEvent | ReactPointerEvent<HTMLCanvasElement>): InkPoint {
    const rect = canvas.current!.getBoundingClientRect()
    return [Math.max(0, Math.min(SIZE, (event.clientX - rect.left) / rect.width * SIZE)), Math.max(0, Math.min(SIZE, (event.clientY - rect.top) / rect.height * SIZE))]
  }

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || activePointer.current !== null || !event.isPrimary || event.button !== 0 || completedStrokes.current.length >= 64) return
    event.preventDefault()
    activePointer.current = event.pointerId
    setDrawingStroke(true)
    liveStroke.current = [point(event)]
    event.currentTarget.setPointerCapture(event.pointerId)
    redraw()
  }

  function moveStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerId !== activePointer.current) return
    event.preventDefault()
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent]
    for (const entry of events.length ? events : [event.nativeEvent]) {
      const next = point(entry)
      const previous = liveStroke.current[liveStroke.current.length - 1]
      if (!previous || Math.hypot(next[0] - previous[0], next[1] - previous[1]) >= 0.8) liveStroke.current.push(next)
    }
    redraw()
  }

  function endStroke(event: ReactPointerEvent<HTMLCanvasElement>, cancelled = false) {
    if (event.pointerId !== activePointer.current) return
    event.preventDefault()
    if (!cancelled) {
      liveStroke.current.push(point(event))
      completedStrokes.current = [...completedStrokes.current, liveStroke.current]
    }
    liveStroke.current = []
    activePointer.current = null
    setDrawingStroke(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    onChange(completedStrokes.current)
    redraw()
  }

  function changeInk(next: InkDrawing) {
    liveStroke.current = []
    completedStrokes.current = next
    onChange(next)
    redraw()
  }

  return (
    <section ref={panel} className="handwriting-pad" aria-label="Hanzi handwriting input">
      <div className="handwriting-intro"><strong>Character {position} of {total}</strong><span>Draw from memory. Check after the whole word.</span></div>
      <div className="handwriting-board" data-disabled={disabled}>
        <span className="handwriting-guide handwriting-guide-h" aria-hidden="true" /><span className="handwriting-guide handwriting-guide-v" aria-hidden="true" />
        <canvas ref={canvas} width={SIZE} height={SIZE} className="handwriting-canvas" aria-label={`Draw character ${position} of ${total} with your finger, pen, or mouse`} onPointerDown={startStroke} onPointerMove={moveStroke} onPointerUp={(event) => endStroke(event)} onPointerCancel={(event) => endStroke(event, true)} onLostPointerCapture={(event) => endStroke(event, true)} />
        {!drawing.length && !drawingStroke && <span className="handwriting-empty" aria-hidden="true">Write here</span>}
      </div>
      <div className="handwriting-tools">
        <span className="sub">{drawing.length} {drawing.length === 1 ? 'stroke' : 'strokes'}</span>
        <button type="button" className="btn btn-ghost" disabled={disabled || !drawing.length} onClick={() => changeInk(completedStrokes.current.slice(0, -1))}>Undo stroke</button>
        <button type="button" className="btn btn-ghost" disabled={disabled || !drawing.length} onClick={() => changeInk([])}>Clear character</button>
      </div>
      <p className="handwriting-note">Handwriting is checked on this device. <a href={licenseUrl} target="_blank" rel="noreferrer">Stroke data © Arphic / Make Me a Hanzi · license</a>.</p>
    </section>
  )
}

type PendingAssessment = {
  id: number
  drawings: InkDrawing[]
  expectedWord: string
  resolve: (assessment: HandwritingWordAssessment) => void
  reject: (error: Error) => void
  timeout?: number
}

/** One worker handles every captured glyph; a device-local fallback survives worker failures. */
export function useHandwritingWordAssessment(enabled: boolean) {
  const worker = useRef<Worker | null>(null)
  const fallbackModel = useRef<HandwritingModel | null>(null)
  const pending = useRef<PendingAssessment | null>(null)
  const nextRequest = useRef(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'checking' | 'error'>('loading')
  const [count, setCount] = useState(0)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let fallbackStarted = false
    let ready = false
    fallbackModel.current = null
    setCount(0)
    setStatus('loading')

    const complete = (assessment: HandwritingWordAssessment, id: number) => {
      const request = pending.current
      if (cancelled || !request || request.id !== id) return
      window.clearTimeout(request.timeout)
      pending.current = null
      setStatus('ready')
      request.resolve(assessment)
    }
    const runFallback = (model: HandwritingModel) => {
      const request = pending.current
      if (!request || cancelled) return
      // Paint the checking state before the synchronous fallback runs.
      window.setTimeout(() => {
        if (cancelled || pending.current?.id !== request.id) return
        try { complete(assessHandwritingWord(request.drawings, model, request.expectedWord), request.id) }
        catch {
          window.clearTimeout(request.timeout)
          pending.current = null
          setStatus('error')
          request.reject(new Error('Handwriting could not be checked. Retry or type your answer.'))
        }
      }, 0)
    }
    const fallback = () => {
      worker.current?.terminate()
      worker.current = null
      if (fallbackStarted) return
      fallbackStarted = true
      void loadHandwritingModel(dictionaryUrl).then((model) => {
        if (cancelled) return
        fallbackModel.current = model
        ready = true
        setCount(model.templates.length)
        setStatus(pending.current ? 'checking' : 'ready')
        runFallback(model)
      }).catch(() => {
        if (cancelled) return
        setStatus('error')
        const request = pending.current
        if (request) {
          window.clearTimeout(request.timeout)
          pending.current = null
          request.reject(new Error('The handwriting dictionary could not load. Retry or type your answer.'))
        }
      })
    }

    try {
      if (typeof Worker === 'undefined') fallback()
      else {
        const recognizer = new Worker(new URL('../lib/handwriting.worker.ts', import.meta.url), { type: 'module' })
        worker.current = recognizer
        recognizer.onmessage = (event: MessageEvent<{ type: string; count?: number; id?: number; assessment?: HandwritingWordAssessment }>) => {
          if (cancelled) return
          if (event.data.type === 'ready') {
            ready = true
            setCount(event.data.count ?? 0)
            setStatus('ready')
          } else if (event.data.type === 'word-assessment' && event.data.assessment && typeof event.data.id === 'number') complete(event.data.assessment, event.data.id)
          else if (event.data.type === 'error') fallback()
        }
        recognizer.onerror = fallback
        recognizer.postMessage({ type: 'init', url: dictionaryUrl })
      }
    } catch { fallback() }

    const timeout = window.setTimeout(() => { if (!cancelled && !ready) fallback() }, 15000)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      worker.current?.terminate()
      worker.current = null
      const request = pending.current
      if (request) {
        window.clearTimeout(request.timeout)
        pending.current = null
        request.reject(new Error('Handwriting check cancelled.'))
      }
    }
  }, [enabled, reload])

  function assess(drawings: InkDrawing[], expectedWord: string): Promise<HandwritingWordAssessment> {
    if (status !== 'ready' || pending.current) return Promise.reject(new Error('Wait for the handwriting dictionary, then check again.'))
    const id = ++nextRequest.current
    setStatus('checking')
    return new Promise((resolve, reject) => {
      const request: PendingAssessment = { id, drawings, expectedWord, resolve, reject }
      pending.current = request
      request.timeout = window.setTimeout(() => {
        if (pending.current?.id !== id) return
        worker.current?.terminate()
        worker.current = null
        void loadHandwritingModel(dictionaryUrl).then((model) => {
          if (pending.current?.id !== id) return
          fallbackModel.current = model
          const result = assessHandwritingWord(drawings, model, expectedWord)
          pending.current = null
          setStatus('ready')
          resolve(result)
        }).catch(() => {
          if (pending.current?.id !== id) return
          pending.current = null
          setStatus('error')
          reject(new Error('Handwriting could not be checked. Retry or type your answer.'))
        })
      }, 15000)
      if (worker.current) worker.current.postMessage({ type: 'assess-word', id, drawings, expectedWord })
      else if (fallbackModel.current) {
        window.setTimeout(() => {
          if (pending.current?.id !== id) return
          try {
            const result = assessHandwritingWord(drawings, fallbackModel.current!, expectedWord)
            window.clearTimeout(request.timeout)
            pending.current = null
            setStatus('ready')
            resolve(result)
          } catch {
            window.clearTimeout(request.timeout)
            pending.current = null
            setStatus('error')
            reject(new Error('Handwriting could not be checked. Retry or type your answer.'))
          }
        }, 0)
      }
    })
  }

  return { status, count, assess, retry: () => setReload((value) => value + 1) }
}
