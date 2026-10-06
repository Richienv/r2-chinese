import type { ReactNode } from 'react'
import { describeComparison, passedCount, type CheckStage, type CheckStatus, type Review, type ReviewCheck, type ReviewComparison } from '../lib/review'
import '../styles/review.css'

const STAGES: Array<{ stage: CheckStage; label: string }> = [
  { stage: 'instruction', label: 'Followed the instructions' },
  { stage: 'recall', label: 'Recalled the details' },
  { stage: 'choice', label: 'Made the right choices' },
  { stage: 'output', label: 'Result matches the task' },
]
const MARK: Record<CheckStatus, string> = { pass: '✓', partial: '!', fail: '✕', unverified: '?' }
const SPOKEN: Record<CheckStatus, string> = { pass: 'Passed', partial: 'Partly met', fail: 'Not met', unverified: 'Cannot be verified' }

/**
 * A graded task, laid out the same way every time: what was asked, each requirement
 * with what you did and what was needed, and the one thing to do next. It only
 * renders a Review; it decides nothing.
 */
export function ReviewReport({ review, comparison, revealed, compact = false, children }: {
  review: Review
  /** Present on a retest: what was fixed, what remains, what broke. */
  comparison?: ReviewComparison | null
  /** Whether a check that spoils the answer may show it. Defaults to hidden. */
  revealed?: (check: ReviewCheck) => boolean
  compact?: boolean
  children?: ReactNode
}) {
  const { passed, total } = passedCount(review)
  const failing = review.issues.filter((check) => check.decisive)
  return (
    <section className="review" data-verdict={review.verdict} data-compact={compact || undefined} aria-label="Check results">
      <header className="review-head">
        <span className="review-seal" aria-hidden="true">{review.verdict === 'passed' ? '✓' : review.verdict === 'revise' ? '✕' : '?'}</span>
        <div>
          <h3 className="review-headline" role="status">{review.headline}</h3>
          <p className="review-count">{passed} of {total} checks passed{comparison ? ` · ${describeComparison(comparison)}` : ''}</p>
        </div>
      </header>
      <p className="review-task"><span>Task</span>{review.task}</p>
      {comparison && comparison.fixed.length > 0 && <ul className="review-fixed" aria-label="Fixed since your last attempt">
        {comparison.fixed.map((check) => <li key={check.id}><span aria-hidden="true">✓</span>Fixed: {check.label}</li>)}
      </ul>}
      <div className="review-stages">
        {STAGES.map(({ stage, label }) => {
          const checks = review.checks.filter((check) => check.stage === stage)
          if (!checks.length) return null
          return (
            <div className="review-stage" key={stage}>
              <h4>{label}</h4>
              <ul>
                {checks.map((check) => {
                  const show = check.status !== 'pass'
                  const showNeeded = show && (!check.spoils || revealed?.(check))
                  return (
                    <li className="review-check" key={check.id} data-status={check.status} data-decisive={check.decisive}>
                      <span className="review-mark" aria-hidden="true">{MARK[check.status]}</span>
                      <div>
                        <p className="review-label"><strong>{check.label}</strong><span className="sr-only"> — {SPOKEN[check.status]}</span>{!check.decisive && check.status !== 'pass' && <em>tip</em>}</p>
                        {check.status === 'pass'
                          ? !compact && <p className="review-found">{check.found}</p>
                          : <dl className="review-facts">
                            <div><dt>You</dt><dd>{check.found}</dd></div>
                            {showNeeded && <div><dt>Needed</dt><dd>{check.expected}</dd></div>}
                          </dl>}
                        {show && check.fix && <p className="review-fix">{check.fix}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      {review.verdict !== 'passed' && <p className="review-next"><span>{failing.length || review.issues.length ? 'Do this next' : 'Next'}</span>{review.nextStep}</p>}
      {children}
    </section>
  )
}
