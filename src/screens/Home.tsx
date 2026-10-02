import { CourseBack, CourseGate } from '../components/CourseChooser'
import { useCourse } from '../lib/course'
import { lessons } from '../lib/content'
import { dueCards } from '../lib/srs'
import { nextPlayable } from '../lib/wordsSession'
import { JiaochengHomePath } from './Jiaocheng'
import { KerjaHomePath } from './Kerja'
import { InterviewHomePath } from './Interview'
import { MagangHomePath } from './Magang'
import { LessonPath } from './Learn'
import { useStore, type PathNode } from '../store/store'

export function Home({
  onSession,
  onLesson,
  onReview,
  onKerjaSession,
  onJiaochengSession,
  onMagangSession,
  onInterviewSession,
}: {
  onSession: (lesson: number, node: PathNode) => void
  onLesson: (lesson: number) => void
  onReview: () => void
  onKerjaSession: (chapter: number, node: PathNode) => void
  onJiaochengSession: (lesson: number, node: PathNode) => void
  onMagangSession: (chapter: number, node: string) => void
  onInterviewSession: (chapter: number, node: string) => void
}) {
  const s = useStore()
  const { course, entered } = useCourse()
  const next = nextPlayable(s.isNodeDone)
  const reviewsDue = dueCards(s.cardList).length
  const lesson = lessons.find((l) => l.lesson === next.lesson) ?? lessons[0]

  if (!entered) {
    return (
      <div className="home-page">
        <CourseGate />
      </div>
    )
  }

  return (
    <div className="home-page">
      <CourseBack />

      {course === 'kerja' ? (
        <KerjaHomePath onPlay={onKerjaSession} />
      ) : course === 'jiaocheng' ? (
        <JiaochengHomePath onPlay={onJiaochengSession} />
      ) : course === 'magang' ? (
        <MagangHomePath onPlay={onMagangSession} />
      ) : course === 'interview' ? (
        <InterviewHomePath onPlay={onInterviewSession} />
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

      {reviewsDue > 0 && (
        <button type="button" className="home-review tap44" onClick={onReview}>
          <span className="home-review-k">Review</span>
          <span className="home-review-n">{reviewsDue} due</span>
        </button>
      )}
    </div>
  )
}
