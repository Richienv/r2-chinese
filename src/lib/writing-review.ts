import { buildReview, type Review, type ReviewCheck } from './review.ts'
import { t } from './i18n.ts'

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
  return wordCount === 1
    ? t('Write 2 or 3 Mandarin sentences that use the word in your own situation')
    : t('Write 2 or 3 Mandarin sentences that use all {n} words in your own situation', { n: wordCount })
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
    id: 'mandarin', stage: 'instruction', decisive: true, label: t('Written in Mandarin'),
    status: hanzi === 0 ? 'fail' : latin > hanzi ? 'partial' : 'pass',
    found: hanzi === 0 ? t('No Hanzi yet') : latin ? t('{hanzi} Hanzi and {latin} English letters', { hanzi, latin }) : t('{hanzi} Hanzi', { hanzi }),
    expected: 'Hanzi',
    fix: hanzi === 0 ? t('Write in Chinese characters.') : t('Write the English parts in Chinese too.'),
  })
  const sentences = sentenceCount(response)
  checks.push({
    id: 'sentences', stage: 'instruction', decisive: true, label: t('Two or three sentences'),
    status: sentences >= 2 ? 'pass' : sentences === 1 ? 'partial' : 'fail',
    found: sentences === 1 ? t('{n} sentence', { n: sentences }) : t('{n} sentences', { n: sentences }), expected: t('2 or 3'),
    fix: sentences
      ? t('Add one more sentence, ending each with {stop} or {ask}.', { stop: '。', ask: '？' })
      : t('Write two or three sentences, ending each with {stop} or {ask}.', { stop: '。', ask: '？' }),
  })
  const missing = words.filter((word) => !used.includes(word))
  checks.push({
    id: 'words', stage: 'recall', decisive: true,
    label: words.length === 1 ? t('Used the word') : t('Used all {n} words', { n: words.length }),
    status: !missing.length ? 'pass' : used.length ? 'partial' : 'fail',
    found: used.length ? t('Used {words}', { words: used.join('、') }) : t('None used yet'), expected: words.join('、'),
    fix: missing.length === 1
      ? t('Still to use: {words}. Work it into a sentence.', { words: missing.join('、') })
      : t('Still to use: {words}. Work them into a sentence.', { words: missing.join('、') }),
  })
  checks.push({
    id: 'grammar', stage: 'output', decisive: true, label: t('Grammar and meaning are correct'),
    status: grammar ? (grammar.accepted ? 'pass' : 'fail') : 'unverified',
    found: grammar
      ? grammar.accepted ? t('Checked by the reviewer')
        : grammar.corrections.length === 1 ? t('{n} correction suggested', { n: 1 }) : t('{n} corrections suggested', { n: grammar.corrections.length || 1 })
      : t('Not checked yet'),
    expected: t('Correct Mandarin'),
    fix: grammar
      ? grammar.accepted ? undefined : grammar.corrections.join(' ') || t('See the corrections below.')
      : reviewerAvailable ? t('Press “{button}” to have the grammar and meaning checked.', { button: t('Check my sentences') }) : t('The grammar reviewer is not connected, so grammar cannot be verified. Everything else is checked here.'),
  })
  return buildReview(writingTask(words.length), checks)
}
