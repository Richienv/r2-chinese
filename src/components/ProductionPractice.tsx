import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { lookup, segment } from '../lib/content'
import { alignChinese, assessProduction, dialogueRoles, dialogueTurnIndexes, sourceWords, type ProductionAssessment, type ProductionResult } from '../lib/production'
import { canRecognizeMandarin, createMandarinRecognition, type RecognitionSnapshot } from '../lib/recognition'
import { playCorrect, playListen, playReveal, playWrong } from '../lib/sfx'
import { stopSpeech } from '../lib/speech'
import { t } from '../lib/i18n'
import type { GrammarExample, LessonText, TextLine } from '../lib/types'
import { HearButton, rateForChinese, useAutoSpeak, useSpeechActive } from './Hear'
import { VOICE, voiceForSpeaker } from '../lib/voices'
import { RecallFeedback, VoiceWaveform } from './LearningMotion'
import { Glossed, useGloss } from './ChineseText'
import { StudyDisplayControls } from './StudyDisplayControls'
import { useStore } from '../store/store'
import { buildGrammarCoach, type GrammarCoach } from '../lib/grammarCoach'
import { courseLexicon } from '../lib/grammar/course-lexicon'
import { reviewReply } from '../lib/reply-review'
import { compareReviews, type Review } from '../lib/review'
import { ReviewReport } from './ReviewReport'
import '../styles/production-review.css'
import '../styles/conversation.css'

type Mode = ProductionResult['mode']
type Attempt = { response: string; result: ProductionResult }

