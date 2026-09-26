import { useEffect, useMemo, useRef, useState } from 'react'
import { Fireworks } from '../components/Fireworks'
import { ChineseHear, HearButton } from '../components/Hear'
import { CheckIcon, CloseIcon } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { exampleFor, lookup } from '../lib/content'
import { buildDrillQuestion, buildDrillQueue, requeue } from '../lib/drill'
import { playCorrect, playWrong } from '../lib/sfx'
import { unlockSpeech } from '../lib/speech'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'
import { useStore } from '../store/store'
import '../styles/drill-stage.css'

const REP_OPTIONS = [5, 8, 10]
const DEFAULT_REPS = 5
const XP_PER_REP = 1
/** Let correct/wrong spring play before revealing the gloss. */
const REVEAL_MS = 1100

/**
 * Rapid drill — multiple-choice recall (answer first, then reveal). Credits the
 * daily goal but never changes an SRS schedule.
 */
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
  const [reps, setReps] = useState(DEFAULT_REPS)
  const [queue, setQueue] = useState<string[] | null>(null)
  const [n, setN] = useState(0)
  const [phase, setPhase] = useState<'ask' | 'feedback' | 'reveal'>('ask')
  const [picked, setPicked] = useState<string | null>(null)
  const [correctPick, setCorrectPick] = useState(false)
  const [gotFirstTry, setGotFirstTry] = useState(0)
  const [triedAgain, setTriedAgain] = useState<Set<number>>(new Set())
  const [fireworksToken, setFireworksToken] = useState(0)
  const committed = useRef(false)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uniqueCount = useMemo(() => new Set(words.filter(Boolean)).size, [words])
  const zh = queue?.[Math.min(n, Math.max(queue.length - 1, 0))] ?? ''
  const question = useMemo(() => (zh ? buildDrillQuestion(zh, n) : null), [zh, n])
  const word = zh ? lookup(zh) : undefined
  const example = zh ? exampleFor(zh) : null

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current)
    }
  }, [])

  function resetBeat() {
    setPhase('ask')
    setPicked(null)
    setCorrectPick(false)
    if (revealTimer.current) {
      clearTimeout(revealTimer.current)
      revealTimer.current = null
    }
  }

  function finish() {
    if (!committed.current) {
      committed.current = true
      const total = uniqueCount * reps
      const doneReps = Math.min(n, total)
      if (doneReps > 0) store.logDrill(doneReps, doneReps * XP_PER_REP)
    }
    onClose()
  }

  // Setup screen — pick reps, then start.
  if (!queue) {
    return (
      <div className="overlay" style={{ zIndex: 90 }}>
        <Head title={title ?? 'Drill'} onClose={onClose} />
        <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div className="medal" style={{ marginBottom: 20 }}>
              <span className="zh" style={{ fontSize: 40, fontWeight: 700 }}>
                {uniqueCount === 1 ? words[0] : uniqueCount}
              </span>
            </div>
            <h2 className="h2" style={{ fontSize: 22 }}>
              {uniqueCount === 1 ? 'Drill this word' : `Drill ${uniqueCount} words`}
            </h2>
            <p className="sub" style={{ marginTop: 6 }}>
              Answer first — meaning stays hidden until you pick.
            </p>

            <div className="kicker-ink" style={{ margin: '28px 0 10px' }}>
              Repetitions each
            </div>
            <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
              {REP_OPTIONS.map((r) => (
                <button
                  key={r}
                  className="pill-ink"
                  onClick={() => setReps(r)}
                  style={
                    reps === r
                      ? {
                          color: '#fff',
                          backgroundImage: 'var(--metal-sheen), var(--metal-base)',
                          borderColor: 'transparent',
                          height: 40,
                          minWidth: 56,
                          fontSize: 15,
                        }
                      : { height: 40, minWidth: 56, fontSize: 15 }
                  }
                >
                  {r}×
                </button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 12 }}>
              {uniqueCount * reps} cards this session
            </p>
          </div>
        </div>
        <div className="overlay-foot">
          <button
            className="btn"
            disabled={uniqueCount === 0}
            onClick={() => setQueue(buildDrillQueue(words, reps))}
          >
            Start drilling
          </button>
        </div>
      </div>
    )
  }

  const total = uniqueCount * reps
  const done = n >= queue.length

  function answer(optionId: string) {
    if (!question || question.mode === 'no-gloss') return
    if (phase !== 'ask' || picked) return
    const ok = optionId === question.answerId
    setPicked(optionId)
    setCorrectPick(ok)
    setPhase('feedback')
    if (ok) {
      playCorrect()
      setFireworksToken((t) => t + 1)
      if (!triedAgain.has(n)) setGotFirstTry((g) => g + 1)
    } else {
      playWrong()
    }
    revealTimer.current = setTimeout(() => setPhase('reveal'), REVEAL_MS)
  }

  function acknowledgeNoGloss(knew: boolean) {
    if (phase !== 'ask') return
    if (knew && !triedAgain.has(n)) setGotFirstTry((g) => g + 1)
    setCorrectPick(knew)
    setPhase('reveal')
  }

  function gotIt() {
    resetBeat()
    setN(n + 1)
  }

  function again() {
    setTriedAgain((s) => new Set(s).add(n))
    setQueue((q) => (q ? requeue(q, n, zh) : q))
    resetBeat()
    setN(n + 1)
  }

  if (done) {
    const accuracy = total ? Math.round((gotFirstTry / total) * 100) : 0
    return (
      <div className="overlay" style={{ zIndex: 90 }}>
        <Head title={title ?? 'Drill'} onClose={finish} />
        <div className="overlay-body" style={{ textAlign: 'center', paddingTop: 40 }}>
          <div className="medal pop">
            <CheckIcon size={46} />
          </div>
          <h2 className="h1" style={{ marginTop: 22 }}>
            Nicely drilled!
          </h2>
          <div className="row" style={{ justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <span className="pill-ink">{total} reps</span>
            <span className="pill-ink">{accuracy}% first try</span>
            <span className="pill-ink">+{total * XP_PER_REP} XP</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 20, lineHeight: 1.5 }}>
            Counts toward today's goal. Spaced reviews are unaffected — those still come due on their
            own schedule.
          </p>
        </div>
        <div className="overlay-foot" style={{ display: 'grid', gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              const doneReps = Math.min(n, total)
              if (doneReps > 0) store.logDrill(doneReps, doneReps * XP_PER_REP)
              committed.current = false
              setQueue(buildDrillQueue(words, reps))
              setN(0)
              resetBeat()
              setGotFirstTry(0)
              setTriedAgain(new Set())
            }}
          >
            Drill again
          </button>
          <button className="btn" onClick={finish}>
            Done
          </button>
        </div>
      </div>
    )
  }

  if (!question) return null

  const revealed = phase === 'reveal'
  const noGloss = question.mode === 'no-gloss'

  return (
    <div className="overlay" style={{ zIndex: 90 }}>
      <Fireworks token={fireworksToken} />
      <Head title={title ?? 'Drill'} onClose={finish} />
      <div className="overlay-head" style={{ paddingTop: 0 }}>
        <div className="step-bar">
          <i style={{ width: `${(n / queue.length) * 100}%` }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>
          {Math.min(n + 1, queue.length)}/{queue.length}
        </span>
      </div>

      <div className="overlay-body drill-stage" key={n}>
        <div className="drill-prompt">
          <div className="kicker-ink">
            {noGloss
              ? 'No book meaning yet'
              : question.mode === 'zh-to-en'
                ? 'What does this mean?'
                : 'Which word means this?'}
          </div>
          <div
            className={question.promptLang === 'zh' ? 'zh drill-prompt-hz' : 'drill-prompt-en'}
            lang={question.promptLang === 'zh' ? 'zh-CN' : undefined}
          >
            {question.prompt}
          </div>
          <div className="drill-tools">
            <ChineseHear text={zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear the word" />
            <SaveStar zh={zh} lesson={word ? undefined : 0} size={22} />
          </div>

          {revealed && (
            <div className="drill-reveal">
              {word?.pinyin ? <div className="drill-reveal-py">{word.pinyin}</div> : null}
              {word?.en ? (
                <div className="drill-reveal-en">{word.en}</div>
              ) : (
                <div className="drill-reveal-missing">Meaning not in the book yet.</div>
              )}
              {example && (
                <div className="drill-reveal-ex">
                  <div className="zh" lang="zh-CN">
                    {example.zh}
                  </div>
                  <div className="drill-reveal-ex-en">{example.en}</div>
                  <HearButton text={example.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label="Hear the line" />
                </div>
              )}
            </div>
          )}
        </div>

        {!noGloss && !revealed && (
          <div className="drill-choices">
            {question.options.map((o, index) => {
              const isAnswer = o.id === question.answerId
              const isWrong = picked === o.id && !isAnswer
              const showCorrect = phase === 'feedback' && isAnswer
              const motion = showCorrect ? ' yl-correct' : isWrong ? ' yl-wrong' : ''
              const st = showCorrect ? 'correct' : isWrong ? 'wrong' : undefined
              return (
                <button
                  key={isWrong ? `${o.id}-miss` : o.id}
                  type="button"
                  className={`option drill-choice${question.mode === 'en-to-zh' ? ' zh' : ''}${motion}`}
                  data-state={st}
                  disabled={phase !== 'ask'}
                  style={{ animationDelay: `${index * 70}ms` }}
                  onPointerDown={() => unlockSpeech()}
                  onClick={() => answer(o.id)}
                  lang={question.mode === 'en-to-zh' ? 'zh-CN' : undefined}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        )}

        {noGloss && phase === 'ask' && (
          <p className="sub drill-note">No book gloss for this card yet. Mark how the recall felt, then continue.</p>
        )}

        {phase === 'feedback' && !noGloss && (
          <div className="drill-verdict" aria-live="polite">
            {correctPick ? 'Nice' : 'Not quite'}
          </div>
        )}
      </div>

      <div className="overlay-foot">
        {revealed ? (
          <div className="grid2">
            <button className="rating" data-k="again" onClick={again}>
              Again
            </button>
            <button className="rating" data-k="good" onClick={gotIt}>
              Got it
            </button>
          </div>
        ) : noGloss ? (
          <div className="grid2">
            <button className="rating" data-k="again" onClick={() => acknowledgeNoGloss(false)}>
              Again
            </button>
            <button className="rating" data-k="good" onClick={() => acknowledgeNoGloss(true)}>
              Got it
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--muted-3)', textAlign: 'center', margin: 0 }}>
            Pick an answer to continue
          </p>
        )}
      </div>
    </div>
  )
}

function Head({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="overlay-head">
      <button className="icon-round tap44" onClick={onClose} aria-label="Close drill">
        <CloseIcon />
      </button>
      <strong style={{ fontSize: 15, flex: 1 }}>{title}</strong>
    </div>
  )
}
