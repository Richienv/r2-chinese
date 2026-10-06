import { useEffect, useMemo, useRef, useState } from 'react'
import { Glossed, useGloss } from './ChineseText'
import { HearButton } from './Hear'
import { ReviewReport } from './ReviewReport'
import { buildRecheck, retestQuestions, reviewRecheck, type RecheckAnswer, type RecheckQuestion } from '../lib/dialogue-check'
import { compareReviews, type Review } from '../lib/review'
import { playCorrect, playWrong } from '../lib/sfx'
import { unlockSpeech } from '../lib/speech'
import { LINE_RATE, VOICE } from '../lib/voices'
import type { LessonText, Vocab } from '../lib/types'

export interface RecheckSummary {
  total: number
  /** Right on the first try, with nothing shown first. */
  unaided: number
  /** Misses still wrong when the learner moved on. */
  unresolved: number
}

/**
 * Recall check after a dialogue: question, choice, immediate check against the
 * book's own line, a report, and a retest of the misses. The learner may move on
 * with misses open, but never without being told what they are.
 */
export function DialogueRecheck({ text, words, onRecord, onDone }: {
  text: LessonText
  /** The lesson words that appear in this text. */
  words: Vocab[]
  /** A key word was asked: recognition evidence only, assisted once the answer has been seen. */
  onRecord: (word: string, correct: boolean, assisted: boolean) => void
  onDone: (summary: RecheckSummary) => void
}) {
  const all = useMemo(() => buildRecheck(text, words), [text, words])
  const { onWord, sheet } = useGloss()
  const [round, setRound] = useState<RecheckQuestion[]>(all)
  const [attempt, setAttempt] = useState(0)
  const [position, setPosition] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [answers, setAnswers] = useState<RecheckAnswer[]>([])
  const [phase, setPhase] = useState<'ask' | 'report'>('ask')
  const [review, setReview] = useState<Review | null>(null)
  const [previous, setPrevious] = useState<Review | null>(null)
  const firstTry = useRef<Record<string, boolean>>({})
  const root = useRef<HTMLDivElement>(null)
  const task = 'Answer from what the dialogue said'

  useEffect(() => {
    root.current?.closest<HTMLElement>('.session-body, .overlay-body')?.scrollTo({ top: 0 })
  }, [phase, position, attempt])

  if (!all.length) {
    return <div ref={root}><p className="sub">No check for this text.</p><button type="button" className="btn" onClick={() => onDone({ total: 0, unaided: 0, unresolved: 0 })}>Continue</button></div>
  }

  const question = round[position]
  const right = picked !== null && question && picked === question.answer

  function pick(option: string) {
    if (picked !== null || !question) return
    const correct = option === question.answer
    setPicked(option)
    if (attempt === 0) firstTry.current[question.id] = correct
    if (question.word) onRecord(question.word, correct, attempt > 0)
    if (correct) playCorrect(); else playWrong()
  }

  function next() {
    if (!question || picked === null) return
    const updated = [...answers.filter((answer) => answer.id !== question.id), { id: question.id, picked }]
    setAnswers(updated)
    setPicked(null)
    if (position < round.length - 1) { setPosition(position + 1); return }
    // The report always covers the whole check, with the latest answer to each question.
    const report = reviewRecheck(task, all, updated)
    setPrevious(review)
    setReview(report)
    setPhase('report')
  }

  function retest() {
    const again = retestQuestions(all, answers, attempt + 1)
    if (!again.length) return
    setRound(again)
    setAttempt(attempt + 1)
    setPosition(0)
    setPicked(null)
    setPhase('ask')
  }

  function finish() {
    const unresolved = review ? review.issues.filter((check) => check.id !== 'answered-all').length : 0
    onDone({ total: all.length, unaided: all.filter((entry) => firstTry.current[entry.id]).length, unresolved })
  }

  if (phase === 'report' && review) {
    const change = previous ? compareReviews(previous, review) : null
    const open = review.issues.filter((check) => check.id !== 'answered-all').length
    return (
      <div ref={root} className="recheck-report">
        <header className="session-step-head"><div className="kicker-ink">Dialogue check · results</div><h2 className="session-step-title">{open ? 'What to fix before moving on' : 'You recalled the dialogue'}</h2></header>
        <ReviewReport review={review} comparison={change} revealed={() => true}>
          <div className="recheck-actions">
            {open > 0 && <button type="button" className="btn" onClick={retest}>Retest the {open === 1 ? 'one I missed' : `${open} I missed`}</button>}
            <button type="button" className={open ? 'btn btn-ghost' : 'btn'} onClick={finish}>{open ? 'Move on with these still open' : 'Continue'}</button>
          </div>
        </ReviewReport>
        {sheet}
      </div>
    )
  }

  return (
    <div ref={root} className="recheck">
      <header className="session-step-head">
        <div className="kicker-ink">{attempt > 0 ? `Retest · ${position + 1} of ${round.length}` : `Dialogue check · ${position + 1} of ${round.length}`}</div>
        <h2 className="session-step-title">{question.prompt}</h2>
      </header>
      <div className="card session-prompt recheck-context">
        {question.context.speaker && <p className="recheck-speaker">{question.context.speaker}</p>}
        <p className="zh" lang="zh-CN"><Glossed text={question.context.zh} onWord={onWord} /></p>
        {question.kind !== 'word' && <HearButton text={question.context.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label="Hear the line" />}
        {question.clue && <p className="sub recheck-clue">Meaning: {question.clue}</p>}
      </div>
      <div className="session-options" role="group" aria-label="Choices">
        {question.options.map((option) => {
          const state = picked === null ? undefined : option === question.answer ? 'correct' : option === picked ? 'wrong' : undefined
          return (
            <button key={option} type="button" className={`option zh${state === 'correct' ? ' yl-correct' : state === 'wrong' ? ' yl-wrong' : ''}`} lang="zh-CN" data-state={state}
              disabled={picked !== null} onPointerDown={() => unlockSpeech()} onClick={() => pick(option)}>{option}</button>
          )
        })}
      </div>
      {picked !== null && (
        <div className="recheck-feedback" data-right={right} role="status" aria-live="polite">
          <strong>{right ? 'Right' : 'Not quite'}</strong>
          {!right && <p className="recheck-compare"><span>You chose</span><span className="zh" lang="zh-CN">{picked}</span><span>The dialogue has</span><span className="zh" lang="zh-CN">{question.answer}</span></p>}
          <p className="recheck-quote">{question.explanation}</p>
          <button type="button" className="btn" onClick={next}>{position < round.length - 1 ? 'Next question' : 'See results'}</button>
        </div>
      )}
      {sheet}
    </div>
  )
}
