import { CourseChooser } from '../components/CourseChooser'
import { useCourse } from '../lib/course'
import { lessons } from '../lib/content'
import { dueCards } from '../lib/srs'
import { nextPlayable } from '../lib/wordsSession'
import { JiaochengHomePath } from './Jiaocheng'
import { KerjaHomePath } from './Kerja'
import { LessonPath } from './Learn'
import { useStore, type PathNode } from '../store/store'

export function Home({
  onSession,
  onLesson,
  onReview,
  onKerjaSession,
  onJiaochengSession,
}: {
  onSession: (lesson: number, node: PathNode) => void
  onLesson: (lesson: number) => void
  onReview: () => void
  onKerjaSession: (chapter: number, node: PathNode) => void
  onJiaochengSession: (lesson: number, node: PathNode) => void
}) {
  const s = useStore()
  const { course } = useCourse()
  const next = nextPlayable(s.isNodeDone)
  const reviewsDue = dueCards(s.cardList).length
  const lesson = lessons.find((l) => l.lesson === next.lesson) ?? lessons[0]

  return (
    <div className="home-page">
      <CourseChooser />

      {course === 'kerja' ? (
        <KerjaHomePath onPlay={onKerjaSession} />
      ) : course === 'jiaocheng' ? (
        <JiaochengHomePath onPlay={onJiaochengSession} />
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
