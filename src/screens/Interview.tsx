import { useEffect, useMemo, useRef, useState } from 'react'
import { Fireworks } from '../components/Fireworks'
import { HearButton } from '../components/Hear'
import { CheckIcon, CloseIcon, HeartIcon, LockIcon, PlayIcon } from '../components/Icons'
import {
  buildInterviewSteps,
  getInterviewChapter,
  INTERVIEW_BOOK,
  interviewChapters,
  interviewParts,
  interviewPlayableCount,
  LESSON_NODE,
  nodeLabelInterview,
  SITTING_KIND_LABEL,
  useInterviewProgress,
  type InterviewBeat,
  type InterviewChapter,
  type InterviewNode,
  type InterviewTerm,
} from '../lib/interview'
import { recordHistory } from '../lib/history'
import { clearStep, readStep, writeStep } from '../lib/resume'
import { playCorrect, playWrong } from '../lib/sfx'
import { unlockSpeech } from '../lib/speech'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'
import { ITEM_XP, NODE_BONUS_XP, SESSION_HEARTS } from '../lib/wordsSession'
import { useStore } from '../store/store'
import '../styles/teach-motion.css'
import '../styles/interview.css'

const CORRECT_HOLD_MS = 700

type QuizState = { wrong: number[]; solved: boolean; missed: boolean }
type HeartLoss = { index: number; tick: number }

function pathRowClass(state: 'done' | 'on' | 'lock') {
  if (state === 'done') return 'interview-path-row interview-path-row-done'
  if (state === 'on') return 'interview-path-row interview-path-row-on'
  return 'interview-path-row interview-path-row-lock'
}

