import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { haptic } from '../lib/sfx'
import { t } from '../lib/i18n'
import { useStore } from '../store/store'
import { Flame } from './Flame'

/**
 * Session momentum: how many answers in a row were right the first time. It is
 * presentation only. It never records a review or changes a schedule.
 */
export interface Momentum {
  combo: number
  best: number
  correct: number
  answered: number
  /** XP on the account when the sitting opened, for the end screen. */
  startXp: number
  /** One first attempt per activity key; later attempts on the same key are ignored. */
  register: (key: string, correct: boolean) => void
}

const MILESTONES = new Set([3, 5, 10, 15, 20, 30])
const Ctx = createContext<Momentum | null>(null)

export function MomentumProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  const [startXp] = useState(() => store.xp)
  const seen = useRef(new Set<string>())
  const [state, setState] = useState({ combo: 0, best: 0, correct: 0, answered: 0 })
  const register = useCallback((key: string, correct: boolean) => {
    if (seen.current.has(key)) return
    seen.current.add(key)
    setState((s) => {
      const combo = correct ? s.combo + 1 : 0
      if (correct && MILESTONES.has(combo)) haptic('streak')
      return { combo, best: Math.max(s.best, combo), correct: s.correct + (correct ? 1 : 0), answered: s.answered + 1 }
    })
  }, [])
  const value = useMemo(() => ({ ...state, startXp, register }), [state, startXp, register])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const QUIET: Momentum = { combo: 0, best: 0, correct: 0, answered: 0, startXp: 0, register: () => {} }

export function useMomentum(): Momentum {
  return useContext(Ctx) ?? QUIET
}

/** Flame and count once two answers in a row land; a bigger burst on milestones. */
export function ComboBadge() {
  const { combo } = useMomentum()
  if (combo < 2) return null
  const milestone = MILESTONES.has(combo)
  return (
    <span
      key={combo}
      className="duo-combo"
      data-milestone={milestone || undefined}
      role="status"
      aria-label={t('{n} right in a row', { n: combo })}
    >
      <Flame size={18} />
      <b>{combo}</b>
      {milestone && <span className="duo-combo-burst" aria-hidden>{t('{n} in a row!', { n: combo })}</span>}
    </span>
  )
}

/** "+10 XP" rising from the progress bar each time the account gains XP. */
export function XpFloat() {
  const { xp } = useStore()
  const last = useRef(xp)
  const [floats, setFloats] = useState<{ id: number; n: number }[]>([])
  const timers = useRef(new Set<number>())
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])
  useEffect(() => {
    const gained = xp - last.current
    last.current = xp
    if (gained <= 0) return
    const id = Date.now() + Math.random()
    setFloats((list) => [...list.slice(-2), { id, n: gained }])
    const timer = window.setTimeout(() => {
      timers.current.delete(timer)
      setFloats((list) => list.filter((f) => f.id !== id))
    }, 1100)
    timers.current.add(timer)
  }, [xp])
  return (
    <span className="duo-xp-floats" aria-hidden>
      {floats.map((f) => <span key={f.id} className="duo-xp-float">+{f.n} XP</span>)}
    </span>
  )
}
