import type { LessonText } from './types'
import { checkGrammar } from './grammar/check.ts'
import { describeFinding, errorsOf, looksOf } from './grammar/describe.ts'
import type { GrammarVerdict, Lexicon } from './grammar/types.ts'
import { t } from './i18n.ts'

export interface ProductionResult {
  correct: boolean
  assisted: boolean
  words: string[]
  mode: 'speaking' | 'writing'
  evidence?: 'source-match' | 'practice'
  /** Keep each assessed turn separate; one difficult reply must not downgrade another. */
  outcomes?: Array<{
    word: string
    correct: boolean
    assisted: boolean
    mode: 'speaking' | 'writing'
    evidence: 'source-match' | 'practice'
  }>
}

export interface ProductionPrompt {
  expectedZh: string
  expectedEn: string
  response: string
  targetWords: string[]
  grammar?: string
  context?: string
}

export interface ProductionAssessment {
  /**
   * true: the book's sentence, so correct. false: a known mistake was found in it.
   * null: not verified. Nothing can confirm a different sentence is right, so it is never true for one.
   */
  accepted: boolean | null
  /** 'source-match' can be graded. 'practice' is feedback only and never counts for or against mastery. */
  evidence: 'source-match' | 'practice'
  feedback: string
  /** The book's sentence, shown for comparison once the learner has checked. */
  correctedZh: string
  /** The learner's own sentence with the known mistakes fixed. Only when every one has a fix. */
  suggestedZh?: string
  issues: string[]
  usedWords: string[]
  missingWords: string[]
  /** What the free classifier concluded, when it ran. */
  grammar?: { verdict: GrammarVerdict; rulesChecked: number }
}

export function normalizeChinese(text: string): string {
  return text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '')
}

export function sourceWords(text: string, candidates: string[]): string[] {
  return [...new Set(candidates.filter((word) => /[\u3400-\u9fff]/.test(word) && text.includes(word)))]
}

export function dialogueRoles(text: LessonText): string[] {
  const speakers = [...new Set(text.lines.map((line) => line.speaker).filter(Boolean))]
  return speakers.length > 1 ? speakers : [t('Your turn')]
}

export function dialogueTurnIndexes(text: LessonText, role: string): number[] {
  const named = dialogueRoles(text).length > 1
  return text.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => line.zh.trim() && (named ? line.speaker === role : index % 2 === 1 || text.lines.length === 1))
    .slice(0, 3)
    .map(({ index }) => index)
}

export function sourceAssessment(prompt: ProductionPrompt): ProductionAssessment {
  const targetWords = sourceWords(prompt.expectedZh, prompt.targetWords)
  const usedWords = sourceWords(prompt.response, targetWords)
  const match = !!normalizeChinese(prompt.response) && normalizeChinese(prompt.response) === normalizeChinese(prompt.expectedZh)
  return {
    accepted: match ? true : null,
    evidence: match ? 'source-match' : 'practice',
    feedback: match
      ? t('You recalled the book sentence. The Hanzi and word order match; punctuation is flexible.')
      : t('Your wording differs from the book. It may be a valid alternative; source comparison alone cannot verify its grammar or meaning.'),
    correctedZh: prompt.expectedZh,
    issues: [],
    usedWords,
    missingWords: targetWords.filter((word) => !usedWords.includes(word)),
  }
}

/** Character alignment describes differences; it never pretends they are grammar errors. */
export function alignChinese(response: string, reference: string): Array<{ text: string; kind: 'same' | 'added' | 'missing' }> {
  const user = [...normalizeChinese(response)].slice(0, 400)
  const source = [...normalizeChinese(reference)].slice(0, 400)
  const rows = Array.from({ length: user.length + 1 }, () => new Uint16Array(source.length + 1))
  for (let i = user.length - 1; i >= 0; i--) {
    for (let j = source.length - 1; j >= 0; j--) {
      rows[i][j] = user[i] === source[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1])
    }
  }
  const parts: Array<{ text: string; kind: 'same' | 'added' | 'missing' }> = []
  const add = (text: string, kind: 'same' | 'added' | 'missing') => {
    const last = parts[parts.length - 1]
    if (last?.kind === kind) last.text += text
    else parts.push({ text, kind })
  }
  let i = 0
  let j = 0
  while (i < user.length || j < source.length) {
    if (i < user.length && j < source.length && user[i] === source[j]) {
      add(user[i++], 'same')
      j++
    } else if (i < user.length && (j === source.length || rows[i + 1][j] >= rows[i][j + 1])) {
      add(user[i++], 'added')
    } else add(source[j++], 'missing')
  }
  return parts
}

/**
 * The book's sentence is the only thing that can be confirmed correct. For any other wording the free grammar
 * classifier looks for known mistakes: finding one is useful feedback; finding none is not proof of anything.
 * Either way the result is practice evidence, so it never reaches the mastery record.
 */
export function assessProduction(prompt: ProductionPrompt, lexicon?: Lexicon): ProductionAssessment {
  const local = sourceAssessment(prompt)
  if (local.accepted) return local
  const report = checkGrammar(prompt.response, { lexicon })
  const errors = errorsOf(report)
  const looks = looksOf(report)
  const grammar = { verdict: report.verdict, rulesChecked: report.rulesChecked }
  const issues = [...errors, ...looks].map(describeFinding)
  if (errors.length) {
    return {
      ...local,
      accepted: false,
      grammar,
      issues,
      feedback: errors.length === 1 ? t('One common mistake turned up in your wording.') : t('{n} common mistakes turned up in your wording.', { n: errors.length }),
      ...(report.fullyCorrected ? { suggestedZh: report.correctedZh } : {}),
    }
  }
  return {
    ...local,
    grammar,
    issues,
    feedback: looks.length
      ? t('Your wording differs from the book. Nothing is clearly wrong, but some parts are worth a second look. The checker cannot confirm the rest, so compare with the book.')
      : t('Your wording differs from the book. No common mistakes turned up, but this check only knows a fixed set of patterns, so it cannot confirm your sentence is right. Compare it with the book.'),
  }
}
