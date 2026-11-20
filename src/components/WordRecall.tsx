import '../styles/compact-session.css'
import { RepairEditor } from './RepairEditor'
import { useEffect, useId, useRef, useState } from 'react'
import { RecallFeedback } from './LearningMotion'
import { HearButton } from './Hear'
import { useHandwritingWordAssessment } from './HandwritingPad'
import { HanziDrawing, type DrawingResult } from './HanziDrawing'
import { ListenCue } from './ListenCue'
import { ReviewReport } from './ReviewReport'
import { StrokeWord } from './StrokeWord'
import { playAdvance, playCorrect, playHint, playReveal, playWrong } from '../lib/sfx'
import { blankedExample, exampleFor, vocabIndex } from '../lib/content'
import { characterTiles, coreMeaning, otherMeanings, type ExWord } from '../lib/exercises'
import { rng, seedOf, shuffle } from '../lib/seeded'
import { playTick } from '../lib/sfx'
import '../styles/duo.css'
import { useStagedReveal } from './useStagedReveal'
import { normalizeChinese } from '../lib/production'
import { hintLadder, type DrillCue, type HintStep } from '../lib/drillRounds'
import { handwritingRecallEvidence, handwritingRetryMessage } from '../lib/handwriting-recall'
import { getLang, t } from '../lib/i18n'
import { recallTask } from '../lib/drawing-flow'
import { canRecognizeMandarin, createMandarinRecognition, type RecognitionSnapshot } from '../lib/recognition'
import { compareReviews, type Review, type ReviewComparison } from '../lib/review'
import { reviewTypedWord } from '../lib/word-review'
import { useStore } from '../store/store'
import type { Vocab } from '../lib/types'

/**
 * How a book asks for a word: from its meaning (HSK 4), by dictation (汉语教程),
 * as the blank in a work sentence (Kerja), or out loud (Jiayin interview).
 */
export type RecallCue = DrillCue | 'sentence' | 'speak'
export type RecallAttemptMode = 'recall' | 'writing' | 'listening' | 'speaking'
export interface RecallResult {
  missed: boolean
  assisted: boolean
}

const HEADINGS: Record<DrillCue, string> = {
  meaning: t('Find the word in your memory'),
  sound: t('Hear it, then write it'),
  pinyin: t('From the sound to the Hanzi'),
}
const HINT_TITLES: Record<HintStep, string> = {
  meaning: t('Meaning'),
  first: t('First character'),
  pinyin: t('Pinyin'),
  word: t('Book word'),
}

interface RecallProps {
  word: Vocab
  n: number
  of: number
  cue?: RecallCue
  /** Replay the word's stroke order once it has been recalled. */
  showStrokes?: boolean
  externallyAssisted?: boolean
  /** The session will ask this word again if it needed help. */
  repeatOnHelp?: boolean
  onAssistance?: () => void
  onAttempt: (correct: boolean, assisted: boolean, mode: RecallAttemptMode) => void
  onComplete: (result: RecallResult) => void
}

/**
 * Production before recognition: a lesson word must be retrieved, not picked.
 * The cue changes what is shown; the answer is always the Hanzi (typed, drawn or said).
 */
const CUE_CHOICES: { id: RecallCue; label: string }[] = [
  { id: 'meaning', label: t('From the meaning') },
  { id: 'sound', label: t('From the sound') },
  { id: 'sentence', label: t('From the sentence') },
  { id: 'speak', label: t('Say it') },
]

/** The sitting picks a default; the learner can switch how this word is retrieved. */
export function WordRecall(props: RecallProps) {
  const [cue, setCue] = useState<RecallCue>(props.cue ?? 'meaning')
  const body = cue === 'speak'
    ? <SpeakRecall key="speak" {...props} cue="speak" />
    : <TypedRecall key={cue} {...props} cue={cue} />
  return (
    <div className="recall-cue-host">
      <div className="recall-cue-choices" role="group" aria-label={t('How to recall')}>
        {CUE_CHOICES.map((choice) => (
          <button key={choice.id} type="button" aria-pressed={cue === choice.id} onClick={() => setCue(choice.id)}>
            {choice.label}
          </button>
        ))}
      </div>
      {body}
    </div>
  )
}

function hintText(step: HintStep, word: Vocab) {
  const chars = Array.from(word.zh)
  if (step === 'first') return `${chars[0]}${'＿'.repeat(Math.max(0, chars.length - 1))}`
  if (step === 'pinyin') return word.pinyin
  if (step === 'meaning') return word.en
  return word.zh
}

