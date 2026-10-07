import { rng, seedOf, shuffle } from './seeded.ts'
import { buildReview, type Review, type ReviewCheck } from './review.ts'
import { t } from './i18n.ts'
import type { LessonText, Vocab } from './types.ts'

/**
 * A recall check on a dialogue the learner has just read and spoken. It asks
 * what the conversation said, not what a word means in general: what came next,
 * who said it, and which key word belongs in a line. Every wrong choice is
 * answered with the book's own line, and misses come back for a retest.
 */

export type RecheckKind = 'reply' | 'speaker' | 'word'

export interface RecheckQuestion {
  /** Stable across attempts, so a retest can say what was fixed. */
  id: string
  kind: RecheckKind
  prompt: string
  /** The line the question is about, in Chinese as the book has it. */
  context: { speaker?: string; zh: string }
  /** An English clue shown with a blanked line. Never present on questions about the line itself. */
  clue?: string
  options: string[]
  answer: string
  /** Why the answer is right, quoted from the book. */
  explanation: string
  /** The key word a question tests, so it can feed recognition evidence. */
  word?: string
  /** A short noun for the report. */
  label: string
}

export interface RecheckAnswer {
  id: string
  picked: string
}

const MAX_QUESTIONS = 5
const BLANK = '＿＿'

const named = (text: LessonText) => new Set(text.lines.map((line) => line.speaker.trim()).filter(Boolean)).size > 1

export function buildRecheck(text: LessonText, words: Vocab[]): RecheckQuestion[] {
  const lines = text.lines.map((line, index) => ({ ...line, index })).filter((line) => line.zh.trim())
  if (lines.length < 3) return []
  const seed = seedOf(lines.map((line) => line.zh).join('|'))
  const rand = rng(seed)
  const speakers = named(text)
  const questions: RecheckQuestion[] = []

  // What came next: the line itself is the answer, so the options are lines the same speaker said.
  const replyTargets = lines.slice(1)
    .map((line, at) => ({ line, before: lines[at] }))
    .filter(({ line, before }) => line.zh.length >= 4 && (!speakers || line.speaker !== before.speaker))
  for (const { line, before } of shuffle(replyTargets, rand).slice(0, 2).sort((a, b) => a.line.index - b.line.index)) {
    const same = lines.filter((entry) => entry.index !== line.index && entry.zh !== line.zh && (!speakers || entry.speaker === line.speaker))
    const others = lines.filter((entry) => entry.index !== line.index && entry.zh !== line.zh && !same.includes(entry))
    // Lines from the same speaker are the fair distractors; only borrow from others when there are too few.
    const pool = same.length >= 2 ? shuffle(same, rand) : [...shuffle(same, rand), ...shuffle(others, rand)]
    const wrong = [...new Set(pool.map((entry) => entry.zh))].slice(0, 3)
    if (wrong.length < 2) continue
    questions.push({
      id: `reply:${line.index}`, kind: 'reply', label: t('What came next'),
      prompt: speakers && line.speaker ? t('What did {speaker} say next?', { speaker: line.speaker }) : t('Which line came next?'),
      context: { speaker: before.speaker || undefined, zh: before.zh },
      options: shuffle([line.zh, ...wrong], rand), answer: line.zh,
      explanation: `${before.speaker ? `${before.speaker}: ` : ''}${before.zh}  →  ${line.speaker ? `${line.speaker}: ` : ''}${line.zh} (${line.en})`,
    })
  }

  // Who said it: only when the book names the speakers.
  if (speakers) {
    const people = [...new Set(lines.map((line) => line.speaker.trim()).filter(Boolean))].slice(0, 4)
    const used = new Set(questions.map((question) => question.context.zh))
    const target = shuffle(lines.filter((line) => line.speaker.trim() && line.zh.length >= 4), rand).find((line) => !used.has(line.zh))
    if (target) {
      questions.push({
        id: `speaker:${target.index}`, kind: 'speaker', label: t('Who said it'), prompt: t('Who said this?'),
        context: { zh: target.zh }, options: people, answer: target.speaker.trim(),
        explanation: `${target.speaker}: ${target.zh} (${target.en})`,
      })
    }
  }

  // Key word: the sitting's own words, blanked in the line they came from.
  const blanks = shuffle(words.filter((word) => word.zh.trim() && lines.some((line) => line.zh.includes(word.zh))), rand)
  for (const word of blanks) {
    if (questions.filter((question) => question.kind === 'word').length >= 2) break
    const line = lines.find((entry) => entry.zh.includes(word.zh))
    if (!line) continue
    const near = words.filter((other) => other.zh !== word.zh && other.zh.trim() && !line.zh.includes(other.zh))
    const alike = near.filter((other) => [...other.zh].length === [...word.zh].length)
    const wrong = [...new Set([...shuffle(alike, rand), ...shuffle(near, rand)].map((other) => other.zh))].slice(0, 3)
    if (wrong.length < 2) continue
    questions.push({
      id: `word:${word.zh}`, kind: 'word', label: t('Key word'), prompt: t('Which word fits the blank?'),
      context: { speaker: line.speaker || undefined, zh: line.zh.replace(word.zh, BLANK) }, clue: line.en,
      options: shuffle([word.zh, ...wrong], rand), answer: word.zh, word: word.zh,
      explanation: t('{zh} ({pinyin}), {meaning}. In the book: {line} ({gloss})', { zh: word.zh, pinyin: word.pinyin, meaning: word.en, line: line.zh, gloss: line.en }),
    })
  }

  return questions.slice(0, MAX_QUESTIONS)
}

/** The report for one round of answers. Unanswered questions are missing, never silently passed. */
export function reviewRecheck(task: string, questions: RecheckQuestion[], answers: RecheckAnswer[]): Review {
  const byId = new Map(answers.map((answer) => [answer.id, answer.picked]))
  const answered = questions.filter((question) => byId.has(question.id)).length
  const checks: ReviewCheck[] = [{
    id: 'answered-all', stage: 'instruction', decisive: true, label: t('Answered every question'),
    status: answered === questions.length ? 'pass' : 'fail',
    found: t('{answered} of {total} answered', { answered, total: questions.length }), expected: t('{n} answers', { n: questions.length }),
    fix: t('Answer the remaining questions before the check.'),
  }]
  for (const question of questions) {
    const picked = byId.get(question.id)
    const right = picked === question.answer
    checks.push({
      id: question.id, stage: 'choice', decisive: true,
      label: `${question.label}: ${question.context.zh}`,
      status: picked === undefined ? 'fail' : right ? 'pass' : 'fail',
      found: picked ?? t('No answer'), expected: question.answer,
      fix: right ? undefined : question.explanation,
    })
  }
  return buildReview(task, checks)
}

/**
 * The misses, asked again with the options in a new order so the position of the
 * right answer cannot be remembered in place of the answer itself.
 */
export function retestQuestions(questions: RecheckQuestion[], answers: RecheckAnswer[], attempt: number): RecheckQuestion[] {
  const byId = new Map(answers.map((answer) => [answer.id, answer.picked]))
  return questions
    .filter((question) => byId.get(question.id) !== question.answer)
    .map((question) => {
      const rand = rng(seedOf(`${question.id}:${attempt}`))
      let options = shuffle(question.options, rand)
      // Never repeat the same order as the previous round, or a position can be remembered.
      if (options.length > 1 && options.join('|') === question.options.join('|')) options = [...options.slice(1), options[0]]
      return { ...question, options }
    })
}
