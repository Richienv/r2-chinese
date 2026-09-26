import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { exampleFor, segment, type Example } from '../lib/content'
import { speak, speakLines, stopSpeech, unlockSpeech } from '../lib/speech'
import type { LessonText, TextLine, Vocab } from '../lib/types'
import { LINE_RATE, VOICE, WORD_RATE, voiceForSpeaker } from '../lib/voices'
import { DrillFlow } from '../screens/Drill'
import { ChineseHear, HearButton, useSpeechActive } from './Hear'
import { BoltIcon, PencilIcon } from './Icons'
import { SaveStar } from './SaveStar'
import { Sheet } from './Sheet'

/** Book sentence with 汉字 + pinyin + English always visible. Never invent. */
export function BookExample({
  example,
  style,
  tone = 'card',
  autoplay = false,
}: {
  example: Example
  style?: CSSProperties
  /** `quiet` sits on the metal teach card as a caption. `card` is paper, still caption-weight. */
  tone?: 'card' | 'quiet'
  /** When true, speak the line on mount. Keep false under GlossSheet / FlipCard word autoplay. */
  autoplay?: boolean
}) {
  if (tone === 'quiet') {
    return (
      <div className="teach-example" style={style}>
        <div className="teach-example-zh zh" lang="zh-CN">
          {example.zh}
        </div>
        <div className="teach-example-py">{example.pinyin}</div>
        <div className="teach-example-en">{example.en}</div>
        <div style={{ marginTop: 10 }}>
          <ChineseHear text={example.zh} autoplay={autoplay} label="Hear the line" rate={LINE_RATE} tone="on-red" />
        </div>
      </div>
    )
  }

  return (
    <div className="card pop book-example" style={style}>
      <div className="kicker-ink">From the book</div>
      <div className="book-example-zh zh" lang="zh-CN">
        {example.zh}
      </div>
      <div className="book-example-py">{example.pinyin}</div>
      <div className="book-example-en">{example.en}</div>
      <div style={{ marginTop: 12 }}>
        <ChineseHear text={example.zh} autoplay={autoplay} label="Hear the line" rate={LINE_RATE} />
      </div>
    </div>
  )
}

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
  useEffect(() => {
    const key = `${VOICE.xiaoxiao}|${WORD_RATE}|${word.zh}`
    void speak(word.zh, { voice: VOICE.xiaoxiao, rate: WORD_RATE, key })
    return () => stopSpeech()
  }, [word.zh])
  return (
    <Sheet onClose={onClose}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div className="teach-gloss" style={{ minWidth: 0 }}>
          <div className="zh teach-gloss-hz" lang="zh-CN">
            {word.zh}
          </div>
          <div className="teach-gloss-py">{word.pinyin}</div>
          {word.pos ? <div className="teach-gloss-pos">{word.pos}</div> : null}
        </div>
        <SaveStar zh={word.zh} size={22} />
      </div>
      <div style={{ marginTop: 12 }}>
        <HearButton text={word.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear the word" />
      </div>
      <p className="teach-gloss-en">{word.en}</p>
      {word.note && (
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8 }}>
          {word.note}
        </p>
      )}

      {example && <BookExample example={example} style={{ marginTop: 16 }} />}

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
 * One line of a dialogue or passage. Tapping an underlined word opens its gloss.
 */
export function Line({
  line,
  self,
  showPinyin = true,
  showEnglish = true,
  onWord,
}: {
  line: TextLine
  self: boolean
  showPinyin?: boolean
  showEnglish?: boolean
  onWord: (v: Vocab) => void
}) {
  const voice = voiceForSpeaker(line.speaker)
  const hearKey = `${voice}|${LINE_RATE}|${line.zh}`
  const playing = useSpeechActive(hearKey)
  return (
    <div className="line" data-self={self}>
      <button
        type="button"
        className="speaker"
        data-on={playing}
        aria-label={line.speaker ? `Hear ${line.speaker}` : 'Hear this line'}
        onPointerDown={() => unlockSpeech()}
        onClick={(e) => {
          e.stopPropagation()
          if (playing) stopSpeech()
          else void speak(line.zh, { voice, rate: LINE_RATE, key: hearKey })
        }}
      >
        {line.speaker ? line.speaker.slice(0, 1) : '听'}
      </button>
      <div className="bubble">
        <div className="hz">
          <Glossed text={line.zh} onWord={onWord} />
        </div>
        {showPinyin && <div className="py">{line.pinyin}</div>}
        {showEnglish && <div className="en">{line.en}</div>}
      </div>
    </div>
  )
}

/** Plays a 课文 in order. Each speaker keeps their own neural voice. */
export function DialogueAudio({ text }: { text: LessonText }) {
  const group = `dialogue|${text.label}|${text.heading_zh}`
  const playing = useSpeechActive(group)
  const lines = text.lines.filter((line) => line.zh.trim())

  useEffect(() => {
    if (lines.length === 0) return
    void speakLines(
      lines.map((line) => ({
        text: line.zh,
        voice: voiceForSpeaker(line.speaker),
        rate: LINE_RATE,
      })),
      { group, key: group },
    )
    return () => stopSpeech()
    // Replay only when this 课文 changes, not when the line array identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group])

  return (
    <div className="dialogue-audio">
      <button
        type="button"
        className="hear hear-ink"
        data-on={playing}
        onPointerDown={() => unlockSpeech()}
        onClick={() => {
          if (playing) {
            stopSpeech()
            return
          }
          void speakLines(
            lines.map((line) => ({
              text: line.zh,
              voice: voiceForSpeaker(line.speaker),
              rate: LINE_RATE,
            })),
            { group, key: group },
          )
        }}
      >
        <span>{playing ? 'Stop' : text.type === 'dialogue' ? 'Play dialogue' : 'Play passage'}</span>
      </button>
      <p className="dialogue-audio-hint">Tap a name to hear that line.</p>
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
