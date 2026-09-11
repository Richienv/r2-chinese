import { useEffect, useMemo, useRef, useState } from 'react'
import { FlipCard } from '../components/FlipCard'
import { Glossed, Line, useGloss } from '../components/ChineseText'
import { CheckIcon, ChevronLeft, CloseIcon, SpeakerIcon } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { Writer } from '../components/Writer'
import { focusChar, getLesson, sameCharWords } from '../lib/content'
import { clozeQuestion, vocabQuestions, type Question } from '../lib/quiz'
import { speak } from '../lib/speech'
import type { GrammarPoint, LessonText, Vocab } from '../lib/types'
import { useStore } from '../store/store'

const XP_PER_LESSON = 40

type Step =
  | { kind: 'text'; text: LessonText }
  | { kind: 'vocab'; words: Vocab[] }
  | { kind: 'grammar'; points: GrammarPoint[] }
  | { kind: 'quiz'; questions: Question[] }
  | { kind: 'write'; char: string }
  | { kind: 'notes' }
  | { kind: 'complete' }

/** How many footer taps a step contains. */
function stepCount(s: Step): number {
  switch (s.kind) {
    case 'vocab':
      return s.words.length
    case 'grammar':
      return s.points.length
    case 'quiz':
      return s.questions.length
    default:
      return 1
  }
}

interface QuizState {
  wrong: string[]
  solved: boolean
}

