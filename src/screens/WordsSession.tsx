import { StudyMusic } from '../components/StudyMusic'
import { ChapterCheck } from '../components/ChapterCheck'
import { quizAssisted } from '../lib/choiceSupport'
import { isComfortable } from '../lib/learningEngine'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { DialogueAudio, Glossed, Line, useGloss } from '../components/ChineseText'
import { Fireworks } from '../components/Fireworks'
import { MasteryTracker } from '../components/MasteryTracker'
import { DialogueRecheck, type RecheckSummary } from '../components/DialogueRecheck'
import { DialoguePractice, SentencePractice } from '../components/ProductionPractice'
import { WordRecall } from '../components/WordRecall'
import { StudyDisplayControls } from '../components/StudyDisplayControls'
import {
  ChineseHear,
  hasHanzi,
} from '../components/Hear'
import { CheckIcon, CloseIcon, LockIcon } from '../components/Icons'
import { getLesson, type Example } from '../lib/content'
import { recordHistory } from '../lib/history'
import { t } from '../lib/i18n'
import { clearLearningCheckpoint, readLearningCheckpoint, writeLearningCheckpoint } from '../lib/resume'
import { playAdvance, playComplete, playCorrect, playWrong } from '../lib/sfx'
import type { ProductionResult } from '../lib/production'
import { unlockSpeech } from '../lib/speech'
import { TeachView } from './TeachBeats'
import type { LessonText, Vocab } from '../lib/types'
import { LINE_RATE } from '../lib/voices'
import {
  ITEM_XP,
  NODE_BONUS_XP,
  NODE_LABEL,
  buildSteps,
  isNodePlayable,
  isSessionOpen,
  playableCount,
  sittingWordCount,
  teachVocab,
  type SessionStep,
} from '../lib/wordsSession'
import { useStore, type PathNode } from '../store/store'

type QuizState = { wrong: string[]; solved: boolean; missed: boolean }

/** The five stages of a sitting. The English name is the id the code compares; the label is what the learner reads. */
const STAGES = ['Encounter', 'Understand', 'Retrieve', 'Produce', 'Revisit'] as const
type Stage = (typeof STAGES)[number]
const STAGE_LABEL: Record<Stage, string> = {
  Encounter: t('Encounter'),
  Understand: t('Understand'),
  Retrieve: t('Retrieve'),
  Produce: t('Produce'),
  Revisit: t('Revisit'),
}

export function WordsSession({
  lesson,
  node = 't1',
  onClose,
}: {
  lesson: number
  node?: PathNode
  onClose: () => void
}) {
  const store = useStore()
  if (!isSessionOpen(lesson, node) || !isNodePlayable(lesson, node, store.isNodeDone)) {
    return <LockedView onClose={onClose} />
  }
  return <WordsRunner lesson={lesson} node={node} onClose={onClose} />
}

