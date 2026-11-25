import { reviewRatings } from '../lib/practiceExperience'
import { StudyMusic } from '../components/StudyMusic'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { HearButton } from '../components/Hear'
import { ListenCue } from '../components/ListenCue'
import { CloseIcon } from '../components/Icons'
import { blankedExample, corpusPeers, enrichVocab, exampleFor, lessonOf, lookup, vocabIndex } from '../lib/content'
import { getLang, t } from '../lib/i18n'
import { matchesHanzi } from '../lib/mastery'
import { isComfortable, wordState } from '../lib/learningEngine'
import { normalizeChinese } from '../lib/production'
import { buildRecallPromptContext, nearSynonymFeedback, type NearSynonymMatch } from '../lib/recallContext'
import {
  getLearnerGraphSnapshot,
  prioritizeWords,
  priorityScore,
  skippedWordsForRecall,
  wordNodeId,
} from '../lib/learnerGraph'
import { DAY, dueCards, newCard, recallChance, schedule, whenText, type Card, type Skill } from '../lib/srs'
import { BOOK_STYLE, bookOf, recallChoices, timelinePosition, type RecallChoice } from '../lib/recallPlan'
import { prefetch, stopSpeech } from '../lib/speech'
import { bundledDictionaryEntry } from '../lib/dictionary'
import { playCorrect, playHint, playRate, playReveal, playWrong } from '../lib/sfx'
import { useStagedReveal } from '../components/useStagedReveal'
import { DAILY_GOAL, useStore } from '../store/store'
import '../styles/recall-focus.css'
import { Fireworks } from '../components/Fireworks'
import { Flame } from '../components/Flame'
import { GoalRing } from '../components/TodayHud'

const WritingRecall = lazy(() =>
  import('../components/WritingRecall').then((m) => ({ default: m.WritingRecall })),
)
const LABELS: Record<RecallChoice['key'], string> = {
  again: t('Again'),
  hard: t('Hard'),
  good: t('Good'),
  easy: t('Easy'),
  blank: t('Totally blank'),
  fuzzy: t('Fuzzy'),
  almost: t('Almost had it'),
  continue: t('Continue'),
}
const MEMORY_STEPS = [t('New'), t('1 day'), t('7 days'), t('1 month')]
const ANSWER_STAGES = [0, 520, 1050] as const
const TICKS = [
  { label: t('Now'), at: 0 },
  { label: t('1 day'), at: DAY },
  { label: t('1 week'), at: 7 * DAY },
  { label: t('1 month'), at: 30 * DAY },
  { label: t('6 months'), at: 182 * DAY },
]

/** Which rung of New → 1 day → 7 days → 1 month the word sits on right now. */
function memoryStage(card: Card | undefined): number {
  if (!card || !card.reps || card.lastReview === undefined) return 0
  const days = (card.due - card.lastReview) / DAY
  return days >= 28 ? 3 : days >= 6 ? 2 : 1
}

