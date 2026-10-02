import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { courseVocab, exampleFor, lessonOf, lookup, segmentForGloss, unknownVocab, type Example } from '../lib/content'
import { bundledDictionaryEntry, refreshDictionaryEntry, type DictionaryEntry } from '../lib/dictionary'
import { DICTIONARY_LICENSE, DICTIONARY_SOURCE, formatDictionaryDefinition } from '../lib/dictionary-format'
import { mixWithSaved } from '../lib/drill'
import { speak, speakLines, stopSpeech, unlockSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import type { LessonText, TextLine, Vocab } from '../lib/types'
import { LINE_RATE, VOICE, WORD_RATE, voiceForSpeaker } from '../lib/voices'
import { DrillFlow } from '../screens/Drill'
import { ChineseHear, HearButton, useSpeechActive } from './Hear'
import { BoltIcon, PencilIcon } from './Icons'
import { SaveStar } from './SaveStar'
import { Sheet } from './Sheet'

const HANZI_ONLY = /^[\u3400-\u9fff\uf900-\ufaff]+$/

/** Book sentence with 汉字 + pinyin + English always visible. Never invent. */
export function BookExample({
  example,
  style,
  tone = 'card',
  autoplay = false,
  onWord,
  glossable = true,
  showPinyin,
  showEnglish,
}: {
  example: Example
  style?: CSSProperties
  /** `quiet` sits on the metal teach card as a caption. `card` is paper, still caption-weight. */
  tone?: 'card' | 'quiet'
  /** When true, speak the line on mount. Keep false under GlossSheet / FlipCard word autoplay. */
  autoplay?: boolean
  onWord?: (v: Vocab) => void
  /** When false, keep plain text (nested gloss inside an open sheet). */
  glossable?: boolean
  showPinyin?: boolean
  showEnglish?: boolean
}) {
  const { prefs } = useStore()
  const gloss = useGloss()
  const handle = onWord ?? (glossable ? gloss.onWord : undefined)
  const zhNode = handle ? <Glossed text={example.zh} onWord={handle} /> : example.zh

  if (tone === 'quiet') {
    return (
      <div className="teach-example" style={style}>
        <div className="teach-example-zh zh" lang="zh-CN">
          {zhNode}
        </div>
        {(showPinyin ?? prefs.showPinyin) && <div className="teach-example-py">{example.pinyin}</div>}
        {(showEnglish ?? prefs.showEnglish) && <div className="teach-example-en">{example.en}</div>}
        <div style={{ marginTop: 10 }}>
          <ChineseHear text={example.zh} autoplay={autoplay} label="Hear the line" rate={LINE_RATE} tone="on-red" />
        </div>
        {glossable && !onWord && gloss.sheet}
      </div>
    )
  }

  return (
    <div className="card pop book-example" style={style}>
      <div className="kicker-ink">From the book</div>
      <div className="book-example-zh zh" lang="zh-CN">
        {zhNode}
      </div>
      {(showPinyin ?? prefs.showPinyin) && <div className="book-example-py">{example.pinyin}</div>}
      {(showEnglish ?? prefs.showEnglish) && <div className="book-example-en">{example.en}</div>}
      <div style={{ marginTop: 12 }}>
        <ChineseHear text={example.zh} autoplay={autoplay} label="Hear the line" rate={LINE_RATE} />
      </div>
      {glossable && !onWord && gloss.sheet}
    </div>
  )
}

/** A run of Chinese where known and unknown 汉字 are tappable for a gloss / add-to-drill. */
export function Glossed({ text, onWord, learnedWords, highlightLearned = true }: { text: string; onWord: (v: Vocab) => void; learnedWords?: string[]; highlightLearned?: boolean }) {
  const { learningTrail, mastery } = useStore()
  const tokens = useMemo(() => segmentForGloss(text), [text])
  const learned = useMemo(() => new Set(learnedWords ?? learningTrail), [learnedWords, learningTrail])
  return (
    <>
      {tokens.map((t, i) => {
        const vocab = t.vocab ?? (HANZI_ONLY.test(t.text) ? lookup(t.text) : undefined)
        const tappable = vocab || HANZI_ONLY.test(t.text)
        if (!tappable) return <span key={i}>{t.text}</span>
        const target = vocab ?? unknownVocab(t.text)
        return (
          <span
            key={i}
            className={vocab ? 'word' : 'word word-unknown'}
            data-learned={highlightLearned && learned.has(t.text)}
            data-mastery={mastery[t.text]?.state ?? 'learning'}
            role="button"
            aria-label={`Look up ${t.text}`}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              e.currentTarget.focus({ preventScroll: true })
              onWord(target)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onWord(target)
              }
            }}
          >
            {t.text}
          </span>
        )
      })}
    </>
  )
}

