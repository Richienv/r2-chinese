import { progressAction } from '../lib/practiceExperience'
import { recommendedWords } from '../lib/learningEngine'
import { graphSummary } from '../lib/learnerGraph'
import '../styles/usability.css'
import { useEffect, useMemo, useState } from 'react'
import { BeastRevealOverlay, type BeastRevealPayload } from '../components/BeastRevealOverlay'
import { CoupleComparePanel } from '../components/CoupleComparePanel'
import { MasteryTracker } from '../components/MasteryTracker'
import { SealedBeastSilhouette } from '../components/SealedBeastSilhouette'
import { evaluateBeastProgress, getBeastMinPower, getTrainerAssetSrc, LEGENDARY_BEASTS } from '../lib/beastEngine'
import { readBeastPrefs, subscribeBeastPrefs, writeBeastPrefs } from '../lib/beastPrefs'
import { getBeastStage } from '../lib/beastStages'
import { useCoupleProfile } from '../lib/coupleProfile'
import { HSK1_UNITS } from '../data/hsk1'
import { getHsk1MemorySummary, HSK1_NODE_ORDER } from '../lib/hsk1Srs'
import { readHsk1Progress, subscribeHsk1Progress, type Hsk1ProgressState } from '../lib/hsk1'
import { getLesson, isCoreBookVocab, lessons, lookup } from '../lib/content'
import { computeCategoryBreakdown, computeDailyComparison } from '../lib/progressAnalytics'
import { COURSE_META } from '../lib/course'
import { readHistory, type HistoryCourse, type HistoryEvent } from '../lib/history'
import { getLang, t } from '../lib/i18n'
import { dueCards } from '../lib/srs'
import { getJiaochengLesson, jiaochengLessons, nodesForLesson } from '../lib/jiaocheng'
import { getKerjaChapter, kerjaChapters, nodesForChapter } from '../lib/kerja'
import { getInterviewChapter } from '../lib/interview'
import { getMagangChapter } from '../lib/magang'
import {
  BOOKS_PROGRESS_KEY,
  booksChapters,
  booksProgressKey,
  getBooksChapterByLesson,
  nodesForChapter as booksNodesForChapter,
} from '../lib/books'
import { PATH_NODES } from '../lib/wordsSession'
import { DAILY_GOAL, dayKey, useStore } from '../store/store'
import { jiayinUnits } from '../lib/jiayin'
import '../styles/progress.css'

const KERJA_KEY = 'yulu.kerja.v1'
const JIAOCHENG_KEY = 'yulu.jiaocheng.v1'
const BOOKS_KEY = BOOKS_PROGRESS_KEY
const HSK1_WORD_SET = new Set(HSK1_UNITS.flatMap((u) => u.words.map((w) => w.zh)))

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

function hsk1Course(hsk1: Hsk1ProgressState): CourseRow {
  let done = 0
  const total = HSK1_UNITS.length * HSK1_NODE_ORDER.length
  const units = HSK1_UNITS.map((u) => {
    const finished = hsk1.nodeDone[String(u.unit)] ?? []
    const isUnitDone = hsk1.unitsDone.includes(u.unit) || finished.length >= HSK1_NODE_ORDER.length
    const sittingsDone = isUnitDone ? HSK1_NODE_ORDER.length : finished.length
    done += sittingsDone
    return {
      key: `hsk1-${u.unit}`,
      title: `Unit ${u.unit}: ${u.titleZh} · ${u.titleId}`,
      done: isUnitDone,
      sittingsDone,
      sittingsTotal: HSK1_NODE_ORDER.length,
    }
  })
  return { name: COURSE_META.hsk1.title, stepsDone: done, stepsTotal: total, units }
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
  hsk1: COURSE_META.hsk1.title,
  kerja: COURSE_META.kerja.title,
  jiaocheng: COURSE_META.jiaocheng.title,
  magang: COURSE_META.magang.title,
  interview: COURSE_META.interview.title,
  books: COURSE_META.books.title,
  jiayin: COURSE_META.jiayin.title,
}

