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

/** Left-edge gesture is interactive; a cancellation never commits navigation. */
export function useEdgeSwipeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    let x = 0,
      y = 0,
      dx = 0,
      tracking = false,
      horizontal = false,
      overlay: HTMLElement | null = null
    let restoreTimer: ReturnType<typeof setTimeout> | undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    function restore() {
      tracking = false
      horizontal = false
      dx = 0
      if (!overlay) return
      const element = overlay
      element.style.transition = reduced ? 'none' : 'transform 200ms cubic-bezier(.2,.7,.2,1)'
      element.style.transform = 'translate3d(0,0,0)'
      restoreTimer = setTimeout(
        () => {
          element.style.removeProperty('transform')
          element.style.removeProperty('transition')
          element.style.removeProperty('animation')
        },
        reduced ? 0 : 210,
      )
    }
    function start(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const t = e.touches[0],
        target = e.target as HTMLElement
      if (t.clientX > 24 || target.closest('canvas,input,textarea,[contenteditable=true],.hanzi-host')) return
      overlay = document.querySelector<HTMLElement>('.app>.overlay')
      if (!overlay) return
      clearTimeout(restoreTimer)
      x = t.clientX
      y = t.clientY
      dx = 0
      tracking = true
      horizontal = false
    }
    function move(e: TouchEvent) {
      if (!tracking || !overlay) return
      const t = e.touches[0]
      if (!t) return restore()
      const dy = Math.abs(t.clientY - y)
      dx = Math.max(0, t.clientX - x)
      if (!horizontal && dy > 12 && dy > dx) return restore()
      if (dx > 10 && dx > dy * 1.3) horizontal = true
      if (!horizontal) return
      if (e.cancelable) e.preventDefault()
      overlay.style.animation = 'none'
      overlay.style.transition = 'none'
      overlay.style.transform = `translate3d(${reduced ? 0 : dx}px,0,0)`
    }
    function end() {
      if (!tracking) return
      const commit = horizontal && dx > Math.min(120, window.innerWidth * 0.28)
      restore()
      if (commit) onClose()
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end, { passive: true })
    document.addEventListener('touchcancel', restore, { passive: true })
    return () => {
      clearTimeout(restoreTimer)
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', restore)
      if (overlay) {
        overlay.style.removeProperty('transform')
        overlay.style.removeProperty('transition')
        overlay.style.removeProperty('animation')
      }
    }
  }, [active, onClose])
}
