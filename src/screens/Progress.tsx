import { useMemo } from 'react'
import { MasteryTracker } from '../components/MasteryTracker'
import { getLesson, lessons } from '../lib/content'
import { readHistory, type HistoryCourse, type HistoryEvent } from '../lib/history'
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
import { dayKey, useStore } from '../store/store'
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
  done: number
  total: number
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
  return { name: 'HSK 4', done, total, units }
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
  return { name: '1000 words', done, total, units }
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
  return { name: 'Jiaocheng 2', done, total, units }
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
  return { name: 'Magang AI', done, total, units }
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
  return { name: '总办', done, total, units }
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
  return { name: 'Books', done, total, units }
}

/** Rolling last-7-days card counts, oldest → newest, labelled by weekday. */
function weekActivity(log: Record<string, { cards: number }>) {
  const out: { label: string; cards: number; today: boolean }[] = []
  const now = new Date()
  const todayKey = dayKey(now)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = dayKey(d)
    out.push({
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      cards: log[key]?.cards ?? 0,
      today: key === todayKey,
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

export function Progress() {
  const s = useStore()
  const week = weekActivity(s.log)

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

  return (
    <div className="stack-page progress-page">
      <header className="progress-header">
        <h1 className="h2">Progress</h1>
        <div className="sub">All six courses</div>
      </header>

      <section className="metal progress-glance">
        <div className="progress-glance-grid">
          <Glance value={s.streak} label="Streak" />
          <Glance value={s.xp} label="XP" />
          <Glance value={s.wordsLearned} label="Words" />
        </div>
      </section>

      <section className="card progress-section">
        <h2 className="h2" style={{ fontSize: 18 }}>What stays with you</h2>
        <p className="sub">Mastery requires unaided recall on separate days. Completing a lesson alone doesn’t count.</p>
        <MasteryTracker words={s.learningTrail} />
      </section>

      <section className="card progress-section">
        <div className="kicker-ink">Courses</div>
        <div className="progress-courses">
          {courses.map((c) => (
            <div key={c.name} className="progress-course">
              <div className="progress-course-head">
                <div className="progress-course-name">{c.name}</div>
                <div className="progress-course-count">
                  {c.done} / {c.total} sittings
                </div>
              </div>
              <div className="progress-lesson-list">
                {c.units.length === 0 ? (
                  <div className="progress-empty">No lessons loaded yet.</div>
                ) : (
                  c.units.map((u) => (
                    <div key={u.key} className="progress-lesson" data-done={u.done ? 'true' : 'false'}>
                      <span className="progress-lesson-mark" aria-hidden>
                        {u.done ? '✓' : '·'}
                      </span>
                      <span className="progress-lesson-title">{u.title}</span>
                      <span className="progress-lesson-count">
                        {u.sittingsDone}/{u.sittingsTotal}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card progress-section">
        <div className="kicker-ink">This week</div>
        <div className="progress-week-grid">
          {week.map((d, i) => {
            const on = d.cards > 0
            return (
              <div
                key={i}
                className="progress-week-day"
                data-today={d.today ? 'true' : 'false'}
                data-on={on ? 'true' : 'false'}
              >
                <span
                  className="progress-week-dot"
                  data-on={on ? 'true' : 'false'}
                  data-today={d.today ? 'true' : 'false'}
                  title={`${d.cards} cards`}
                />
                <span className="progress-week-cards">{d.cards}</span>
                <span className="progress-week-label">{d.label}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card progress-section">
        <div className="kicker-ink">History</div>
        {history.length === 0 ? (
          <p className="progress-empty">Finish a sitting and it will show up here.</p>
        ) : (
          <div className="progress-history">
            {history.map((ev, i) => (
              <div key={`${ev.t}-${ev.course}-${ev.kind}-${ev.lesson}-${ev.node ?? ''}-${i}`} className="progress-history-item">
                <div className="progress-history-main">{historyHeadline(ev)}</div>
                <div className="progress-history-time">{formatWhen(ev.t)}</div>
                <div className="progress-history-meta">{historyDetail(ev)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Glance({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress-glance-cell">
      <div className="on-red progress-glance-value">{value.toLocaleString()}</div>
      <div className="progress-glance-label">{label}</div>
    </div>
  )
}