/** Every hint taken so far stays visible, so the learner can combine them. */
function HintStack({ steps, word }: { steps: HintStep[]; word: Vocab }) {
  const shown = steps.filter((step) => step !== 'word')
  if (!shown.length) return null
  return (
    <div className="recall-hint-stack" aria-live="polite">
      {shown.map((step) => {
        const zh = step === 'first'
        return (
          <div className="production-hint" key={step}>
            <span>{HINT_TITLES[step]}</span>
            <strong className={zh ? 'zh' : ''} lang={zh ? 'zh-CN' : undefined}>
              {hintText(step, word)}
            </strong>
          </div>
        )
      })}
    </div>
  )
}

function HintButton({ ladder, hint, onClick, nudge }: { ladder: HintStep[]; hint: number; onClick: () => void; nudge?: boolean }) {
  const last = ladder[hint] === 'word' || hint >= ladder.length
  return (
    <button type="button" className="recall-hint-button" data-nudge={nudge || undefined} onClick={onClick}>
      <HintGlyph />
      {last ? t('Show answer') : t('Hint')}
      <span className="recall-hint-steps" aria-hidden="true">
        {ladder.map((step, index) => <i key={step} data-on={index < hint} />)}
      </span>
    </button>
  )
}

function TypedRecall({
  word,
  n,
  of,
  cue: requested = 'meaning',
  showStrokes = false,
  externallyAssisted = false,
  repeatOnHelp = false,
  onAssistance,
  onAttempt,
  onComplete,
}: RecallProps) {
  const sentence = requested === 'sentence' ? blankedExample(word.zh) : null
  // A word the book never uses in a sentence is asked from its meaning instead.
  const cue: DrillCue = requested === 'sound' || requested === 'pinyin' ? requested : 'meaning'
  const ladder = hintLadder(cue)
  const inputId = useId()
  const characterCount = Array.from(normalizeChinese(word.zh)).length
  const [answer, setAnswer] = useState('')
  const [inputMode, setInputMode] = useState<'type' | 'draw' | 'tiles'>('type')
  const [drawStarted, setDrawStarted] = useState(false)
  const [hint, setHint] = useState(0)
  const [missed, setMissed] = useState(false)
  const [helped, setHelped] = useState(false)
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [resultAssisted, setResultAssisted] = useState(false)
  const [feedback, setFeedback] = useState<'retry' | 'uncertain' | 'error' | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [checkCount, setCheckCount] = useState(0)
  const [typedReview, setTypedReview] = useState<Review | null>(null)
  const [typedChange, setTypedChange] = useState<ReviewComparison | null>(null)
  const handwriting = useHandwritingWordAssessment(inputMode === 'draw')
  const assisted = hint > 0 || missed || helped || externallyAssisted
  const mode = (): RecallAttemptMode => (inputMode === 'draw' ? 'writing' : cue === 'sound' ? 'listening' : 'recall')

  function score(correct: boolean, wasAssisted: boolean) {
    setCheckCount((value) => value + 1)
    onAttempt(correct, wasAssisted, mode())
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
    setFeedbackMessage(t('Not quite'))
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

  function nextHint() {
    if (ladder[hint] === 'word' || hint >= ladder.length) {
      assist()
      setRevealed(true)
      playReveal()
      return
    }
    setHint((value) => Math.min(ladder.length, value + 1))
    onAssistance?.()
    playHint()
  }

  const hintButton = <HintButton ladder={ladder} hint={hint} onClick={nextHint} nudge={missed && hint === 0} />
  const typing = !solved && !revealed && inputMode === 'type' && !typedReview

  return (
    <section className="production-stage word-recall compact-recall" data-mode={inputMode} data-cue={sentence ? 'sentence' : cue} data-finished={solved || revealed}>
      <header className="compact-recall-heading" aria-label={t('Recall · {n} of {of}', { n, of })}>
        {sentence ? (
          <div className="recall-sentence">
            <p className="zh" lang="zh-CN">{sentence.blank}</p>
            {sentence.en && <p className="recall-sentence-translation">{sentence.en}</p>}
          </div>
        ) : (
          cue === 'meaning' ? <MeaningHeading gloss={word.en} /> : <h2>{HEADINGS[cue]}</h2>
        )}
        {cue === 'sound' && <ListenCue text={word.zh} />}
        {cue === 'pinyin' && <p className="production-pinyin">{word.pinyin}</p>}
      </header>
      {!solved && !revealed && (
        <div className="word-recall-input-mode" role="group" aria-label={t('How to answer')}>
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={inputMode === 'type'}
            onClick={() => {
              setInputMode('type')
              setFeedback(null)
            }}
          >
            {t('Type it')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={inputMode === 'draw'}
            onClick={() => {
              setInputMode('draw')
              setDrawStarted(true)
              setFeedback(null)
            }}
          >
            {t('Draw it')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={inputMode === 'tiles'}
            data-nudge={(missed && inputMode === 'type') || undefined}
            onClick={() => {
              setInputMode('tiles')
              setFeedback(null)
            }}
          >
            {t('Build it')}
          </button>
        </div>
      )}
      {inputMode === 'tiles' && !solved && !revealed && (
        <TileAnswer
          zh={normalizeChinese(word.zh)}
          onResult={(correct) => {
            // Choosing from offered characters is supported recall, never unaided.
            assist()
            score(correct, true)
          }}
        />
      )}
      {drawStarted && !revealed && (
        <div className="hanzi-host" hidden={inputMode !== 'draw'} aria-describedby={`${inputId}-feedback`}>
          <HanziDrawing
            word={normalizeChinese(word.zh)}
            task={recallTask('Draw', cue, word, characterCount)}
            handwriting={handwriting}
            solved={solved}
            onChecked={drawingChecked}
            onAssist={assist}
            onTypeInstead={() => {
              setInputMode('type')
              setFeedback(null)
            }}
          />
        </div>
      )}
      {typing && (
        <form
          className="production-form"
          onSubmit={(event) => {
            event.preventDefault()
            checkTyped()
          }}
        >
          <label className="sr-only" htmlFor={inputId}>{t('Your word')}</label>
          <input
            id={inputId}
            className="production-input zh"
            lang="zh-CN"
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value)
              setFeedback(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
                event.preventDefault()
            }}
            placeholder={t('Type the Hanzi here')}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={`${inputId}-feedback`}
          />
          <HintStack steps={ladder.slice(0, hint)} word={word} />
          <div className="recall-row">
            {hintButton}
            <button className="btn" type="submit" disabled={!answer.trim()}>
              {t('Check')}
            </button>
          </div>
        </form>
      )}
      {inputMode === 'type' && typedReview && !solved && !revealed && (
        <RepairEditor
          key={checkCount}
          response={answer}
          reference={word.zh}
          exact
          onApply={(next) => {
            setAnswer(next)
            assist()
            const correct = normalizeChinese(next) === normalizeChinese(word.zh)
            setTypedChange(
              compareReviews(
                typedReview,
                reviewTypedWord(recallTask('Type', cue, word, characterCount), next, word.zh),
              ),
            )
            setTypedReview(reviewTypedWord(recallTask('Type', cue, word, characterCount), next, word.zh))
            score(correct, true)
          }}
        />
      )}
      {inputMode === 'type' && typedReview && solved && (
        <details className="recall-answer-details"><summary>{t('Answer details')}</summary><ReviewReport review={typedReview} comparison={typedChange} compact revealed={() => true} /></details>
      )}
      {!typing && !solved && !revealed && (
        <>
          <HintStack steps={ladder.slice(0, hint)} word={word} />
          <div className="production-actions">{hintButton}</div>
        </>
      )}
      <div id={`${inputId}-feedback`} aria-live="polite">
        {solved ? (
          <RecallFeedback key={checkCount} state="correct" label={resultAssisted ? t('Practised with help') : undefined} />
        ) : (
          !revealed && feedback &&
          inputMode === 'type' && (
            <RecallFeedback
              key={checkCount}
              state={feedback === 'retry' ? 'retry' : 'idle'}
              label={feedbackMessage}
            />
          )
        )}
      </div>
      {(solved || revealed) && (
        <RecallAnswer
          word={word}
          showStrokes={showStrokes}
          assisted={revealed || resultAssisted}
          comesBack={repeatOnHelp && (revealed || resultAssisted || missed)}
          onComplete={() => onComplete({ missed: missed || revealed, assisted: revealed || resultAssisted })}
        />
      )}
    </section>
  )
}

const SPEAK_LADDER: HintStep[] = ['first', 'pinyin', 'word']

/** Say the word out loud. The browser transcript checks it when it can; otherwise the learner judges. */
function SpeakRecall({ word, n, of, externallyAssisted = false, repeatOnHelp = false, onAssistance, onAttempt, onComplete }: RecallProps) {
  const [hint, setHint] = useState(0)
  const [missed, setMissed] = useState(false)
  const [phase, setPhase] = useState<'ask' | 'judge' | 'done'>('ask')
  const [heard, setHeard] = useState('')
  const [snapshot, setSnapshot] = useState<RecognitionSnapshot>({ status: 'idle', interim: '', error: '' })
  const [result, setResult] = useState<RecallResult>({ missed: false, assisted: false })
  const assisted = hint > 0 || externallyAssisted
  const live = useRef({ assisted, phase, missed })
  live.current = { assisted, phase, missed }
  const recognition = useRef<ReturnType<typeof createMandarinRecognition> | null>(null)
  const canListen = canRecognizeMandarin()

  useEffect(() => {
    recognition.current = createMandarinRecognition({
      onState: setSnapshot,
      onFinal: (text) => {
        if (live.current.phase !== 'ask') return
        setHeard(text)
        if (normalizeChinese(text).includes(normalizeChinese(word.zh))) settle(true, live.current.assisted)
        else {
          setMissed(true)
          onAttempt(false, live.current.assisted, 'speaking')
          playWrong()
        }
      },
      language: getLang() === 'id' ? 'id' : 'en',
    })
    return () => recognition.current?.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.zh])

  function settle(correct: boolean, wasAssisted: boolean) {
    onAttempt(correct, wasAssisted, 'speaking')
    if (correct) playCorrect()
    else playWrong()
    setResult({ missed: live.current.missed || !correct, assisted: wasAssisted })
    setPhase('done')
  }

  function nextHint() {
    if (hint >= SPEAK_LADDER.length - 1) {
      onAssistance?.()
      playReveal()
      setHint(SPEAK_LADDER.length)
      setPhase('judge')
      return
    }
    onAssistance?.()
    playHint()
    setHint((value) => value + 1)
  }

  const listening = snapshot.status === 'listening' || snapshot.status === 'starting'
  return (
    <section className="production-stage word-recall compact-recall speak-recall" data-cue="speak" data-finished={phase === 'done'}>
      <header className="compact-recall-heading" aria-label={t('Recall · {n} of {of}', { n, of })}>
        <MeaningHeading gloss={word.en} />
        <p className="speak-recall-lead">{t('Say it in Mandarin')}</p>
      </header>
      {phase === 'ask' && (
        <>
          {canListen && (
            <button
              type="button"
              className="speak-recall-mic"
              data-listening={listening}
              aria-pressed={listening}
              onClick={() => (listening ? recognition.current?.stop() : recognition.current?.start())}
            >
              <MicGlyph />
              <span>{listening ? t('Listening…') : t('Tap and say it')}</span>
            </button>
          )}
          {(snapshot.interim || heard) && (
            <p className="speak-recall-heard" lang="zh-CN">{snapshot.interim || heard}</p>
          )}
          {snapshot.error && <p className="speak-recall-error">{snapshot.error}</p>}
          {missed && heard && <RecallFeedback state="retry" label={t('Not quite')} />}
          <HintStack steps={SPEAK_LADDER.slice(0, hint)} word={word} />
          <div className="recall-row">
            <HintButton ladder={SPEAK_LADDER} hint={hint} onClick={nextHint} nudge={missed && hint === 0} />
            <button type="button" className="btn" onClick={() => { playReveal(); setPhase('judge') }}>
              {t('Check yourself')}
            </button>
          </div>
        </>
      )}
      {phase === 'judge' && (
        <div className="speak-recall-judge">
          <p className="zh" lang="zh-CN">{word.zh}</p>
          <p className="recall-answer-pinyin">{word.pinyin}</p>
          <HearButton text={word.zh} label={t('Hear the word')} />
          <p className="speak-recall-question">{t('Did you say it right?')}</p>
          <div className="recall-row">
            <button type="button" className="recall-hint-button" onClick={() => settle(false, assisted)}>{t('Not yet')}</button>
            <button type="button" className="btn" onClick={() => settle(true, assisted || hint >= SPEAK_LADDER.length)}>{t('I said it')}</button>
          </div>
        </div>
      )}
      {phase === 'done' && (
        <RecallAnswer
          word={word}
          showStrokes={false}
          assisted={result.assisted || result.missed}
          comesBack={repeatOnHelp && (result.assisted || result.missed)}
          onComplete={() => onComplete(result)}
        />
      )}
    </section>
  )
}

const ANSWER_STAGES = [0, 520, 1050] as const

/** Hanzi and pinyin first, then the meaning, then the word in a sentence. */
function RecallAnswer({ word, showStrokes, assisted, comesBack, onComplete }: { word: Vocab; showStrokes: boolean; assisted: boolean; comesBack: boolean; onComplete: () => void }) {
  const { prefs } = useStore()
  const example = exampleFor(word.zh)
  const reveal = useStagedReveal(ANSWER_STAGES, word.zh)
  return (
    <div className="production-source recall-answer" data-assisted={assisted}>
      <div className="recall-answer-head" data-reveal={reveal.at(0)} data-reveal-kind="hanzi">
        {showStrokes ? (
          <StrokeWord text={word.zh} className="drill-strokes" showAttribution={false} />
        ) : (
          <p className="zh" lang="zh-CN">{word.zh}</p>
        )}
        {prefs.showPinyin && <p className="recall-answer-pinyin">{word.pinyin}</p>}
        <HearButton text={word.zh} label={t('Hear the word')} />
      </div>
      {prefs.showEnglish && <p className="recall-answer-meaning" data-reveal={reveal.at(1)}>{word.en}</p>}
      {example && (
        <div className="recall-answer-example" data-reveal={reveal.at(2)}>
          <p lang="zh-CN">{example.zh}</p>
          {prefs.showEnglish && example.en && <p className="recall-answer-translation">{example.en}</p>}
          <HearButton text={example.zh} label={t('Hear the line')} />
        </div>
      )}
      {comesBack && <p className="recall-comes-back" data-reveal={reveal.at(2)}>{t('This word comes back in a moment')}</p>}
      <button type="button" className="btn production-next" onClick={() => { playAdvance(); onComplete() }}>
        {t('Continue')}
      </button>
    </div>
  )
}

function HintGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
    </svg>
  )
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  )
}

