import { useEffect, useMemo, useRef, useState } from 'react'
import { CloseIcon } from '../components/Icons'
import { StudyMusic } from '../components/StudyMusic'
import { getLang, t } from '../lib/i18n'
import { weakGrammarPoints } from '../lib/learnerGraph'
import {
  availableGrammarTags,
  buildExamPaper,
  partPoints,
  type ChoicePart,
  type ErrorPart,
  type ExamCourse,
  type ExamMode,
  type ExamPart,
  type FillPart,
  type GrammarBreakdown,
  type OrderPart,
  type ReadingPart,
} from '../lib/jiaochengMidterm'
import { playComplete, playCorrect, playWrong } from '../lib/sfx'
import { useStore } from '../store/store'
import '../styles/jiaocheng-midterm.css'

const TIMED_SECONDS = 25 * 60

const KIND_LABELS: Record<ExamPart['kind'], string> = {
  blanks: '选词填空',
  choice: '语法选择',
  order: '语序排列',
  error: '病句修改',
  reading: '阅读理解',
}

function formatClock(seconds: number): string {
  const s = Math.max(0, seconds)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function JiaochengMidterm({
  onClose,
  initialCourse = 'jiaocheng',
  initialMode = 'mock',
  onOpenRecall,
}: {
  onClose: () => void
  initialCourse?: ExamCourse
  initialMode?: ExamMode
  onOpenRecall?: (words?: string[], title?: string) => void
}) {
  const store = useStore()
  const [course, setCourse] = useState<ExamCourse>(initialCourse)
  const [mode, setMode] = useState<ExamMode>(initialMode)
  const [focusTag, setFocusTag] = useState<string>('all')
  const [timed, setTimed] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(TIMED_SECONDS)
  const [retryIds, setRetryIds] = useState<string[] | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)

  const weakTags = useMemo(() => weakGrammarPoints(store.learnerGraph, 8), [store.learnerGraph])
  const grammarTags = useMemo(() => availableGrammarTags(course), [course])

  const allParts = useMemo(
    () => buildExamPaper({ course, mode, focusTag, graph: store.learnerGraph }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [course, mode, focusTag],
  )
  const parts = useMemo(
    () => (retryIds ? allParts.filter((p) => retryIds.includes(p.id)) : allParts),
    [allParts, retryIds],
  )

  const [index, setIndex] = useState(0)
  const [fills, setFills] = useState<Record<string, Record<number, string>>>({})
  const [focus, setFocus] = useState(1)
  const [orders, setOrders] = useState<Record<string, number[]>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [sessionMissedWords, setSessionMissedWords] = useState<string[]>([])
  const bodyRef = useRef<HTMLElement>(null)

  const done = index >= parts.length
  const part = parts[index]

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [index, course, mode, focusTag, retryIds])

  useEffect(() => {
    if (!timed || done) return
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIndex(parts.length)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timed, done, parts.length])

  function resetSessionState(nextRetry: string[] | null = null) {
    setRetryIds(nextRetry)
    setIndex(0)
    setFills({})
    setFocus(1)
    setOrders({})
    setChecked({})
    setPicked({})
    setScores({})
    setSessionMissedWords([])
    setSecondsLeft(TIMED_SECONDS)
  }

  function changeCourse(next: ExamCourse) {
    setCourse(next)
    setFocusTag('all')
    resetSessionState(null)
  }

  function changeMode(next: ExamMode) {
    setMode(next)
    if (next === 'mock') setFocusTag('all')
    resetSessionState(null)
  }

  function recordInGraph(
    item: ExamPart,
    correct: boolean,
    pickedVal?: string,
    answerVal?: string,
    extraMissedWords?: string[],
  ) {
    const focusWords = [
      ...new Set([...(item.breakdown.focusWords ?? []), ...(extraMissedWords ?? [])]),
    ]
    store.recordExamAttemptInGraph({
      questionId: item.id,
      course: item.course,
      lesson: item.lesson,
      grammarPoint: item.breakdown.grammarTag,
      focusWords,
      confusedPairs: item.breakdown.confusionPairs,
      correct,
      picked: pickedVal,
      answer: answerVal,
    })
    if (!correct && focusWords.length > 0) {
      setSessionMissedWords((prev) => [...new Set([...prev, ...focusWords])])
    }
  }

  function checkFill(item: FillPart) {
    if (checked[item.id]) return
    const mine = fills[item.id] ?? {}
    const missedWords = item.blanks
      .filter((blank) => mine[blank.n] !== blank.answer)
      .map((blank) => blank.answer)
    const right = item.blanks.length - missedWords.length
    setScores((prev) => ({ ...prev, [item.id]: right }))
    setChecked((prev) => ({ ...prev, [item.id]: true }))
    const allRight = right === item.blanks.length
    recordInGraph(item, allRight, missedWords[0], item.blanks[0]?.answer, missedWords)
    if (allRight) playCorrect()
    else playWrong()
  }

  function checkOptionQuestion(item: ChoicePart | ErrorPart | ReadingPart) {
    if (checked[item.id] || !picked[item.id]) return
    setChecked((prev) => ({ ...prev, [item.id]: true }))
    const right = picked[item.id] === item.answer
    setScores((prev) => ({ ...prev, [item.id]: right ? 1 : 0 }))
    recordInGraph(item, right, picked[item.id], item.answer)
    if (right) playCorrect()
    else playWrong()
  }

  function checkOrder(item: OrderPart) {
    if (checked[item.id]) return
    const placedIdx = orders[item.id] ?? []
    if (placedIdx.length !== item.chunks.length) return
    const mine = placedIdx.map((idx) => item.chunks[idx]).join('')
    const right = mine === item.answer
    setChecked((prev) => ({ ...prev, [item.id]: true }))
    setScores((prev) => ({ ...prev, [item.id]: right ? 1 : 0 }))
    recordInGraph(item, right, mine, item.answer)
    if (right) playCorrect()
    else playWrong()
  }

  function checkCurrent() {
    if (!part || checked[part.id]) return
    if (part.kind === 'blanks') checkFill(part)
    else if (part.kind === 'order') checkOrder(part)
    else checkOptionQuestion(part)
  }

  function next() {
    if (index + 1 >= parts.length) playComplete()
    setIndex((value) => value + 1)
    setFocus(1)
  }

  const canCheckCurrent = !part
    ? false
    : part.kind === 'blanks'
      ? part.blanks.every((blank) => Boolean((fills[part.id] ?? {})[blank.n]))
      : part.kind === 'order'
        ? (orders[part.id] ?? []).length === part.chunks.length
        : Boolean(picked[part.id])

  const earned = Object.values(scores).reduce((sum, n) => sum + n, 0)
  const total = parts.reduce((sum, item) => sum + partPoints(item), 0)
  const missedParts = parts.filter((p) => checked[p.id] && (scores[p.id] ?? 0) < partPoints(p))

  const byKind = useMemo(() => {
    const map = new Map<ExamPart['kind'], { earned: number; total: number }>()
    for (const p of parts) {
      const cur = map.get(p.kind) ?? { earned: 0, total: 0 }
      cur.total += partPoints(p)
      cur.earned += scores[p.id] ?? 0
      map.set(p.kind, cur)
    }
    return [...map.entries()]
  }, [parts, scores])

  const courseTitle =
    course === 'hsk4a'
      ? t('HSK 4 Mock')
      : course === 'mixed'
        ? t('Mixed Final Mock')
        : t('Jiaocheng Mock')

  const isPartChecked = part ? Boolean(checked[part.id]) : false
  const progressRatio = parts.length > 0 ? Math.min(1, (index + (isPartChecked ? 1 : 0)) / parts.length) : 0

  return (
    <div className="overlay jiaocheng-midterm" role="dialog" aria-modal="true" aria-label={t('Midterm & Final mock')}>
      <header className="overlay-head jiaocheng-midterm-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close')}>
          <CloseIcon />
        </button>
        <div className="jiaocheng-midterm-head-title">
          <strong>{courseTitle}</strong>
          <small>{mode === 'grammar' ? t('Grammar Drill') : t('Full Mock')}</small>
        </div>
        <div className="jiaocheng-midterm-head-right">
          {timed && !done && (
            <span className="jiaocheng-midterm-timer" data-low={secondsLeft <= 120 || undefined}>
              {formatClock(secondsLeft)}
            </span>
          )}
          {!done && parts.length > 0 && (
            <span className="jiaocheng-midterm-count">{`${index + 1} / ${parts.length}`}</span>
          )}
          <button
            type="button"
            className="jiaocheng-midterm-setup-btn"
            aria-expanded={setupOpen}
            aria-controls="exam-setup-panel"
            onClick={() => setSetupOpen((v) => !v)}
          >
            {t('Configure')}
          </button>
        </div>
      </header>

      {!done && parts.length > 0 && (
        <div
          className="jiaocheng-midterm-progress"
          role="progressbar"
          aria-label={t('Session progress')}
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={parts.length}
        >
          <i style={{ width: `${Math.round(progressRatio * 100)}%` }} />
        </div>
      )}

      {setupOpen && (
        <section id="exam-setup-panel" className="jiaocheng-midterm-setup" aria-label={t('Exam setup')}>
          <div className="jiaocheng-midterm-setup-top">
            <span>{t('Exam setup')}</span>
            <div className="jiaocheng-midterm-setup-actions">
              <StudyMusic compact />
              <button type="button" className="jiaocheng-midterm-setup-done" onClick={() => setSetupOpen(false)}>
                {t('Done')}
              </button>
            </div>
          </div>

          <div className="jiaocheng-midterm-setup-group">
            <span className="jiaocheng-midterm-setup-label">{t('Exam course')}</span>
            <div className="jiaocheng-midterm-pills" role="group" aria-label={t('Exam course')}>
              {(['jiaocheng', 'hsk4a', 'mixed'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={course === c}
                  onClick={() => changeCourse(c)}
                >
                  {c === 'jiaocheng' ? 'Jiaocheng (L1–25)' : c === 'hsk4a' ? 'HSK 4' : t('Mixed Final')}
                </button>
              ))}
            </div>
          </div>

          <div className="jiaocheng-midterm-setup-row">
            <div className="jiaocheng-midterm-setup-group">
              <span className="jiaocheng-midterm-setup-label">{t('Exam mode')}</span>
              <div className="jiaocheng-midterm-pills" role="group" aria-label={t('Exam mode')}>
                <button type="button" aria-pressed={mode === 'mock'} onClick={() => changeMode('mock')}>
                  {t('Full Mock')}
                </button>
                <button type="button" aria-pressed={mode === 'grammar'} onClick={() => changeMode('grammar')}>
                  {t('Grammar Drill')}
                </button>
              </div>
            </div>

            <div className="jiaocheng-midterm-setup-group">
              <span className="jiaocheng-midterm-setup-label">{t('Timer')}</span>
              <div className="jiaocheng-midterm-pills" role="group" aria-label={t('Timer')}>
                <button
                  type="button"
                  aria-pressed={!timed}
                  onClick={() => {
                    setTimed(false)
                    setSecondsLeft(TIMED_SECONDS)
                  }}
                >
                  {t('Untimed')}
                </button>
                <button
                  type="button"
                  aria-pressed={timed}
                  onClick={() => {
                    setTimed(true)
                    setSecondsLeft(TIMED_SECONDS)
                  }}
                >
                  {t('Timed · 25m')}
                </button>
              </div>
            </div>
          </div>

          {mode === 'grammar' && (
            <div className="jiaocheng-midterm-topics">
              <label>
                <span>{t('Grammar focus')}</span>
                <select
                  aria-label={t('Grammar focus')}
                  value={focusTag}
                  onChange={(e) => {
                    setFocusTag(e.target.value)
                    resetSessionState(null)
                  }}
                >
                  <option value="all">{t('All grammar topics')}</option>
                  {weakTags.length > 0 && (
                    <option value="weak">{t('Weak grammar from your graph ({n})', { n: weakTags.length })}</option>
                  )}
                  {grammarTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>
      )}

      {done ? (
        <main ref={bodyRef} className="jiaocheng-midterm-body jiaocheng-midterm-result">
          <div className="jiaocheng-midterm-result-hero">
            <p className="jiaocheng-midterm-section">{t('Exam summary')}</p>
            <h1>{Math.round((earned / Math.max(1, total)) * 100)}%</h1>
            <p className="jiaocheng-midterm-result-sub">{t('{right} of {total} right', { right: earned, total })}</p>
          </div>
          <ul className="jiaocheng-midterm-result-list">
            {byKind.map(([kind, stats]) => (
              <li key={kind}>
                <span className="zh" lang="zh-CN">{KIND_LABELS[kind]}</span>
                <strong>{stats.earned} / {stats.total}</strong>
              </li>
            ))}
          </ul>
          {missedParts.length > 0 && (
            <div className="jiaocheng-midterm-missed-summary">
              <p className="jiaocheng-midterm-why">
                {t('Grammar points logged to your learning graph for extra recall:')}
              </p>
              <div className="jiaocheng-midterm-missed-tags">
                {[...new Set(missedParts.map((m) => m.breakdown.grammarTag))].map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => resetSessionState(missedParts.map((m) => m.id))}
              >
                {t('Retry {n} missed sections', { n: missedParts.length })}
              </button>
            </div>
          )}
          {onOpenRecall && sessionMissedWords.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 10 }}
              onClick={() => {
                onClose()
                onOpenRecall(sessionMissedWords.slice(0, 10), t('Exam weak words · Active recall'))
              }}
            >
              {t('Practice {n} weak words in Active Recall', { n: Math.min(10, sessionMissedWords.length) })}
            </button>
          )}
          <button type="button" className="jiaocheng-midterm-back" onClick={onClose}>
            {t('Back to learning')}
          </button>
        </main>
      ) : (
        <>
          <main ref={bodyRef} className="jiaocheng-midterm-body">
            <ExamPartCard
              part={part}
              fills={fills[part.id] ?? {}}
              focus={focus}
              orders={orders[part.id] ?? []}
              picked={picked[part.id]}
              checked={isPartChecked}
              score={scores[part.id] ?? 0}
              isWeakInGraph={weakTags.some((w) => w.point === part.breakdown.grammarTag)}
              onFocus={setFocus}
              onPickFill={(word) => {
                if (isPartChecked) return
                const n = focus
                const nextMap = { ...fills[part.id], [n]: word }
                setFills((prev) => ({ ...prev, [part.id]: nextMap }))
                const nextBlank =
                  part.kind === 'blanks'
                    ? (part.blanks.find((blank) => blank.n > n && !nextMap[blank.n]) ??
                        part.blanks.find((blank) => !nextMap[blank.n]))
                    : undefined
                if (nextBlank) setFocus(nextBlank.n)
              }}
              onAddOrder={(chunkIndex) => {
                if (isPartChecked) return
                setOrders((prev) => {
                  const list = prev[part.id] ?? []
                  if (list.includes(chunkIndex)) return prev
                  return { ...prev, [part.id]: [...list, chunkIndex] }
                })
              }}
              onRemoveOrder={(chunkIndex) => {
                if (isPartChecked) return
                setOrders((prev) => ({
                  ...prev,
                  [part.id]: (prev[part.id] ?? []).filter((i) => i !== chunkIndex),
                }))
              }}
              onResetOrder={() => {
                if (isPartChecked) return
                setOrders((prev) => ({ ...prev, [part.id]: [] }))
              }}
              onPickOption={(opt) => {
                if (isPartChecked) return
                setPicked((prev) => ({ ...prev, [part.id]: opt }))
              }}
            />
          </main>

          <footer className="jiaocheng-midterm-foot">
            {isPartChecked ? (
              <button type="button" className="btn" onClick={next}>
                {index + 1 >= parts.length ? t('See results') : t('Next question')}
              </button>
            ) : (
              <button type="button" className="btn" disabled={!canCheckCurrent} onClick={checkCurrent}>
                {t('Check answer')}
              </button>
            )}
          </footer>
        </>
      )}
    </div>
  )
}

