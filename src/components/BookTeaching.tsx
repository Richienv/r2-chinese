import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { BooksSitting } from '../lib/books'
import { SITTING_KIND_LABEL } from '../lib/books'
import type { BookLearningPlan } from '../lib/bookLearning'
import { t } from '../lib/i18n'
import { clearStep, readStep, writeStep } from '../lib/resume'
import { bookSourcePassages } from './bookReading'

function useBookArrival<T extends HTMLElement>(reference: RefObject<T>, trigger: unknown) {
  useEffect(() => {
    const element = reference.current
    if (!element || typeof element.animate !== 'function') return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) return
    const animation = element.animate([{ opacity: .6, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, easing: 'ease-out' })
    const reduce = () => { if (motion.matches) animation.cancel() }
    motion.addEventListener('change', reduce)
    return () => { animation.cancel(); motion.removeEventListener('change', reduce) }
  }, [reference, trigger])
}

export function BookSourceReader({ sitting, n, of, passageKey, onNext }: { sitting: BooksSitting; n: number; of: number; passageKey: string; onNext: () => void }) {
  const passages = useMemo(() => bookSourcePassages(sitting.bodyEn), [sitting.bodyEn])
  const [page, setPage] = useState(() => Math.min(readStep(passageKey), Math.max(0, passages.length - 1)))
  const passage = useRef<HTMLDivElement>(null)
  const terms = sitting.terms ?? []
  const [term, setTerm] = useState(0)
  const activeTerm = terms[Math.min(term, terms.length - 1)]
  useBookArrival(passage, page)
  useEffect(() => { writeStep(passageKey, page) }, [passageKey, page])
  const last = page >= passages.length - 1
  function next() {
    if (last) { clearStep(passageKey); onNext(); return }
    setPage((current) => current + 1)
    passage.current?.closest<HTMLElement>('.overlay-body')?.scrollTo({ top: 0, behavior: 'auto' })
  }
  return <article className="books-stage books-source-reader" data-phase="read">
    <div className="books-reading-meta"><span>{t('From the book · {kind}', { kind: SITTING_KIND_LABEL[sitting.kind] })}</span><span>{n} / {of}</span></div>
    <h2 className="books-skill-hero">{sitting.titleEn.trim() || SITTING_KIND_LABEL[sitting.kind]}</h2>
    <div className="books-passage-progress" aria-label={t('Passage {n} of {of}', { n: page + 1, of: Math.max(1, passages.length) })}><span>{t('Passage {n} of {of}', { n: page + 1, of: Math.max(1, passages.length) })}</span><span aria-hidden="true">{passages.map((_, index) => <i key={index} data-current={index === page} data-read={index < page} />)}</span></div>
    <div ref={passage} className="books-reading-copy" aria-live="polite">{(passages[page] ?? []).map((paragraph, index) => <p key={`${page}:${index}`}>{paragraph}</p>)}</div>
    {activeTerm && <section className="books-key-term" aria-label={t('Key term')}><span>{t('Keep this idea')}</span><strong>{activeTerm.en}</strong>{activeTerm.hook && <p>{activeTerm.hook}</p>}{terms.length > 1 && <button type="button" className="books-text-button" onClick={() => setTerm((current) => (current + 1) % terms.length)}>{t('Next key term')} <span>{term + 1} / {terms.length}</span></button>}</section>}
    <div className="books-passage-actions">{page > 0 && <button type="button" className="btn btn-ghost" onClick={() => setPage((current) => current - 1)}>{t('Previous passage')}</button>}<button type="button" className="btn" onClick={next}>{last ? n < of ? t('Next source sitting') : t('Continue') : t('Next passage')}</button></div>
    <details className="books-disclosure books-full-source"><summary>{t('Full source passage')}</summary><div className="books-reading-copy">{sitting.bodyEn.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></details>
  </article>
}

export function BookPrinciple({ plan, source, onNext }: { plan: BookLearningPlan; source?: BooksSitting; onNext: () => void }) {
  const passages = useMemo(() => bookSourcePassages(plan.principle.explanation), [plan.principle.explanation])
  const [page, setPage] = useState(0)
  const passage = useRef<HTMLDivElement>(null)
  useBookArrival(passage, page)
  return <article className="books-stage books-workshop" data-phase="understand">
    <div className="books-reading-meta"><span>{t('Understand · Added teaching')}</span></div>
    <h2 className="books-skill-hero">{plan.principle.title}</h2>
    <div ref={passage} className="books-reading-copy">{(passages[page] ?? []).map((paragraph, index) => <p key={`${page}:${index}`}>{paragraph}</p>)}</div>
    {passages.length > 1 && <p className="books-passages-note">{t('Explanation {n} of {of}', { n: page + 1, of: passages.length })}</p>}
    <button type="button" className="btn" onClick={() => page < passages.length - 1 ? setPage((current) => current + 1) : onNext()}>{page < passages.length - 1 ? t('Next passage') : t('Work through a scenario')}</button>
    {source && <details className="books-disclosure"><summary>{t('Where this idea comes from')}<span>{source.titleEn}</span></summary><div className="books-reading-copy"><p>{source.bodyEn}</p></div></details>}
  </article>
}

export function BookScenario({ plan, selected, onPick }: { plan: BookLearningPlan; selected: number | null; onPick: (index: number) => void }) {
  const scenario = plan.caseStudy
  const choice = selected === null ? null : scenario.choices[selected]
  const outcome = useRef<HTMLDivElement>(null)
  useBookArrival(outcome, selected)
  return <article className="books-stage books-workshop" data-phase="apply">
    <div className="books-reading-meta"><span>{t('{label} · Added teaching', { label: scenario.label })}</span></div>
    <h2 className="books-skill-hero">{scenario.title}</h2>
    <div className="books-reading-copy"><p>{scenario.situation}</p></div>
    <h3 className="books-case-question">{scenario.question}</h3>
    <div className="books-scenario-choices" aria-label={t('Scenario choices')}>{scenario.choices.map((item, index) => <button type="button" key={index} className="books-scenario-choice" aria-pressed={selected === index} onClick={() => onPick(index)}>{item.label}</button>)}</div>
    {choice && <div ref={outcome} className="books-case-outcome" aria-live="polite"><span>{selected === scenario.recommended ? t('A workable route for this situation') : t('What this choice changes')}</span><div className="books-reading-copy"><p>{choice.consequence}</p><p>{choice.reason}</p></div><details className="books-disclosure"><summary>{t('Conditions and limits')}</summary><p>{scenario.boundary}</p>{selected !== scenario.recommended && scenario.choices[scenario.recommended] && <p>{t('Another route to consider: {label}', { label: scenario.choices[scenario.recommended].label })}</p>}</details></div>}
    <p className="books-passages-note">{t('Explore the consequences. This scenario is practice, not a scored source question.')}</p>
  </article>
}

export function BookMindset({ plan }: { plan: BookLearningPlan }) {
  return <article className="books-stage books-workshop" data-phase="reflect">
    <div className="books-reading-meta"><span>{t('Your perspective · Added teaching')}</span></div>
    <h2 className="books-skill-hero">{t('What would you see differently?')}</h2>
    <div className="books-reading-copy"><p>{plan.mindset.prompt}</p></div>
    <div className="books-perspective"><details className="books-disclosure"><summary>{t('A familiar assumption')}</summary><p>{plan.mindset.before}</p></details><details className="books-disclosure"><summary>{t('A shift to consider')}</summary><p>{plan.mindset.after}</p><p>{plan.mindset.why}</p></details><details className="books-disclosure"><summary>{t('Where the idea may not fit')}</summary><p>{plan.caseStudy.boundary}</p></details></div>
    <p className="books-passages-note">{t('Keep, adapt, or challenge the idea in your own notebook.')}</p>
  </article>
}