export function LessonFlow({
  lesson,
  startStep = 0,
  onWords,
  onClose,
}: {
  lesson: number
  startStep?: number
  /** open a scoped review over the words just learned */
  onWords?: (words: string[], title: string) => void
  onClose: () => void
}) {
  const l = useMemo(() => getLesson(lesson), [lesson])
  const store = useStore()
  const { onWord, sheet } = useGloss()

  const steps = useMemo<Step[]>(() => {
    const dialogues = l.texts.filter((t) => t.type === 'dialogue')
    const passages = l.texts.filter((t) => t.type === 'passage')
    const cloze = clozeQuestion(l)
    return [
      ...dialogues.map((text) => ({ kind: 'text' as const, text })),
      { kind: 'vocab', words: l.vocab },
      { kind: 'grammar', points: l.grammar },
      ...passages.map((text) => ({ kind: 'text' as const, text })),
      { kind: 'quiz', questions: [...vocabQuestions(l, 3), ...(cloze ? [cloze] : [])] },
      { kind: 'write', char: focusChar(l) },
      { kind: 'notes' },
      { kind: 'complete' },
    ]
  }, [l])

  const [i, setI] = useState(() => Math.min(startStep, steps.length - 1))
  const [cursor, setCursor] = useState(0)
  const cursorMemory = useRef<Record<number, number>>({})
  const [flipped, setFlipped] = useState(false)
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const committed = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const step = steps[i]
  const count = stepCount(step)
  const total = steps.length - 1
  const atLastSub = cursor >= count - 1
  const isComplete = step.kind === 'complete'

  // Bank vocab as it is seen; commit the whole lesson once, on the finish screen.
  useEffect(() => {
    if (step.kind === 'vocab') store.addCards(l.lesson, [step.words[cursor]])
    if (isComplete && !committed.current) {
      committed.current = true
      store.finishLesson(l.lesson, l.vocab, XP_PER_LESSON)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, cursor])

  // Remember position for resume-from-Home; clear it once complete.
  useEffect(() => {
    if (isComplete) store.clearLessonProgress()
    else store.setLessonProgress(l.lesson, i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // Reset scroll on every sub-step change.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [i, cursor])

  function goStep(next: number) {
    cursorMemory.current[i] = cursor
    setI(next)
    setCursor(cursorMemory.current[next] ?? 0)
    setFlipped(false)
  }

  function advance() {
    if (!atLastSub) {
      setCursor(cursor + 1)
      setFlipped(false)
    } else if (isComplete) {
      onClose()
    } else {
      goStep(i + 1)
    }
  }

  function back() {
    if (cursor > 0) {
      setCursor(cursor - 1)
      setFlipped(false)
    } else if (i === 0) {
      onClose()
    } else {
      goStep(i - 1)
    }
  }

  const quizKey = `${i}:${cursor}`
  const quizState = quiz[quizKey]
  const gated = step.kind === 'quiz'
  const footerLocked = gated && !quizState?.solved

  function answerQuiz(picked: string, answer: string) {
    setQuiz((q) => {
      const prev = q[quizKey] ?? { wrong: [], solved: false }
      if (prev.solved) return q
      if (picked === answer) {
        speak(answer)
        return { ...q, [quizKey]: { ...prev, solved: true } }
      }
      return { ...q, [quizKey]: { ...prev, wrong: [...new Set([...prev.wrong, picked])] } }
    })
  }

  const footerLabel = isComplete
    ? 'Continue'
    : footerLocked
      ? 'Choose an answer'
      : step.kind === 'notes'
        ? 'Finish lesson'
        : 'Next'

  const progress = ((i + (count > 1 ? cursor / count : 0)) / total) * 100

  return (
    <div className="overlay">
      <div className="overlay-head">
        <button
          className="icon-round tap44"
          onClick={back}
          aria-label={i === 0 && cursor === 0 ? 'Close lesson' : 'Back'}
        >
          <ChevronLeft />
        </button>
        <div className="step-bar">
          <i style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>
          {Math.min(i + 1, total)}/{total}
        </span>
        <button className="icon-round tap44" onClick={onClose} aria-label="Close lesson" style={{ marginLeft: 2 }}>
          <CloseIcon />
        </button>
      </div>

      <div className="overlay-body" ref={bodyRef}>
        {step.kind === 'text' && <TextView text={step.text} onWord={onWord} />}
        {step.kind === 'vocab' && (
          <VocabView
            words={step.words}
            cursor={cursor}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            lesson={l.lesson}
          />
        )}
        {step.kind === 'grammar' && (
          <GrammarView points={step.points} cursor={cursor} onWord={onWord} />
        )}
        {step.kind === 'quiz' && (
          <QuizView
            question={step.questions[cursor]}
            index={cursor}
            total={step.questions.length}
            state={quizState}
            onPick={answerQuiz}
            onWord={onWord}
          />
        )}
        {step.kind === 'write' && <WriteView char={step.char} lesson={l.lesson} />}
        {step.kind === 'notes' && <NotesView lesson={l.lesson} onWord={onWord} />}
        {step.kind === 'complete' && (
          <CompleteView
            lesson={l.lesson}
            onReview={
              onWords ? () => onWords(l.vocab.map((v) => v.zh), `Review · ${l.title.zh}`) : undefined
            }
          />
        )}
      </div>

      <div className="overlay-foot">
        <button className="btn" onClick={advance} disabled={footerLocked}>
          {footerLabel}
        </button>
      </div>

      {sheet}
    </div>
  )
}

/* ------------------------------------------------------------------ steps */

function StepHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header style={{ margin: '4px 0 16px' }}>
      <div className="kicker-ink">{kicker}</div>
      <h2 className="h2" style={{ fontSize: 22, marginTop: 5 }}>
        {title}
      </h2>
    </header>
  )
}

function TextView({ text, onWord }: { text: LessonText; onWord: (v: Vocab) => void }) {
  const store = useStore()
  const pinyin = store.prefs.showPinyin
  const english = store.prefs.showEnglish
  return (
    <>
      <StepHead
        kicker={`${text.label} · ${text.type === 'dialogue' ? 'Dialogue' : 'Passage'}`}
        title={text.heading_zh || text.heading_en || 'Read and listen'}
      />
      {text.heading_en && text.heading_zh && (
        <p className="sub" style={{ marginTop: -10, marginBottom: 14 }}>
          {text.heading_en}
        </p>
      )}

      <div className="row" style={{ marginBottom: 16, gap: 8 }}>
        <button
          className="pill-ink"
          onClick={() => store.setPref('showPinyin', !pinyin)}
          style={pinyin ? { color: 'var(--link-hover)', borderColor: '#f3d6c4' } : undefined}
        >
          Pinyin {pinyin ? 'on' : 'off'}
        </button>
        <button
          className="pill-ink"
          onClick={() => store.setPref('showEnglish', !english)}
          style={english ? { color: 'var(--link-hover)', borderColor: '#f3d6c4' } : undefined}
        >
          English {english ? 'on' : 'off'}
        </button>
      </div>

      {text.lines.map((line, i) => (
        <Line
          key={i}
          line={line}
          self={text.type === 'dialogue' && i % 2 === 1}
          showPinyin={pinyin}
          showEnglish={english}
          onWord={onWord}
        />
      ))}

      <p style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 6 }}>
        Tap a line to hear it · tap an underlined word for its meaning.
      </p>
    </>
  )
}

