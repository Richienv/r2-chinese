import { CourseBack, CourseGate } from '../components/CourseChooser'
import { LearningPath } from '../components/LearningPath'
import { HskPracticeEntry } from '../components/HskPracticeEntry'
import { useCourse } from '../lib/course'
import { lessons, textNodeIndex, textSitting } from '../lib/content'
import { NODE_LABEL, PATH_NODES, isLessonReached, isNodePlayable, nextPlayable, nodeCaption } from '../lib/wordsSession'
import { useStore, type PathNode } from '../store/store'
import { JiaochengLearn } from './Jiaocheng'
import { KerjaLearn } from './Kerja'
import { InterviewLearn } from './Interview'
import { MagangLearn } from './Magang'
import { BooksLearn } from './Books'

export function LessonPath({
  lesson,
  current,
  nodeDone,
  onLesson,
  onPlay,
  fill,
}: {
  lesson: (typeof lessons)[number]
  current: { lesson: number; node: PathNode }
  nodeDone: (lesson: number, node: PathNode) => boolean
  onLesson?: (lesson: number) => void
  onPlay?: (lesson: number, node: PathNode) => void
  fill?: boolean
}) {
  const lessonOpen = isLessonReached(lesson.lesson, nodeDone)
  return (
    <LearningPath
      fill={fill}
      kicker={`第 ${lesson.lesson} 课 · HSK 4`}
      title={lesson.title.zh}
      subtitle={lesson.title.en}
      open={lessonOpen}
      onOpen={onLesson ? () => onLesson(lesson.lesson) : undefined}
      items={PATH_NODES.map(node => {
        const done = nodeDone(lesson.lesson, node)
        const on = current.lesson === lesson.lesson && current.node === node
        const caption = nodeCaption(lesson.lesson, node)
        const sitting = node !== 'wrap' ? textSitting(lesson, textNodeIndex(node)) : undefined
        const title = sitting?.text.heading_zh || sitting?.text.heading_en || (node === 'wrap' ? `${lesson.title.zh} · 整理` : lesson.title.zh)
        const english = sitting?.text.heading_en
        return {
          id: node,
          label: NODE_LABEL[node].zh,
          title,
          subtitle: english && english !== title ? english : node === 'wrap' ? 'Recall · connect · use' : caption.en,
          state: done ? 'done' as const : on ? 'current' as const : 'locked' as const,
          playable: isNodePlayable(lesson.lesson, node, nodeDone),
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
  onMagangPlay,
  onInterviewPlay,
  onBooksPlay,
  onListening,
  onCompose,
  isNodeDone,
}: {
  onLesson: (lesson: number) => void
  onVocab?: () => void
  onPlay?: (lesson: number, node: PathNode) => void
  onKerjaPlay?: (chapter: number, node: PathNode) => void
  onJiaochengPlay?: (lesson: number, node: PathNode) => void
  onMagangPlay?: (chapter: number, node: string) => void
  onInterviewPlay?: (chapter: number, node: string) => void
  onBooksPlay?: (part: number, index: number) => void
  onListening: () => void
  onCompose: () => void
  isNodeDone?: (lesson: number, node: PathNode) => boolean
}) {
  const store = useStore()
  const { course, entered } = useCourse()
  const nodeDone = isNodeDone ?? store.isNodeDone
  const current = nextPlayable(nodeDone)

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
      {course === 'hsk4a' && <HskPracticeEntry onListen={onListening} onCompose={onCompose} />}
      {course === 'kerja' ? (
        <KerjaLearn onPlay={(chapter, node) => onKerjaPlay?.(chapter, node)} />
      ) : course === 'jiaocheng' ? (
        <JiaochengLearn onPlay={(lesson, node) => onJiaochengPlay?.(lesson, node)} />
      ) : course === 'magang' ? (
        <MagangLearn onPlay={(chapter, node) => onMagangPlay?.(chapter, node)} />
      ) : course === 'interview' ? (
        <InterviewLearn onPlay={(chapter, node) => onInterviewPlay?.(chapter, node)} />
      ) : course === 'books' ? (
        <BooksLearn onPlay={(part, index) => onBooksPlay?.(part, index)} />
      ) : (
        lessons.map((lesson) => (
          <LessonPath
            key={lesson.lesson}
            lesson={lesson}
            current={current}
            nodeDone={nodeDone}
            onLesson={onLesson}
            onPlay={onPlay}
          />
        ))
      )}
    </div>
  )
}
