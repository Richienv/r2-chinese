import { useEffect, useRef } from 'react'

const RED = '#951117'
const HOT = '#e22c1c'
const GOLD = '#ffe3b0'
const WHITE = '#fff6ea'
const INK = [RED, HOT, GOLD, WHITE]

type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  width: number
  curve: number
  child: boolean
  born: number
}

/**
 * Frame-by-frame ink fireworks. Each spark is a pressure stroke, not a dot.
 * `token` bumps to play one burst.
 */
export function Fireworks({ token }: { token: number }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token || !host.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80;'
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    host.current.appendChild(canvas)

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()

    if (reduced) {
      ctx.strokeStyle = GOLD
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(window.innerWidth * 0.42, window.innerHeight * 0.46)
      ctx.quadraticCurveTo(
        window.innerWidth * 0.5,
        window.innerHeight * 0.38,
        window.innerWidth * 0.58,
        window.innerHeight * 0.48,
      )
      ctx.stroke()
      const stop = window.setTimeout(() => canvas.remove(), 700)
      return () => {
        window.clearTimeout(stop)
        canvas.remove()
      }
    }

    const w = () => window.innerWidth
    const h = () => window.innerHeight
    const sparks: Spark[] = []
    const rockets: { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[]; color: string; boom: number }[] = []
    const starts = [0.28, 0.5, 0.72]
    starts.forEach((px, i) => {
      rockets.push({
        x: w() * px,
        y: h() + 8,
        vx: (px - 0.5) * -40,
        vy: -h() * (0.0054 + i * 0.00045),
        trail: [],
        color: INK[i % INK.length],
        boom: h() * (0.22 + i * 0.06),
      })
    })

    const t0 = performance.now()
    let raf = 0

    const burst = (x: number, y: number, color: string, n: number, child: boolean) => {
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2
        const speed = (child ? 0.6 : 2.2) + Math.random() * (child ? 1.4 : 3.4)
        sparks.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 0,
          max: child ? 48 + Math.random() * 24 : 78 + Math.random() * 36,
          color: Math.random() > 0.35 ? color : Math.random() > 0.5 ? GOLD : WHITE,
          width: child ? 1.1 + Math.random() : 2.2 + Math.random() * 1.6,
          curve: (Math.random() - 0.5) * 8,
          child,
          born: performance.now(),
        })
      }
    }

    const stroke = (s: Spark) => {
      const len = 8 + s.width * 4
      const ang = Math.atan2(s.vy, s.vx)
      const x2 = s.x - Math.cos(ang) * len
      const y2 = s.y - Math.sin(ang) * len
      const mx = (s.x + x2) / 2 + Math.cos(ang + Math.PI / 2) * s.curve
      const my = (s.y + y2) / 2 + Math.sin(ang + Math.PI / 2) * s.curve
      const fade = 1 - s.life / s.max
      ctx.strokeStyle = s.color
      ctx.globalAlpha = Math.max(0, fade) * (s.child ? 0.7 : 0.95)
      ctx.lineCap = 'round'
      ctx.lineWidth = s.width * (0.35 + fade)
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.quadraticCurveTo(mx, my, s.x, s.y)
      ctx.stroke()
    }

    const frame = (now: number) => {
      const elapsed = now - t0
      ctx.clearRect(0, 0, w(), h())

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.trail.push({ x: r.x, y: r.y })
        if (r.trail.length > 16) r.trail.shift()
        r.x += r.vx * 0.16
        r.y += r.vy
        r.vy += 0.018
        ctx.strokeStyle = r.color
        ctx.lineCap = 'round'
        for (let t = 1; t < r.trail.length; t++) {
          ctx.globalAlpha = t / r.trail.length
          ctx.lineWidth = 1 + (t / r.trail.length) * 2.4
          ctx.beginPath()
          ctx.moveTo(r.trail[t - 1].x, r.trail[t - 1].y)
          ctx.lineTo(r.trail[t].x, r.trail[t].y)
          ctx.stroke()
        }
        if (r.y <= r.boom) {
          burst(r.x, r.y, r.color, 86, false)
          rockets.splice(i, 1)
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life += 1
        s.vy += 0.012
        s.vx *= 0.992
        s.vy *= 0.992
        s.x += s.vx
        s.y += s.vy
        stroke(s)
        if (!s.child && s.life === 32) burst(s.x, s.y, s.color, 7, true)
        if (s.life > s.max) sparks.splice(i, 1)
      }
      ctx.globalAlpha = 1

      if (elapsed < 2800 && (rockets.length || sparks.length)) {
        raf = requestAnimationFrame(frame)
      } else {
        canvas.remove()
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.remove()
    }
  }, [token])

  return <div ref={host} />
}
