import { useEffect, useMemo, useState } from 'react'
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

  const done = index >= parts.length
  const part = parts[index]

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

  function next() {
    if (index + 1 >= parts.length) playComplete()
    setIndex((value) => value + 1)
    setFocus(1)
  }

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
      ? t('HSK 4 Mock & Final')
      : course === 'mixed'
        ? t('Mixed Final Exam')
        : t('Jiaocheng Midterm & Final')

  return (
    <div className="overlay jiaocheng-midterm" role="dialog" aria-modal="true" aria-label={t('Midterm & Final mock')}>
      <header className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close')}>
          <CloseIcon />
        </button>
        <StudyMusic compact />
        <span>{courseTitle}</span>
        <div className="jiaocheng-midterm-head-right">
          {timed && !done && (
            <span className="jiaocheng-midterm-timer" data-low={secondsLeft <= 120 || undefined}>
              {formatClock(secondsLeft)}
            </span>
          )}
          <span className="jiaocheng-midterm-count">{done ? '' : `${index + 1} / ${parts.length}`}</span>
        </div>
      </header>

      <div className="jiaocheng-midterm-controls">
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
        <div className="jiaocheng-midterm-pills" role="group" aria-label={t('Exam mode')}>
          <button type="button" aria-pressed={mode === 'mock'} onClick={() => changeMode('mock')}>
            {t('Full Mock')}
          </button>
          <button type="button" aria-pressed={mode === 'grammar'} onClick={() => changeMode('grammar')}>
            {t('Grammar Drill')}
          </button>
          <button
            type="button"
            aria-pressed={timed}
            onClick={() => {
              setTimed((v) => !v)
              setSecondsLeft(TIMED_SECONDS)
            }}
          >
            {timed ? t('Timed · 25m') : t('Untimed')}
          </button>
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
      </div>

      <ol className="jiaocheng-midterm-dots" aria-label={t('Session progress')}>
        {parts.map((item, dot) => (
          <li key={item.id} data-state={dot < index || checked[item.id] ? 'done' : dot === index ? 'now' : 'next'}>
            {dot + 1}
          </li>
        ))}
      </ol>

      {done ? (
        <main className="jiaocheng-midterm-body jiaocheng-midterm-result">
          <p className="jiaocheng-midterm-section">{t('Exam summary')}</p>
          <h1>{Math.round((earned / Math.max(1, total)) * 100)}%</h1>
          <p>{t('{right} of {total} right', { right: earned, total })}</p>
          <ul>
            {byKind.map(([kind, stats]) => (
              <li key={kind}>
                <span>{KIND_LABELS[kind]}</span>
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
      ) : part.kind === 'blanks' ? (
        <FillCard
          part={part}
          values={fills[part.id] ?? {}}
          focus={focus}
          checked={!!checked[part.id]}
          score={scores[part.id] ?? 0}
          isWeakInGraph={weakTags.some((w) => w.point === part.breakdown.grammarTag)}
          onFocus={setFocus}
          onPick={(word) => {
            if (checked[part.id]) return
            const n = focus
            setFills((prev) => ({ ...prev, [part.id]: { ...prev[part.id], [n]: word } }))
            const nextBlank = part.blanks.find((blank) => blank.n > n && !(fills[part.id] ?? {})[blank.n])
            if (nextBlank) setFocus(nextBlank.n)
          }}
          onCheck={() => checkFill(part)}
          onNext={next}
        />
      ) : part.kind === 'order' ? (
        <OrderCard
          part={part}
          placed={orders[part.id] ?? []}
          checked={!!checked[part.id]}
          isWeakInGraph={weakTags.some((w) => w.point === part.breakdown.grammarTag)}
          onAdd={(chunkIndex) => {
            if (checked[part.id]) return
            setOrders((prev) => {
              const list = prev[part.id] ?? []
              if (list.includes(chunkIndex)) return prev
              return { ...prev, [part.id]: [...list, chunkIndex] }
            })
          }}
          onRemove={(chunkIndex) => {
            if (checked[part.id]) return
            setOrders((prev) => ({
              ...prev,
              [part.id]: (prev[part.id] ?? []).filter((i) => i !== chunkIndex),
            }))
          }}
          onReset={() => {
            if (checked[part.id]) return
            setOrders((prev) => ({ ...prev, [part.id]: [] }))
          }}
          onCheck={() => checkOrder(part)}
          onNext={next}
        />
      ) : part.kind === 'error' ? (
        <ErrorCard
          part={part}
          picked={picked[part.id]}
          checked={!!checked[part.id]}
          isWeakInGraph={weakTags.some((w) => w.point === part.breakdown.grammarTag)}
          onPick={(opt) => {
            if (checked[part.id]) return
            setPicked((prev) => ({ ...prev, [part.id]: opt }))
          }}
          onCheck={() => checkOptionQuestion(part)}
          onNext={next}
        />
      ) : part.kind === 'reading' ? (
        <ReadingCard
          part={part}
          picked={picked[part.id]}
          checked={!!checked[part.id]}
          isWeakInGraph={weakTags.some((w) => w.point === part.breakdown.grammarTag)}
          onPick={(opt) => {
            if (checked[part.id]) return
            setPicked((prev) => ({ ...prev, [part.id]: opt }))
          }}
          onCheck={() => checkOptionQuestion(part)}
          onNext={next}
        />
      ) : (
        <ChoiceCard
          part={part}
          picked={picked[part.id]}
          checked={!!checked[part.id]}
          isWeakInGraph={weakTags.some((w) => w.point === part.breakdown.grammarTag)}
          onPick={(id) => {
            if (checked[part.id]) return
            setPicked((prev) => ({ ...prev, [part.id]: id }))
          }}
          onCheck={() => checkOptionQuestion(part)}
          onNext={next}
        />
      )}
    </div>
  )
}

function PartMeta({ part, isWeakInGraph }: { part: ExamPart; isWeakInGraph: boolean }) {
  const courseName = part.course === 'hsk4a' ? 'HSK 4' : '汉语教程'
  return (
    <p className="jiaocheng-midterm-zh">
      <span>{courseName} · {part.sectionZh} · {t('Lesson {n}', { n: part.lesson })}</span>
      {isWeakInGraph && <em className="jiaocheng-midterm-weak-pill">{t('Graph focus')}</em>}
    </p>
  )
}

function GrammarBreakdownPanel({ breakdown }: { breakdown: GrammarBreakdown }) {
  const lang = getLang() === 'id' ? 'id' : 'en'
  return (
    <section className="jiaocheng-midterm-breakdown" aria-label={t('Grammar breakdown')}>
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
    </section>
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
  onCheck,
  onNext,
}: {
  part: FillPart
  values: Record<number, string>
  focus: number
  checked: boolean
  score: number
  isWeakInGraph: boolean
  onFocus: (n: number) => void
  onPick: (word: string) => void
  onCheck: () => void
  onNext: () => void
}) {
  const ready = part.blanks.every((blank) => values[blank.n])
  return (
    <main className="jiaocheng-midterm-body">
      <h1>{part.title}<em>{part.blanks.length} {t('points')}</em></h1>
      <PartMeta part={part} isWeakInGraph={isWeakInGraph} />
      <p className="jiaocheng-midterm-zh">{part.zh}</p>
      <div className="jiaocheng-midterm-bank" role="group" aria-label={t('Word bank')}>
        {part.bank.map((word) => (
          <button key={word} type="button" disabled={checked} onClick={() => onPick(word)}>{word}</button>
        ))}
      </div>
      <div className="jiaocheng-midterm-lines">
        {part.lines.map((line) => (
          <p key={line}>
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
                  data-state={right ? 'correct' : wrong ? 'wrong' : undefined}
                  onClick={() => onFocus(n)}
                >
                  <i>{n}</i>
                  {value || '____'}
                  {wrong && <b>{blank?.answer}</b>}
                </button>
              )
            })}
          </p>
        ))}
      </div>
      {checked ? (
        <footer>
          <p>{score === part.blanks.length ? t('Correct') : t('Review')} · {score}/{part.blanks.length}</p>
          <GrammarBreakdownPanel breakdown={part.breakdown} />
          <button type="button" className="btn" onClick={onNext}>{t('Next question')}</button>
        </footer>
      ) : (
        <button type="button" className="btn" disabled={!ready} onClick={onCheck}>{t('Check')}</button>
      )}
    </main>
  )
}

