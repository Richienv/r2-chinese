import { useMemo, useState } from 'react'
import { MasteryTracker } from '../components/MasteryTracker'
import { getLesson, lessons } from '../lib/content'
import { COURSE_META } from '../lib/course'
import { readHistory, type HistoryCourse, type HistoryEvent } from '../lib/history'
import { getLang, t } from '../lib/i18n'
import { dueCards } from '../lib/srs'
import { getJiaochengLesson, jiaochengLessons, nodesForLesson } from '../lib/jiaocheng'
import { getKerjaChapter, kerjaChapters, nodesForChapter } from '../lib/kerja'
import {
  getInterviewChapter,
  interviewChapters,
  nodesForChapter as interviewNodesForChapter,
} from '../lib/interview'
import { getMagangChapter, magangChapters, nodesForChapter as magangNodesForChapter } from '../lib/magang'
import {
  BOOKS_PROGRESS_KEY,
  booksChapters,
  booksProgressKey,
  getBooksChapterByLesson,
  nodesForChapter as booksNodesForChapter,
} from '../lib/books'
import { PATH_NODES } from '../lib/wordsSession'
import { DAILY_GOAL, dayKey, useStore } from '../store/store'
import '../styles/progress.css'

const KERJA_KEY = 'yulu.kerja.v1'
const JIAOCHENG_KEY = 'yulu.jiaocheng.v1'
const MAGANG_KEY = 'yulu.magang.v1'
const INTERVIEW_KEY = 'yulu.interview.v1'
const BOOKS_KEY = BOOKS_PROGRESS_KEY

/** Weekday and clock text follow the app language, not the browser's. */
const DATE_LOCALE = getLang() === 'id' ? 'id-ID' : undefined
const lessonFallback = (n: number) => t('Lesson {n}', { n })
const chapterFallback = (n: number) => t('Chapter {n}', { n })

type PathDoneMap = Record<string, string[]>

type CourseUnit = {
  key: string
  title: string
  done: boolean
  sittingsDone: number
  sittingsTotal: number
}

type CourseRow = {
  name: string
  stepsDone: number
  stepsTotal: number
  units: CourseUnit[]
}

/** Read pathDone from a localStorage JSON blob — never writes. */
function readPathDone(key: string): PathDoneMap {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { pathDone?: unknown }
    if (!parsed?.pathDone || typeof parsed.pathDone !== 'object' || Array.isArray(parsed.pathDone)) {
      return {}
    }
    const out: PathDoneMap = {}
    for (const [k, v] of Object.entries(parsed.pathDone as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue
      out[k] = v.filter((n): n is string => typeof n === 'string')
    }
    return out
  } catch {
    return {}
  }
}

function countDone(nodes: string[], done: string[]): number {
  const set = new Set(done)
  return nodes.filter((n) => set.has(n)).length
}

