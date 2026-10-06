import { buildReview, type Review, type ReviewCheck } from './review.ts'

const HANZI = /[㐀-鿿]/gu
const LATIN = /[A-Za-z]/g

/** Sentences end at 。！？ (or their ASCII forms). A trailing fragment with Hanzi counts as one. */
export function sentenceCount(text: string): number {
  return text.split(/[。！？!?.]+/u).filter((part) => /[㐀-鿿]/u.test(part)).length
}

export interface WritingGrammar {
  accepted: boolean
  /** One line per correction, "original → corrected: reason". */
  corrections: string[]
}

export interface WritingReviewInput {
  response: string
  /** The word set the learner was asked to use. */
  words: string[]
  /** Which of those words the draft uses. */
  used: string[]
  /** The grammar reviewer's answer, or null when it has not run. */
  grammar: WritingGrammar | null
  /** Whether a grammar reviewer is connected, so "not run" can say why. */
  reviewerAvailable: boolean
}

/** The task as the learner was given it. */
export function writingTask(wordCount: number): string {
  return `Write 2 or 3 Mandarin sentences that use ${wordCount === 1 ? 'the word' : `all ${wordCount} words`} in your own situation`
}

/**
 * Every requirement of the writing task, checked on its own. Everything but grammar
 * is checked on this device, live; grammar is only ever passed by the reviewer.
 */
export function reviewWriting({ response, words, used, grammar, reviewerAvailable }: WritingReviewInput): Review {
  const checks: ReviewCheck[] = []
  const hanzi = (response.match(HANZI) ?? []).length
  const latin = (response.match(LATIN) ?? []).length
  checks.push({
    id: 'mandarin', stage: 'instruction', decisive: true, label: 'Written in Mandarin',
    status: hanzi === 0 ? 'fail' : latin > hanzi ? 'partial' : 'pass',
    found: hanzi === 0 ? 'No Hanzi yet' : latin ? `${hanzi} Hanzi and ${latin} English letters` : `${hanzi} Hanzi`,
    expected: 'Hanzi',
    fix: hanzi === 0 ? 'Write in Chinese characters.' : 'Write the English parts in Chinese too.',
  })
  const sentences = sentenceCount(response)
  checks.push({
    id: 'sentences', stage: 'instruction', decisive: true, label: 'Two or three sentences',
    status: sentences >= 2 ? 'pass' : sentences === 1 ? 'partial' : 'fail',
    found: `${sentences} ${sentences === 1 ? 'sentence' : 'sentences'}`, expected: '2 or 3',
    fix: sentences ? 'Add one more sentence, ending each with 。 or ？.' : 'Write two or three sentences, ending each with 。 or ？.',
  })
  const missing = words.filter((word) => !used.includes(word))
  checks.push({
    id: 'words', stage: 'recall', decisive: true,
    label: words.length === 1 ? 'Used the word' : `Used all ${words.length} words`,
    status: !missing.length ? 'pass' : used.length ? 'partial' : 'fail',
    found: used.length ? `Used ${used.join('、')}` : 'None used yet', expected: words.join('、'),
    fix: `Still to use: ${missing.join('、')}. Work ${missing.length === 1 ? 'it' : 'them'} into a sentence.`,
  })
  checks.push({
    id: 'grammar', stage: 'output', decisive: true, label: 'Grammar and meaning are correct',
    status: grammar ? (grammar.accepted ? 'pass' : 'fail') : 'unverified',
    found: grammar ? (grammar.accepted ? 'Checked by the reviewer' : `${grammar.corrections.length || 1} ${grammar.corrections.length === 1 ? 'correction' : 'corrections'} suggested`) : 'Not checked yet',
    expected: 'Correct Mandarin',
    fix: grammar
      ? grammar.accepted ? undefined : grammar.corrections.join(' ') || 'See the corrections below.'
      : reviewerAvailable ? 'Press “Check my sentences” to have the grammar and meaning checked.' : 'The grammar reviewer is not connected, so grammar cannot be verified. Everything else is checked here.',
  })
  return buildReview(writingTask(words.length), checks)
}