/** The plain Indonesian word first; the other senses quietly below. */
function MeaningHeading({ gloss }: { gloss: string }) {
  const core = coreMeaning(gloss) || gloss
  const rest = otherMeanings(gloss)
  return (
    <>
      <h2>{core}</h2>
      {rest && <p className="recall-other-meanings">{rest}</p>}
    </>
  )
}

let tileSource: ExWord[] | null = null
const tilePool = () => (tileSource ??= shuffle(vocabIndex.filter((v) => v.tag !== 'proper').map((v) => ({ zh: v.zh, pinyin: v.pinyin, en: v.en })), rng(7)))

/** Build the word from offered characters: a way out of a blank, scored as help. */
function TileAnswer({ zh, onResult }: { zh: string; onResult: (correct: boolean) => void }) {
  const answer = Array.from(zh)
  const [tiles] = useState(() => characterTiles(zh, tilePool(), rng(seedOf(`recall-tiles:${zh}`))))
  const [placed, setPlaced] = useState<number[]>([])
  const [wrong, setWrong] = useState(false)
  useEffect(() => {
    if (placed.length !== answer.length) return
    const correct = placed.map((index) => tiles[index]).join('') === zh
    onResult(correct)
    if (correct) return
    setWrong(true)
    const timer = window.setTimeout(() => {
      setPlaced([])
      setWrong(false)
    }, 650)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed])
  return (
    <div className="recall-tiles">
      <div className="duo-slots" aria-live="polite">
        {answer.map((_, slot) => {
          const index = placed[slot]
          const filled = index !== undefined
          return (
            <button key={slot} type="button" className="duo-slot zh" lang="zh-CN" data-filled={filled || undefined}
              data-tone={wrong ? 'wrong' : undefined} disabled={!filled}
              onClick={() => filled && setPlaced((list) => list.filter((i) => i !== index))}
              aria-label={filled ? tiles[index] : t('Empty slot')}>
              {filled ? tiles[index] : ''}
            </button>
          )
        })}
      </div>
      <div className="duo-bank duo-bank-chars">
        {tiles.map((tile, index) => {
          const used = placed.includes(index)
          return (
            <span key={index} className="duo-tile-socket" style={{ ['--i' as string]: index }}>
              <button type="button" className="duo-tile zh" lang="zh-CN" data-used={used || undefined}
                disabled={used || placed.length >= answer.length}
                onClick={() => { playTick(); setPlaced((list) => [...list, index]) }}>{tile}</button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