function QuestionHeader({
  part,
  points,
  isWeakInGraph,
}: {
  part: ExamPart
  points: number
  isWeakInGraph: boolean
}) {
  const courseName = part.course === 'hsk4a' ? 'HSK 4' : '汉语教程'
  return (
    <div className="jiaocheng-midterm-qhead">
      <div className="jiaocheng-midterm-meta">
        <span className="jiaocheng-midterm-kind zh" lang="zh-CN">{KIND_LABELS[part.kind]}</span>
        <span className="jiaocheng-midterm-points">{points} {t('points')}</span>
        {isWeakInGraph && <em className="jiaocheng-midterm-weak-pill">{t('Graph focus')}</em>}
      </div>
      <h1>{part.title}</h1>
      <p className="jiaocheng-midterm-zh">
        {courseName} · {part.sectionZh} · {t('Lesson {n}', { n: part.lesson })}
      </p>
    </div>
  )
}

function OptionList({
  options,
  answer,
  picked,
  checked,
  onPick,
}: {
  options: string[]
  answer: string
  picked?: string
  checked: boolean
  onPick: (opt: string) => void
}) {
  return (
    <div className="jiaocheng-midterm-options" role="group">
      {options.map((option, optionIndex) => {
        const letter = String.fromCharCode(65 + optionIndex)
        const selected = picked === option
        const correct = checked && option === answer
        const wrong = checked && selected && option !== answer
        return (
          <button
            key={option}
            type="button"
            disabled={checked}
            data-state={correct ? 'correct' : wrong ? 'wrong' : selected ? 'selected' : undefined}
            onClick={() => onPick(option)}
          >
            <span>{letter}</span>
            <strong className="zh" lang="zh-CN">{option}</strong>
          </button>
        )
      })}
    </div>
  )
}

