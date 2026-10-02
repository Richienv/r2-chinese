import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Fireworks } from '../components/Fireworks'
import { ChineseHear, HearButton } from '../components/Hear'
import { CheckIcon, CloseIcon } from '../components/Icons'
import { MasteryTracker } from '../components/MasteryTracker'
import { SaveStar } from '../components/SaveStar'
import { exampleFor, lessonOf, lookup } from '../lib/content'
import { buildDrillQuestion, buildDrillQueue, requeue } from '../lib/drill'
import { recordHistory } from '../lib/history'
import { matchesHanzi } from '../lib/mastery'
import { playCorrect, playWrong } from '../lib/sfx'
import { unlockSpeech } from '../lib/speech'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'
import { useStore } from '../store/store'
import '../styles/drill-stage.css'

const REP_OPTIONS = [3, 5, 8]
const DEFAULT_REPS = 3
const XP_PER_REP = 1
const REVEAL_MS = 850

/** English → Hanzi production first. Hints/choices help learning, never inflate mastery. */
export function DrillFlow({ words, title, onClose }: {
  words: string[]
  title?: string
  onClose: () => void
}) {
  const store = useStore()
  const { encounterWord } = store
  const [reps, setReps] = useState(DEFAULT_REPS)
  const [queue, setQueue] = useState<string[] | null>(null)
  const [n, setN] = useState(0)
  const [phase, setPhase] = useState<'ask' | 'feedback' | 'reveal'>('ask')
  const phaseRef = useRef<'ask' | 'feedback' | 'reveal'>('ask')
  const composing = useRef(false)
  const [draft, setDraft] = useState('')
  const [pinyinHint, setPinyinHint] = useState(false)
  const [showChoices, setShowChoices] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [correctPick, setCorrectPick] = useState(false)
  const [unaided, setUnaided] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [fireworksToken, setFireworksToken] = useState(0)
  const assistedWords = useRef(new Set<string>())
  const committed = useRef(false)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const unique = useMemo(() => [...new Set(words.filter(Boolean))], [words])
  const uniqueCount = unique.length
  const zh = queue && n < queue.length ? queue[n] : ''
  // Fallback choices are consistently English → Hanzi; the primary prompt stays English.
  const question = useMemo(() => zh ? buildDrillQuestion(zh, n * 2 + 1) : null, [zh, n])
  const word = zh ? lookup(zh) : undefined
  const example = zh ? exampleFor(zh) : null

  useEffect(() => {
    if (zh) encounterWord(zh, lessonOf(zh) ?? 0)
  }, [zh, encounterWord])

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current)
  }, [])

  function resetBeat() {
    phaseRef.current = 'ask'
    setPhase('ask')
    setDraft('')
    composing.current = false
    setPinyinHint(false)
    setShowChoices(false)
    setPicked(null)
    setCorrectPick(false)
    if (revealTimer.current) clearTimeout(revealTimer.current)
    revealTimer.current = null
  }

  function creditSession() {
    if (committed.current) return
    committed.current = true
    // Extra repair attempts are learning work, not extra XP/daily-goal credit.
    const doneReps = Math.min(answered, uniqueCount * reps)
    if (!doneReps) return
    const xp = doneReps * XP_PER_REP
    store.logDrill(doneReps, xp)
    recordHistory({ course: 'hsk4a', kind: 'drill', lesson: 0, title: title ?? 'Recall drill', xp })
  }

  function finish() {
    creditSession()
    onClose()
  }

  function assist() {
    if (phaseRef.current !== 'ask' || !zh) return
    if (!assistedWords.current.has(zh)) {
      store.recordRecall(zh, { correct: false, assisted: true, mode: 'recall' })
    }
    assistedWords.current.add(zh)
  }

  function revealAllProgress() {
    // The progress sheet names every Hanzi, including later prompts. Treat the
    // whole set as revealed for this session, rather than just the current card.
    for (const word of unique) {
      if (!assistedWords.current.has(word)) {
        store.recordRecall(word, { correct: false, assisted: true, mode: 'recall' })
      }
      assistedWords.current.add(word)
    }
  }

  function hint(kind: 'pinyin' | 'choices') {
    if (phaseRef.current !== 'ask' || (kind === 'pinyin' ? pinyinHint : showChoices)) return
    // Persist the reveal even if the learner exits before submitting an answer.
    assist()
    if (kind === 'pinyin') setPinyinHint(true)
    else setShowChoices(true)
  }

  function answer(correct: boolean, mode: 'recall' | 'recognition', optionId?: string) {
    if (phaseRef.current !== 'ask' || !word?.en) return
    phaseRef.current = 'feedback'
    const assisted = mode === 'recognition' || assistedWords.current.has(zh)
    store.recordRecall(zh, { correct, assisted, mode })
    if (!correct) assistedWords.current.add(zh)
    setAnswered((count) => count + 1)
    setPicked(optionId ?? null)
    setCorrectPick(correct)
    setPhase('feedback')
    if (correct) {
      playCorrect()
      if (!assisted) {
        setUnaided((count) => count + 1)
        setFireworksToken((token) => token + 1)
      }
    } else playWrong()
    revealTimer.current = setTimeout(() => {
      phaseRef.current = 'reveal'
      setPhase('reveal')
    }, REVEAL_MS)
  }

  function next(repair: boolean) {
    if (repair) setQueue((current) => current ? requeue(current, n, zh) : current)
    resetBeat()
    setN((index) => index + 1)
  }

  if (!queue) {
    return (
      <DrillOverlay onClose={onClose}>
        <Head title={title ?? 'Recall drill'} words={unique} onClose={onClose} onProgressReveal={revealAllProgress} />
        <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div className="medal" style={{ marginBottom: 20 }}><span className="zh" style={{ fontSize: 36, fontWeight: 700 }}>忆</span></div>
            <h2 className="h2" style={{ fontSize: 22 }}>{uniqueCount === 1 ? 'Bring one word back' : `Bring ${uniqueCount} words back`}</h2>
            <p className="sub" style={{ marginTop: 8 }}>See the meaning. Produce the Hanzi from memory.<br />Use a hint when you need it — your progress stays honest.</p>
            <div className="kicker-ink" style={{ margin: '28px 0 10px' }}>Rounds per word</div>
            <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
              {REP_OPTIONS.map((count) => <button key={count} className="pill-ink" aria-pressed={reps === count} onClick={() => setReps(count)} style={{ height: 44, minWidth: 56, fontSize: 15, ...(reps === count ? { color: '#fff', backgroundImage: 'var(--metal-sheen), var(--metal-base)', borderColor: 'transparent' } : {}) }}>{count}×</button>)}
            </div>
            <p className="sub" style={{ fontSize: 12, marginTop: 14 }}>{uniqueCount * reps} prompts · mastery grows across days</p>
          </div>
        </div>
        <div className="overlay-foot"><button className="btn" disabled={!uniqueCount} onClick={() => setQueue(buildDrillQueue(unique, reps))}>Start recall</button></div>
      </DrillOverlay>
    )
  }

  if (n >= queue.length) {
    const credited = Math.min(answered, uniqueCount * reps)
    return (
      <DrillOverlay onClose={finish}>
        <Head title={title ?? 'Recall drill'} words={unique} onClose={finish} onProgressReveal={() => {
          // Keep a following "Practise again" in this same session assisted.
          for (const word of unique) assistedWords.current.add(word)
        }} />
        <div className="overlay-body" style={{ textAlign: 'center', paddingTop: 40 }}>
          <div className="medal pop"><CheckIcon size={46} /></div>
          <h2 className="h1" style={{ marginTop: 22 }}>Recall session complete</h2>
          <div className="row" style={{ justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <span className="pill-ink">{unaided}/{answered} unaided</span>
            <span className="pill-ink">+{credited * XP_PER_REP} XP</span>
          </div>
          <p className="sub" style={{ marginTop: 20 }}>Words and difficult attempts are saved automatically. Return another day to prove they stayed with you.</p>
        </div>
        <div className="overlay-foot" style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => {
            creditSession()
            committed.current = false
            setQueue(buildDrillQueue(unique, reps))
            setN(0)
            resetBeat()
            setUnaided(0)
            setAnswered(0)
            // Same-session repeats after an answer reveal remain assisted.
          }}>Practise again</button>
          <button className="btn" onClick={finish}>Done</button>
        </div>
      </DrillOverlay>
    )
  }

  if (!question) return null
  const revealed = phase === 'reveal'
  const noGloss = !word?.en
  return (
    <DrillOverlay onClose={finish}>
      <Fireworks token={fireworksToken} />
      <Head title={title ?? 'Recall drill'} words={unique} onClose={finish} onProgressReveal={revealAllProgress} />
      <div className="overlay-head" style={{ paddingTop: 0 }}>
        <div className="step-bar"><i style={{ width: `${(n / queue.length) * 100}%` }} /></div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{n + 1}/{queue.length}</span>
      </div>
      <div className="overlay-body drill-stage" key={n}>
        <div className="drill-prompt">
          <div className="kicker-ink">{noGloss ? 'Meaning not in the curriculum yet' : 'Bring the Hanzi to mind'}</div>
          <div className={noGloss ? 'zh drill-prompt-hz' : 'drill-prompt-en'} lang={noGloss ? 'zh-CN' : undefined}>{noGloss ? zh : word.en}</div>
          {noGloss && <p className="sub drill-note">This word stays in your trail. It needs a verified meaning before we can test recall.</p>}
          {pinyinHint && !revealed && <p className="drill-hint" aria-live="polite">{word?.pinyin || 'No pinyin in the curriculum'} · assisted attempt</p>}
          {!noGloss && !revealed && !showChoices && (
            <form onSubmit={(event) => { event.preventDefault(); if (!composing.current && draft.trim()) answer(matchesHanzi(draft, zh), 'recall') }}>
              <label className="sr-only" htmlFor="drill-answer">Write the Hanzi for this meaning</label>
              <input id="drill-answer" className="drill-input zh" value={draft} onChange={(event) => setDraft(event.target.value)} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} onKeyDown={(event) => { if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing)) event.preventDefault() }} disabled={phase !== 'ask'} autoComplete="off" autoCorrect="off" spellCheck={false} lang="zh-CN" placeholder="写汉字…" aria-describedby="drill-help" />
              <p id="drill-help" className="sub" style={{ fontSize: 12 }}>Type with your Chinese keyboard. Check before revealing.</p>
              <button className="btn" type="submit" disabled={phase !== 'ask' || !draft.trim()}>Check my recall</button>
            </form>
          )}
          {phase === 'ask' && !noGloss && <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {!pinyinHint && <button type="button" className="pill-ink" onClick={() => hint('pinyin')}>Pinyin hint</button>}
            {!showChoices && <button type="button" className="pill-ink" onClick={() => hint('choices')}>Show choices</button>}
          </div>}
          {revealed && (
            <div className="drill-reveal">
              <div className="zh drill-prompt-hz" lang="zh-CN">{zh}</div>
              <div className="drill-reveal-py">{word?.pinyin}</div>
              <div className="drill-reveal-en">{word?.en}</div>
              <div className="drill-tools"><ChineseHear text={zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear the word" /><SaveStar zh={zh} size={22} /></div>
              {example && <div className="drill-reveal-ex"><div className="zh" lang="zh-CN">{example.zh}</div><div className="drill-reveal-ex-en">{example.en}</div><HearButton text={example.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label="Hear the line" /></div>}
            </div>
          )}
        </div>
        {showChoices && !revealed && <div className="drill-choices">
          {question.options.map((option, index) => {
            const correct = phase === 'feedback' && option.id === question.answerId
            const wrong = picked === option.id && option.id !== question.answerId
            return <button key={option.id} type="button" className={`option drill-choice zh${correct ? ' yl-correct' : wrong ? ' yl-wrong' : ''}`} data-state={correct ? 'correct' : wrong ? 'wrong' : undefined} disabled={phase !== 'ask'} style={{ animationDelay: `${index * 70}ms` }} onPointerDown={() => unlockSpeech()} onClick={() => answer(option.id === question.answerId, 'recognition', option.id)} lang="zh-CN">{option.label}</button>
          })}
        </div>}
        {phase === 'feedback' && <div className="drill-feedback drill-verdict" aria-live="polite">{correctPick ? assistedWords.current.has(zh) ? 'Correct with support — keep practising' : 'Recalled without a hint' : 'Not yet — look, then retrieve it again'}</div>}
      </div>
      <div className="overlay-foot">
        {revealed ? <div className="grid2"><button className="rating" data-k="again" onClick={() => next(true)}>Try it later</button><button className="rating" data-k="good" onClick={() => next(false)}>Continue</button></div>
          : noGloss ? <button className="btn" onClick={() => next(false)}>Continue without scoring</button>
            : <p className="sub" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>{showChoices ? 'Choices help recognition; they do not earn mastery.' : 'Meaning → memory → Hanzi. Your learning trail saves itself.'}</p>}
      </div>
    </DrillOverlay>
  )
}