function VocabView({
  words,
  cursor,
  flipped,
  onFlip,
  lesson,
}: {
  words: Vocab[]
  cursor: number
  flipped: boolean
  onFlip: () => void
  lesson: number
}) {
  const word = words[cursor]
  return (
    <>
      <StepHead kicker={`New words · ${cursor + 1} of ${words.length}`} title="生词" />
      <FlipCard
        word={word}
        flipped={flipped}
        onFlip={onFlip}
        footer={
          <div
            className="row"
            style={{ marginTop: 14, gap: 8, justifyContent: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: 12, color: 'var(--on-red-3)', fontWeight: 700 }}>Save to drill</span>
            <SaveStar zh={word.zh} lesson={lesson} size={22} onRed />
          </div>
        }
      />
      <p style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 18, textAlign: 'center' }}>
        Tap the card to flip · Next steps through all {words.length} words.
      </p>
    </>
  )
}

function GrammarView({
  points,
  cursor,
  onWord,
}: {
  points: GrammarPoint[]
  cursor: number
  onWord: (v: Vocab) => void
}) {
  const p = points[cursor]
  return (
    <>
      <StepHead kicker={`Grammar · ${cursor + 1} of ${points.length}`} title="语言点" />

      <section className="metal" style={{ padding: 18 }}>
        <div className="zh on-red" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3 }} lang="zh-CN">
          {p.point}
        </div>
        <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13, marginTop: 4 }}>{p.pinyin}</div>
      </section>

      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3a3a40', marginTop: 16 }}>{p.explanation}</p>

      <h4 className="kicker-ink" style={{ margin: '20px 0 10px' }}>
        Examples
      </h4>
      {p.examples.map((ex, i) => (
        <div className="card" key={i} style={{ marginBottom: 10, padding: 15 }}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div className="zh" style={{ fontSize: 16, lineHeight: 1.75, flex: 1 }} lang="zh-CN">
              <Glossed text={ex.zh} onWord={onWord} />
            </div>
            <button className="icon-round tap44" onClick={() => speak(ex.zh)} aria-label="Play example">
              <SpeakerIcon size={16} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 5 }}>{ex.pinyin}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{ex.en}</div>
        </div>
      ))}
    </>
  )
}

