import { useEffect, useRef, useState } from 'react'
import { HandwritingPad, type HandwritingAssessor } from './HandwritingPad'
import { InkThumb } from './InkThumb'
import { ReviewReport } from './ReviewReport'
import { StrokeWord } from './StrokeWord'
import { CheckIcon } from './Icons'
import { inkForRetry, positionsToFix, redrawLabel } from '../lib/drawing-flow'
import { t } from '../lib/i18n'
import { blankWordInk, replaceCharacterInk, wordInkComplete } from '../lib/handwriting-recall'
import { reviewDrawing, type WordDiagnosis } from '../lib/handwriting-review'
import { compareReviews, type Review, type ReviewComparison } from '../lib/review'
import type { InkDrawing } from '../lib/handwriting'

export interface DrawingResult {
  outcome: 'correct' | 'incorrect' | 'uncertain'
  review: Review
  diagnosis: WordDiagnosis
}

/**
 * Draw a word, get it checked, see exactly what was wrong, fix only that, and be
 * checked again. One primary action at a time. The pass or fail still comes from
 * the handwriting classifier; the review explains it.
 */
export function HanziDrawing({ word, task, handwriting, solved, onChecked, onAssist, onTypeInstead }: {
  /** The lesson word the learner is drawing. */
  word: string
  /** The instruction, restated in the report. It never contains the answer. */
  task: string
  handwriting: HandwritingAssessor
  /** The word has been recalled: show the confirmed report and nothing to act on. */
  solved: boolean
  onChecked: (result: DrawingResult) => void
  /** Anything that reveals part of the answer makes the attempt assisted. */
  onAssist: () => void
  onTypeInstead: () => void
}) {
  const characters = Array.from(word)
  const count = characters.length
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const [drawings, setDrawings] = useState<InkDrawing[]>(() => blankWordInk(count))
  const [position, setPosition] = useState(0)
  const [phase, setPhase] = useState<'draw' | 'checking' | 'review'>('draw')
  /** Positions being redrawn after a check. null on the first attempt. */
  const [fixing, setFixing] = useState<number[] | null>(null)
  const [diagnosis, setDiagnosis] = useState<WordDiagnosis | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  const [comparison, setComparison] = useState<ReviewComparison | null>(null)
  const [shown, setShown] = useState<number[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [outcome, setOutcome] = useState<DrawingResult['outcome'] | null>(null)

  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // A new phase starts at its own top: the report from its headline, the pad from the task line.
    const body = root.current?.closest<HTMLElement>('.overlay-body')
    if (body && attempt > 0 && phase !== 'checking') body.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [phase, attempt])

  const order = fixing ?? drawings.map((_, index) => index)
  const lastInOrder = order[order.length - 1]
  const atLast = position === lastInOrder
  const current = drawings[position] ?? []
  const firstEmpty = drawings.findIndex((drawing) => drawing.length === 0)
  const ready = handwriting.status === 'ready'

  async function check() {
    if (!wordInkComplete(drawings) || !ready) return
    setPhase('checking')
    setError('')
    try {
      const result = await handwriting.assess(drawings, word)
      if (!mounted.current) return
      const next = reviewDrawing({ task, characterCount: count }, result)
      setComparison(review ? compareReviews(review, next) : null)
      setDiagnosis(result)
      setReview(next)
      setShown([])
      setOutcome(result.assessment.status)
      setAttempt((value) => value + 1)
      setPhase('review')
      // A stroke-level correction is help. A failed review means the attempt was not unaided.
      if (next.verdict === 'revise') onAssist()
      onChecked({ outcome: result.assessment.status, review: next, diagnosis: result })
    } catch {
      if (!mounted.current) return
      setPhase('draw')
      setError(t('Handwriting could not be checked. Retry, or type the word. This attempt isn’t scored.'))
    }
  }

  function advance() {
    if (atLast) { void check(); return }
    const next = order[order.indexOf(position) + 1]
    if (next !== undefined) setPosition(next)
  }

  function startFix() {
    if (!diagnosis) return
    const positions = positionsToFix(diagnosis)
    if (!positions.length) return
    setDrawings(inkForRetry(drawings, diagnosis))
    setFixing(positions)
    setPosition(positions[0])
    setPhase('draw')
    setError('')
  }

  function reveal(index: number) {
    setShown((list) => list.includes(index) ? list : [...list, index])
    onAssist()
  }

  if (solved && review) {
    return <ReviewReport review={review} comparison={comparison} compact revealed={() => true} />
  }

  if (phase === 'review' && review && diagnosis) {
    const fix = positionsToFix(diagnosis)
    const unverifiedOnly = review.verdict === 'unverified'
    return (
      <div className="hanzi-review" ref={root}>
        <ReviewReport review={review} comparison={comparison} revealed={(check) => {
          const match = /^char-(\d+)-/.exec(check.id)
          return !!match && shown.includes(Number(match[1]) - 1)
        }} />
        {outcome === 'uncertain' && <p className="hanzi-unscored">{t('Not scored. The handwriting could not be read with confidence, so this attempt does not count for or against you.')}</p>}
        {fix.map((index) => (
          <article className="hanzi-fix" key={index}>
            <h4>{count === 1 ? t('Your character') : t('Character {n}', { n: index + 1 })}</h4>
            <div className="hanzi-fix-pair">
              <figure>
                <InkThumb drawing={drawings[index]} label={t('Your drawing of character {n}', { n: index + 1 })} />
                <figcaption>{drawings[index].length === 1 ? t('You drew · {n} stroke', { n: drawings[index].length }) : t('You drew · {n} strokes', { n: drawings[index].length })}</figcaption>
              </figure>
              <figure>
                {shown.includes(index)
                  ? <StrokeWord text={characters[index]} className="hanzi-fix-strokes" showAttribution={false} />
                  : <button type="button" className="btn btn-ghost hanzi-reveal" onClick={() => reveal(index)}>{t('Show the correct strokes')}</button>}
                <figcaption>{shown.includes(index) ? t('Correct · {n} strokes', { n: diagnosis.characters[index]?.expectedStrokes ?? '?' }) : t('Counts as help')}</figcaption>
              </figure>
            </div>
          </article>
        ))}
        <div className="hanzi-actions">
          {fix.length > 0 && <button type="button" className="btn hanzi-primary" onClick={startFix}>{unverifiedOnly ? t('Redraw it more clearly') : redrawLabel(fix, count)}</button>}
          <button type="button" className="btn btn-ghost" onClick={onTypeInstead}>{t('Type the word instead')}</button>
        </div>
      </div>
    )
  }

  const here = review?.issues.filter((check) => check.id.startsWith(`char-${position + 1}-`) && check.fix) ?? []
  const primaryLabel = phase === 'checking' ? t('Checking…')
    : !atLast ? t('Next character')
      : fixing ? t('Check again')
        : count === 1 ? t('Check character') : t('Check word')
  return (
    <div className="hanzi-draw" data-phase={phase} data-fixing={!!fixing} ref={root}>
      <p className="hanzi-task">{task}</p>
      {count > 1 && <div className="hanzi-slots" role="group" aria-label={t('Characters in your word')}>
        {drawings.map((drawing, index) => {
          const locked = !!fixing && !fixing.includes(index)
          const reachable = fixing ? fixing.includes(index) : firstEmpty === -1 || index <= firstEmpty
          return (
            <button key={index} type="button" className="hanzi-slot" aria-label={locked ? t('Character {n}, correct, locked', { n: index + 1 }) : drawing.length ? t('Character {n}, drawn', { n: index + 1 }) : t('Character {n}, empty', { n: index + 1 })}
              aria-current={position === index ? 'step' : undefined} data-state={locked ? 'locked' : position === index ? 'current' : drawing.length ? 'done' : 'empty'}
              disabled={phase === 'checking' || locked || !reachable} onClick={() => setPosition(index)}>
              {drawing.length ? <InkThumb drawing={drawing} label="" /> : <span>{index + 1}</span>}
              {locked && <i aria-hidden="true"><CheckIcon size={11} /></i>}
            </button>
          )
        })}
      </div>}
      {here.length > 0 && <p className="hanzi-note"><b>{t('Fix')}</b>{here[0].fix}</p>}
      <HandwritingPad drawing={current} position={position + 1} total={count} disabled={phase === 'checking'}
        onChange={(drawing) => { setDrawings((previous) => replaceCharacterInk(previous, position, drawing)); setError('') }} />
      <div className="hanzi-actions">
        <button type="button" className="btn hanzi-primary" disabled={phase === 'checking' || !current.length || (atLast && !ready)} onClick={advance}>
          {atLast && !ready && phase !== 'checking' && handwriting.status === 'loading' ? t('Getting ready…') : primaryLabel}
        </button>
        {error && <p className="hanzi-error" role="alert">{error}</p>}
        {handwriting.status === 'error' && <button type="button" className="btn btn-ghost" onClick={handwriting.retry}>{t('Retry the handwriting dictionary')}</button>}
      </div>
    </div>
  )
}
