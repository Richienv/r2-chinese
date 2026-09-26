import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** Separate from HSK progress (`yulu.hsk4a.v1`) so old saves stay untouched. */
const COURSE_KEY = 'yulu.course.v1'

export type CourseId = 'hsk4a' | 'kerja'

export const COURSE_META: Record<
  CourseId,
  { id: CourseId; title: string; titleZh: string; blurb: string }
> = {
  hsk4a: {
    id: 'hsk4a',
    title: 'HSK 4',
    titleZh: '标准教程 HSK 4上',
    blurb: 'Textbook path · 课文 units',
  },
  kerja: {
    id: 'kerja',
    title: 'Mandarin Kerja Nyata',
    titleZh: '把话说清楚，把事情做好。',
    blurb: 'HR & Manajemen · Edisi 2026',
  },
}

function readCourse(): CourseId {
  try {
    const raw = localStorage.getItem(COURSE_KEY)
    if (raw === 'kerja' || raw === 'hsk4a') return raw
  } catch {
    /* ignore */
  }
  return 'hsk4a'
}

interface CourseStore {
  course: CourseId
  setCourse: (id: CourseId) => void
}

const Ctx = createContext<CourseStore | null>(null)

export function CourseProvider({ children }: { children: ReactNode }) {
  const [course, setCourseState] = useState<CourseId>(() => readCourse())

  useEffect(() => {
    try {
      localStorage.setItem(COURSE_KEY, course)
    } catch {
      /* ignore */
    }
  }, [course])

  const setCourse = useCallback((id: CourseId) => {
    setCourseState(id)
  }, [])

  const value = useMemo(() => ({ course, setCourse }), [course, setCourse])
  return createElement(Ctx.Provider, { value }, children)
}

export function useCourse(): CourseStore {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCourse outside CourseProvider')
  return ctx
}
