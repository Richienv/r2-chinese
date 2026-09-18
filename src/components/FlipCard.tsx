import type { ReactNode } from 'react'
import { exampleFor } from '../lib/content'
import type { Vocab } from '../lib/types'
import { BookExample } from './ChineseText'

function TeachFace({ word, compact = false }: { word: Vocab; compact?: boolean }) {
  if (compact) {
    return (
      <>
        <div className="big-hz on-red" lang="zh-CN">
          {word.zh}
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--gold)' }}>{word.pinyin}</div>
        {word.pos && (
          <div style={{ fontSize: 12, color: 'var(--on-red-3)', fontWeight: 700 }}>{word.pos}</div>
        )}
        <div className="on-red" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4, maxWidth: 300 }}>
          {word.en}
        </div>
      </>
    )
  }

  return (
    <div className="teach-hero">
      <div className="big-hz on-red teach-hz" lang="zh-CN">
        {word.zh}
      </div>
      <div className="teach-pinyin">{word.pinyin}</div>
      {word.pos ? <div className="teach-pos">{word.pos}</div> : null}
      <div className="teach-en">{word.en}</div>
    </div>
  )
}

/**
 * Teach beat: 汉字 → pinyin → English → book sentence, always on the card.
 * Flip stays available as a quiz beat (hanzi-only front → meaning back).
 */
export function FlipCard({
  word,
  flipped = false,
  onFlip,
  footer,
  teach = true,
}: {
  word: Vocab
  flipped?: boolean
  onFlip?: () => void
  footer?: ReactNode
  /** When true (default), do not hide pinyin / English / example behind a flip. */
  teach?: boolean
}) {
  const example = teach ? exampleFor(word.zh) : null

  if (teach) {
    return (
      <div className="flip teach-card" data-teach="true">
        <div className="face metal teach-face">
          <TeachFace word={word} />
          {example && <BookExample example={example} tone="quiet" />}
        </div>

        {footer && <div className="teach-foot">{footer}</div>}
      </div>
    )
  }

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
          <TeachFace word={word} compact />
        </div>
      </div>

      <button
        className="tap-catch"
        aria-label={flipped ? 'Hide meaning' : 'Reveal meaning'}
        onClick={onFlip}
      />

      {flipped && footer && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, zIndex: 6 }}>{footer}</div>
      )}
    </div>
  )
}