/** A source-faithful roleplay. Only the partner's lines are visible before recall. */
export function DialoguePractice({ text, lesson, targetWords, externallyAssisted = false, assistedTurns = [], onAssistance, onComplete }: {
  text: LessonText
  lesson: number
  targetWords?: string[]
  externallyAssisted?: boolean
  assistedTurns?: string[]
  onAssistance?: (turnId?: string) => void
  onComplete: (result: ProductionResult) => void
}) {
  const { onWord, sheet } = useGloss()
  const { prefs } = useStore()
  const roles = useMemo(() => dialogueRoles(text), [text])
  const [role, setRole] = useState(roles[1] ?? roles[0])
  const [turn, setTurn] = useState(0)
  const [partnerMuted, setPartnerMuted] = useState(false)
  const [roleAssisted, setRoleAssisted] = useState(false)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const indexes = useMemo(() => dialogueTurnIndexes(text, role), [text, role])
  const sourceIndex = indexes[turn]
  const turnScope = `${role}:${sourceIndex}`
  const line = text.lines[sourceIndex]
  const candidates = useMemo(() => targetWords ?? [...new Set(text.lines.flatMap((entry) => segment(entry.zh).filter((token) => token.vocab).map((token) => token.text)))], [targetWords, text])
  const finished = useRef(false)
  const exchange = useRef<HTMLDivElement>(null)
  const partner = text.lines.slice(0, sourceIndex).reverse().find((entry) => roles.length > 1 ? entry.speaker !== role : text.lines.indexOf(entry) % 2 === 0)
  const partnerIndex = partner ? text.lines.indexOf(partner) : -1
  useAutoSpeak(partnerMuted ? '' : partner?.zh ?? '', voiceForSpeaker(partner?.speaker ?? ''))
  useFiniteArrival(exchange, turnScope)

  function lookUpPartnerWord(word: Parameters<typeof onWord>[0]) {
    // Partner vocabulary can help any later reply, so this exposure is broad.
    setRoleAssisted(true)
    onAssistance?.()
    onWord(word)
  }

  function finishTurn(result: ProductionResult, response: string) {
    const updated = [...attempts, { response, result }]
    setAttempts(updated)
    if (turn < indexes.length - 1) {
      setTurn((current) => current + 1)
      setPartnerMuted(false)
      return
    }
    if (finished.current) return
    finished.current = true
    const results = updated.map((attempt) => attempt.result)
    onComplete({
      correct: results.every((item) => item.correct),
      assisted: results.some((item) => item.assisted),
      words: [...new Set(results.flatMap((item) => item.words))],
      mode: results.some((item) => item.mode === 'speaking') ? 'speaking' : 'writing',
      evidence: results.some((item) => item.evidence === 'practice') ? 'practice' : 'source-match',
      outcomes: results.flatMap((item) => item.outcomes ?? []),
    })
  }

  if (!line) {
    return <div className="production-practice"><p>{t('This source has no dialogue reply to practise.')}</p></div>
  }

  return (
    <section className="production-practice conversation" aria-label={t('Dialogue roleplay')}>
      <header className="conversation-heading">
        <h2>{t('Talk it through')}</h2>
        <div className="conversation-progress" aria-label={t('Reply {n} of {total}', { n: turn + 1, total: indexes.length })}>
          <span>{turn + 1} / {indexes.length}</span>
          <span className="conversation-progress-marks" aria-hidden="true">{indexes.map((_, index) => <i key={index} data-done={index < turn} data-current={index === turn} />)}</span>
        </div>
      </header>
      {roles.length > 1 && (
        <div className="conversation-role-switch" aria-label={t('Choose your role')}>
          <span>{t('You play')}</span>
          <div className="production-roles">
          {roles.map((speaker) => (
            <button type="button" key={speaker} className="btn btn-ghost" aria-pressed={role === speaker} disabled={attempts.length > 0} onClick={() => {
              // A previously visible partner line can become the new hidden reply.
              if (speaker !== role) {
                setRoleAssisted(true)
                onAssistance?.()
              }
              setRole(speaker)
              setTurn(0)
              setPartnerMuted(false)
            }}>
              <span lang="zh-CN">{speaker}</span>
            </button>
          ))}
          </div>
        </div>
      )}
      <div ref={exchange} className="conversation-exchange" data-turn={sourceIndex}>
        {partner && <PartnerLine line={partner} learnedWords={candidates} onWord={lookUpPartnerWord} />}
        <div className="conversation-reply-cue">
          <div className="conversation-cue-heading"><SpeakerToken speaker={roles.length > 1 ? role : line.speaker} own /><strong>{t('Your reply')}</strong><span>{t('Say in Mandarin')}</span></div>
          <p className="conversation-cue">{line.en}</p>
        </div>
        <ResponsePractice
          key={turnScope}
          example={line}
          targetWords={sourceWords(line.zh, candidates)}
          context={text.lines.slice(Math.max(0, sourceIndex - 2), sourceIndex).map((entry) => `${entry.speaker}: ${entry.zh}`).join('\n')}
          preferredMode="speaking"
          externallyAssisted={externallyAssisted || roleAssisted || assistedTurns.includes(turnScope)}
          onAssistance={() => onAssistance?.(turnScope)}
          onVoiceStart={() => setPartnerMuted(true)}
          continueLabel={turn < indexes.length - 1 ? t('Next reply') : t('Finish dialogue')}
          onComplete={finishTurn}
        />
      </div>
      <details className="conversation-context conversation-disclosure">
        <summary>{t('Scene & earlier turns')}<span>{t('Lesson {lesson}', { lesson })}</span></summary>
        <div className="conversation-context-body">
          <h3>{prefs.showEnglish ? text.heading_en || text.label : text.label}</h3>
          {text.lines.slice(0, sourceIndex).map((entry, index) => {
            if (index === partnerIndex) return null
            const attemptIndex = indexes.indexOf(index)
            const self = attemptIndex >= 0
            const past = self ? attempts[attemptIndex] : undefined
            return <div key={index} className="conversation-past-turn" data-self={self}>
              <span className="conversation-past-speaker">{self ? t('You') : entry.speaker || t('Partner')}</span>
              <DialogueTurnText text={past?.response ?? entry.zh} learnedWords={candidates} onWord={lookUpPartnerWord} voice={voiceForSpeaker(entry.speaker)} />
              {prefs.showPinyin && !self && <p className="production-pinyin">{entry.pinyin}</p>}
              {prefs.showEnglish && <p className="production-en">{entry.en}</p>}
              {!self && <HearButton text={entry.zh} voice={voiceForSpeaker(entry.speaker)} label={t('Hear this line')} />}
            </div>
          })}
          {sourceIndex <= 1 && <p className="conversation-context-note">{t('This is the opening exchange.')}</p>}
        </div>
      </details>
      {sheet}
    </section>
  )
}

