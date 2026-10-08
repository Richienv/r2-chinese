import { t } from '../i18n.ts'
import type { Finding, GrammarReport } from './types.ts'

export interface Change { original: string; suggestion: string | null; why: string }

/** One line a learner can act on: what to change, to what, and why. */
export function describeChange({ original, suggestion, why }: Change): string {
  if (suggestion === null) return t('“{original}”: {why}', { original, why })
  if (suggestion === '') return t('Remove “{original}”. {why}', { original, why })
  return t('“{original}” → “{suggestion}”. {why}', { original, suggestion, why })
}

export const describeFinding = (finding: Finding): string => describeChange(finding)

export const errorsOf = (report: GrammarReport): Finding[] => report.findings.filter((finding) => finding.severity === 'error')
export const looksOf = (report: GrammarReport): Finding[] => report.findings.filter((finding) => finding.severity === 'check')

/** The headline for a report, and how far to trust it. */
export function summarize(report: GrammarReport): string {
  const errors = errorsOf(report).length
  const looks = looksOf(report).length
  if (report.verdict === 'not-chinese') return t('Write some Mandarin first.')
  if (errors) return errors === 1 ? t('One common mistake turned up.') : t('{n} common mistakes turned up.', { n: errors })
  if (looks) return looks === 1 ? t('Nothing is clearly wrong, but one thing is worth a second look.') : t('Nothing is clearly wrong, but {n} things are worth a second look.', { n: looks })
  return t('None of the {n} common mistake patterns matched. That is not proof the sentence is right: this check only knows a fixed set of patterns.', { n: report.rulesChecked })
}
