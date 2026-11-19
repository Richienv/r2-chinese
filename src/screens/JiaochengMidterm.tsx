import { useMemo, useState } from 'react'
import { CloseIcon } from '../components/Icons'
import { StudyMusic } from '../components/StudyMusic'
import { t } from '../lib/i18n'
import { buildJiaochengMidterm, partPoints, type ExamPart, type FillPart } from '../lib/jiaochengMidterm'
import { playComplete, playCorrect, playWrong } from '../lib/sfx'
import '../styles/jiaocheng-midterm.css'

export function JiaochengMidterm({ onClose }: { onClose: () => void }) {
  const parts = useMemo(() => buildJiaochengMidterm(), [])
  const [index, setIndex] = useState(0)
  const [fills, setFills] = useState<Record<string, Record<number, string>>>({})
  const [focus, setFocus] = useState(1)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const part = parts[index]
  const done = index >= parts.length

  function checkFill(item: FillPart) {
    const mine = fills[item.id] ?? {}
    const right = item.blanks.filter((blank) => mine[blank.n] === blank.answer).length
    setScores((prev) => ({ ...prev, [item.id]: right }))
    setChecked((prev) => ({ ...prev, [item.id]: true }))
    if (right === item.blanks.length) playCorrect()
    else playWrong()
  }

  function checkChoice(id: string, answer: string) {
    if (checked[id] || !picked[id]) return
    setChecked((prev) => ({ ...prev, [id]: true }))
    const right = picked[id] === answer
    setScores((prev) => ({ ...prev, [id]: right ? 1 : 0 }))
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

  return (
    <div className="overlay jiaocheng-midterm" role="dialog" aria-modal="true" aria-label={t('Midterm mock')}>
      <header className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close')}>
          <CloseIcon />
        </button>
        <StudyMusic compact />
        <span>{t('Midterm mock')}</span>
        <span className="jiaocheng-midterm-count">{done ? '' : `${index + 1} / ${parts.length}`}</span>
      </header>
      <ol className="jiaocheng-midterm-dots" aria-label={t('Session progress')}>
        {parts.map((item, dot) => (
          <li key={item.id} data-state={dot < index || checked[item.id] ? 'done' : dot === index ? 'now' : 'next'}>
            {dot + 1}
          </li>
        ))}
      </ol>
      {done ? (
        <main className="jiaocheng-midterm-body jiaocheng-midterm-result">
          <p className="jiaocheng-midterm-section">{t('Midterm result')}</p>
          <h1>{Math.round((earned / Math.max(1, total)) * 100)}%</h1>
          <p>{t('{right} of {total} right', { right: earned, total })}</p>
          <p className="jiaocheng-midterm-why">{t('Lessons 1 to 12')}</p>
          <button type="button" className="jiaocheng-midterm-back" onClick={onClose}>{t('Back to learning')}</button>
        </main>
      ) : part.kind === 'blanks' ? (
        <FillCard
          part={part}
          values={fills[part.id] ?? {}}
          focus={focus}
          checked={!!checked[part.id]}
          score={scores[part.id] ?? 0}
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
      ) : (
        <ChoiceCard
          part={part}
          picked={picked[part.id]}
          checked={!!checked[part.id]}
          onPick={(id) => {
            if (checked[part.id]) return
            setPicked((prev) => ({ ...prev, [part.id]: id }))
          }}
          onCheck={() => checkChoice(part.id, part.answer)}
          onNext={next}
        />
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
  onFocus: (n: number) => void
  onPick: (word: string) => void
  onCheck: () => void
  onNext: () => void
}) {
  const ready = part.blanks.every((blank) => values[blank.n])
  return (
    <main className="jiaocheng-midterm-body">
      <h1>{part.title}<em>{part.blanks.length} {t('points')}</em></h1>
      <p className="jiaocheng-midterm-zh">{part.zh} · {t('Lesson {n}', { n: part.lesson })}</p>
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
          <p>{t('Correct')} · {score}/{part.blanks.length}</p>
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
  onPick,
  onCheck,
  onNext,
}: {
  part: Extract<ExamPart, { kind: 'choice' }>
  picked?: string
  checked: boolean
  onPick: (id: string) => void
  onCheck: () => void
  onNext: () => void
}) {
  return (
    <main className="jiaocheng-midterm-body">
      <h1>{part.title}<em>1 {t('points')}</em></h1>
      <p className="jiaocheng-midterm-zh">{t('Lesson {n}', { n: part.lesson })}</p>
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
          <p className="jiaocheng-midterm-why">{part.why}</p>
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