function DialogueTurnText({ text, learnedWords, onWord, voice = VOICE.xiaoxiao }: { text: string; learnedWords: string[]; onWord: Parameters<typeof Glossed>[0]['onWord']; voice?: string }) {
  const playing = useSpeechActive(`${voice}|${rateForChinese(text)}|${text.trim()}`)
  return <p className="production-zh zh" lang="zh-CN" data-speaking={playing}><Glossed text={text} onWord={onWord} learnedWords={learnedWords} /></p>
}

function PartnerLine({ line, learnedWords, onWord }: { line: TextLine; learnedWords: string[]; onWord: Parameters<typeof Glossed>[0]['onWord'] }) {
  const { prefs } = useStore()
  const voice = voiceForSpeaker(line.speaker)
  const playing = useSpeechActive(`${voice}|${rateForChinese(line.zh)}|${line.zh.trim()}`)
  return <div className="conversation-partner" data-speaking={playing}>
    <SpeakerToken speaker={line.speaker} />
    <div className="conversation-bubble">
      <div className="conversation-bubble-heading"><strong lang={line.speaker ? 'zh-CN' : undefined}>{line.speaker || t('Partner')}</strong><HearButton text={line.zh} voice={voice} label={t('Hear')} /></div>
      <DialogueTurnText text={line.zh} learnedWords={learnedWords} onWord={onWord} voice={voice} />
      {prefs.showPinyin && <p className="production-pinyin">{line.pinyin}</p>}
      {prefs.showEnglish && <details className="conversation-partner-meaning"><summary>{t('Meaning')}</summary><p className="production-en">{line.en}</p></details>}
    </div>
  </div>
}

function SpeakerToken({ speaker, own = false }: { speaker: string; own?: boolean }) {
  const name = speaker.trim()
  const monogram = /[\u3400-\u9fff]/.test(name) ? Array.from(name)[0] : name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return <span className="conversation-speaker-token" data-own={own} aria-hidden="true">{monogram || <MicrophoneIcon />}</span>
}

