import { type CSSProperties, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Glossed, useGloss } from '../components/ChineseText'
import { HearButton, useAutoSpeak, useSpeechActive } from '../components/Hear'
import { SaveStar } from '../components/SaveStar'
import { StrokeDataAttribution, StrokeWord } from '../components/StrokeWord'
import type { Example } from '../lib/content'
import { memoryTips } from '../lib/memoryTips'
import { useCourse } from '../lib/course'
import { teachingExamples } from '../lib/teachingExamples'
import { stopSpeech } from '../lib/speech'
import { splitHanzi, splitOnWord, TEACH_KICKER, TEACH_TITLE, type TeachPhase, type WordHook } from '../lib/teach'
import type { Vocab } from '../lib/types'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'
import { useStore } from '../store/store'
import '../styles/teach-motion.css'
import '../styles/study-tools.css'
import '../styles/teach-paced.css'

function StepHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="session-step-head">
      <div className="kicker-ink">{kicker}</div>
      <h2 className="session-step-title">{title}</h2>
    </header>
  )
}

export function TeachView({
  phase,
  word,
  example,
  hook,
  lesson,
  n,
  of,
}: {
  phase: TeachPhase
  word: Vocab
  example: Example | null
  hook: WordHook
  lesson: number
  n: number
  of: number
}) {
  const { onWord, sheet } = useGloss()
  const kicker = `Word · ${n} of ${of} · ${TEACH_KICKER[phase]}`
  return (
    <div className="teach-stage" data-phase={phase}>
      <StepHead kicker={kicker} title={TEACH_TITLE[phase]} />
      {phase === 'meet' && <MeetBeat word={word} lesson={lesson} />}
      {phase === 'hook' && <HookBeat key={`${lesson}:${word.zh}`} word={word} hook={hook} example={example} lesson={lesson} />}
      {phase === 'example' && <ExampleBeat word={word} example={example} onWord={onWord} />}
      {phase === 'seal' && <SealBeat word={word} />}
      {(phase === 'meet' || phase === 'seal') && <StrokeDataAttribution />}
      {sheet}
    </div>
  )
}

