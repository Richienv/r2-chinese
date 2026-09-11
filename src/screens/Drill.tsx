import { useMemo, useRef, useState } from 'react'
import { CheckIcon, CloseIcon, SpeakerIcon } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { exampleFor, lookup } from '../lib/content'
import { buildDrillQueue, requeue } from '../lib/drill'
import { speak } from '../lib/speech'
import { useStore } from '../store/store'

const REP_OPTIONS = [5, 8, 10]
const DEFAULT_REPS = 5
const XP_PER_REP = 1

/**
 * Rapid drill — cycle each word 5–10 times with a two-tap "again / got it"
 * verdict. Deliberate massed practice: it credits the daily goal but never
 * changes an SRS schedule, so drilling and spaced review stay independent.
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
  const [shown, setShown] = useState(false)
  const [gotFirstTry, setGotFirstTry] = useState(0)
  const [triedAgain, setTriedAgain] = useState<Set<number>>(new Set())
  const committed = useRef(false)

  const uniqueCount = useMemo(() => new Set(words.filter(Boolean)).size, [words])

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
              Rapid repetition — see it, recall it, again.
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
  const zh = queue[Math.min(n, queue.length - 1)]
  const word = lookup(zh)
  const example = exampleFor(zh)

  function reveal() {
    if (shown) return
    setShown(true)
    speak(zh)
  }

  function gotIt() {
    if (!triedAgain.has(n)) setGotFirstTry((g) => g + 1)
    setShown(false)
    setN(n + 1)
  }

  function again() {
    setTriedAgain((s) => new Set(s).add(n))
    setQueue((q) => (q ? requeue(q, n, zh) : q))
    setShown(false)
    setN(n + 1)
  }

  // Credit only the reps actually answered (n), so quitting early doesn't award
  // the full planned total. Committed once, guarded against a double-commit.
  function finish() {
    if (!committed.current) {
      committed.current = true
      const doneReps = Math.min(n, total)
      if (doneReps > 0) store.logDrill(doneReps, doneReps * XP_PER_REP)
    }
    onClose()
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
              // Bank the round just finished before starting a fresh one.
              const doneReps = Math.min(n, total)
              if (doneReps > 0) store.logDrill(doneReps, doneReps * XP_PER_REP)
              committed.current = false
              setQueue(buildDrillQueue(words, reps))
              setN(0)
              setShown(false)
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

  return (
    <div className="overlay" style={{ zIndex: 90 }}>
      <Head title={title ?? 'Drill'} onClose={finish} />
      <div className="overlay-head" style={{ paddingTop: 0 }}>
        <div className="step-bar">
          <i style={{ width: `${(n / queue.length) * 100}%` }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>
          {Math.min(n + 1, queue.length)}/{queue.length}
        </span>
      </div>

      <div
        className="overlay-body"
        key={n}
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <button
          className="card zh"
          onClick={reveal}
          aria-label={shown ? undefined : `Reveal ${zh}`}
          style={{
            background: 'var(--paper)',
            borderRadius: 26,
            padding: 26,
            textAlign: 'center',
            width: '100%',
            display: 'block',
            cursor: shown ? 'default' : 'pointer',
          }}
        >
          <div
            style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-1px' }}
            lang="zh-CN"
          >
            {zh}
          </div>

          {shown ? (
            <div className="pop" style={{ marginTop: 14 }}>
              <div style={{ color: 'var(--warm-hot)', fontWeight: 800, fontSize: 22 }}>
                {word?.pinyin}
              </div>
              <div style={{ fontSize: 17, fontWeight: 600, marginTop: 8, lineHeight: 1.4 }}>
                {word?.en}
              </div>
              {example && (
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: '1px solid var(--line-3)',
                    textAlign: 'left',
                  }}
                >
                  <div className="zh" style={{ fontSize: 15, lineHeight: 1.7 }} lang="zh-CN">
                    {example.zh}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>
                    {example.en}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 16 }}>Tap to reveal</div>
          )}
        </button>

        <div className="row" style={{ justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <button className="icon-round tap44" onClick={() => speak(zh)} aria-label="Hear it">
            <SpeakerIcon />
          </button>
          <SaveStar zh={zh} lesson={word ? undefined : 0} size={22} />
        </div>
      </div>

      <div className="overlay-foot">
        {shown ? (
          <div className="grid2">
            <button className="rating" data-k="again" onClick={again}>
              Again
            </button>
            <button className="rating" data-k="good" onClick={gotIt}>
              Got it
            </button>
          </div>
        ) : (
          <button className="btn" onClick={reveal}>
            Show answer
          </button>
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
