import { naturalChineseSegments } from './dictionary-format.ts'
import { compositionCoverage } from './hskPractice.ts'
import { checkGrammar } from './grammar/check.ts'
import { errorsOf, looksOf, summarize } from './grammar/describe.ts'
import type { Finding, GrammarVerdict, Lexicon, Severity } from './grammar/types.ts'

export interface GrammarCorrection {
  original: string
  /** What to write instead. '' means remove it; null means the sentence has to be reworded. */
  suggestion: string | null
  why: string
  /** The pattern to keep in mind. */
  rule: string
  severity: Severity
}

export interface CompositionReview {
  verdict: GrammarVerdict
  /** No known mistake. This is not a claim that the writing is correct. */
  accepted: boolean
  /** The learner's own text with the known mistakes fixed; unchanged when none. */
  correctedZh: string
  /** Every mistake has an automatic fix, so correctedZh is complete. */
  fullyCorrected: boolean
  feedback: string
  corrections: GrammarCorrection[]
  rulesChecked: number
  used: string[]
  missing: string[]
}

export function writingCoverage(response: string, words: string[]) {
  return compositionCoverage(response, words, naturalChineseSegments(response))
}

const correction = (finding: Finding): GrammarCorrection => ({
  original: finding.original, suggestion: finding.suggestion, why: finding.why, rule: finding.pattern, severity: finding.severity,
})

/**
 * Check original writing with the free classifier. Word coverage is separate: a draft that skips a
 * word is not a grammar mistake. Synchronous and offline, so it can run on every keystroke.
 */
export function reviewComposition(response: string, words: string[], lexicon?: Lexicon): CompositionReview {
  const report = checkGrammar(response, { lexicon })
  return {
    verdict: report.verdict,
    accepted: report.verdict !== 'errors' && report.verdict !== 'not-chinese',
    correctedZh: report.correctedZh,
    fullyCorrected: report.fullyCorrected,
    feedback: summarize(report),
    corrections: [...errorsOf(report), ...looksOf(report)].map(correction),
    rulesChecked: report.rulesChecked,
    ...writingCoverage(response, words),
  }
}
