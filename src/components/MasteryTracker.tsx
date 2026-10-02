import { useEffect, useId, useRef, useState } from 'react'
import { masteryLabel, type MasteryState } from '../lib/mastery'
import { useStore } from '../store/store'
import { CloseIcon } from './Icons'

/** Live retrieval evidence for this set of words, available without leaving practice. */
export function MasteryTracker({ words, compact = false, onOpen }: { words: string[]; compact?: boolean; onOpen?: () => void }) {
  const { mastery } = useStore()
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const unique = [...new Set(words.filter(Boolean))]
  const counts: Record<MasteryState, number> = { new: 0, learning: 0, hard: 0, mastered: 0 }
  for (const zh of unique) counts[mastery[zh]?.state ?? 'new']++

  useEffect(() => {
    if (!open) return
    close.current?.focus()
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open])

  return (
    <div className="mastery-tracker" ref={root}>
      <button
        ref={trigger}
        type="button"
        className={`mastery-trigger${compact ? ' is-compact' : ''}`}
        aria-label={`Word progress: ${counts.mastered} mastered, ${counts.hard} need practice, ${counts.learning} learning, ${counts.new} new`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => { if (!open) onOpen?.(); setOpen((value) => !value) }}
      >
        <span className="mastery-count" data-state="mastered" title="Mastered"><i className="mastery-dot" data-state="mastered" aria-hidden="true" />{counts.mastered}<span>{compact ? ' M' : ' mastered'}</span></span>
        <span className="mastery-count" data-state="hard" title="Needs practice"><i className="mastery-dot" data-state="hard" aria-hidden="true" />{counts.hard}<span>{compact ? ' H' : ' hard'}</span></span>
      </button>
      {open && (
        <div className="mastery-popover" id={id} role="dialog" aria-label="Word progress details">
          <div className="between">
            <strong>Retrieval progress</strong>
            <button
              ref={close}
              type="button"
              className="icon-round tap44"
              aria-label="Close word progress"
              onClick={() => { setOpen(false); trigger.current?.focus() }}
            ><CloseIcon size={16} /></button>
          </div>
          <p className="sub">Mastery needs 3 correct answers without hints across at least 2 days. Multiple choice does not earn it.</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, margin: '14px 0' }}>
            {(['new', 'learning', 'hard', 'mastered'] as const).map((state) => (
              <span key={state} className="mastery-state" data-state={state}>{counts[state]} {masteryLabel[state].toLowerCase()}</span>
            ))}
          </div>
          <div className="mastery-list">
            {unique.length === 0 ? <p className="sub">Words appear here as you meet them.</p> : unique.map((zh) => {
              const record = mastery[zh]
              const state = record?.state ?? 'new'
              return (
                <div className="mastery-row" key={zh}>
                  <span className="mastery-dot" data-state={state} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong className="zh" lang="zh-CN">{zh}</strong>
                    <div className="sub" style={{ fontSize: 11 }}>
                      {record?.attempts ? `${record.unaidedSuccesses} unaided · ${record.successDays.length} ${record.successDays.length === 1 ? 'day' : 'days'} · ${record.hints} assisted` : 'Met, not tested yet'}
                    </div>
                  </div>
                  <span className="mastery-state" data-state={state}>{masteryLabel[state]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
