import { useMemo, useState } from 'react'
import { exampleFor, segment } from '../lib/content'
import { speak } from '../lib/speech'
import type { TextLine, Vocab } from '../lib/types'
import { DrillFlow } from '../screens/Drill'
import { BoltIcon, PencilIcon, SpeakerIcon } from './Icons'
import { SaveStar } from './SaveStar'
import { Sheet } from './Sheet'

/** A run of Chinese where every known word is tappable for a gloss. */
export function Glossed({ text, onWord }: { text: string; onWord: (v: Vocab) => void }) {
  const tokens = useMemo(() => segment(text), [text])
  return (
    <>
      {tokens.map((t, i) =>
        t.vocab ? (
          <span
            key={i}
            className="word"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onWord(t.vocab!)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onWord(t.vocab!)
              }
            }}
          >
            {t.text}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
    </>
  )
}

export function GlossSheet({
  word,
  onClose,
  onDrill,
  onStrokes,
}: {
  word: Vocab
  onClose: () => void
  onDrill?: (zh: string) => void
  onStrokes?: (char: string) => void
}) {
  const example = exampleFor(word.zh)
  return (
    <Sheet onClose={onClose}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="zh" style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.1 }} lang="zh-CN">
            {word.zh}
          </div>
          <div style={{ color: 'var(--warm-hot)', fontWeight: 800, fontSize: 17, marginTop: 4 }}>
            {word.pinyin}
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <SaveStar zh={word.zh} size={22} />
          <button
            className="icon-round tap44"
            onClick={() => speak(word.zh)}
            aria-label="Hear pronunciation"
          >
            <SpeakerIcon />
          </button>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {word.pos && <span className="pill-ink">{word.pos}</span>}
      </div>
      <p style={{ fontSize: 16, lineHeight: 1.5, marginTop: 12, marginBottom: 0 }}>{word.en}</p>
      {word.note && (
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8 }}>
          {word.note}
        </p>
      )}

      {example && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--line-3)',
          }}
        >
          <div className="kicker-ink" style={{ marginBottom: 6 }}>
            From the book
          </div>
          <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
            <div className="zh" style={{ fontSize: 16, lineHeight: 1.7, flex: 1 }} lang="zh-CN">
              {example.zh}
            </div>
            <button
              className="icon-round tap44"
              onClick={() => speak(example.zh)}
              aria-label="Play example"
            >
              <SpeakerIcon size={16} />
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{example.en}</div>
        </div>
      )}

      <div className="row" style={{ marginTop: 18, gap: 10 }}>
        {onDrill && (
          <button className="btn" onClick={() => onDrill(word.zh)}>
            <BoltIcon size={18} /> Drill this
          </button>
        )}
        {onStrokes && (
          <button
            className="btn btn-dark"
            style={onDrill ? { width: 'auto', padding: '0 20px', flex: 'none' } : undefined}
            onClick={() => onStrokes(word.zh[0])}
            aria-label="Practise strokes"
          >
            <PencilIcon size={18} />
          </button>
        )}
      </div>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={onClose}>
        Close
      </button>
    </Sheet>
  )
}

/**
 * One line of a dialogue or passage. Tapping the bubble speaks it; tapping a
 * word inside opens its gloss.
 */
export function Line({
  line,
  self,
  showPinyin,
  showEnglish,
  onWord,
}: {
  line: TextLine
  self: boolean
  showPinyin: boolean
  showEnglish: boolean
  onWord: (v: Vocab) => void
}) {
  return (
    <div className="line" data-self={self}>
      {line.speaker && <div className="speaker">{line.speaker.slice(0, 1)}</div>}
      <div
        className="bubble"
        role="button"
        tabIndex={0}
        onClick={() => speak(line.zh)}
        onKeyDown={(e) => e.key === 'Enter' && speak(line.zh)}
      >
        <div className="hz">
          <Glossed text={line.zh} onWord={onWord} />
        </div>
        {showPinyin && <div className="py">{line.pinyin}</div>}
        {showEnglish && <div className="en">{line.en}</div>}
      </div>
    </div>
  )
}

/**
 * Wraps gloss-on-tap for any screen. The returned node renders both the gloss
 * sheet and, stacked above it, a one-word rapid drill — so a learner can go
 * from reading a line to drilling a word without leaving the screen.
 */
export function useGloss(onStrokes?: (char: string) => void) {
  const [word, setWord] = useState<Vocab | null>(null)
  const [drill, setDrill] = useState<string | null>(null)
  const sheet = (
    <>
      {word && (
        <GlossSheet
          word={word}
          onClose={() => setWord(null)}
          onDrill={(zh) => {
            setWord(null)
            setDrill(zh)
          }}
          onStrokes={
            onStrokes
              ? (char) => {
                  setWord(null)
                  onStrokes(char)
                }
              : undefined
          }
        />
      )}
      {drill && (
        <DrillFlow words={[drill]} title={`Drill ${drill}`} onClose={() => setDrill(null)} />
      )}
    </>
  )
  return { onWord: setWord, sheet }
}
