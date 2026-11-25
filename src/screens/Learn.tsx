import { lazy } from 'react'
import { CourseBack, CourseGate } from '../components/CourseChooser'
import { LearningPath } from '../components/LearningPath'
import { HskPracticeEntry } from '../components/HskPracticeEntry'
import { SkipLevelControl } from '../components/SkipLevelModal'
import { COURSE_META, useCourse } from '../lib/course'
import { t } from '../lib/i18n'
import type { ExamCourse, ExamMode } from '../lib/jiaochengMidterm'
import { lessons, teachableVocab, textNodeIndex, textSitting } from '../lib/content'
import {
  NODE_LABEL,
  PATH_NODES,
  isLessonReached,
  isNodePlayable,
  nextPlayable,
  nodeCaption,
} from '../lib/wordsSession'
import { useStore, type PathNode } from '../store/store'
const JiaochengLearn = lazy(() => import('./Jiaocheng').then((m) => ({ default: m.JiaochengLearn })))
const KerjaLearn = lazy(() => import('./Kerja').then((m) => ({ default: m.KerjaLearn })))
const InterviewLearn = lazy(() => import('./Interview').then((m) => ({ default: m.InterviewLearn })))
const MagangLearn = lazy(() => import('./Magang').then((m) => ({ default: m.MagangLearn })))
const BooksLearn = lazy(() => import('./Books').then((m) => ({ default: m.BooksLearn })))
import type { JiayinOpen } from './Jiayin'
const JiayinPath = lazy(() => import('./Jiayin').then((m) => ({ default: m.JiayinPath })))

export function LessonPath({
  lesson,
  current,
  nodeDone,
  onLesson,
  onPlay,
  fill,
  skippedLessons,
  unlockedLesson,
  onUnskip,
}: {
  lesson: (typeof lessons)[number]
  current: { lesson: number; node: PathNode }
  nodeDone: (lesson: number, node: PathNode) => boolean
  onLesson?: (lesson: number) => void
  onPlay?: (lesson: number, node: PathNode) => void
  fill?: boolean
  skippedLessons?: readonly number[]
  unlockedLesson?: number
  onUnskip?: (lesson: number) => void
}) {
  const skipOpts = { skippedLessons, unlockedLesson }
  const lessonSkipped = !!skippedLessons?.includes(lesson.lesson)
  const lessonOpen = isLessonReached(lesson.lesson, nodeDone, skipOpts)
  return (
    <LearningPath
      fill={fill}
      kicker={`第 ${lesson.lesson} 课 · HSK 4`}
      title={lesson.title.zh}
      subtitle={lesson.title.en}
      open={lessonOpen}
      skipped={lessonSkipped}
      onUnskip={lessonSkipped && onUnskip ? () => onUnskip(lesson.lesson) : undefined}
      position={{ index: lessons.indexOf(lesson) + 1, total: lessons.length, label: t('Lesson {n} of {total}', { n: lessons.indexOf(lesson) + 1, total: lessons.length }) }}
      onOpen={onLesson ? () => onLesson(lesson.lesson) : undefined}
      items={PATH_NODES.map((node) => {
        const done = nodeDone(lesson.lesson, node)
        const on = current.lesson === lesson.lesson && current.node === node
        const caption = nodeCaption(lesson.lesson, node)
        const sitting = node !== 'wrap' ? textSitting(lesson, textNodeIndex(node)) : undefined
        const title =
          sitting?.text.heading_zh ||
          sitting?.text.heading_en ||
          (node === 'wrap' ? `${lesson.title.zh} · 整理` : lesson.title.zh)
        const english = sitting?.text.heading_en
        return {
          id: node,
          label: NODE_LABEL[node].zh,
          title,
          subtitle:
            english && english !== title
              ? english
              : node === 'wrap'
                ? t('Recall · connect · use')
                : caption.en,
          state: done ? ('done' as const) : on ? ('current' as const) : lessonSkipped ? ('skipped' as const) : ('locked' as const),
          playable: isNodePlayable(lesson.lesson, node, nodeDone, skipOpts),
          onSelect: () => onPlay?.(lesson.lesson, node),
        }
      })}
    />
  )
}

