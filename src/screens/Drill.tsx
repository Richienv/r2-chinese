import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Fireworks } from '../components/Fireworks'
import { CheckIcon, CloseIcon } from '../components/Icons'
import { MasteryTracker } from '../components/MasteryTracker'
import { WordRecall } from '../components/WordRecall'
import { lessonOf, lookup } from '../lib/content'
import { buildDrillQueue } from '../lib/drill'
import {
  addOutcome, classifyRound, nextStreak, pipState, planRounds, requeueRound, streakTier, wordsToRevisit,
  type DrillRound, type Outcomes, type PipState,
} from '../lib/drillRounds'
import { recordHistory } from '../lib/history'
import { haptic, playAdvance, playComplete } from '../lib/sfx'
import { unlockSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import '../styles/drill-stage.css'
import '../styles/drill-play.css'

const REP_OPTIONS = [3, 5, 8]
const DEFAULT_REPS = 3
const XP_PER_REP = 1

const PIP_LABEL: Record<PipState, string> = { waiting: 'not asked yet', current: 'now', unaided: 'recalled', assisted: 'recalled with help', missed: 'needs practice' }
const RESULT_LABEL = { unaided: 'Recalled', assisted: 'With help', missed: 'Needs practice' } as const
const CUE_CHIPS = [
  { cue: 'meaning', zh: '义', label: 'See the meaning' },
  { cue: 'sound', zh: '听', label: 'Hear the book read it' },
  { cue: 'pinyin', zh: '拼', label: 'Read the pinyin' },
] as const

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Bring the Hanzi back from memory, asked three different ways so the drill is
 * not the same tap over and over: from the meaning, from hearing the word, from
 * its pinyin. Every answer is typed or drawn. Help is never free: it is
 * recorded, and a word you needed help with comes back.
 */
export function DrillFlow({ words, title, onClose }: {
  words: string[]
  title?: string
  onClose: () => void
}) {
  const store = useStore()
  const { encounterWord } = store
  const [reps, setReps] = useState(DEFAULT_REPS)
  const [rounds, setRounds] = useState<DrillRound[] | null>(null)
  const [focus, setFocus] = useState<string[] | null>(null)
  const [n, setN] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [unaided, setUnaided] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [outcomes, setOutcomes] = useState<Outcomes>({})
  const [fireworksToken, setFireworksToken] = useState(0)
  const [pulse, setPulse] = useState<{ kind: 'correct' | 'assisted' | 'miss'; n: number }>({ kind: 'correct', n: 0 })
  const [, setAssistVersion] = useState(0)
  const assistedWords = useRef(new Set<string>())
  const thisRound = useRef({ missed: false, assisted: false })
  const card = useRef<HTMLDivElement>(null)
  const committed = useRef(false)

  const base = useMemo(() => [...new Set(words.filter(Boolean))], [words])
  const unique = focus ?? base
  const uniqueCount = unique.length
  const current = rounds && n < rounds.length ? rounds[n] : null
  const zh = current?.zh ?? ''
  const word = zh ? lookup(zh) : undefined

  useEffect(() => {
    if (zh) encounterWord(zh, lessonOf(zh) ?? 0)
  }, [zh, encounterWord])

  useEffect(() => { setBestStreak((best) => Math.max(best, streak)) }, [streak])
  useEffect(() => {
    if (streak === 3 || streak === 5 || streak === 8) haptic('streak')
  }, [streak])

  function resetRound() {
    thisRound.current = { missed: false, assisted: false }
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

  function begin(wordsToDrill: string[]) {
    setFocus(wordsToDrill === base ? null : wordsToDrill)
    setRounds(planRounds(buildDrillQueue(wordsToDrill, reps), store.prefs.soundOn))
    setN(0)
    setAnswered(0)
    setUnaided(0)
    setStreak(0)
    setBestStreak(0)
    setOutcomes({})
    resetRound()
  }

  function assistWord(target: string) {
    if (!assistedWords.current.has(target)) store.recordRecall(target, { correct: false, assisted: true, mode: 'recall' })
    assistedWords.current.add(target)
  }

  /** The learner asked for a hint, or looked at the progress sheet. */
  function assist() {
    if (!zh) return
    assistWord(zh)
    thisRound.current.assisted = true
    setStreak(0)
    setAssistVersion((version) => version + 1)
  }

  function revealAllProgress() {
    // The progress sheet names every Hanzi, including later prompts. Treat the
    // whole set as revealed for this session, rather than just the current card.
    for (const target of unique) assistWord(target)
    thisRound.current.assisted = true
    setStreak(0)
    setAssistVersion((version) => version + 1)
  }

  function react(kind: 'correct' | 'assisted' | 'miss') {
    haptic(kind === 'miss' ? 'miss' : 'good')
    setPulse((previous) => ({ kind, n: previous.n + 1 }))
    const element = card.current
    if (!element || reducedMotion() || typeof element.animate !== 'function') return
    if (kind === 'miss') {
      element.animate(
        [0, -9, 8, -5, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
        { duration: 420, easing: 'cubic-bezier(.36,.07,.19,1)' },
      )
    } else {
      element.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.016)' }, { transform: 'scale(1)' }],
        { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' },
      )
    }
  }

  function attempt(correct: boolean, assisted: boolean) {
    if (!zh) return
    store.recordRecall(zh, { correct, assisted, mode: 'recall' })
    setAnswered((count) => count + 1)
    if (correct) {
      const clean = !assisted && !thisRound.current.missed && !thisRound.current.assisted
      if (!assisted) {
        setUnaided((count) => count + 1)
        setFireworksToken((token) => token + 1)
      }
      if (clean) setStreak((run) => nextStreak(run, 'unaided'))
      react(assisted ? 'assisted' : 'correct')
    } else {
      assistedWords.current.add(zh)
      thisRound.current.missed = true
      setStreak(0)
      setAssistVersion((version) => version + 1)
      react('miss')
    }
  }

  function complete() {
    if (!current) return
    // Once a word has needed help it stays assisted for the rest of the session, as recorded.
    const result = classifyRound({ missed: thisRound.current.missed, assisted: thisRound.current.assisted || assistedWords.current.has(zh) })
    setOutcomes((previous) => addOutcome(previous, zh, result))
    // A word you missed comes back soon, asked by its meaning.
    if (result === 'missed') setRounds((existing) => existing ? requeueRound(existing, n, zh) : existing)
    resetRound()
    setN((index) => index + 1)
    playAdvance()
  }

  function skipUnscored() {
    resetRound()
    setN((index) => index + 1)
  }

  if (!rounds) {
    return (
      <DrillOverlay onClose={onClose}>
        <Head title={title ?? 'Recall drill'} words={unique} onClose={onClose} onProgressReveal={revealAllProgress} />
        <div className="overlay-body drill-intro">
          <div className="medal"><span className="zh" style={{ fontSize: 36, fontWeight: 700 }}>忆</span></div>
          <h2 className="h2" style={{ fontSize: 22 }}>{uniqueCount === 1 ? 'Bring one word back' : `Bring ${uniqueCount} words back`}</h2>
          <p className="sub" style={{ marginTop: 8 }}>Every word is asked three ways, and you answer by writing the Hanzi.<br />Type it, or draw it with your finger.</p>
          <ul className="drill-ways" aria-label="How each word is asked">
            {CUE_CHIPS.map((chip, index) => (
              <li key={chip.cue} style={{ animationDelay: `${120 + index * 90}ms` }}>
                <span className="zh" aria-hidden="true">{chip.zh}</span>
                <span>{chip.label}</span>
              </li>
            ))}
          </ul>
          <div className="kicker-ink" style={{ margin: '24px 0 10px' }}>Rounds per word</div>
          <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
            {REP_OPTIONS.map((count) => <button key={count} className="pill-ink" aria-pressed={reps === count} onClick={() => setReps(count)} style={{ height: 44, minWidth: 56, fontSize: 15, ...(reps === count ? { color: '#fff', backgroundImage: 'var(--metal-sheen), var(--metal-base)', borderColor: 'transparent' } : {}) }}>{count}×</button>)}
          </div>
          <p className="sub" style={{ fontSize: 12, marginTop: 14 }}>{uniqueCount * reps} prompts · hints count as help, so mastery stays honest</p>
        </div>
        <div className="overlay-foot"><button className="btn" disabled={!uniqueCount} onPointerDown={() => unlockSpeech()} onClick={() => begin(unique)}>Start recall</button></div>
      </DrillOverlay>
    )
  }

  if (n >= rounds.length) {
    const credited = Math.min(answered, uniqueCount * reps)
    const revisit = wordsToRevisit(outcomes, unique)
    const clean = answered > 0 && revisit.length === 0 && unaided === answered
    return (
      <DrillOverlay onClose={finish}>
        <Head title={title ?? 'Recall drill'} words={unique} onClose={finish} onProgressReveal={() => {
          // Keep a following "Practise again" in this same session assisted.
          for (const target of unique) assistedWords.current.add(target)
        }} />
        <div className="overlay-body drill-summary">
          <div className="medal pop" onAnimationStart={() => playComplete()}><CheckIcon size={46} /></div>
          <h2 className="h1" style={{ marginTop: 22 }}>{clean ? 'Clean recall' : 'Recall session complete'}</h2>
          <div className="row" style={{ justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <span className="pill-ink">{unaided}/{answered} unaided</span>
            <span className="pill-ink">+{credited * XP_PER_REP} XP</span>
            {bestStreak >= 2 && <span className="pill-ink">Best run {bestStreak}</span>}
          </div>
          <ul className="drill-words" aria-label="How each word went">
            {unique.map((target, index) => {
              const info = lookup(target)
              const last = outcomes[target]?.last
              return (
                <li key={target} data-state={last ?? 'waiting'} style={{ animationDelay: `${80 + index * 60}ms` }}>
                  <span className="zh drill-words-hz" lang="zh-CN">{target}</span>
                  <span className="drill-words-meta"><b>{info?.pinyin}</b><span>{info?.en}</span></span>
                  <em>{last ? RESULT_LABEL[last] : 'Not reached'}</em>
                </li>
              )
            })}
          </ul>
          <p className="sub" style={{ marginTop: 18 }}>Words and difficult attempts are saved automatically. Return another day to prove they stayed with you.</p>
        </div>
        <div className="overlay-foot" style={{ display: 'grid', gap: 10 }}>
          {revisit.length > 0 && <button className="btn" onPointerDown={() => unlockSpeech()} onClick={() => {
            creditSession()
            committed.current = false
            begin(revisit)
          }}>Drill the {revisit.length === 1 ? 'word' : `${revisit.length} words`} to revisit</button>}
          <button className={revisit.length ? 'btn btn-ghost' : 'btn'} onClick={() => {
            creditSession()
            committed.current = false
            begin(unique)
            // Same-session repeats after an answer reveal remain assisted.
          }}>Practise again</button>
          <button className="btn btn-ghost" onClick={finish}>Done</button>
        </div>
      </DrillOverlay>
    )
  }

  if (!current) return null
  const noGloss = !word?.en
  // A pinyin cue needs pinyin; otherwise fall back to the meaning rather than show nothing.
  const cue = current.cue === 'pinyin' && !word?.pinyin ? 'meaning' : current.cue
  return (
    <DrillOverlay onClose={finish}>
      <Fireworks token={fireworksToken} />
      <span key={pulse.n} className="drill-pulse" data-kind={pulse.n ? pulse.kind : 'none'} aria-hidden="true" />
      <Head title={title ?? 'Recall drill'} words={unique} onClose={finish} onProgressReveal={revealAllProgress} />
      <div className="overlay-head drill-hud">
        <div className="drill-pips" role="list" aria-label="Words in this drill">
          {unique.map((target, index) => {
            const state = pipState(outcomes[target], target === zh)
            return <span key={target} role="listitem" className="drill-pip" data-state={state} aria-label={`Word ${index + 1}: ${PIP_LABEL[state]}`} />
          })}
        </div>
        <div className="drill-flow" data-tier={streakTier(streak)} data-on={streak >= 2} aria-live="polite">
          {streak >= 2 ? <><i aria-hidden="true" /><b>{streak}</b> in a row</> : null}
        </div>
        <span className="drill-count">{n + 1}/{rounds.length}</span>
      </div>
      <div className="step-bar drill-bar"><i className="yl-progress" style={{ width: `${(n / rounds.length) * 100}%` }} /></div>
      <div className="overlay-body drill-stage">
        <div className="drill-card" ref={card} data-cue={cue}>
          {noGloss ? (
            <section className="production-stage">
              <div className="production-prompt">
                <div className="kicker-ink">Meaning not in the curriculum yet</div>
                <div className="zh drill-prompt-hz" lang="zh-CN">{zh}</div>
                <p className="sub drill-note">This word stays in your trail. It needs a verified meaning before we can test recall.</p>
              </div>
              <button className="btn" onClick={skipUnscored}>Continue without scoring</button>
            </section>
          ) : (
            <WordRecall
              key={`${n}:${zh}:${cue}`}
              word={word}
              n={n + 1}
              of={rounds.length}
              cue={cue}
              showStrokes
              externallyAssisted={assistedWords.current.has(zh)}
              onAssistance={assist}
              onAttempt={attempt}
              onComplete={complete}
            />
          )}
        </div>
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
