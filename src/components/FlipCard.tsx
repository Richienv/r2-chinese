import { speak } from '../lib/speech'
import type { Vocab } from '../lib/types'
import { SpeakerIcon } from './Icons'

/**
 * Front shows the hanzi only; tapping flips to pinyin + meaning. The 3D subtree
 * swallows pointer events, so a flat catcher sits above it to take the tap.
 */
export function FlipCard({
  word,
  flipped,
  onFlip,
  footer,
}: {
  word: Vocab
  flipped: boolean
  onFlip: () => void
  footer?: React.ReactNode
}) {
  return (
    <div className="flip" data-flipped={flipped}>
      <div className="flip-inner">
        <div className="face face-front" aria-hidden={flipped}>
          <div className="big-hz" lang="zh-CN">
            {word.zh}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 8 }}>Tap to reveal</div>
        </div>
        <div className="face face-back metal" aria-hidden={!flipped}>
          <div className="big-hz on-red" lang="zh-CN">
            {word.zh}
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--gold)' }}>{word.pinyin}</div>
          {word.pos && (
            <div style={{ fontSize: 12, color: 'var(--on-red-3)', fontWeight: 700 }}>{word.pos}</div>
          )}
          <div
            className="on-red"
            style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4, maxWidth: 300 }}
          >
            {word.en}
          </div>
        </div>
      </div>

      <button
        className="tap-catch"
        aria-label={flipped ? 'Hide meaning' : 'Reveal meaning'}
        onClick={onFlip}
      />

      {/* Speaker on both faces so a learner can hear the word before flipping. */}
      <button
        className="icon-round tap44"
        style={{
          position: 'absolute',
          right: 14,
          top: 14,
          zIndex: 6,
          color: flipped ? undefined : 'var(--muted)',
          background: flipped ? undefined : 'var(--surface)',
        }}
        aria-label="Hear pronunciation"
        onClick={(e) => {
          e.stopPropagation()
          speak(word.zh)
        }}
      >
        <SpeakerIcon />
      </button>

      {flipped && footer && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, zIndex: 6 }}>{footer}</div>
      )}
    </div>
  )
}
