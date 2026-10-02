import { useEffect, useMemo, useRef, useState } from 'react'
import { LearningPath } from '../components/LearningPath'
import { useAuth } from '../auth/AuthProvider'
import { DialogueAudio, Glossed, Line, useGloss } from '../components/ChineseText'
import { Fireworks } from '../components/Fireworks'
import { MasteryTracker } from '../components/MasteryTracker'
import { DialoguePractice, SentencePractice } from '../components/ProductionPractice'
import { WordRecall } from '../components/WordRecall'
import { StudyDisplayControls } from '../components/StudyDisplayControls'
import type { ProductionResult } from '../lib/production'
import { ChineseHear, hasHanzi, HearButton, useAutoSpeak, useAutoSpeakLines, useSpeechActive } from '../components/Hear'
import { CheckIcon, CloseIcon, LockIcon } from '../components/Icons'
import {
  buildJiaochengSteps,
  getJiaochengLesson,
  hearableZh,
  JIAOCHENG_BOOK,
  JIAOCHENG_NODE_LABEL,
  jiaochengLessons,
  jiaochengPlayableCount,
  jiaochengSittingWordCount,
  nodeCaptionJiaocheng,
  nodesForLesson,
  useJiaochengProgress,
  type JiaochengLesson,
} from '../lib/jiaocheng'
import { recordHistory } from '../lib/history'
import { clearLearningCheckpoint, readLearningCheckpoint, writeLearningCheckpoint } from '../lib/resume'
import { playAdvance, playComplete, playCorrect, playWrong } from '../lib/sfx'
import { unlockSpeech, speakLines, stopSpeech } from '../lib/speech'
import { ITEM_XP, NODE_BONUS_XP } from '../lib/wordsSession'
import type { LessonText } from '../lib/types'
import type { Question } from '../lib/quiz'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'
import { useStore, type PathNode } from '../store/store'
import { TeachView } from './TeachBeats'

type QuizState = { wrong: string[]; solved: boolean; missed: boolean }

function bookPartLabel(book: JiaochengLesson['book']): string {
  return book === '2-2' ? '下' : '上'
}

export function JiaochengEmptyState() {
  return (
    <section className="kerja-empty metal">
      <div className="kicker">{JIAOCHENG_BOOK.edition}</div>
      <h2 className="zh" lang="zh-CN">
        {JIAOCHENG_BOOK.titleZh}
      </h2>
      <p className="kerja-empty-en">{JIAOCHENG_BOOK.title}</p>
      <p className="sub" style={{ textWrap: 'pretty', marginTop: 10 }}>
        {JIAOCHENG_BOOK.blurb}. Lessons appear when JSON lands under{' '}
        <code>src/data/jiaocheng/part1/</code> and <code>part2/</code>.
      </p>
      <p className="sub" style={{ marginTop: 8 }}>
        No lessons loaded yet — nothing fake to start.
      </p>
    </section>
  )
}

export function JiaochengPath({
  lesson,
  current,
  nodeDone,
  onPlay,
  fill,
}: {
  lesson: JiaochengLesson
  current: { lesson: number; node: PathNode }
  nodeDone: (lesson: number, node: PathNode) => boolean
  onPlay?: (lesson: number, node: PathNode) => void
  fill?: boolean
}) {
  const progress = useJiaochengProgress()
  const nodes = nodesForLesson(lesson)
  return (
    <LearningPath
      fill={fill}
      kicker={`第 ${lesson.bookLesson} 课 · 第二册${bookPartLabel(lesson.book)}`}
      title={lesson.titleZh || lesson.titleEn}
      subtitle={lesson.titleEn}
      source={lesson.sourcePages ? `pp. ${lesson.sourcePages}` : undefined}
      open={progress.isLessonReached(lesson.index)}
      items={nodes.map(node => {
        const done = nodeDone(lesson.index, node)
        const on = current.lesson === lesson.index && current.node === node
        const caption = nodeCaptionJiaocheng(lesson, node)
        const activityTitle = node === 't2' ? lesson.dialogues[0]?.headingZh || lesson.dialogues[0]?.label : node === 't3' ? lesson.notes[0]?.title : undefined
        const title = (node === 't1' ? lesson.words[0]?.zh : undefined) || activityTitle || lesson.titleZh || lesson.titleEn
        const subtitle = node === 't1'
          ? lesson.words.slice(1, 4).map(word => word.zh).join(' · ') || lesson.words[0]?.en
          : node === 't2'
            ? lesson.dialogues[0]?.headingEn
            : node === 't3'
              ? [lesson.notes[0]?.example?.zh, lesson.notes[1]?.title].find(text => text && text.trim() !== title.trim())
              : undefined
        return {
          id: node,
          label: caption.zh,
          title,
          subtitle: subtitle?.trim() !== title.trim() ? subtitle : undefined,
          state: done ? 'done' as const : on ? 'current' as const : 'locked' as const,
          playable: progress.isNodePlayable(lesson.index, node),
          onSelect: () => onPlay?.(lesson.index, node),
        }
      })}
    />
  )
}

