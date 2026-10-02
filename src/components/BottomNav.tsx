import { forwardRef, useLayoutEffect, useRef } from 'react'
import { BarsIcon, BookIcon, HomeIcon, UserIcon } from './Icons'
import { advanceDockSpring, dockSpringAt, dockSpringSettled, type DockSpring, type DockTarget } from '../lib/navigationMotion'
import '../styles/bottom-navigation.css'

export type NavigationTab = 'home' | 'learn' | 'stats' | 'profile'

const DESTINATIONS = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'learn', label: 'Learn', Icon: BookIcon },
  { key: 'stats', label: 'Progress', Icon: BarsIcon },
  { key: 'profile', label: 'Profile', Icon: UserIcon },
] as const

/** A flow-layout dock: measured spring motion never changes the navigation semantics. */
export const BottomNav = forwardRef<HTMLElement, { tab: NavigationTab; onTabChange: (tab: NavigationTab) => void }>(function BottomNav({ tab, onTabChange }, navRef) {
  const dock = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const buttons = useRef<Partial<Record<NavigationTab, HTMLButtonElement>>>({})
  const active = useRef(tab)
  active.current = tab
  const target = useRef<DockTarget>({ x: 0, width: 0 })
  const spring = useRef<DockSpring>(dockSpringAt(target.current))
  const initialized = useRef(false)
  const frame = useRef(0)
  const lastTime = useRef(0)
  const reduced = useRef(false)
  const flourishes = useRef<Animation[]>([])

  function paint() {
    const marker = indicator.current
    if (!marker) return
    marker.style.width = `${Math.max(1, spring.current.width.position).toFixed(3)}px`
    marker.style.transform = `translate3d(${spring.current.x.position.toFixed(3)}px, 0, 0)`
    marker.dataset.ready = 'true'
  }

  function animate(time: number) {
    const elapsed = lastTime.current ? (time - lastTime.current) / 1000 : 1 / 60
    lastTime.current = time
    spring.current = advanceDockSpring(spring.current, target.current, elapsed)
    if (dockSpringSettled(spring.current, target.current)) {
      spring.current = dockSpringAt(target.current)
      frame.current = 0
      lastTime.current = 0
      paint()
      return
    }
    paint()
    frame.current = window.requestAnimationFrame(animate)
  }

  function measure() {
    const container = dock.current
    const selected = buttons.current[active.current]
    if (!container || !selected) return
    const surface = container.getBoundingClientRect()
    const button = selected.getBoundingClientRect()
    target.current = { x: button.left - surface.left - container.clientLeft + 3, width: button.width - 6 }
    if (!initialized.current || reduced.current) {
      window.cancelAnimationFrame(frame.current)
      frame.current = 0
      lastTime.current = 0
      initialized.current = true
      spring.current = dockSpringAt(target.current)
      paint()
    } else if (!frame.current && !dockSpringSettled(spring.current, target.current)) frame.current = window.requestAnimationFrame(animate)
  }

  useLayoutEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => {
      reduced.current = motion.matches
      if (motion.matches) {
        flourishes.current.forEach((animation) => animation.cancel())
        flourishes.current = []
        measure()
      }
    }
    syncMotion()
    motion.addEventListener('change', syncMotion)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (dock.current) observer?.observe(dock.current)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      window.cancelAnimationFrame(frame.current)
      frame.current = 0
      lastTime.current = 0
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      motion.removeEventListener('change', syncMotion)
      flourishes.current.forEach((animation) => animation.cancel())
      flourishes.current = []
    }
  }, [])

  useLayoutEffect(measure, [tab])

  function select(next: NavigationTab) {
    flourishes.current.forEach((animation) => animation.cancel())
    flourishes.current = []
    const button = buttons.current[next]
    const icon = button?.querySelector<HTMLElement>('.bottom-nav-icon')
    const label = button?.querySelector<HTMLElement>('.bottom-nav-label')
    if (!reduced.current && icon && label && typeof icon.animate === 'function') {
      flourishes.current = [
        icon.animate([
          { transform: 'translateY(0) rotate(0) scale(1)', offset: 0 },
          { transform: 'translateY(-4px) rotate(-5deg) scale(1.09)', offset: .42 },
          { transform: 'translateY(1px) rotate(1deg) scale(.98)', offset: .76 },
          { transform: 'translateY(0) rotate(0) scale(1)', offset: 1 },
        ], { duration: 480, easing: 'cubic-bezier(.2,.8,.3,1)' }),
        label.animate([{ opacity: .6, transform: 'translateY(2px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 340, delay: 55, easing: 'ease-out' }),
      ]
    }
    onTabChange(next)
  }

  return <nav ref={navRef} className="bottom-nav" aria-label="Main">
    <div ref={dock} className="bottom-nav-dock">
      <span ref={indicator} className="bottom-nav-marker" aria-hidden="true"><i /></span>
      {DESTINATIONS.map(({ key, label, Icon }) => <button key={key} ref={(button) => { if (button) buttons.current[key] = button; else delete buttons.current[key] }} type="button" className="bottom-nav-item" aria-current={tab === key ? 'page' : undefined} onClick={() => select(key)}><span className="bottom-nav-icon" aria-hidden="true"><Icon size={21} /></span><span className="bottom-nav-label">{label}</span></button>)}
    </div>
  </nav>
})