function MeetBeat({ word, lesson }: { word: Vocab; lesson: number }) {
  const glyphs = splitHanzi(word.zh)
  const { prefs } = useStore()
  useAutoSpeak(word.zh, VOICE.xiaoxiao, WORD_RATE)
  return (
    <div className="teach-meet metal">
      <StrokeWord text={word.zh} showAttribution={false} />
      {prefs.showPinyin && <p className="teach-meet-py teach-stagger-in" style={{ animationDelay: `${80 + glyphs.length * 110 + 80}ms` }}>
        {word.pinyin}
      </p>}
      {word.pos ? (
        <span className="teach-meet-pos teach-stagger-in" style={{ animationDelay: `${80 + glyphs.length * 110 + 180}ms` }}>
          {word.pos}
        </span>
      ) : null}
      {prefs.showEnglish && <p className="teach-meet-en teach-stagger-in" style={{ animationDelay: `${80 + glyphs.length * 110 + 260}ms` }}>
        {word.en}
      </p>}
      <div className="teach-meet-hear" style={{ animationDelay: `${80 + glyphs.length * 110 + 320}ms` }}>
        <HearButton text={word.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear the word" tone="on-red" />
      </div>
      <div className="teach-meet-save" style={{ animationDelay: `${80 + glyphs.length * 110 + 340}ms` }}>
        <span>Tracked automatically · star a favourite</span>
        <SaveStar zh={word.zh} lesson={lesson} size={22} onRed />
      </div>
    </div>
  )
}

function HookBeat({ word, hook, example, lesson }: { word: Vocab; hook: WordHook; example: Example | null; lesson: number }) {
  const titleId = useId()
  const momentId = useId()
  const [active, setActive] = useState(0)
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const [covered, setCovered] = useState(false)
  const [direction, setDirection] = useState(1)
  const [exampleIndex, setExampleIndex] = useState(0)
  const [momentOpen, setMomentOpen] = useState(false)
  const card = useRef<HTMLElement>(null)
  const depth = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLSpanElement>(null)
  const previousProgress = useRef(0)
  const tiltFrame = useRef(0)
  const tilt = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
  const moment = useRef<HTMLParagraphElement>(null)
  const { prefs } = useStore()
  const { course } = useCourse()
  const examples = useMemo(() => teachingExamples(course, lesson, word.zh, example), [course, lesson, word.zh, example])
  const usageExample = examples[exampleIndex] ?? example
  const tips = memoryTips(word, example)
  // Default coaching can include the complete source sentence. Put that same
  // sentence behind the explicit example reveal instead of printing it twice.
  const usageBody = example && hook.usage.includes(example.zh)
    ? hook.usage.replace(example.zh, '').trim().replace(/[:：]$/, '.')
    : hook.usage
  const insights = [{ title: 'How people use it', body: usageBody, cue: usageExample?.zh }, ...tips]
  const insight = insights[active]
  const open = !!revealed[active]
  const cloze = insight.title === 'Retrieve it inside the book line'
  const sound = insight.title === 'Link sound to the shape'
  const shape = insight.title === 'Give the shape a cue'
  const revisit = insight.title === 'Make it come back'
  const usage = active === 0
  const sourceLine = open ? cloze ? example : usage ? usageExample : null : null
  const cue = sourceLine ? sourceLine.zh : sound ? prefs.showPinyin ? insight.cue : word.zh : insight.cue
  const spokenText = open && (sourceLine || sound) ? sourceLine ? sourceLine.zh : word.zh : ''
  const playing = useSpeechActive(spokenText ? `${VOICE.xiaoxiao}|${sourceLine ? LINE_RATE : WORD_RATE}|${spokenText.trim()}` : '')

  useEffect(() => {
    const surface = card.current
    const animations: Animation[] = []
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!surface || motion.matches || typeof surface.animate !== 'function') return
    // The card arrives as a whole; the written cue settles piece by piece only
    // after a deliberate reveal. Nothing is revealed by an animation timer.
    animations.push(surface.animate([
      { opacity: .35, transform: `translateX(${direction * 26}px) translateY(8px) rotateY(${direction * -7}deg) scale(.975)`, offset: 0 },
      { opacity: 1, transform: `translateX(${direction * -3}px) translateY(-2px) rotateY(${direction}deg) scale(1.005)`, offset: .72 },
      { opacity: 1, transform: 'translateX(0) translateY(0) rotateY(0) scale(1)', offset: 1 },
    ], { duration: 520, easing: 'cubic-bezier(.2,.75,.25,1)' }))
    surface.querySelectorAll<HTMLElement>('[data-cue-piece]').forEach((piece, index) => {
      animations.push(piece.animate([
        { opacity: .15, transform: `translateY(${shape ? 22 : 10}px) rotate(${shape ? (index % 2 ? 5 : -5) : 0}deg) scale(.85)`, offset: 0 },
        { opacity: 1, transform: 'translateY(-2px) rotate(0) scale(1.03)', offset: .68 },
        { opacity: 1, transform: 'translateY(0) rotate(0) scale(1)', offset: 1 },
      ], { duration: shape ? 580 : 440, delay: Math.min(index * (shape ? 65 : 22), 650), easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' }))
    })
    surface.querySelectorAll<HTMLElement>('[data-cue-target="true"]').forEach((piece) => {
      animations.push(piece.animate([
        { textShadow: '0 0 0 transparent', backgroundColor: '#fff1df' },
        { textShadow: '0 0 14px rgba(218,146,51,.45)', backgroundColor: '#ffe1ad', offset: .4 },
        { textShadow: '0 0 0 transparent', backgroundColor: '#fff1df' },
      ], { duration: 1100, delay: 250, easing: 'ease-out' }))
    })
    const fill = progress.current
    if (fill) {
      const current = (active + 1) / insights.length
      animations.push(fill.animate([{ transform: `scaleX(${previousProgress.current})` }, { transform: `scaleX(${current})` }], { duration: 540, easing: 'cubic-bezier(.2,.75,.25,1)' }))
      previousProgress.current = current
    }
    const stopForReducedMotion = () => { if (motion.matches) animations.forEach((animation) => animation.cancel()) }
    motion.addEventListener('change', stopForReducedMotion)
    return () => {
      motion.removeEventListener('change', stopForReducedMotion)
      animations.forEach((animation) => animation.cancel())
    }
  }, [active, open, exampleIndex, prefs.showPinyin, prefs.showEnglish, direction, shape, insights.length])

  useEffect(() => () => window.cancelAnimationFrame(tiltFrame.current), [])

  useEffect(() => {
    const paragraph = moment.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!momentOpen || !paragraph || motion.matches || typeof paragraph.animate !== 'function') return
    const animation = paragraph.animate([{ opacity: .25, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 360, easing: 'ease-out' })
    const cancel = () => { if (motion.matches) animation.cancel() }
    motion.addEventListener('change', cancel)
    return () => { motion.removeEventListener('change', cancel); animation.cancel() }
  }, [momentOpen])

  function animateTilt() {
    const state = tilt.current
    state.x += (state.targetX - state.x) * .18
    state.y += (state.targetY - state.y) * .18
    depth.current?.style.setProperty('--paced-tilt-x', `${state.x.toFixed(3)}deg`)
    depth.current?.style.setProperty('--paced-tilt-y', `${state.y.toFixed(3)}deg`)
    if (Math.abs(state.targetX - state.x) + Math.abs(state.targetY - state.y) > .015) tiltFrame.current = window.requestAnimationFrame(animateTilt)
    else tiltFrame.current = 0
  }

  function moveDepth(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    tilt.current.targetX = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) * -2
    tilt.current.targetY = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)) * 3
    if (!tiltFrame.current) tiltFrame.current = window.requestAnimationFrame(animateTilt)
  }

  function resetDepth() {
    tilt.current.targetX = 0
    tilt.current.targetY = 0
    if (!tiltFrame.current) tiltFrame.current = window.requestAnimationFrame(animateTilt)
  }

  function selectInsight(next: number) {
    if (next === active) return
    setDirection(next > active ? 1 : -1)
    setActive(next)
    setCovered(false)
    resetDepth()
  }

  const labels: Record<string, string> = {
    'How people use it': 'Use', 'Give the shape a cue': 'Shape', 'Keep a useful pair': 'Pairs',
    'Catch the common mistake': 'Notice', 'Link sound to the shape': 'Sound',
    'Retrieve it inside the book line': 'Book line', 'Make it come back': 'Revisit',
    'Make a personal scene': 'Your scene', 'Give the word an image': 'Image',
    'Keep the sentence frame': 'Frame', 'Connect two meanings': 'Meaning', 'Recall the opposite': 'Opposite',
    'Give it a personal scene': 'Your scene', 'Separate two ideas': 'Compare',
    'Learn the whole bridge': 'Pattern', 'Make the two sides yours': 'Make it yours',
    'Give it a real person': 'Your scene', 'Ask a usable question': 'Ask',
  }

  return (
    <div className="teach-hook teach-memory teach-paced">
      <p className="teach-memory-word" data-speaking={playing} lang={covered ? undefined : 'zh-CN'}>{covered ? <span className="paced-covered">Word covered · recall it</span> : word.zh}</p>
      {!covered && prefs.showEnglish && <div className="paced-moment"><button type="button" className="paced-moment-trigger" aria-expanded={momentOpen} aria-controls={momentId} onClick={() => setMomentOpen((value) => !value)}>Picture the moment<span aria-hidden="true">{momentOpen ? '−' : '+'}</span></button>{momentOpen && <p ref={moment} id={momentId} className="teach-hook-when">
        {hook.when.split(word.zh).map((chunk, i, all) => (
          <span key={i}>
            {chunk}
            {i < all.length - 1 && (
              <em className="teach-hit" lang="zh-CN">
                {word.zh}
              </em>
            )}
          </span>
        ))}
      </p>}</div>}
      <div className="paced-position"><span>Insight {active + 1} of {insights.length}</span><span>Take one idea with you.</span></div>
      <div className="paced-progress" role="progressbar" aria-label="Current memory insight" aria-valuemin={1} aria-valuemax={insights.length} aria-valuenow={active + 1}><span ref={progress} style={{ transform: `scaleX(${(active + 1) / insights.length})` }} /></div>
      <nav className="paced-insights" aria-label="Memory insights">
        {insights.map((tip, index) => <button type="button" key={tip.title} aria-current={index === active ? 'step' : undefined} aria-label={`Insight ${index + 1}: ${tip.title}`} onClick={() => selectInsight(index)}><span>{index + 1}</span>{labels[tip.title] ?? 'Insight'}</button>)}
      </nav>
      <div ref={depth} className="paced-card-depth" onPointerMove={moveDepth} onPointerLeave={resetDepth}>
        <article ref={card} className="paced-card" data-cloze={cloze} aria-labelledby={titleId}>
          <span className="paced-card-step">{String(active + 1).padStart(2, '0')} / {String(insights.length).padStart(2, '0')}</span>
          <h3 id={titleId}>{insight.title}</h3>
          {prefs.showEnglish && <p className="paced-card-body">{insight.body}</p>}
          {!prefs.showEnglish && !insight.cue && !sound && !covered && <CueText text={word.zh} word={word.zh} />}
          {cloze && !open && cue && <CueText text={cue} word={word.zh} />}
          {cloze && !open && prefs.showEnglish && example?.en && <p className="paced-example-en">{example.en}</p>}
          {(insight.cue || sound) && <button type="button" className="paced-reveal" aria-expanded={open} onClick={() => setRevealed((current) => ({ ...current, [active]: !open }))}>{open ? cloze ? 'Hide the answer' : 'Fold it away' : cloze ? 'Reveal after my attempt' : usage ? 'Show the book example' : sound ? 'Practice the sound' : 'Unfold the cue'}<span aria-hidden="true">{open ? '−' : '+'}</span></button>}
          {open && cue && <div className="paced-reveal-content" data-shape={shape}>
            <span className="paced-cue-label">{sourceLine ? 'From your curriculum' : sound ? 'Listen, then say it from memory' : 'A cue to hold onto'}</span>
            <CueText text={cue} word={word.zh} shape={shape} sound={sound && prefs.showPinyin} speaking={playing} />
            {sourceLine && prefs.showPinyin && sourceLine.pinyin && <p className="paced-example-py">{sourceLine.pinyin}</p>}
            {sourceLine && prefs.showEnglish && sourceLine.en && <p className="paced-example-en">{sourceLine.en}</p>}
            {(sourceLine || sound) && <HearButton text={sourceLine ? sourceLine.zh : word.zh} voice={VOICE.xiaoxiao} rate={sourceLine ? LINE_RATE : WORD_RATE} label={sourceLine ? 'Hear the complete line' : 'Hear the word'} />}
            {usage && examples.length > 1 && <div className="paced-example-navigation" role="group" aria-label="Source examples"><span role="status">Example {exampleIndex + 1} of {examples.length}</span><button type="button" className="btn btn-ghost" onClick={() => { stopSpeech(); setExampleIndex((index) => (index + 1) % examples.length) }}>Another example</button></div>}
            {sound && !prefs.showPinyin && <p className="sub">{prefs.showEnglish ? 'Pinyin is off. Listen, then say the word from the Hanzi.' : 'Pinyin off'}</p>}
          </div>}
          {revisit && <button type="button" className="paced-reveal" aria-pressed={covered} onClick={() => setCovered((value) => !value)}>{covered ? 'Bring the word back' : 'Cover the word and try'}<span aria-hidden="true">{covered ? '+' : '−'}</span></button>}
        </article>
      </div>
      <div className="paced-navigation"><button type="button" className="btn btn-ghost" disabled={active === 0} onClick={() => selectInsight(active - 1)}>Previous insight</button><button type="button" className="btn" onClick={() => selectInsight(active === insights.length - 1 ? 0 : active + 1)}>{active === insights.length - 1 ? 'Revisit the first idea' : 'Next insight'}</button></div>
      {prefs.showEnglish && <p className="teach-memory-source">Sentence practice uses your curriculum. Shape images are memory cues.</p>}
    </div>
  )
}