export function JiaochengHomePath({
  onPlay,
}: {
  onPlay: (lesson: number, node: PathNode) => void
}) {
  const { nextPlayable, isNodeDone } = useJiaochengProgress()
  if (jiaochengLessons.length === 0) return <JiaochengEmptyState />
  const lesson = getJiaochengLesson(nextPlayable.lesson) ?? jiaochengLessons[0]
  return (
    <JiaochengPath
      fill
      lesson={lesson}
      current={nextPlayable}
      nodeDone={isNodeDone}
      onPlay={onPlay}
    />
  )
}

export function JiaochengLearn({
  onPlay,
}: {
  onPlay: (lesson: number, node: PathNode) => void
}) {
  const { nextPlayable, isNodeDone } = useJiaochengProgress()
  if (jiaochengLessons.length === 0) {
    return <JiaochengEmptyState />
  }
  return (
    <>
      {jiaochengLessons.map((unit) => (
        <JiaochengPath
          key={unit.id}
          lesson={unit}
          current={nextPlayable}
          nodeDone={isNodeDone}
          onPlay={onPlay}
        />
      ))}
    </>
  )
}

export function JiaochengSession({
  lesson,
  node,
  onClose,
}: {
  lesson: number
  node: PathNode
  onClose: () => void
}) {
  const progress = useJiaochengProgress()
  const unit = getJiaochengLesson(lesson)
  if (!unit || !progress.isNodePlayable(lesson, node)) {
    return <LockedView onClose={onClose} />
  }
  return <JiaochengRunner lesson={lesson} node={node} onClose={onClose} />
}

