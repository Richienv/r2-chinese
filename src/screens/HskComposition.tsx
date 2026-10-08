import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { HearButton } from '../components/Hear'
import { CloseIcon } from '../components/Icons'
import { exampleFor, hasWordToken, lessons } from '../lib/content'
import { t } from '../lib/i18n'
import { reviewComposition, writingCoverage, type CompositionReview } from '../lib/composition'
import { courseLexicon } from '../lib/grammar/course-lexicon'
import { compositionBundle, learnedHskWords, type PracticeWord } from '../lib/hskPractice'
import { highlightWords, writingHints } from '../lib/writing-hints'
import { stopSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import '../styles/hsk-practice.css'
import '../styles/write.css'

const WORDS = 3

type Draft = { value: string; words: string[] }
function loadDraft(key: string): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!value || typeof value.value !== 'string' || value.value.length > 500 || !Array.isArray(value.words) || value.words.length > 5 || !value.words.every((word: unknown) => typeof word === 'string')) return null
    return value
  } catch { return null }
}

/**
 * Three words, a box, a check. The words, one box to write in, hints taken from the book, a check that lists
 * what looks wrong, and Next, which is always there: a wrong sentence still moves on, because writing it is the point.
 */
export function HskComposition({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const { user } = useAuth()
  const key = `yulu.hsk-writing.v1:${user?.id ?? 'local'}`
  const pool = useMemo(() => learnedHskWords(lessons, store.learningTrail, Object.keys(store.cards)), [store.learningTrail, store.cards])
  const [draft] = useState(() => loadDraft(key))
  const [bundle, setBundle] = useState<PracticeWord[]>(() => {
    const saved = pool.filter((word) => draft?.words.includes(word.zh)).slice(0, WORDS)
    return saved.length ? saved : compositionBundle(pool, store.mastery, 0, WORDS)
  })
  const [value, setValue] = useState(draft?.value ?? '')
  const [round, setRound] = useState(0)
  const [review, setReview] = useState<CompositionReview | null>(null)
  const [hintsOpen, setHintsOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const credited = useRef(new Set<string>())
  const body = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const result = useRef<HTMLElement>(null)
  const words = bundle.map((word) => word.zh)
  const coverage = writingCoverage(value, words)
  const canCheck = bundle.length > 0 && /[㐀-鿿]/.test(value)
  const hints = useMemo(() => writingHints(words, lessons, hasWordToken, 4, (word) => exampleFor(word, bundle.find((entry) => entry.zh === word)?.lesson)), [words.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ value, words })) } catch { /* the draft just is not kept */ }
  }, [key, value, words.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeech(), [])
  useEffect(() => {
    if (review) result.current?.scrollIntoView({ block: 'start', behavior: calm() })
  }, [review])

  function edit(next: string) {
    setValue(next)
    setReview(null)
    setSaved(false)
  }

  function check() {
    if (!canCheck) return
    const found = reviewComposition(value, words, courseLexicon)
    setReview(found)
    const id = `${words.join('|')}\u0001${value}`
    // Credit the effort only for a sentence that uses every word and has no known mistake. It is practice with the
    // words in view, so it never touches mastery.
    if (found.accepted && !found.missing.length && !credited.current.has(id)) {
      credited.current.add(id)
      store.logDrill(Math.max(1, found.used.length), 4)
      setSaved(true)
    }
  }

  /** New words, whatever happened with the last ones. Wrong or not, it moves on. */
  function next() {
    stopSpeech()
    setRound(round + 1)
    setBundle(compositionBundle(pool, store.mastery, round + 1, WORDS))
    setValue('')
    setReview(null)
    setSaved(false)
    setHintsOpen(false)
    body.current?.scrollTo({ top: 0, behavior: calm() })
    textarea.current?.focus({ preventScroll: true })
  }

  const headline = !review ? '' : review.verdict === 'errors' ? review.feedback : review.verdict === 'worth-a-look' ? t('Worth a second look') : t('No common mistakes found.')

  return <section className="overlay hsk-lab mi-room" role="dialog" aria-modal="true" aria-labelledby="mi-title">
    <header className="overlay-head hsk-lab-head">
      <button className="icon-btn" type="button" aria-label={t('Close sentence practice')} onClick={onClose}><CloseIcon size={20} /></button>
      <div><h1 id="mi-title">{t('Make it yours')}</h1></div>
      <span className="writing-head-glyph" aria-hidden="true">写</span>
    </header>
    <div className="overlay-body hsk-lab-body" ref={body}>
      {!pool.length ? <div className="mi-empty"><span lang="zh-CN">从一句开始</span><h2>{t('Your words will meet here.')}</h2><p>{t('Learn or drill a few HSK words. Then use them together in sentences about your own life.')}</p><button className="mi-primary" type="button" onClick={onClose}>{t('Go learn some words')}</button></div> : <>
        <section className="mi-words" aria-label={t('Your word set')}>
          <div className="mi-words-head"><span>{t('Your word set')}</span><button type="button" onClick={next}>{t('Mix words ↻')}</button></div>
          <ul>{bundle.map((word) => {
            const used = coverage.used.includes(word.zh)
            return <li key={word.zh} data-used={used}>
              <strong lang="zh-CN">{word.zh}</strong>
              {store.prefs.showPinyin && <span className="mi-pinyin">{word.pinyin}</span>}
              {store.prefs.showEnglish && <small className="mi-meaning">{word.en}</small>}
              {used && <i className="mi-tick" role="img" aria-label={t('In your draft')}>✓</i>}
            </li>
          })}</ul>
        </section>

        <section className="mi-write">
          <label htmlFor="mi-text">{t('Write a sentence with these words')}</label>
          <textarea id="mi-text" ref={textarea} lang="zh-CN" value={value} maxLength={500} placeholder="写一两句话，把这些词用起来。" onChange={(event) => edit(event.target.value)} />
          <div className="mi-bar">
            <button className="mi-hint-toggle" type="button" aria-expanded={hintsOpen} onClick={() => setHintsOpen(!hintsOpen)}>{hintsOpen ? t('Hide hint') : t('Hint')}</button>
            <button className="mi-primary" type="button" disabled={!canCheck} onClick={check}>{t('Check')}</button>
          </div>
          {hintsOpen && <div className="mi-hints" role="region" aria-label={t('From the book')}>
            <small>{t('From the book')}</small>
            <ul>{hints.map((hint) => <li key={hint.zh}>
              <p lang="zh-CN" className="mi-hint-zh">{highlightWords(hint.zh, words).map((part, index) => part.hit ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>)}</p>
              {store.prefs.showPinyin && hint.pinyin && <p className="mi-hint-pinyin">{hint.pinyin}</p>}
              {store.prefs.showEnglish && hint.en && <p className="mi-hint-meaning">{hint.en}</p>}
              <HearButton text={hint.zh} label={t('Hear it')} className="mi-hear" />
            </li>)}</ul>
          </div>}
        </section>

        {review && <section className="mi-result" ref={result} data-verdict={review.verdict} aria-live="polite">
          <h2><i aria-hidden="true">{review.verdict === 'no-known-errors' ? '✓' : '!'}</i>{headline}</h2>
          {review.corrections.map((correction, index) => <article className="mi-fix" key={index} data-severity={correction.severity}>
            <small>{correction.rule}</small>
            <p className="mi-change" lang="zh-CN"><del>{correction.original || '＋'}</del><span aria-hidden="true"> → </span><ins>{correction.suggestion === null ? '…' : correction.suggestion || '∅'}</ins></p>
            <p className="mi-why">{correction.why}</p>
          </article>)}
          {review.verdict === 'errors' && review.correctedZh !== value && <div className="mi-fixed">
            <small>{t('Your sentence, with the correction')}</small>
            <p lang="zh-CN">{review.correctedZh}</p>
            {!review.fullyCorrected && <p className="mi-why">{t('Some mistakes need rewording, so this is only partly corrected.')}</p>}
            <HearButton text={review.correctedZh} label={t('Hear the correction')} className="mi-hear" />
          </div>}
          {review.missing.length > 0 && <p className="mi-missing">{t('Still to use:')} <span lang="zh-CN">{review.missing.join(' · ')}</span></p>}
          {saved && <p className="mi-saved" role="status">{t('Saved as writing practice. Recall without the word bank builds mastery.')}</p>}
          <p className="mi-scope">{t('Checked against {n} common mistake patterns. A clean result does not prove a sentence is right.', { n: review.rulesChecked })}</p>
          <div className="mi-actions">
            <button className="mi-primary" type="button" onClick={next}>{t('Next')}<span aria-hidden="true">→</span></button>
            {(review.corrections.length > 0 || review.missing.length > 0) && <button className="mi-ghost" type="button" onClick={() => { textarea.current?.focus(); textarea.current?.scrollIntoView({ block: 'center', behavior: calm() }) }}>{t('Fix it and check again')}</button>}
          </div>
        </section>}
      </>}
    </div>
  </section>
}
