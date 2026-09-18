import { lessons, vocabIndex } from './content'
import type { GrammarPoint, Lesson, TextLine, Vocab } from './types'

/** Deterministic per (lesson, index) so a question doesn't reshuffle on re-render. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100_000) / 100_000
  }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const glossable = (v: { en: string; pos: string }) => v.en.length > 0 && v.en.length < 40

const properNouns = new Set(vocabIndex.filter((v) => v.tag === 'proper').map((v) => v.zh))

/** Three wrong answers, preferring the same part of speech. */
function distractors(answer: Vocab, rand: () => number): Vocab[] {
  const pool = vocabIndex
    // proper nouns (names, places) make unfair distractors for meaning questions
    .filter((v) => v.zh !== answer.zh && v.tag !== 'proper' && glossable(v))
    .map((v) => ({ zh: v.zh, pinyin: v.pinyin, pos: v.pos, en: v.en, note: '' }))
  const samePos = shuffle(pool.filter((v) => v.pos === answer.pos), rand)
  const rest = shuffle(pool, rand)
  const picked: Vocab[] = []
  for (const v of [...samePos, ...rest]) {
    if (picked.length === 3) break
    if (picked.some((p) => p.zh === v.zh || p.en === v.en)) continue
    picked.push(v)
  }
  return picked
}

export interface Question {
  prompt: string
  /** rendered above the options, e.g. the cloze sentence */
  context?: { zh: string; pinyin: string; en: string }
  options: { zh: string; label: string }[]
  answer: string
  explanation: string
}

/** "Which word means X?" over the lesson's own new words. */
export function vocabQuestions(lesson: Lesson, count = 3, pool?: Vocab[]): Question[] {
  const source = pool ?? lesson.vocab
  const candidates = source.filter((v) => glossable(v) && !properNouns.has(v.zh))
  // Keep the original seed when using the full lesson list so the textbook quiz
  // does not reshuffle. A scoped pool (path sessions) gets its own seed.
  const rand = rng(seedOf(pool ? `v${lesson.lesson}:${candidates.map((c) => c.zh).join(',')}` : `v${lesson.lesson}`))
  return shuffle(candidates, rand)
    .slice(0, count)
    .map((answer) => {
      const r = rng(seedOf(answer.zh))
      const options = shuffle(
        [answer, ...distractors(answer, r)],
        r,
      ).map((v) => ({ zh: v.zh, label: v.zh }))
      return {
        prompt: `Which word means “${answer.en}”?`,
        options,
        answer: answer.zh,
        explanation: `${answer.zh} (${answer.pinyin}) — ${answer.pos} ${answer.en}`,
      }
    })
}

/**
 * Blanks the grammar keyword out of one of the book's own example sentences.
 * Falls back to a vocabulary cloze when the point has no single-token keyword.
 */
export function clozeQuestion(lesson: Lesson, point?: GrammarPoint): Question | null {
  const points = point ? [point] : lesson.grammar
  for (const p of points) {
    const keyword = grammarKeyword(p)
    if (!keyword) continue
    const example = p.examples.find((e) => e.zh.includes(keyword))
    if (!example) continue
    const rand = rng(seedOf(example.zh))
    const wrong = lessons
      .flatMap((l) => l.grammar.map(grammarKeyword))
      .filter((k): k is string => !!k && k !== keyword)
    const options = shuffle([keyword, ...shuffle([...new Set(wrong)], rand).slice(0, 3)], rand)
    return {
      prompt: 'Fill in the blank',
      context: {
        zh: example.zh.replace(keyword, '＿＿'),
        pinyin: example.pinyin,
        en: example.en,
      },
      options: options.map((zh) => ({ zh, label: zh })),
      answer: keyword,
      explanation: `${p.point} — ${p.explanation}`,
    }
  }
  return null
}

/** The leading particle of a pattern like "不仅……也/还/而且……". */
function grammarKeyword(point: GrammarPoint): string | null {
  const head = point.point.split(/[……\s、,，/]/)[0].replace(/[()（）]/g, '')
  if (!head || head.length > 4 || !/^[一-鿿]+$/.test(head)) return null
  return head
}

/** Meaning-check on 课文 lines. Pass `from` to stay inside one 课文. Options are English. */
export function sentenceQuestions(lesson: Lesson, count = 8, from?: TextLine[]): Question[] {
  const lines = (from ?? lesson.texts.flatMap((t) => t.lines)).filter(
    (l) => l.zh.length >= 4 && l.en.length > 2 && l.en.length < 90,
  )
  if (!lines.length) return []
  const seed = from?.length
    ? `s${lesson.lesson}:${from.map((l) => l.zh).join('|')}`
    : `s${lesson.lesson}`
  const rand = rng(seedOf(seed))
  const picked = shuffle(lines, rand).slice(0, Math.min(count, lines.length))
  const distractorPool = lesson.texts
    .flatMap((t) => t.lines)
    .filter((l) => l.en.length > 2 && l.en.length < 90)
  return picked.map((line) => {
    const r = rng(seedOf(line.zh))
    const wrong = shuffle(
      distractorPool.filter((x) => x.en !== line.en),
      r,
    ).slice(0, 3)
    const options = shuffle([line, ...wrong], r).map((l) => ({ zh: l.en, label: l.en }))
    return {
      prompt: 'What does this mean?',
      context: { zh: line.zh, pinyin: line.pinyin, en: line.en },
      options,
      answer: line.en,
      explanation: `${line.zh} — ${line.en}`,
    }
  })
}
