import { useId, useState } from 'react'
import { RecallFeedback } from './LearningMotion'
import { HearButton } from './Hear'
import { useHandwritingWordAssessment } from './HandwritingPad'
import { HanziDrawing, type DrawingResult } from './HanziDrawing'
import { ListenCue } from './ListenCue'
import { ReviewReport } from './ReviewReport'
import { StrokeWord } from './StrokeWord'
import { StudyDisplayControls } from './StudyDisplayControls'
import { playCorrect, playReveal, playWrong } from '../lib/sfx'
import { normalizeChinese } from '../lib/production'
import { hintLadder, type DrillCue, type HintStep } from '../lib/drillRounds'
import { handwritingRecallEvidence, handwritingRetryMessage } from '../lib/handwriting-recall'
import { recallTask } from '../lib/drawing-flow'
import { compareReviews, type Review, type ReviewComparison } from '../lib/review'
import { reviewTypedWord } from '../lib/word-review'
import { useStore } from '../store/store'
import type { Vocab } from '../lib/types'

const HEADINGS: Record<DrillCue, string> = {
  meaning: 'Find the word in your memory',
  sound: 'Hear it, then write it',
  pinyin: 'From the sound to the Hanzi',
}
const HINT_TITLES: Record<HintStep, string> = { meaning: 'Meaning', first: 'First character', pinyin: 'Pinyin', word: 'Book word' }
const HINT_BUTTONS: Record<HintStep, string> = { meaning: 'Reveal the meaning', first: 'Reveal the first character', pinyin: 'Reveal pinyin', word: 'Reveal the word' }

/**
 * Production before recognition: a lesson word must be retrieved, not picked.
 * `cue` changes what is shown (the meaning by default, or the word's sound, or
 * its pinyin); the answer is always the Hanzi, typed or drawn.
 */
