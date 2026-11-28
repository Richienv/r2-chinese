import { useEffect, useRef, useState } from 'react'

/**
 * Zero-leak silhouette renderer for locked evolutions.
 * Never renders a DOM <img> pointing at the unrevealed artwork URL; instead draws
 * onto an offscreen/controlled canvas and replaces all RGB channels via `source-in`
 * so inspecting the DOM or flashing between Next/Back never leaks the locked art.
 */
export function SealedBeastSilhouette({
  src,
  level,
  className = '',
  compact = false,
}: {
  src: string
  level: number
  className?: string
  compact?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const width = compact ? 120 : 240
  const height = compact ? 160 : 320

  useEffect(() => {
    setStatus('loading')
    const canvas = canvasRef.current
    if (!canvas || typeof Image === 'undefined') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    ctx.clearRect(0, 0, width, height)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        ctx.clearRect(0, 0, width, height)
        ctx.globalCompositeOperation = 'source-over'
        const scale = Math.min(width / (img.naturalWidth || width), height / (img.naturalHeight || height))
        const drawW = (img.naturalWidth || width) * scale
        const drawH = (img.naturalHeight || height) * scale
        const dx = (width - drawW) / 2
        const dy = (height - drawH) / 2
        ctx.drawImage(img, dx, dy, drawW, drawH)

        // Mask strictly to alpha pixels and flood with obsidian-slate gradient (zero RGB leak)
        ctx.globalCompositeOperation = 'source-in'
        const grad = ctx.createLinearGradient(0, 0, 0, height)
        grad.addColorStop(0, '#0b1220')
        grad.addColorStop(1, '#1e293b')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
        ctx.globalCompositeOperation = 'source-over'
        setStatus('ready')
      } catch {
        ctx.clearRect(0, 0, width, height)
        setStatus('error')
      }
    }
    img.onerror = () => {
      if (cancelled) return
      ctx.clearRect(0, 0, width, height)
      setStatus('error')
    }
    img.src = src

    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src, width, height])

  return (
    <div
      className={`sealed-silhouette-wrap${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label={`Wujud Rahasia Lv ${level}`}
      data-status={status}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="sealed-silhouette-canvas"
        aria-hidden="true"
      />
      {status !== 'ready' && (
        <div className="sealed-silhouette-mystery" aria-hidden="true">
          <span>?</span>
        </div>
      )}
    </div>
  )
}
