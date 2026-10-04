import type { Lesson, LessonText, Vocab } from './types'
import type { MasteryRecord } from './mastery'

export interface ListeningScript {
  id: string
  lesson: number
  lessonTitle: string
  title: string
  text: LessonText
}
export type ListeningRepeat = 'off' | 'script' | 'all'

/** References the source verbatim, including passages after the dialogues. */
export function listeningScripts(lessons: Lesson[], from = 1, through = 5): ListeningScript[] {
  return lessons.filter((lesson) => lesson.lesson >= from && lesson.lesson <= through).flatMap((lesson) => lesson.texts.filter((text) => text.lines.some((line) => line.zh.trim())).map((text, index) => ({
    id: `hsk:${lesson.lesson}:${index}`,
    lesson: lesson.lesson,
    lessonTitle: lesson.title.zh,
    title: text.heading_en || text.heading_zh || text.label,
    text,
  })))
}

export function nextListeningScript(index: number, length: number, automatic: boolean, repeat: ListeningRepeat): number | null {
  if (length < 1 || index < 0 || index >= length) return null
  if (repeat === 'script') return index
  if (!automatic) return null
  if (index + 1 < length) return index + 1
  return repeat === 'all' ? 0 : null
}

export interface PracticeWord extends Vocab { lesson: number }

/** Only words actually encountered or drilled, drawn across the HSK course. */
export function learnedHskWords(lessons: Lesson[], trail: string[], cards: string[]): PracticeWord[] {
  const known = new Set([...trail, ...cards])
  const unique = new Map<string, PracticeWord>()
  for (const lesson of lessons) for (const word of lesson.vocab) {
    if (known.has(word.zh) && !unique.has(word.zh)) unique.set(word.zh, { ...word, lesson: lesson.lesson })
  }
  return [...unique.values()]
}

/** Rotate through the whole pool, while favoring hard words and other lessons. */
export function compositionBundle(pool: PracticeWord[], mastery: Record<string, MasteryRecord>, round = 0, count = 3): PracticeWord[] {
  if (!pool.length) return []
  const sorted = [...pool].sort((a, b) => (mastery[a.zh]?.lastPractice ?? 0) - (mastery[b.zh]?.lastPractice ?? 0) || a.lesson - b.lesson || a.zh.localeCompare(b.zh))
  const offset = ((round % sorted.length) + sorted.length) % sorted.length
  const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)]
  const hard = rotated.find((word) => mastery[word.zh]?.state === 'hard')
  const chosen: PracticeWord[] = [hard ?? rotated[0]]
  while (chosen.length < Math.min(count, rotated.length)) {
    const available = rotated.filter((word) => !chosen.some((pick) => pick.zh === word.zh))
    const different = available.find((word) => !chosen.some((pick) => pick.lesson === word.lesson))
    chosen.push(different ?? available[0])
  }
  return chosen
}

/** Compounds count as whole vocabulary: 好 does not get credit inside 爱好. */
export function compositionCoverage(response: string, words: string[], segments: string[]): { used: string[]; missing: string[] } {
  const target = [...new Set(words)]
  const used = target.filter((word) => {
    if (segments.includes(word)) return true
    // Fixed multi-word expressions may span natural word boundaries. Never
    // remove punctuation here, which could fabricate a word across sentences.
    if (word.length < 2 || !response.includes(word)) return false
    let start = 0
    for (let i = 0; i < segments.length; i++) {
      let phrase = ''
      for (let j = i; j < segments.length && phrase.length < word.length; j++) {
        phrase += segments[j]
        if (phrase === word && response.slice(start, start + word.length) === word) return true
      }
      start += segments[i].length
    }
    return false
  })
  return { used, missing: target.filter((word) => !used.includes(word)) }
}
