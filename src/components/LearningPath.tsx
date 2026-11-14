import { CheckIcon, LockIcon } from './Icons'
import { t } from '../lib/i18n'
import { unlockSpeech } from '../lib/speech'
import '../styles/home-alive.css'

export interface LearningPathItem {
  id: string
  label: string
  title: string
  subtitle?: string
  state: 'done' | 'current' | 'locked' | 'available'
  playable: boolean
  onSelect: () => void
}

export interface LearningPathProps {
  kicker?: string
  title: string
  subtitle?: string
  source?: string
  items: LearningPathItem[]
  open?: boolean
  onOpen?: () => void
  fill?: boolean
}

function LessonStep({ item, index }: { item: LearningPathItem; index: number }) {
  return (
    <li className="atlas-stop">
      <button
        type="button"
        className={`atlas-plaque atlas-plaque-${item.state}`}
        data-path-item={item.id}
        data-state={item.state === 'current' ? 'on' : item.state === 'locked' ? 'lock' : item.state}
        disabled={!item.playable}
        aria-current={item.state === 'current' ? 'step' : undefined}
        aria-label={item.state === 'current'
          ? t('{label}: {title}, continue learning', { label: item.label, title: item.title })
          : item.state === 'done'
            ? t('{label}: {title}, completed, revisit', { label: item.label, title: item.title })
            : item.state === 'locked'
              ? t('{label}: {title}, locked', { label: item.label, title: item.title })
              : `${item.label}: ${item.title}`}
        onPointerDown={() => { if (item.playable) unlockSpeech() }}
        onClick={() => { if (item.playable) item.onSelect() }}
      >
        <span className="atlas-step-seal" aria-hidden>
          {item.state === 'done' ? <CheckIcon size={17} /> : item.state === 'locked' ? <LockIcon size={16} /> : String(index + 1).padStart(2, '0')}
        </span>
        <span className="atlas-plaque-face">
          <span className="atlas-step-label">{item.label}</span>
          <span className="atlas-step-title">{item.title}</span>
          {item.subtitle && item.subtitle.trim() !== item.title.trim() && <span className="atlas-step-subtitle">{item.subtitle}</span>}
          {item.state === 'current' && <span className="atlas-continue">{t('Continue')} <span aria-hidden>→</span></span>}
        </span>
      </button>
    </li>
  )
}

/** Home presents the next step; Materials retains the full, revisitable sequence. */
export function LearningPath({ kicker, title, subtitle, source, items, open = true, onOpen, fill }: LearningPathProps) {
  const done = items.filter(item => item.state === 'done').length
  const current = items.find(item => item.state === 'current') ?? items.find(item => item.playable)
  const visible = fill && current ? [current] : items
  const heading = <>
    {kicker && <span className="atlas-kicker">{kicker}</span>}
    <h2 className="atlas-title">{title}</h2>
    {subtitle && subtitle !== title && <span className="atlas-subtitle">{subtitle}</span>}
    {source && <span className="atlas-source">{source}</span>}
    {!fill && <span className="atlas-summary-meta"><span>{t('{done} of {total} steps completed', { done, total: items.length })}</span><span className="atlas-chevron" aria-hidden>⌄</span></span>}
  </>
  const content = <>
    {!fill && onOpen && <button className="atlas-open" type="button" disabled={!open} onClick={onOpen}>{t('Read lesson')} <span aria-hidden>↗</span></button>}
    <div className="atlas-progress" aria-label={t('{done} of {total} steps completed', { done, total: items.length })}>
      <span>{fill ? t('Your next session') : done === items.length && items.length ? t('Ready to revisit') : t('Learning path')}</span>
      <span className="atlas-progress-marks" aria-hidden>{items.map(item => <i key={item.id} data-state={item.state} />)}</span>
      <span className="atlas-progress-count">{done} / {items.length}</span>
    </div>
    <ol className="atlas-track">{visible.map(item => <LessonStep key={item.id} item={item} index={items.indexOf(item)} />)}</ol>
  </>
  return fill ? (
    <section className="learning-atlas learning-atlas-home"><div className="atlas-header">{heading}</div>{content}</section>
  ) : (
    <details className={`learning-atlas${open ? '' : ' learning-atlas-locked'}`} open={items.some(item => item.state === 'current')}>
      <summary className="atlas-header">{heading}</summary>
      {content}
    </details>
  )
}
