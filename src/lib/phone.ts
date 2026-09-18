import { useEffect } from 'react'

/** Stop the document rubber-banding behind a full-screen overlay. */
export function useOverlayLock(open: boolean) {
  useEffect(() => {
    document.documentElement.classList.toggle('is-overlay', open)
    return () => document.documentElement.classList.remove('is-overlay')
  }, [open])
}

/** Keyboard overlap → `--kb`, so session feet stay above the iOS keyboard. */
export function useVisualViewportInset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const sync = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`)
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      document.documentElement.style.removeProperty('--kb')
    }
  }, [])
}

/** Left-edge swipe closes the current overlay — the iOS back gesture. */
export function useEdgeSwipeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t || t.clientX > 24) return
      tracking = true
      startX = t.clientX
      startY = t.clientY
    }

    const end = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (dx > 72 && dy < 72) onClose()
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', end, { passive: true })
    document.addEventListener('touchcancel', end, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
    }
  }, [active, onClose])
}
