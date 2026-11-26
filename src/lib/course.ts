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
import { t } from './i18n.ts'

/** Separate from HSK / Kerja / Jiaocheng / Magang / Interview / Books progress keys so old saves stay untouched. */
const COURSE_KEY = 'yulu.course.v1'

export type CourseId = 'hsk4a' | 'kerja' | 'jiaocheng' | 'magang' | 'interview' | 'books' | 'jiayin'

export const COURSE_ORDER: CourseId[] = ['hsk4a', 'jiaocheng', 'kerja']

export const COURSE_META: Record<CourseId, { id: CourseId; title: string; titleZh: string; blurb: string }> =
  {
    hsk4a: {
      id: 'hsk4a',
      title: 'HSK 4',
      titleZh: '标准教程 HSK 4上',
      blurb: t('Textbook path · {term} units', { term: '课文' }),
    },
    kerja: {
      id: 'kerja',
      title: t('1000 words'),
      titleZh: '把话说清楚，把事情做好。',
      blurb: t('Workplace Mandarin for HR and management'),
    },
    jiaocheng: {
      id: 'jiaocheng',
      title: 'Jiaocheng 2',
      titleZh: '汉语教程 · 第二册',
      blurb: t('Book 2, part 1 and part 2'),
    },
    magang: {
      id: 'magang',
      title: 'Magang AI',
      titleZh: 'Magang AI',
      blurb: t('Internship book · study it slowly'),
    },
    interview: {
      id: 'interview',
      title: '总办',
      titleZh: '总办',
      blurb: t('Tonight · 18:00'),
    },
    books: {
      id: 'books',
      title: t('Books'),
      titleZh: 'Books',
      blurb: t('Five books, one idea at a time'),
    },
    jiayin: {
      id: 'jiayin',
      title: 'Wawancara Jiayin',
      titleZh: '嘉银面试',
      blurb: 'Global MT · English + Indonesia · Mandarin opsional',
    },
  }

function readCourse(): CourseId {
  try {
    const raw = localStorage.getItem(COURSE_KEY)
    if (raw === 'kerja' || raw === 'hsk4a' || raw === 'jiaocheng' || raw === 'books') {
      return raw
    }
  } catch {
    /* ignore */
  }
  return 'hsk4a'
}

const ENTERED_KEY = 'yulu.course-entered.v1'

/** True once the learner has picked a course themselves (the default course is saved on first load). */
function hasSavedCourse(): boolean {
  try {
    return localStorage.getItem(ENTERED_KEY) === '1'
  } catch {
    return false
  }
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
  // A returning learner opens straight on their last course: one tap less every morning.
  const [entered, setEntered] = useState(() => hasSavedCourse())

  useEffect(() => {
    try {
      localStorage.setItem(COURSE_KEY, course)
    } catch {
      /* ignore */
    }
  }, [course])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onHydrated = () => {
      setCourseState(readCourse())
      setEntered(hasSavedCourse())
    }
    window.addEventListener('yulu:cloud-hydrated', onHydrated)
    return () => window.removeEventListener('yulu:cloud-hydrated', onHydrated)
  }, [])

  const setCourse = useCallback((id: CourseId) => {
    setCourseState(id)
    setEntered(true)
    try {
      localStorage.setItem(ENTERED_KEY, '1')
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('yulu:local-progress'))
    }
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