/** Assemble the written cue without changing its characters or their proportions. */
function CueText({ text, word, shape = false, sound = false, speaking = false }: { text: string; word: string; shape?: boolean; sound?: boolean; speaking?: boolean }) {
  const pieces = splitOnWord(text, word).flatMap((bit) => bit.hit ? [{ text: bit.text, hit: true }] : Array.from(bit.text).map((character) => ({ text: character, hit: false })))
  return <p className={`paced-cue${sound ? ' paced-cue-sound' : ''}${shape ? ' paced-cue-shape' : ''}`} lang={sound ? undefined : 'zh-CN'} data-speaking={speaking}><span className="sr-only">{text}</span>{pieces.map((piece, index) => <span key={index} aria-hidden="true" data-cue-piece={piece.text.trim() ? '' : undefined} data-cue-target={piece.hit} className={piece.hit ? 'paced-cue-word' : /\p{Script=Han}/u.test(piece.text) && shape ? 'paced-cue-glyph' : undefined}>{piece.text}</span>)}</p>
}

function ExampleBeat({
  word,
  example,
  onWord,
}: {
  word: Vocab
  example: Example | null
  onWord: (v: Vocab) => void
}) {
  const { prefs } = useStore()
  useAutoSpeak(example?.zh ?? '', VOICE.xiaoxiao, LINE_RATE)
  if (!example) {
    return (
      <div className="teach-example-stage">
        <p className="sub" style={{ textWrap: 'pretty' }}>
          You’ll meet {word.zh} in this 课文. Listen for it when you read.
        </p>
      </div>
    )
  }

  const bits = splitOnWord(example.zh, word.zh)
  return (
    <div className="teach-example-stage">
      <p className="teach-example-line zh" lang="zh-CN">
        {bits.map((b, i) => (
          <span
            key={`${b.text}-${i}`}
            className={b.hit ? 'teach-tok teach-hit teach-brush' : 'teach-tok'}
            style={
              b.hit
                ? ({ '--teach-delay': `${90 + i * 95}ms` } as CSSProperties)
                : { animationDelay: `${90 + i * 95}ms` }
            }
          >
            {b.hit ? (
              <button
                type="button"
                className="word teach-hit-tap"
                onClick={(e) => {
                  e.stopPropagation()
                  onWord(word)
                }}
              >
                {b.text}
              </button>
            ) : (
              <Glossed text={b.text} onWord={onWord} />
            )}
          </span>
        ))}
      </p>
      {prefs.showPinyin && example.pinyin && (
        <p className="teach-example-pyin teach-stagger-in" style={{ animationDelay: `${90 + bits.length * 95 + 80}ms` }}>
          {example.pinyin}
        </p>
      )}
      {prefs.showEnglish && example.en && (
        <p className="teach-example-yes teach-stagger-in" style={{ animationDelay: `${90 + bits.length * 95 + 200}ms` }}>
          {example.en}
        </p>
      )}
      <HearButton text={example.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label="Hear the line" />
    </div>
  )
}

function SealBeat({ word }: { word: Vocab }) {
  const { prefs } = useStore()
  useAutoSpeak(word.zh, VOICE.xiaoxiao, WORD_RATE)
  return (
    <div className="teach-seal">
      <StrokeWord text={word.zh} autoPlay={false} showAttribution={false} />
      {prefs.showPinyin && <p className="teach-seal-py teach-stagger-in" style={{ animationDelay: '420ms' }}>
        {word.pinyin}
      </p>}
      {prefs.showEnglish && <p className="teach-seal-en teach-stagger-in" style={{ animationDelay: '640ms' }}>
        {word.en}
      </p>}
      <div style={{ marginTop: 18 }}>
        <HearButton text={word.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear the word" />
      </div>
    </div>
  )
}
