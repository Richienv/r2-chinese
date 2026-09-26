import { COURSE_META, COURSE_ORDER, useCourse, type CourseId } from '../lib/course'

/** Exactly three course choices — shared by Home and Learn above the path. */
export function CourseChooser() {
  const { course, setCourse } = useCourse()
  return (
    <div className="course-switch" role="group" aria-label="Course">
      {COURSE_ORDER.map((id: CourseId) => {
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
  )
}
