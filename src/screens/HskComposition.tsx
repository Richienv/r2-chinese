import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { HearButton } from '../components/Hear'
import { ReviewReport } from '../components/ReviewReport'
import { CloseIcon } from '../components/Icons'
import { exampleFor, lessons } from '../lib/content'
import { t } from '../lib/i18n'
import { grammarOfReview, reviewComposition, type CompositionReview } from '../lib/composition'
import { courseLexicon } from '../lib/grammar/course-lexicon'
import { compositionBundle, learnedHskWords, type PracticeWord } from '../lib/hskPractice'
import { compareReviews, type Review } from '../lib/review'
import { reviewWriting } from '../lib/writing-review'
import { stopSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import '../styles/hsk-practice.css'

type Draft = { value: string; words: string[] }
function loadDraft(key: string): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!value || typeof value.value !== 'string' || value.value.length > 500 || !Array.isArray(value.words) || value.words.length > 5 || !value.words.every((word: unknown) => typeof word === 'string')) return null
    return value
  } catch { return null }
}

export function HskComposition({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const { user } = useAuth()
  const key = `yulu.hsk-writing.v1:${user?.id ?? 'local'}`
  const pool = useMemo(() => learnedHskWords(lessons, store.learningTrail, Object.keys(store.cards)), [store.learningTrail, store.cards])
  const [draft] = useState(() => loadDraft(key))
  const [bundle, setBundle] = useState<PracticeWord[]>(() => {
    const saved = pool.filter((word) => draft?.words.includes(word.zh))
    return saved.length ? saved : compositionBundle(pool, store.mastery)
  })
  const [value, setValue] = useState(draft?.value ?? '')
  const [meanings, setMeanings] = useState(false)
  const [exampleOpen, setExampleOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [round, setRound] = useState(0)
  const [review, setReview] = useState<CompositionReview | null>(null)
  /** The report of the draft before this revision, so the retest can say what was fixed. */
  const [previous, setPrevious] = useState<Review | null>(null)
  const [saved, setSaved] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftNotice, setDraftNotice] = useState('')
  const credited = useRef(new Set<string>())
  const textarea = useRef<HTMLTextAreaElement>(null)
  const result = useRef<HTMLElement>(null)
  const words = bundle.map((word) => word.zh)
  // The classifier is free and instant, so the grammar line of the checklist is live like every other line.
  const draftReview = useMemo(() => reviewComposition(value, words, courseLexicon), [value, words.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const requirements = useMemo(() => reviewWriting({ response: value, words, used: draftReview.used, grammar: grammarOfReview(draftReview) }), [value, words.join('|'), draftReview]) // eslint-disable-line react-hooks/exhaustive-deps
  const change = review && previous ? compareReviews(previous, requirements) : null
  const sourceExample = bundle.map((word) => exampleFor(word.zh, word.lesson)).find((example) => example !== null)
  const lessonCount = new Set(pool.map((word) => word.lesson)).size

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ value, words: bundle.map((word) => word.zh) })); setDraftSaved(true) }
    catch { setDraftSaved(false) }
  }, [key, value, bundle])
  useEffect(() => () => stopSpeech(), [])
  useEffect(() => {
    if (!review) return
    result.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [review])

  function invalidate() {
    setReview(null)
    setSaved(false)
  }
  function choose(word: PracticeWord) {
    invalidate()
    setPrevious(null)
    setBundle((previous) => previous.some((item) => item.zh === word.zh) ? previous.filter((item) => item.zh !== word.zh) : previous.length < 5 ? [...previous, word] : previous)
  }
  function mix(clear = false) {
    invalidate()
    setPrevious(null)
    stopSpeech()
    setRound(round + 1)
    setBundle(compositionBundle(pool, store.mastery, round + 1))
    setMeanings(false)
    setExampleOpen(false)
    if (clear) { setValue(''); setDraftNotice('') }
    else if (value.trim()) setDraftNotice(t('New word set. Your draft is kept; connect the new words to it.'))
    textarea.current?.focus({ preventScroll: true })
  }
  function check() {
    if (!bundle.length || !/[\u3400-\u9fff]/.test(value)) return
    setReview(draftReview)
    const id = `${words.join('|')}\u0001${value}`
    if (requirements.verdict === 'passed' && !credited.current.has(id)) {
      credited.current.add(id)
      // A visible word bank teaches contextual use; it is assisted practice,
      // not proof of unaided retrieval. Leave mastery/SRS evidence unchanged.
      store.logDrill(Math.max(1, draftReview.used.length), 4)
      setSaved(true)
    }
  }

  return <section className="overlay hsk-lab writing-room" role="dialog" aria-modal="true" aria-labelledby="writing-title">
    <header className="overlay-head hsk-lab-head"><button className="icon-btn" type="button" aria-label={t('Close sentence practice')} onClick={onClose}><CloseIcon size={20} /></button><div><span>{t('HSK 4 · Across your learning trail')}</span><h1 id="writing-title">{t('Make it yours')}</h1></div><span className="writing-head-glyph" aria-hidden="true">写</span></header>
    <div className="overlay-body hsk-lab-body">
      {!pool.length ? <div className="writing-empty"><span lang="zh-CN">从一句开始</span><h2>{t('Your words will meet here.')}</h2><p>{t('Learn or drill a few HSK words. Then use them together in sentences about your own life.')}</p><button className="writing-primary" type="button" onClick={onClose}>{t('Go learn some words')}</button></div> : <>
        <header className="writing-intro"><span className="hsk-lab-eyebrow">{lessonCount === 1 ? t('{words} learned words · {lessons} lesson', { words: pool.length, lessons: lessonCount }) : t('{words} learned words · {lessons} lessons', { words: pool.length, lessons: lessonCount })}</span><h2>{t('Different words.')}<br />{t('One story of your own.')}</h2><p>{t('Use these words across two or three Mandarin sentences. A real moment, a plan, an opinion—you choose.')}</p></header>
        <section className="writing-bank" aria-label={t('Words for your sentences')}>
          <div className="writing-bank-head"><span>{t('Your word set')}</span><button type="button" onClick={() => mix()}>{t('Mix words ↻')}</button></div>
          <div className="writing-words">{bundle.map((word) => <article key={word.zh} data-used={draftReview.used.includes(word.zh)}><small>L{word.lesson}</small><strong lang="zh-CN">{word.zh}</strong>{meanings && <div className="writing-word-hint"><span>{word.pinyin}</span><p>{word.en}</p></div>}<span className="writing-word-status">{draftReview.used.includes(word.zh) ? t('In your draft') : t('Bring it in')}</span></article>)}</div>
          {!bundle.length && <p className="hsk-lab-error">{t('Choose at least one word below.')}</p>}
          <details className="writing-word-picker"><summary>{t('Choose your own words')} <small>{t('up to 5')}</small></summary><input type="search" aria-label={t('Find a learned word')} placeholder={t('Find Hanzi, pinyin or meaning')} value={search} onChange={(e) => setSearch(e.target.value)} /><div>{pool.filter((word) => `${word.zh} ${word.pinyin} ${word.en}`.toLowerCase().includes(search.toLowerCase())).map((word) => <label key={word.zh}><input type="checkbox" checked={words.includes(word.zh)} disabled={!words.includes(word.zh) && bundle.length >= 5} onChange={() => choose(word)} /><span lang="zh-CN">{word.zh}</span><small>L{word.lesson}</small></label>)}</div></details>
        </section>
        <div className="writing-hints" role="group" aria-label={t('Optional writing hints')}><span>{t('Need a nudge?')}</span><button type="button" aria-expanded={meanings} onClick={() => setMeanings(!meanings)}>{meanings ? t('Hide meanings') : t('Word meanings')}</button><button type="button" aria-expanded={exampleOpen} disabled={!sourceExample} onClick={() => setExampleOpen(!exampleOpen)}>{exampleOpen ? t('Hide example') : t('One book example')}</button></div>
        {exampleOpen && sourceExample && <aside className="writing-source"><small>{t('One possible context · make your own')}</small><p lang="zh-CN">{sourceExample.zh}</p>{store.prefs.showPinyin && <p className="writing-source-pinyin">{sourceExample.pinyin}</p>}{store.prefs.showEnglish && <p className="writing-source-english">{sourceExample.en}</p>}<HearButton text={sourceExample.zh} label={t('Hear example')} /></aside>}
        <section className="writing-workspace"><label htmlFor="your-hsk-sentences">{t('Your Mandarin')}</label><textarea id="your-hsk-sentences" ref={textarea} lang="zh-CN" value={value} maxLength={500} placeholder="写两三句话，把这些词用起来。" onChange={(e) => { invalidate(); setValue(e.target.value); setDraftNotice('') }} /><div className="writing-draft-meta"><span>{t('{used} / {total} words in draft', { used: draftReview.used.length, total: bundle.length })}</span><span>{value.length} / 500 · {draftSaved ? t('draft saved') : t('session draft')}</span></div>{draftNotice && <p className="writing-draft-notice" role="status">{draftNotice}</p>}
          {!review && <ul className="writing-checklist" aria-label={t('What this task needs')} data-pending={!value.trim() || undefined}>
            <li className="writing-checklist-title">{t('This task needs')}</li>
            {requirements.checks.map((check) => <li key={check.id} data-status={check.status}><span aria-hidden="true">{check.status === 'pass' ? '✓' : check.status === 'unverified' ? '?' : check.status === 'partial' ? '!' : '○'}</span><div><strong>{check.label}</strong><small>{check.status === 'pass' ? check.found : value.trim() ? check.fix : check.expected}</small></div></li>)}
          </ul>}
          <button className="writing-primary" type="button" disabled={!bundle.length || !/[\u3400-\u9fff]/.test(value)} onClick={check}>{t('Check my sentences')}<span aria-hidden="true">→</span></button>
        </section>
        {review && <section className="writing-review" ref={result} aria-label={t('Your grammar feedback')} data-correct={review.verdict === 'no-known-errors'} data-verdict={review.verdict}>
          <ReviewReport review={requirements} comparison={change} revealed={() => true} />
          <span className="hsk-lab-eyebrow">{t('Common mistakes check')}</span><h2>{review.verdict === 'errors' ? t('A small change makes it clearer.') : review.verdict === 'worth-a-look' ? t('Worth a second look') : t('No common mistakes found.')}</h2><p className="writing-feedback">{review.feedback}</p>
          {review.corrections.map((correction, i) => <details className="writing-correction" key={i} data-severity={correction.severity} open={i === 0 ? true : undefined}><summary><span className="writing-correction-number">{i + 1}</span><span lang="zh-CN"><del>{correction.original || '＋'}</del><span aria-hidden="true"> → </span><ins>{correction.suggestion === null ? '…' : correction.suggestion || '∅'}</ins></span><b>{t('Why?')}</b></summary><p>{correction.why}</p><div className="writing-grammar-rule"><small>{t('Keep this pattern')}</small><span>{correction.rule}</span></div></details>)}
          {review.verdict === 'errors' && review.correctedZh !== value && <div className="writing-polished"><small>{t('Your sentence, with the correction')}</small><p lang="zh-CN">{review.correctedZh}</p>{!review.fullyCorrected && <p className="writing-feedback">{t('Some mistakes need rewording, so this is only partly corrected.')}</p>}<HearButton text={review.correctedZh} label={t('Hear the correction')} /></div>}
          <small className="writing-scope">{t('Checked against {n} common mistake patterns. A clean result does not prove a sentence is right.', { n: review.rulesChecked })}</small>
          {review.missing.length > 0 && <p className="writing-missing">{t('Still to use:')} <span lang="zh-CN">{review.missing.join(' · ')}</span>. {t('Add another sentence; your grammar result stays separate from word coverage.')}</p>}
          {saved && <p className="writing-saved" role="status">{t('Saved as writing practice. Recall without the word bank builds mastery.')}</p>}
          <div className="writing-review-actions"><button type="button" onClick={() => { setPrevious(requirements); invalidate(); textarea.current?.focus(); textarea.current?.scrollIntoView({ block: 'center' }) }}>{t('Fix it and check again')}</button><button type="button" onClick={() => mix(true)}>{t('New word set →')}</button></div>
        </section>}
      </>}
    </div>
    <footer className="overlay-foot writing-foot"><span>{t('Recall → connect → express')}</span><small>{t('Grammar feedback explains the change.')}</small></footer>
  </section>
}
