import { StudyMusic } from '../components/StudyMusic'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, CloseIcon } from '../components/Icons'
import { WordRecall, type RecallAttemptMode } from '../components/WordRecall'
import { isCoreBookVocab, lessonOf, lookup } from '../lib/content'
import { bundledDictionaryEntry } from '../lib/dictionary'
import { drillSelection, SHORT_DRILL_WORDS } from '../lib/practiceExperience'
import '../styles/usability.css'
import { buildDrillQueue } from '../lib/drill'
import {
  addOutcome,
  classifyRound,
  nextStreak,
  pipState,
  planRounds,
  streakTier,
  wordsToRevisit,
  type DrillRound,
  type Outcomes,
  type PipState,
} from '../lib/drillRounds'
import { recordHistory } from '../lib/history'
import { t } from '../lib/i18n'
import { haptic, playAdvance, playComplete } from '../lib/sfx'
import { unlockSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import '../styles/drill-stage.css'
import '../styles/drill-play.css'

const REP_OPTIONS = [1, 2, 3]
const DEFAULT_REPS = 1
const XP_PER_REP = 1

const PIP_LABEL: Record<PipState, string> = {
  waiting: t('not asked yet'),
  current: t('now'),
  unaided: t('recalled'),
  assisted: t('recalled with help'),
  missed: t('needs practice'),
}
const RESULT_LABEL = {
  unaided: t('Recalled'),
  assisted: t('With help'),
  missed: t('Needs practice'),
} as const

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A bounded practice round. Missed words can be retried by choice at the end. */
export function DrillFlow({
  words,
  title,
  onClose,
}: {
  words: string[]
  title?: string
  onClose: () => void
}) {
  const store = useStore()
  const { encounterWord } = store
  const [allWords, setAllWords] = useState(false)
  const [reps, setReps] = useState(DEFAULT_REPS)
  const [rounds, setRounds] = useState<DrillRound[] | null>(() => {
    const selected = drillSelection(words)
    return selected.length === 1 ? planRounds(selected, store.prefs.soundOn) : null
  })
  const [focus, setFocus] = useState<string[] | null>(null)
  const [n, setN] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [unaided, setUnaided] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [outcomes, setOutcomes] = useState<Outcomes>({})
  const [pulse, setPulse] = useState<{ kind: 'correct' | 'assisted' | 'miss'; n: number }>({
    kind: 'correct',
    n: 0,
  })
  const [, setAssistVersion] = useState(0)
  const assistedWords = useRef(new Set<string>())
  const thisRound = useRef({ missed: false, assisted: false })
  const card = useRef<HTMLDivElement>(null)
  const committed = useRef(false)

  const totalWords = useMemo(() => drillSelection(words, true), [words])
  const base = useMemo(() => drillSelection(totalWords, allWords), [totalWords, allWords])
  const unique = focus ?? base
  const uniqueCount = unique.length
  const current = rounds && n < rounds.length ? rounds[n] : null
  const zh = current?.zh ?? ''
  const [, setResolved] = useState(0)
  const word = zh ? lookup(zh) : undefined

  useEffect(() => {
    if (zh && isCoreBookVocab(zh)) encounterWord(zh, lessonOf(zh) ?? 0)
  }, [zh, encounterWord])

  // Words saved from readers may only have an evicted dictionary entry; fetch it before showing a gap.
  useEffect(() => {
    if (!zh || lookup(zh)?.en) return
    let live = true
    void bundledDictionaryEntry(zh).then((entry) => { if (live && entry) setResolved((value) => value + 1) }).catch(() => {})
    return () => { live = false }
  }, [zh])

  useEffect(() => {
    setBestStreak((best) => Math.max(best, streak))
  }, [streak])
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
    recordHistory({ course: 'hsk4a', kind: 'drill', lesson: 0, title: title ?? t('Recall drill'), xp })
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
      element.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.016)' }, { transform: 'scale(1)' }], {
        duration: 520,
        easing: 'cubic-bezier(.22,1,.36,1)',
      })
    }
  }

  function attempt(correct: boolean, assisted: boolean, mode: RecallAttemptMode = 'recall') {
    if (!zh) return
    store.recordRecall(zh, {
      correct,
      assisted: assisted || thisRound.current.assisted || thisRound.current.missed,
      mode: mode === 'writing' ? 'writing' : current?.cue === 'sound' ? 'listening' : 'recall',
      source: 'drill',
    })
    setAnswered((count) => count + 1)
    if (correct) {
      const clean = !assisted && !thisRound.current.missed && !thisRound.current.assisted
      if (!assisted) {
        setUnaided((count) => count + 1)
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
    const result = classifyRound({
      missed: thisRound.current.missed,
      assisted: thisRound.current.assisted || assistedWords.current.has(zh),
    })
    setOutcomes((previous) => addOutcome(previous, zh, result))
    resetRound()
    setN((index) => index + 1)
    playAdvance()
  }

  function keepVisibleOutcome() {
    // An already checked miss stays visible in the summary; skipping creates no new review event.
    if (current && (thisRound.current.missed || thisRound.current.assisted)) {
      const result = classifyRound(thisRound.current)
      setOutcomes(previous => addOutcome(previous, current.zh, result))
    }
  }

  function skipUnscored() {
    keepVisibleOutcome()
    resetRound()
    setN((index) => index + 1)
  }

  function endPractice() {
    if (!rounds) return
    keepVisibleOutcome()
    resetRound()
    setN(rounds.length)
  }

  if (!rounds) {
    return (
      <DrillOverlay onClose={onClose}>
        <Head
          title={title ?? t('Recall drill')}
          onClose={onClose}
        />
        <div className="overlay-body drill-intro">
          <p className="compact-eyebrow">{t('A short recall round')}</p>
          <h2 className="h2">{t('{n} words, at your pace.', { n: uniqueCount })}</h2>
          <p className="sub">{t('One pass to start. Missed words can wait for another round.')}</p>
          {totalWords.length > base.length && <p className="sub">{t('The other {n} words stay in your trail.', { n: totalWords.length - base.length })}</p>}
          <details className="practice-options">
            <summary>{t('More practice options')}</summary>
            {totalWords.length > SHORT_DRILL_WORDS && <div className="practice-scope" role="group" aria-label={t('Words in this round')}>
              <button className="pill-ink" aria-pressed={!allWords} onClick={() => setAllWords(false)}>{t('Short round · {n} words', { n: SHORT_DRILL_WORDS })}</button>
              <button className="pill-ink" aria-pressed={allWords} onClick={() => setAllWords(true)}>{t('All {n} words', { n: totalWords.length })}</button>
            </div>}
            <p className="sub">{t('Passes per word')}</p>
            <div className="practice-scope" role="group" aria-label={t('Passes per word')}>
              {REP_OPTIONS.map(count => <button key={count} className="pill-ink" aria-pressed={reps === count} onClick={() => setReps(count)}>{count}×</button>)}
            </div>
            <p className="sub">{t('Extra passes add listening and pinyin prompts.')}</p>
          </details>
          <p className="drill-round-size">{t('{n} questions in this round', { n: uniqueCount * reps })}</p>
        </div>
        <div className="overlay-foot">
          <button
            className="btn"
            disabled={!uniqueCount}
            onPointerDown={() => unlockSpeech()}
            onClick={() => begin(unique)}
          >
            {t('Start recall')}
          </button>
        </div>
      </DrillOverlay>
    )
  }

  if (n >= rounds.length) {
    const credited = Math.min(answered, uniqueCount * reps)
    const revisit = wordsToRevisit(outcomes, unique)
    const clean = answered > 0 && revisit.length === 0 && unaided === answered && unique.every(word => outcomes[word]?.last === 'unaided')
    return (
      <DrillOverlay onClose={finish}>
        <Head
          title={title ?? t('Recall drill')}
          onClose={finish}

        />
        <div className="overlay-body drill-summary">
          <div className="medal pop" onAnimationStart={() => playComplete()}>
            <CheckIcon size={46} />
          </div>
          <h2 className="h1" style={{ marginTop: 22 }}>
            {clean ? t('Clean recall') : t('Recall session complete')}
          </h2>
          <p className="sub">{t('{n} answers checked. Your progress is saved.', { n: answered })}</p>
          <details className="practice-options"><summary>{t('Round details')}</summary>
          <p className="sub">{t('{unaided}/{answered} unaided', { unaided, answered })} · +{credited * XP_PER_REP} XP{bestStreak >= 2 ? ` · ${t('Best run {n}', { n: bestStreak })}` : ''}</p>
          <ul className="drill-words" aria-label={t('How each word went')}>
            {unique.map((target, index) => {
              const info = lookup(target)
              const last = outcomes[target]?.last
              return (
                <li
                  key={target}
                  data-state={last ?? 'waiting'}
                  style={{ animationDelay: `${80 + index * 60}ms` }}
                >
                  <span className="zh drill-words-hz" lang="zh-CN">
                    {target}
                  </span>
                  <span className="drill-words-meta">
                    <b>{info?.pinyin}</b>
                    <span>{info?.en}</span>
                  </span>
                  <em>{last ? RESULT_LABEL[last] : t('Not reached')}</em>
                </li>
              )
            })}
          </ul></details>
          <p className="sub" style={{ marginTop: 18 }}>
            {t(
              'Words and difficult attempts are saved automatically. Return another day to prove they stayed with you.',
            )}
          </p>
        </div>
        <div className="overlay-foot" style={{ display: 'grid', gap: 10 }}>
          <button className="btn" onClick={finish}>{t('Done')}</button>
          {revisit.length > 0 && <button className="btn btn-ghost" onClick={() => {
            creditSession(); committed.current = false; begin(revisit)
          }}>{t('Practise {n} tricky words again', { n: revisit.length })}</button>}
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
      <span
        key={pulse.n}
        className="drill-pulse"
        data-kind={pulse.n ? pulse.kind : 'none'}
        aria-hidden="true"
      />
      <Head
        title={title ?? t('Recall drill')}
        onClose={finish}
      />
      <div className="overlay-head drill-hud">
        <div className="drill-pips" role="list" aria-label={t('Words in this drill')}>
          {unique.map((target, index) => {
            const state = pipState(outcomes[target], target === zh)
            return (
              <span
                key={target}
                role="listitem"
                className="drill-pip"
                data-state={state}
                aria-label={t('Word {n}: {state}', { n: index + 1, state: PIP_LABEL[state] })}
              />
            )
          })}
        </div>
        <div className="drill-flow" data-tier={streakTier(streak)} data-on={streak >= 2} aria-live="polite">
          {streak >= 2 ? (
            <>
              <i aria-hidden="true" />
              <b>{streak}</b> {t('in a row')}
            </>
          ) : null}
        </div>
        <span className="drill-count">
          {n + 1}/{rounds.length}
        </span>
      </div>
      <div className="step-bar drill-bar">
        <i className="yl-progress" style={{ width: `${(n / rounds.length) * 100}%` }} />
      </div>
      <div className="overlay-body drill-stage compact-drill">
        <div className="drill-card" ref={card} data-cue={cue}>
          {noGloss ? (
            <section className="production-stage">
              <div className="production-prompt">
                <div className="kicker-ink">{t('Meaning not in the curriculum yet')}</div>
                <div className="zh drill-prompt-hz" lang="zh-CN">
                  {zh}
                </div>
                <p className="sub drill-note">
                  {t('This word stays in your trail. It needs a verified meaning before we can test recall.')}
                </p>
              </div>
              <button className="btn" onClick={skipUnscored}>
                {t('Continue without scoring')}
              </button>
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
        <div className="practice-exit"><button onClick={endPractice}>{t('Finish practice')}</button></div>
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
    root.current?.querySelector<HTMLButtonElement>('[data-drill-close]')?.focus()
    function keyboard(event: KeyboardEvent) {
      // The progress popup handles its own Escape before this outer drill.
      if (root.current?.querySelector('.mastery-popover') || document.querySelector('.dictionary-backdrop'))
        return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        close.current()
      } else if (event.key === 'Tab') {
        const controls = [
          ...(root.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]',
          ) ?? []),
        ].filter((node) => node.getClientRects().length > 0)
        const first = controls[0],
          last = controls[controls.length - 1]
        if (!first || !last) return
        if (
          event.shiftKey &&
          (document.activeElement === first || !root.current?.contains(document.activeElement))
        ) {
          event.preventDefault()
          last.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !root.current?.contains(document.activeElement))
        ) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', keyboard, true)
    return () => {
      document.removeEventListener('keydown', keyboard, true)
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(
    <div
      ref={root}
      className="overlay"
      style={{ zIndex: 90 }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Word recall drill')}
    >
      {children}
    </div>,
    document.body,
  )
}

function Head({
  title,
  onClose,
}: {
  title: string
  onClose: () => void
}) {
  return (
    <div className="overlay-head">
      <button className="icon-round tap44" data-drill-close onClick={onClose} aria-label={t('Close drill')}>
        <CloseIcon />
      </button>
      <strong style={{ fontSize: 15, flex: 1 }}>{title}</strong>
      <StudyMusic compact />
    </div>
  )
}
