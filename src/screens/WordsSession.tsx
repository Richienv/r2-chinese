import { useEffect, useMemo, useRef, useState } from 'react'
import { Line, useGloss } from '../components/ChineseText'
import { CheckIcon, CloseIcon, HeartIcon, LockIcon } from '../components/Icons'
import { getLesson, type Example } from '../lib/content'
import { TeachView } from './TeachBeats'
import type { Question } from '../lib/quiz'
import type { LessonText, Vocab } from '../lib/types'
import {
  ITEM_XP,
  NODE_BONUS_XP,
  NODE_LABEL,
  SESSION_HEARTS,
  buildSteps,
  isNodePlayable,
  isSessionOpen,
  playableCount,
  sittingWordCount,
  teachVocab,
  type SessionStep,
} from '../lib/wordsSession'
import { useStore, type PathNode } from '../store/store'

const CORRECT_HOLD_MS = 700

type QuizState = { wrong: string[]; solved: boolean; missed: boolean }
type HeartLoss = { index: number; tick: number }

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

function WordsRunner({
  lesson,
  node,
  onClose,
}: {
  lesson: number
  node: PathNode
  onClose: () => void
}) {
  const store = useStore()
  const steps = useMemo(() => buildSteps(lesson, node), [lesson, node])
  const alreadyDone = useRef(store.isNodeDone(lesson, node))
  const credited = useRef(new Set<string>())
  const finished = useRef(false)
  const left = useRef(new Set<number>())
  const xpRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [i, setI] = useState(0)
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const [hearts, setHearts] = useState(SESSION_HEARTS)
  const [heartLoss, setHeartLoss] = useState<HeartLoss | null>(null)
  const [failed, setFailed] = useState(false)
  const [xp, setXp] = useState(0)

  const step = steps[Math.min(i, steps.length - 1)]
  const quizState = step.kind === 'quiz' ? quiz[step.id] : undefined
  const isComplete = !failed && step.kind === 'complete'
  const total = playableCount(steps)
  const footerLocked = !failed && step.kind === 'quiz' && !quizState?.solved
  const beatKey = failed ? 'failed' : step.kind === 'complete' ? 'complete' : step.id

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [i, failed])

  useEffect(() => {
    if (!isComplete || finished.current) return
    finished.current = true
    store.markNodeDone(lesson, node)
    if (!alreadyDone.current) {
      store.awardXp(NODE_BONUS_XP)
      xpRef.current += NODE_BONUS_XP
      setXp(xpRef.current)
    }
    if (node === 'wrap' && !alreadyDone.current) {
      store.finishLesson(lesson, teachVocab(lesson), 40)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, lesson, node])

  useEffect(() => {
    if (failed || step.kind !== 'quiz' || !quizState?.solved) return
    const from = i
    const t = window.setTimeout(() => {
      if (left.current.has(from)) return
      left.current.add(from)
      setI((cur) => (cur === from ? cur + 1 : cur))
    }, CORRECT_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [failed, i, quizState?.solved, step.kind])

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
    if (failed || isComplete) {
      onClose()
      return
    }
    goForward()
  }

  function answerQuiz(picked: string, answer: string) {
    if (step.kind !== 'quiz') return
    const key = step.id
    const prev = quiz[key] ?? { wrong: [], solved: false, missed: false }
    if (prev.solved || prev.wrong.includes(picked)) return

    if (picked === answer) {
      credit(key)
      setQuiz((q) => ({
        ...q,
        [key]: { wrong: prev.wrong, solved: true, missed: prev.missed || prev.wrong.length > 0 },
      }))
      return
    }

    const nextHearts = hearts - 1
    setHearts(Math.max(0, nextHearts))
    setHeartLoss({ index: Math.max(0, nextHearts), tick: Date.now() })
    setQuiz((q) => ({
      ...q,
      [key]: { wrong: [...prev.wrong, picked], solved: false, missed: true },
    }))
    if (nextHearts <= 0) setFailed(true)
  }

  const progress = failed ? (i / total) * 100 : isComplete ? 100 : ((i + 1) / total) * 100
  const showFooter =
    failed || isComplete || step.kind === 'teach' || step.kind === 'note' || step.kind === 'read'
  const footerLabel = failed || isComplete ? 'Continue' : 'Next'

  return (
    <div className="overlay session">
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label="Close session">
          <CloseIcon />
        </button>
        <div className="step-bar">
          <i className="yl-progress" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <Hearts count={hearts} loss={heartLoss} />
        {xp > 0 && (
          <span key={xp} className="session-xp yl-pop" aria-label={`${xp} XP earned this session`}>
            +{xp}
          </span>
        )}
      </div>

      <div className="overlay-body" ref={bodyRef}>
        <div key={beatKey} className="session-beat yl-enter">
          {failed ? (
            <FailedView xp={xp} wordsMet={countMet(steps, credited.current)} loss={heartLoss} />
          ) : step.kind === 'teach' ? (
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
            <MatchView
              question={step.question}
              n={step.n}
              of={step.of}
              state={quizState}
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
              hearts={hearts}
            />
          )}
        </div>
      </div>

      {showFooter && (
        <div className="overlay-foot">
          <button type="button" className="btn" onClick={advance}>
            {footerLabel}
          </button>
        </div>
      )}
    </div>
  )
}

function countMet(steps: SessionStep[], credited: Set<string>): number {
  return steps.filter((s) => s.kind === 'teach' && s.phase === 'meet' && credited.has(s.id)).length
}

function Hearts({ count, loss }: { count: number; loss?: HeartLoss | null }) {
  return (
    <div className="session-hearts hearts" aria-label={`${count} of ${SESSION_HEARTS} hearts`}>
      {Array.from({ length: SESSION_HEARTS }, (_, n) => {
        const justLost = loss?.index === n
        return (
          <span
            key={justLost ? `lost-${loss.tick}` : `h-${n}`}
            className={justLost ? 'heart yl-heart-loss' : 'heart'}
            data-off={n >= count}
          >
            <HeartIcon size={15} filled={n < count} />
          </span>
        )
      })}
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
  const heading = text.heading_zh || text.heading_en || text.label
  return (
    <>
      <StepHead
        kicker={`${text.label} · ${text.type === 'dialogue' ? 'Dialogue' : 'Passage'}`}
        title={heading}
      />
      {text.heading_en && text.heading_zh && <p className="session-read-en">{text.heading_en}</p>}
      <div className="session-read">
        {text.lines.map((line, i) => (
          <Line
            key={`${text.label}-${i}`}
            line={line}
            self={text.type === 'dialogue' && i % 2 === 1}
            showPinyin
            showEnglish
            onWord={onWord}
          />
        ))}
      </div>
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
  return (
    <>
      <StepHead kicker={of > 1 ? `Check · ${n} of ${of}` : 'Check'} title={question.prompt} />
      {question.context && (
        <div className="card session-prompt">
          <p className="zh" lang="zh-CN" style={{ fontSize: 22, fontWeight: 800, margin: 0, textWrap: 'pretty' }}>
            {question.context.zh}
          </p>
          {question.context.pinyin && (
            <p className="sub" style={{ margin: '6px 0 0', color: 'var(--red-mid)' }}>
              {question.context.pinyin}
            </p>
          )}
          {solved && question.context.en && (
            <p className="sub" style={{ margin: '8px 0 0' }}>
              {question.context.en}
            </p>
          )}
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
          <strong
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '-0.2px',
              color: 'var(--red-deep)',
              textWrap: 'balance',
            }}
          >
            {missed ? 'That’s it' : 'Nice!'}
          </strong>
        </div>
      )}
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
  const head =
    kicker && kicker !== 'Grammar'
      ? kicker
      : of > 1
        ? `Grammar · ${n} of ${of}`
        : (kicker ?? 'Grammar')
  return (
    <>
      <StepHead kicker={head} title={title} />
      <p className="sub" style={{ textWrap: 'pretty', lineHeight: 1.55 }}>
        {body}
      </p>
      {example && (
        <div className="card session-prompt">
          <p className="zh" lang="zh-CN" style={{ fontSize: 20, fontWeight: 800, margin: 0, textWrap: 'pretty' }}>
            {example.zh}
          </p>
          {example.pinyin && (
            <p className="sub" style={{ margin: '6px 0 0', color: 'var(--red-mid)' }}>
              {example.pinyin}
            </p>
          )}
          {example.en && <p className="sub" style={{ margin: '8px 0 0' }}>{example.en}</p>}
        </div>
      )}
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
  hearts,
}: {
  node: PathNode
  titleZh: string
  titleEn: string
  wordCount: number
  xp: number
  replay: boolean
  hearts: number
}) {
  const label = NODE_LABEL[node]
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
        {node !== 'wrap' && wordCount > 0 && <span className="pill-ink">{wordCount} words</span>}
        <span className="pill-ink">
          <HeartIcon size={12} /> {hearts}
        </span>
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
          ? 'Replay credited practice, not a second crown.'
          : node === 'wrap'
            ? 'Lesson banked. Every 生词 from this lesson is in your review deck.'
            : 'Next 课文-unit is open. Keep going — HSK 4 is the whole book.'}
      </p>
    </div>
  )
}

function FailedView({
  xp,
  wordsMet,
  loss,
}: {
  xp: number
  wordsMet: number
  loss?: HeartLoss | null
}) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <Hearts count={0} loss={loss ?? { index: 0, tick: 1 }} />
      </div>
      <h2 className="h1" style={{ marginTop: 12, textWrap: 'balance' }}>
        Out of hearts
      </h2>
      <p className="sub" style={{ marginTop: 8, textWrap: 'pretty' }}>
        Fail-forward stopped here — try this node again when you’re ready.
      </p>
      <div className="session-xp" style={{ marginTop: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        +{xp} XP
      </div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <span className="pill-ink">{wordsMet} words met</span>
        <span className="pill-ink">Node not marked done</span>
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
          <div className="medal" style={{ opacity: 0.55 }}>
            <LockIcon size={36} />
          </div>
          <h2 className="h2" style={{ marginTop: 18, textWrap: 'balance' }}>
            This sitting isn’t open yet
          </h2>
          <p className="sub" style={{ marginTop: 8, textWrap: 'pretty' }}>
            Finish the sitting before this one first.
          </p>
        </div>
      </div>
      <div className="overlay-foot">
        <button type="button" className="btn" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  )
}