export function WordRecall({ word, n, of, cue = 'meaning', showStrokes = false, externallyAssisted = false, onAssistance, onAttempt, onComplete }: {
  word: Vocab
  n: number
  of: number
  cue?: DrillCue
  /** Replay the word's stroke order once it has been recalled. */
  showStrokes?: boolean
  externallyAssisted?: boolean
  onAssistance?: () => void
  onAttempt: (correct: boolean, assisted: boolean) => void
  onComplete: () => void
}) {
  const ladder = hintLadder(cue)
  const inputId = useId()
  const { prefs } = useStore()
  const characterCount = Array.from(normalizeChinese(word.zh)).length
  const [answer, setAnswer] = useState('')
  const [inputMode, setInputMode] = useState<'type' | 'draw'>('type')
  const [drawStarted, setDrawStarted] = useState(false)
  const [hint, setHint] = useState(0)
  const [missed, setMissed] = useState(false)
  const [helped, setHelped] = useState(false)
  const [solved, setSolved] = useState(false)
  const [resultAssisted, setResultAssisted] = useState(false)
  const [feedback, setFeedback] = useState<'retry' | 'uncertain' | 'error' | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [checkCount, setCheckCount] = useState(0)
  const [typedReview, setTypedReview] = useState<Review | null>(null)
  const [typedChange, setTypedChange] = useState<ReviewComparison | null>(null)
  const handwriting = useHandwritingWordAssessment(inputMode === 'draw')
  const assisted = hint > 0 || missed || helped || externallyAssisted

  function score(correct: boolean, wasAssisted: boolean) {
    setCheckCount((value) => value + 1)
    onAttempt(correct, wasAssisted)
    if (correct) {
      // The parent may immediately persist the visible-answer assistance flag.
      // Keep the outcome of this attempt stable after that update.
      setResultAssisted(wasAssisted)
      setSolved(true)
      setFeedback(null)
      playCorrect()
    } else {
      setMissed(true)
      setFeedback('retry')
      playWrong()
    }
  }

  function checkTyped() {
    if (!normalizeChinese(answer) || solved) return
    const review = reviewTypedWord(recallTask('Type', cue, word, characterCount), answer, word.zh)
    // Only a fully passing review is a correct answer; the exact-match rule is the same one as before.
    const correct = normalizeChinese(answer) === normalizeChinese(word.zh)
    setTypedChange(typedReview ? compareReviews(typedReview, review) : null)
    setTypedReview(review)
    setFeedbackMessage('Try again. Bring back the lesson word.')
    score(correct, assisted)
  }

  function drawingChecked({ outcome, diagnosis }: DrawingResult) {
    const correct = handwritingRecallEvidence(outcome)
    setCheckCount((value) => value + 1)
    if (correct === undefined) {
      // Unreadable ink says nothing about what the learner knows: nothing is scored.
      setFeedback('uncertain')
      setFeedbackMessage(handwritingRetryMessage(diagnosis.assessment))
    } else {
      setFeedbackMessage('')
      score(correct, assisted)
    }
  }

  function assist() {
    setHelped(true)
    onAssistance?.()
  }

  return (
    <section className="production-stage word-recall" data-mode={inputMode}>
      <header className="production-heading">
        <p className="sub">Recall · {n} of {of}</p>
        <h2 className="session-step-title">{HEADINGS[cue]}</h2>
      </header>
      <div className="production-prompt" data-cue={cue}>
        {cue === 'meaning' && <>
          <p className="production-en">{word.en}</p>
          <p className="sub">The word from this lesson. Type it, or draw the Hanzi.</p>
        </>}
        {cue === 'sound' && <>
          <ListenCue text={word.zh} />
          <p className="sub">Listen as often as you like, then type it or draw the Hanzi.</p>
        </>}
        {cue === 'pinyin' && <>
          <p className="production-pinyin">{word.pinyin}</p>
          <p className="sub">Sound it out, then type it or draw the Hanzi.</p>
        </>}
      </div>
      {!solved && <div className="word-recall-input-mode" role="group" aria-label="How to answer">
        <button type="button" className="btn btn-ghost" aria-pressed={inputMode === 'type'} onClick={() => { setInputMode('type'); setFeedback(null) }}>Type it</button>
        <button type="button" className="btn btn-ghost" aria-pressed={inputMode === 'draw'} onClick={() => { setInputMode('draw'); setDrawStarted(true); setFeedback(null) }}>Draw it</button>
      </div>}
      {drawStarted && <div className="hanzi-host" hidden={inputMode !== 'draw'} aria-describedby={`${inputId}-feedback`}>
        <HanziDrawing word={normalizeChinese(word.zh)} task={recallTask('Draw', cue, word, characterCount)} handwriting={handwriting} solved={solved}
          onChecked={drawingChecked} onAssist={assist} onTypeInstead={() => { setInputMode('type'); setFeedback(null) }} />
      </div>}
      {!solved && inputMode === 'type' && <form className="production-form" onSubmit={(event) => { event.preventDefault(); checkTyped() }}>
        <label htmlFor={inputId}>Your word</label>
        <input
          id={inputId}
          className="production-input zh"
          lang="zh-CN"
          value={answer}
          onChange={(event) => { setAnswer(event.target.value); setFeedback(null) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
          }}
          placeholder="输入汉字"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={`${inputId}-feedback`}
        />
        <button className="btn" type="submit" disabled={!answer.trim()}>Check recall</button>
      </form>}
      {inputMode === 'type' && typedReview && (solved || typedReview.verdict !== 'passed') && <ReviewReport review={typedReview} comparison={typedChange} compact={solved} revealed={() => solved} />}
      {!solved && (
        <div className="production-actions">
          <button type="button" className="btn btn-ghost" disabled={hint >= ladder.length} onClick={() => {
            setHint((value) => Math.min(ladder.length, value + 1))
            onAssistance?.()
            playReveal()
          }}>{hint >= ladder.length ? 'Word revealed' : hint === 0 ? 'Reveal a hint' : HINT_BUTTONS[ladder[hint]]}</button>
          <span className="sub">Hints help learning; they count as assisted.</span>
        </div>
      )}
      {hint > 0 && !solved && (
        <div className="production-hint" key={hint}>
          <span>{HINT_TITLES[ladder[hint - 1]]}</span>
          <strong className={ladder[hint - 1] === 'pinyin' || ladder[hint - 1] === 'meaning' ? '' : 'zh'} lang={ladder[hint - 1] === 'pinyin' || ladder[hint - 1] === 'meaning' ? undefined : 'zh-CN'}>
            {ladder[hint - 1] === 'first' ? `${Array.from(word.zh)[0]}${'＿'.repeat(Math.max(0, Array.from(word.zh).length - 1))}` : ladder[hint - 1] === 'pinyin' ? word.pinyin : ladder[hint - 1] === 'meaning' ? word.en : word.zh}
          </strong>
        </div>
      )}
      <div id={`${inputId}-feedback`} aria-live="polite">
        {solved ? <RecallFeedback key={checkCount} state="correct" label={resultAssisted ? 'Retrieved with support' : 'Retrieved without a hint'} /> : feedback && inputMode === 'type' && <RecallFeedback key={checkCount} state={feedback === 'retry' ? 'retry' : 'idle'} label={feedbackMessage} />}
      </div>
      {solved && (
        <div className="production-source">
          {showStrokes ? <StrokeWord text={word.zh} className="drill-strokes" showAttribution={false} /> : <p className="zh" lang="zh-CN">{word.zh}</p>}
          {prefs.showPinyin && <p>{word.pinyin}</p>}
          {prefs.showEnglish && <p>{word.en}</p>}
          <HearButton text={word.zh} label="Hear the word" />
          {prefs.showEnglish && <p className="sub">{resultAssisted ? 'You’ll meet this word again for an unaided attempt.' : 'One successful retrieval. Future sessions check whether it stays.'}</p>}
          <button type="button" className="btn production-next" onClick={onComplete}>Continue</button>
        </div>
      )}
      <StudyDisplayControls />
    </section>
  )
}
