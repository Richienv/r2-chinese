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

/** Separate from HSK / Kerja / Jiaocheng / Magang / Interview progress keys so old saves stay untouched. */
const COURSE_KEY = 'yulu.course.v1'

export type CourseId = 'hsk4a' | 'kerja' | 'jiaocheng' | 'magang' | 'interview'

export const COURSE_ORDER: CourseId[] = ['hsk4a', 'kerja', 'jiaocheng', 'magang', 'interview']

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
    title: '1000 words',
    titleZh: '把话说清楚，把事情做好。',
    blurb: 'Workplace Mandarin for HR and management',
  },
  jiaocheng: {
    id: 'jiaocheng',
    title: 'Jiaocheng 2',
    titleZh: '汉语教程 · 第二册',
    blurb: 'Book 2, part 1 and part 2',
  },
  magang: {
    id: 'magang',
    title: 'Magang AI',
    titleZh: 'Magang AI',
    blurb: 'Internship book · study it slowly',
  },
  interview: {
    id: 'interview',
    title: '总办',
    titleZh: '总办',
    blurb: 'Tonight · 18:00',
  },
}

function readCourse(): CourseId {
  try {
    const raw = localStorage.getItem(COURSE_KEY)
    if (
      raw === 'kerja' ||
      raw === 'hsk4a' ||
      raw === 'jiaocheng' ||
      raw === 'magang' ||
      raw === 'interview'
    ) {
      return raw
    }
  } catch {
    /* ignore */
  }
  return 'hsk4a'
}

interface CourseStore {
  course: CourseId
  /** False until the learner picks a course on the opening page. */
  entered: boolean
  setCourse: (id: CourseId) => void
  leaveCourse: () => void
}

const Ctx = createContext<CourseStore | null>(null)

export function CourseProvider({ children }: { children: ReactNode }) {
  const [course, setCourseState] = useState<CourseId>(() => readCourse())
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(COURSE_KEY, course)
    } catch {
      /* ignore */
    }
  }, [course])

  const setCourse = useCallback((id: CourseId) => {
    setCourseState(id)
    setEntered(true)
  }, [])

  const leaveCourse = useCallback(() => {
    setEntered(false)
  }, [])

  const value = useMemo(
    () => ({ course, entered, setCourse, leaveCourse }),
    [course, entered, setCourse, leaveCourse],
  )
  return createElement(Ctx.Provider, { value }, children)
}

export function useCourse(): CourseStore {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCourse outside CourseProvider')
  return ctx
}
