import { compactStepId } from '../lib/sessionRoute'
import { withMixedPractice } from '../lib/duoSession'
import { ExerciseView, type ExerciseOutcome, type EvidenceMode } from '../components/Exercises'
import { ComboBadge, MomentumProvider, useMomentum, XpFloat } from '../components/Momentum'
import { useSessionRoute } from '../components/useSessionRoute'
import { Explain, PracticeExit, SessionProgress, SessionSummary } from '../components/SessionFlow'
import { StudyMusic } from '../components/StudyMusic'
import { ChapterCheck } from '../components/ChapterCheck'
import { quizAssisted } from '../lib/choiceSupport'
import { isComfortable } from '../lib/learningEngine'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { DialogueAudio, Glossed, Line, useGloss } from '../components/ChineseText'
import { DialogueRecheck, type RecheckSummary } from '../components/DialogueRecheck'
import { DialoguePractice, SentencePractice } from '../components/ProductionPractice'
import { WordRecall, type RecallResult } from '../components/WordRecall'
import {
  ChineseHear,
  hasHanzi,
} from '../components/Hear'
import { CloseIcon, LockIcon } from '../components/Icons'
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
  teachVocab,
  type SessionStep,
} from '../lib/wordsSession'
import { useStore, type PathNode } from '../store/store'

type QuizState = { wrong: string[]; solved: boolean; missed: boolean }


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
  return (
    <MomentumProvider>
      <WordsRunner lesson={lesson} node={node} onClose={onClose} />
    </MomentumProvider>
  )
}

function WordsRunner({ lesson, node, onClose }: { lesson: number; node: PathNode; onClose: () => void }) {
  const store = useStore()
  const { user } = useAuth()
  // Production activities change the sequence; don't reinterpret old numeric checkpoints.
  const resumeId = `hsk:duo-v1:${user?.id ?? 'local'}:${lesson}:${node}`
  const momentum = useMomentum()
  const checkpoint = useRef(readLearningCheckpoint(resumeId))
  const [steps] = useState(() => {
    const base = buildSteps(lesson, node).filter(
      (step) =>
        !(
          (step.kind === 'teach' || step.kind === 'recall') &&
          isComfortable(store, step.word.zh) &&
          step.id !== compactStepId(checkpoint.current?.stepId) &&
          !checkpoint.current?.retryWords?.includes(step.word.zh)
        ),
    )
    const retries = (checkpoint.current?.retryWords ?? []).flatMap((zh) => {
      const recall = base.find((activity) => activity.kind === 'recall' && activity.word.zh === zh)
      return recall ? [{ ...recall, id: `retry:${zh}`, n: 1, of: 1 } as SessionStep] : []
    })
    return withMixedPractice([...base.slice(0, -1), ...retries, base[base.length - 1]], `hsk:${lesson}:${node}`)
  })
  const sessionWords = useMemo(
    () => [...new Set(steps.filter((s) => s.kind === 'recall').map((s) => s.word.zh))],
    [steps],
  )
  const alreadyDone = useRef(store.isNodeDone(lesson, node))
  const credited = useRef(new Set<string>())
  const finished = useRef(false)
  const left = useRef(new Set<string>())
  const bodyRef = useRef<HTMLDivElement>(null)
  const retryWords = useRef(new Set(checkpoint.current?.retryWords ?? []))

  const route = useSessionRoute(steps, checkpoint.current)
  const { i, step } = route
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const [progressPeeks, setProgressPeeks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((checkpoint.current?.assistedSteps ?? []).map((id) => [id, true])),
  )

  const quizState = step.kind === 'quiz' ? quiz[step.id] : undefined
  const isComplete = step.kind === 'complete'
  const footerLocked = step.kind === 'quiz' && !quizState?.solved
  const beatKey = step.kind === 'complete' ? 'complete' : route.key

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
      practiceIds: route.selected ?? [],
      retryWords: [...retryWords.current],
      assistedSteps: Object.keys(progressPeeks).filter((id) => progressPeeks[id]),
    })
  }, [i, isComplete, resumeId, step, progressPeeks, route.selected])

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
    }
    if (node === 'wrap' && !alreadyDone.current) {
      store.finishLesson(lesson, teachVocab(lesson), 40)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, lesson, node, resumeId])

  function credit(id: string) {
    if (credited.current.has(id)) return
    credited.current.add(id)
    store.awardXp(ITEM_XP)
    store.practiceLog()
  }

  function meetWord(word: Vocab, id: string) {
    store.addCards(lesson, [word])
    credit(id)
  }

  function goForward(repeat = false) {
    if (left.current.has(route.key)) return
    left.current.add(route.key)
    route.next(repeat)
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

  function recordExercise(zh: string, correct: boolean, assisted: boolean, mode: EvidenceMode) {
    store.recordRecall(zh, { correct, assisted, mode })
  }

  function finishExercise(outcome: ExerciseOutcome) {
    if (step.kind !== 'exercise') return
    credit(step.id)
    goForward(outcome.missed)
  }

  function finishRecall(result: RecallResult) {
    if (step.kind !== 'recall') return
    credit(step.id)
    goForward(result.missed || result.assisted)
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

    momentum.register(route.key, picked === answer)
    if (picked === answer) {
      playCorrect()
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

  const progress = route.progress
  const showFooter =
    isComplete ||
    step.kind === 'teach' ||
    step.kind === 'note' ||
    step.kind === 'read' ||
    (step.kind === 'quiz' && quizState?.solved)
  const footerLabel = isComplete ? t('Done') : t('Continue')

  return (
    <div className="overlay session learning-session">
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close session')}>
          <CloseIcon />
        </button><StudyMusic compact />
        <div className="step-bar">
          <i className="yl-progress" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <ComboBadge />
        <XpFloat />
      </div>

      <SessionProgress kind={step.kind} {...('n' in step && (step.kind === 'teach' || route.inPractice) ? { n: step.n, of: step.of } : {})} />

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
          ) : step.kind === 'exercise' ? (
            <ExerciseView
              step={step}
              attemptKey={route.key}
              repeat={route.pass > 0}
              onRecord={recordExercise}
              onDone={finishExercise}
            />
          ) : step.kind === 'recall' ? (
            <WordRecall
              word={step.word}
              n={step.n}
              of={step.of}
              cue={node === 'wrap' ? 'sentence' : 'meaning'}
              repeatOnHelp={route.canRepeat}
              externallyAssisted={route.pass ? false : progressPeeks[step.id]}
              onAssistance={() => {
                setProgressPeeks((previous) => ({ ...previous, [step.id]: true }))
              }}
              onAttempt={(correct, assisted, mode) => {
                momentum.register(route.key, correct)
                store.recordRecall(step.word.zh, { correct, assisted, mode })
                // Once scored, the source answer is visible; reopening is assisted.
                setProgressPeeks((previous) => ({ ...previous, [step.id]: true }))
              }}
              onComplete={finishRecall}
            />
          ) : step.kind === 'dialogue' ? (
            <DialoguePractice
              short
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
            <SessionSummary title={getLesson(lesson).title.zh} words={sessionWords} />
          )}
          {route.canFinish && !(step.kind === 'quiz' && quizState?.solved) && <PracticeExit onFinish={route.finish} />}
        </div>
      </div>

      {showFooter && (
        <div className="overlay-foot">
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
    <div className="duo-note">
      <StepHead kicker={head} title={title} />
      <Explain folded={!!example && body.length > 140}>
      <p className="sub" style={{ textWrap: 'pretty', lineHeight: 1.55 }}>
        {body}
      </p>
      </Explain>
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
