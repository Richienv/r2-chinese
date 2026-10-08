import type { Lesson } from './types.ts'

/** A sentence from the book, with the target words it contains. */
export interface Hint {
  zh: string
  pinyin: string
  en: string
  /** Which of the asked-for words this sentence uses, in the order they were asked for. */
  words: string[]
  source: 'dialogue' | 'passage' | 'example'
}

export type HintLessons = ReadonlyArray<Pick<Lesson, 'texts' | 'grammar' | 'extras'>>

/** Longer lines are a wall of text, not a model to copy from. The shorter line always wins when there is a choice. */
export const MAX_HINT_LENGTH = 60

const hanzi = (text: string) => [...text.replace(/[^㐀-鿿]/gu, '')].length

export interface HintLine { zh: string; pinyin: string; en: string }

/**
 * Sentences and dialogue lines from the book that use the words the learner has to write with. Pure: the
 * caller says what "uses a word" means (whole word, not a piece of a longer one) and gets back at most `limit`.
 *
 * Preference: a line that uses several of the words together first, then every word shown at least once,
 * then the next best line of each word in turn so one word does not crowd out the others. Dialogue comes before
 * a reading passage before a grammar example, and the shorter line wins when they are otherwise equal.
 * `fallback` supplies a line for a word that no sentence in the lessons uses.
 */
export function writingHints(
  words: readonly string[],
  lessons: HintLessons,
  contains: (zh: string, word: string) => boolean = (zh, word) => zh.includes(word),
  limit = 4,
  fallback?: (word: string) => HintLine | null,
): Hint[] {
  const asked = [...new Set(words)]
  if (!asked.length) return []
  const candidates = new Map<string, Hint>()
  const consider = (line: HintLine, source: Hint['source']) => {
    const zh = line.zh.trim()
    if (!zh || hanzi(zh) > MAX_HINT_LENGTH || candidates.has(zh)) return
    const used = asked.filter((word) => contains(zh, word))
    if (used.length) candidates.set(zh, { zh, pinyin: line.pinyin, en: line.en, words: used, source })
  }
  for (const lesson of lessons) {
    for (const text of lesson.texts) for (const line of text.lines) consider(line, text.type === 'dialogue' ? 'dialogue' : 'passage')
    for (const point of lesson.grammar) for (const example of point.examples) consider(example, 'example')
    for (const note of lesson.extras.same_char) for (const example of note.examples) consider(example, 'example')
  }
  for (const word of asked) {
    if ([...candidates.values()].some((hint) => hint.words.includes(word))) continue
    const line = fallback?.(word)
    if (line?.zh.trim() && !candidates.has(line.zh.trim())) candidates.set(line.zh.trim(), { zh: line.zh.trim(), pinyin: line.pinyin, en: line.en, words: asked.filter((other) => contains(line.zh, other)).length ? asked.filter((other) => contains(line.zh, other)) : [word], source: 'example' })
  }

  const rank = { dialogue: 0, passage: 1, example: 2 } as const
  const better = (a: Hint, b: Hint) => b.words.length - a.words.length || rank[a.source] - rank[b.source] || hanzi(a.zh) - hanzi(b.zh) || a.zh.localeCompare(b.zh)
  const pool = [...candidates.values()].sort(better)
  const chosen: Hint[] = []
  const take = (hint: Hint | undefined) => { if (hint && !chosen.includes(hint) && chosen.length < limit) chosen.push(hint) }

  // Lines that put several of the words side by side show how they combine.
  pool.filter((hint) => hint.words.length > 1).slice(0, 2).forEach(take)
  // Then make sure every word has at least one line of its own.
  for (const word of asked) if (!chosen.some((hint) => hint.words.includes(word))) take(pool.find((hint) => hint.words.includes(word)))
  // Then the next best line of each word in turn.
  for (let round = 0; chosen.length < limit && round < limit; round++) {
    for (const word of asked) take(pool.filter((hint) => hint.words.includes(word) && !chosen.includes(hint))[0])
  }
  return chosen
}

/** The same line cut into pieces, marking which pieces are one of the words, for highlighting. Longest word first. */
export function highlightWords(zh: string, words: readonly string[]): Array<{ text: string; hit: boolean }> {
  const ordered = [...new Set(words)].filter(Boolean).sort((a, b) => b.length - a.length)
  const parts: Array<{ text: string; hit: boolean }> = []
  const push = (text: string, hit: boolean) => {
    const last = parts[parts.length - 1]
    if (last && last.hit === hit) last.text += text
    else if (text) parts.push({ text, hit })
  }
  let at = 0
  while (at < zh.length) {
    const word = ordered.find((candidate) => zh.startsWith(candidate, at))
    if (word) { push(word, true); at += word.length } else { push(zh[at], false); at += 1 }
  }
  return parts
}
