import { reviewRatings } from '../lib/practiceExperience'
import { StudyMusic } from '../components/StudyMusic'
import { RepairEditor } from '../components/RepairEditor'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { HearButton } from '../components/Hear'
import { CloseIcon } from '../components/Icons'
import { exampleFor, lessonOf, lookup, vocabIndex } from '../lib/content'
import { t } from '../lib/i18n'
import { matchesHanzi } from '../lib/mastery'
import { isComfortable, wordState } from '../lib/learningEngine'
import { dueCards, intervalText, newCard, schedule, type Rating, type Skill } from '../lib/srs'
import { prefetch, stopSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import '../styles/recall-focus.css'

const WritingRecall = lazy(() =>
  import('../components/WritingRecall').then((m) => ({ default: m.WritingRecall })),
)
const LABELS = { again: t('Again'), hard: t('Hard'), good: t('Good'), easy: t('Easy') }
const SKILLS: Record<Skill, string> = {
  recall: t('Bring back the word'),
  reading: t('Read and remember'),
  listening: t('Listen and remember'),
  writing: t('Write from memory'),
  speaking: t('Say it from memory'),
}
export function ReviewFlow({
  words,
  title,
  onClose,
  placement = false,
}: {
  words?: string[]
  title?: string
  onClose: () => void
  placement?: boolean
}) {
  const store = useStore()
  const initial = useMemo(
    () =>
      placement
        ? (words?.length
            ? words
            : store.learningTrail.length
              ? store.learningTrail.filter((zh) => !store.cards[zh]?.baseline && !isComfortable(store, zh))
              : vocabIndex.slice(0, 12).map((w) => w.zh)
          )
            .filter((w) => lookup(w))
            .slice(0, 12)
        : words?.length
          ? [...new Set(words)].filter((w) => lookup(w))
          : dueCards(store.cardList)
              .slice(0, 12)
              .map((c) => c.zh),
    [],
  )
  const [queue] = useState(initial),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false),
    [checked, setChecked] = useState(false),
    [missed, setMissed] = useState(false)
  const [shownAt, setShownAt] = useState(0),
    [ratingReady, setRatingReady] = useState(false)
  const [completed, setCompleted] = useState(0),
    [undo, setUndo] = useState<{ id: string; index: number } | null>(null)
  const committed = useRef(false)
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID())
  const zh = queue[index],
    word = zh ? lookup(zh) : undefined
  const [skillOverride, setSkillOverride] = useState<Skill | null>(null)
  const [helped, setHelped] = useState(false),
    [hadMiss, setHadMiss] = useState(false)
  const skill: Skill = skillOverride ?? (placement ? 'recall' : (store.cards[zh]?.skill ?? 'recall'))
  const selfMode = skill === 'reading' || skill === 'speaking'
  const ratings = reviewRatings({ hadMiss, checked, helped, selfMode })
  const card = zh ? (wordState(store, zh).skills[skill] ?? newCard(zh, lessonOf(zh) ?? 0)) : undefined
  const example = zh ? exampleFor(zh) : null
  const now = shownAt || Date.now()
  const previews = card
    ? Object.fromEntries(
        (Object.keys(LABELS) as Rating[]).map((r) => [
          r,
          schedule(
            card,
            hadMiss ? 'again' : ((!checked && !selfMode) || helped) && r !== 'again' ? 'hard' : r,
            now,
            placement && checked && !missed && !helped,
          ),
        ]),
      )
    : {}
  useEffect(() => {
    stopSpeech()
    setSkillOverride(null)
    setHelped(false)
    setHadMiss(false)
    setAnswer('')
    setRevealed(false)
    setChecked(false)
    setMissed(false)
    setShownAt(0)
    setRatingReady(false)
    committed.current = false
    setAttemptId(crypto.randomUUID())
    const next = queue[index + 1]
    if (next) prefetch(next)
    return () => stopSpeech()
  }, [index, queue])
  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRatingReady(true), 260)
    return () => clearTimeout(timer)
  }, [revealed])
  function reveal() {
    setRevealed(true)
    setShownAt(Date.now())
    setRatingReady(false)
  }
  function check() {
    if (!answer.trim() || revealed || !zh) return
    const correct = matchesHanzi(answer, zh)
    setChecked(correct)
    setMissed(!correct)
    if (!correct) setHadMiss(true)
    reveal()
  }
  function rate(rating: Rating) {
    if (!ratingReady || committed.current || !zh) return
    if (!ratings.includes(rating)) return
    committed.current = true
    const actual = hadMiss
      ? 'again'
      : ((!checked && !selfMode) || helped) && rating !== 'again'
        ? 'hard'
        : rating
    const evidence = hadMiss
      ? 'checked'
      : checked
        ? placement && !missed && !helped
          ? 'placement'
          : 'checked'
        : 'self-report'
    const id = store.reviewWord(zh, actual, {
      skill,
      evidence,
      assisted: helped || (!checked && !hadMiss && !selfMode),
      eventId: attemptId,
      at: now,
    })
    if (!id) {
      committed.current = false
      return
    }
    stopSpeech()
    setUndo({ id, index })
    setCompleted((n) => n + 1)
    setIndex((n) => n + 1)
  }
  function undoLast() {
    if (!undo) return
    if (!store.undoReview(undo.id)) return
    setIndex(undo.index)
    setCompleted((n) => Math.max(0, n - 1))
    setUndo(null)
  }
  const empty = queue.length === 0,
    done = index >= queue.length
  return (
    <div
      className="overlay recall-focus"
      data-focus-session
      role="dialog"
      aria-modal="true"
      aria-label={t('Recall')}
    >
      <header className="focus-head">
        <button className="focus-icon" onClick={onClose} aria-label={t('Close review')}>
          <CloseIcon />
        </button><StudyMusic compact />
        <span>{placement ? t('Quick placement') : (title ?? t('Recall'))}</span>
        {undo ? (
          <button className="focus-link" onClick={undoLast}>
            {t('Undo')}
          </button>
        ) : (
          <span className="focus-count">
            {empty ? '' : Math.min(index + 1, queue.length) + ' / ' + queue.length}
          </span>
        )}
      </header>
      {!empty && !done && (
        <div className="focus-progress" aria-label={t('Session progress')}>
          <i style={{ transform: `scaleX(${index / queue.length})` }} />
        </div>
      )}
      <main className="focus-body" key={index}>
        {empty || done ? (
          <div className="focus-complete">
            <div className="focus-glyph" lang="zh-CN">
              {empty ? '闲' : '记'}
            </div>
            <p className="focus-eyebrow">{empty ? t('You have room to breathe') : t('A little stronger')}</p>
            <h1>{empty ? t('Nothing is due.') : t('Enough for today.')}</h1>
            <p>
              {empty
                ? t('Strong words are resting. Come back when they need you.')
                : t('{n} words reviewed. Your next dates are saved.', { n: completed })}
            </p>
            <button className="focus-primary" onClick={onClose}>
              {t('Back to learning')}
            </button>
          </div>
        ) : (
          <>
            <div className="focus-prompt">
              <p className="focus-eyebrow">
                {placement ? t('Already know this? Prove it once.') : SKILLS[skill]}
              </p>
              {skill === 'listening' ? (
                <HearButton text={zh} label={t('Listen to the word')} />
              ) : (
                <h1 lang={skill === 'reading' ? 'zh-CN' : undefined}>
                  {skill === 'reading' ? zh : (word?.en ?? t('Word unavailable'))}
                </h1>
              )}
              <p className="focus-instruction">
                {selfMode
                  ? t('Recall it first. Reveal when you are ready.')
                  : skill === 'writing'
                    ? t('Draw the Hanzi without a hint.')
                    : t('Type the Hanzi without a hint.')}
              </p>
            </div>
            {!revealed && skill === 'writing' && word && (
              <Suspense fallback={<p role="status">{t('Loading writing pad…')}</p>}>
                <WritingRecall
                  word={word}
                  onAttempt={(correct, assisted) => {
                    setChecked(correct)
                    setMissed(!correct)
                    if (!correct) setHadMiss(true)
                    setHelped(assisted)
                    reveal()
                  }}
                  onType={() => setSkillOverride('recall')}
                />
              </Suspense>
            )}
            {!revealed && !selfMode && skill !== 'writing' && (
              <form
                className="focus-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  check()
                }}
              >
                <label className="sr-only" htmlFor="recall-answer">
                  {t('Your answer')}
                </label>
                <input
                  id="recall-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229))
                      e.preventDefault()
                  }}
                  placeholder={t('Your answer')}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  lang="zh-CN"
                />
                <button type="submit" className="focus-primary" disabled={!answer.trim()}>
                  {t('Check answer')}
                </button>
              </form>
            )}
            {!revealed && <div className="focus-help-actions">
              <button className="focus-link focus-reveal" onClick={reveal}>{t('Show answer')}</button>
              <button className="focus-link focus-reveal" onClick={() => { stopSpeech(); setIndex(current => current + 1) }}>{t('Skip for now')}</button>
            </div>}
            {revealed && missed && answer && (
              <RepairEditor
                key={answer}
                response={answer}
                reference={zh}
                exact
                onApply={(next) => {
                  setAnswer(next)
                  setHelped(true)
                  setChecked(matchesHanzi(next, zh))
                  setMissed(!matchesHanzi(next, zh))
                  setShownAt(Date.now())
                }}
              />
            )}
            {revealed && !missed && (
              <section className="focus-answer" aria-live="polite">
                <p className="focus-eyebrow">
                  {helped
                    ? t('Retrieved with support')
                    : checked
                      ? t('Recalled without help')
                      : missed
                        ? t('A word to rebuild')
                        : t('Self-check · no verified answer')}
                </p>
                <h2 lang="zh-CN">{zh}</h2>
                <p className="focus-pinyin">{word?.pinyin}</p>
                <p>{word?.en}</p>
                <HearButton text={zh} label={t('Hear the word')} />
                {example && (
                  <details>
                    <summary>{t('See it in context')}</summary>
                    <p lang="zh-CN">{example.zh}</p>
                    <p>{example.en}</p>
                    <HearButton text={example.zh} label={t('Hear the line')} />
                  </details>
                )}
              </section>
            )}
            <details className="focus-why">
              <summary>{t('Why this word?')}</summary>
              <p>
                {placement
                  ? t('A short check for words you already know. Passing starts a two-week baseline.')
                  : words?.length
                    ? t(
                        'You chose this practice. Early successful practice does not inflate the next interval.',
                      )
                    : t('This skill is due. Other skills keep their own progress.')}
              </p>
            </details>
          </>
        )}
      </main>
      {!empty && !done && revealed && (
        <footer className="focus-foot">
          {ratings.length === 1 ? <>
            <button className="focus-primary focus-repaired" disabled={!ratingReady} onClick={() => rate('again')}>
              {checked ? t('Save the correction') : t('Continue · review again soon')}
              <span className="focus-next-date">{previews.again ? intervalText(previews.again.due, now) : ''}</span>
            </button>
            <p>{checked ? t('Repaired with help. We will check it again soon.') : t('You can repair the answer above or continue for now.')}</p>
          </> : <>
            <div className="focus-ratings" style={{ gridTemplateColumns: `repeat(${ratings.length}, minmax(0, 1fr))` }}>
              {ratings.map(r => <button key={r} data-rating={r} disabled={!ratingReady} onClick={() => rate(r)}>
                <strong>{r === 'hard' && !checked && !selfMode ? t('Seen with help') : LABELS[r]}</strong>
                <span>{previews[r] ? intervalText(previews[r].due, now) : ''}</span>
              </button>)}
            </div>
            <p>{ratings.length === 2 ? t('Kept as assisted practice. Try it independently another day.') : t('Choose how the recall felt. Dates adapt to your history.')}</p>
          </>}

        </footer>
      )}
    </div>
  )
}
