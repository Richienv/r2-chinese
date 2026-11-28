import { StudyMusic } from '../components/StudyMusic'
import { InstallCard } from '../components/InstallCard'
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
import { useEffect, useState } from 'react'
import { BeastStageCard } from '../components/BeastStageCard'
import { CoupleHub } from '../components/CoupleHub'
import { useCoupleProfile } from '../lib/coupleProfile'
import { nextPlayableHsk1Unit, readHsk1Progress, subscribeHsk1Progress } from '../lib/hsk1'
import type { Hsk1NodeId } from '../lib/hsk1Srs'
import { LessonPath } from './Learn'
import { useStore, type PathNode } from '../store/store'
import '../styles/home-alive.css'
import '../styles/jiaocheng-midterm.css'

const Hsk1HomePath = lazy(() => import('./Hsk1').then((m) => ({ default: m.Hsk1HomePath })))

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
  onHsk1Unit,
  onHsk1Tones,
  onHsk1Recall,
  onProgress,
  onOpenOnboarding,
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
  onHsk1Unit?: (unit: number, node?: Hsk1NodeId) => void
  onHsk1Tones?: (track?: 'tones' | 'pinyin' | 'strokes') => void
  onHsk1Recall?: () => void
  onProgress?: () => void
  onOpenOnboarding?: () => void
}) {
  const s = useStore()
  const { course, entered } = useCourse()
  const { member } = useCoupleProfile()
  const [hsk1Progress, setHsk1Progress] = useState(readHsk1Progress)
  const [coupleSheetOpen, setCoupleSheetOpen] = useState(false)
  useEffect(() => subscribeHsk1Progress(setHsk1Progress), [])
  const skipOpts = { skippedLessons: s.skippedLessons, unlockedLesson: s.unlockedLesson }
  const next = nextPlayable(s.isNodeDone, skipOpts)
  const lesson = lessons.find((l) => l.lesson === next.lesson) ?? lessons[0]
  const hsk4Surface = course === 'hsk4a' || course === 'kerja' || course === 'jiaocheng'
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
      <div className="home-col-primary">
      <CoupleHub openSheetExternal={coupleSheetOpen} onCloseExternal={() => setCoupleSheetOpen(false)} />
      <BeastStageCard
        track={member.track}
        hsk1Progress={hsk1Progress}
        onReview={() => {
          if (course === 'hsk1' && onHsk1Recall) onHsk1Recall()
          else onReview()
        }}
        onLearn={() => {
          if (course === 'hsk1') {
            if (hsk1Progress.tonesPassed < 7) {
              onHsk1Tones?.('tones')
            } else if (hsk1Progress.pinyinPassed < 6) {
              onHsk1Tones?.('pinyin')
            } else if (hsk1Progress.strokesPassed < 5) {
              onHsk1Tones?.('strokes')
            } else {
              const target = nextPlayableHsk1Unit(hsk1Progress)
              onHsk1Unit?.(target.unit, target.node)
            }
            return
          }
          if (course === 'hsk4a') onSession(lesson.lesson, next.node)
          else onBrowse()
        }}
        onExam={() => {
          if (course === 'hsk1') onHsk1Tones?.('tones')
          else onJiaochengMidterm(course === 'jiaocheng' ? 'jiaocheng' : 'hsk4a', 'mock')
        }}
      />
      <div className="home-float-strip" role="toolbar" aria-label="Aksi cepat belajar">
        {(course === 'hsk4a' || course === 'jiaocheng') && (
          <button
            type="button"
            className="home-float-pill home-float-pill-accent"
            onClick={() => onJiaochengMidterm(course === 'jiaocheng' ? 'jiaocheng' : 'hsk4a', 'mock')}
          >
            📝 Simulator
          </button>
        )}
        {course === 'hsk1' && (
          <>
            <button
              type="button"
              className="home-float-pill home-float-pill-accent"
              onClick={() => onHsk1Tones?.('tones')}
            >
              🎵 Pondasi
            </button>
            <button
              type="button"
              className="home-float-pill"
              onClick={() => onHsk1Tones?.('strokes')}
            >
              ✍️ Goresan
            </button>
          </>
        )}
        {course === 'hsk4a' && (
          <SkipLevelControl
            compact
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
        )}
        <button
          type="button"
          className="home-float-pill"
          onClick={() => {
            if (course === 'hsk1' && onHsk1Recall) onHsk1Recall()
            else onReview()
          }}
        >
          🔁 Recall
        </button>
        {onProgress && (
          <button type="button" className="home-float-pill" onClick={onProgress}>
            📊 Stats
          </button>
        )}
        <button type="button" className="home-float-pill" onClick={() => setCoupleSheetOpen(true)}>
          💕 Berdua
        </button>
        <button type="button" className="home-float-pill" onClick={onBrowse}>
          📚 {t('Materials')}
        </button>
        {onOpenOnboarding && (
          <button type="button" className="home-float-pill" onClick={onOpenOnboarding}>
            ❓ Panduan
          </button>
        )}
      </div>
      {course === 'jiayin' ? (
        <JiayinPath onPlay={onJiayinSession} />
      ) : course === 'hsk1' ? (
        <Hsk1HomePath
          onOpenUnit={(unit, node) => onHsk1Unit?.(unit, node)}
          onOpenToneLab={(track) => onHsk1Tones?.(track)}
          onOpenRecall={onHsk1Recall}
        />
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
      )}
      </div>
      <div className="home-col-side">
      {hsk4Surface && <MemoryHorizon onReview={onReview} onPlacement={onPlacement} />}
      <StudyMusic />
      <div className="home-shortcuts">
        <button type="button" className="home-dock-button" onClick={onBrowse}><span>{t('Browse materials')}</span><span aria-hidden>→</span></button>
        {course === 'hsk1' ? (
          <button type="button" className="home-dock-button" onClick={() => onHsk1Recall?.()}>
            <span>🔁 Recall FSRS HSK 1</span>
            <span aria-hidden>→</span>
          </button>
        ) : (
          hsk4Surface && (
            <button type="button" className="home-dock-button" data-home-trail onClick={onTrail}>
              <span>{t('My words')}{recentWords.length > 0 && <small lang="zh-CN">{recentWords.join(' · ')}</small>}</span>
              <span aria-hidden>→</span>
            </button>
          )
        )}
      </div>
      <InstallCard variant="home" />
      </div>
    </div>
  )
}