function QuizView({
  question,
  index,
  total,
  state,
  onPick,
  onWord,
}: {
  question: Question
  index: number
  total: number
  state: QuizState | undefined
  onPick: (picked: string, answer: string) => void
  onWord: (v: Vocab) => void
}) {
  const wrong = state?.wrong ?? []
  const solved = state?.solved ?? false
  return (
    <>
      <StepHead kicker={total > 1 ? `Check · ${index + 1} of ${total}` : 'Check'} title={question.prompt} />

      {question.context && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="zh" style={{ fontSize: 19, lineHeight: 1.7 }} lang="zh-CN">
            <Glossed text={question.context.zh} onWord={onWord} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{question.context.en}</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {question.options.map((o) => {
          const isWrong = wrong.includes(o.zh)
          const st = solved && o.zh === question.answer ? 'correct' : isWrong ? 'wrong' : undefined
          const locked = solved || isWrong
          return (
            <button
              key={o.zh}
              className="option zh"
              data-state={st}
              disabled={locked}
              onClick={() => onPick(o.zh, question.answer)}
              lang="zh-CN"
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {!solved && wrong.length > 0 && (
        <div className="explain pop" style={{ marginTop: 14, background: 'var(--warn-bg)', borderColor: 'var(--warn-line)', color: 'var(--warn)' }}>
          Not quite — try another.
        </div>
      )}

      {solved && (
        <div className="explain pop" style={{ marginTop: 14 }}>
          <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
            <span>✅ {question.explanation}</span>
            <button
              className="icon-round tap44"
              style={{ flex: 'none' }}
              onClick={() => speak(question.answer)}
              aria-label="Hear the answer"
            >
              <SpeakerIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function WriteView({ char, lesson }: { char: string; lesson: number }) {
  const [done, setDone] = useState(false)
  return (
    <>
      <StepHead kicker={`Handwriting · Lesson ${lesson}`} title={`Write ${char}`} />
      <Writer char={char} onComplete={() => setDone(true)} />
      {done && (
        <div className="explain pop" style={{ marginTop: 18, background: 'var(--ok-bg)', borderColor: 'var(--ok-line)', color: 'var(--ok)' }}>
          ✅ Stroke order correct.
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 16, textAlign: 'center' }}>
        Animate to watch the stroke order, then Practice to trace it yourself.
      </p>
    </>
  )
}

function NotesView({ lesson, onWord }: { lesson: number; onWord: (v: Vocab) => void }) {
  const l = getLesson(lesson)
  const compare = l.extras.compare[0]
  const sameChar = l.extras.same_char[0]
  const culture = l.extras.culture[0]
  const words = sameCharWords(l)
  const examples = sameChar?.examples ?? []

  return (
    <>
      <StepHead kicker="Notes" title="提示" />

      {compare && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="kicker-ink">Easily confused</div>
          <div className="zh" style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 10px' }} lang="zh-CN">
            {compare.a} — {compare.b}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#3a3a40', margin: 0 }}>{compare.note}</p>
        </section>
      )}

      {sameChar && (
        <section className="metal" style={{ padding: 18, marginBottom: 14 }}>
          <div className="kicker">Same character</div>
          <div
            className="zh on-red"
            style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, margin: '6px 0 12px' }}
            lang="zh-CN"
          >
            {sameChar.char}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {words.map((w) => (
              <button key={w.zh} className="pill zh" style={{ height: 34, fontSize: 14 }} onClick={() => onWord(w)} lang="zh-CN">
                {w.zh}
              </button>
            ))}
          </div>
          {examples.length > 0 && (
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {examples.map((ex, i) => (
                <div key={i} className="glass" style={{ borderRadius: 12, padding: 12 }}>
                  <div className="zh on-red" style={{ fontSize: 15, lineHeight: 1.7 }} lang="zh-CN">
                    {ex}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {culture && (
        <section className="card">
          <div className="kicker-ink">Culture</div>
          <div className="zh" style={{ fontSize: 19, fontWeight: 700, margin: '8px 0 2px' }} lang="zh-CN">
            {culture.title_zh}
          </div>
          <div className="sub" style={{ marginBottom: 10 }}>
            {culture.title_en}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: '#3a3a40', margin: 0 }}>{culture.summary}</p>
        </section>
      )}
    </>
  )
}

function CompleteView({ lesson, onReview }: { lesson: number; onReview?: () => void }) {
  const l = getLesson(lesson)
  return (
    <div style={{ textAlign: 'center', paddingTop: 30 }}>
      <div className="medal pop">
        <CheckIcon size={46} />
      </div>
      <h2 className="h1" style={{ marginTop: 22 }}>
        Lesson complete!
      </h2>
      <p className="sub" style={{ marginTop: 8 }}>
        {l.title.zh} · {l.title.en}
      </p>
      <div className="row" style={{ justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
        <span className="pill-ink">+{XP_PER_LESSON} XP</span>
        <span className="pill-ink">+{l.vocab.length} words</span>
        <span className="pill-ink">🔥 streak</span>
      </div>
      {onReview && (
        <button className="btn" style={{ marginTop: 24 }} onClick={onReview}>
          Review these {l.vocab.length} words now
        </button>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 16, lineHeight: 1.5 }}>
        All {l.vocab.length} new words from this lesson are now in your review deck.
      </p>
    </div>
  )
}
