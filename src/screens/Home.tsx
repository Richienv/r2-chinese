import { useAuth } from '../auth/AuthProvider'
import { Flame } from '../components/Flame'
import { COURSE_META, useCourse, type CourseId } from '../lib/course'
import { lessons } from '../lib/content'
import { dueCards } from '../lib/srs'
import { nextPlayable } from '../lib/wordsSession'
import { KerjaHomePath } from './Kerja'
import { LessonPath } from './Learn'
import { useStore, type PathNode } from '../store/store'

export function Home({
  onSession,
  onLesson,
  onReview,
  onKerjaSession,
}: {
  onSession: (lesson: number, node: PathNode) => void
  onLesson: (lesson: number) => void
  onReview: () => void
  onKerjaSession: (chapter: number, node: PathNode) => void
}) {
  const s = useStore()
  const { course, setCourse } = useCourse()
  const { user } = useAuth()
  const name = user?.email ? user.email.split('@')[0] : 'Learner'
  const next = nextPlayable(s.isNodeDone)
  const reviewsDue = dueCards(s.cardList).length
  const lesson = lessons.find((l) => l.lesson === next.lesson) ?? lessons[0]
  const hour = new Date().getHours()
  const greeting = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className="home-page">
      <header className="home-bar">
        <div className="avatar">语</div>
        <div className="home-who">
          <p className="kicker-ink zh" lang="zh-CN">
            {greeting}
          </p>
          <p className="home-name zh">{name}</p>
        </div>
        <div className="home-streak" aria-label={`${s.streak} day streak`}>
          <Flame size={22} />
          <span>{s.streak}</span>
        </div>
      </header>

      <div className="course-switch" role="group" aria-label="Course">
        {(Object.keys(COURSE_META) as CourseId[]).map((id) => {
          const meta = COURSE_META[id]
          const on = course === id
          return (
            <button
              key={id}
              type="button"
              className="course-card tap44"
              data-on={on}
              aria-pressed={on}
              onClick={() => setCourse(id)}
            >
              <span className="course-card-title">{meta.title}</span>
              <span className="course-card-zh zh" lang="zh-CN">
                {meta.titleZh}
              </span>
              <span className="course-card-blurb">{meta.blurb}</span>
            </button>
          )
        })}
      </div>

      {reviewsDue > 0 && (
        <button type="button" className="home-review tap44" onClick={onReview}>
          <span className="home-review-k">Review</span>
          <span className="home-review-n">{reviewsDue} due</span>
        </button>
      )}

      {course === 'kerja' ? (
        <KerjaHomePath onPlay={onKerjaSession} />
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