function ChoiceCard({
  part,
  picked,
  checked,
  isWeakInGraph,
  onPick,
  onCheck,
  onNext,
}: {
  part: ChoicePart
  picked?: string
  checked: boolean
  isWeakInGraph: boolean
  onPick: (id: string) => void
  onCheck: () => void
  onNext: () => void
}) {
  return (
    <main className="jiaocheng-midterm-body">
      <h1>{part.title}<em>1 {t('points')}</em></h1>
      <PartMeta part={part} isWeakInGraph={isWeakInGraph} />
      <p className="jiaocheng-midterm-material zh" lang="zh-CN">{part.material}</p>
      <div className="jiaocheng-midterm-options" role="group">
        {part.options.map((option, optionIndex) => {
          const letter = String.fromCharCode(65 + optionIndex)
          const selected = picked === option
          const correct = checked && option === part.answer
          const wrong = checked && selected && option !== part.answer
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
      {checked && (
        <div className="jiaocheng-midterm-reveal">
          <p>{picked === part.answer ? t('Correct') : t('Not quite')} · {scoresLabel(picked === part.answer)}</p>
          <p>{t('Correct answer')}: <b className="zh" lang="zh-CN">{part.answer}</b></p>
          <GrammarBreakdownPanel breakdown={part.breakdown} />
        </div>
      )}
      {checked ? (
        <button type="button" className="btn" onClick={onNext}>{t('Next question')}</button>
      ) : (
        <button type="button" className="btn" disabled={!picked} onClick={onCheck}>{t('Check')}</button>
      )}
    </main>
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
  onCheck,
  onNext,
}: {
  part: OrderPart
  placed: number[]
  checked: boolean
  isWeakInGraph: boolean
  onAdd: (chunkIndex: number) => void
  onRemove: (chunkIndex: number) => void
  onReset: () => void
  onCheck: () => void
  onNext: () => void
}) {
  const lang = getLang() === 'id' ? 'id' : 'en'
  const built = placed.map((i) => part.chunks[i]).join('')
  const right = checked && built === part.answer
  return (
    <main className="jiaocheng-midterm-body">
      <h1>{part.title}<em>1 {t('points')}</em></h1>
      <PartMeta part={part} isWeakInGraph={isWeakInGraph} />
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
        <button type="button" className="jiaocheng-midterm-back" style={{ marginBottom: 10 }} onClick={onReset}>
          {t('Reset order')}
        </button>
      )}

      {checked && (
        <div className="jiaocheng-midterm-reveal">
          <p>{right ? t('Correct') : t('Not quite')} · {scoresLabel(right)}</p>
          <p>{t('Correct sentence')}: <b className="zh" lang="zh-CN">{part.answer}</b></p>
          <GrammarBreakdownPanel breakdown={part.breakdown} />
        </div>
      )}

      {checked ? (
        <button type="button" className="btn" onClick={onNext}>{t('Next question')}</button>
      ) : (
        <button type="button" className="btn" disabled={placed.length !== part.chunks.length} onClick={onCheck}>
          {t('Check')}
        </button>
      )}
    </main>
  )
}

function ErrorCard({
  part,
  picked,
  checked,
  isWeakInGraph,
  onPick,
  onCheck,
  onNext,
}: {
  part: ErrorPart
  picked?: string
  checked: boolean
  isWeakInGraph: boolean
  onPick: (opt: string) => void
  onCheck: () => void
  onNext: () => void
}) {
  return (
    <main className="jiaocheng-midterm-body">
      <h1>{part.title}<em>1 {t('points')}</em></h1>
      <PartMeta part={part} isWeakInGraph={isWeakInGraph} />
      <div className="jiaocheng-midterm-stimulus">
        <p className="zh" lang="zh-CN">{part.faultySentence}</p>
        <p>{t('Focus')}: {part.errorFocus}</p>
      </div>
      <div className="jiaocheng-midterm-options" role="group">
        {part.options.map((option, optionIndex) => {
          const letter = String.fromCharCode(65 + optionIndex)
          const selected = picked === option
          const correct = checked && option === part.answer
          const wrong = checked && selected && option !== part.answer
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
      {checked && (
        <div className="jiaocheng-midterm-reveal">
          <p>{picked === part.answer ? t('Correct') : t('Not quite')} · {scoresLabel(picked === part.answer)}</p>
          <p>{t('Correct sentence')}: <b className="zh" lang="zh-CN">{part.answer}</b></p>
          <GrammarBreakdownPanel breakdown={part.breakdown} />
        </div>
      )}
      {checked ? (
        <button type="button" className="btn" onClick={onNext}>{t('Next question')}</button>
      ) : (
        <button type="button" className="btn" disabled={!picked} onClick={onCheck}>{t('Check')}</button>
      )}
    </main>
  )
}

function ReadingCard({
  part,
  picked,
  checked,
  isWeakInGraph,
  onPick,
  onCheck,
  onNext,
}: {
  part: ReadingPart
  picked?: string
  checked: boolean
  isWeakInGraph: boolean
  onPick: (opt: string) => void
  onCheck: () => void
  onNext: () => void
}) {
  return (
    <main className="jiaocheng-midterm-body">
      <h1>{part.title}<em>1 {t('points')}</em></h1>
      <PartMeta part={part} isWeakInGraph={isWeakInGraph} />
      <div className="jiaocheng-midterm-passage zh" lang="zh-CN">
        {part.passage.split('\n').map((line, i) => (
          <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>{line}</p>
        ))}
      </div>
      <p className="jiaocheng-midterm-material zh" lang="zh-CN">{part.question}</p>
      <div className="jiaocheng-midterm-options" role="group">
        {part.options.map((option, optionIndex) => {
          const letter = String.fromCharCode(65 + optionIndex)
          const selected = picked === option
          const correct = checked && option === part.answer
          const wrong = checked && selected && option !== part.answer
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
      {checked && (
        <div className="jiaocheng-midterm-reveal">
          <p>{picked === part.answer ? t('Correct') : t('Not quite')} · {scoresLabel(picked === part.answer)}</p>
          <p>{t('Correct answer')}: <b className="zh" lang="zh-CN">{part.answer}</b></p>
          <GrammarBreakdownPanel breakdown={part.breakdown} />
        </div>
      )}
      {checked ? (
        <button type="button" className="btn" onClick={onNext}>{t('Next question')}</button>
      ) : (
        <button type="button" className="btn" disabled={!picked} onClick={onCheck}>{t('Check')}</button>
      )}
    </main>
  )
}

function scoresLabel(right: boolean) {
  return right ? '1/1' : '0/1'
}
