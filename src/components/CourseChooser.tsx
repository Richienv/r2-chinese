import { type ReactNode } from 'react'
import { useCoupleProfile } from '../lib/coupleProfile'
import { COURSE_META, COURSE_ORDER, useCourse, type CourseId } from '../lib/course'
import { LANGUAGES, getLang, setLang, t } from '../lib/i18n'
import '../styles/course-gate.css'

export function CourseGate({ corner }: { corner?: ReactNode }) {
  const { setCourse } = useCourse()
  const { member } = useCoupleProfile()
  const orderedCourses: readonly CourseId[] =
    member.track === 'hsk1' ? ['hsk1', 'hsk4a', 'jiaocheng', 'kerja'] : COURSE_ORDER
  return (
    <div className="course-gate minimal-library">
      <div className="minimal-library-top">
        <span lang="zh-CN">语路</span>
        {corner}
      </div>
      <header>
        <p>{t('A little Mandarin, every day')}</p>
        <h1>{t('Your Mandarin library')}</h1>
        <p>{t('Choose a course. Continue at your own pace.')}</p>
      </header>
      <div className="minimal-course-list" role="group" aria-label={t('Courses')}>
        {orderedCourses.map((id, index) => (
          <button
            key={id}
            className="minimal-course"
            onClick={() => setCourse(id)}
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
    <div role="group" aria-label={t('Language')} className="language-chip">
      {LANGUAGES.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          lang={id}
          title={name}
          aria-label={`${id.toUpperCase()} · ${name}`}
          aria-pressed={id === current}
          onClick={() => setLang(id)}
          className="language-chip-option"
        >
          {id.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
