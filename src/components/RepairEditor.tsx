import { useMemo, useState } from 'react'
import { repairAnswer, repairParts } from '../lib/repair'
import { t } from '../lib/i18n'
import '../styles/repair.css'
export function RepairEditor({
  response,
  reference,
  exact = false,
  onApply,
  disabled = false,
}: {
  response: string
  reference: string
  exact?: boolean
  onApply: (value: string) => void
  disabled?: boolean
}) {
  const parts = useMemo(() => repairParts(response, reference), [response, reference])
  const [edits, setEdits] = useState<Record<number, string>>({})
  const changes = parts.filter((p) => p.kind === 'edit').length
  if (!changes) return null
  return (
    <section className="repair-editor" aria-label={t('Fix only the changed parts')}>
      <h3>{t('Keep what is right. Fix one part at a time.')}</h3>
      <p className="repair-explanation">
        {exact
          ? t('Green characters are correct and stay in place. Edit only the outlined parts.')
          : t(
              'Green text matches the reference. Differences are editable; a different sentence can still be valid.',
            )}
      </p>
      <div className="repair-parts" lang="zh-CN">
        {parts.map((part, i) =>
          part.kind === 'keep' ? (
            <span className="repair-kept" key={i} aria-label={t('Keep: {text}', { text: part.text })}>
              {part.text}
            </span>
          ) : (
            <label className="repair-slot" key={i}>
              <span>{part.original ? t('Revise this part') : t('Add the missing part')}</span>
              <input
                aria-label={t('Correction {n}', { n: i + 1 })}
                value={edits[i] ?? part.original}
                onChange={(e) => setEdits((s) => ({ ...s, [i]: e.target.value }))}
                placeholder={part.target ? '…' : t('Remove extra text')}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
              />
              {!part.target && <small>{t('Extra text: leave this box empty.')}</small>}
            </label>
          ),
        )}
      </div>
      <button
        className="btn repair-submit"
        disabled={disabled}
        onClick={() => onApply(repairAnswer(parts, edits))}
      >
        {t('Check these corrections')}
      </button>
    </section>
  )
}
