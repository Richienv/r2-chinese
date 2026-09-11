import { useEffect, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'
import { PencilIcon, PlayIcon, RefreshIcon } from './Icons'

const CONFIG = {
  showOutline: true,
  showCharacter: true,
  strokeColor: '#26262B',
  outlineColor: '#E7E1DA',
  radicalColor: '#FA5A3C',
  drawingColor: '#FA5A3C',
  highlightColor: '#FFB13C',
  strokeAnimationSpeed: 1.15,
  delayBetweenStrokes: 170,
  drawingWidth: 30,
}

/** Live stroke-order practice. Stroke data is fetched from the hanzi-writer CDN. */
export function Writer({ char, onComplete }: { char: string; onComplete?: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const writer = useRef<ReturnType<typeof HanziWriter.create> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    el.innerHTML = ''
    setFailed(false)
    const size = 230
    const instance = HanziWriter.create(el, char, {
      width: size,
      height: size,
      padding: 18,
      ...CONFIG,
      onLoadCharDataError: () => setFailed(true),
    })
    writer.current = instance
    return () => {
      writer.current = null
      el.innerHTML = ''
    }
  }, [char])

  return (
    <div>
      <div className="writer">
        <div ref={host} />
        {failed && (
          <div
            className="zh"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: 120,
              color: '#26262B',
            }}
          >
            {char}
          </div>
        )}
      </div>

      {failed && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
          Stroke data unavailable offline — showing the character instead.
        </p>
      )}

      <div className="row" style={{ marginTop: 16, justifyContent: 'center' }}>
        <button
          className="btn"
          style={{ width: 'auto', padding: '0 22px', height: 46 }}
          disabled={failed}
          onClick={() => writer.current?.animateCharacter()}
        >
          <PlayIcon size={15} /> Animate
        </button>
        <button
          className="btn btn-dark"
          style={{ width: 'auto', padding: '0 22px', height: 46 }}
          disabled={failed}
          onClick={() =>
            writer.current?.quiz({
              onComplete: () => onComplete?.(),
            })
          }
        >
          <PencilIcon size={16} /> Practice
        </button>
        <button
          className="icon-round"
          style={{ width: 46, height: 46 }}
          aria-label="Reset"
          disabled={failed}
          onClick={() => {
            writer.current?.cancelQuiz()
            writer.current?.hideCharacter()
            writer.current?.showCharacter()
          }}
        >
          <RefreshIcon />
        </button>
      </div>
    </div>
  )
}