export function GlossSheet({ word, onClose, onDrill, onStrokes, onWord }: {
  word: Vocab
  onClose: () => void
  onDrill?: (zh: string) => void
  onStrokes?: (char: string) => void
  onWord?: (v: Vocab) => void
}) {
  const [resolved, setResolved] = useState(word)
  const [dictionary, setDictionary] = useState<DictionaryEntry | null>(null)
  const [parts, setParts] = useState<DictionaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState('')
  const currentWord = useRef(word.zh)
  currentWord.current = word.zh
  const display = resolved.zh === word.zh ? resolved : word
  const example = exampleFor(word.zh)
  const courseWord = courseVocab(word.zh)
  const fromCourse = Boolean(courseWord?.en?.trim())

  const applyEntry = useCallback((entry: DictionaryEntry) => {
    const next = { ...word, pinyin: courseWord?.pinyin || entry.pinyin, en: courseWord?.en || entry.en }
    setResolved(next)
    setDictionary(entry)
    setStatus('')
  }, [word, courseWord])

  useEffect(() => {
    let active = true
    setResolved(word)
    setDictionary(null)
    setParts([])
    setStatus('')
    setRefreshing(false)
    if (courseWord?.en?.trim() && courseWord.pinyin?.trim()) { setLoading(false); return }
    setLoading(true)
    let refreshed = false
    void bundledDictionaryEntry(word.zh).then(async (entry) => {
      if (!active) return
      if (entry && !refreshed) applyEntry(entry)
      if (!entry) {
        const found = await Promise.all(Array.from(word.zh).map((char) => bundledDictionaryEntry(char).catch(() => null)))
        if (active) setParts(found.filter((part): part is DictionaryEntry => Boolean(part)))
      }
    }).catch(() => { if (active) setStatus('Loading the online dictionary…') }).finally(() => { if (active) setLoading(false) })
    void refreshDictionaryEntry(word.zh).then((entry) => {
      if (!active) return
      if (entry) { refreshed = true; applyEntry(entry) }
    })
    return () => { active = false }
  }, [word, courseWord, applyEntry])

  useEffect(() => {
    const key = `${VOICE.xiaoxiao}|${WORD_RATE}|${word.zh}`
    void speak(word.zh, { voice: VOICE.xiaoxiao, rate: WORD_RATE, key })
    return () => stopSpeech()
  }, [word.zh])

  async function refresh() {
    if (refreshing) return
    const requestedWord = word.zh
    setRefreshing(true)
    const entry = await refreshDictionaryEntry(word.zh, true)
    if (currentWord.current !== requestedWord) return
    if (entry) applyEntry(entry)
    else setStatus(resolved.en ? 'Online refresh unavailable. The saved dictionary definition is still available.' : 'No exact CC-CEDICT headword returned. Explore its characters below or open the source dictionary.')
    setRefreshing(false)
  }

  return (
    <Sheet onClose={onClose} label={`Definition of ${word.zh}`}>
      <div className="teach-gloss dictionary-word-head">
        <div className="zh teach-gloss-hz" lang="zh-CN">{word.zh}</div>
        {display.pinyin && <div className="teach-gloss-py">{display.pinyin}</div>}
        {display.pos && <div className="teach-gloss-pos">{display.pos}</div>}
      </div>
      <div className="dictionary-word-actions">
        <HearButton text={word.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear the word" />
        <SaveStar zh={word.zh} size={22} />
      </div>
      {display.en ? dictionary && !fromCourse && dictionary.readings.length > 1 ? null : <p className="teach-gloss-en">{fromCourse ? display.en : formatDictionaryDefinition(display.en)}</p>
        : loading ? <div className="dictionary-loading" role="status">Finding the dictionary definition…</div>
          : <p className="dictionary-status">This exact phrase is not a CC-CEDICT headword. Its characters have their own definitions:</p>}
      {!display.en && parts.length > 0 && <div className="dictionary-readings">{parts.map((part, index) => <button key={`${part.zh}:${index}`} type="button" className="card" style={{ textAlign: 'left', padding: 12 }} onClick={() => onWord?.({ zh: part.zh, pinyin: part.pinyin, en: part.en, pos: '', note: '' })}><strong className="zh" lang="zh-CN">{part.zh}</strong><span>{part.pinyin}</span><p className="sub">{formatDictionaryDefinition(part.en)}</p></button>)}</div>}
      {display.note && <p className="sub" style={{ marginTop: 8, lineHeight: 1.6 }}>{display.note}</p>}
      {dictionary && !fromCourse && dictionary.readings.length > 1 && <ul className="dictionary-readings">{dictionary.readings.map((reading, index) => <li key={index}><strong>{reading.pinyin}</strong>{formatDictionaryDefinition(reading.definitions.join('; '))}</li>)}</ul>}
      <div className="dictionary-source">
        {fromCourse && <span>Course definition</span>}
        {(!fromCourse || dictionary) && <><a href={DICTIONARY_SOURCE} target="_blank" rel="noreferrer">CC-CEDICT · MDBG</a><a href={DICTIONARY_LICENSE} target="_blank" rel="noreferrer">CC BY-SA 4.0</a></>}
        {!fromCourse && <button type="button" disabled={refreshing} onClick={() => { void refresh() }}>{refreshing ? 'Refreshing…' : 'Refresh definition'}</button>}
      </div>
      {status && <p className="dictionary-status" role="status">{status}</p>}
      {example && <BookExample example={example} style={{ marginTop: 18 }} onWord={onWord} glossable={Boolean(onWord)} />}
      <div className="row" style={{ marginTop: 20, gap: 10 }}>
        {onDrill && <button className="btn" disabled={!display.en} onClick={() => onDrill(word.zh)}><BoltIcon size={18} /> Recall this word</button>}
        {onStrokes && <button className="btn btn-dark" style={onDrill ? { width: 'auto', padding: '0 20px', flex: 'none' } : undefined} onClick={() => onStrokes(word.zh[0])} aria-label="Practise strokes"><PencilIcon size={18} /></button>}
      </div>
      <p className="dictionary-status">Saved to your learning trail automatically. Star it only when you want a favourite.</p>
    </Sheet>
  )
}

/**
 * One line of a dialogue or passage. Tapping an underlined word opens its gloss.
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
  showPinyin?: boolean
  showEnglish?: boolean
  onWord: (v: Vocab) => void
}) {
  const { prefs } = useStore()
  const voice = voiceForSpeaker(line.speaker)
  const hearKey = `${voice}|${LINE_RATE}|${line.zh}`
  const playing = useSpeechActive(hearKey)
  return (
    <div className="line" data-self={self} data-speaking={playing}>
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
        {(showPinyin ?? prefs.showPinyin) && <div className="py">{line.pinyin}</div>}
        {(showEnglish ?? prefs.showEnglish) && <div className="en">{line.en}</div>}
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
 * sheet and a mixed drill. Drill this stars the word, then alternates it
 * with the other saved cards.
 */
export function useGloss(onStrokes?: (char: string) => void) {
  const store = useStore()
  const [word, setWord] = useState<Vocab | null>(null)
  const [drill, setDrill] = useState<string[] | null>(null)
  const onWord = useCallback((next: Vocab) => {
    store.encounterWord(next.zh, lessonOf(next.zh) ?? 0)
    setWord(next)
  }, [store.encounterWord])
  const sheet = (
    <>
      {word && (
        <GlossSheet
          word={word}
          onClose={() => setWord(null)}
          onWord={onWord}
          onDrill={(zh) => {
            store.encounterWord(zh, lessonOf(zh) ?? 0)
            setWord(null)
            setDrill(mixWithSaved(zh, store.starred))
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
        <DrillFlow
          words={drill}
          title={drill.length > 1 ? `Drill ${drill.length} saved` : `Drill ${drill[0]}`}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  )
  return { onWord, sheet }
}