function hskCourse(pathDone: PathDoneMap, lessonsDone: number[]): CourseRow {
  let done = 0
  let total = 0
  const units = lessons.map((l) => {
    const nodes = PATH_NODES as string[]
    const finished = pathDone[String(l.lesson)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = (() => {
      try {
        const full = getLesson(l.lesson)
        return full.title.en || full.title.zh || lessonFallback(l.lesson)
      } catch {
        return lessonFallback(l.lesson)
      }
    })()
    const sittingsDone = countDone(nodes, finished)
    const isDone = lessonsDone.includes(l.lesson) || finished.includes('wrap') || sittingsDone >= nodes.length
    return { key: `hsk-${l.lesson}`, title, done: isDone, sittingsDone, sittingsTotal: nodes.length }
  })
  return { name: COURSE_META.hsk4a.title, stepsDone: done, stepsTotal: total, units }
}

function kerjaCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = kerjaChapters.map((ch) => {
    const nodes = nodesForChapter(ch) as string[]
    const finished = pathDone[String(ch.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = ch.titleEn || ch.titleZh || chapterFallback(ch.index)
    const sittingsDone = countDone(nodes, finished)
    const isDone = finished.includes('wrap') || (nodes.length > 0 && sittingsDone >= nodes.length)
    return {
      key: `kerja-${ch.index}`,
      title,
      done: isDone,
      sittingsDone,
      sittingsTotal: nodes.length,
    }
  })
  return { name: COURSE_META.kerja.title, stepsDone: done, stepsTotal: total, units }
}

function jiaochengCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = jiaochengLessons.map((lesson) => {
    const nodes = nodesForLesson(lesson) as string[]
    const finished = pathDone[String(lesson.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = lesson.titleEn || lesson.titleZh || lessonFallback(lesson.index)
    const sittingsDone = countDone(nodes, finished)
    const isDone = finished.includes('wrap') || (nodes.length > 0 && sittingsDone >= nodes.length)
    return {
      key: `jc-${lesson.index}`,
      title,
      done: isDone,
      sittingsDone,
      sittingsTotal: nodes.length,
    }
  })
  return { name: COURSE_META.jiaocheng.title, stepsDone: done, stepsTotal: total, units }
}

function magangCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = magangChapters.map((ch) => {
    const nodes = magangNodesForChapter(ch)
    const finished = pathDone[String(ch.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = ch.titleEn || ch.titleSource || chapterFallback(ch.index)
    const sittingsDone = countDone(nodes, finished)
    const isDone = finished.includes('wrap') || (nodes.length > 0 && sittingsDone >= nodes.length)
    return {
      key: `magang-${ch.index}`,
      title,
      done: isDone,
      sittingsDone,
      sittingsTotal: nodes.length,
    }
  })
  return { name: COURSE_META.magang.title, stepsDone: done, stepsTotal: total, units }
}

function interviewCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = interviewChapters.map((ch) => {
    const nodes = interviewNodesForChapter(ch)
    const finished = pathDone[String(ch.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = ch.titleEn || ch.titleSource || chapterFallback(ch.index)
    const sittingsDone = countDone(nodes, finished)
    const isDone = nodes.length > 0 && sittingsDone >= nodes.length
    return {
      key: `interview-${ch.index}`,
      title,
      done: isDone,
      sittingsDone,
      sittingsTotal: nodes.length,
    }
  })
  return { name: COURSE_META.interview.title, stepsDone: done, stepsTotal: total, units }
}

function booksCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = booksChapters.map((ch) => {
    const nodes = booksNodesForChapter(ch)
    const finished = pathDone[booksProgressKey(ch.part, ch.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = ch.titleEn || ch.partTitleEn || chapterFallback(ch.index)
    const sittingsDone = countDone(nodes, finished)
    const isDone = nodes.length > 0 && sittingsDone >= nodes.length
    return {
      key: `books-${ch.part}-${ch.index}`,
      title,
      done: isDone,
      sittingsDone,
      sittingsTotal: nodes.length,
    }
  })
  return { name: COURSE_META.books.title, stepsDone: done, stepsTotal: total, units }
}

/** Rolling last-7-days card counts, oldest → newest, labelled by weekday. */
function weekActivity(log: Record<string, { cards: number }>) {
  const out: { label: string; cards: number; today: boolean; date: number }[] = []
  const now = new Date()
  const todayKey = dayKey(now)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = dayKey(d)
    out.push({
      label: d.toLocaleDateString(DATE_LOCALE, { weekday: 'short' }),
      cards: log[key]?.cards ?? 0,
      today: key === todayKey,
      date: d.getDate(),
    })
  }
  return out
}

const COURSE_LABEL: Record<HistoryCourse, string> = {
  hsk4a: COURSE_META.hsk4a.title,
  kerja: COURSE_META.kerja.title,
  jiaocheng: COURSE_META.jiaocheng.title,
  magang: COURSE_META.magang.title,
  interview: COURSE_META.interview.title,
  books: COURSE_META.books.title,
}

function historyHeadline(ev: HistoryEvent): string {
  if (ev.kind === 'drill') return ev.title?.trim() || t('Drill')
  if (ev.kind === 'quiz') return ev.title?.trim() || (ev.correct === true ? t('Recall correct') : ev.correct === false ? t('Recall needs practice') : t('Practice · ungraded'))
  // node
  if (ev.title?.trim()) return ev.title.trim()
  if (ev.node) return t('{node} finished', { node: ev.node })
  return t('Node finished')
}

function historyDetail(ev: HistoryEvent): string {
  const course = COURSE_LABEL[ev.course]
  if (ev.kind === 'drill') {
    const xp = typeof ev.xp === 'number' ? ` · ${ev.xp} XP` : ''
    return `${course}${xp}`
  }
  const unit =
    ev.course === 'kerja'
      ? (() => {
          const ch = getKerjaChapter(ev.lesson)
          return ch?.titleEn || ch?.titleZh || chapterFallback(ev.lesson)
        })()
      : ev.course === 'jiaocheng'
        ? (() => {
            const l = getJiaochengLesson(ev.lesson)
            return l?.titleEn || l?.titleZh || lessonFallback(ev.lesson)
          })()
        : ev.course === 'magang'
          ? (() => {
              const ch = getMagangChapter(ev.lesson)
              return ch?.titleEn || ch?.titleSource || chapterFallback(ev.lesson)
            })()
          : ev.course === 'interview'
            ? (() => {
                const ch = getInterviewChapter(ev.lesson)
                return ch?.titleEn || ch?.titleSource || chapterFallback(ev.lesson)
              })()
            : ev.course === 'books'
              ? (() => {
                  const ch = getBooksChapterByLesson(ev.lesson)
                  return ch?.titleEn || chapterFallback(ev.lesson)
                })()
              : (() => {
                try {
                  const l = getLesson(ev.lesson)
                  return l.title.en || l.title.zh || lessonFallback(ev.lesson)
                } catch {
                  return lessonFallback(ev.lesson)
                }
              })()
  const nodeBit = ev.node ? ` · ${ev.node}` : ''
  return `${course} · ${unit}${nodeBit}`
}

function formatWhen(when: number): string {
  const d = new Date(when)
  const now = new Date()
  const sameDay = dayKey(d) === dayKey(now)
  const time = d.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return time
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(d) === dayKey(yesterday)) return t('Yesterday {time}', { time })
  return d.toLocaleDateString(DATE_LOCALE, { month: 'short', day: 'numeric' })
}

export function Progress({
  onReview,
  onLearn,
}: {
  onReview: (words?: string[], title?: string) => void
  onLearn: () => void
}) {
  const s = useStore()
  const [showHistory, setShowHistory] = useState(false)
  const week = weekActivity(s.log)
  const due = dueCards(s.cardList)
  const hardWords = Object.values(s.mastery)
    .filter((record) => record.state === 'hard')
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((record) => record.zh)
  const weekCards = week.reduce((sum, day) => sum + day.cards, 0)
  const activeDays = week.filter((day) => day.cards > 0).length
  const todayProgress = Math.min(100, Math.round((s.today.cards / DAILY_GOAL) * 100))

  const courses = useMemo(() => {
    const kerjaDone = readPathDone(KERJA_KEY)
    const jiaochengDone = readPathDone(JIAOCHENG_KEY)
    const magangDone = readPathDone(MAGANG_KEY)
    const interviewDone = readPathDone(INTERVIEW_KEY)
    const booksDone = readPathDone(BOOKS_KEY)
    return [
      hskCourse(s.pathDone as PathDoneMap, s.lessonsDone),
      kerjaCourse(kerjaDone),
      jiaochengCourse(jiaochengDone),
      magangCourse(magangDone),
      interviewCourse(interviewDone),
      booksCourse(booksDone),
    ]
  }, [s.pathDone, s.lessonsDone])

  const history = useMemo(() => readHistory(), [s.pathDone, s.log, s.xp, s.cards])
  const visibleHistory = showHistory ? history : history.slice(0, 5)

  function startReview() {
    if (due.length) onReview()
    else if (hardWords.length) onReview(hardWords.slice(0, 8), t('Strengthen hard words'))
    else onReview()
  }

  const reviewLabel = due.length
    ? t('Review due words')
    : hardWords.length
      ? t('Practice hard words')
      : t('Practice saved words')

  return (
    <div className="stack-page progress-page">
      <header className="progress-header">
        <div>
          <div className="progress-eyebrow">{t('YOUR LEARNING, OVER TIME')}</div>
          <h1 className="h2">{t('Progress')}</h1>
          <div className="sub">{t('Six paths. One growing ability to remember and use what you learn.')}</div>
        </div>
        <button className="progress-header-link" type="button" onClick={onLearn}>
          {t('Learning paths')} <span aria-hidden="true">↗</span>
        </button>
      </header>

      <section className="progress-focus" aria-labelledby="progress-focus-title">
        <div className="progress-focus-copy">
          <span className="progress-focus-kicker">{t('TODAY’S PRACTICE')}</span>
          <h2 id="progress-focus-title">{t('Make recall feel familiar.')}</h2>
          <p>{s.today.cards >= DAILY_GOAL ? t('{n} practice steps today — your daily goal is complete. Come back later to strengthen recall on another day.', { n: s.today.cards }) : t('{n} of {goal} practice steps today. Short attempts, repeated over time, are what make words stick.', { n: s.today.cards, goal: DAILY_GOAL })}</p>
          <button className="btn progress-focus-button" type="button" onClick={s.cardList.length ? startReview : onLearn}>
            {s.cardList.length ? reviewLabel : t('Choose a course')}
            <span aria-hidden="true">→</span>
          </button>
          <span className="progress-focus-note">
            {due.length ? t('{n} ready to revisit', { n: due.length }) : hardWords.length ? t('{n} words are asking for another try', { n: hardWords.length }) : s.cardList.length ? t('Your saved words are ready for a quick recall') : t('Meet a few words and your review trail starts automatically')}
          </span>
        </div>
        <div className="progress-focus-meter" style={{ '--today-progress': `${todayProgress}%` } as React.CSSProperties} aria-label={t('{n} practice steps today', { n: s.today.cards })}>
          <div className="progress-focus-meter-core">
            <strong>{s.today.cards}</strong>
            <span>{s.today.cards >= DAILY_GOAL ? t('goal reached') : t('of {goal} goal', { goal: DAILY_GOAL })}</span>
            <small>{t('recalls')}</small>
          </div>
        </div>
      </section>

      <section className="progress-stats" aria-label={t('Learning totals')}>
        <Glance value={s.streak} label={t('day streak')} detail={t('show up again')} />
        <Glance value={s.xp} label={t('XP earned')} detail={t('practice adds up')} />
        <Glance value={s.wordsLearned} label={t('words met')} detail={t('kept in your trail')} />
      </section>

      <section className="card progress-section progress-week-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">{t('THE LAST 7 DAYS')}</div>
            <h2>{t('Build a learning rhythm')}</h2>
          </div>
          <div className="progress-week-summary"><strong>{activeDays}</strong><span>{t('active days')}</span></div>
        </div>
        <p className="progress-section-sub">{weekCards === 1 ? t('{n} practice step across the week. Returning to a word later is how recognition becomes recall.', { n: weekCards }) : t('{n} practice steps across the week. Returning to a word later is how recognition becomes recall.', { n: weekCards })}</p>
        <div className="progress-week-grid">
          {week.map((d, i) => {
            const height = d.cards ? Math.max(12, Math.min(100, (d.cards / Math.max(DAILY_GOAL, ...week.map((day) => day.cards))) * 100)) : 5
            return (
              <div
                key={`${d.date}-${i}`}
                className="progress-week-day"
                data-today={d.today ? 'true' : 'false'}
                data-on={d.cards > 0 ? 'true' : 'false'}
                title={d.cards === 1 ? t('{n} practice step', { n: d.cards }) : t('{n} practice steps', { n: d.cards })}
              >
                <div className="progress-week-bar-wrap"><i style={{ height: `${height}%` }} /></div>
                <span className="progress-week-cards">{d.cards || '·'}</span>
                <span className="progress-week-label">{d.label}</span>
              </div>
            )
          })}
        </div>
        <div className="progress-week-foot"><span>{t('Practice is evidence of effort; mastery comes from unaided recall on separate days.')}</span></div>
      </section>

      <section className="card progress-section progress-mastery-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">{t('BEYOND FINISHING A LESSON')}</div>
            <h2>{t('What stays with you')}</h2>
          </div>
          <span className="progress-mastery-spark" aria-hidden="true">✳</span>
        </div>
        <p className="progress-section-sub">{t('Mastery means retrieving a word without help on more than one day. A completed lesson is only the beginning.')}</p>
        <MasteryTracker words={s.learningTrail} />
      </section>

      <section className="card progress-section progress-courses-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">{t('YOUR CURRICULUM')}</div>
            <h2>{t('Every path, at a glance')}</h2>
          </div>
          <span className="progress-course-total">{t('{n} paths', { n: courses.length })}</span>
        </div>
        <p className="progress-section-sub">{t('Open a path to see the units and stages you have already completed.')}</p>
        <div className="progress-courses">
          {courses.map((c) => (
            <details key={c.name} className="progress-course">
              <summary>
                <div className="progress-course-summary">
                  <div className="progress-course-head">
                    <span className="progress-course-name">{c.name}</span>
                    <span className="progress-course-count">{t('{done} / {total} units', { done: c.units.filter((u) => u.done).length, total: c.units.length })}</span>
                  </div>
                  <div className="progress-course-bar"><i style={{ width: `${c.stepsTotal ? Math.round((c.stepsDone / c.stepsTotal) * 100) : 0}%` }} /></div>
                  <div className="progress-course-foot">
                    <span>{t('{done} of {total} learning stages', { done: c.stepsDone, total: c.stepsTotal })}</span>
                    <span>{c.stepsTotal ? Math.round((c.stepsDone / c.stepsTotal) * 100) : 0}%</span>
                  </div>
                </div>
                <span className="progress-course-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="progress-lesson-list">
                {c.units.length === 0 ? (
                  <div className="progress-empty">{t('No lessons loaded yet.')}</div>
                ) : (
                  c.units.map((u) => (
                    <div key={u.key} className="progress-lesson" data-done={u.done ? 'true' : 'false'}>
                      <span className="progress-lesson-mark" aria-hidden>
                        {u.done ? '✓' : '○'}
                      </span>
                      <span className="progress-lesson-title">{u.title}</span>
                      <span className="progress-lesson-count">{t('{done}/{total} stages', { done: u.sittingsDone, total: u.sittingsTotal })}</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          ))}
        </div>
        <button className="progress-secondary-action" type="button" onClick={onLearn}>{t('Open learning paths')} <span aria-hidden="true">→</span></button>
      </section>

      <section className="card progress-section">
        <div className="progress-section-heading progress-history-heading">
          <div><div className="progress-eyebrow">{t('SMALL STEPS ADD UP')}</div><h2>{t('Recent activity')}</h2></div>
          {history.length > 0 && <span className="progress-course-total">{t('{n} entries', { n: history.length })}</span>}
        </div>
        {history.length === 0 ? (
          <p className="progress-empty">{t('Your lessons, drills, and recall attempts will build a timeline here.')}</p>
        ) : (
          <div className="progress-history">
            {visibleHistory.map((ev, i) => (
              <div key={`${ev.t}-${ev.course}-${ev.kind}-${ev.lesson}-${ev.node ?? ''}-${i}`} className="progress-history-item">
                <div className="progress-history-main">{historyHeadline(ev)}</div>
                <div className="progress-history-time">{formatWhen(ev.t)}</div>
                <div className="progress-history-meta">{historyDetail(ev)}</div>
              </div>
            ))}
          </div>
        )}
        {history.length > 5 && (
          <button className="progress-secondary-action" type="button" onClick={() => setShowHistory((value) => !value)}>
            {showHistory ? t('Show recent only') : t('See all {n} moments', { n: history.length })} <span aria-hidden="true">{showHistory ? '↑' : '→'}</span>
          </button>
        )}
      </section>
    </div>
  )
}

function Glance({ value, label, detail }: { value: number; label: string; detail: string }) {
  return (
    <div className="progress-glance-cell">
      <div className="progress-glance-value">{value.toLocaleString()}</div>
      <div className="progress-glance-label">{label}</div>
      <div className="progress-glance-detail">{detail}</div>
    </div>
  )
}
