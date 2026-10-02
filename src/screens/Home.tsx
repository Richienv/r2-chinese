import { CourseBack, CourseGate } from '../components/CourseChooser'
import { COURSE_META, useCourse } from '../lib/course'
import { lessons } from '../lib/content'
import { dueCards } from '../lib/srs'
import { nextPlayable } from '../lib/wordsSession'
import { JiaochengHomePath } from './Jiaocheng'
import { KerjaHomePath } from './Kerja'
import { InterviewHomePath } from './Interview'
import { MagangHomePath } from './Magang'
import { BooksHomePath } from './Books'
import { LessonPath } from './Learn'
import { useStore, type PathNode } from '../store/store'
import '../styles/home-alive.css'

export function Home({
  onSession,
  onLesson,
  onReview,
  onTrail,
  onKerjaSession,
  onJiaochengSession,
  onMagangSession,
  onInterviewSession,
  onBooksSession,
}: {
  onSession: (lesson: number, node: PathNode) => void
  onLesson: (lesson: number) => void
  onReview: () => void
  onTrail: () => void
  onKerjaSession: (chapter: number, node: PathNode) => void
  onJiaochengSession: (lesson: number, node: PathNode) => void
  onMagangSession: (chapter: number, node: string) => void
  onInterviewSession: (chapter: number, node: string) => void
  onBooksSession: (part: number, index: number) => void
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
        <CourseGate />
      </div>
    )
  }

  return (
    <div className="home-page home-alive">
      <div className="home-topbar"><CourseBack /><h1>{COURSE_META[course].title}</h1></div>
      {course !== 'books' && (languageCourse || reviewsDue > 0) && (
        <div className="home-recall-dock" data-home-dock>
          {languageCourse && <button type="button" className="home-dock-button home-dock-trail" data-home-trail onClick={onTrail}>
            <span>Word trail</span>
            {recentWords.length > 0 && <small lang="zh-CN">{recentWords.join(' · ')}</small>}
            <span className="home-dock-arrow" aria-hidden>↗</span>
          </button>}
          {reviewsDue > 0 && <button type="button" className="home-dock-button home-dock-review" data-home-review onClick={onReview}>
            <span>{languageCourse ? 'Review' : 'Mandarin review'}</span><small>{reviewsDue} due</small><span className="home-dock-arrow" aria-hidden>→</span>
          </button>}
        </div>
      )}

      {course === 'kerja' ? (
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
