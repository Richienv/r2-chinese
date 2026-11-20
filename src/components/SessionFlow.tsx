import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { DAILY_GOAL, useStore } from '../store/store'
import { Fireworks } from './Fireworks'
import { Flame } from './Flame'
import { MasteryTracker } from './MasteryTracker'
import { useMomentum } from './Momentum'
import { CountUp, GoalRing } from './TodayHud'
import '../styles/compact-session.css'
import '../styles/duo.css'

/** Learn → Practise → Done, with the position inside the current stage. */
export function SessionProgress({ kind, n, of }: { kind: string; n?: number; of?: number }) {
  const stage = kind === 'complete' ? 2 : ['teach', 'read', 'note'].includes(kind) ? 0 : 1
  return <div className="session-stages" aria-label={t('Session steps')}>{[t('Learn'), t('Practise'), t('Done')].map((label, i) => <span key={label} aria-current={i === stage ? 'step' : undefined} data-active={i === stage} data-past={i < stage}>{label}{i === stage && i < 2 && n && of && of > 1 ? <b>{n}/{of}</b> : null}</span>)}</div>
}

/**
 * The end of a sitting is the peak: what was earned, how clean it was, the streak
 * and today's ring, then the words. The details stay one tap away.
 */
export function SessionSummary({ title, words }: { title: string; words: string[] }) {
  const store = useStore()
  const momentum = useMomentum()
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setBurst(1), 260)
    return () => window.clearTimeout(timer)
  }, [])
  const gained = Math.max(0, store.xp - momentum.startXp)
  const accuracy = momentum.answered ? Math.round((momentum.correct / momentum.answered) * 100) : null
  const goal = store.today.cards / DAILY_GOAL
  const headline = accuracy === null
    ? t('Session complete!')
    : accuracy === 100
      ? t('Perfect session!')
      : accuracy >= 80
        ? t('Great session!')
        : t('Done. The hard ones come back soon.')
  return (
    <section className="duo-victory">
      <Fireworks token={burst} />
      <div className="duo-victory-badge" aria-hidden>
        <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.2 4.2L19 7" /></svg>
      </div>
      <p className="duo-victory-kicker">{t('Session saved')}</p>
      <h2 className="duo-victory-title">{headline}</h2>
      <p className="duo-victory-sub" lang="zh-CN">{title}</p>
      <div className="duo-victory-stats">
        <div className="duo-stat" data-tone="gold" style={{ ['--i' as string]: 0 }}>
          <span className="duo-stat-label">{t('XP earned')}</span>
          <strong>+<CountUp to={gained} /></strong>
        </div>
        <div className="duo-stat" data-tone="green" style={{ ['--i' as string]: 1 }}>
          <span className="duo-stat-label">{t('Accuracy')}</span>
          <strong>{accuracy === null ? '—' : <><CountUp to={accuracy} />%</>}</strong>
        </div>
        <div className="duo-stat" data-tone="flame" style={{ ['--i' as string]: 2 }}>
          <span className="duo-stat-label">{t('Best combo')}</span>
          <strong>{momentum.best}</strong>
        </div>
      </div>
      <div className="duo-victory-day">
        <span className="duo-victory-streak"><Flame size={30} /><b>{store.streak}</b><small>{t('day streak')}</small></span>
        <span className="duo-victory-goal">
          <GoalRing value={goal} size={54} stroke={6}>{goal >= 1 ? <Check /> : null}</GoalRing>
          <span>
            <b>{goal >= 1 ? t('Daily goal done') : t('{n} of {goal} today', { n: store.today.cards, goal: DAILY_GOAL })}</b>
            <small>{goal >= 1 ? t('Come back tomorrow to keep the flame.') : t('One more session fills the ring.')}</small>
          </span>
        </span>
      </div>
      {words.length > 0 && (
        <>
          <p className="duo-victory-words-label">{t('Words you practised')}</p>
          <div className="session-word-trail duo-victory-words" lang="zh-CN">{words.map((word, i) => <span key={word} style={{ ['--i' as string]: i }}>{word}</span>)}</div>
          <details className="session-summary-details"><summary>{t('Word progress')}</summary><MasteryTracker words={words} /></details>
        </>
      )}
    </section>
  )
}

function Check() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.2 4.2L19 7" /></svg>
}

/**
 * A grammar explanation after its example: a long abstract paragraph ("a conjunction
 * used in the first clause…") is folded, so the sentence and its meaning come first.
 */
export function Explain({ folded, children }: { folded: boolean; children: React.ReactNode }) {
  if (!folded) return <div className="duo-explain">{children}</div>
  return (
    <details className="duo-explain duo-why">
      <summary>{t('Why does it work this way?')}</summary>
      {children}
    </details>
  )
}

export function PracticeExit({ onFinish }: { onFinish: () => void }) {
  return <div className="practice-exit"><button onClick={onFinish}>{t('Finish practice')}</button></div>
}
