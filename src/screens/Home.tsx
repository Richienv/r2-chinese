import { lazy } from 'react'
import { MemoryHorizon } from '../components/MemoryHorizon'
import { CourseBack, CourseGate, LanguageChip } from '../components/CourseChooser'
import { COURSE_META, useCourse } from '../lib/course'
import { t } from '../lib/i18n'
import { lessons } from '../lib/content'
import { dueCards } from '../lib/srs'
import { nextPlayable } from '../lib/wordsSession'
const JiaochengHomePath = lazy(() => import('./Jiaocheng').then((m) => ({ default: m.JiaochengHomePath })))
const KerjaHomePath = lazy(() => import('./Kerja').then((m) => ({ default: m.KerjaHomePath })))
const InterviewHomePath = lazy(() => import('./Interview').then((m) => ({ default: m.InterviewHomePath })))
const MagangHomePath = lazy(() => import('./Magang').then((m) => ({ default: m.MagangHomePath })))
const BooksHomePath = lazy(() => import('./Books').then((m) => ({ default: m.BooksHomePath })))
import type { JiayinOpen } from './Jiayin'
const JiayinPath = lazy(() => import('./Jiayin').then((m) => ({ default: m.JiayinPath })))
import { LessonPath } from './Learn'
import { HskPracticeEntry } from '../components/HskPracticeEntry'
import { useStore, type PathNode } from '../store/store'
import '../styles/home-alive.css'

export function Home({
  onSession,
  onLesson,
  onReview,
  onPlacement,
  onTrail,
  onListening,
  onCompose,
  onKerjaSession,
  onJiaochengSession,
  onMagangSession,
  onInterviewSession,
  onBooksSession,
  onJiayinSession,
}: {
  onSession: (lesson: number, node: PathNode) => void
  onLesson: (lesson: number) => void
  onPlacement: () => void
  onReview: () => void
  onTrail: () => void
  onListening: () => void
  onCompose: () => void
  onKerjaSession: (chapter: number, node: PathNode) => void
  onJiaochengSession: (lesson: number, node: PathNode) => void
  onMagangSession: (chapter: number, node: string) => void
  onInterviewSession: (chapter: number, node: string) => void
  onBooksSession: (part: number, index: number) => void
  onJiayinSession: JiayinOpen
}) {
  const s = useStore()
  const { course, entered } = useCourse()
  const next = nextPlayable(s.isNodeDone)
  const reviewsDue = dueCards(s.cardList).length
  const lesson = lessons.find((l) => l.lesson === next.lesson) ?? lessons[0]
  const languageCourse = course === 'hsk4a' || course === 'kerja' || course === 'jiaocheng'
  const recentWords = s.learningTrail.slice(0, 2)

  if (!entered) {
    return (
      <div className="home-page home-alive">
        <CourseGate corner={<LanguageChip />} />
      </div>
    )
  }

  return (
    <div className="home-page home-alive">
      <div className="home-topbar">
        <CourseBack />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <h1>{COURSE_META[course].title}</h1>
          <LanguageChip />
        </div>
      </div>
      {languageCourse && <MemoryHorizon onReview={onReview} onPlacement={onPlacement} />}
      {course !== 'books' && (languageCourse || reviewsDue > 0) && (
        <div className="home-recall-dock" data-home-dock>
          {languageCourse && (
            <button
              type="button"
              className="home-dock-button home-dock-trail"
              data-home-trail
              onClick={onTrail}
            >
              <span>{t('Word trail')}</span>
              {recentWords.length > 0 && <small lang="zh-CN">{recentWords.join(' · ')}</small>}
              <span className="home-dock-arrow" aria-hidden>
                ↗
              </span>
            </button>
          )}
          {reviewsDue > 0 && (
            <button
              type="button"
              className="home-dock-button home-dock-review"
              data-home-review
              onClick={onReview}
            >
              <span>{languageCourse ? t('Review') : t('Mandarin review')}</span>
              <small>{t('{n} due', { n: reviewsDue })}</small>
              <span className="home-dock-arrow" aria-hidden>
                →
              </span>
            </button>
          )}
        </div>
      )}

      {course === 'hsk4a' && <HskPracticeEntry onListen={onListening} onCompose={onCompose} />}
      {course === 'jiayin' ? (
        <JiayinPath onPlay={onJiayinSession} />
      ) : course === 'kerja' ? (
        <KerjaHomePath onPlay={onKerjaSession} />
      ) : course === 'jiaocheng' ? (
        <JiaochengHomePath onPlay={onJiaochengSession} />
      ) : course === 'magang' ? (
        <MagangHomePath onPlay={onMagangSession} />
      ) : course === 'interview' ? (
        <InterviewHomePath onPlay={onInterviewSession} />
      ) : course === 'books' ? (
        <BooksHomePath onPlay={onBooksSession} />
      ) : (
        <LessonPath
          fill
          lesson={lesson}
          current={next}
          nodeDone={s.isNodeDone}
          onLesson={onLesson}
          onPlay={onSession}
        />
      )}
    </div>
  )
}
