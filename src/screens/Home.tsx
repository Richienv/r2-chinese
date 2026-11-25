import { StudyMusic } from '../components/StudyMusic'
import { lazy } from 'react'
import { MemoryHorizon } from '../components/MemoryHorizon'
import { TodayHud } from '../components/TodayHud'
import { CourseBack, CourseGate, LanguageChip } from '../components/CourseChooser'
import { COURSE_META, useCourse } from '../lib/course'
import { t } from '../lib/i18n'
import { lessons, teachableVocab } from '../lib/content'
import type { ExamCourse, ExamMode } from '../lib/jiaochengMidterm'
import { SkipLevelControl } from '../components/SkipLevelModal'
import { nextPlayable } from '../lib/wordsSession'
const JiaochengHomePath = lazy(() => import('./Jiaocheng').then((m) => ({ default: m.JiaochengHomePath })))
const KerjaHomePath = lazy(() => import('./Kerja').then((m) => ({ default: m.KerjaHomePath })))
const InterviewHomePath = lazy(() => import('./Interview').then((m) => ({ default: m.InterviewHomePath })))
const MagangHomePath = lazy(() => import('./Magang').then((m) => ({ default: m.MagangHomePath })))
const BooksHomePath = lazy(() => import('./Books').then((m) => ({ default: m.BooksHomePath })))
import type { JiayinOpen } from './Jiayin'
const JiayinPath = lazy(() => import('./Jiayin').then((m) => ({ default: m.JiayinPath })))
import { LessonPath } from './Learn'
import { useStore, type PathNode } from '../store/store'
import '../styles/home-alive.css'
import '../styles/jiaocheng-midterm.css'

export function Home({
  onSession,
  onLesson,
  onReview,
  onPlacement,
  onTrail,
  onBrowse,
  onKerjaSession,
  onJiaochengSession,
  onJiaochengMidterm,
  onMagangSession,
  onInterviewSession,
  onBooksSession,
  onJiayinSession,
  onProgress,
}: {
  onSession: (lesson: number, node: PathNode) => void
  onLesson: (lesson: number) => void
  onPlacement: () => void
  onReview: () => void
  onTrail: () => void
  onBrowse: () => void
  onKerjaSession: (chapter: number, node: PathNode) => void
  onJiaochengSession: (lesson: number, node: PathNode) => void
  onJiaochengMidterm: (course?: ExamCourse, mode?: ExamMode) => void
  onMagangSession: (chapter: number, node: string) => void
  onInterviewSession: (chapter: number, node: string) => void
  onBooksSession: (part: number, index: number) => void
  onJiayinSession: JiayinOpen
  onProgress?: () => void
}) {
  const s = useStore()
  const { course, entered } = useCourse()
  const skipOpts = { skippedLessons: s.skippedLessons, unlockedLesson: s.unlockedLesson }
  const next = nextPlayable(s.isNodeDone, skipOpts)
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
      <TodayHud onOpen={onProgress} />
      {course === 'jiayin' ? (
        <JiayinPath onPlay={onJiayinSession} />
      ) : course === 'kerja' ? (
        <KerjaHomePath onPlay={onKerjaSession} />
      ) : course === 'jiaocheng' ? (
        <JiaochengHomePath onPlay={onJiaochengSession} onMidterm={onJiaochengMidterm} />
      ) : course === 'magang' ? (
        <MagangHomePath onPlay={onMagangSession} />
      ) : course === 'interview' ? (
        <InterviewHomePath onPlay={onInterviewSession} />
      ) : course === 'books' ? (
        <BooksHomePath onPlay={onBooksSession} />
      ) : (
        <>
          <div className="exam-home-card">
            <button type="button" className="jiaocheng-midterm-entry" onClick={() => onJiaochengMidterm('hsk4a', 'mock')}>
              <span className="kicker">HSK 4 · {t('Exam prep')}</span>
              <strong>{t('HSK 4 & Final Mock Simulator')}</strong>
              <span>{t('Mock exam, grammar drill, word order, error spotting & breakdown.')}</span>
            </button>
          </div>
          <SkipLevelControl
            courseLabel="HSK 4"
            currentLesson={next.lesson}
            options={lessons.map((l) => {
              const words = teachableVocab(l)
              return {
                lesson: l.lesson,
                label: t('Lesson {n}', { n: l.lesson }),
                title: l.title.zh || l.title.en,
                wordCount: words.length,
                done: s.isNodeDone(l.lesson, 'wrap'),
                skipped: s.skippedLessons.includes(l.lesson),
              }
            })}
            onSkipTo={(target) => {
              const specs = lessons
                .filter((l) => l.lesson < target)
                .map((l) => ({
                  lesson: l.lesson,
                  title: l.title.zh || l.title.en,
                  words: teachableVocab(l),
                  grammarPoints: l.grammar.map((g) => g.point),
                }))
              s.skipToHskLesson(target, specs)
            }}
          />
          <LessonPath
            fill
            lesson={lesson}
            current={next}
            nodeDone={s.isNodeDone}
            skippedLessons={s.skippedLessons}
            unlockedLesson={s.unlockedLesson}
            onUnskip={(lessonNum) => s.unskipHskLesson(lessonNum)}
            onLesson={onLesson}
            onPlay={onSession}
          />
        </>
      )}
      {languageCourse && <MemoryHorizon onReview={onReview} onPlacement={onPlacement} />}
      <StudyMusic />
      <div className="home-shortcuts">
        <button type="button" className="home-dock-button" onClick={onBrowse}><span>{t('Browse materials')}</span><span aria-hidden>→</span></button>
        {languageCourse && <button type="button" className="home-dock-button" data-home-trail onClick={onTrail}><span>{t('My words')}{recentWords.length > 0 && <small lang="zh-CN">{recentWords.join(' · ')}</small>}</span><span aria-hidden>→</span></button>}
      </div>
    </div>
  )
}