function WordsRunner({ lesson, node, onClose }: { lesson: number; node: PathNode; onClose: () => void }) {
  const store = useStore()
  const { user } = useAuth()
  // Production activities change the sequence; don't reinterpret old numeric checkpoints.
  const resumeId = `hsk:production-v2:${user?.id ?? 'local'}:${lesson}:${node}`
  const checkpoint = useRef(readLearningCheckpoint(resumeId))
  const [steps, setSteps] = useState(() => {
    const base = buildSteps(lesson, node).filter(
      (step) =>
        !(
          (step.kind === 'teach' || step.kind === 'recall') &&
          isComfortable(store, step.word.zh) &&
          step.id !== checkpoint.current?.stepId &&
          !checkpoint.current?.retryWords?.includes(step.word.zh)
        ),
    )
    const retries = (checkpoint.current?.retryWords ?? []).flatMap((zh) => {
      const recall = base.find((activity) => activity.kind === 'recall' && activity.word.zh === zh)
      return recall ? [{ ...recall, id: `retry:${zh}`, n: 1, of: 1 } as SessionStep] : []
    })
    return [...base.slice(0, -1), ...retries, base[base.length - 1]]
  })
  const sessionWords = useMemo(
    () => [...new Set(steps.filter((s) => s.kind === 'recall').map((s) => s.word.zh))],
    [steps],
  )
  const alreadyDone = useRef(store.isNodeDone(lesson, node))
  const credited = useRef(new Set<string>())
  const finished = useRef(false)
  const left = useRef(new Set<number>())
  const xpRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const retryWords = useRef(new Set(checkpoint.current?.retryWords ?? []))
  const needsSupport = useRef(new Set<string>())

  const [i, setI] = useState(() => {
    const saved = steps.findIndex(
      (activity) => activity.kind !== 'complete' && activity.id === checkpoint.current?.stepId,
    )
    return saved >= 0 ? saved : 0
  })
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const [xp, setXp] = useState(0)
  const [fwToken, setFwToken] = useState(0)
  const [progressPeeks, setProgressPeeks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((checkpoint.current?.assistedSteps ?? []).map((id) => [id, true])),
  )

  const step = steps[Math.min(i, steps.length - 1)]
  const quizState = step.kind === 'quiz' ? quiz[step.id] : undefined
  const isComplete = step.kind === 'complete'
  const total = playableCount(steps)
  const footerLocked = step.kind === 'quiz' && !quizState?.solved
  const beatKey = step.kind === 'complete' ? 'complete' : step.id

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [i])

  // Encounter is enough to enter the trail, even if the learner closes before Next.
  useEffect(() => {
    if (step.kind === 'teach' && step.phase === 'meet') store.addCards(lesson, [step.word])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, lesson])

  useEffect(() => {
    if (isComplete) return
    writeLearningCheckpoint(resumeId, {
      stepId: step.id,
      retryWords: [...retryWords.current],
      assistedSteps: Object.keys(progressPeeks).filter((id) => progressPeeks[id]),
    })
  }, [i, isComplete, resumeId, step, progressPeeks])

  useEffect(() => {
    if (!isComplete || finished.current) return
    finished.current = true
    playComplete()
    clearLearningCheckpoint(resumeId)
    store.markNodeDone(lesson, node)
    recordHistory({
      course: 'hsk4a',
      kind: 'node',
      lesson,
      node,
      title: NODE_LABEL[node].en,
    })
    if (!alreadyDone.current) {
      store.awardXp(NODE_BONUS_XP)
      xpRef.current += NODE_BONUS_XP
      setXp(xpRef.current)
    }
    if (node === 'wrap' && !alreadyDone.current) {
      store.finishLesson(lesson, teachVocab(lesson), 40)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, lesson, node, resumeId])

  function credit(id: string) {
    if (credited.current.has(id)) return
    credited.current.add(id)
    xpRef.current += ITEM_XP
    setXp(xpRef.current)
    store.awardXp(ITEM_XP)
    store.practiceLog()
  }

  function meetWord(word: Vocab, id: string) {
    store.addCards(lesson, [word])
    credit(id)
  }

  function goForward() {
    if (left.current.has(i)) return
    left.current.add(i)
    setI((cur) => Math.min(cur + 1, steps.length - 1))
  }

  function advance() {
    if (footerLocked) return
    if (step.kind === 'teach' && step.phase === 'meet') meetWord(step.word, step.id)
    if (step.kind === 'note' || step.kind === 'read') credit(step.id)
    if (isComplete) {
      onClose()
      return
    }
    playAdvance()
    goForward()
  }

  function finishRecall() {
    if (step.kind !== 'recall') return
    credit(step.id)
    // Give difficult words another unaided attempt after the other activities.
    if (needsSupport.current.has(step.word.zh) && !retryWords.current.has(step.word.zh)) {
      retryWords.current.add(step.word.zh)
      const retry: SessionStep = { ...step, id: `retry:${step.word.zh}`, n: 1, of: 1 }
      setSteps((current) => [...current.slice(0, -1), retry, current[current.length - 1]])
    }
    goForward()
  }

  function finishProduction(result: ProductionResult) {
    if (step.kind !== 'dialogue' && step.kind !== 'produce') return
    const outcomes = result.outcomes ?? result.words.map((word) => ({ word, ...result }))
    for (const outcome of outcomes) {
      if (outcome.evidence === 'practice') continue
      store.recordRecall(outcome.word, {
        correct: outcome.correct,
        assisted: outcome.assisted,
        mode: outcome.mode,
      })
    }
    credit(step.id)
    recordHistory({
      course: 'hsk4a',
      kind: 'quiz',
      lesson,
      node,
      correct: result.evidence === 'practice' ? undefined : result.correct,
      title: result.evidence === 'practice' ? t('Sentence practice · ungraded') : undefined,
    })
    goForward()
  }

  function finishRecheck(summary: RecheckSummary) {
    if (step.kind !== 'recheck') return
    credit(step.id)
    recordHistory({
      course: 'hsk4a',
      kind: 'quiz',
      lesson,
      node,
      correct: summary.unaided === summary.total,
      title: t('Dialogue check'),
    })
    playAdvance()
    goForward()
  }

  function answerQuiz(picked: string, answer: string, helped = false) {
    if (step.kind !== 'quiz') return
    const key = step.id
    const prev = quiz[key] ?? { wrong: [], solved: false, missed: false }
    if (prev.solved || prev.wrong.includes(picked)) return
    const trackedWord = sessionWords.includes(answer) ? answer : undefined
    if (trackedWord)
      store.recordRecall(trackedWord, {
        correct: picked === answer,
        assisted: quizAssisted(prev.missed, !!progressPeeks[step.id], helped),
        mode: 'recognition',
      })

    if (picked === answer) {
      playCorrect()
      setFwToken((n) => n + 1)
      credit(key)
      recordHistory({ course: 'hsk4a', kind: 'quiz', lesson, node, correct: true })
      setQuiz((q) => ({
        ...q,
        [key]: { wrong: prev.wrong, solved: true, missed: prev.missed || prev.wrong.length > 0 },
      }))
      return
    }

    playWrong()
    recordHistory({ course: 'hsk4a', kind: 'quiz', lesson, node, correct: false })
    setQuiz((q) => ({
      ...q,
      [key]: { wrong: [...prev.wrong, picked], solved: false, missed: true },
    }))
  }

  const progress = isComplete ? 100 : (i / total) * 100
  const showFooter =
    isComplete ||
    step.kind === 'teach' ||
    step.kind === 'note' ||
    step.kind === 'read' ||
    (step.kind === 'quiz' && quizState?.solved)
  const footerLabel = isComplete ? t('Continue') : t('Next')
  const activeStage: Stage =
    step.kind === 'complete' || (step.kind === 'recall' && step.id.startsWith('retry:'))
      ? 'Revisit'
      : step.kind === 'teach'
        ? 'Encounter'
        : step.kind === 'read' || step.kind === 'note'
          ? 'Understand'
          : step.kind === 'recall' || step.kind === 'quiz' || step.kind === 'recheck'
            ? 'Retrieve'
            : 'Produce'

  return (
    <div className="overlay session learning-session">
      <Fireworks token={fwToken} />
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close session')}>
          <CloseIcon />
        </button><StudyMusic compact />
        <div className="step-bar">
          <i className="yl-progress" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <MasteryTracker
          words={sessionWords}
          compact
          onOpen={() => {
            if (step.kind === 'recall' || step.kind === 'dialogue' || step.kind === 'produce') {
              setProgressPeeks((previous) => ({
                ...previous,
                ...Object.fromEntries(
                  steps
                    .filter(
                      (activity) =>
                        activity.kind === 'recall' ||
                        activity.kind === 'dialogue' ||
                        activity.kind === 'produce',
                    )
                    .map((activity) => [activity.id, true]),
                ),
              }))
            }
          }}
        />
      </div>

      <div
        className="learning-route"
        aria-label={t('Learning stage: {stage}', { stage: STAGE_LABEL[activeStage] })}
      >
        {STAGES.map((stage) => (
          <span
            key={stage}
            data-active={stage === activeStage}
            aria-current={stage === activeStage ? 'step' : undefined}
          >
            {STAGE_LABEL[stage]}
          </span>
        ))}
      </div>

      <div className="overlay-body" ref={bodyRef}>
        <div key={beatKey} className="session-beat yl-enter">
          {step.kind === 'teach' ? (
            <TeachView
              phase={step.phase}
              word={step.word}
              example={step.example}
              hook={step.hook}
              lesson={lesson}
              n={step.n}
              of={step.of}
            />
          ) : step.kind === 'read' ? (
            <ReadView text={step.text} />
          ) : step.kind === 'recall' ? (
            <WordRecall
              word={step.word}
              n={step.n}
              of={step.of}
              externallyAssisted={progressPeeks[step.id]}
              onAssistance={() => {
                needsSupport.current.add(step.word.zh)
                setProgressPeeks((previous) => ({ ...previous, [step.id]: true }))
              }}
              onAttempt={(correct, assisted, mode) => {
                store.recordRecall(step.word.zh, { correct, assisted, mode })
                // Once scored, the source answer is visible; reopening is assisted.
                setProgressPeeks((previous) => ({ ...previous, [step.id]: true }))
                if (!correct || assisted) {
                  needsSupport.current.add(step.word.zh)
                }
              }}
              onComplete={finishRecall}
            />
          ) : step.kind === 'dialogue' ? (
            <DialoguePractice
              text={step.text}
              lesson={lesson}
              externallyAssisted={progressPeeks[step.id]}
              assistedTurns={Object.keys(progressPeeks)
                .filter((id) => id.startsWith(`${step.id}::`))
                .map((id) => id.slice(step.id.length + 2))}
              onAssistance={(turnId) =>
                setProgressPeeks((previous) => ({
                  ...previous,
                  [turnId ? `${step.id}::${turnId}` : step.id]: true,
                }))
              }
              targetWords={getLesson(lesson).vocab.map((word) => word.zh)}
              onComplete={finishProduction}
            />
          ) : step.kind === 'recheck' ? (
            <DialogueRecheck
              text={step.text}
              words={step.words}
              onRecord={(zh, correct, assisted) =>
                store.recordRecall(zh, { correct, assisted, mode: 'recognition' })
              }
              onDone={finishRecheck}
            />
          ) : step.kind === 'produce' ? (
            <SentencePractice
              example={step.example}
              targetWords={step.words}
              grammar={step.grammar}
              lesson={lesson}
              externallyAssisted={progressPeeks[step.id]}
              onAssistance={() => setProgressPeeks((previous) => ({ ...previous, [step.id]: true }))}
              onComplete={finishProduction}
            />
          ) : step.kind === 'note' ? (
            <NoteView
              title={step.title}
              body={step.body}
              example={step.example}
              kicker={step.kicker}
              n={step.n}
              of={step.of}
            />
          ) : step.kind === 'quiz' ? (
            <ChapterCheck
              key={step.id}
              question={step.question}
              n={step.n}
              of={step.of}
              state={quizState}
              assisted={!!progressPeeks[step.id]}
              onAssistance={() => setProgressPeeks(previous => ({ ...previous, [step.id]: true }))}
              onPick={answerQuiz}
            />
          ) : (
            <DoneView
              node={node}
              titleZh={getLesson(lesson).title.zh}
              titleEn={getLesson(lesson).title.en}
              wordCount={sittingWordCount(lesson, node)}
              xp={xp}
              replay={alreadyDone.current}
              words={sessionWords}
            />
          )}
        </div>
      </div>

      {showFooter && (
        <div className="overlay-foot">
          {(step.kind === 'teach' || step.kind === 'read' || step.kind === 'note') && (
            <StudyDisplayControls />
          )}
          <button type="button" className="btn" onPointerDown={() => unlockSpeech()} onClick={advance}>
            {footerLabel}
          </button>
        </div>
      )}
    </div>
  )
}

function StepHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="session-step-head">
      <div className="kicker-ink">{kicker}</div>
      <h2 className="session-step-title">{title}</h2>
    </header>
  )
}

function ReadView({ text }: { text: LessonText }) {
  const { onWord, sheet } = useGloss()
  const { prefs } = useStore()
  const heading = text.heading_zh || text.heading_en || text.label
  return (
    <>
      <StepHead
        kicker={
          text.type === 'dialogue'
            ? t('{label} · Dialogue', { label: text.label })
            : t('{label} · Passage', { label: text.label })
        }
        title={heading}
      />
      {prefs.showEnglish && text.heading_en && text.heading_zh && (
        <p className="session-read-en">{text.heading_en}</p>
      )}
      <DialogueAudio text={text} />
      <div className="session-read">
        {text.lines.map((line, i) => (
          <Line
            key={`${text.label}-${i}`}
            line={line}
            self={text.type === 'dialogue' && i % 2 === 1}
            showPinyin={prefs.showPinyin}
            showEnglish={prefs.showEnglish}
            onWord={onWord}
          />
        ))}
      </div>
      {sheet}
    </>
  )
}


function NoteView({
  title,
  body,
  example,
  kicker,
  n,
  of,
}: {
  title: string
  body: string
  example: Example | null
  kicker?: string
  n: number
  of: number
}) {
  const { onWord, sheet } = useGloss()
  const { prefs } = useStore()
  // The grammar notes arrive already labelled (in the interface language), so compare against the same label.
  const head =
    kicker && kicker !== t('Grammar')
      ? kicker
      : of > 1
        ? t('Grammar · {n} of {of}', { n, of })
        : (kicker ?? t('Grammar'))
  const fallBackZh = example?.zh?.trim() ? '' : hasHanzi(title) ? title : hasHanzi(body) ? body : ''
  const spoken = (example?.zh ?? fallBackZh).trim()

  return (
    <>
      <StepHead kicker={head} title={title} />
      <p className="sub" style={{ textWrap: 'pretty', lineHeight: 1.55 }}>
        {body}
      </p>
      {example && (
        <div className="card session-prompt">
          <p
            className="zh"
            lang="zh-CN"
            style={{ fontSize: 20, fontWeight: 800, margin: 0, textWrap: 'pretty' }}
          >
            <Glossed text={example.zh} onWord={onWord} />
          </p>
          {prefs.showPinyin && example.pinyin && (
            <p className="sub" style={{ margin: '6px 0 0', color: 'var(--red-mid)' }}>
              {example.pinyin}
            </p>
          )}
          {prefs.showEnglish && example.en && (
            <p className="sub" style={{ margin: '8px 0 0' }}>
              {example.en}
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <ChineseHear text={example.zh} label={t('Hear the line')} rate={LINE_RATE} />
          </div>
        </div>
      )}
      {!example && spoken && (
        <div style={{ marginTop: 14 }}>
          <ChineseHear text={spoken} label={t('Hear it')} />
        </div>
      )}
      {sheet}
    </>
  )
}

function DoneView({
  node,
  titleZh,
  titleEn,
  wordCount,
  xp,
  replay,
  words,
}: {
  node: PathNode
  titleZh: string
  titleEn: string
  wordCount: number
  xp: number
  replay: boolean
  words: string[]
}) {
  const label = NODE_LABEL[node]
  return (
    <div style={{ textAlign: 'center', paddingTop: 36 }}>
      <div className="medal pop">
        <CheckIcon size={46} />
      </div>
      <h2 className="h1 yl-enter" style={{ marginTop: 22, textWrap: 'balance' }}>
        {t('{label} complete', { label: label.en })}
      </h2>
      <p className="sub yl-enter-up" style={{ marginTop: 8, animationDelay: '80ms', textWrap: 'pretty' }}>
        {titleZh} · {titleEn}
      </p>
      <div className="learning-summary">
        <MasteryTracker words={words} />
      </div>
      <div
        className="session-xp yl-pop"
        style={{
          marginTop: 20,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          animationDelay: '120ms',
        }}
      >
        +{xp} XP
      </div>
      <div
        className="row yl-enter-up"
        style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap', animationDelay: '180ms' }}
      >
        <span className="pill-ink">{t('+{xp} XP / item', { xp: ITEM_XP })}</span>
        {!replay && <span className="pill-ink">{t('+{xp} node', { xp: NODE_BONUS_XP })}</span>}
        {node !== 'wrap' && wordCount > 0 && (
          <span className="pill-ink">{t('{n} words', { n: wordCount })}</span>
        )}
        <span className="pill-ink">{t('Automatically tracked')}</span>
      </div>
      <p
        className="yl-enter-up"
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          marginTop: 22,
          lineHeight: 1.55,
          animationDelay: '240ms',
          textWrap: 'pretty',
        }}
      >
        {replay
          ? t('Another retrieval session strengthens the trail.')
          : node === 'wrap'
            ? t('Every lesson word is tracked. Revisit difficult words before they fade.')
            : t(
                'Your learning trail keeps every word. Mastery comes from retrieving it again on another day.',
              )}
      </p>
    </div>
  )
}

function LockedView({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay session">
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close')}>
          <CloseIcon />
        </button>
      </div>
      <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="yl-enter" style={{ textAlign: 'center' }}>
          <div className="medal" style={{ opacity: 0.55 }}>
            <LockIcon size={36} />
          </div>
          <h2 className="h2" style={{ marginTop: 18, textWrap: 'balance' }}>
            {t('This sitting isn’t open yet')}
          </h2>
          <p className="sub" style={{ marginTop: 8, textWrap: 'pretty' }}>
            {t('Finish the sitting before this one first.')}
          </p>
        </div>
      </div>
      <div className="overlay-foot">
        <button type="button" className="btn" onClick={onClose}>
          {t('Continue')}
        </button>
      </div>
    </div>
  )
}
