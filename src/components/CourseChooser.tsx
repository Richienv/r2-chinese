import { type CSSProperties, type ReactNode } from 'react'
import { COURSE_META, COURSE_ORDER, useCourse } from '../lib/course'
import { LANGUAGES, getLang, setLang, t } from '../lib/i18n'
import '../styles/course-gate.css'

export function CourseGate({ corner }: { corner?: ReactNode }) {
  const { setCourse } = useCourse()
  return (
    <div className="course-gate minimal-library">
      <div className="minimal-library-top">
        <span lang="zh-CN">语路</span>
        {corner}
      </div>
      <header>
        <p>{t('A little Mandarin, every day')}</p>
        <h1>{t('Make room for remembering.')}</h1>
        <p>{t('Three paths. Pick up where you left off.')}</p>
      </header>
      <div className="minimal-course-list" role="group" aria-label={t('Courses')}>
        {COURSE_ORDER.map((id, index) => (
          <button
            key={id}
            className="minimal-course"
            onClick={() => setCourse(id)}
            style={{ animationDelay: index * 45 + 'ms' }}
            aria-label={t('Open {title}', { title: COURSE_META[id].title })}
          >
            <span className="minimal-course-index">0{index + 1}</span>
            <span className="minimal-course-copy">
              <strong>{COURSE_META[id].title}</strong>
              <small>{COURSE_META[id].blurb}</small>
            </span>
            <span aria-hidden>↗</span>
          </button>
        ))}
      </div>
      <button className="minimal-reading" onClick={() => setCourse('books')}>
        {t('Reading shelf')}
        <span aria-hidden>→</span>
      </button>
    </div>
  )
}

export function CourseBack() {
  const { leaveCourse } = useCourse()
  return (
    <button type="button" className="course-back library-back tap44" onClick={leaveCourse}>
      <span aria-hidden>←</span> {t('Courses')}
    </button>
  )
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
  border: '1px solid #ceded9',
  borderRadius: 999,
  background: 'rgba(248,252,248,.88)',
}

const chipSegment: CSSProperties = {
  minWidth: 32,
  height: 22,
  padding: '0 8px',
  border: 0,
  borderRadius: 999,
  background: 'transparent',
  color: '#607b73',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.06em',
  lineHeight: 1,
  transition: 'background-color .15s, color .15s',
}

const chipSegmentOn: CSSProperties = {
  background: '#d9e9df',
  color: '#255b49',
  fontWeight: 800,
  boxShadow: 'inset 0 0 0 1px #b7d5c6',
}
