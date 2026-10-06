import { alignChinese, normalizeChinese, type ProductionAssessment } from './production.ts'
import { buildReview, type Review, type ReviewCheck } from './review.ts'

export interface ReplyReviewInput {
  /** The instruction, restated in the report. */
  task: string
  response: string
  /** The book reply being recalled. It is only ever shown after the learner has checked. */
  expectedZh: string
  /** An English gloss per key word, so a missing word can be pointed at without printing it. */
  glosses?: Record<string, string>
  assessment: ProductionAssessment
}

const HANZI = /[㐀-鿿]/gu
const LATIN = /[A-Za-z]/g

function listed(words: string[]): string {
  return words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * Check a reply recalled from a dialogue against what the task needed: it is in
 * Mandarin, it carries the key information from the line, and it is right (the
 * book's words, or verified meaning and grammar). Anything that cannot be verified
 * says so; it is never reported as passing.
 */
export function reviewReply({ task, response, expectedZh, glosses = {}, assessment }: ReplyReviewInput): Review {
  const checks: ReviewCheck[] = []
  const hanzi = (response.match(HANZI) ?? []).length
  const latin = (response.match(LATIN) ?? []).length

  checks.push({
    id: 'mandarin', stage: 'instruction', decisive: true, label: 'Answered in Mandarin',
    status: hanzi === 0 ? 'fail' : latin > hanzi ? 'partial' : 'pass',
    found: hanzi === 0 ? 'No Hanzi' : latin ? `${hanzi} Hanzi and ${latin} English letters` : `${hanzi} Hanzi`,
    expected: 'A reply in Hanzi',
    fix: hanzi === 0 ? 'Write or say the reply in Chinese.' : 'Write the English parts in Chinese too.',
  })

  const keyWords = [...assessment.usedWords, ...assessment.missingWords]
  if (keyWords.length) {
    const missing = assessment.missingWords
    const used = assessment.usedWords
    const hints = missing.map((word) => glosses[word]).filter(Boolean).map((gloss) => `“${gloss}”`)
    checks.push({
      id: 'key-words', stage: 'recall',
      // A verified reply that skipped a lesson word is still correct; it just did not practise the word.
      decisive: assessment.accepted !== true,
      label: keyWords.length === 1 ? 'Used the key word from the line' : 'Used the key words from the line',
      status: !missing.length ? 'pass' : used.length ? 'partial' : 'fail',
      found: used.length ? `Used ${used.join(', ')}` : 'None of them',
      expected: keyWords.join(', '), spoils: true,
      fix: missing.length === 1
        ? `One key word from the line is missing${hints.length ? `: the word for ${hints[0]}` : ''}. Work it into your reply.`
        : `${missing.length} key words from the line are missing${hints.length ? `: the words for ${listed(hints)}` : ''}. Work them into your reply.`,
    })
  }

  const exact = assessment.accepted === true && assessment.evidence === 'source-match'
  checks.push({
    id: 'matches', stage: 'output', decisive: true,
    label: exact ? 'Matches the book sentence' : assessment.evidence === 'verified' ? 'Meaning and grammar are correct' : 'Matches the book, or is verified correct',
    status: assessment.accepted === true ? 'pass' : assessment.accepted === false ? 'fail' : 'unverified',
    found: assessment.accepted === true ? (exact ? 'Same Hanzi and word order' : 'Meaning and grammar checked') : response.trim(),
    expected: expectedZh, spoils: true,
    fix: assessment.accepted === false
      ? [assessment.issues[0] ?? assessment.feedback, assessment.correctedZh ? `Suggested: ${assessment.correctedZh}` : ''].filter(Boolean).join(' ')
      : assessment.accepted === null
        ? `Your wording differs from the book. It may be valid, but its grammar and meaning cannot be verified${assessment.unavailable ? ' right now' : ' without the grammar reviewer'}. Compare it with the book wording, or retry the grammar check.`
        : undefined,
  })

  if (assessment.accepted !== true && normalizeChinese(response)) {
    const parts = alignChinese(response, expectedZh)
    const same = parts.filter((part) => part.kind === 'same').reduce((sum, part) => sum + [...part.text].length, 0)
    const total = [...normalizeChinese(expectedZh)].length
    const missing = parts.filter((part) => part.kind === 'missing').map((part) => part.text)
    const added = parts.filter((part) => part.kind === 'added').map((part) => part.text)
    checks.push({
      id: 'closeness', stage: 'recall', decisive: false, label: 'Close to the book wording',
      status: same === total && !added.length ? 'pass' : 'partial',
      found: `${same} of ${total} book characters in place`, expected: `${total} of ${total}`,
      fix: [missing.length ? `In the book but not in your reply: ${missing.join(' ')}.` : '', added.length ? `In your reply but not in the book: ${added.join(' ')}.` : ''].filter(Boolean).join(' ') || undefined,
    })
  }
  return buildReview(task, checks)
}