/** A drill can be launched from transformed text cards as well as the app shell. */
function DrillOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    root.current?.querySelector<HTMLButtonElement>('[aria-label="Close drill"]')?.focus()
    function keyboard(event: KeyboardEvent) {
      // The progress popup handles its own Escape before this outer drill.
      if (root.current?.querySelector('.mastery-popover') || document.querySelector('.dictionary-backdrop')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        close.current()
      } else if (event.key === 'Tab') {
        const controls = [...(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]') ?? [])].filter((node) => node.getClientRects().length > 0)
        const first = controls[0], last = controls[controls.length - 1]
        if (!first || !last) return
        if (event.shiftKey && (document.activeElement === first || !root.current?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || !root.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keyboard, true)
    return () => {
      document.removeEventListener('keydown', keyboard, true)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(<div ref={root} className="overlay" style={{ zIndex: 90 }} role="dialog" aria-modal="true" aria-label="Word recall drill">{children}</div>, document.body)
}

function Head({ title, words, onClose, onProgressReveal }: { title: string; words: string[]; onClose: () => void; onProgressReveal?: () => void }) {
  return <div className="overlay-head"><button className="icon-round tap44" onClick={onClose} aria-label="Close drill"><CloseIcon /></button><strong style={{ fontSize: 15, flex: 1 }}>{title}</strong><MasteryTracker words={words} compact onOpen={onProgressReveal} /></div>
}