function JiaochengRunner({ lesson, node, onClose }: {
  lesson: number
  node: PathNode
  onClose: () => void
}) {
  const store = useStore()
  const progress = useJiaochengProgress()
  const unit = getJiaochengLesson(lesson)!
  const { user } = useAuth()
  const resumeId = `jiaocheng:production-v2:${user?.id ?? 'local'}:${lesson}:${node}`
  const checkpoint = useRef(readLearningCheckpoint(resumeId))
  const steps = useMemo(() => buildJiaochengSteps(lesson, node), [lesson, node])
  const sessionWords = useMemo(() => [...new Set(steps.flatMap((activity) => {
    if (activity.kind === 'teach' || activity.kind === 'recall') return [activity.word.zh]
    if (activity.kind === 'produce') return activity.words
    if (activity.kind === 'dialogue') return unit.words.filter((word) => activity.text.lines.some((line) => line.zh.includes(word.zh))).map((word) => word.zh)
    return []
  }))], [steps, unit.words])
  const alreadyDone = useRef(progress.isNodeDone(lesson, node))
  const credited = useRef(new Set<string>())
  const finished = useRef(false)
  const left = useRef(new Set<number>())
  const xpRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(() => {
    const saved = steps.findIndex((activity) => activity.kind !== 'complete' && activity.id === checkpoint.current?.stepId)
    return saved >= 0 ? saved : 0
  })
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const [xp, setXp] = useState(0)
  const [fireworks, setFireworks] = useState(0)
  const [assistedSteps, setAssistedSteps] = useState<Record<string, boolean>>(() => Object.fromEntries((checkpoint.current?.assistedSteps ?? []).map((id) => [id, true])))
  const step = steps[Math.min(i, steps.length - 1)]
  const quizState = step.kind === 'quiz' ? quiz[step.id] : undefined
  const isComplete = step.kind === 'complete'
  const total = jiaochengPlayableCount(steps)
  const footerLocked = step.kind === 'quiz' && !quizState?.solved
  const beatKey = step.kind === 'complete' ? 'complete' : step.id

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [i])

  // The trail starts on encounter, even if the learner closes before advancing.
  useEffect(() => {
    if (step.kind === 'teach' && step.phase === 'meet') store.addCards(lesson + 3000, [step.word])
    if (step.kind === 'recall') store.encounterWord(step.word.zh, lesson + 3000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, lesson])

  useEffect(() => {
    if (isComplete) return
    writeLearningCheckpoint(resumeId, { stepId: step.id, retryWords: [], assistedSteps: Object.keys(assistedSteps).filter((id) => assistedSteps[id]) })
  }, [i, isComplete, resumeId, step, assistedSteps])

  useEffect(() => {
    if (!isComplete || finished.current) return
    finished.current = true
    playComplete()
    clearLearningCheckpoint(resumeId)
    progress.markNodeDone(lesson, node)
    recordHistory({ course: 'jiaocheng', kind: 'node', lesson: lesson, node, title: unit.titleEn || unit.titleZh || undefined })
    if (!alreadyDone.current) {
      store.awardXp(NODE_BONUS_XP)
      xpRef.current += NODE_BONUS_XP
      setXp(xpRef.current)
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

  function markAssisted(turnId?: string) {
    if (step.kind === 'complete') return
    const scope = turnId ? `${step.id}::${turnId}` : step.id
    setAssistedSteps((previous) => previous[scope] ? previous : { ...previous, [scope]: true })
  }

  function revealProgress() {
    if (step.kind !== 'recall' && step.kind !== 'dialogue' && step.kind !== 'produce') return
    if (step.kind === 'recall' && !assistedSteps[step.id]) store.recordRecall(step.word.zh, { correct: false, assisted: true, mode: 'recall' })
    setAssistedSteps((previous) => ({ ...previous, ...Object.fromEntries(steps.filter((activity) => activity.kind === 'recall' || activity.kind === 'dialogue' || activity.kind === 'produce').map((activity) => [activity.id, true])) }))
  }

  function goForward() {
    if (left.current.has(i)) return
    left.current.add(i)
    setI((current) => Math.min(current + 1, steps.length - 1))
  }

  function advance() {
    if (footerLocked) return
    if (step.kind === 'teach' && step.phase === 'meet') credit(step.id)
    if (step.kind === 'note' || step.kind === 'read') credit(step.id)
    if (isComplete) { onClose(); return }
    playAdvance()
    goForward()
  }

  function finishRecall() {
    if (step.kind !== 'recall') return
    credit(step.id)
    playAdvance()
    goForward()
  }

  function finishProduction(result: ProductionResult) {
    if (step.kind !== 'dialogue' && step.kind !== 'produce') return
    const outcomes = result.outcomes ?? result.words.map((word) => ({ word, ...result }))
    for (const outcome of outcomes) {
      if (outcome.evidence === 'practice') continue
      store.encounterWord(outcome.word, lesson + 3000)
      store.recordRecall(outcome.word, { correct: outcome.correct, assisted: outcome.assisted, mode: outcome.mode })
    }
    credit(step.id)
    recordHistory({ course: 'jiaocheng', kind: 'quiz', lesson: lesson, node, correct: result.evidence === 'practice' ? undefined : result.correct, title: result.evidence === 'practice' ? 'Sentence practice · ungraded' : undefined })
    playAdvance()
    goForward()
  }

  function answerQuiz(picked: string, answer: string) {
    if (step.kind !== 'quiz') return
    const key = step.id
    const previous = quiz[key] ?? { wrong: [], solved: false, missed: false }
    if (previous.solved || previous.wrong.includes(picked)) return
    if (unit.words.some((word) => word.zh === answer)) {
      store.recordRecall(answer, { correct: picked === answer, assisted: previous.missed, mode: 'recognition' })
    }
    if (picked === answer) {
      playCorrect()
      setFireworks((value) => value + 1)
      credit(key)
      recordHistory({ course: 'jiaocheng', kind: 'quiz', lesson: lesson, node, correct: true })
      setQuiz((questions) => ({ ...questions, [key]: { wrong: previous.wrong, solved: true, missed: previous.missed } }))
    } else {
      playWrong()
      recordHistory({ course: 'jiaocheng', kind: 'quiz', lesson: lesson, node, correct: false })
      setQuiz((questions) => ({ ...questions, [key]: { wrong: [...previous.wrong, picked], solved: false, missed: true } }))
    }
  }

  const progressPct = isComplete ? 100 : (i / total) * 100
  const showFooter = isComplete || step.kind === 'teach' || step.kind === 'note' || step.kind === 'read' || (step.kind === 'quiz' && quizState?.solved)
  const activeStage = step.kind === 'teach' ? 'Encounter' : step.kind === 'read' || step.kind === 'note' ? 'Understand' : step.kind === 'recall' || step.kind === 'quiz' ? 'Retrieve' : step.kind === 'complete' ? 'Revisit' : 'Produce'

  return (
    <div className="overlay session learning-session">
      <Fireworks token={fireworks} />
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label="Close session"><CloseIcon /></button>
        <div className="step-bar"><i className="yl-progress" style={{ width: `${Math.min(100, progressPct)}%` }} /></div>
        <MasteryTracker words={sessionWords} compact onOpen={revealProgress} />
      </div>
      <div className="learning-route" aria-label={`Learning stage: ${activeStage}`}>
        {['Encounter', 'Understand', 'Retrieve', 'Produce', 'Revisit'].map((stage) => <span key={stage} data-active={stage === activeStage} aria-current={stage === activeStage ? 'step' : undefined}>{stage}</span>)}
      </div>
      <div className="overlay-body" ref={bodyRef}>
        <div key={beatKey} className="session-beat yl-enter">
          {step.kind === 'teach' ? <TeachView phase={step.phase} word={step.word} example={step.example} hook={step.hook} lesson={lesson + 3000} n={step.n} of={step.of} />
            : step.kind === 'read' ? <ReadView text={step.text} />
              : step.kind === 'recall' ? <WordRecall word={step.word} n={step.n} of={step.of} externallyAssisted={assistedSteps[step.id]} onAssistance={() => {
                if (!assistedSteps[step.id]) store.recordRecall(step.word.zh, { correct: false, assisted: true, mode: 'recall' })
                markAssisted()
              }} onAttempt={(correct, assisted) => {
                store.recordRecall(step.word.zh, { correct, assisted, mode: 'recall' })
                markAssisted()
              }} onComplete={finishRecall} />
                : step.kind === 'dialogue' ? <DialoguePractice text={step.text} lesson={lesson} targetWords={unit.words.map((word) => word.zh)} externallyAssisted={assistedSteps[step.id]} assistedTurns={Object.keys(assistedSteps).filter((id) => id.startsWith(`${step.id}::`)).map((id) => id.slice(step.id.length + 2))} onAssistance={markAssisted} onComplete={finishProduction} />
                  : step.kind === 'produce' ? <SentencePractice example={step.example} targetWords={step.words} grammar={step.grammar} lesson={lesson} externallyAssisted={assistedSteps[step.id]} onAssistance={markAssisted} onComplete={finishProduction} />
                    : step.kind === 'note' ? <NoteView title={step.title} body={step.body} example={step.example} n={step.n} of={step.of} />
                      : step.kind === 'quiz' ? <MatchView question={step.question} n={step.n} of={step.of} state={quizState} onPick={answerQuiz} />
                        : <DoneView node={node} titleZh={unit.titleZh} titleEn={unit.titleEn} wordCount={jiaochengSittingWordCount(lesson, node)} xp={xp} replay={alreadyDone.current} words={sessionWords} />}
        </div>
      </div>
      {showFooter && <div className="overlay-foot">{(step.kind === 'teach' || step.kind === 'read' || step.kind === 'note') && <StudyDisplayControls />}<button type="button" className="btn" onPointerDown={() => unlockSpeech()} onClick={advance}>{isComplete ? 'Continue' : 'Next'}</button></div>}
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
      <header className="session-step-head">
        <div className="kicker-ink">
          {text.label} · {text.type === 'dialogue' ? 'Dialogue' : 'Passage'}
        </div>
        <h2 className="session-step-title" lang={hasHanzi(heading) ? 'zh-CN' : undefined}>
          {hasHanzi(heading) ? <Glossed text={heading} onWord={onWord} /> : heading}
        </h2>
      </header>
      {prefs.showEnglish && text.heading_en && text.heading_zh && <p className="session-read-en">{text.heading_en}</p>}
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
  n,
  of,
}: {
  title: string
  body: string
  example: { zh: string; pinyin: string; en: string } | null
  n: number
  of: number
}) {
  const { onWord, sheet } = useGloss()
  const { prefs } = useStore()
  const head = of > 1 ? `Note · ${n} of ${of}` : 'Note'
  const exampleZh = hearableZh(example?.zh)
  const titleZh = hearableZh(title)
  const bodyZh = hearableZh(body)

  return (
    <>
      <header className="session-step-head">
        <div className="kicker-ink">{head}</div>
        <h2 className="session-step-title" lang={hasHanzi(title) ? 'zh-CN' : undefined}>
          {hasHanzi(title) ? <Glossed text={title} onWord={onWord} /> : title}
        </h2>
      </header>
      <p className="sub" style={{ textWrap: 'pretty', lineHeight: 1.55 }} lang={hasHanzi(body) ? 'zh-CN' : undefined}>
        {hasHanzi(body) ? <Glossed text={body} onWord={onWord} /> : body}
      </p>
      {example && exampleZh && (
        <div className="card session-prompt">
          <p className="zh" lang="zh-CN" style={{ fontSize: 20, fontWeight: 800, margin: 0, textWrap: 'pretty' }}>
            <Glossed text={example.zh} onWord={onWord} />
          </p>
          {prefs.showPinyin && example.pinyin && (
            <p className="sub" style={{ margin: '6px 0 0', color: 'var(--red-mid)' }}>
              {example.pinyin}
            </p>
          )}
          {prefs.showEnglish && example.en && <p className="sub" style={{ margin: '8px 0 0' }}>{example.en}</p>}
          <div style={{ marginTop: 12 }}>
            <ChineseHear text={exampleZh} label="Hear the line" rate={LINE_RATE} />
          </div>
        </div>
      )}
      {!exampleZh && titleZh && (
        <div style={{ marginTop: 14 }}>
          <ChineseHear text={titleZh} label="Hear it" />
        </div>
      )}
      {!exampleZh && !titleZh && bodyZh && (
        <div style={{ marginTop: 14 }}>
          <ChineseHear text={bodyZh} label="Hear it" />
        </div>
      )}
      {sheet}
    </>
  )
}

function MatchView({
  question,
  n,
  of,
  state,
  onPick,
}: {
  question: Question
  n: number
  of: number
  state: QuizState | undefined
  onPick: (picked: string, answer: string) => void
}) {
  const wrong = state?.wrong ?? []
  const solved = state?.solved ?? false
  const missed = state?.missed ?? false
  const { onWord, sheet } = useGloss()
  const contextZh = question.context?.zh?.trim() ?? ''
  const chineseChoices = question.options
    .map((o) => o.label)
    .filter((label) => hasHanzi(label) && !/[A-Za-z]{3,}/.test(label))
  const choiceKey = chineseChoices.join('\u0001')
  const choicesPlaying = useSpeechActive(`lines|${choiceKey}`)

  useAutoSpeak(contextZh, VOICE.xiaoxiao, LINE_RATE)
  useAutoSpeakLines(contextZh ? [] : chineseChoices, VOICE.xiaoxiao, WORD_RATE)

  return (
    <>
      <StepHead kicker={of > 1 ? `Check · ${n} of ${of}` : 'Check'} title={question.prompt} />
      {question.context && (
        <div className="card session-prompt">
          <p className="zh" lang="zh-CN" style={{ fontSize: 22, fontWeight: 800, margin: 0, textWrap: 'pretty' }}>
            <Glossed text={question.context.zh} onWord={onWord} />
          </p>
          <div style={{ marginTop: 12 }}>
            <HearButton text={question.context.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label="Hear the line" />
          </div>
        </div>
      )}
      {!question.context && chineseChoices.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="hear hear-ink"
            data-on={choicesPlaying}
            aria-label={choicesPlaying ? 'Stop choices' : 'Hear choices'}
            aria-pressed={choicesPlaying}
            onPointerDown={() => unlockSpeech()}
            onClick={() => {
              if (choicesPlaying) {
                stopSpeech()
                return
              }
              void speakLines(
                chineseChoices.map((text) => ({ text, voice: VOICE.xiaoxiao, rate: WORD_RATE })),
                { group: `lines|${choiceKey}`, key: `lines|${choiceKey}` },
              )
            }}
          >
            <span>{choicesPlaying ? 'Playing' : 'Hear choices'}</span>
          </button>
        </div>
      )}
      <div className="session-options">
        {question.options.map((o) => {
          const isAnswer = o.zh === question.answer
          const isWrong = wrong.includes(o.zh)
          const st = solved && isAnswer ? 'correct' : isWrong ? 'wrong' : undefined
          const motion = solved && isAnswer ? ' yl-correct' : isWrong ? ' yl-wrong' : ''
          return (
            <button
              key={isWrong ? `${o.zh}-miss` : o.zh}
              type="button"
              className={`option zh${motion}`}
              data-state={st}
              disabled={solved || isWrong}
              onPointerDown={() => unlockSpeech()}
              onClick={() => onPick(o.zh, question.answer)}
              lang="zh-CN"
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {solved && (
        <div className="yl-enter-up" style={{ textAlign: 'center', marginTop: 2 }} aria-live="polite">
          <strong style={{ fontSize: 16, fontWeight: 800, color: 'var(--red-deep)' }}>
            {missed ? 'That’s it' : 'Nice!'}
          </strong>
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
  const label = JIAOCHENG_NODE_LABEL[node]
  return (
    <div style={{ textAlign: 'center', paddingTop: 36 }}>
      <div className="medal pop">
        <CheckIcon size={46} />
      </div>
      <h2 className="h1 yl-enter" style={{ marginTop: 22, textWrap: 'balance' }}>
        {label.en} complete
      </h2>
      <p className="sub yl-enter-up" style={{ marginTop: 8, animationDelay: '80ms', textWrap: 'pretty' }}>
        {titleZh} · {titleEn}
      </p>
      <div className="learning-summary"><MasteryTracker words={words} /><p>Your words are tracked automatically. Return on another day to prove recall without hints.</p></div>
      <div
        className="session-xp yl-pop"
        style={{ marginTop: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', animationDelay: '120ms' }}
      >
        +{xp} XP
      </div>
      <div
        className="row yl-enter-up"
        style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap', animationDelay: '180ms' }}
      >
        <span className="pill-ink">+{ITEM_XP} XP / item</span>
        {!replay && <span className="pill-ink">+{NODE_BONUS_XP} node</span>}
        {wordCount > 0 && <span className="pill-ink">{wordCount} words</span>}
      </div>
    </div>
  )
}

function LockedView({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay session">
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="yl-enter" style={{ textAlign: 'center' }}>
          <LockIcon size={36} />
          <h2 className="h1" style={{ marginTop: 16 }}>
            Locked
          </h2>
          <p className="sub" style={{ marginTop: 8 }}>
            Finish the earlier Jiaocheng nodes first.
          </p>
        </div>
      </div>
    </div>
  )
}
