import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { CheckIcon, LockIcon } from './Icons'
import { unlockSpeech } from '../lib/speech'
import '../styles/home-alive.css'

export interface LearningPathItem {
  id: string
  label: string
  title: string
  subtitle?: string
  state: 'done' | 'current' | 'locked'
  playable: boolean
  onSelect: () => void
}

export interface LearningPathProps {
  kicker?: string
  title: string
  subtitle?: string
  source?: string
  items: LearningPathItem[]
  open?: boolean
  onOpen?: () => void
  fill?: boolean
}

/** A small spring updates the surface itself, without rendering React every frame. */
function useSurfaceSpring() {
  const ref = useRef<HTMLButtonElement>(null)
  const target = useRef({ x: 0, y: 0, press: 0 })
  const reduced = useRef(false)
  const frame = useRef(0)
  const value = useRef({ x: 0, y: 0, press: 0, vx: 0, vy: 0, vp: 0 })

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reduced.current = media.matches
      if (media.matches) {
        cancelAnimationFrame(frame.current)
        frame.current = 0
        target.current = { x: 0, y: 0, press: 0 }
        value.current = { x: 0, y: 0, press: 0, vx: 0, vy: 0, vp: 0 }
        ref.current?.style.setProperty('--surface-x', '0deg')
        ref.current?.style.setProperty('--surface-y', '0deg')
        ref.current?.style.setProperty('--surface-press', '0')
      }
    }
    sync()
    media.addEventListener('change', sync)
    return () => {
      media.removeEventListener('change', sync)
      cancelAnimationFrame(frame.current)
    }
  }, [])

  const animate = () => {
    if (reduced.current || frame.current) return
    let previous = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - previous) / 1000, .032)
      previous = now
      const v = value.current
      const t = target.current
      v.vx += ((t.x - v.x) * 180 - v.vx * 24) * dt
      v.vy += ((t.y - v.y) * 180 - v.vy * 24) * dt
      v.vp += ((t.press - v.press) * 240 - v.vp * 26) * dt
      v.x += v.vx * dt
      v.y += v.vy * dt
      v.press += v.vp * dt
      const el = ref.current
      if (!el) { frame.current = 0; return }
      el.style.setProperty('--surface-x', `${v.x.toFixed(3)}deg`)
      el.style.setProperty('--surface-y', `${v.y.toFixed(3)}deg`)
      el.style.setProperty('--surface-press', `${v.press.toFixed(3)}`)
      if (Math.abs(t.x - v.x) + Math.abs(t.y - v.y) + Math.abs(t.press - v.press) + Math.abs(v.vx) + Math.abs(v.vy) + Math.abs(v.vp) < .015) {
        frame.current = 0
        return
      }
      frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }
  const reset = () => { target.current = { x: 0, y: 0, press: 0 }; animate() }
  return {
    ref,
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== 'mouse' || reduced.current) return
      const bounds = event.currentTarget.getBoundingClientRect()
      target.current.x = -(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 5
      target.current.y = (event.clientX - bounds.left - bounds.width / 2) / bounds.width * 6
      animate()
    },
    onPointerDown: () => { target.current.press = 1; animate() },
    onPointerUp: () => { target.current.press = 0; animate() },
    onPointerLeave: reset,
    onPointerCancel: reset,
    onBlur: reset,
  }
}

function LessonPlaque({ item, index }: { item: LearningPathItem; index: number }) {
  const surface = useSurfaceSpring()
  return (
    <button
      {...surface}
      type="button"
      className={`atlas-plaque atlas-plaque-${item.state}`}
      data-path-item={item.id}
      data-state={item.state === 'current' ? 'on' : item.state === 'locked' ? 'lock' : 'done'}
      disabled={!item.playable}
      aria-current={item.state === 'current' ? 'step' : undefined}
      aria-label={`${item.label}: ${item.title}, ${item.state === 'current' ? 'continue learning' : item.state === 'done' ? 'completed, revisit' : 'locked'}`}
      onPointerDown={() => {
        surface.onPointerDown()
        if (item.playable) unlockSpeech()
      }}
      onClick={() => { if (item.playable) item.onSelect() }}
    >
      <span className="atlas-plaque-edge" aria-hidden />
      <span className="atlas-plaque-face">
        <span className="atlas-plaque-topline">
          <span className="atlas-step-label">{item.label}</span>
          <span className="atlas-step-seal" aria-hidden>
            {item.state === 'done' ? <CheckIcon size={15} /> : item.state === 'locked' ? <LockIcon size={13} /> : String(index + 1).padStart(2, '0')}
          </span>
        </span>
        <span className="atlas-step-title">{item.title}</span>
        {item.subtitle && item.subtitle.trim() !== item.title.trim() && <span className="atlas-step-subtitle">{item.subtitle}</span>}
        {item.state === 'current' && <span className="atlas-continue">Continue <span aria-hidden>→</span></span>}
      </span>
    </button>
  )
}

