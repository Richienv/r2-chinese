import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { getBeastForMember, getTrainerAssetSrc, type LegendaryBeastTier } from '../lib/beastEngine'
import { playBeastRevealSound, playBeastTapChime } from '../lib/beastSound'
import { type BeastStageMeta } from '../lib/beastStages'
import { useCoupleProfile } from '../lib/coupleProfile'
import { studyMusicPlayer } from '../lib/studyMusic'
import { SealedBeastSilhouette } from './SealedBeastSilhouette'
import '../styles/beast-reveal.css'

export interface BeastRevealPayload {
  beast: LegendaryBeastTier
  stage: BeastStageMeta
  reason: 'evolution' | 'card' | 'replay'
  headline?: string
  spiritPower: number
  nextTargetXp?: number
}

const SPARKS = Array.from({ length: 34 }, (_, idx) => {
  const angle = (idx / 34) * Math.PI * 2 + (idx % 3) * 0.12
  const dist = 110 + (idx % 6) * 32
  const palette = ['#fde047', '#f472b6', '#34d399', '#38bdf8', '#fb923c', '#ffffff']
  return {
    id: idx,
    tx: `${Math.round(Math.cos(angle) * dist)}px`,
    ty: `${Math.round(Math.sin(angle) * dist)}px`,
    rot: `${(idx * 47) % 360}deg`,
    color: palette[idx % palette.length],
    petal: idx % 3 === 0,
  }
})