/** Finite transitions respond to new content and cancel on live motion changes. */
function useFiniteArrival<T extends HTMLElement>(reference: RefObject<T>, trigger: unknown, enabled = true) {
  useEffect(() => {
    const element = reference.current
    if (!element || !enabled || typeof element.animate !== 'function') return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return
    const animation = element.animate([{ opacity: 0.45, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)' })
    const reduce = () => { if (preference.matches) animation.cancel() }
    preference.addEventListener('change', reduce)
    return () => { animation.cancel(); preference.removeEventListener('change', reduce) }
  }, [reference, trigger, enabled])
}

export function SentencePractice({ example, targetWords, grammar, lesson, externallyAssisted = false, onAssistance, onComplete }: {
  example: GrammarExample
  targetWords: string[]
  grammar?: string
  lesson: number
  externallyAssisted?: boolean
  onAssistance?: () => void
  onComplete: (result: ProductionResult) => void
}) {
  return (
    <section className="production-practice conversation conversation-sentence" aria-label={t('Create a Chinese sentence')}>
      <header className="conversation-heading">
        <h2>{t('Make it yours')}</h2><span className="conversation-lesson">{t('Lesson {lesson}', { lesson })}</span>
      </header>
      <div className="conversation-reply-cue"><div className="conversation-cue-heading"><strong>{t('The meaning')}</strong><span>{t('Write in Mandarin')}</span></div><p className="conversation-cue">{example.en}</p></div>
      <ResponsePractice
        key={`${lesson}:${example.zh}`}
        example={example}
        targetWords={sourceWords(example.zh, targetWords)}
        grammar={grammar}
        preferredMode="writing"
        externallyAssisted={externallyAssisted}
        onAssistance={onAssistance}
        continueLabel={t('Continue')}
        onComplete={onComplete}
      />
    </section>
  )
}

function ResponsePractice({ example, targetWords, grammar, context, preferredMode, externallyAssisted, onAssistance, onVoiceStart, continueLabel, onComplete }: {
  example: GrammarExample
  targetWords: string[]
  grammar?: string
  context?: string
  preferredMode: Mode
  externallyAssisted: boolean
  onAssistance?: () => void
  onVoiceStart?: () => void
  continueLabel: string
  onComplete: (result: ProductionResult, response: string) => void
}) {
  const id = useId()
  const { prefs } = useStore()
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<Mode>(preferredMode)
  const [hint, setHint] = useState(0)
  const [assisted, setAssisted] = useState(false)
  const [assessment, setAssessment] = useState<ProductionAssessment | null>(null)
  const [error, setError] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [reviewNote, setReviewNote] = useState(0)
  /** The review of the attempt being fixed, so the retest can say what changed. */
  const [previous, setPrevious] = useState<Review | null>(null)
  const [fixList, setFixList] = useState<string[]>([])
  const [recognition, setRecognition] = useState<RecognitionSnapshot>({ status: 'idle', interim: '', error: '' })
  const recognizer = useRef<ReturnType<typeof createMandarinRecognition> | null>(null)
  const baseTranscript = useRef('')
  const disposed = useRef(false)
  const latestValue = useRef(value)
  const hintPanel = useRef<HTMLDivElement>(null)
  const reviewPanel = useRef<HTMLDivElement>(null)
  latestValue.current = value
  const supported = canRecognizeMandarin()
  const listening = recognition.status === 'listening'
  const recording = listening || recognition.status === 'starting' || recognition.status === 'stopping'
  const sourceClues = targetWords.slice(0, 4).map((word) => ({ zh: word, en: lookup(word)?.en })).filter((word) => word.en)
  const feedbackState = listening ? 'listening' : assessment?.accepted === true ? 'correct' : assessment ? 'retry' : 'idle'
  const task = preferredMode === 'speaking' ? t('Reply in Mandarin: “{en}”', { en: example.en }) : t('Write in Mandarin: “{en}”', { en: example.en })
  const review = useMemo(() => assessment ? reviewReply({
    task, response: value.trim(), expectedZh: example.zh, assessment,
    glosses: Object.fromEntries(targetWords.flatMap((word) => { const gloss = lookup(word)?.en?.split(/[;,]/)[0]?.trim(); return gloss ? [[word, gloss]] : [] })),
  }) : null, [assessment]) // eslint-disable-line react-hooks/exhaustive-deps
  const change = review && previous ? compareReviews(previous, review) : null
  const reviewNotes = assessment ? [...new Set([assessment.feedback, ...assessment.issues].filter(Boolean))] : []
  useFiniteArrival(hintPanel, hint, hint > 0 && !assessment)
  useFiniteArrival(reviewPanel, assessment, !!assessment)

  useEffect(() => {
    disposed.current = false
    const controller = createMandarinRecognition({
      onState: setRecognition,
      onFinal: (transcript) => {
        setValue(`${baseTranscript.current}${transcript}`.slice(0, 500))
        setMode('speaking')
        setAssessment(null)
        setError('')
      },
    })
    recognizer.current = controller
    return () => {
      disposed.current = true
      controller.dispose()
      stopSpeech()
    }
  }, [])

  function showHint() {
    playReveal()
    setHint((level) => Math.min(3, level + 1))
    setAssisted(true)
    onAssistance?.()
  }

  function changeValue(next: string) {
    if (assessment) {
      setAssisted(true)
      onAssistance?.()
    }
    setValue(next)
    setMode('writing')
    setAssessment(null)
    setError('')
    setReviewed(false)
  }

  function toggleMicrophone() {
    if (recording) {
      recognizer.current?.stop()
      return
    }
    if (assessment) {
      setAssisted(true)
      onAssistance?.()
    }
    setAssessment(null)
    setReviewed(false)
    setError('')
    onVoiceStart?.()
    stopSpeech()
    baseTranscript.current = latestValue.current.trim()
    playListen()
    recognizer.current?.start()
  }

  function prompt() {
    return { expectedZh: example.zh, expectedEn: example.en, response: value.trim(), targetWords, grammar, context }
  }

  function check() {
    if (recording || completed) return
    if (!/[\u3400-\u9fff]/.test(value)) {
      setError(t('Write or speak your response in Hanzi first.'))
      return
    }
    const result = assessProduction(prompt(), courseLexicon)
    setError('')
    setAssessment(result)
    setReviewNote(0)
    setReviewed(false)
    // The reference/correction is now visible; persist that exposure before
    // the learner can close the lesson and attempt the same checkpoint again.
    if (result.accepted !== true) onAssistance?.()
    if (result.accepted === true) playCorrect()
    else if (result.accepted === false) playWrong()
  }

  function retry() {
    setAssisted(true)
    onAssistance?.()
    setPrevious(null)
    setFixList([])
    setValue('')
    setHint(0)
    setAssessment(null)
    setReviewed(false)
    setError('')
    recognizer.current?.cancel()
  }

  /** Keep the reply, say what to fix, and check it again: the loop, not a blank page. */
  function revise() {
    if (!review) return
    setPrevious(review)
    // Only things the learner can act on: an unverifiable grammar check is not a fix.
    setFixList(review.issues.flatMap((check) => check.fix && check.status !== 'unverified' ? [check.fix] : []).slice(0, 3))
    setAssisted(true)
    onAssistance?.()
    setAssessment(null)
    setReviewed(false)
    setError('')
    recognizer.current?.cancel()
    window.setTimeout(() => document.getElementById(id)?.focus(), 0)
  }

  function finish() {
    if (!assessment || completed || (assessment.accepted === false && !reviewed)) return
    setCompleted(true)
    recognizer.current?.cancel()
    stopSpeech()
    const correct = assessment.accepted === true
    const usedAssistance = assisted || reviewed || externallyAssisted
    const words = correct ? assessment.usedWords : targetWords
    onComplete({
      correct,
      assisted: usedAssistance,
      words,
      mode,
      evidence: assessment.evidence,
      outcomes: words.map((word) => ({ word, correct, assisted: usedAssistance, mode, evidence: assessment.evidence })),
    }, value.trim())
  }

  const shownZh = assessment ? assessment.suggestedZh ?? assessment.correctedZh : ''
  const coach = assessment ? buildGrammarCoach({ expectedZh: example.zh, expectedEn: example.en, response: value, grammar }) : null

  return (
    <div className="production-compose">
      <label className="production-speaker" htmlFor={id}>{mode === 'speaking' && value ? t('Recognized Hanzi · edit if needed') : t('Your Mandarin')}</label>
      {!assessment && fixList.length > 0 && <div className="reply-fixlist" role="note"><strong>{t('Fix before checking again')}</strong><ul>{fixList.map((note) => <li key={note}>{note}</li>)}</ul></div>}
      <textarea
        id={id}
        className="production-input zh"
        lang="zh-CN"
        value={value}
        rows={2}
        maxLength={500}
        disabled={recording || completed}
        placeholder="用中文说，或写下来…"
        onChange={(event) => changeValue(event.target.value)}
        aria-describedby={`${id}-status`}
      />
      {!assessment && <div className="production-controls">
        <button type="button" className="btn btn-ghost production-mic" data-active={recording} aria-pressed={recording} disabled={!supported || completed} onClick={toggleMicrophone}>
          <MicrophoneIcon />{recording ? t('Stop') : value.trim() ? t('Add speech') : t('Speak')}
        </button>
        <button type="button" className="btn" disabled={!value.trim() || recording || completed} onClick={check}>{preferredMode === 'speaking' ? t('Check reply') : t('Check sentence')}</button>
      </div>}
      <div id={`${id}-status`} className="production-status" role="status" aria-live="polite">
        {recording && <VoiceWaveform active={listening} />}
        {recognition.interim && <p className="production-zh zh" lang="zh-CN">{recognition.interim}<span className="production-meta"> · {t('still listening')}</span></p>}
        {recognition.status === 'starting' && <p>{t('Opening microphone…')}</p>}
        {listening && <p>{t('Listening in Mandarin. Pause when your reply is complete.')}</p>}
        {recognition.status === 'stopping' && <p>{t('Finishing transcription…')}</p>}
        {recognition.error && <p>{recognition.error}</p>}
        {!assessment && !recording && !recognition.error && <p>{supported ? value && mode === 'speaking' ? t('Check the recognized words, then check your reply.') : t('Speak or type. Your book reply stays hidden.') : t('Speech input is unavailable here. Type your reply.')}</p>}
      </div>
      {!assessment && <>
        <div className="production-hints">
          {hint < 3 && <button className="btn btn-ghost" type="button" onClick={showHint} disabled={recording}>{[t('Need a clue?'), t('Reveal Hanzi'), t('Reveal pinyin')][hint]}</button>}
          {hint > 0 && <span>{t('Assisted attempt')}</span>}
        </div>
        {hint > 0 && <div ref={hintPanel} className="production-hint">
          {hint === 1 && <><span className="production-speaker">{t('Meaning clues')}</span><p>{sourceClues.length ? sourceClues.map((word) => word.en).join(' · ') : grammar || t('Book sentence: {n} Hanzi. Start with the subject, then the action.', { n: [...example.zh.replace(/[\s\p{P}]/gu, '')].length })}</p>{grammar && sourceClues.length > 0 && <p>{grammar}</p>}</>}
          {hint >= 2 && <p className="production-zh zh" lang="zh-CN">{example.zh}</p>}
          {hint >= 3 && <><p className="production-pinyin">{example.pinyin}</p><HearButton text={example.zh} label={t('Hear the book reply')} /></>}
        </div>}
      </>}
      {error && <div className="production-feedback" data-state="retry" role="alert"><p>{error}</p></div>}
      {assessment && (
        <div ref={reviewPanel} className="production-feedback production-recall-review" data-state={assessment.accepted === true ? 'correct' : assessment.accepted === null ? 'unverified' : 'retry'} aria-live="polite">
          {assessment.accepted === true && <RecallFeedback state={feedbackState} label={t('Meaning recalled')} />}
          {review && <ReviewReport review={review} comparison={change} revealed={() => true} />}
          {assessment.grammar && <p className="production-meta">{t('Checked against {n} common mistake patterns. Not a full grammar check.', { n: assessment.grammar.rulesChecked })}</p>}
          <div className="production-comparison">
            <div className="production-speaker">{assessment.suggestedZh ? t('Your sentence, fixed') : t('Book phrasing')}</div>
            <p className="production-zh zh" lang="zh-CN">{shownZh}</p>
            {prefs.showPinyin && shownZh === example.zh && <p className="production-pinyin">{example.pinyin}</p>}
            {prefs.showEnglish && shownZh === example.zh && <p className="production-en">{example.en}</p>}
            <HearButton text={shownZh} label={t('Hear this phrasing')} />
          </div>
          {assessment.accepted === false && <label className="production-review"><input type="checkbox" checked={reviewed} onChange={(event) => { setReviewed(event.target.checked); if (event.target.checked) onAssistance?.() }} />{t('I compared the correction. Keep this as assisted practice.')}</label>}
          <div className="production-actions">
            {assessment.accepted !== true && <button type="button" className="btn" onClick={revise} disabled={completed}>{t('Fix and check again')}</button>}
            <button type="button" className={assessment.accepted === true ? 'btn conversation-continue' : 'btn btn-ghost conversation-continue'} onClick={finish} disabled={completed || (assessment.accepted === false && !reviewed)}>{assessment.accepted === null ? t('Keep as practice') : continueLabel}</button>
            {assessment.accepted !== true && <button type="button" className="btn btn-ghost" onClick={retry} disabled={completed}>{t('Start over')}</button>}
          </div>
          {prefs.showEnglish && reviewNotes.length > 0 && <details className="conversation-review-note conversation-disclosure">
            <summary>{t('Review note')}{reviewNotes.length > 1 && <span>{reviewNote + 1} / {reviewNotes.length}</span>}</summary>
            <p>{reviewNotes[reviewNote]}</p>
            {reviewNotes.length > 1 && <button type="button" className="grammar-coach-next" onClick={() => setReviewNote((current) => (current + 1) % reviewNotes.length)}>{t('Next note')}<span>{reviewNote + 1} / {reviewNotes.length}</span></button>}
          </details>}
          {coach && <details className="conversation-review-pattern conversation-disclosure"><summary>{t('Explore the word order')}</summary><GrammarCoachView coach={coach} showEnglish={prefs.showEnglish} /></details>}
          {(assessment.accepted === null || targetWords.length > 0) && <details className="production-review-details">
            <summary>{t('Compare wording')}</summary>
            {assessment.accepted === null && <div className="production-comparison">
              <span className="production-speaker">{t('Your wording → book wording')}</span>
              <p className="production-diff zh" lang="zh-CN">{alignChinese(value, example.zh).map((part, index) => part.kind === 'same' ? <span key={index}>{part.text}</span> : part.kind === 'added' ? <del key={index} title={t('In your wording')}>{part.text}</del> : <ins key={index} title={t('In the book wording')}>{part.text}</ins>)}</p>
            </div>}
            {targetWords.length > 0 && <div className="production-clues"><span className="production-speaker">{t('Lesson words')}</span>{targetWords.map((word) => <span key={word} lang="zh-CN" data-used={assessment.usedWords.includes(word)}>{word}{prefs.showEnglish ? ` · ${assessment.usedWords.includes(word) ? t('used') : t('in the book')}` : ''}</span>)}</div>}
          </details>}
          <StudyDisplayControls />
          {prefs.showEnglish && (assisted || externallyAssisted) && <p className="production-meta">{t('Assisted practice. Try again from memory on your next review.')}</p>}
        </div>
      )}
    </div>
  )
}

function GrammarCoachView({ coach, showEnglish }: { coach: GrammarCoach | null; showEnglish: boolean }) {
  const [activePart, setActivePart] = useState(0)
  const [activeDifference, setActiveDifference] = useState(0)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const step = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setActivePart(0)
    setActiveDifference(0)
    setExplanationOpen(false)
  }, [coach?.pattern, coach?.example.zh])
  useFiniteArrival(step, activePart, explanationOpen)
  if (!coach) return null
  const focused = coach.parts[Math.min(activePart, coach.parts.length - 1)]
  const difference = coach.observations[Math.min(activeDifference, coach.observations.length - 1)]
  return <section className="grammar-coach" aria-label={t('Lesson grammar pattern')}>
    <div className="production-speaker">{t('Word order')}</div>
    <p className="grammar-coach-pattern" lang="zh-CN">{coach.pattern}</p>
    <ol className="grammar-coach-parts" aria-label={t('Parts in sentence order')}>
      {coach.parts.map((part, index) => <li key={`${index}:${part.text}`} data-focused={explanationOpen && activePart === index}><button type="button" onClick={() => { setActivePart(index); setExplanationOpen(true) }} aria-pressed={explanationOpen && activePart === index}><span className="zh" lang="zh-CN">{part.text}</span>{showEnglish && <small>{part.role}</small>}</button></li>)}
    </ol>
    {difference && <div className="grammar-coach-observations"><div key={activeDifference}><p lang="zh-CN" className="zh">{difference.text}</p>{showEnglish && <details className="grammar-coach-difference"><summary>{t('Explain this difference')}</summary><p>{difference.reason}</p></details>}{coach.observations.length > 1 && <button type="button" className="grammar-coach-next" onClick={() => setActiveDifference((current) => (current + 1) % coach.observations.length)}>{t('Next difference')} <span>{activeDifference + 1} / {coach.observations.length}</span></button>}</div></div>}
    <details className="grammar-coach-explanation" open={explanationOpen} onToggle={(event) => setExplanationOpen(event.currentTarget.open)}>
      <summary>{t('Why this order?')}</summary>
      {focused && <div ref={step} className="grammar-coach-step" aria-live="polite">
        <span className="grammar-coach-step-count">{activePart + 1} / {coach.parts.length}</span>
        <strong lang="zh-CN" className="zh">{focused.text}</strong>
        {showEnglish && <><span className="grammar-coach-step-role">{focused.role}</span><p>{focused.reason}</p></>}
        <button type="button" className="grammar-coach-next" onClick={() => setActivePart((current) => (current + 1) % coach.parts.length)}>{activePart < coach.parts.length - 1 ? t('Next part') : t('From the start')}</button>
      </div>}
      {showEnglish && <details className="grammar-coach-overview"><summary>{t('See the whole pattern')}</summary><p className="grammar-coach-reason">{coach.summary}</p></details>}
    </details>
  </section>
}

function MicrophoneIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>
}
