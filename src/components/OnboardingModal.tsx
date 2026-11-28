import { useEffect, useState } from 'react'
import { LEGENDARY_BEASTS, getTrainerAssetSrc } from '../lib/beastEngine'
import { useCoupleProfile } from '../lib/coupleProfile'
import { getOnboardingSlides } from '../lib/onboarding'
import { playAdvance, playComplete } from '../lib/sfx'
import '../styles/onboarding.css'

export function OnboardingModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { activeId, member } = useCoupleProfile()
  const [slideIdx, setSlideIdx] = useState(0)

  useEffect(() => {
    if (open) setSlideIdx(0)
  }, [open, activeId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const slides = getOnboardingSlides(activeId, member.name)
  const slide = slides[Math.max(0, Math.min(slides.length - 1, slideIdx))]
  const isLast = slideIdx >= slides.length - 1
  const lv1Src = getTrainerAssetSrc(LEGENDARY_BEASTS[0], activeId)

  function handleNext() {
    if (isLast) {
      playComplete()
      onClose()
      return
    }
    playAdvance()
    setSlideIdx((n) => Math.min(slides.length - 1, n + 1))
  }

  return (
    <div
      className="ob-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Panduan Belajar ${member.name}`}
      onClick={onClose}
    >
      <div
        className="ob-card"
        data-member={activeId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ob-top">
          <span className="ob-kicker">{slide.kicker}</span>
          <button type="button" className="ob-skip" onClick={onClose}>
            Lewati ✕
          </button>
        </div>

        <div className="ob-hero">
          <img
            className="ob-avatar"
            src={lv1Src}
            alt={`${member.name} & Partner Lv 1`}
            onError={(e) => {
              e.currentTarget.src = '/beasts/v1/beast-02-qilin.webp'
            }}
          />
          <div className="ob-hero-copy">
            <span className="ob-icon-badge" aria-hidden="true">
              {slide.icon}
            </span>
            <h2>{slide.title}</h2>
          </div>
        </div>

        <p className="ob-body">{slide.body}</p>

        <ul className="ob-list">
          {slide.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="ob-dots" role="tablist" aria-label="Langkah panduan">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === slideIdx}
              aria-label={`Langkah ${i + 1} dari ${slides.length}`}
              className={`ob-dot${i === slideIdx ? ' is-active' : ''}`}
              onClick={() => setSlideIdx(i)}
            />
          ))}
        </div>

        <div className="ob-actions">
          {slideIdx > 0 && (
            <button
              type="button"
              className="ob-btn-back"
              onClick={() => setSlideIdx((n) => Math.max(0, n - 1))}
            >
              ‹ Kembali
            </button>
          )}
          <button type="button" className="ob-btn-next" onClick={handleNext}>
            {isLast ? 'Mulai Belajar! 🚀' : 'Lanjut ›'}
          </button>
        </div>
      </div>
    </div>
  )
}