function splitSentences(body: string): string[] {
  const trimmed = body.trim()
  if (!trimmed) return []
  const parts = trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
  if (!parts) return [trimmed]
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function InterviewEmptyState() {
  return (
    <section className="kerja-empty metal">
      <div className="kicker">总办</div>
      <h2 className="zh" lang="zh-CN">
        {INTERVIEW_BOOK.titleZh}
      </h2>
      <p className="kerja-empty-en">{INTERVIEW_BOOK.title}</p>
      <p className="sub" style={{ textWrap: 'pretty', marginTop: 10 }}>
        {INTERVIEW_BOOK.blurb}. Chapters appear here when unit JSON is added under{' '}
        <code>src/data/interview/</code>.
      </p>
    </section>
  )
}

export function InterviewPartPath({
  chapters,
  part,
  partTitle,
  current,
  nodeDone,
  onPlay,
  fill,
}: {
  chapters: InterviewChapter[]
  part: number
  partTitle: string
  current: { chapter: number; node: InterviewNode }
  nodeDone: (chapter: number, node: InterviewNode) => boolean
  onPlay?: (chapter: number, node: InterviewNode) => void
  fill?: boolean
}) {
  const progress = useInterviewProgress()
  const anyOpen = chapters.some((ch) => progress.isChapterReached(ch.index))

  return (
    <section className={`interview-path${fill ? ' interview-path-fill' : ''}`}>
      <div className={`path-banner metal${anyOpen ? '' : ' path-banner-lock'}`}>
        <div className="path-banner-copy">
          <div className="kicker">Part {part}</div>
          <h2 className="path-banner-zh">{partTitle}</h2>
          <div className="path-banner-en">
            {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
          </div>
        </div>
        <span className="path-banner-read">总</span>
      </div>

      <ol className="interview-path-list">
        {chapters.map((chapter) => {
          const node = LESSON_NODE
          const done = nodeDone(chapter.index, node)
          const on = current.chapter === chapter.index && current.node === node
          const playable = progress.isNodePlayable(chapter.index, node)
          const state = done ? 'done' : on ? 'on' : 'lock'
          const title = chapter.titleEn || chapter.titleSource || `Chapter ${chapter.index}`
          return (
            <li key={chapter.id} className="interview-path-item">
              <button
                type="button"
                className={`${pathRowClass(state)} tap44`}
                data-state={state}
                data-node={node}
                disabled={!playable}
                onPointerDown={() => {
                  if (playable) unlockSpeech()
                }}
                onClick={() => {
                  if (!playable) return
                  onPlay?.(chapter.index, node)
                }}
                aria-label={`${title}${done ? ', done' : on ? ', start' : ', locked'}`}
              >
                <span className="interview-path-node" aria-hidden>
                  {done ? <CheckIcon size={20} /> : on ? <PlayIcon size={20} /> : <LockIcon size={15} />}
                </span>
                <span className="interview-path-title">{title}</span>
                {on && <span className="interview-path-start">START</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function InterviewHomePath({
  onPlay,
}: {
  onPlay: (chapter: number, node: InterviewNode) => void
}) {
  const { nextPlayable, isNodeDone } = useInterviewProgress()
  if (interviewChapters.length === 0) return <InterviewEmptyState />
  const chapter = getInterviewChapter(nextPlayable.chapter) ?? interviewChapters[0]
  const partGroup =
    interviewParts().find((p) => p.part === chapter.part) ??
    ({
      part: chapter.part,
      titleEn: chapter.partTitleEn || `Part ${chapter.part}`,
      chapters: [chapter],
    } as const)
  return (
    <InterviewPartPath
      fill
      part={partGroup.part}
      partTitle={partGroup.titleEn}
      chapters={partGroup.chapters}
      current={nextPlayable}
      nodeDone={isNodeDone}
      onPlay={onPlay}
    />
  )
}

export function InterviewLearn({
  onPlay,
}: {
  onPlay: (chapter: number, node: InterviewNode) => void
}) {
  const { nextPlayable, isNodeDone } = useInterviewProgress()
  if (interviewChapters.length === 0) {
    return <InterviewEmptyState />
  }
  return (
    <div className="interview-learn">
      {interviewParts().map((part) => (
        <div key={part.part} className="interview-part">
          <InterviewPartPath
            part={part.part}
            partTitle={part.titleEn}
            chapters={part.chapters}
            current={nextPlayable}
            nodeDone={isNodeDone}
            onPlay={onPlay}
          />
        </div>
      ))}
    </div>
  )
}

export function InterviewSession({
  chapter,
  node,
  onClose,
}: {
  chapter: number
  node: InterviewNode
  onClose: () => void
}) {
  const progress = useInterviewProgress()
  const ch = getInterviewChapter(chapter)
  if (!ch || node !== LESSON_NODE || !progress.isNodePlayable(chapter, LESSON_NODE)) {
    return <LockedView onClose={onClose} />
  }
  return <InterviewRunner chapter={chapter} onClose={onClose} />
}

function InterviewRunner({ chapter, onClose }: { chapter: number; onClose: () => void }) {
  const store = useStore()
  const progress = useInterviewProgress()
  const ch = getInterviewChapter(chapter)!
  const node = LESSON_NODE
  const resumeId = `interview:${chapter}:${node}`
  const steps = useMemo(() => buildInterviewSteps(chapter, node), [chapter, node])
  const alreadyDone = useRef(progress.isNodeDone(chapter, node))
  const credited = useRef(new Set<string>())
  const finished = useRef(false)
  const left = useRef(new Set<number>())
  const xpRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [i, setI] = useState(() => {
    const built = buildInterviewSteps(chapter, node)
    const saved = readStep(resumeId)
    return saved > 0 && saved < built.length ? saved : 0
  })
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const [hearts, setHearts] = useState(SESSION_HEARTS)
  const [heartLoss, setHeartLoss] = useState<HeartLoss | null>(null)
  const [failed, setFailed] = useState(false)
  const [xp, setXp] = useState(0)
  const [fwToken, setFwToken] = useState(0)

  const step = steps[Math.min(i, steps.length - 1)]
  const isComplete = !failed && step.kind === 'complete'
  const total = interviewPlayableCount(steps)
  const quizState = step.kind === 'quiz' ? quiz[step.id] : undefined
  const footerLocked = !failed && step.kind === 'quiz' && !quizState?.solved
  const beatKey = failed ? 'failed' : step.kind === 'complete' ? 'complete' : step.id

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [i, failed])

  useEffect(() => {
    if (isComplete) return
    writeStep(resumeId, i)
  }, [i, isComplete, resumeId])

  useEffect(() => {
    if (!isComplete || finished.current) return
    finished.current = true
    clearStep(resumeId)
    progress.markNodeDone(chapter, node)
    recordHistory({
      course: 'interview',
      kind: 'node',
      lesson: chapter,
      node,
      title: ch.titleEn || undefined,
    })
    if (!alreadyDone.current) {
      store.awardXp(NODE_BONUS_XP)
      xpRef.current += NODE_BONUS_XP
      setXp(xpRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, chapter, node, resumeId])

  useEffect(() => {
    if (failed || step.kind !== 'quiz' || !quizState?.solved) return
    const from = i
    const t = window.setTimeout(() => {
      if (left.current.has(from)) return
      left.current.add(from)
      setI((cur) => (cur === from ? Math.min(cur + 1, steps.length - 1) : cur))
    }, CORRECT_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [failed, i, quizState?.solved, step.kind, steps.length])

  function credit(id: string) {
    if (credited.current.has(id)) return
    credited.current.add(id)
    xpRef.current += ITEM_XP
    setXp(xpRef.current)
    store.awardXp(ITEM_XP)
    store.practiceLog()
  }

  function goForward() {
    if (left.current.has(i)) return
    left.current.add(i)
    setI((cur) => Math.min(cur + 1, steps.length - 1))
  }

  function advance() {
    if (footerLocked) return
    if (failed || isComplete) {
      onClose()
      return
    }
    if (step.kind === 'idea' || step.kind === 'term' || step.kind === 'say') {
      credit(step.id)
    }
    goForward()
  }

  function answerQuiz(picked: number, answer: number) {
    if (step.kind !== 'quiz') return
    const key = step.id
    const prev = quiz[key] ?? { wrong: [], solved: false, missed: false }
    if (prev.solved || prev.wrong.includes(picked)) return

    if (picked === answer) {
      playCorrect()
      setFwToken((t) => t + 1)
      credit(key)
      recordHistory({ course: 'interview', kind: 'quiz', lesson: chapter, node, correct: true })
      setQuiz((q) => ({
        ...q,
        [key]: { wrong: prev.wrong, solved: true, missed: prev.missed || prev.wrong.length > 0 },
      }))
      return
    }

    playWrong()
    recordHistory({ course: 'interview', kind: 'quiz', lesson: chapter, node, correct: false })
    const nextHearts = hearts - 1
    setHearts(Math.max(0, nextHearts))
    setHeartLoss({ index: Math.max(0, nextHearts), tick: Date.now() })
    setQuiz((q) => ({
      ...q,
      [key]: { wrong: [...prev.wrong, picked], solved: false, missed: true },
    }))
    if (nextHearts <= 0) setFailed(true)
  }

  const progressPct = failed
    ? (i / total) * 100
    : isComplete
      ? 100
      : ((i + 1) / total) * 100
  const showFooter =
    failed || isComplete || step.kind === 'idea' || step.kind === 'term' || step.kind === 'say'
  const footerLabel = failed || isComplete ? 'Continue' : 'Next'

  return (
    <div className="overlay session">
      <Fireworks token={fwToken} />
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label="Close session">
          <CloseIcon />
        </button>
        <div className="step-bar">
          <i className="yl-progress" style={{ width: `${Math.min(100, progressPct)}%` }} />
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
            <FailedView xp={xp} loss={heartLoss} />
          ) : step.kind === 'idea' ? (
            <IdeaScreen beat={step.beat} beatNum={step.beatNum} beatOf={step.beatOf} />
          ) : step.kind === 'term' ? (
            <TermScreen
              term={step.term}
              termNum={step.termNum}
              termOf={step.termOf}
              kind={step.beat.kind}
            />
          ) : step.kind === 'say' ? (
            <SayScreen mandarin={step.mandarin} beatNum={step.beatNum} beatOf={step.beatOf} />
          ) : step.kind === 'quiz' ? (
            <CheckScreen
              prompt={step.prompt}
              choices={step.choices}
              answer={step.answer}
              beatNum={step.beatNum}
              beatOf={step.beatOf}
              state={quizState}
              onPick={answerQuiz}
            />
          ) : (
            <DoneView chapter={ch} xp={xp} replay={alreadyDone.current} />
          )}
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

function InterviewKicker({ kicker }: { kicker: string }) {
  return (
    <header className="session-step-head">
      <div className="kicker-ink">{kicker}</div>
    </header>
  )
}

const LINE_REVEAL_MS = 260
const CHIP_STAGGER_MS = 80

function chipZhSize(zh: string): string {
  const n = Array.from(zh.trim()).length
  if (n <= 6) return '13px'
  if (n <= 8) return '12px'
  if (n <= 10) return '11px'
  return '10px'
}

function IdeaScreen({
  beat,
  beatNum,
  beatOf,
}: {
  beat: InterviewBeat
  beatNum: number
  beatOf: number
}) {
  const kindLabel = SITTING_KIND_LABEL[beat.kind]
  const sentences = useMemo(() => splitSentences(beat.bodyEn), [beat.bodyEn])
  const terms = useMemo(
    () => beat.terms?.filter((t) => t.zh.trim() && t.en.trim()) ?? [],
    [beat.terms],
  )
  const [shown, setShown] = useState(0)
  const [chipsOn, setChipsOn] = useState(false)
  const kicker = beatOf > 1 ? `${kindLabel} · ${beatNum} of ${beatOf}` : kindLabel
  const hero = beat.titleEn?.trim() || kindLabel

  useEffect(() => {
    setShown(0)
    setChipsOn(false)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(sentences.length)
      setChipsOn(true)
      return
    }
    const timers: number[] = []
    if (sentences.length === 0) {
      timers.push(window.setTimeout(() => setChipsOn(true), LINE_REVEAL_MS))
    } else {
      for (let i = 0; i < sentences.length; i++) {
        timers.push(window.setTimeout(() => setShown(i + 1), (i + 1) * LINE_REVEAL_MS))
      }
      timers.push(
        window.setTimeout(() => setChipsOn(true), sentences.length * LINE_REVEAL_MS + CHIP_STAGGER_MS),
      )
    }
    return () => {
      for (const t of timers) window.clearTimeout(t)
    }
  }, [beat.id, sentences])

  return (
    <div className="interview-stage" data-phase="idea">
      <InterviewKicker kicker={kicker} />
      <article className="interview-skill-card">
        <h2 className="interview-skill-hero">{hero}</h2>
        <div className="interview-skill-body">
          {sentences.length === 0 ? (
            <p className="interview-line interview-line-in">No explanation for this beat.</p>
          ) : (
            sentences.map((sentence, idx) => (
              <p
                key={`${beat.id}-s-${idx}`}
                className={
                  idx < shown ? 'interview-line interview-line-in' : 'interview-line interview-line-wait'
                }
              >
                {sentence}
              </p>
            ))
          )}
        </div>
        {terms.length > 0 && chipsOn ? (
          <ul className="interview-term-chips" aria-label="Interview terms">
            {terms.map((term, idx) => (
              <li
                key={`${beat.id}-chip-${term.zh}-${idx}`}
                className="interview-chip"
                style={{ animationDelay: `${idx * CHIP_STAGGER_MS}ms` }}
              >
                <span
                  className="interview-chip-zh"
                  lang="zh-CN"
                  style={{ fontSize: chipZhSize(term.zh) }}
                >
                  {term.zh}
                </span>
                <span className="interview-chip-en">{term.en}</span>
                {term.hook?.trim() ? <span className="interview-chip-hook">{term.hook}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </div>
  )
}

function TermScreen({
  term,
  termNum,
  termOf,
  kind,
}: {
  term: InterviewTerm
  termNum: number
  termOf: number
  kind: InterviewBeat['kind']
}) {
  const kicker =
    termOf > 1
      ? `Term · ${termNum} of ${termOf} · ${SITTING_KIND_LABEL[kind]}`
      : `Term · ${SITTING_KIND_LABEL[kind]}`

  return (
    <div className="interview-stage" data-phase="term">
      <InterviewKicker kicker={kicker} />
      <article className="interview-skill-card interview-skill-card-term">
        <h2 className="interview-skill-hero">{term.en}</h2>
        <p className="interview-term-zh" lang="zh-CN">
          {term.zh}
        </p>
        {term.hook?.trim() ? <p className="interview-term-hook">{term.hook}</p> : null}
        <div className="interview-term-hear">
          <HearButton text={term.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear the word" tone="ink" />
        </div>
      </article>
    </div>
  )
}

function SayScreen({
  mandarin,
  beatNum,
  beatOf,
}: {
  mandarin: string
  beatNum: number
  beatOf: number
}) {
  const kicker = beatOf > 1 ? `Say · ${beatNum} of ${beatOf}` : 'Say'

  return (
    <div className="interview-stage" data-phase="say">
      <InterviewKicker kicker={kicker} />
      <article className="interview-skill-card interview-say-card">
        <p className="interview-say-label">Say this</p>
        <p className="interview-say-zh" lang="zh-CN">
          {mandarin}
        </p>
        <div className="interview-say-hear">
          <HearButton text={mandarin} voice={VOICE.xiaoxiao} rate={LINE_RATE} label="Hear the line" />
        </div>
      </article>
    </div>
  )
}

function CheckScreen({
  prompt,
  choices,
  answer,
  beatNum,
  beatOf,
  state,
  onPick,
}: {
  prompt: string
  choices: string[]
  answer: number
  beatNum: number
  beatOf: number
  state: QuizState | undefined
  onPick: (picked: number, answer: number) => void
}) {
  const wrong = state?.wrong ?? []
  const solved = state?.solved ?? false
  const missed = state?.missed ?? false

  return (
    <>
      <StepHead kicker={beatOf > 1 ? `Check · ${beatNum} of ${beatOf}` : 'Check'} title={prompt} />
      <div className="session-options">
        {choices.map((label, idx) => {
          const isAnswer = idx === answer
          const isWrong = wrong.includes(idx)
          const st = solved && isAnswer ? 'correct' : isWrong ? 'wrong' : undefined
          const motion = solved && isAnswer ? ' yl-correct' : isWrong ? ' yl-wrong' : ''
          return (
            <button
              key={isWrong ? `${idx}-miss` : idx}
              type="button"
              className={`option${motion}`}
              data-state={st}
              disabled={solved || isWrong}
              onPointerDown={() => unlockSpeech()}
              onClick={() => onPick(idx, answer)}
            >
              {label}
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

function DoneView({
  chapter,
  xp,
  replay,
}: {
  chapter: InterviewChapter
  xp: number
  replay: boolean
}) {
  const label = nodeLabelInterview(chapter, LESSON_NODE)
  return (
    <div style={{ textAlign: 'center', paddingTop: 36 }}>
      <div className="medal pop">
        <CheckIcon size={46} />
      </div>
      <h2 className="h1 yl-enter" style={{ marginTop: 22, textWrap: 'balance' }}>
        Chapter complete
      </h2>
      <p className="sub yl-enter-up" style={{ marginTop: 8, animationDelay: '80ms', textWrap: 'pretty' }}>
        {label}
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
      </div>
    </div>
  )
}

function FailedView({ xp, loss }: { xp: number; loss?: HeartLoss | null }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <Hearts count={0} loss={loss ?? { index: 0, tick: 1 }} />
      </div>
      <h2 className="h1" style={{ marginTop: 12, textWrap: 'balance' }}>
        Out of hearts
      </h2>
      <p className="sub" style={{ marginTop: 8, textWrap: 'pretty' }}>
        Try this chapter again when you’re ready.
      </p>
      <div className="session-xp" style={{ marginTop: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        +{xp} XP
      </div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <span className="pill-ink">Chapter not marked done</span>
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
            Finish the earlier 总办 chapters first.
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
