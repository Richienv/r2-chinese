import { COURSE_META, COURSE_ORDER, useCourse, type CourseId } from '../lib/course'

/** Opening page: only the three courses. The path stays behind this until one is chosen. */
export function CourseGate() {
  const { setCourse } = useCourse()
  return (
    <div className="course-gate">
      <p className="kicker">Choose a course</p>
      <h1 className="course-gate-title">What do you want to learn?</h1>
      <div className="course-gate-list" role="group" aria-label="Course">
        {COURSE_ORDER.map((id: CourseId) => {
          const meta = COURSE_META[id]
          return (
            <button key={id} type="button" className="course-gate-card tap44" onClick={() => setCourse(id)}>
              <span className="course-gate-name">{meta.title}</span>
              <span className="course-gate-zh zh" lang="zh-CN">
                {meta.titleZh}
              </span>
              <span className="course-gate-blurb">{meta.blurb}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CourseBack() {
  const { leaveCourse } = useCourse()
  return (
    <button type="button" className="course-back tap44" onClick={leaveCourse}>
      Courses
    </button>
  )
}
