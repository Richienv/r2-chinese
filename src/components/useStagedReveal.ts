import { useCallback, useEffect, useState } from 'react'
import { playTick } from '../lib/sfx'
import '../styles/staged-reveal.css'

function reducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Shows `count` parts one after another (`delays[i]` ms after the start).
 * `active` false keeps everything hidden; `replay` runs the sequence again.
 */
export function useStagedReveal(delays: readonly number[], resetKey: unknown, active = true) {
  const count = delays.length
  const [shown, setShown] = useState(() => (reducedMotion() ? count : 0))
  const [run, setRun] = useState(0)
  useEffect(() => {
    if (!active) {
      setShown(0)
      return
    }
    if (reducedMotion()) {
      setShown(count)
      return
    }
    setShown(0)
    const timers = delays.map((delay, index) =>
      window.setTimeout(() => {
        setShown(index + 1)
        if (index > 0) playTick()
      }, delay),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, resetKey, run, active])
  const replay = useCallback(() => setRun((value) => value + 1), [])
  const showAll = useCallback(() => setShown(count), [count])
  return { shown, replay, showAll, done: shown >= count, at: (index: number) => shown > index }
}