export function BeastRevealOverlay({
  payload,
  muted,
  onToggleMute,
  onClose,
}: {
  payload: BeastRevealPayload | null
  muted: boolean
  onToggleMute: () => void
  onClose: () => void
}) {
  const { activeId } = useCoupleProfile()
  const [phase, setPhase] = useState<'charging' | 'burst' | 'revealed'>('charging')
  const [quoteIdx, setQuoteIdx] = useState(0)
  const [showQuote, setShowQuote] = useState(false)
  const [runSeed, setRunSeed] = useState(0)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 35 })
  const stopAudioRef = useRef<(() => void) | null>(null)

  const replay = useCallback(() => {
    setShowQuote(false)
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 35 })
    setRunSeed((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!payload) return
    setPhase('charging')
    setShowQuote(false)
    setQuoteIdx(0)
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 35 })

    // Duck study music smoothly while reveal fanfare plays so SFX + celebration shine clearly
    const music = studyMusicPlayer()
    music.duckSource('reveal', true)

    stopAudioRef.current?.()
    if (!muted) {
      stopAudioRef.current = playBeastRevealSound(payload.stage.rarity)
    }

    const burstTimer = window.setTimeout(() => setPhase('burst'), 1240)
    const revealTimer = window.setTimeout(() => setPhase('revealed'), 2000)
    const releaseDuckTimer = window.setTimeout(() => {
      music.duckSource('reveal', false)
    }, 3600)

    return () => {
      window.clearTimeout(burstTimer)
      window.clearTimeout(revealTimer)
      window.clearTimeout(releaseDuckTimer)
      music.duckSource('reveal', false)
      stopAudioRef.current?.()
      stopAudioRef.current = null
    }
  }, [payload, runSeed, muted])

  useEffect(() => {
    if (!payload) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [payload, onClose])

  const cardStyle = useMemo(() => {
    if (!payload) return undefined
    return {
      '--card-foil': payload.stage.foilGradient,
      '--card-bg': payload.stage.previewGradient,
      '--reveal-accent': payload.beast.accentHex,
      '--tilt-x': `${tilt.rx.toFixed(2)}deg`,
      '--tilt-y': `${tilt.ry.toFixed(2)}deg`,
      '--glare-x': `${tilt.gx.toFixed(1)}%`,
      '--glare-y': `${tilt.gy.toFixed(1)}%`,
    } as CSSProperties
  }, [payload, tilt])

  const handleCardPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (phase === 'charging') return
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    setTilt({
      rx: (0.5 - py) * 14,
      ry: (px - 0.5) * 16,
      gx: px * 100,
      gy: py * 100,
    })
  }

  const handleCardPointerLeave = () => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 35 })
  }

  if (!payload) return null

  const { beast: rawBeast, stage, reason, headline, spiritPower, nextTargetXp } = payload
  const beast = getBeastForMember(rawBeast, activeId)
  const spriteSrc = getTrainerAssetSrc(beast, activeId)
  const bannerText =
    headline ||
    (reason === 'evolution'
      ? '✨ SELAMAT! WUJUD BARU TERBUKA!'
      : reason === 'card'
        ? '✨ KARTU KOLEKTOR TERBUKA!'
        : '✨ KARTU KOLEKSI LEGENDA')

  return (
    <div
      className={`lr-overlay phase-${phase}`}
      data-member={activeId}
      role="dialog"
      aria-modal="true"
      aria-label={`${beast.zhName} ${beast.name}`}
      style={cardStyle}
    >
      <div className="lr-flash" aria-hidden="true" />
      <div className="lr-godrays" aria-hidden="true" />
      <div className="lr-shockwave wave-1" aria-hidden="true" />
      <div className="lr-shockwave wave-2" aria-hidden="true" />
      <div className="lr-sparks" aria-hidden="true">
        {SPARKS.map((sp) => (
          <span
            key={sp.id}
            className={`lr-spark${sp.petal ? ' is-petal' : ''}`}
            style={
              {
                '--tx': sp.tx,
                '--ty': sp.ty,
                '--spark-rot': sp.rot,
                '--spark-color': sp.color,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="lr-stage-shell">
        <div className="lr-topbar">
          <span className="lr-top-tag">{bannerText}</span>
          <button type="button" className="lr-close-x" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        {phase === 'charging' ? (
          <div className="lr-charge-scene">
            <div className="lr-mystery-card">
              <div className="lr-mystery-holo" aria-hidden="true" />
              <div className="lr-orbit-ring" aria-hidden="true" />
              <div className="lr-orbit-ring inner" aria-hidden="true" />
              <div className="lr-mystery-silhouette">
                <SealedBeastSilhouette
                  src={spriteSrc}
                  level={beast.level}
                  memberId={activeId}
                  accentHex={beast.accentHex}
                  animateFloat
                />
              </div>
              <div className="lr-mystery-footer">SIAPKAN KARTU BARU · LV {beast.level}</div>
            </div>
            <p className="lr-charge-label">Menghimpun Energi Evolusi…</p>
          </div>
        ) : (
          <div
            className="lr-card-perspective"
            onPointerMove={handleCardPointerMove}
            onPointerLeave={handleCardPointerLeave}
          >
            <article className="lr-card" data-foil={stage.foilStyle}>
              <div className="lr-card-inner">
                <div className="lr-card-texture" aria-hidden="true" />
                <div className="lr-holo-sweep" aria-hidden="true" />
                <div className="lr-card-glare" aria-hidden="true" />

                <div className="lr-card-header">
                  <div className="lr-card-lvl">
                    <span className="lr-rarity-pill">
                      LV {beast.level} · {beast.stageLabel.toUpperCase()}
                      {reason === 'evolution' ? ' · BARU!' : ''}
                    </span>
                  </div>
                  <span className="lr-power-chip">{spiritPower.toLocaleString('id-ID')} XP</span>
                </div>

                <div
                  className="lr-beast-frame"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!muted) playBeastTapChime()
                    setShowQuote(true)
                    setQuoteIdx((n) => (n + 1) % beast.quotes.length)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!muted) playBeastTapChime()
                      setShowQuote(true)
                      setQuoteIdx((n) => (n + 1) % beast.quotes.length)
                    }
                  }}
                  aria-label={`Sentuh ${beast.name}`}
                >
                  <div className="lr-pedestal-glow" aria-hidden="true" />
                  <img className="lr-beast-art" src={spriteSrc} alt={`${beast.zhName} ${beast.name}`} />
                </div>

                {showQuote && <div className="lr-quote-pop">{beast.quotes[quoteIdx]}</div>}

                <div className="lr-nameplate">
                  <div className="lr-zh-title" lang="zh-CN">
                    {beast.zhName}
                  </div>
                  <div className="lr-sub-title">
                    {beast.pinyin} · {beast.name}
                  </div>
                  <div className="lr-meta-row">
                    <span className="lr-stage-chip">{stage.cardCode} {beast.element}</span>
                    <span>{beast.trainerTitle}</span>
                  </div>
                  <p className="lr-lore">
                    {beast.trainerOutfit} · {beast.trainerAccessory}.
                  </p>
                  {typeof nextTargetXp === 'number' && (
                    <div className="lr-next-goal">
                      {nextTargetXp > 0
                        ? `Target selanjutnya: butuh ${nextTargetXp.toLocaleString('id-ID')} XP lagi menuju Lv ${beast.level + 1}`
                        : 'Seluruh 24 evolusi Legenda telah terbuka penuh!'}
                    </div>
                  )}
                </div>
              </div>
            </article>
          </div>
        )}

        <div className="lr-actions">
          <button type="button" className="lr-btn-secondary" onClick={replay}>
            Putar Ulang
          </button>
          <button type="button" className="lr-btn-secondary" onClick={onToggleMute}>
            {muted ? 'Suara Bisu' : 'Suara Aktif'}
          </button>
          <button type="button" className="lr-btn-primary" onClick={onClose}>
            Keren! Lanjut Belajar →
          </button>
        </div>
      </div>
    </div>
  )
}
