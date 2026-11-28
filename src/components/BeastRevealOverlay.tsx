import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getTrainerAssetSrc, type LegendaryBeastTier } from '../lib/beastEngine'
import { useCoupleProfile } from '../lib/coupleProfile'
import { playBeastRevealSound, playBeastTapChime } from '../lib/beastSound'
import { RARITY_TAG, type BeastStageMeta } from '../lib/beastStages'
import '../styles/beast-reveal.css'

export interface BeastRevealPayload {
  beast: LegendaryBeastTier
  stage: BeastStageMeta
  reason: 'evolution' | 'card' | 'replay'
  headline?: string
  spiritPower: number
}

const SPARKS = Array.from({ length: 28 }, (_, idx) => {
  const angle = (idx / 28) * Math.PI * 2 + (idx % 3) * 0.14
  const dist = 105 + (idx % 5) * 34
  const palette = ['#fde047', '#38bdf8', '#34d399', '#f472b6', '#fb923c']
  return {
    id: idx,
    tx: `${Math.round(Math.cos(angle) * dist)}px`,
    ty: `${Math.round(Math.sin(angle) * dist)}px`,
    color: palette[idx % palette.length],
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
  const stopAudioRef = useRef<(() => void) | null>(null)

  const replay = useCallback(() => {
    setShowQuote(false)
    setRunSeed((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!payload) return
    setPhase('charging')
    setShowQuote(false)
    setQuoteIdx(0)

    stopAudioRef.current?.()
    if (!muted) {
      stopAudioRef.current = playBeastRevealSound(payload.stage.rarity)
    }

    const burstTimer = window.setTimeout(() => setPhase('burst'), 1120)
    const revealTimer = window.setTimeout(() => setPhase('revealed'), 1480)

    return () => {
      window.clearTimeout(burstTimer)
      window.clearTimeout(revealTimer)
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
    } as CSSProperties
  }, [payload])

  if (!payload) return null

  const { beast, stage, reason, headline, spiritPower } = payload
  const spriteSrc = getTrainerAssetSrc(beast, activeId)
  const reasonLabel =
    reason === 'evolution'
      ? 'EVOLUSI SHENSHOU BARU'
      : reason === 'card'
        ? 'KARTU KOLEKTOR TERBUKA'
        : 'LEGENDARY SHOWCASE'

  return (
    <div
      className={`lr-overlay phase-${phase}`}
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
            className="lr-spark"
            style={
              {
                '--tx': sp.tx,
                '--ty': sp.ty,
                '--spark-color': sp.color,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="lr-stage-shell">
        <div className="lr-topbar">
          <span className="lr-top-tag">{headline || reasonLabel}</span>
          <button type="button" className="lr-close-x" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        {phase === 'charging' ? (
          <div className="lr-charge-scene">
            <div className="lr-orbit-ring" />
            <div className="lr-orbit-ring inner" />
            <img className="lr-silhouette" src={spriteSrc} alt="" />
            <p className="lr-charge-label">Menghimpun XP Evolusi…</p>
          </div>
        ) : (
          <article className="lr-card" data-foil={stage.foilStyle}>
            <div className="lr-card-inner">
              <div className="lr-card-texture" aria-hidden="true" />
              {stage.foilStyle === 'gold' && (
                <svg className="lr-gold-bolts" viewBox="0 0 320 420" preserveAspectRatio="none" aria-hidden="true">
                  <path
                    d="M28 48 L72 95 L56 105 L96 156 M292 78 L250 124 L268 134 L224 190 M36 330 L84 282 L70 272 L114 232"
                    fill="none"
                    stroke="#fef08a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

              <div className="lr-card-header">
                <div className="lr-card-lvl">
                  <span className="lr-rarity-pill">{RARITY_TAG[stage.rarity]}</span>
                  <span>Lv {beast.level}/24 · {beast.stageLabel} · {beast.element}</span>
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

              {showQuote && (
                <div className="lr-quote-pop">{beast.quotes[quoteIdx]}</div>
              )}

              <div className="lr-nameplate">
                <div className="lr-zh-title" lang="zh-CN">{beast.zhName}</div>
                <div className="lr-sub-title">{beast.pinyin} · {beast.name}</div>
                <div className="lr-meta-row">
                  <span className="lr-stage-chip">{stage.cardCode} {beast.stageLabel.toUpperCase()}</span>
                  <span>{beast.trainerTitle}</span>
                </div>
                <p className="lr-lore">
                  {beast.trainerOutfit} · {beast.trainerAccessory}. {beast.lore}
                </p>
              </div>
            </div>
          </article>
        )}

        <div className="lr-actions">
          <button type="button" className="lr-btn-secondary" onClick={replay}>
            Putar Ulang
          </button>
          <button type="button" className="lr-btn-secondary" onClick={onToggleMute}>
            {muted ? 'Suara Bisu' : 'Suara Aktif'}
          </button>
          <button type="button" className="lr-btn-primary" onClick={onClose}>
            Masuk Arena ›
          </button>
        </div>
      </div>
    </div>
  )
}
