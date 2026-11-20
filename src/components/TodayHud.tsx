import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'
import { DAILY_GOAL, dayKey, useStore } from '../store/store'
import { Flame } from './Flame'
import '../styles/duo.css'

/** A ring that fills; the stroke animates from empty on first paint. */
export function GoalRing({ value, size = 44, stroke = 5, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(Math.min(1, Math.max(0, value))))
    return () => cancelAnimationFrame(frame)
  }, [value])
  return (
    <span className="duo-ring" data-full={value >= 1 || undefined} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="duo-ring-track" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className="duo-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - shown)}
        />
      </svg>
      {children && <span className="duo-ring-center">{children}</span>}
    </span>
  )
}

/** Counts up to `to` once, quickly; jumps straight there when motion is reduced. */
export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || to <= from.current) {
      from.current = to
      setValue(to)
      return
    }
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setValue(Math.round(begin + (to - begin) * eased))
      if (k < 1) frame = requestAnimationFrame(tick)
      else from.current = to
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [to, duration])
  return <>{value}</>
}

const DAY_LETTERS = [t('Su'), t('Mo'), t('Tu'), t('We'), t('Th'), t('Fr'), t('Sa')]

/** Monday-to-Sunday dots for this week: practised days filled, today ringed. */
export function WeekStrip() {
  const { practiceDays } = useStore()
  const done = new Set(practiceDays)
  const now = new Date()
  const monday = new Date(now)
  monday.setHours(12, 0, 0, 0)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = dayKey(d)
    return { key, letter: DAY_LETTERS[d.getDay()], done: done.has(key), today: key === dayKey(now), future: d > now && key !== dayKey(now) }
  })
  return (
    <ol className="duo-week" aria-label={t('This week')}>
      {days.map((d, i) => (
        <li key={d.key} data-done={d.done || undefined} data-today={d.today || undefined} data-future={d.future || undefined} style={{ ['--i' as string]: i }}>
          <span className="duo-week-dot" aria-hidden>{d.done ? <TickGlyph /> : null}</span>
          <span className="duo-week-letter">{d.letter}</span>
          <span className="sr-only">{d.done ? t('practised') : t('not yet')}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Home's first glance: streak, total XP and today's ring, with the week below.
 * Kind words only: the goal is one session, and a missed day never scolds.
 */
export function TodayHud({ onOpen }: { onOpen?: () => void }) {
  const s = useStore()
  const cards = s.today.cards
  const left = Math.max(0, DAILY_GOAL - cards)
  const line = cards === 0
    ? t('One session today fills your ring.')
    : left > 0
      ? t('{n} more steps to today’s goal.', { n: left })
      : t('Today’s goal is done. Anything more is a bonus.')
  return (
    <section className="duo-hud" aria-label={t('Today')}>
      <button type="button" className="duo-hud-row" onClick={onOpen} aria-label={t('Open progress')}>
        <span className="duo-hud-chip duo-hud-streak" data-on={s.streak > 0 || undefined}>
          <Flame size={22} />
          <b><CountUp to={s.streak} duration={600} /></b>
          <small>{t('day streak')}</small>
        </span>
        <span className="duo-hud-chip duo-hud-xp">
          <BoltGlyph />
          <b><CountUp to={s.xp} /></b>
          <small>XP</small>
        </span>
        <span className="duo-hud-chip duo-hud-goal">
          <GoalRing value={cards / DAILY_GOAL} size={38} stroke={5} />
          <b>{Math.min(cards, DAILY_GOAL)}/{DAILY_GOAL}</b>
          <small>{t('today')}</small>
        </span>
      </button>
      <WeekStrip />
      <p className="duo-hud-line">{line}</p>
    </section>
  )
}

function BoltGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M13.5 2 4.8 13.2h6l-1.3 8.8 8.7-11.3h-6.1z" fill="currentColor" />
    </svg>
  )
}

function TickGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  )
}
