import { useMemo, useState } from 'react'
import { MasteryTracker } from '../components/MasteryTracker'
import { getLesson, lessons } from '../lib/content'
import { readHistory, type HistoryCourse, type HistoryEvent } from '../lib/history'
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
        return full.title.en || full.title.zh || `Lesson ${l.lesson}`
      } catch {
        return `Lesson ${l.lesson}`
      }
    })()
    const sittingsDone = countDone(nodes, finished)
    const isDone = lessonsDone.includes(l.lesson) || finished.includes('wrap') || sittingsDone >= nodes.length
    return { key: `hsk-${l.lesson}`, title, done: isDone, sittingsDone, sittingsTotal: nodes.length }
  })
  return { name: 'HSK 4', stepsDone: done, stepsTotal: total, units }
}

function kerjaCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = kerjaChapters.map((ch) => {
    const nodes = nodesForChapter(ch) as string[]
    const finished = pathDone[String(ch.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = ch.titleEn || ch.titleZh || `Chapter ${ch.index}`
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
  return { name: '1000 words', stepsDone: done, stepsTotal: total, units }
}

function jiaochengCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = jiaochengLessons.map((lesson) => {
    const nodes = nodesForLesson(lesson) as string[]
    const finished = pathDone[String(lesson.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = lesson.titleEn || lesson.titleZh || `Lesson ${lesson.index}`
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
  return { name: 'Jiaocheng 2', stepsDone: done, stepsTotal: total, units }
}

function magangCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = magangChapters.map((ch) => {
    const nodes = magangNodesForChapter(ch)
    const finished = pathDone[String(ch.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = ch.titleEn || ch.titleSource || `Chapter ${ch.index}`
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
  return { name: 'Magang AI', stepsDone: done, stepsTotal: total, units }
}

function interviewCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = interviewChapters.map((ch) => {
    const nodes = interviewNodesForChapter(ch)
    const finished = pathDone[String(ch.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = ch.titleEn || ch.titleSource || `Chapter ${ch.index}`
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
  return { name: '总办', stepsDone: done, stepsTotal: total, units }
}

function booksCourse(pathDone: PathDoneMap): CourseRow {
  let done = 0
  let total = 0
  const units = booksChapters.map((ch) => {
    const nodes = booksNodesForChapter(ch)
    const finished = pathDone[booksProgressKey(ch.part, ch.index)] ?? []
    total += nodes.length
    done += countDone(nodes, finished)
    const title = ch.titleEn || ch.partTitleEn || `Chapter ${ch.index}`
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
  return { name: 'Books', stepsDone: done, stepsTotal: total, units }
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
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      cards: log[key]?.cards ?? 0,
      today: key === todayKey,
      date: d.getDate(),
    })
  }
  return out
}

const COURSE_LABEL: Record<HistoryCourse, string> = {
  hsk4a: 'HSK 4',
  kerja: '1000 words',
  jiaocheng: 'Jiaocheng 2',
  magang: 'Magang AI',
  interview: '总办',
  books: 'Books',
}

function historyHeadline(ev: HistoryEvent): string {
  if (ev.kind === 'drill') return ev.title?.trim() || 'Drill'
  if (ev.kind === 'quiz') return ev.title?.trim() || (ev.correct === true ? 'Recall correct' : ev.correct === false ? 'Recall needs practice' : 'Practice · ungraded')
  // node
  if (ev.title?.trim()) return ev.title.trim()
  if (ev.node) return `${ev.node} finished`
  return 'Node finished'
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
          return ch?.titleEn || ch?.titleZh || `Chapter ${ev.lesson}`
        })()
      : ev.course === 'jiaocheng'
        ? (() => {
            const l = getJiaochengLesson(ev.lesson)
            return l?.titleEn || l?.titleZh || `Lesson ${ev.lesson}`
          })()
        : ev.course === 'magang'
          ? (() => {
              const ch = getMagangChapter(ev.lesson)
              return ch?.titleEn || ch?.titleSource || `Chapter ${ev.lesson}`
            })()
          : ev.course === 'interview'
            ? (() => {
                const ch = getInterviewChapter(ev.lesson)
                return ch?.titleEn || ch?.titleSource || `Chapter ${ev.lesson}`
              })()
            : ev.course === 'books'
              ? (() => {
                  const ch = getBooksChapterByLesson(ev.lesson)
                  return ch?.titleEn || `Chapter ${ev.lesson}`
                })()
              : (() => {
                try {
                  const l = getLesson(ev.lesson)
                  return l.title.en || l.title.zh || `Lesson ${ev.lesson}`
                } catch {
                  return `Lesson ${ev.lesson}`
                }
              })()
  const nodeBit = ev.node ? ` · ${ev.node}` : ''
  return `${course} · ${unit}${nodeBit}`
}

function formatWhen(t: number): string {
  const d = new Date(t)
  const now = new Date()
  const sameDay = dayKey(d) === dayKey(now)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return time
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(d) === dayKey(yesterday)) return `Yesterday ${time}`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
    else if (hardWords.length) onReview(hardWords.slice(0, 8), 'Strengthen hard words')
    else onReview()
  }

  const reviewLabel = due.length
    ? 'Review due words'
    : hardWords.length
      ? 'Practice hard words'
      : 'Practice saved words'

  return (
    <div className="stack-page progress-page">
      <header className="progress-header">
        <div>
          <div className="progress-eyebrow">YOUR LEARNING, OVER TIME</div>
          <h1 className="h2">Progress</h1>
          <div className="sub">Six paths. One growing ability to remember and use what you learn.</div>
        </div>
        <button className="progress-header-link" type="button" onClick={onLearn}>
          Learning paths <span aria-hidden="true">↗</span>
        </button>
      </header>

      <section className="progress-focus" aria-labelledby="progress-focus-title">
        <div className="progress-focus-copy">
          <span className="progress-focus-kicker">TODAY’S PRACTICE</span>
          <h2 id="progress-focus-title">Make recall feel familiar.</h2>
          <p>{s.today.cards >= DAILY_GOAL ? `${s.today.cards} practice steps today — your daily goal is complete. Come back later to strengthen recall on another day.` : `${s.today.cards} of ${DAILY_GOAL} practice steps today. Short attempts, repeated over time, are what make words stick.`}</p>
          <button className="btn progress-focus-button" type="button" onClick={s.cardList.length ? startReview : onLearn}>
            {s.cardList.length ? reviewLabel : 'Choose a course'}
            <span aria-hidden="true">→</span>
          </button>
          <span className="progress-focus-note">
            {due.length ? `${due.length} ready to revisit` : hardWords.length ? `${hardWords.length} words are asking for another try` : s.cardList.length ? 'Your saved words are ready for a quick recall' : 'Meet a few words and your review trail starts automatically'}
          </span>
        </div>
        <div className="progress-focus-meter" style={{ '--today-progress': `${todayProgress}%` } as React.CSSProperties} aria-label={`${s.today.cards} practice steps today`}>
          <div className="progress-focus-meter-core">
            <strong>{s.today.cards}</strong>
            <span>{s.today.cards >= DAILY_GOAL ? 'goal reached' : `of ${DAILY_GOAL} goal`}</span>
            <small>recalls</small>
          </div>
        </div>
      </section>

      <section className="progress-stats" aria-label="Learning totals">
        <Glance value={s.streak} label="day streak" detail="show up again" />
        <Glance value={s.xp} label="XP earned" detail="practice adds up" />
        <Glance value={s.wordsLearned} label="words met" detail="kept in your trail" />
      </section>

      <section className="card progress-section progress-week-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">THE LAST 7 DAYS</div>
            <h2>Build a learning rhythm</h2>
          </div>
          <div className="progress-week-summary"><strong>{activeDays}</strong><span>active days</span></div>
        </div>
        <p className="progress-section-sub">{weekCards} practice {weekCards === 1 ? 'step' : 'steps'} across the week. Returning to a word later is how recognition becomes recall.</p>
        <div className="progress-week-grid">
          {week.map((d, i) => {
            const height = d.cards ? Math.max(12, Math.min(100, (d.cards / Math.max(DAILY_GOAL, ...week.map((day) => day.cards))) * 100)) : 5
            return (
              <div
                key={`${d.date}-${i}`}
                className="progress-week-day"
                data-today={d.today ? 'true' : 'false'}
                data-on={d.cards > 0 ? 'true' : 'false'}
                title={`${d.cards} practice ${d.cards === 1 ? 'step' : 'steps'}`}
              >
                <div className="progress-week-bar-wrap"><i style={{ height: `${height}%` }} /></div>
                <span className="progress-week-cards">{d.cards || '·'}</span>
                <span className="progress-week-label">{d.label}</span>
              </div>
            )
          })}
        </div>
        <div className="progress-week-foot"><span>Practice is evidence of effort; mastery comes from unaided recall on separate days.</span></div>
      </section>

      <section className="card progress-section progress-mastery-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">BEYOND FINISHING A LESSON</div>
            <h2>What stays with you</h2>
          </div>
          <span className="progress-mastery-spark" aria-hidden="true">✳</span>
        </div>
        <p className="progress-section-sub">Mastery means retrieving a word without help on more than one day. A completed lesson is only the beginning.</p>
        <MasteryTracker words={s.learningTrail} />
      </section>

      <section className="card progress-section progress-courses-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">YOUR CURRICULUM</div>
            <h2>Every path, at a glance</h2>
          </div>
          <span className="progress-course-total">{courses.length} paths</span>
        </div>
        <p className="progress-section-sub">Open a path to see the units and stages you have already completed.</p>
        <div className="progress-courses">
          {courses.map((c) => (
            <details key={c.name} className="progress-course">
              <summary>
                <div className="progress-course-summary">
                  <div className="progress-course-head">
                    <span className="progress-course-name">{c.name}</span>
                    <span className="progress-course-count">{c.units.filter((u) => u.done).length} / {c.units.length} units</span>
                  </div>
                  <div className="progress-course-bar"><i style={{ width: `${c.stepsTotal ? Math.round((c.stepsDone / c.stepsTotal) * 100) : 0}%` }} /></div>
                  <div className="progress-course-foot">
                    <span>{c.stepsDone} of {c.stepsTotal} learning stages</span>
                    <span>{c.stepsTotal ? Math.round((c.stepsDone / c.stepsTotal) * 100) : 0}%</span>
                  </div>
                </div>
                <span className="progress-course-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="progress-lesson-list">
                {c.units.length === 0 ? (
                  <div className="progress-empty">No lessons loaded yet.</div>
                ) : (
                  c.units.map((u) => (
                    <div key={u.key} className="progress-lesson" data-done={u.done ? 'true' : 'false'}>
                      <span className="progress-lesson-mark" aria-hidden>
                        {u.done ? '✓' : '○'}
                      </span>
                      <span className="progress-lesson-title">{u.title}</span>
                      <span className="progress-lesson-count">{u.sittingsDone}/{u.sittingsTotal} stages</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          ))}
        </div>
        <button className="progress-secondary-action" type="button" onClick={onLearn}>Open learning paths <span aria-hidden="true">→</span></button>
      </section>

      <section className="card progress-section">
        <div className="progress-section-heading progress-history-heading">
          <div><div className="progress-eyebrow">SMALL STEPS ADD UP</div><h2>Recent activity</h2></div>
          {history.length > 0 && <span className="progress-course-total">{history.length} entries</span>}
        </div>
        {history.length === 0 ? (
          <p className="progress-empty">Your lessons, drills, and recall attempts will build a timeline here.</p>
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
            {showHistory ? 'Show recent only' : `See all ${history.length} moments`} <span aria-hidden="true">{showHistory ? '↑' : '→'}</span>
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
