import { buildReview, type Review, type ReviewCheck } from './review.ts'
import type { GrammarVerdict } from './grammar/types.ts'
import { t } from './i18n.ts'

const HANZI = /[㐀-鿿]/gu
const LATIN = /[A-Za-z]/g

/** Sentences end at 。！？ (or their ASCII forms). A trailing fragment with Hanzi counts as one. */
export function sentenceCount(text: string): number {
  return text.split(/[。！？!?.]+/u).filter((part) => /[㐀-鿿]/u.test(part)).length
}

/** What the free grammar classifier found. It only knows common mistakes, so a clean result is not a guarantee. */
export interface WritingGrammar {
  verdict: GrammarVerdict
  /** One line per mistake that is wrong in standard Mandarin. */
  errors: string[]
  /** One line per thing that is only worth a second look. */
  looks: string[]
  /** How many mistake patterns were checked. */
  rulesChecked: number
}

export interface WritingReviewInput {
  response: string
  /** The word set the learner was asked to use. */
  words: string[]
  /** Which of those words the draft uses. */
  used: string[]
  /** The classifier's answer, or null when it has not run. */
  grammar: WritingGrammar | null
}

/** The task as the learner was given it. */
export function writingTask(wordCount: number): string {
  return wordCount === 1
    ? t('Write 2 or 3 Mandarin sentences that use the word in your own situation')
    : t('Write 2 or 3 Mandarin sentences that use all {n} words in your own situation', { n: wordCount })
}

/**
 * Every requirement of the writing task, checked on its own, all on this device and live.
 * Grammar passes when none of the known mistake patterns match; the report says how narrow that is.
 */
export function reviewWriting({ response, words, used, grammar }: WritingReviewInput): Review {
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
  const checked = !!grammar && grammar.verdict !== 'not-chinese'
  checks.push({
    id: 'grammar', stage: 'output', decisive: true, label: t('No common grammar mistakes'),
    status: !checked ? 'unverified' : grammar.errors.length ? 'fail' : 'pass',
    found: !checked ? t('Not checked yet')
      : grammar.errors.length ? grammar.errors.length === 1 ? t('{n} mistake found', { n: 1 }) : t('{n} mistakes found', { n: grammar.errors.length })
        : t('None of {n} common patterns matched', { n: grammar.rulesChecked }),
    expected: t('No known mistakes'),
    fix: !grammar ? t('The grammar check has not run yet.') : !checked ? t('Write some Mandarin to check its grammar.') : grammar.errors.length ? grammar.errors.join(' ') : undefined,
  })
  if (checked && grammar.looks.length) {
    checks.push({
      id: 'grammar-look', stage: 'output', decisive: false, label: t('Worth a second look'),
      status: 'partial',
      found: grammar.looks.length === 1 ? t('{n} thing to look at', { n: 1 }) : t('{n} things to look at', { n: grammar.looks.length }),
      expected: t('Nothing unusual'), fix: grammar.looks.join(' '),
    })
  }
  return buildReview(writingTask(words.length), checks)
}
