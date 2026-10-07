import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { COURSE_META, COURSE_ORDER, useCourse, type CourseId } from '../lib/course'
import { LANGUAGES, getLang, setLang, t } from '../lib/i18n'
import '../styles/course-gate.css'

const COURSE_BOOKS: Record<CourseId, { mark: string; spine: string; subtitle: string; topic: string }> = {
  hsk4a: { mark: '4', spine: 'HSK', subtitle: '标准教程 · 上册', topic: t('Mandarin') },
  kerja: { mark: '言', spine: t('WORK'), subtitle: t('Mandarin for HR & management'), topic: t('Workplace') },
  jiaocheng: { mark: '二', spine: '教程', subtitle: '汉语教程 · 第二册上、下', topic: t('Mandarin') },
  magang: { mark: 'AI', spine: '实习', subtitle: t('AI internship preparation'), topic: t('Careers') },
  interview: { mark: '总', spine: t('OFFICE'), subtitle: t('Interview preparation'), topic: t('Practice') },
  books: { mark: '读', spine: t('BOOKS'), subtitle: t('Five books · practical ideas'), topic: t('Reading') },
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
      aria-label={t('Open {title}. {subtitle}', { title: meta.title, subtitle: book.subtitle })}
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

/**
 * Real course selection, presented as a small library rather than six primary actions.
 * `corner` is an optional small control (the language chip) tucked above the heading.
 */
export function CourseGate({ corner }: { corner?: ReactNode }) {
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
      <div className="library-heading" style={corner ? { position: 'relative' } : undefined}>
        {corner && <div style={{ position: 'absolute', top: -26, right: 0 }}>{corner}</div>}
        <span className="library-eyebrow">{t('Your library')}</span><h1 className="course-gate-title">{t('What will you learn?')}</h1><p>{t('Choose a course. Pick up where you left off.')}</p>
      </div>
      <div className="course-gate-list" role="group" aria-label={t('Courses')}>
        {COURSE_ORDER.map(id => <div className="library-slot" key={id}><CourseBook id={id} onSelect={() => setCourse(id)} /></div>)}
      </div>
    </div>
  )
}

export function CourseBack() {
  const { leaveCourse } = useCourse()
  return <button type="button" className="course-back library-back tap44" onClick={leaveCourse}><span aria-hidden>←</span> {t('Courses')}</button>
}

/**
 * Two-letter language switch ("EN" / "ID"), small enough for a corner and one tap from the first screen.
 * The option names come straight from LANGUAGES (each in its own language, never through t()).
 * Choosing the other language reloads the page, see setLang().
 */
export function LanguageChip() {
  const current = getLang()
  return (
    <div role="group" aria-label={t('Language')} style={chipStyle}>
      {LANGUAGES.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          lang={id}
          title={name}
          aria-label={`${id.toUpperCase()} · ${name}`}
          aria-pressed={id === current}
          onClick={() => setLang(id)}
          style={id === current ? { ...chipSegment, ...chipSegmentOn } : chipSegment}
        >
          {id.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 2,
  padding: 2,
  border: '1px solid #e4d8c7',
  borderRadius: 999,
  background: 'rgba(255, 251, 244, .88)',
}

const chipSegment: CSSProperties = {
  minWidth: 32,
  height: 22,
  padding: '0 8px',
  border: 0,
  borderRadius: 999,
  background: 'transparent',
  color: '#8d6b52',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.06em',
  lineHeight: 1,
  transition: 'background-color .15s, color .15s',
}

const chipSegmentOn: CSSProperties = {
  background: '#f0dcc6',
  color: '#7d3320',
  fontWeight: 800,
  boxShadow: 'inset 0 0 0 1px #e1c4a5',
}
