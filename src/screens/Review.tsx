import { useEffect, useMemo, useState } from 'react'
import { Glossed, useGloss } from '../components/ChineseText'
import { CheckIcon, CloseIcon, SpeakerIcon } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { exampleFor, lookup } from '../lib/content'
import { speak } from '../lib/speech'
import { dueCards, type Card, type Rating } from '../lib/srs'
import { useStore } from '../store/store'

const SESSION = 8
const XP_PER_CARD = 4
/** ratings are only tappable this long after reveal, to stop a double-tap misfire */
const GUARD_MS = 260

const RATINGS: { key: Rating; label: string; hint: string }[] = [
  { key: 'again', label: 'Again', hint: '<1 min' },
  { key: 'hard', label: 'Hard', hint: '1 d' },
  { key: 'good', label: 'Good', hint: 'on track' },
  { key: 'easy', label: 'Easy', hint: '3 d+' },
]

export function ReviewFlow({
  words,
  title,
  onClose,
}: {
  words?: string[]
  title?: string
  onClose: () => void
}) {
  const store = useStore()
  const { onWord, sheet } = useGloss()

  // Scoped list (from a lesson) is explicit practice; otherwise pull what's due.
  // With nothing due, we fall back to practising early — but in that "practice"
  // mode we must not push not-yet-due cards further out (see rate()).
  const { initial, practiceMode } = useMemo(() => {
    if (words && words.length) return { initial: words, practiceMode: true }
    const due = dueCards(store.cardList)
    if (due.length) return { initial: due.slice(0, SESSION).map((c) => c.zh), practiceMode: false }
    const pool = store.cardList.slice().sort((a, b) => a.due - b.due)
    return { initial: pool.slice(0, SESSION).map((c) => c.zh), practiceMode: true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live queue: 'again' pushes the word back on so it genuinely re-tests.
  const [queue, setQueue] = useState<string[]>(initial)
  const [n, setN] = useState(0)
  const [shown, setShown] = useState(false)
  const [canRate, setCanRate] = useState(false)
  const [rated, setRated] = useState(0)
  const [recalled, setRecalled] = useState(0)
  // Full snapshot so Undo can reverse the queue mutation an 'again' performs.
  const [undo, setUndo] = useState<{
    zh: string
    card: Card
    wasRecalled: boolean
    queue: string[]
    n: number
  } | null>(null)

  // Briefly lock the ratings after reveal so a fast double-tap can't misfire.
  // Re-armed synchronously in reveal() too, so card 2+ isn't tappable for the
  // one frame before this effect runs.
  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setCanRate(true), GUARD_MS)
    return () => clearTimeout(t)
  }, [shown, n])

  if (queue.length === 0) {
    return (
      <div className="overlay">
        <Head title={title ?? 'Review'} onClose={onClose} />
        <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 700 }}>Nothing to review yet</p>
            <p className="sub">Finish a lesson or save a word and it lands here.</p>
          </div>
        </div>
        <div className="overlay-foot">
          <button className="btn" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    )
  }

  const done = n >= queue.length
  const zh = queue[Math.min(n, queue.length - 1)]
  const word = lookup(zh)
  const example = exampleFor(zh)

  function reveal() {
    if (shown) return
    setCanRate(false) // arm the guard in the same commit that reveals the card
    setShown(true)
    speak(zh)
  }

  function rate(rating: Rating) {
    if (!canRate) return
    const prevCard = store.cards[zh]
    const isRecalled = rating !== 'again'
    // Snapshot BEFORE any mutation so Undo restores the exact prior session state.
    setUndo(prevCard ? { zh, card: prevCard, wasRecalled: isRecalled, queue, n } : null)
    // Practice mode leaves the SRS schedule untouched; it only logs the rep.
    if (practiceMode) store.practiceLog()
    else store.rate(zh, rating)
    if (rating === 'again') {
      // re-test this word later in the same session
      setQueue((q) => {
        const rest = q.slice(n + 1)
        rest.splice(Math.min(rest.length, 2), 0, zh)
        return [...q.slice(0, n + 1), ...rest]
      })
    } else {
      store.awardXp(XP_PER_CARD)
      setRecalled((r) => r + 1)
    }
    setRated((r) => r + 1)
    setShown(false)
    setN(n + 1)
  }

  function undoLast() {
    if (!undo) return
    if (!practiceMode) store.restoreCard(undo.zh, undo.card)
    store.undoLog() // both rate() and practiceLog() bumped the day once
    if (undo.wasRecalled) {
      store.awardXp(-XP_PER_CARD)
      setRecalled((r) => Math.max(0, r - 1))
    }
    setRated((r) => Math.max(0, r - 1))
    setQueue(undo.queue) // reverse the 'again' re-insertion
    setN(undo.n)
    setUndo(null)
    setShown(false)
  }

  // Only real (non-practice) sessions may pull in more due cards, since practice
  // mode intentionally never schedules — appending due cards there would strand them.
  function keepGoing() {
    const more = dueCards(store.cardList)
      .map((c) => c.zh)
      .filter((w) => !queue.includes(w))
      .slice(0, SESSION)
    if (more.length === 0) return onClose()
    setQueue((q) => [...q, ...more])
    setShown(false)
  }

  if (done) {
    // Practice sessions never schedule, so they must not absorb real due cards.
    const moreDue = practiceMode
      ? 0
      : dueCards(store.cardList).filter((c) => !queue.includes(c.zh)).length
    return (
      <div className="overlay">
        <Head title={practiceMode && !words ? 'Practice' : (title ?? 'Review')} onClose={onClose} />
        <div className="overlay-body" style={{ textAlign: 'center', paddingTop: 40 }}>
          <div className="medal pop">
            <CheckIcon size={46} />
          </div>
          <h2 className="h1" style={{ marginTop: 22 }}>
            {practiceMode && words ? 'Nicely practised!' : 'Review complete!'}
          </h2>
          <div className="row" style={{ justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <span className="pill-ink">{rated} reviewed</span>
            <span className="pill-ink">
              {rated ? Math.round((recalled / rated) * 100) : 0}% recalled
            </span>
            <span className="pill-ink">+{recalled * XP_PER_CARD} XP</span>
          </div>
          {moreDue > 0 && (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
              {moreDue} more still due today.
            </p>
          )}
        </div>
        <div className="overlay-foot" style={{ display: 'grid', gap: 10 }}>
          {moreDue > 0 && (
            <button className="btn" onClick={keepGoing}>
              Keep going — {moreDue} more
            </button>
          )}
          <button className={moreDue > 0 ? 'btn btn-ghost' : 'btn'} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    )
  }

  const locked = shown && !canRate

  return (
    <div className="overlay">
      <Head
        title={practiceMode && !words ? 'Practice' : (title ?? 'Review')}
        onClose={onClose}
        onUndo={undo ? undoLast : undefined}
      />
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
        key={`${zh}-${n}`}
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <button
          className="card"
          onClick={reveal}
          aria-label={shown ? undefined : `Reveal ${zh}`}
          disabled={shown}
          style={{
            background: 'var(--paper)',
            borderRadius: 26,
            padding: shown ? '22px 26px' : 26,
            textAlign: 'center',
            width: '100%',
            display: 'block',
            cursor: shown ? 'default' : 'pointer',
          }}
        >
          <div
            className="zh"
            style={{
              fontSize: shown ? 64 : 88,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-1px',
              transition: 'font-size .25s',
            }}
            lang="zh-CN"
          >
            {zh}
          </div>
          {!shown && (
            <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 16 }}>Tap to reveal</div>
          )}
        </button>

        {shown && (
          <div className="pop card" style={{ marginTop: 12, padding: 20 }}>
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: 'var(--warm-hot)', fontWeight: 800, fontSize: 22 }}>
                  {word?.pinyin}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>
                  {word?.en}
                </div>
                {word?.pos && (
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 5 }}>{word.pos}</div>
                )}
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button className="icon-round tap44" onClick={() => speak(zh)} aria-label="Hear it">
                  <SpeakerIcon />
                </button>
                <SaveStar zh={zh} lesson={word ? undefined : 0} size={22} />
              </div>
            </div>

            {example && (
              <div
                style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-3)' }}
              >
                <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div className="kicker-ink">From the book</div>
                  <button
                    className="icon-round tap44"
                    style={{ flex: 'none' }}
                    onClick={() => speak(example.zh)}
                    aria-label="Play example"
                  >
                    <SpeakerIcon size={16} />
                  </button>
                </div>
                <div className="zh" style={{ fontSize: 16, lineHeight: 1.7, marginTop: 4 }} lang="zh-CN">
                  <Glossed text={example.zh} onWord={onWord} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 5 }}>
                  {example.pinyin}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{example.en}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="overlay-foot">
        {shown ? (
          <div className="grid2" style={{ opacity: locked ? 0.5 : 1, transition: 'opacity .2s' }}>
            {RATINGS.map((r) => (
              <button
                key={r.key}
                className="rating"
                data-k={r.key}
                disabled={locked}
                onClick={() => rate(r.key)}
              >
                {r.label}
                <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, marginTop: 2 }}>
                  {r.hint}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <button className="btn" onClick={reveal}>
            Show answer
          </button>
        )}
      </div>

      {sheet}
    </div>
  )
}

function Head({
  title,
  onClose,
  onUndo,
}: {
  title: string
  onClose: () => void
  onUndo?: () => void
}) {
  return (
    <div className="overlay-head">
      <button className="icon-round tap44" onClick={onClose} aria-label="Close review">
        <CloseIcon />
      </button>
      <strong style={{ fontSize: 15, flex: 1 }}>{title}</strong>
      {onUndo && (
        <button
          className="pill-ink tap44"
          onClick={onUndo}
          style={{ height: 32 }}
          aria-label="Undo last rating"
        >
          ↶ Undo
        </button>
      )}
    </div>
  )
}