function dateText(at: number, now: number) {
  const locale = getLang() === 'id' ? 'id-ID' : 'en-GB'
  const day = new Date(at)
  if (day.toDateString() === new Date(now).toDateString())
    return `${t('today')} ${day.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
  return day.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Only words with a meaning and pinyin can be recalled; missing ones get one bundled-dictionary lookup. */
const usable = (zh: string) => {
  const entry = lookup(zh)
  return !!(entry?.en?.trim() && entry.pinyin?.trim())
}
const QUEUE_SIZE = 12
const LOOKUP_POOL = 30

/** One verdict per attempt, shown as a colour and a short word. */
type Verdict = 'correct' | 'helped' | 'wrong' | 'unknown' | 'self'

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
  const graph = store.learnerGraph ?? getLearnerGraphSnapshot()
  const candidates = useMemo(() => {
    if (words?.length) return [...new Set(words)].slice(0, LOOKUP_POOL)
    if (placement) {
      const base = store.learningTrail.length
        ? store.learningTrail.filter((zh) => !store.cards[zh]?.baseline && !isComfortable(store, zh))
        : vocabIndex.slice(0, QUEUE_SIZE).map((w) => w.zh)
      return prioritizeWords(graph, base).slice(0, LOOKUP_POOL)
    }
    const dueList = dueCards(store.cardList).map((c) => c.zh)
    const skippedList = skippedWordsForRecall(graph).filter((w) => !isComfortable(store, w))
    const weakGraphWords = Object.values(graph.nodes)
      .filter((n) => n.kind === 'word' && priorityScore(graph, n.label) >= 1.5 && !isComfortable(store, n.label))
      .map((n) => n.label)
    const combined = [...new Set([...dueList, ...skippedList, ...weakGraphWords])]
    return prioritizeWords(graph, combined).slice(0, LOOKUP_POOL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [queue, setQueue] = useState<string[] | null>(() =>
    candidates.every(usable) ? candidates.slice(0, QUEUE_SIZE) : null,
  )
  useEffect(() => {
    if (queue) return
    let live = true
    const missing = candidates.filter((zh) => !usable(zh))
    void Promise.race([
      Promise.allSettled(missing.map((zh) => bundledDictionaryEntry(zh))),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]).then(() => {
      if (live) setQueue(candidates.filter(usable).slice(0, QUEUE_SIZE))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const list = queue ?? []
  const [index, setIndex] = useState(0),
    [answer, setAnswer] = useState(''),
    [tried, setTried] = useState('')
  const [revealed, setRevealed] = useState(false),
    [checked, setChecked] = useState(false)
  const [shownAt, setShownAt] = useState(0),
    [ratingReady, setRatingReady] = useState(false)
  const [completed, setCompleted] = useState(0),
    [undo, setUndo] = useState<{ id: string; index: number } | null>(null)
  const committed = useRef(false)
  const [attemptId, setAttemptId] = useState(() => crypto.randomUUID())
  const zh = list[index],
    rawWord = zh ? lookup(zh) : undefined
  const [skillOverride, setSkillOverride] = useState<Skill | null>(null)
  const [helped, setHelped] = useState(false),
    [hadMiss, setHadMiss] = useState(false),
    [gaveUp, setGaveUp] = useState(false)
  const [hint, setHint] = useState(0)
  const [focusKey, setFocusKey] = useState<RecallChoice['key'] | null>(null)
  const [synonymMatch, setSynonymMatch] = useState<NearSynonymMatch | null>(null)
  const triedSynonyms = useRef(new Set<string>())
  const answerInputRef = useRef<HTMLInputElement>(null)
  const skill: Skill = skillOverride ?? (placement ? 'recall' : (store.cards[zh]?.skill ?? 'recall'))
  const selfMode = skill === 'reading' || skill === 'speaking'
  const allowed = reviewRatings({ hadMiss, checked, helped, selfMode })
  const failed = hadMiss || gaveUp
  const choices = recallChoices({ failed, hints: hint, selfMode, allowed })
  const verdict: Verdict = selfMode ? 'self' : hadMiss ? 'wrong' : gaveUp ? 'unknown' : helped || !checked ? 'helped' : 'correct'
  const card = zh ? (wordState(store, zh).skills[skill] ?? newCard(zh, lessonOf(zh) ?? 0)) : undefined
  const example = zh ? exampleFor(zh) : null
  const stage = memoryStage(card)
  const { book, unit } = bookOf(store.cards[zh]?.lesson ?? card?.lesson)
  const word = rawWord ? enrichVocab(rawWord, lessonOf(zh) ?? unit) : undefined
  const peers = useMemo(() => corpusPeers(), [])
  const style = skill === 'recall' ? BOOK_STYLE[book] : 'meaning'
  const hideMeaning = skill === 'listening' || style === 'dictation'
  const rawBlank = zh && skill !== 'reading' && !hideMeaning ? blankedExample(zh, lessonOf(zh) ?? unit) : null
  const ctx = word && skill !== 'reading'
    ? buildRecallPromptContext({ word, blanked: rawBlank, peers, hideMeaning })
    : null
  const safeMeaning = ctx ? (ctx.otherMeanings ? `${ctx.coreMeaning}; ${ctx.otherMeanings}` : ctx.coreMeaning) : (word?.en ?? '')
  const hintSteps = style === 'dictation' ? (['meaning', 'first'] as const) : (['pinyin', 'first'] as const)
  const answerReveal = useStagedReveal(ANSWER_STAGES, `${index}:${zh}`, revealed)
  const now = shownAt || Date.now()
  const placementPass = placement && checked && !hadMiss && !helped
  const previews = card
    ? Object.fromEntries(choices.map((choice) => [choice.key, schedule(card, choice.rating, now, placementPass, choice.delayDays)]))
    : {}
  const chance = recallChance(card, now)
  const history = useMemo(() => {
    const learning = store.learning
    if (!zh || !learning) return { right: 0, total: 0 }
    const events = Object.values(learning.events).filter((e) => e.zh === zh && !learning.undone[e.id] && e.evidence !== 'unverified')
    return { right: events.filter((e) => e.rating !== 'again').length, total: events.length }
  }, [store.learning, zh])
  const ifRight = card && !selfMode ? schedule(card, hint ? 'hard' : 'good', now, placement && !hint, hint >= 2 ? 1 : undefined) : null
  const activeKey = focusKey && choices.some((c) => c.key === focusKey) ? focusKey : (choices.find((c) => c.key === 'good' || c.key === 'fuzzy') ?? choices[0])?.key
  const bookLabel =
    book === 'kerja'
      ? `Kerja · ${t('Chapter {n}', { n: unit })}`
      : book === 'jiaocheng'
        ? `汉语教程 · ${t('Lesson {n}', { n: unit })}`
        : (lessonOf(zh) ?? unit)
          ? t('Lesson {n}', { n: lessonOf(zh) ?? unit })
          : ''
  useEffect(() => {
    stopSpeech()
    setSkillOverride(null)
    setHelped(false)
    setHadMiss(false)
    setGaveUp(false)
    setHint(0)
    setFocusKey(null)
    setSynonymMatch(null)
    triedSynonyms.current.clear()
    setAnswer('')
    setTried('')
    setRevealed(false)
    setChecked(false)
    setShownAt(0)
    setRatingReady(false)
    committed.current = false
    setAttemptId(crypto.randomUUID())
    const next = list[index + 1]
    if (next) prefetch(next)
    return () => stopSpeech()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const cleaned = normalizeChinese(answer)
    if (!answer.trim() || revealed || !zh) return
    const correct = matchesHanzi(answer, zh)
    if (!correct && word && cleaned && !triedSynonyms.current.has(cleaned)) {
      const synonym = nearSynonymFeedback(answer, word, peers)
      if (synonym) {
        triedSynonyms.current.add(cleaned)
        store.recordNearSynonymConfusion(zh, synonym.typedZh)
        setSynonymMatch(synonym)
        setAnswer('')
        answerInputRef.current?.focus()
        return
      }
    }
    setSynonymMatch(null)
    setTried(answer.trim())
    setChecked(correct)
    if (!correct) setHadMiss(true)
    if (correct) playCorrect()
    else playWrong()
    reveal()
  }
  function dontKnow() {
    if (revealed) return
    setGaveUp(true)
    playReveal()
    reveal()
  }
  /** Pinyin (or the meaning, for dictation), then the first character, then the answer itself. */
  function nextHint() {
    if (revealed) return
    setHelped(true)
    if (hint >= hintSteps.length) {
      dontKnow()
      return
    }
    playHint()
    setHint((value) => value + 1)
  }
  function rate(choice: RecallChoice) {
    if (!ratingReady || committed.current || !zh) return
    committed.current = true
    const evidence = hadMiss ? 'checked' : checked ? (placementPass ? 'placement' : 'checked') : 'self-report'
    const id = store.reviewWord(zh, choice.rating, {
      skill,
      evidence,
      assisted: helped || gaveUp || (!checked && !hadMiss && !selfMode),
      eventId: attemptId,
      at: now,
      delayDays: choice.delayDays,
    })
    if (!id) {
      committed.current = false
      return
    }
    stopSpeech()
    playRate()
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
  const loading = queue === null
  const empty = !loading && list.length === 0,
    done = !loading && index >= list.length
  const first = zh ? Array.from(zh) : []
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
            {loading || empty ? '' : Math.min(index + 1, list.length) + ' / ' + list.length}
          </span>
        )}
      </header>
      {!loading && !empty && !done && (
        <div className="focus-progress" aria-label={t('Session progress')}>
          <i style={{ transform: `scaleX(${index / list.length})` }} />
        </div>
      )}
      <main className="focus-body" key={index}>
        {loading ? (
          <p className="focus-loading" role="status">{t('Loading…')}</p>
        ) : empty || done ? (
          <div className="focus-complete">
            <div className="focus-glyph" lang="zh-CN">
              {empty ? '闲' : '记'}
            </div>
            <h1>{empty ? t('Nothing is due.') : t('Enough for today.')}</h1>
            {done && <p>{t('{n} words reviewed. Your next dates are saved.', { n: completed })}</p>}
            {done && completed > 0 && <ReviewWin />}
            <button className="focus-primary" onClick={onClose}>
              {t('Back to learning')}
            </button>
          </div>
        ) : (
          <div className="focus-stage" data-verdict={revealed ? verdict : 'asking'} data-style={style}>
            <div className="focus-where" aria-label={t('Where this word is')}>
              <div className="focus-chips">
                {bookLabel && <span className="focus-lesson">{bookLabel}</span>}
                {zh && graph.nodes[wordNodeId(zh)]?.skippedPending && (
                  <span className="focus-skipped-pill">{t('Skipped · Active recall')}</span>
                )}
                {chance !== null && (
                  <span className="focus-chance" data-level={chance >= 0.8 ? 'high' : chance >= 0.5 ? 'mid' : 'low'} title={t('Chance you still remember it now')}>
                    <i style={{ ['--chance' as string]: chance }} aria-hidden="true" />
                    {t('Memory {n}%', { n: Math.round(chance * 100) })}
                  </span>
                )}
                {history.total > 0 && <span className="focus-history">{t('{right} of {total} right', history)}</span>}
              </div>
              <ol className="focus-ladder" aria-label={t('Memory stage')}>
                {MEMORY_STEPS.map((label, step) => (
                  <li key={label} data-state={step < stage ? 'past' : step === stage ? 'now' : 'next'} aria-current={step === stage ? 'step' : undefined}>
                    <i />
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
            </div>
            {!revealed && (
              <div className="focus-prompt">
                {ctx && (ctx.posLabel || ctx.charCountLabel) && (
                  <div className="recall-meta-pills focus-meta-pills">
                    {ctx.posLabel && <span className="recall-pos-pill">{ctx.posLabel}</span>}
                    <span className="recall-slot-pill">
                      {ctx.charCountLabel}
                      <span className="recall-slots-preview zh" lang="zh-CN" aria-hidden="true">{ctx.slots}</span>
                    </span>
                  </div>
                )}
                {hideMeaning ? (
                  <>
                    <ListenCue text={zh} />
                    <p className="focus-prompt-note">{t('Write the word you hear')}</p>
                  </>
                ) : skill === 'reading' ? (
                  <h1 lang="zh-CN">{zh}</h1>
                ) : (
                  <>
                    <h1>{ctx?.coreMeaning || word?.en}</h1>
                    {ctx?.otherMeanings && <p className="recall-other-meanings">{ctx.otherMeanings}</p>}
                    {ctx?.sentence && (
                      <div className="focus-sentence">
                        <p lang="zh-CN">{ctx.sentence.zh}</p>
                        {ctx.sentence.en && <p className="focus-sentence-translation">{ctx.sentence.en}</p>}
                      </div>
                    )}
                    {(ctx?.whenCue || ctx?.disambiguation) && (
                      <div className="focus-cue-note">
                        {ctx.whenCue && <p className="recall-when-cue"><span>{t('Usage cue')}</span> {ctx.whenCue}</p>}
                        {ctx.disambiguation && <p className="recall-disambiguation">{ctx.disambiguation}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {!revealed && skill === 'writing' && word && (
              <Suspense fallback={<p role="status">{t('Loading…')}</p>}>
                <WritingRecall
                  word={word}
                  onAttempt={(correct, assisted) => {
                    setChecked(correct)
                    if (!correct) setHadMiss(true)
                    setHelped(assisted)
                    if (correct) playCorrect()
                    else playWrong()
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
                  ref={answerInputRef}
                  id="recall-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229))
                      e.preventDefault()
                  }}
                  placeholder={t('Type the Hanzi here')}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  lang="zh-CN"
                />
                {synonymMatch && (
                  <div className="recall-synonym-feedback focus-synonym-feedback" role="status" aria-live="polite">
                    <strong>{t('Close match — different nuance')}</strong>
                    <p>{synonymMatch.message}</p>
                  </div>
                )}
                {hint > 0 && word && (
                  <div className="focus-hints" aria-live="polite">
                    {hintSteps.slice(0, hint).map((step) => (
                      <div className="focus-hint" key={step}>
                        <span>{step === 'pinyin' ? t('Pinyin') : step === 'meaning' ? t('Meaning') : t('First character')}</span>
                        <strong lang={step === 'first' ? 'zh-CN' : undefined}>
                          {step === 'pinyin' ? word.pinyin : step === 'meaning' ? (safeMeaning || word.en) : `${first[0]}${'＿'.repeat(Math.max(0, first.length - 1))}`}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
                <div className="focus-actions">
                  <button type="button" className="focus-secondary" onClick={nextHint}>
                    {hint >= hintSteps.length ? t('Show answer') : t('Hint')}
                    <span className="focus-hint-steps" aria-hidden="true">
                      {[0, 1, 2].map((step) => <i key={step} data-on={step < hint} />)}
                    </span>
                  </button>
                  <button type="submit" className="focus-primary" disabled={!answer.trim()}>
                    {t('Check')}
                  </button>
                </div>
                {ifRight && (
                  <p className="focus-forecast" key={hint} data-hinted={hint > 0}>
                    <CalendarGlyph />
                    {hint > 0
                      ? t('With this hint: back {when}', { when: whenText(ifRight.due, now) })
                      : t('Right without a hint: back {when}', { when: whenText(ifRight.due, now) })}
                  </p>
                )}
              </form>
            )}
            {!revealed && selfMode && (
              <div className="focus-actions">
                <button className="focus-primary" onClick={() => { playReveal(); reveal() }}>{t('Show answer')}</button>
              </div>
            )}
            {!revealed && !selfMode && (
              <button type="button" className="focus-dunno" onClick={dontKnow}>
                {t("I don't know")}
              </button>
            )}
            {revealed && (
              <section className="focus-answer" aria-live="polite">
                {verdict !== 'self' && (
                  <p className="focus-verdict" data-verdict={verdict}>
                    <span aria-hidden="true">{verdict === 'correct' ? '✓' : verdict === 'wrong' ? '✕' : verdict === 'unknown' ? '?' : '•'}</span>
                    {verdict === 'correct'
                      ? t('Correct')
                      : verdict === 'wrong'
                        ? t('Not quite')
                        : verdict === 'unknown'
                          ? t('Not remembered yet')
                          : t('With a hint')}
                    {verdict === 'wrong' && tried && <s lang="zh-CN">{tried}</s>}
                  </p>
                )}
                <div data-reveal={answerReveal.at(0)} data-reveal-kind="hanzi">
                  <h2 lang="zh-CN">{zh}</h2>
                  <p className="focus-pinyin">{word?.pinyin}</p>
                  <HearButton text={zh} label={t('Hear the word')} />
                </div>
                <p className="focus-meaning" data-reveal={answerReveal.at(1)}>{word?.en}</p>
                {example && (
                  <div className="focus-example" data-reveal={answerReveal.at(2)}>
                    <p lang="zh-CN">{example.zh}</p>
                    {example.en && <p>{example.en}</p>}
                    <HearButton text={example.zh} label={t('Hear the line')} />
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
      {!loading && !empty && !done && revealed && (
        <footer className="focus-foot">
          {failed && !selfMode && <p className="focus-foot-question">{t('How badly did you forget?')}</p>}
          <div className="focus-timeline" aria-hidden="true">
            <div className="focus-timeline-track">
              {TICKS.map((tick) => (
                <span key={tick.label} style={{ left: `${timelinePosition(now + tick.at, now) * 100}%` }}>{tick.label}</span>
              ))}
              {choices.map((choice) =>
                previews[choice.key] ? (
                  <i
                    key={choice.key}
                    data-tone={choice.key}
                    data-active={choice.key === activeKey}
                    style={{ left: `${timelinePosition(previews[choice.key].due, now) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            {activeKey && previews[activeKey] && (
              <p className="focus-timeline-date">
                {t('Next recall')}: <b>{dateText(previews[activeKey].due, now)}</b>
              </p>
            )}
          </div>
          {choices.length === 1 ? (
            <button className="focus-primary focus-continue" disabled={!ratingReady} onClick={() => rate(choices[0])}>
              {LABELS[choices[0].key]}
              <span className="focus-next-date">{previews[choices[0].key] ? whenText(previews[choices[0].key].due, now) : ''}</span>
            </button>
          ) : (
            <div className="focus-ratings" style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}>
              {choices.map((choice) => (
                <button
                  key={choice.key}
                  data-rating={choice.rating}
                  data-tone={choice.key}
                  disabled={!ratingReady}
                  onPointerEnter={() => setFocusKey(choice.key)}
                  onFocus={() => setFocusKey(choice.key)}
                  onClick={() => rate(choice)}
                >
                  <strong>{LABELS[choice.key]}</strong>
                  <span>{previews[choice.key] ? whenText(previews[choice.key].due, now) : ''}</span>
                </button>
              ))}
            </div>
          )}
        </footer>
      )}
    </div>
  )
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  )
}


/** The review ends on the same win as a lesson: streak and today's ring. */
function ReviewWin() {
  const store = useStore()
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setBurst(1), 240)
    return () => window.clearTimeout(timer)
  }, [])
  const goal = store.today.cards / DAILY_GOAL
  return (
    <div className="duo-victory-day focus-win">
      <Fireworks token={burst} />
      <span className="duo-victory-streak"><Flame size={30} /><b>{store.streak}</b><small>{t('day streak')}</small></span>
      <span className="duo-victory-goal">
        <GoalRing value={goal} size={54} stroke={6} />
        <span>
          <b>{goal >= 1 ? t('Daily goal done') : t('{n} of {goal} today', { n: store.today.cards, goal: DAILY_GOAL })}</b>
          <small>{goal >= 1 ? t('Come back tomorrow to keep the flame.') : t('One more session fills the ring.')}</small>
        </span>
      </span>
    </div>
  )
}
