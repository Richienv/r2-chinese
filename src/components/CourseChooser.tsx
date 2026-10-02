import { useEffect, useRef, type PointerEvent } from 'react'
import { COURSE_META, COURSE_ORDER, useCourse, type CourseId } from '../lib/course'
import '../styles/course-gate.css'

const COURSE_BOOKS: Record<CourseId, { mark: string; spine: string; subtitle: string; topic: string }> = {
  hsk4a: { mark: '4', spine: 'HSK', subtitle: '标准教程 · 上册', topic: 'Mandarin' },
  kerja: { mark: '言', spine: 'WORK', subtitle: 'Mandarin for HR & management', topic: 'Workplace' },
  jiaocheng: { mark: '二', spine: '教程', subtitle: '汉语教程 · 第二册上、下', topic: 'Mandarin' },
  magang: { mark: 'AI', spine: '实习', subtitle: 'AI internship preparation', topic: 'Careers' },
  interview: { mark: '总', spine: 'OFFICE', subtitle: 'Interview preparation', topic: 'Practice' },
  books: { mark: '读', spine: 'BOOKS', subtitle: 'Five books · practical ideas', topic: 'Reading' },
}

function CourseBook({ id, onSelect }: { id: CourseId; onSelect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const frame = useRef(0)
  const reduced = useRef(false)
  const target = useRef({ tilt: 0, lift: 0, press: 0 })
  const current = useRef({ tilt: 0, lift: 0, press: 0, vt: 0, vl: 0, vp: 0 })
  const meta = COURSE_META[id]
  const book = COURSE_BOOKS[id]

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reduced.current = media.matches
      if (media.matches) {
        cancelAnimationFrame(frame.current)
        frame.current = 0
        target.current = { tilt: 0, lift: 0, press: 0 }
        current.current = { tilt: 0, lift: 0, press: 0, vt: 0, vl: 0, vp: 0 }
        for (const variable of ['--book-tilt', '--book-lift', '--book-press']) ref.current?.style.removeProperty(variable)
      }
    }
    sync()
    media.addEventListener('change', sync)
    return () => { cancelAnimationFrame(frame.current); media.removeEventListener('change', sync) }
  }, [])

  const spring = () => {
    if (frame.current || reduced.current) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, .032)
      last = now
      const value = current.current
      const goal = target.current
      value.vt += ((goal.tilt - value.tilt) * 190 - value.vt * 23) * dt
      value.vl += ((goal.lift - value.lift) * 190 - value.vl * 23) * dt
      value.vp += ((goal.press - value.press) * 250 - value.vp * 27) * dt
      value.tilt += value.vt * dt
      value.lift += value.vl * dt
      value.press += value.vp * dt
      const el = ref.current
      if (!el) { frame.current = 0; return }
      el.style.setProperty('--book-tilt', `${value.tilt.toFixed(3)}deg`)
      el.style.setProperty('--book-lift', `${value.lift.toFixed(3)}px`)
      el.style.setProperty('--book-press', value.press.toFixed(3))
      if (Math.abs(goal.tilt - value.tilt) + Math.abs(goal.lift - value.lift) + Math.abs(goal.press - value.press) + Math.abs(value.vt) + Math.abs(value.vl) + Math.abs(value.vp) < .025) { frame.current = 0; return }
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }
  const reset = () => { target.current = { tilt: 0, lift: 0, press: 0 }; spring() }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    target.current.tilt = (event.clientX - bounds.left - bounds.width / 2) / bounds.width * 12
    target.current.lift = -3
    spring()
  }

  return (
    <button
      type="button"
      className="course-gate-card library-course"
      data-course={id}
      ref={ref}
      onClick={onSelect}
      onPointerMove={move}
      onPointerDown={() => { target.current.press = 1; spring() }}
      onPointerUp={() => { target.current.press = 0; spring() }}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onBlur={reset}
      aria-label={`Open ${meta.title}. ${book.subtitle}`}
    >
      <span className="library-book-stage" aria-hidden>
        <span className="library-book-shadow" />
        <span className="library-book">
          <span className="library-book-pages" />
          <span className="library-book-cover"><span className="library-book-spine">{book.spine}</span><span className="library-book-mark">{book.mark}</span><span className="library-book-line" /></span>
        </span>
        <span className="library-topic">{book.topic}</span>
      </span>
      <span className="library-course-copy">
        <span className="course-gate-name" lang={/[\u3400-\u9fff]/.test(meta.title) ? 'zh-CN' : undefined}>{meta.title}</span>
        <span className="course-gate-blurb" lang={/[\u3400-\u9fff]/.test(book.subtitle) ? 'zh-CN' : undefined}>{book.subtitle}</span>
      </span>
      <span className="library-course-open" aria-hidden>↗</span>
    </button>
  )
}

/** Real course selection, presented as a small library rather than six primary actions. */
export function CourseGate() {
  const { setCourse } = useCourse()
  const library = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches) return
    const animations = Array.from(library.current?.querySelectorAll<HTMLElement>('[data-course]') ?? []).map((card, index) => card.animate(
      [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 360, delay: index * 45, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' },
    ))
    const stop = () => { if (media.matches) for (const animation of animations) animation.cancel() }
    media.addEventListener('change', stop)
    return () => { media.removeEventListener('change', stop); for (const animation of animations) animation.cancel() }
  }, [])

  return (
    <div className="course-gate course-library" ref={library}>
      <div className="library-heading"><span className="library-eyebrow">Your library</span><h1 className="course-gate-title">What will you learn?</h1><p>Choose a course. Pick up where you left off.</p></div>
      <div className="course-gate-list" role="group" aria-label="Courses">
        {COURSE_ORDER.map(id => <div className="library-slot" key={id}><CourseBook id={id} onSelect={() => setCourse(id)} /></div>)}
      </div>
    </div>
  )
}

export function CourseBack() {
  const { leaveCourse } = useCourse()
  return <button type="button" className="course-back library-back tap44" onClick={leaveCourse}><span aria-hidden>←</span> Courses</button>
}
