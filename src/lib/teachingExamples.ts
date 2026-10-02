import { getLesson, hasWordToken, type Example } from './content'
import type { CourseId } from './course'
import { getKerjaChapter } from './kerja'
import { getJiaochengLesson } from './jiaocheng'

/** Existing learning trails namespace non-HSK lesson ids; source getters use local unit numbers. */
function sourceUnit(course: CourseId, lesson: number): number {
  if (course === 'kerja' && lesson >= 1000 && lesson < 3000) return lesson - 1000
  if (course === 'jiaocheng' && lesson >= 3000) return lesson - 3000
  return lesson
}

/** Keep the supplied curriculum example first; additional lines come only from the active unit. */
export function teachingExamples(course: CourseId, lesson: number, word: string, primary: Example | null): Example[] {
  const examples: Example[] = []
  const seen = new Set<string>()
  const add = (candidate: Example | null | undefined, supplied = false) => {
    const key = candidate?.zh?.trim()
    if (!candidate || !key || seen.has(key) || examples.length >= 4) return
    if (!supplied && !hasWordToken(key, word)) return
    seen.add(key)
    // Keep the source's text, pinyin and translation exactly as supplied.
    examples.push({ zh: candidate.zh, pinyin: candidate.pinyin ?? '', en: candidate.en ?? '' })
  }
  add(primary, true)
  const unit = sourceUnit(course, lesson)
  if (course === 'hsk4a') {
    try {
      const source = getLesson(unit)
      source.texts.forEach((text) => text.lines.forEach((line) => add(line)))
      source.grammar.forEach((grammar) => grammar.examples.forEach((example) => add(example)))
      source.extras.same_char.forEach((note) => note.examples.forEach((example) => add(example)))
    } catch { /* An unavailable unit adds no substitute curriculum examples. */ }
  } else if (course === 'kerja' || course === 'jiaocheng') {
    const source = course === 'kerja' ? getKerjaChapter(unit) : getJiaochengLesson(unit)
    source?.words.forEach((entry) => add(entry.example))
    source?.dialogues.forEach((text) => text.lines.forEach((line) => add(line)))
    source?.notes.forEach((note) => add(note.example))
  }
  return examples
}
