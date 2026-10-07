import { useEffect, useMemo, useRef, useState } from 'react'
import { Glossed, useGloss } from '../components/ChineseText'
import { useSpeechSnapshot } from '../components/Hear'
import { CloseIcon } from '../components/Icons'
import { StudyDisplayControls } from '../components/StudyDisplayControls'
import { lessons } from '../lib/content'
import { t } from '../lib/i18n'
import { listeningScripts, nextListeningScript, type ListeningRepeat } from '../lib/hskPractice'
import { getSpeechSnapshot, prefetch, setSpeechEnabled, speakLines, stopSpeech, unlockSpeech } from '../lib/speech'
import { voiceForSpeaker } from '../lib/voices'
import { useStore } from '../store/store'
import '../styles/hsk-practice.css'

const allScripts = listeningScripts(lessons)

export function HskListening({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const { onWord, sheet } = useGloss()
  const speech = useSpeechSnapshot()
  const [lesson, setLesson] = useState(0)
  const [dialoguesOnly, setDialoguesOnly] = useState(false)
  const scripts = useMemo(() => allScripts.filter((script) => (!lesson || script.lesson === lesson) && (!dialoguesOnly || script.text.type === 'dialogue')), [lesson, dialoguesOnly])
  const [scriptId, setScriptId] = useState(allScripts[0].id)
  const index = Math.max(0, scripts.findIndex((script) => script.id === scriptId))
  const script = scripts[index]
  const [lineIndex, setLineIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [automatic, setAutomatic] = useState(true)
  const [repeat, setRepeat] = useState<ListeningRepeat>('all')
  const [rate, setRate] = useState(-6)
  const [error, setError] = useState('')
  const [finished, setFinished] = useState(false)
  const [follow, setFollow] = useState(true)
  const token = useRef(0)
  const lineNodes = useRef<Array<HTMLDivElement | null>>([])
  const scroll = useRef<HTMLDivElement>(null)
  const options = useRef({ automatic, repeat, rate })
  options.current = { automatic, repeat, rate }

  useEffect(() => () => { token.current += 1; stopSpeech() }, [])
  useEffect(() => {
    if (!store.prefs.soundOn && running) halt()
    // Sound can be disabled from another control; cancel the whole queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.prefs.soundOn])
  useEffect(() => {
    if (!running || !follow) return
    const node = lineNodes.current[lineIndex]
    const body = scroll.current
    if (!node || !body) return
    const rect = node.getBoundingClientRect()
    const container = body.getBoundingClientRect()
    if (rect.top < container.top + 12 || rect.bottom > container.bottom - 24) {
      body.scrollTo({ top: body.scrollTop + rect.top - container.top - 24, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [lineIndex, scriptId, running, follow])
  useEffect(() => {
    if (!running || !follow || speech.group !== script.id || speech.charIndex === null) return
    const word = lineNodes.current[lineIndex]?.querySelector<HTMLElement>('.word[data-speaking="true"]')
    const body = scroll.current
    if (!word || !body) return
    const rect = word.getBoundingClientRect()
    const bounds = body.getBoundingClientRect()
    const delta = rect.bottom > bounds.bottom - 28 ? rect.bottom - bounds.bottom + 28 : rect.top < bounds.top + 16 ? rect.top - bounds.top - 16 : 0
    if (delta) body.scrollTo({ top: body.scrollTop + delta, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [speech.charIndex, speech.group, script.id, lineIndex, running, follow])

  function halt() { token.current += 1; setRunning(false); stopSpeech() }
  async function playFrom(start: number, fromLine = 0) {
    if (!store.prefs.soundOn) { store.setPref('soundOn', true); setSpeechEnabled(true) }
    stopSpeech()
    const mine = ++token.current
    setError('')
    setFinished(false)
    setRunning(true)
    let cursor = start
    let firstLine = fromLine
    while (mine === token.current) {
      const current = scripts[cursor]
      if (!current) break
      setScriptId(current.id)
      setLineIndex(firstLine)
      const lines = current.text.lines.slice(firstLine)
      // Download the next phrase while the current one plays, not the entire
      // course. Every voice stays consistent with the book's speakers.
      lines.slice(0, 2).forEach((line) => prefetch(line.zh, { voice: voiceForSpeaker(line.speaker), rate: options.current.rate, trackWords: true }))
      const done = await speakLines(lines.map((line) => ({ text: line.zh, voice: voiceForSpeaker(line.speaker), rate: options.current.rate })), {
        group: current.id, trackWords: true,
        onLine: (line) => {
          if (mine !== token.current) return
          setLineIndex(firstLine + line)
          const next = lines[line + 1]
          if (next) prefetch(next.zh, { voice: voiceForSpeaker(next.speaker), rate: options.current.rate, trackWords: true })
        },
      })
      if (mine !== token.current) return
      if (!done) { setRunning(false); setError(getSpeechSnapshot().error ?? t('Playback stopped. Tap play to continue from this line.')); return }
      const next = nextListeningScript(cursor, scripts.length, options.current.automatic, options.current.repeat)
      if (next === null) { setRunning(false); setFinished(true); return }
      cursor = next
      firstLine = 0
    }
    if (mine === token.current) setRunning(false)
  }
  function selectScript(next: number) {
    const wasRunning = running
    halt()
    setScriptId(scripts[next].id)
    setLineIndex(0)
    setError('')
    setFinished(false)
    scroll.current?.scrollTo({ top: 0 })
    if (wasRunning) void playFrom(next)
  }
  function selectRange(value: number, dialogue = dialoguesOnly) {
    halt()
    const next = allScripts.filter((item) => (!value || item.lesson === value) && (!dialogue || item.text.type === 'dialogue'))
    setLesson(value)
    setDialoguesOnly(dialogue)
    setScriptId(next[0].id)
    setLineIndex(0)
    setFinished(false)
    setError('')
    scroll.current?.scrollTo({ top: 0 })
  }
  function changeRate(value: number) {
    options.current.rate = value
    setRate(value)
    if (running) void playFrom(index, lineIndex)
  }
  const loading = running && speech.status === 'loading'

  return <section className="overlay hsk-lab listening-room" role="dialog" aria-modal="true" aria-labelledby="listening-title">
    <header className="overlay-head hsk-lab-head">
      <button className="icon-btn" type="button" aria-label={t('Close listening room')} onClick={onClose}><CloseIcon size={20} /></button>
      <div><span>{t('HSK 4 · Lessons 1–5')}</span><h1 id="listening-title">{t('Listening room')}</h1></div>
      <div className="listening-wave" data-playing={running && !loading} aria-hidden="true"><i /><i /><i /><i /><i /></div>
    </header>
    <div className="overlay-body hsk-lab-body" ref={scroll}>
      <nav className="listening-range" aria-label={t('Listening lesson range')}>
        {[0, 1, 2, 3, 4, 5].map((value) => <button type="button" key={value} aria-pressed={value === lesson} onClick={() => selectRange(value)}>{value ? `L${value}` : t('All 5')}</button>)}
      </nav>
      <details className="listening-queue">
        <summary><span>{t('Choose a script')}</span><small>{index + 1} / {scripts.length}</small></summary>
        <button className="listening-type" type="button" aria-pressed={dialoguesOnly} onClick={() => selectRange(lesson, !dialoguesOnly)}>{dialoguesOnly ? t('Dialogues only') : t('Dialogues + passages')}</button>
        <div className="listening-queue-list">{scripts.map((item, i) => <button type="button" key={item.id} aria-current={item.id === script.id ? 'true' : undefined} onClick={() => selectScript(i)}><small>L{item.lesson} · {item.text.label}</small><span>{item.title}</span></button>)}</div>
      </details>
      <header className="listening-script-head"><span className="hsk-lab-eyebrow">{t('Lesson {lesson} · {label}', { lesson: script.lesson, label: script.text.label })}</span><h2>{script.text.heading_zh || script.lessonTitle}</h2>{store.prefs.showEnglish && <p>{script.title}</p>}</header>
      <div className="listening-script" lang="zh-CN">
        {script.text.lines.map((line, i) => <div className="listening-line" key={`${script.id}:${i}`} ref={(node) => { lineNodes.current[i] = node }} data-current={running && i === lineIndex} data-past={running && i < lineIndex}>
          <button className="listening-speaker" type="button" onPointerDown={unlockSpeech} onClick={() => { if (!store.prefs.soundOn) store.setPref('soundOn', true); void playFrom(index, i) }} aria-label={line.speaker ? t('Listen from line {n}, {speaker}', { n: i + 1, speaker: line.speaker }) : t('Listen from line {n}', { n: i + 1 })}><span>{line.speaker || `段 ${i + 1}`}</span><span aria-hidden="true">{running && i === lineIndex ? '●' : '▷'}</span></button>
          <p className="listening-zh"><Glossed text={line.zh} onWord={(word) => { halt(); onWord(word) }} highlightLearned={false} /></p>
          {store.prefs.showPinyin && <p className="listening-pinyin" lang="zh-Latn">{line.pinyin}</p>}
          {store.prefs.showEnglish && <p className="listening-english" lang="en">{line.en}</p>}
        </div>)}
      </div>
      {finished && <p className="listening-finished" role="status">{t('Script finished. Replay it, or choose another.')}</p>}
    </div>
    <footer className="overlay-foot listening-player">
      {error && <p className="hsk-lab-error" role="alert">{error}</p>}
      <div className="listening-transport">
        <button type="button" className="listening-skip" disabled={index === 0} aria-label={t('Previous script')} onPointerDown={unlockSpeech} onClick={() => selectScript(index - 1)}>‹</button>
        <button type="button" className="listening-play" aria-pressed={running} onPointerDown={unlockSpeech} onClick={() => {
          if (running) halt()
          else { if (!store.prefs.soundOn) store.setPref('soundOn', true); void playFrom(index, finished ? 0 : lineIndex) }
        }}><span aria-hidden="true">{running ? 'Ⅱ' : '▷'}</span>{running ? loading ? t('Loading · stop') : t('Pause') : finished ? t('Replay script') : lineIndex ? t('Resume listening') : t('Play scripts')}</button>
        <button type="button" className="listening-skip" disabled={index === scripts.length - 1} aria-label={t('Next script')} onPointerDown={unlockSpeech} onClick={() => selectScript(index + 1)}>›</button>
      </div>
      <div className="listening-settings">
        <button type="button" aria-pressed={automatic} onClick={() => { setAutomatic(!automatic); if (automatic && repeat === 'all') setRepeat('off') }}>{t('Auto-next')} <b>{automatic ? t('On') : t('Off')}</b></button>
        <label><span>{t('Loop')}</span><select aria-label={t('Listening loop')} value={repeat} onChange={(e) => { const value = e.target.value as ListeningRepeat; setRepeat(value); if (value === 'all') setAutomatic(true) }}><option value="all">{t('All scripts')}</option><option value="script">{t('This script')}</option><option value="off">{t('Off')}</option></select></label>
        <label><span>{t('Speed')}</span><select aria-label={t('Listening speed')} value={rate} onChange={(e) => changeRate(Number(e.target.value))}><option value={-6}>{t('Natural')}</option><option value={-22}>{t('Slower')}</option><option value={-38}>{t('Slowest')}</option></select></label>
      </div>
      <div className="listening-display"><StudyDisplayControls /><button className="listening-follow" type="button" aria-pressed={follow} onClick={() => setFollow(!follow)}>{follow ? t('Follow On') : t('Follow Off')}</button></div>
      {running && speech.status === 'playing' && speech.timing === 'line' && <small className="listening-timing-note">{t('This voice supports line focus; word timing is unavailable.')}</small>}
    </footer>
    {sheet}
  </section>
}