export function Learn({
  onLesson,
  onPlay,
  onKerjaPlay,
  onJiaochengPlay,
  onJiaochengMidterm,
  onMagangPlay,
  onInterviewPlay,
  onBooksPlay,
  onJiayinPlay,
  onListening,
  onCompose,
  isNodeDone,
}: {
  onLesson: (lesson: number) => void
  onVocab?: () => void
  onPlay?: (lesson: number, node: PathNode) => void
  onKerjaPlay?: (chapter: number, node: PathNode) => void
  onJiaochengPlay?: (lesson: number, node: PathNode) => void
  onJiaochengMidterm?: (course?: ExamCourse, mode?: ExamMode) => void
  onMagangPlay?: (chapter: number, node: string) => void
  onInterviewPlay?: (chapter: number, node: string) => void
  onBooksPlay?: (part: number, index: number) => void
  onJiayinPlay: JiayinOpen
  onListening: () => void
  onCompose: () => void
  isNodeDone?: (lesson: number, node: PathNode) => boolean
}) {
  const store = useStore()
  const { course, entered } = useCourse()
  const nodeDone = isNodeDone ?? store.isNodeDone
  const hskSkipOpts = { skippedLessons: store.skippedLessons, unlockedLesson: store.unlockedLesson }
  const current = nextPlayable(nodeDone, hskSkipOpts)

  if (!entered) {
    return (
      <div className="path-page path-alive">
        <CourseGate />
      </div>
    )
  }

  return (
    <div className="path-page path-alive">
      <CourseBack />
      <header className="page-heading"><p>{COURSE_META[course].title}</p><h1>{t('Materials')}</h1><span>{t('Lessons and practice, in one place.')}</span></header>
      {course === 'hsk4a' && <HskPracticeEntry onListen={onListening} onCompose={onCompose} onExam={onJiaochengMidterm} />}
      {course === 'jiayin' ? (
        <JiayinPath onPlay={onJiayinPlay} />
      ) : course === 'kerja' ? (
        <KerjaLearn onPlay={(chapter, node) => onKerjaPlay?.(chapter, node)} />
      ) : course === 'jiaocheng' ? (
        <JiaochengLearn onPlay={(lesson, node) => onJiaochengPlay?.(lesson, node)} onMidterm={onJiaochengMidterm} />
      ) : course === 'magang' ? (
        <MagangLearn onPlay={(chapter, node) => onMagangPlay?.(chapter, node)} />
      ) : course === 'interview' ? (
        <InterviewLearn onPlay={(chapter, node) => onInterviewPlay?.(chapter, node)} />
      ) : course === 'books' ? (
        <BooksLearn onPlay={(part, index) => onBooksPlay?.(part, index)} />
      ) : (
        <>
          <SkipLevelControl
            courseLabel="HSK 4"
            currentLesson={current.lesson}
            options={lessons.map((l) => {
              const words = teachableVocab(l)
              return {
                lesson: l.lesson,
                label: t('Lesson {n}', { n: l.lesson }),
                title: l.title.zh || l.title.en,
                wordCount: words.length,
                done: nodeDone(l.lesson, 'wrap'),
                skipped: store.skippedLessons.includes(l.lesson),
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
              store.skipToHskLesson(target, specs)
            }}
          />
          {lessons.map((lesson) => (
            <LessonPath
              key={lesson.lesson}
              lesson={lesson}
              current={current}
              nodeDone={nodeDone}
              skippedLessons={store.skippedLessons}
              unlockedLesson={store.unlockedLesson}
              onUnskip={(lessonNum) => store.unskipHskLesson(lessonNum)}
              onLesson={onLesson}
              onPlay={onPlay}
            />
          ))}
        </>
      )}
    </div>
  )
}
