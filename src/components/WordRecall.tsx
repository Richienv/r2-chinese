import { useEffect, useId, useRef, useState } from 'react'
import { RecallFeedback } from './LearningMotion'
import { HearButton } from './Hear'
import { HandwritingPad, useHandwritingWordAssessment } from './HandwritingPad'
import { ListenCue } from './ListenCue'
import { StrokeWord } from './StrokeWord'
import { StudyDisplayControls } from './StudyDisplayControls'
import { playCorrect, playReveal, playWrong } from '../lib/sfx'
import { normalizeChinese } from '../lib/production'
import { hintLadder, type DrillCue, type HintStep } from '../lib/drillRounds'
import { blankWordInk, handwritingRecallEvidence, handwritingRetryMessage, replaceCharacterInk, wordInkComplete } from '../lib/handwriting-recall'
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
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const { prefs } = useStore()
  const characterCount = Array.from(normalizeChinese(word.zh)).length
  const [answer, setAnswer] = useState('')
  const [inputMode, setInputMode] = useState<'type' | 'draw'>('type')
  const [drawings, setDrawings] = useState(() => blankWordInk(characterCount))
  const [position, setPosition] = useState(0)
  const [hint, setHint] = useState(0)
  const [missed, setMissed] = useState(false)
  const [solved, setSolved] = useState(false)
  const [resultAssisted, setResultAssisted] = useState(false)
  const [feedback, setFeedback] = useState<'retry' | 'uncertain' | 'error' | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [checkCount, setCheckCount] = useState(0)
  const [checking, setChecking] = useState(false)
  const handwriting = useHandwritingWordAssessment(inputMode === 'draw')
  const assisted = hint > 0 || missed || externallyAssisted
  const inkComplete = wordInkComplete(drawings)

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
    const correct = normalizeChinese(answer) === normalizeChinese(word.zh)
    setFeedbackMessage('Try again. Bring back the lesson word.')
    score(correct, assisted)
  }

  async function checkDrawing() {
    if (solved || checking || !inkComplete || handwriting.status !== 'ready') return
    const wasAssisted = assisted
    setChecking(true)
    setFeedback(null)
    try {
      const assessment = await handwriting.assess(drawings, normalizeChinese(word.zh))
      if (!mounted.current) return
      const correct = handwritingRecallEvidence(assessment.status)
      if (correct === undefined) {
        setFeedback('uncertain')
        setFeedbackMessage(handwritingRetryMessage(assessment))
        setCheckCount((value) => value + 1)
      } else {
        setFeedbackMessage(correct ? '' : handwritingRetryMessage(assessment))
        score(correct, wasAssisted)
      }
    } catch {
      if (!mounted.current) return
      setFeedback('error')
      setFeedbackMessage('Handwriting could not be checked. Retry the dictionary, or type the word. This attempt isn’t scored.')
      setCheckCount((value) => value + 1)
    } finally { if (mounted.current) setChecking(false) }
  }

  return (
    <section className="production-stage word-recall">
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
      {!solved && <div className="word-recall-input-mode" aria-label="Answer input mode">
        <button type="button" className="btn btn-ghost" disabled={checking} aria-pressed={inputMode === 'type'} onClick={() => { setInputMode('type'); setFeedback(null) }}>Type Hanzi</button>
        <button type="button" className="btn btn-ghost" disabled={checking} aria-pressed={inputMode === 'draw'} onClick={() => { setInputMode('draw'); setFeedback(null) }}>Draw with finger or pen</button>
      </div>}
      {!solved && inputMode === 'draw' && <div className="handwriting-recall" aria-describedby={`${inputId}-feedback`}>
        <div className="handwriting-positions" role="group" aria-label="Characters in your word">
          {drawings.map((drawing, index) => <button type="button" key={index} className="handwriting-position" aria-current={position === index ? 'step' : undefined} aria-label={`Character ${index + 1}${drawing.length ? ', drawn' : ', empty'}`} data-drawn={drawing.length > 0} disabled={checking || (index > position && !drawings.slice(0, index).every((ink) => ink.length > 0))} onClick={() => setPosition(index)}><span>{index + 1}</span><small>{drawing.length ? 'Drawn' : 'Empty'}</small></button>)}
        </div>
        <HandwritingPad drawing={drawings[position]} position={position + 1} total={drawings.length} disabled={checking} onChange={(drawing) => { setDrawings((previous) => replaceCharacterInk(previous, position, drawing)); setFeedback(null) }} />
        <div className="handwriting-navigation">
          {position > 0 && <button type="button" className="btn btn-ghost" disabled={checking} onClick={() => setPosition((value) => value - 1)}>Previous character</button>}
          {position < drawings.length - 1 && <button type="button" className="btn" disabled={checking || !drawings[position].length} onClick={() => setPosition((value) => value + 1)}>Next character</button>}
          {position === drawings.length - 1 && <button type="button" className="btn" disabled={checking || !inkComplete || handwriting.status !== 'ready'} onClick={() => void checkDrawing()}>{checking ? 'Checking the word…' : 'Check whole word'}</button>}
        </div>
        <div className="handwriting-status" role="status" aria-live="polite">
          {handwriting.status === 'loading' ? 'Getting ready… You can start drawing.' : handwriting.status === 'checking' ? 'Checking your handwriting…' : handwriting.status === 'error' ? 'Handwriting could not load. Retry, or use Type Hanzi.' : 'Ready. Check after the whole word.'}
        </div>
        {handwriting.status === 'error' && <button type="button" className="btn btn-ghost" onClick={handwriting.retry}>Retry dictionary</button>}
        {drawings.some((drawing) => drawing.length > 0) && <button type="button" className="btn btn-ghost handwriting-restart" disabled={checking} onClick={() => { setDrawings(blankWordInk(characterCount)); setPosition(0); setFeedback(null) }}>Start drawing again</button>}
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
      {!solved && (
        <div className="production-actions">
          <button type="button" className="btn btn-ghost" disabled={hint >= ladder.length || checking} onClick={() => {
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
        {solved ? <RecallFeedback key={checkCount} state="correct" label={resultAssisted ? 'Retrieved with support' : 'Retrieved without a hint'} /> : feedback && <RecallFeedback key={checkCount} state={feedback === 'retry' ? 'retry' : 'idle'} label={feedbackMessage} />}
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