function AnswerReveal({
  right,
  scoreText,
  answerLabel,
  answerText,
  breakdown,
}: {
  right: boolean
  scoreText: string
  answerLabel?: string
  answerText?: string
  breakdown: GrammarBreakdown
}) {
  return (
    <section className="jiaocheng-midterm-reveal" data-verdict={right ? 'correct' : 'wrong'} aria-live="polite">
      <div className="jiaocheng-midterm-verdict">
        <span className="jiaocheng-midterm-verdict-badge" data-verdict={right ? 'correct' : 'wrong'}>
          {right ? t('Correct') : t('Not quite')} · {scoreText}
        </span>
        {answerText && (
          <p className="jiaocheng-midterm-answer-line">
            <span>{answerLabel ?? t('Correct answer')}:</span>{' '}
            <b className="zh" lang="zh-CN">{answerText}</b>
          </p>
        )}
      </div>
      <GrammarBreakdownPanel breakdown={breakdown} />
    </section>
  )
}

function GrammarBreakdownPanel({ breakdown }: { breakdown: GrammarBreakdown }) {
  const lang = getLang() === 'id' ? 'id' : 'en'
  return (
    <div className="jiaocheng-midterm-breakdown" aria-label={t('Grammar breakdown')}>
      <div className="jiaocheng-midterm-breakdown-pattern">
        <span>{t('Pattern')} · {breakdown.grammarTag}</span>
        <strong className="zh" lang="zh-CN">{breakdown.pattern}</strong>
      </div>
      <div className="jiaocheng-midterm-breakdown-why">
        <span>{t('Why this works')}</span>
        <p>{breakdown.whyRight[lang]}</p>
      </div>
      {breakdown.distractorNotes.length > 0 && (
        <div className="jiaocheng-midterm-breakdown-distractors">
          <span>{t('Why distractors fail')}</span>
          <ul>
            {breakdown.distractorNotes.map((note) => (
              <li key={note.option}>
                <strong className="zh" lang="zh-CN">{note.option}:</strong> {note.whyWrong[lang]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FillCard({
  part,
  values,
  focus,
  checked,
  score,
  isWeakInGraph,
  onFocus,
  onPick,
}: {
  part: FillPart
  values: Record<number, string>
  focus: number
  checked: boolean
  score: number
  isWeakInGraph: boolean
  onFocus: (n: number) => void
  onPick: (word: string) => void
}) {
  const usedWords = new Set(Object.values(values).filter(Boolean))
  return (
    <article className="jiaocheng-midterm-card">
      <QuestionHeader part={part} points={part.blanks.length} isWeakInGraph={isWeakInGraph} />
      {part.zh && <p className="jiaocheng-midterm-instruction zh" lang="zh-CN">{part.zh}</p>}
      <div className="jiaocheng-midterm-bank" role="group" aria-label={t('Word bank')}>
        {part.bank.map((word) => (
          <button
            key={word}
            type="button"
            className="zh"
            lang="zh-CN"
            disabled={checked}
            data-used={usedWords.has(word) || undefined}
            onClick={() => onPick(word)}
          >
            {word}
          </button>
        ))}
      </div>
      <div className="jiaocheng-midterm-lines">
        {part.lines.map((line) => (
          <p key={line} className="zh" lang="zh-CN">
            {line.split(/(\{\{\d+\}\})/).map((piece, pieceIndex) => {
              const n = Number(/^\{\{(\d+)\}\}$/.exec(piece)?.[1])
              if (!n) return <span key={pieceIndex}>{piece}</span>
              const blank = part.blanks.find((item) => item.n === n)
              const value = values[n]
              const right = checked && value === blank?.answer
              const wrong = checked && value !== blank?.answer
              return (
                <button
                  key={piece}
                  type="button"
                  className="jiaocheng-midterm-slot"
                  data-focus={!checked && focus === n}
                  data-filled={Boolean(value) || undefined}
                  data-state={right ? 'correct' : wrong ? 'wrong' : undefined}
                  onClick={() => onFocus(n)}
                >
                  <i>{n}</i>
                  <span>{value || '＿＿'}</span>
                  {wrong && <b>{blank?.answer}</b>}
                </button>
              )
            })}
          </p>
        ))}
      </div>
      {checked && (
        <AnswerReveal
          right={score === part.blanks.length}
          scoreText={`${score}/${part.blanks.length}`}
          breakdown={part.breakdown}
        />
      )}
    </article>
  )
}

function ChoiceCard({
  part,
  picked,
  checked,
  isWeakInGraph,
  onPick,
}: {
  part: ChoicePart
  picked?: string
  checked: boolean
  isWeakInGraph: boolean
  onPick: (id: string) => void
}) {
  const right = picked === part.answer
  return (
    <article className="jiaocheng-midterm-card">
      <QuestionHeader part={part} points={1} isWeakInGraph={isWeakInGraph} />
      <div className="jiaocheng-midterm-stimulus">
        <p className="jiaocheng-midterm-material zh" lang="zh-CN">{part.material}</p>
      </div>
      <OptionList
        options={part.options}
        answer={part.answer}
        picked={picked}
        checked={checked}
        onPick={onPick}
      />
      {checked && (
        <AnswerReveal
          right={right}
          scoreText={scoresLabel(right)}
          answerLabel={t('Correct answer')}
          answerText={part.answer}
          breakdown={part.breakdown}
        />
      )}
    </article>
  )
}

function OrderCard({
  part,
  placed,
  checked,
  isWeakInGraph,
  onAdd,
  onRemove,
  onReset,
}: {
  part: OrderPart
  placed: number[]
  checked: boolean
  isWeakInGraph: boolean
  onAdd: (chunkIndex: number) => void
  onRemove: (chunkIndex: number) => void
  onReset: () => void
}) {
  const lang = getLang() === 'id' ? 'id' : 'en'
  const built = placed.map((i) => part.chunks[i]).join('')
  const right = checked && built === part.answer
  return (
    <article className="jiaocheng-midterm-card">
      <QuestionHeader part={part} points={1} isWeakInGraph={isWeakInGraph} />
      {part.hint && <p className="jiaocheng-midterm-why">{part.hint[lang]}</p>}

      <div
        className="jiaocheng-midterm-order-line"
        data-state={checked ? (right ? 'correct' : 'wrong') : undefined}
        aria-live="polite"
      >
        {placed.length === 0 ? (
          <span className="jiaocheng-midterm-order-placeholder">{t('Tap chunks below in grammatical order')}</span>
        ) : (
          placed.map((chunkIndex) => (
            <button
              key={chunkIndex}
              type="button"
              className="jiaocheng-midterm-chunk zh"
              lang="zh-CN"
              disabled={checked}
              onClick={() => onRemove(chunkIndex)}
            >
              {part.chunks[chunkIndex]}
            </button>
          ))
        )}
      </div>

      <div className="jiaocheng-midterm-bank" role="group" aria-label={t('Sentence chunks')}>
        {part.chunks.map((chunk, idx) => (
          <button
            key={`${chunk}-${idx}`}
            type="button"
            className="zh"
            lang="zh-CN"
            disabled={checked || placed.includes(idx)}
            onClick={() => onAdd(idx)}
          >
            {chunk}
          </button>
        ))}
      </div>

      {!checked && placed.length > 0 && (
        <button type="button" className="jiaocheng-midterm-reset" onClick={onReset}>
          {t('Reset order')}
        </button>
      )}

      {checked && (
        <AnswerReveal
          right={right}
          scoreText={scoresLabel(right)}
          answerLabel={t('Correct sentence')}
          answerText={part.answer}
          breakdown={part.breakdown}
        />
      )}
    </article>
  )
}

function ErrorCard({
  part,
  picked,
  checked,
  isWeakInGraph,
  onPick,
}: {
  part: ErrorPart
  picked?: string
  checked: boolean
  isWeakInGraph: boolean
  onPick: (opt: string) => void
}) {
  const right = picked === part.answer
  return (
    <article className="jiaocheng-midterm-card">
      <QuestionHeader part={part} points={1} isWeakInGraph={isWeakInGraph} />
      <div className="jiaocheng-midterm-stimulus">
        <p className="zh" lang="zh-CN">{part.faultySentence}</p>
        <p className="jiaocheng-midterm-focus-tag">{t('Focus')}: {part.errorFocus}</p>
      </div>
      <OptionList
        options={part.options}
        answer={part.answer}
        picked={picked}
        checked={checked}
        onPick={onPick}
      />
      {checked && (
        <AnswerReveal
          right={right}
          scoreText={scoresLabel(right)}
          answerLabel={t('Correct sentence')}
          answerText={part.answer}
          breakdown={part.breakdown}
        />
      )}
    </article>
  )
}

function ReadingCard({
  part,
  picked,
  checked,
  isWeakInGraph,
  onPick,
}: {
  part: ReadingPart
  picked?: string
  checked: boolean
  isWeakInGraph: boolean
  onPick: (opt: string) => void
}) {
  const right = picked === part.answer
  return (
    <article className="jiaocheng-midterm-card">
      <QuestionHeader part={part} points={1} isWeakInGraph={isWeakInGraph} />
      <div className="jiaocheng-midterm-passage zh" lang="zh-CN">
        {part.passage.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <div className="jiaocheng-midterm-stimulus jiaocheng-midterm-reading-q">
        <p className="jiaocheng-midterm-material zh" lang="zh-CN">{part.question}</p>
      </div>
      <OptionList
        options={part.options}
        answer={part.answer}
        picked={picked}
        checked={checked}
        onPick={onPick}
      />
      {checked && (
        <AnswerReveal
          right={right}
          scoreText={scoresLabel(right)}
          answerLabel={t('Correct answer')}
          answerText={part.answer}
          breakdown={part.breakdown}
        />
      )}
    </article>
  )
}

function scoresLabel(right: boolean) {
  return right ? '1/1' : '0/1'
}

export function ExamPartCard({
  part,
  fills = {},
  focus = 1,
  orders = [],
  picked,
  checked = false,
  score = 0,
  isWeakInGraph = false,
  onFocus = () => {},
  onPickFill = () => {},
  onAddOrder = () => {},
  onRemoveOrder = () => {},
  onResetOrder = () => {},
  onPickOption = () => {},
}: {
  part: ExamPart
  fills?: Record<number, string>
  focus?: number
  orders?: number[]
  picked?: string
  checked?: boolean
  score?: number
  isWeakInGraph?: boolean
  onFocus?: (n: number) => void
  onPickFill?: (word: string) => void
  onAddOrder?: (chunkIndex: number) => void
  onRemoveOrder?: (chunkIndex: number) => void
  onResetOrder?: () => void
  onPickOption?: (opt: string) => void
}) {
  if (part.kind === 'blanks') {
    return (
      <FillCard
        part={part}
        values={fills}
        focus={focus}
        checked={checked}
        score={score}
        isWeakInGraph={isWeakInGraph}
        onFocus={onFocus}
        onPick={onPickFill}
      />
    )
  }
  if (part.kind === 'order') {
    return (
      <OrderCard
        part={part}
        placed={orders}
        checked={checked}
        isWeakInGraph={isWeakInGraph}
        onAdd={onAddOrder}
        onRemove={onRemoveOrder}
        onReset={onResetOrder}
      />
    )
  }
  if (part.kind === 'error') {
    return (
      <ErrorCard
        part={part}
        picked={picked}
        checked={checked}
        isWeakInGraph={isWeakInGraph}
        onPick={onPickOption}
      />
    )
  }
  if (part.kind === 'reading') {
    return (
      <ReadingCard
        part={part}
        picked={picked}
        checked={checked}
        isWeakInGraph={isWeakInGraph}
        onPick={onPickOption}
      />
    )
  }
  return (
    <ChoiceCard
      part={part}
      picked={picked}
      checked={checked}
      isWeakInGraph={isWeakInGraph}
      onPick={onPickOption}
    />
  )
}
