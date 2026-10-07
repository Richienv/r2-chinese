/**
 * One shape for "was that right, and what do I do about it".
 *
 * Every graded task follows the same loop: instruction, task, result, check,
 * feedback, correction, retest. A task turns its result into ReviewChecks;
 * this file decides the verdict, the next step, and what changed on a retest.
 * Pure on purpose: screens only render these decisions.
 */

import { t } from './i18n.ts'

export type CheckStatus = 'pass' | 'partial' | 'fail' | 'unverified'

/** What a check looks at, in the order a learner should fix things. */
export type CheckStage = 'instruction' | 'recall' | 'choice' | 'output'

export interface ReviewCheck {
  /** Stable across attempts, so a retest can say which problems were fixed. */
  id: string
  stage: CheckStage
  /** The requirement, e.g. "Every character is drawn". */
  label: string
  status: CheckStatus
  /** What the learner actually did. */
  found: string
  /** What was required. */
  expected: string
  /** The concrete step that fixes it. Present for anything that is not a pass. */
  fix?: string
  /**
   * Decisive checks determine correctness. Others coach (for example a stroke
   * count that differs when the character is still recognised) but never fail a task.
   */
  decisive: boolean
  /**
   * `expected` is the answer itself. A report must not print it while the learner
   * can still retrieve it; it is shown once they ask to see it.
   */
  spoils?: boolean
}

/**
 * - passed: every decisive check passed.
 * - revise: at least one decisive check failed or is only partly met.
 * - unverified: nothing failed, but a decisive check could not be verified
 *   (for example grammar with no reviewer connected). This is never a pass.
 */
export type Verdict = 'passed' | 'revise' | 'unverified'

export interface Review {
  /** The instruction the learner was given, restated so the result can be read against it. */
  task: string
  checks: ReviewCheck[]
  verdict: Verdict
  headline: string
  /** The single most useful thing to do next. */
  nextStep: string
  /** Everything that is not a pass, worst first and in fix order. */
  issues: ReviewCheck[]
}

const STAGE_ORDER: CheckStage[] = ['instruction', 'recall', 'choice', 'output']
const STATUS_ORDER: CheckStatus[] = ['fail', 'partial', 'unverified', 'pass']

export function verdictOf(checks: ReviewCheck[]): Verdict {
  const decisive = checks.filter((check) => check.decisive)
  if (decisive.some((check) => check.status === 'fail' || check.status === 'partial')) return 'revise'
  if (decisive.some((check) => check.status === 'unverified')) return 'unverified'
  return 'passed'
}

/** Not-passing checks, ordered by how early in the task they break, then by severity. */
export function issuesOf(checks: ReviewCheck[]): ReviewCheck[] {
  return checks
    .filter((check) => check.status !== 'pass')
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
}

export function buildReview(task: string, checks: ReviewCheck[]): Review {
  const verdict = verdictOf(checks)
  const issues = issuesOf(checks)
  const decisive = checks.filter((check) => check.decisive)
  const toFix = issues.filter((check) => check.decisive).length
  const headline = verdict === 'passed'
    ? decisive.length > 1 ? t('All {n} requirements met', { n: decisive.length }) : t('Requirement met')
    : verdict === 'unverified'
      ? t('Everything we could check is right, but one part cannot be verified yet')
      : toFix === 1 ? t('{n} requirement to fix', { n: toFix }) : t('{n} requirements to fix', { n: toFix })
  const first = issues.find((check) => check.decisive) ?? issues[0]
  const nextStep = verdict === 'passed'
    ? issues.length ? t('Passed. Optional: {step}', { step: issues[0].fix ?? issues[0].label }) : t('Nothing to fix. Continue.')
    : first?.fix ?? first?.label ?? t('Review the details and try again.')
  return { task, checks, verdict, headline, nextStep, issues }
}

export interface ReviewComparison {
  /** Problems on the earlier attempt that this attempt resolved. */
  fixed: ReviewCheck[]
  /** Problems that are still there. */
  remaining: ReviewCheck[]
  /** Things that were right and now are not. */
  regressed: ReviewCheck[]
}

/** What changed between an attempt and its retest, matched by check id. */
export function compareReviews(before: Review, after: Review): ReviewComparison {
  const wasWrong = new Set(before.issues.map((check) => check.id))
  const wasRight = new Set(before.checks.filter((check) => check.status === 'pass').map((check) => check.id))
  return {
    fixed: before.issues.filter((check) => after.checks.some((now) => now.id === check.id && now.status === 'pass')),
    remaining: after.issues.filter((check) => wasWrong.has(check.id)),
    regressed: after.issues.filter((check) => wasRight.has(check.id)),
  }
}

/** One plain sentence for the retest result. */
export function describeComparison(comparison: ReviewComparison): string {
  const { fixed, remaining, regressed } = comparison
  const parts: string[] = []
  if (fixed.length) parts.push(t('Fixed {n}', { n: fixed.length }))
  if (remaining.length) parts.push(t('{n} still to fix', { n: remaining.length }))
  if (regressed.length) parts.push(t('{n} newly wrong', { n: regressed.length }))
  return parts.length ? parts.join(' · ') : t('No change from your last attempt')
}

export function passedCount(review: Review): { passed: number; total: number } {
  return { passed: review.checks.filter((check) => check.status === 'pass').length, total: review.checks.length }
}