function historyHeadline(ev: HistoryEvent): string {
  if (ev.kind === 'drill') return ev.title?.trim() || t('Drill')
  if (ev.kind === 'quiz')
    return (
      ev.title?.trim() ||
      (ev.correct === true
        ? t('Recall correct')
        : ev.correct === false
          ? t('Recall needs practice')
          : t('Practice · ungraded'))
    )
  // node
  if (ev.title?.trim()) return ev.title.trim()
  if (ev.node) return t('{node} finished', { node: ev.node })
  return t('Node finished')
}

function historyDetail(ev: HistoryEvent): string {
  const course = COURSE_LABEL[ev.course]
  if (ev.course === 'jiayin')
    return `${course} · ${jiayinUnits.find((u) => u.id === ev.lesson)?.title ?? 'Simulasi / pengulangan'}${ev.node ? ` · ${ev.node}` : ''}`
  if (ev.course === 'hsk1') {
    const u = HSK1_UNITS.find((x) => x.unit === ev.lesson)
    return `${course} · ${u ? `Unit ${u.unit}: ${u.titleId}` : 'Pondasi 4 Nada / Goresan'}`
  }
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
  onHsk1Recall,
}: {
  onReview: (words?: string[], title?: string) => void
  onLearn: () => void
  onHsk1Recall?: () => void
}) {
  const s = useStore()
  const { activeId, member } = useCoupleProfile()
  const [showHistory, setShowHistory] = useState(false)
  const [syncTick, setSyncTick] = useState(0)
  const [beastPrefs, setBeastPrefs] = useState(readBeastPrefs)
  const [hsk1Progress, setHsk1Progress] = useState(readHsk1Progress)
  const [revealPayload, setRevealPayload] = useState<BeastRevealPayload | null>(null)
  useEffect(() => {
    const bump = () => setSyncTick((n) => n + 1)
    window.addEventListener('yulu:cloud-hydrated', bump)
    window.addEventListener('yulu:local-progress', bump)
    const unsubBeast = subscribeBeastPrefs((next) => setBeastPrefs(next))
    const unsubHsk1 = subscribeHsk1Progress((next) => setHsk1Progress(next))
    return () => {
      window.removeEventListener('yulu:cloud-hydrated', bump)
      window.removeEventListener('yulu:local-progress', bump)
      unsubBeast()
      unsubHsk1()
    }
  }, [])
  const week = weekActivity(s.log)
  const dailyComparison = useMemo(
    () => computeDailyComparison(s.log, dayKey(), Date.now()),
    [s.log, syncTick],
  )
  const isHsk1Track = member.track === 'hsk1'
  const categoryBreakdown = useMemo(() => {
    if (isHsk1Track) {
      const hsk1Mastery = Object.fromEntries(
        Object.entries(s.mastery ?? {}).filter(([zh]) => HSK1_WORD_SET.has(zh)),
      )
      return computeCategoryBreakdown(hsk1Mastery, hsk1Progress.provenWords, (zh) => lookup(zh)?.pos)
    }
    return computeCategoryBreakdown(s.mastery, [], (zh) => lookup(zh)?.pos)
  }, [isHsk1Track, s.mastery, hsk1Progress.provenWords, syncTick])
  const max7DayCards = Math.max(DAILY_GOAL, ...dailyComparison.series7Days.map((p) => p.cards))
  const due = dueCards(s.cardList).filter((c) => isCoreBookVocab(c.zh))
  const hardWords = recommendedWords(
    s,
    Object.values(s.mastery)
      .filter((record) => record.state === 'hard' && isCoreBookVocab(record.zh))
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .map((record) => record.zh),
    Date.now(),
    s.learnerGraph,
  )
  const graphInfo = useMemo(() => graphSummary(s.learnerGraph), [s.learnerGraph])
  const weekCards = week.reduce((sum, day) => sum + day.cards, 0)
  const activeDays = week.filter((day) => day.cards > 0).length
  const todayProgress = Math.min(100, Math.round((s.today.cards / DAILY_GOAL) * 100))

  const hsk1Memory = useMemo(
    () => getHsk1MemorySummary(hsk1Progress.srsCards, hsk1Progress.provenWords),
    [hsk1Progress.srsCards, hsk1Progress.provenWords],
  )
  const courses = useMemo(() => {
    if (isHsk1Track) {
      return [hsk1Course(hsk1Progress)]
    }
    const kerjaDone = readPathDone(KERJA_KEY)
    const jiaochengDone = readPathDone(JIAOCHENG_KEY)
    const booksDone = readPathDone(BOOKS_KEY)
    return [
      hskCourse(s.pathDone as PathDoneMap, s.lessonsDone),
      kerjaCourse(kerjaDone),
      jiaochengCourse(jiaochengDone),
      booksCourse(booksDone),
    ]
  }, [isHsk1Track, hsk1Progress, s.pathDone, s.lessonsDone, syncTick])

  const history = useMemo(
    () =>
      readHistory().filter((event) =>
        isHsk1Track ? event.course === 'hsk1' : !['magang', 'interview', 'jiayin'].includes(event.course),
      ),
    [isHsk1Track, s.pathDone, s.log, s.xp, s.cards, syncTick],
  )
  const beastEval = useMemo(
    () =>
      evaluateBeastProgress({
        track: member.track,
        mastery: s.mastery,
        cards: s.cards,
        lessonsDone: s.lessonsDone,
        pathDone: s.pathDone,
        streak: s.streak,
        xp: s.xp,
        log: s.log,
        history,
        learnerGraph: s.learnerGraph,
        hsk1Progress,
        todayKey: dayKey(),
        nowMs: Date.now(),
      }),
    [
      member.track,
      s.mastery,
      s.cards,
      s.lessonsDone,
      s.pathDone,
      s.streak,
      s.xp,
      s.log,
      history,
      s.learnerGraph,
      hsk1Progress,
    ],
  )
  const visibleHistory = showHistory ? history : history.slice(0, 5)

  const effectiveDueCount = isHsk1Track ? hsk1Memory.dueCount : due.length
  const nextAction = progressAction(effectiveDueCount, isHsk1Track ? 0 : hardWords.length)
  function startReview() {
    if (isHsk1Track) {
      if (effectiveDueCount > 0 && onHsk1Recall) onHsk1Recall()
      else onLearn()
      return
    }
    if (nextAction === 'due') onReview()
    else if (nextAction === 'hard') onReview(hardWords.slice(0, 8), t('Strengthen hard words'))
    else onLearn()
  }

  const reviewLabel = effectiveDueCount
    ? t('Review due words')
    : !isHsk1Track && hardWords.length
      ? t('Practice hard words')
      : t('Continue learning')

  return (
    <div className="stack-page progress-page">
      <header className="progress-header">
        <div>
          <div className="progress-eyebrow">{t('YOUR LEARNING, OVER TIME')}</div>
          <h1 className="h2">{t('Progress')}</h1>
          <div className="sub">
            {t('Your practice, memory, and completed lessons.')}
          </div>
        </div>

      </header>

      <section className="progress-focus" aria-labelledby="progress-focus-title">
        <div className="progress-focus-copy">
          <span className="progress-focus-kicker">{t('TODAY’S PRACTICE')}</span>
          <h2 id="progress-focus-title">{t('One session at a time.')}</h2>
          <p>
            {s.today.cards >= DAILY_GOAL
              ? t(
                  '{n} practice steps. Daily goal complete.',
                  { n: s.today.cards },
                )
              : t(
                  '{n} of {goal} practice steps today.',
                  { n: s.today.cards, goal: DAILY_GOAL },
                )}
          </p>
          <button
            className="btn progress-focus-button"
            type="button"
            onClick={startReview}
          >
            {reviewLabel}
            <span aria-hidden="true">→</span>
          </button>
          <span className="progress-focus-note">
            {effectiveDueCount
              ? t('{n} ready to revisit', { n: effectiveDueCount })
              : !isHsk1Track && hardWords.length
                ? t('{n} words are asking for another try', { n: hardWords.length })
                : (isHsk1Track ? hsk1Memory.totalTracked > 0 : s.cardList.some((c) => isCoreBookVocab(c.zh)))
                  ? t('All caught up. Continue a lesson when you feel like it.')
                  : t('Start with a lesson you like.')}
          </span>
        </div>
        <div
          className="progress-focus-meter"
          style={{ '--today-progress': `${todayProgress}%` } as React.CSSProperties}
          aria-label={t('{n} practice steps today', { n: s.today.cards })}
        >
          <div className="progress-focus-meter-core">
            <strong>{s.today.cards}</strong>
            <span>
              {s.today.cards >= DAILY_GOAL ? t('goal reached') : t('of {goal} goal', { goal: DAILY_GOAL })}
            </span>
            <small>{t('practice steps')}</small>
          </div>
        </div>
      </section>

      <section className="card progress-section progress-analytics-card" aria-label="Perbandingan Harian Kemarin dan Hari Ini">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">PROGRES HARIAN · KEMARIN VS HARI INI</div>
            <h2>Perbandingan & Tren 7 Hari</h2>
          </div>
          <span
            className={`progress-delta-pill${
              dailyComparison.deltaCards > 0
                ? ' is-up'
                : dailyComparison.deltaCards < 0
                  ? ' is-down'
                  : ''
            }`}
          >
            {dailyComparison.deltaCards > 0
              ? `▲ +${dailyComparison.deltaCards} vs kemarin`
              : dailyComparison.deltaCards < 0
                ? `▼ ${dailyComparison.deltaCards} vs kemarin`
                : '= Sama dengan kemarin'}
          </span>
        </div>

        <div className="progress-yday-today">
          <div className="progress-yday-box">
            <small>Kemarin</small>
            <strong>{dailyComparison.yesterdayCards}</strong>
            <span>langkah · {dailyComparison.yesterdayLessons} sesi</span>
          </div>
          <div className="progress-yday-box is-today">
            <small>Hari Ini</small>
            <strong>{dailyComparison.todayCards}</strong>
            <span>langkah · {dailyComparison.todayLessons} sesi</span>
          </div>
        </div>

        <div className="progress-trend-bars" role="img" aria-label="Grafik 7 hari belajar">
          {dailyComparison.series7Days.map((pt) => {
            const hPct = pt.cards > 0 ? Math.max(14, Math.round((pt.cards / max7DayCards) * 100)) : 6
            return (
              <div
                key={pt.key}
                className={`progress-trend-col${pt.isToday ? ' is-today' : ''}${pt.cards > 0 ? ' is-active' : ''}`}
              >
                <span className="progress-trend-num">{pt.cards || '0'}</span>
                <div className="progress-trend-track">
                  <i style={{ height: `${hPct}%` }} />
                </div>
                <span className="progress-trend-lbl">{pt.label}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card progress-section progress-cat-card" aria-label="Grafik Pemahaman Jenis Kata">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">PEMAHAMAN KATEGORI KATA</div>
            <h2>Peta Penguasaan Jenis Kata</h2>
          </div>
          <span className="progress-course-total">6 kategori</span>
        </div>
        <p className="progress-section-sub">
          Distribusi kata yang benar-benar dikuasai vs masih dilatih berdasarkan Verb, Noun, Adjektiva, Lokasi, Waktu/Angka, dan Partikel/Grammar.
        </p>
        <div className="progress-cat-list">
          {categoryBreakdown.map((cat) => {
            const learningPct = cat.total > 0 ? Math.round(((cat.mastered + cat.learning) / cat.total) * 100) : 0
            return (
              <div key={cat.category} className="progress-cat-row">
                <div className="progress-cat-top">
                  <strong>{cat.label}</strong>
                  <span>
                    {cat.mastered} kuasai{cat.learning > 0 ? ` · ${cat.learning} latih` : ''} · <b>{cat.pct}%</b>
                  </span>
                </div>
                <div className="progress-cat-bar" aria-hidden="true">
                  <i
                    className="progress-cat-fill-learn"
                    style={{ width: `${learningPct}%`, backgroundColor: cat.accentHex }}
                  />
                  <i
                    className="progress-cat-fill-master"
                    style={{ width: `${cat.pct}%`, backgroundColor: cat.accentHex }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <CoupleComparePanel />

      <details className="progress-activity-details">
        <summary>{t('Practice over time')}</summary>
      <section className="progress-stats" aria-label={t('Learning totals')}>
        <Glance value={s.streak} label={t('day streak')} detail={t('show up again')} />
        <Glance value={s.xp} label={t('XP earned')} detail={t('practice adds up')} />
        <Glance value={s.learningTrail.length} label={t('words met')} detail={t('kept in your trail')} />
      </section>

      <section className="card progress-section progress-week-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">{t('THE LAST 7 DAYS')}</div>
            <h2>{t('Build a learning rhythm')}</h2>
          </div>
          <div className="progress-week-summary">
            <strong>{activeDays}</strong>
            <span>{t('active days')}</span>
          </div>
        </div>
        <p className="progress-section-sub">
          {weekCards === 1
            ? t(
                '{n} practice step across the week. Returning to a word later is how recognition becomes recall.',
                { n: weekCards },
              )
            : t(
                '{n} practice steps across the week. Returning to a word later is how recognition becomes recall.',
                { n: weekCards },
              )}
        </p>
        <div className="progress-week-grid">
          {week.map((d, i) => {
            const height = d.cards
              ? Math.max(
                  12,
                  Math.min(100, (d.cards / Math.max(DAILY_GOAL, ...week.map((day) => day.cards))) * 100),
                )
              : 5
            return (
              <div
                key={`${d.date}-${i}`}
                className="progress-week-day"
                data-today={d.today ? 'true' : 'false'}
                data-on={d.cards > 0 ? 'true' : 'false'}
                title={
                  d.cards === 1
                    ? t('{n} practice step', { n: d.cards })
                    : t('{n} practice steps', { n: d.cards })
                }
              >
                <div className="progress-week-bar-wrap">
                  <i style={{ height: `${height}%` }} />
                </div>
                <span className="progress-week-cards">{d.cards || '·'}</span>
                <span className="progress-week-label">{d.label}</span>
              </div>
            )
          })}
        </div>
        <div className="progress-week-foot">
          <span>
            {t('Practice is evidence of effort; mastery comes from unaided recall on separate days.')}
          </span>
        </div>
      </section>

      </details>

      <section className="card progress-section progress-mastery-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">
              {isHsk1Track ? 'INGATAN FSRS-6 · HSK 1 DARI NOL' : t('BEYOND FINISHING A LESSON')}
            </div>
            <h2>{isHsk1Track ? 'Rekap Memori HSK 1' : t('What stays with you')}</h2>
          </div>
          <span className="progress-mastery-spark" aria-hidden="true">
            ✳
          </span>
        </div>
        <p className="progress-section-sub">
          {isHsk1Track
            ? 'Memori diukur lewat Active Recall FSRS-6 dari 150 kata resmi HSK 1 tanpa bantuan hint.'
            : t(
                'Mastery means retrieving a word without help on more than one day. A completed lesson is only the beginning.',
              )}
        </p>
        {isHsk1Track ? (
          <div className="progress-hsk1-memory-grid" aria-label="Ringkasan Memori FSRS-6 HSK 1">
            <Glance
              value={hsk1Memory.totalTracked}
              label="kata dilacak"
              detail={`dari ${HSK1_WORD_SET.size} kata HSK 1`}
            />
            <Glance
              value={hsk1Memory.strongCount}
              label="kata kuat"
              detail="diingat stabil"
            />
            <Glance
              value={hsk1Memory.dueCount}
              label="jatuh tempo"
              detail="siap disegarkan"
            />
            <div className="progress-glance-cell">
              <div className="progress-glance-value">{hsk1Memory.avgRetentionPct}%</div>
              <div className="progress-glance-label">retensi</div>
              <div className="progress-glance-detail">rata-rata FSRS-6</div>
            </div>
          </div>
        ) : (
          <>
            <MasteryTracker words={s.learningTrail} />
            {(graphInfo.skippedPendingCount > 0 || graphInfo.weakGrammarCount > 0 || graphInfo.confusionPairCount > 0) && (
              <details className="progress-graph-details" style={{ marginTop: 12 }}>
                <summary>{t('Active recall priorities from your graph')}</summary>
                <div style={{ display: 'grid', gap: 6, marginTop: 8, fontSize: 13 }}>
                  {graphInfo.skippedPendingCount > 0 && (
                    <span>{t('{n} words from skipped lessons queued for active recall', { n: graphInfo.skippedPendingCount })}</span>
                  )}
                  {graphInfo.weakGrammar.length > 0 && (
                    <span>{t('Weak grammar')}: {graphInfo.weakGrammar.map((g) => g.point).join(' · ')}</span>
                  )}
                  {graphInfo.confusions.length > 0 && (
                    <span>{t('Confused pairs')}: {graphInfo.confusions.map((c) => c.label).join(' · ')}</span>
                  )}
                </div>
              </details>
            )}
          </>
        )}
      </section>

      <section className="card progress-section progress-beast-section" aria-label="Koleksi Evolusi Trainer dan Partner">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">8 SIKLUS × 3 TAHAP (BAYI → MATANG → DEWA)</div>
            <h2>
              <span lang="zh-CN">{beastEval.beast.zhName}</span> · {beastEval.beast.name}
            </h2>
          </div>
          <span className="progress-course-total">
            Lv {beastEval.level}/24 · ⚡ {beastEval.spiritPower.toLocaleString()} 灵力
          </span>
        </div>
        <p className="progress-section-sub">
          Gelar aktif: <strong>{beastEval.beast.trainerTitle}</strong> ({beastEval.beast.stageLabel} · Siklus {beastEval.beast.speciesIndex}/8).{' '}
          {beastEval.nextBeast
            ? `Butuh ${beastEval.powerToNext.toLocaleString()} 灵力 lagi untuk membuka Wujud Rahasia Lv ${beastEval.nextBeast.level} (${beastEval.nextBeast.stageLabel}).`
            : 'Seluruh 24 evolusi Trainer & Mythical Partner telah terbuka penuh!'}
        </p>

        <div className="progress-beast-vars">
          {beastEval.variables.map((v) => (
            <div key={v.key} className="progress-beast-var">
              <div className="progress-beast-var-head">
                <strong>{v.label}</strong>
                <span>+{v.power} 灵力</span>
              </div>
              <div className="progress-beast-var-val">{v.valueText}</div>
              <div className="progress-beast-var-bar">
                <i style={{ width: `${Math.round(v.ratio * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="progress-beast-grid">
          {LEGENDARY_BEASTS.map((tier) => {
            const unlocked = tier.level <= beastEval.level
            const stage = getBeastStage(beastPrefs.stageId)
            const tierImg = getTrainerAssetSrc(tier, activeId)
            return (
              <div
                key={tier.id}
                className={`progress-beast-tile${unlocked ? ' is-unlocked' : ' is-locked'}`}
              >
                <div className="progress-beast-stage-tag" data-stage={tier.stage}>
                  Siklus {tier.speciesIndex} · {tier.stageLabel}
                </div>
                <div className="progress-beast-thumb-wrap">
                  {unlocked ? (
                    <img
                      className="progress-beast-thumb"
                      src={tierImg}
                      alt={`${tier.zhName} ${tier.name}`}
                    />
                  ) : (
                    <SealedBeastSilhouette src={tierImg} level={tier.level} compact />
                  )}
                </div>
                <div className="progress-beast-lvl">Lv {tier.level}</div>
                <div className="progress-beast-zh" lang="zh-CN">
                  {unlocked ? tier.zhName : '???'}
                </div>
                <div className="progress-beast-name">
                  {unlocked ? tier.name : `${getBeastMinPower(tier, member.track).toLocaleString()} 灵力`}
                </div>
                {unlocked && (
                  <button
                    type="button"
                    className="progress-beast-reveal-btn"
                    onClick={() =>
                      setRevealPayload({
                        beast: tier,
                        stage,
                        reason: 'replay',
                        spiritPower: beastEval.spiritPower,
                      })
                    }
                  >
                    ✨ Reveal
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="card progress-section progress-courses-section">
        <div className="progress-section-heading">
          <div>
            <div className="progress-eyebrow">{t('YOUR CURRICULUM')}</div>
            <h2>{t('Every path, at a glance')}</h2>
          </div>
          <span className="progress-course-total">{t('{n} paths', { n: courses.length })}</span>
        </div>
        <p className="progress-section-sub">
          {t('Open a path to see the units and stages you have already completed.')}
        </p>
        <div className="progress-courses">
          {courses.map((c) => (
            <details key={c.name} className="progress-course">
              <summary>
                <div className="progress-course-summary">
                  <div className="progress-course-head">
                    <span className="progress-course-name">{c.name}</span>
                    <span className="progress-course-count">
                      {t('{done} / {total} units', {
                        done: c.units.filter((u) => u.done).length,
                        total: c.units.length,
                      })}
                    </span>
                  </div>
                  <div className="progress-course-bar">
                    <i
                      style={{
                        width: `${c.stepsTotal ? Math.round((c.stepsDone / c.stepsTotal) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="progress-course-foot">
                    <span>
                      {t('{done} of {total} learning stages', { done: c.stepsDone, total: c.stepsTotal })}
                    </span>
                    <span>{c.stepsTotal ? Math.round((c.stepsDone / c.stepsTotal) * 100) : 0}%</span>
                  </div>
                </div>
                <span className="progress-course-chevron" aria-hidden="true">
                  ⌄
                </span>
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
                      <span className="progress-lesson-count">
                        {t('{done}/{total} stages', { done: u.sittingsDone, total: u.sittingsTotal })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </details>
          ))}
        </div>
        <button className="progress-secondary-action" type="button" onClick={onLearn}>
          {t('Open learning paths')} <span aria-hidden="true">→</span>
        </button>
      </section>

      <section className="card progress-section">
        <div className="progress-section-heading progress-history-heading">
          <div>
            <div className="progress-eyebrow">{t('SMALL STEPS ADD UP')}</div>
            <h2>{t('Recent activity')}</h2>
          </div>
          {history.length > 0 && (
            <span className="progress-course-total">{t('{n} entries', { n: history.length })}</span>
          )}
        </div>
        {history.length === 0 ? (
          <p className="progress-empty">
            {t('Your lessons, drills, and recall attempts will build a timeline here.')}
          </p>
        ) : (
          <div className="progress-history">
            {visibleHistory.map((ev, i) => (
              <div
                key={`${ev.t}-${ev.course}-${ev.kind}-${ev.lesson}-${ev.node ?? ''}-${i}`}
                className="progress-history-item"
              >
                <div className="progress-history-main">{historyHeadline(ev)}</div>
                <div className="progress-history-time">{formatWhen(ev.t)}</div>
                <div className="progress-history-meta">{historyDetail(ev)}</div>
              </div>
            ))}
          </div>
        )}
        {history.length > 5 && (
          <button
            className="progress-secondary-action"
            type="button"
            onClick={() => setShowHistory((value) => !value)}
          >
            {showHistory ? t('Show recent only') : t('See all {n} moments', { n: history.length })}{' '}
            <span aria-hidden="true">{showHistory ? '↑' : '→'}</span>
          </button>
        )}
      </section>
      <BeastRevealOverlay
        payload={revealPayload}
        muted={beastPrefs.revealMuted}
        onToggleMute={() => writeBeastPrefs({ revealMuted: !beastPrefs.revealMuted })}
        onClose={() => setRevealPayload(null)}
      />
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
