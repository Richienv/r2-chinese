import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { HearButton } from '../components/Hear'
import { ReviewReport } from '../components/ReviewReport'
import { CloseIcon } from '../components/Icons'
import { exampleFor, lessons } from '../lib/content'
import { getLang, t } from '../lib/i18n'
import { assessmentStatus, AssessmentServiceError } from '../lib/assessmentService'
import { reviewComposition, writingCoverage, type CompositionReview } from '../lib/composition'
import { compositionBundle, learnedHskWords, type PracticeWord } from '../lib/hskPractice'
import { compareReviews, type Review } from '../lib/review'
import { reviewWriting } from '../lib/writing-review'
import { stopSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import '../styles/hsk-practice.css'

type Draft = { value: string; meaning: string; words: string[] }
function loadDraft(key: string): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!value || typeof value.value !== 'string' || value.value.length > 500 || typeof value.meaning !== 'string' || value.meaning.length > 1000 || !Array.isArray(value.words) || value.words.length > 5 || !value.words.every((word: unknown) => typeof word === 'string')) return null
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
  const [meaning, setMeaning] = useState(draft?.meaning ?? '')
  const [meanings, setMeanings] = useState(false)
  const [exampleOpen, setExampleOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [round, setRound] = useState(0)
  const [review, setReview] = useState<CompositionReview | null>(null)
  /** The report of the draft before this revision, so the retest can say what was fixed. */
  const [previous, setPrevious] = useState<Review | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [serviceIssue, setServiceIssue] = useState<AssessmentServiceError | null>(null)
  const [saved, setSaved] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftNotice, setDraftNotice] = useState('')
  const request = useRef<AbortController | null>(null)
  const connectionRequest = useRef<AbortController | null>(null)
  const credited = useRef(new Set<string>())
  const textarea = useRef<HTMLTextAreaElement>(null)
  const result = useRef<HTMLElement>(null)
  const words = bundle.map((word) => word.zh)
  const coverage = writingCoverage(value, words)
  const requirements = useMemo(() => reviewWriting({
    response: value, words, used: coverage.used, reviewerAvailable: !serviceIssue?.needsSetup,
    grammar: review ? { accepted: review.accepted, corrections: review.corrections.map((entry) => `${entry.original || '＋'} → ${entry.corrected || '∅'}: ${entry.why}`) } : null,
  }), [value, words.join('|'), review, serviceIssue]) // eslint-disable-line react-hooks/exhaustive-deps
  const change = review && previous ? compareReviews(previous, requirements) : null
  const sourceExample = bundle.map((word) => exampleFor(word.zh, word.lesson)).find((example) => example !== null)
  const lessonCount = new Set(pool.map((word) => word.lesson)).size

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ value, meaning, words: bundle.map((word) => word.zh) })); setDraftSaved(true) }
    catch { setDraftSaved(false) }
  }, [key, value, meaning, bundle])
  useEffect(() => () => { request.current?.abort(); stopSpeech() }, [])
  useEffect(() => {
    const controller = new AbortController()
    connectionRequest.current = controller
    const timer = setTimeout(() => controller.abort(), 8000)
    void assessmentStatus(controller.signal).then(({ configured }) => {
      if (!controller.signal.aborted) setServiceIssue(configured ? null : new AssessmentServiceError('assessment_not_configured'))
    }).catch((error) => {
      if (!controller.signal.aborted) setServiceIssue(error instanceof AssessmentServiceError ? error : new AssessmentServiceError('assessment_network_error'))
    }).finally(() => clearTimeout(timer))
    return () => { controller.abort(); clearTimeout(timer) }
  }, [])
  useEffect(() => {
    if (!review) return
    result.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [review])

  function invalidate() {
    request.current?.abort()
    request.current = null
    setChecking(false)
    setReview(null)
    setError('')
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
    if (clear) { setValue(''); setMeaning(''); setDraftNotice('') }
    else if (value.trim()) setDraftNotice(t('New word set. Your draft is kept; connect the new words to it.'))
    textarea.current?.focus({ preventScroll: true })
  }
  async function check() {
    if (checking || !bundle.length || !/[\u3400-\u9fff]/.test(value)) return
    invalidate()
    connectionRequest.current?.abort()
    const controller = new AbortController()
    request.current = controller
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, 25000)
    setChecking(true)
    try {
      if (serviceIssue?.needsSetup) {
        const status = await assessmentStatus(controller.signal)
        if (!status.configured) throw new AssessmentServiceError('assessment_not_configured')
      }
      const response = await reviewComposition(value, words, meaning, controller.signal)
      if (request.current !== controller || controller.signal.aborted) return
      setServiceIssue(null)
      setReview(response)
      const id = `${words.join('|')}\u0001${value}`
      const verdict = reviewWriting({ response: value, words, used: response.used, grammar: { accepted: response.accepted, corrections: [] }, reviewerAvailable: true }).verdict
      if (verdict === 'passed' && !credited.current.has(id)) {
        credited.current.add(id)
        // A visible word bank teaches contextual use; it is assisted practice,
        // not proof of unaided retrieval. Leave mastery/SRS evidence unchanged.
        store.logDrill(Math.max(1, response.used.length), 4)
        setSaved(true)
      }
    } catch (err) {
      if (request.current !== controller) return
      if (timedOut) setServiceIssue(new AssessmentServiceError('assessment_timeout'))
      else if (!controller.signal.aborted) {
        if (err instanceof AssessmentServiceError) setServiceIssue(err)
        else setError(err instanceof Error ? err.message : t('The review could not finish. Try again.'))
      }
    } finally {
      clearTimeout(timer)
      if (request.current === controller) { request.current = null; setChecking(false) }
    }
  }

  return <section className="overlay hsk-lab writing-room" role="dialog" aria-modal="true" aria-labelledby="writing-title">
    <header className="overlay-head hsk-lab-head"><button className="icon-btn" type="button" aria-label={t('Close sentence practice')} onClick={onClose}><CloseIcon size={20} /></button><div><span>{t('HSK 4 · Across your learning trail')}</span><h1 id="writing-title">{t('Make it yours')}</h1></div><span className="writing-head-glyph" aria-hidden="true">写</span></header>
    <div className="overlay-body hsk-lab-body">
      {!pool.length ? <div className="writing-empty"><span lang="zh-CN">从一句开始</span><h2>{t('Your words will meet here.')}</h2><p>{t('Learn or drill a few HSK words. Then use them together in sentences about your own life.')}</p><button className="writing-primary" type="button" onClick={onClose}>{t('Go learn some words')}</button></div> : <>
        <header className="writing-intro"><span className="hsk-lab-eyebrow">{lessonCount === 1 ? t('{words} learned words · {lessons} lesson', { words: pool.length, lessons: lessonCount }) : t('{words} learned words · {lessons} lessons', { words: pool.length, lessons: lessonCount })}</span><h2>{t('Different words.')}<br />{t('One story of your own.')}</h2><p>{t('Use these words across two or three Mandarin sentences. A real moment, a plan, an opinion—you choose.')}</p></header>
        <section className="writing-bank" aria-label={t('Words for your sentences')}>
          <div className="writing-bank-head"><span>{t('Your word set')}</span><button type="button" onClick={() => mix()}>{t('Mix words ↻')}</button></div>
          <div className="writing-words">{bundle.map((word) => <article key={word.zh} data-used={coverage.used.includes(word.zh)}><small>L{word.lesson}</small><strong lang="zh-CN">{word.zh}</strong>{meanings && <div className="writing-word-hint"><span>{word.pinyin}</span><p>{word.en}</p></div>}<span className="writing-word-status">{coverage.used.includes(word.zh) ? t('In your draft') : t('Bring it in')}</span></article>)}</div>
          {!bundle.length && <p className="hsk-lab-error">{t('Choose at least one word below.')}</p>}
          <details className="writing-word-picker"><summary>{t('Choose your own words')} <small>{t('up to 5')}</small></summary><input type="search" aria-label={t('Find a learned word')} placeholder={t('Find Hanzi, pinyin or meaning')} value={search} onChange={(e) => setSearch(e.target.value)} /><div>{pool.filter((word) => `${word.zh} ${word.pinyin} ${word.en}`.toLowerCase().includes(search.toLowerCase())).map((word) => <label key={word.zh}><input type="checkbox" checked={words.includes(word.zh)} disabled={!words.includes(word.zh) && bundle.length >= 5} onChange={() => choose(word)} /><span lang="zh-CN">{word.zh}</span><small>L{word.lesson}</small></label>)}</div></details>
        </section>
        <div className="writing-hints" role="group" aria-label={t('Optional writing hints')}><span>{t('Need a nudge?')}</span><button type="button" aria-expanded={meanings} onClick={() => setMeanings(!meanings)}>{meanings ? t('Hide meanings') : t('Word meanings')}</button><button type="button" aria-expanded={exampleOpen} disabled={!sourceExample} onClick={() => setExampleOpen(!exampleOpen)}>{exampleOpen ? t('Hide example') : t('One book example')}</button></div>
        {exampleOpen && sourceExample && <aside className="writing-source"><small>{t('One possible context · make your own')}</small><p lang="zh-CN">{sourceExample.zh}</p>{store.prefs.showPinyin && <p className="writing-source-pinyin">{sourceExample.pinyin}</p>}{store.prefs.showEnglish && <p className="writing-source-english">{sourceExample.en}</p>}<HearButton text={sourceExample.zh} label={t('Hear example')} /></aside>}
        <section className="writing-workspace"><label htmlFor="your-hsk-sentences">{t('Your Mandarin')}</label><textarea id="your-hsk-sentences" ref={textarea} lang="zh-CN" value={value} maxLength={500} placeholder="写两三句话，把这些词用起来。" onChange={(e) => { invalidate(); setValue(e.target.value); setDraftNotice('') }} /><div className="writing-draft-meta"><span>{t('{used} / {total} words in draft', { used: coverage.used.length, total: bundle.length })}</span><span>{value.length} / 500 · {draftSaved ? t('draft saved') : t('session draft')}</span></div>{draftNotice && <p className="writing-draft-notice" role="status">{draftNotice}</p>}
          <details className="writing-meaning"><summary>{t('Add what you meant')} <small>{t('optional')}</small></summary><textarea aria-label={t('Your intended meaning')} lang={getLang()} value={meaning} maxLength={1000} placeholder={t('Explain your intended meaning if the Mandarin could be ambiguous.')} onChange={(e) => { invalidate(); setMeaning(e.target.value) }} /></details>
          {serviceIssue && <aside className="writing-service" role="status" data-setup={serviceIssue.needsSetup}>
            <strong>{serviceIssue.needsSetup ? t('Connect your grammar reviewer') : t('The reviewer could not finish')}</strong><p>{serviceIssue.message}</p>
            {import.meta.env.DEV && serviceIssue.needsSetup && <details><summary>Local reviewer setup</summary>
              {serviceIssue.code === 'assessment_quota_exceeded' ? <p>Add API credit to the provider account used by this server.</p>
                : serviceIssue.code === 'assessment_model_unavailable' ? <p>Set <code>OPENAI_ASSESS_MODEL</code> in <code>.env.local</code> to a model your API key can access.</p>
                  : serviceIssue.code === 'assessment_route_missing' ? <p>Restart the local app server so it serves <code>/api/assess</code>.</p>
                    : <p>Set <code>OPENAI_API_KEY</code> in this project's <code>.env.local</code>. Keep it on the server; do not put it in a <code>VITE_</code> variable. Then reconnect below.</p>}
            </details>}
            <small>{draftSaved ? t('Your draft is saved on this device.') : t('Your draft stays here in this session.')}</small>
          </aside>}
          {!review && <ul className="writing-checklist" aria-label={t('What this task needs')} data-pending={!value.trim() || undefined}>
            <li className="writing-checklist-title">{t('This task needs')}</li>
            {requirements.checks.map((check) => <li key={check.id} data-status={check.status}><span aria-hidden="true">{check.status === 'pass' ? '✓' : check.status === 'unverified' ? '?' : check.status === 'partial' ? '!' : '○'}</span><div><strong>{check.label}</strong><small>{check.status === 'pass' ? check.found : check.status === 'unverified' ? t('Checked when you press the button') : value.trim() ? check.fix : check.expected}</small></div></li>)}
          </ul>}
          <button className="writing-primary" type="button" disabled={checking || !bundle.length || !/[\u3400-\u9fff]/.test(value)} onClick={() => void check()}>{checking ? t('Reviewing your sentences…') : serviceIssue?.needsSetup ? t('Reconnect grammar review') : t('Check my sentences')}<span aria-hidden="true">→</span></button>
          {error && <p className="hsk-lab-error" role="alert">{error}</p>}
        </section>
        {review && <section className="writing-review" ref={result} aria-label={t('Your grammar feedback')} data-correct={review.accepted}>
          <ReviewReport review={requirements} comparison={change} revealed={() => true} />
          <span className="hsk-lab-eyebrow">{t('Grammar review')}</span><h2>{review.accepted ? t('Your meaning comes through.') : t('A small change makes it clearer.')}</h2><p className="writing-feedback">{review.feedback}</p>
          {review.corrections.map((correction, i) => <details className="writing-correction" key={i} open={i === 0 ? true : undefined}><summary><span className="writing-correction-number">{i + 1}</span><span lang="zh-CN"><del>{correction.original || '＋'}</del><span aria-hidden="true"> → </span><ins>{correction.corrected || '∅'}</ins></span><b>{t('Why?')}</b></summary><p>{correction.why}</p><div className="writing-grammar-rule"><small>{t('Keep this pattern')}</small><span>{correction.rule}</span></div></details>)}
          {!review.accepted && <div className="writing-polished"><small>{t('Your sentence, with the correction')}</small><p lang="zh-CN">{review.correctedZh}</p><HearButton text={review.correctedZh} label={t('Hear the correction')} /></div>}
          {review.missing.length > 0 && <p className="writing-missing">{t('Still to use:')} <span lang="zh-CN">{review.missing.join(' · ')}</span>. {t('Add another sentence; your grammar result stays separate from word coverage.')}</p>}
          {saved && <p className="writing-saved" role="status">{t('Saved as writing practice. Recall without the word bank builds mastery.')}</p>}
          <div className="writing-review-actions"><button type="button" onClick={() => { setPrevious(requirements); invalidate(); textarea.current?.focus(); textarea.current?.scrollIntoView({ block: 'center' }) }}>{t('Fix it and check again')}</button><button type="button" onClick={() => mix(true)}>{t('New word set →')}</button></div>
        </section>}
      </>}
    </div>
    <footer className="overlay-foot writing-foot"><span>{t('Recall → connect → express')}</span><small>{t('Grammar feedback explains the change.')}</small></footer>
  </section>
}