type Route = { width: number; height: number; segments: string[]; lead: string }

export function LearningPath({ kicker, title, subtitle, source, items, open = true, onOpen, fill }: LearningPathProps) {
  const track = useRef<HTMLOListElement>(null)
  const [route, setRoute] = useState<Route>({ width: 1, height: 1, segments: [], lead: '' })
  const currentIndex = items.findIndex(item => item.state === 'current')
  const done = items.filter(item => item.state === 'done').length

  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () => {
      const bounds = el.getBoundingClientRect()
      const plaques = Array.from(el.querySelectorAll<HTMLButtonElement>('.atlas-plaque'))
      const points = plaques.map(plaque => {
        // Offset geometry stays stable while the raised surface tilts under the pointer.
        const row = plaque.parentElement!
        return { x: plaque.offsetLeft + plaque.offsetWidth / 2, y: row.offsetTop + plaque.offsetTop + plaque.offsetHeight / 2 }
      })
      const segments = points.slice(1).map((point, i) => {
        const start = points[i]
        const middle = (start.y + point.y) / 2
        return `M${start.x} ${start.y} C${start.x} ${middle} ${point.x} ${middle} ${point.x} ${point.y}`
      })
      const first = points[0]
      const lead = first ? `M${first.x} 0 L${first.x} ${first.y}` : ''
      setRoute({ width: bounds.width || 1, height: el.offsetHeight || 1, segments, lead })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const plaque of el.querySelectorAll('.atlas-plaque')) observer.observe(plaque)
    return () => observer.disconnect()
  }, [items.map(item => `${item.id}:${item.state}:${item.title}:${item.subtitle}`).join('|')])

  const heading = <>
    <span className="atlas-header-copy">
      {kicker && <span className="atlas-kicker">{kicker}</span>}
      <h2 className="atlas-title">{title}</h2>
      {subtitle && subtitle !== title && <span className="atlas-subtitle">{subtitle}</span>}
      {source && <span className="atlas-source">{source}</span>}
    </span>
    <span className="atlas-book-spine" aria-hidden><span>学</span></span>
  </>

  return (
    <section className={`learning-atlas${fill ? ' learning-atlas-home' : ''}${open ? '' : ' learning-atlas-locked'}`}>
      {onOpen ? <button className="atlas-header" type="button" disabled={!open} onClick={onOpen}>{heading}<span className="atlas-open">Read lesson <span aria-hidden>↗</span></span></button> : <div className="atlas-header">{heading}</div>}
      <div className="atlas-progress" aria-label={`${done} of ${items.length} steps completed`}>
        <span>{currentIndex >= 0 ? 'Your next step' : done === items.length && items.length ? 'Ready to revisit' : 'Learning path'}</span>
        <span className="atlas-progress-marks" aria-hidden>{items.map(item => <i key={item.id} data-state={item.state} />)}</span>
        <span className="atlas-progress-count">{done}<span> / {items.length}</span></span>
      </div>
      <ol className="atlas-track" ref={track}>
        <svg className="atlas-route" viewBox={`0 0 ${route.width} ${route.height}`} preserveAspectRatio="none" aria-hidden>
          {[route.lead, ...route.segments].map((d, index) => <path key={`shadow-${index}`} className="atlas-route-shadow" d={d} />)}
          {[route.lead, ...route.segments].map((d, index) => <path key={`rail-${index}`} className={`atlas-route-rail${index <= currentIndex || (index > 0 && items[index - 1]?.state === 'done') ? ' atlas-route-travelled' : ''}`} d={d} />)}
          {currentIndex >= 0 && <path className="atlas-route-cue" d={currentIndex === 0 ? route.lead : route.segments[currentIndex - 1]} />}
        </svg>
        {items.map((item, index) => <li key={item.id} className={`atlas-stop atlas-stop-${index % 2 === 0 ? 'left' : 'right'}`}><LessonPlaque item={item} index={index} /></li>)}
      </ol>
    </section>
  )
}
