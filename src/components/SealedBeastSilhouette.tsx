import { useEffect, useRef, useState } from 'react'

/**
 * Ultra-HD Sculpted Frosted Obsidian-Pearl Silhouette renderer for locked evolutions.
 * Zero-leak guarantee: never renders a DOM <img> pointing at the unrevealed artwork URL.
 * Draws ONLY the alpha channel onto a full Retina-resolution canvas (576×768 / 240×320),
 * replaces 100% of RGB channels via `source-in`, and adds a crisp studio rim-light + frosted sheen.
 */
export function SealedBeastSilhouette({
  src,
  level,
  memberId = 'richie',
  accentHex,
  className = '',
  compact = false,
}: {
  src: string
  level: number
  memberId?: 'richie' | 'renita'
  accentHex?: string
  className?: string
  compact?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // Native 2x Retina resolution matching 576×768 portrait sprites cleanly (never blurry)
  const width = compact ? 240 : 576
  const height = compact ? 320 : 768

  useEffect(() => {
    setStatus('loading')
    const canvas = canvasRef.current
    if (!canvas || typeof Image === 'undefined' || typeof document === 'undefined') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false
    ctx.clearRect(0, 0, width, height)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = width
        maskCanvas.height = height
        const maskCtx = maskCanvas.getContext('2d')

        const rimCanvas = document.createElement('canvas')
        rimCanvas.width = width
        rimCanvas.height = height
        const rimCtx = rimCanvas.getContext('2d')

        const scale = Math.min(
          (width * 0.88) / (img.naturalWidth || width),
          (height * 0.88) / (img.naturalHeight || height),
        )
        const drawW = (img.naturalWidth || width) * scale
        const drawH = (img.naturalHeight || height) * scale
        const dx = (width - drawW) / 2
        const dy = (height - drawH) / 2

        const isRenita = memberId === 'renita'
        const glowColor = accentHex || (isRenita ? 'rgba(244, 114, 182, 0.55)' : 'rgba(52, 211, 153, 0.5)')

        if (maskCtx && rimCtx) {
          // 1. Capture pure silhouette shape into offscreen mask (alpha only -> zero RGB leaks)
          maskCtx.drawImage(img, dx, dy, drawW, drawH)
          maskCtx.globalCompositeOperation = 'source-in'
          maskCtx.fillStyle = isRenita ? '#2b1630' : '#0f2723'
          maskCtx.fillRect(0, 0, width, height)
          maskCtx.globalCompositeOperation = 'source-over'

          // 2. Soft luminous outer contour glow against backdrop
          ctx.save()
          ctx.shadowColor = glowColor
          ctx.shadowBlur = compact ? 14 : 34
          ctx.drawImage(maskCanvas, 0, 0)
          ctx.restore()

          // 3. Sculpted obsidian-pearl interior gradient clipped cleanly to alpha
          ctx.save()
          ctx.globalCompositeOperation = 'source-in'
          const bodyGrad = ctx.createLinearGradient(0, dy, width * 0.85, dy + drawH)
          if (isRenita) {
            bodyGrad.addColorStop(0, '#4a254d')
            bodyGrad.addColorStop(0.45, '#2b1632')
            bodyGrad.addColorStop(1, '#1a0e21')
          } else {
            bodyGrad.addColorStop(0, '#1e4a41')
            bodyGrad.addColorStop(0.45, '#112d28')
            bodyGrad.addColorStop(1, '#091b18')
          }
          ctx.fillStyle = bodyGrad
          ctx.fillRect(0, 0, width, height)

          // Soft internal frosted pearl highlight along upper torso/head
          const sheenGrad = ctx.createRadialGradient(
            width * 0.42,
            height * 0.28,
            width * 0.04,
            width * 0.5,
            height * 0.48,
            width * 0.55,
          )
          sheenGrad.addColorStop(0, isRenita ? 'rgba(255, 228, 242, 0.28)' : 'rgba(209, 250, 229, 0.25)')
          sheenGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.05)')
          sheenGrad.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
          ctx.fillStyle = sheenGrad
          ctx.fillRect(0, 0, width, height)

          // 4. Razor-sharp edge rim highlight computed purely from shifted alpha difference
          const shift = compact ? 2.5 : 4.5
          rimCtx.drawImage(maskCanvas, 0, 0)
          rimCtx.globalCompositeOperation = 'destination-out'
          rimCtx.drawImage(maskCanvas, shift, shift)
          rimCtx.globalCompositeOperation = 'source-in'
          rimCtx.fillStyle = isRenita ? 'rgba(255, 228, 242, 0.72)' : 'rgba(167, 243, 208, 0.68)'
          rimCtx.fillRect(0, 0, width, height)

          ctx.globalCompositeOperation = 'source-atop'
          ctx.drawImage(rimCanvas, 0, 0)
          ctx.restore()
        } else {
          ctx.drawImage(img, dx, dy, drawW, drawH)
          ctx.globalCompositeOperation = 'source-in'
          const grad = ctx.createLinearGradient(0, 0, 0, height)
          grad.addColorStop(0, isRenita ? '#3c1e41' : '#163b35')
          grad.addColorStop(1, isRenita ? '#1c0f22' : '#0a1c19')
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, width, height)
          ctx.globalCompositeOperation = 'source-over'
        }
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
  }, [src, width, height, memberId, accentHex, compact])

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
          <svg width={compact ? 22 : 34} height={compact ? 22 : 34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10.5" width="14" height="10" rx="2.4" />
            <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
          </svg>
        </div>
      )}
    </div>
  )
}
