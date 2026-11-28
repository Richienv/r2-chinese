import { useState } from 'react'
import { t } from '../lib/i18n'
import { ChevronRight } from './Icons'
import '../styles/home-alive.css'

export interface SkipLessonOption {
  lesson: number
  label: string
  title: string
  wordCount: number
  done: boolean
  skipped: boolean
}

export function SkipLevelControl({
  courseLabel,
  currentLesson,
  recommendedLesson,
  options,
  onSkipTo,
  compact = false,
}: {
  courseLabel: string
  currentLesson: number
  recommendedLesson?: number
  options: SkipLessonOption[]
  onSkipTo: (targetLesson: number) => void
  compact?: boolean
}) {
  const selectable = options.filter((o) => o.lesson > 1)
  const [open, setOpen] = useState(false)
  const defaultTarget =
    recommendedLesson && selectable.some((o) => o.lesson === recommendedLesson) && currentLesson < recommendedLesson
      ? recommendedLesson
      : (selectable.find((o) => o.lesson > currentLesson && !o.done)?.lesson ?? selectable[selectable.length - 1]?.lesson ?? 2)
  const [target, setTarget] = useState<number>(defaultTarget)

  if (selectable.length === 0) return null

  const willSkip = options.filter((o) => o.lesson < target && !o.done)
  const queuedWords = willSkip.reduce((sum, o) => sum + o.wordCount, 0)
  const showQuickJump =
    !!recommendedLesson &&
    currentLesson < recommendedLesson &&
    selectable.some((o) => o.lesson === recommendedLesson)

  function openWith(initial: number) {
    setTarget(initial)
    setOpen(true)
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          className="home-quiet-pill"
          onClick={() => openWith(recommendedLesson && currentLesson < recommendedLesson ? recommendedLesson : defaultTarget)}
        >
          <ChevronRight size={15} />
          <span>{t('Skip to lesson…')}</span>
        </button>
      ) : (
        <section className="skip-level-card" aria-label={t('Skip to lesson')}>
          <div className="skip-level-head">
            <div>
              <strong>{t('Already ahead in class?')}</strong>
              <div>
                <small>{t('Jump straight to your lesson and carry earlier words into Active Recall.')}</small>
              </div>
            </div>
          </div>
          <div className="skip-level-actions">
            {showQuickJump && (
              <button
                type="button"
                className="skip-level-btn"
                onClick={() => openWith(recommendedLesson!)}
              >
                {t('Jump to Lesson {n}', { n: recommendedLesson! })}
              </button>
            )}
            <button
              type="button"
              className={showQuickJump ? 'skip-level-btn skip-level-btn-secondary' : 'skip-level-btn'}
              onClick={() => openWith(defaultTarget)}
            >
              {t('Skip to lesson…')}
            </button>
          </div>
        </section>
      )}

      {open && (
        <div
          className="skip-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t('Skip to lesson')}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="skip-modal">
            <h2>{t('Skip to lesson in {course}', { course: courseLabel })}</h2>
            <label>
              <span>{t('Target lesson to unlock')}</span>
              <select
                aria-label={t('Target lesson to unlock')}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              >
                {selectable.map((opt) => (
                  <option key={opt.lesson} value={opt.lesson}>
                    {opt.label} · {opt.title}
                  </option>
                ))}
              </select>
            </label>

            <ul className="skip-modal-rules">
              <li>
                {t('Lesson {n} unlocks right away so you can start there immediately.', { n: target })}
              </li>
              <li>
                {willSkip.length > 0
                  ? t('{lessons} earlier lessons are marked Skipped (never mastered) and {words} words are queued into Active Recall.', {
                      lessons: willSkip.length,
                      words: queuedWords,
                    })
                  : t('All earlier lessons are already completed.')}
              </li>
              <li>
                {t('Skipped words stay unmastered until you prove them in Active Recall. You can revisit or un-skip anytime.')}
              </li>
            </ul>

            <div className="skip-modal-footer">
              <button
                type="button"
                className="skip-level-btn skip-level-btn-secondary"
                onClick={() => setOpen(false)}
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onSkipTo(target)
                  setOpen(false)
                }}
              >
                {t('Unlock Lesson {n}', { n: target })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
