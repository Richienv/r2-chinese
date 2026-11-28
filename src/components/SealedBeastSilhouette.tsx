import { useEffect, useRef, useState } from 'react'

/**
 * Razor-Sharp Sculpted Silhouette Renderer ("Who's That Pokémon?" style).
 * - ZERO fog orb or foreground circle covering any pixel of the body.
 * - Full Retina resolution (576×768 / 240×320), pure alpha extraction (`zero` RGB leaks).
 * - Deep velvety plum-slate (Renita) / deep emerald-obsidian (Richie) body with
 *   clean contour rim-light + subtle rear-only edge backlight (`destination-over`).
 */
export function SealedBeastSilhouette({
  src,
  level,
  memberId = 'richie',
  accentHex,
  className = '',
  compact = false,
  animateFloat = false,
}: {
  src: string
  level: number
  memberId?: 'richie' | 'renita'
  accentHex?: string
  className?: string
  compact?: boolean
  animateFloat?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

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
          (width * 0.9) / (img.naturalWidth || width),
          (height * 0.9) / (img.naturalHeight || height),
        )
        const drawW = (img.naturalWidth || width) * scale
        const drawH = (img.naturalHeight || height) * scale
        const dx = (width - drawW) / 2
        const dy = (height - drawH) / 2

        const isRenita = memberId === 'renita'
        const glowColor = accentHex || (isRenita ? 'rgba(244, 114, 182, 0.5)' : 'rgba(16, 185, 129, 0.45)')

        if (maskCtx && rimCtx) {
          // 1. Extract 100% pure alpha mask into offscreen buffer (zero RGB channels leaked)
          maskCtx.drawImage(img, dx, dy, drawW, drawH)
          maskCtx.globalCompositeOperation = 'source-in'
          maskCtx.fillStyle = isRenita ? '#25102d' : '#0b221e'
          maskCtx.fillRect(0, 0, width, height)
          maskCtx.globalCompositeOperation = 'source-over'

          // 2. Razor-sharp base silhouette clipped cleanly to mask
          ctx.drawImage(maskCanvas, 0, 0)
          ctx.globalCompositeOperation = 'source-in'
          const bodyGrad = ctx.createLinearGradient(0, dy, width * 0.75, dy + drawH)
          if (isRenita) {
            bodyGrad.addColorStop(0, '#3a1a46')
            bodyGrad.addColorStop(0.5, '#25102f')
            bodyGrad.addColorStop(1, '#14081a')
          } else {
            bodyGrad.addColorStop(0, '#18443b')
            bodyGrad.addColorStop(0.5, '#0d2924')
            bodyGrad.addColorStop(1, '#061513')
          }
          ctx.fillStyle = bodyGrad
          ctx.fillRect(0, 0, width, height)

          // 3. Subtle sculpted top-left gloss strictly ON TOP of dark body (source-atop keeps silhouette crisp)
          ctx.globalCompositeOperation = 'source-atop'
          const sculptSheen = ctx.createLinearGradient(dx, dy, dx + drawW, dy + drawH * 0.7)
          sculptSheen.addColorStop(0, isRenita ? 'rgba(244, 114, 182, 0.16)' : 'rgba(52, 211, 153, 0.14)')
          sculptSheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.02)')
          sculptSheen.addColorStop(1, 'rgba(0, 0, 0, 0.14)')
          ctx.fillStyle = sculptSheen
          ctx.fillRect(0, 0, width, height)

          // 4. Crisp anti-aliased edge rim highlight via shifted alpha difference
          const shift = compact ? 2 : 3.8
          rimCtx.drawImage(maskCanvas, 0, 0)
          rimCtx.globalCompositeOperation = 'destination-out'
          rimCtx.drawImage(maskCanvas, shift, shift)
          rimCtx.globalCompositeOperation = 'source-in'
          rimCtx.fillStyle = isRenita ? 'rgba(255, 228, 242, 0.72)' : 'rgba(167, 243, 208, 0.68)'
          rimCtx.fillRect(0, 0, width, height)

          ctx.globalCompositeOperation = 'source-atop'
          ctx.drawImage(rimCanvas, 0, 0)

          // 5. Contour backlight ONLY behind silhouette edge (never covers interior body pixels)
          ctx.save()
          ctx.globalCompositeOperation = 'destination-over'
          ctx.shadowColor = glowColor
          ctx.shadowBlur = compact ? 8 : 18
          ctx.drawImage(maskCanvas, 0, 0)
          ctx.restore()

          ctx.globalCompositeOperation = 'source-over'
        } else {
          ctx.drawImage(img, dx, dy, drawW, drawH)
          ctx.globalCompositeOperation = 'source-in'
          const grad = ctx.createLinearGradient(0, 0, 0, height)
          grad.addColorStop(0, isRenita ? '#34173e' : '#12342e')
          grad.addColorStop(1, isRenita ? '#15081b' : '#081815')
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
    }
  }, [src, width, height, compact, memberId, accentHex])

  return (
    <div
      className={`sealed-silhouette-wrap${animateFloat ? ' is-floating' : ''} ${className}`.trim()}
      data-status={status}
      aria-label={`Siluet Rahasia Level ${level}`}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="sealed-silhouette-canvas"
      />
      {status !== 'ready' && (
        <div className="sealed-silhouette-mystery" aria-hidden="true">
          <svg
            width={compact ? 26 : 42}
            height={compact ? 26 : 42}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="10.5" width="14" height="10" rx="2.4" />
            <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
          </svg>
        </div>
      )}
    </div>
  )
}
