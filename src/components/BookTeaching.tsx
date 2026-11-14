import { useEffect, useMemo, useRef, type RefObject } from 'react'
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
  const saved = useRef(Math.min(readStep(passageKey), Math.max(0, passages.length - 1)))
  const passage = useRef<HTMLDivElement>(null)
  const finished = useRef(false)
  useEffect(() => {
    const element = passage.current
    const scroller = element?.closest<HTMLElement>('.overlay-body')
    if (!element || !scroller) return
    const sections = [...element.querySelectorAll<HTMLElement>('[data-source-passage]')]
    // Old paginated bookmarks point into the same source groups in the continuous reader.
    const target = sections[saved.current]
    let restoring = saved.current > 0 && !!target
    // Run after the parent session resets its scroll position for this activity.
    const restoreFrame = restoring ? requestAnimationFrame(() => {
      scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12
      restoring = false
    }) : 0
    let frame = 0
    function remember() {
      if (frame || restoring || finished.current) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (finished.current) return
        const top = scroller!.getBoundingClientRect().top + 28
        let current = 0
        sections.forEach((section, index) => { if (section.getBoundingClientRect().top <= top) current = index })
        if (current !== saved.current) { saved.current = current; writeStep(passageKey, current) }
      })
    }
    scroller.addEventListener('scroll', remember, { passive: true })
    return () => { scroller.removeEventListener('scroll', remember); cancelAnimationFrame(frame); cancelAnimationFrame(restoreFrame) }
  }, [passageKey])
  function next() { finished.current = true; clearStep(passageKey); onNext() }
  return <article className="books-stage books-source-reader" data-phase="read">
    <div className="books-reading-meta"><span>{t('From the book · {kind}', { kind: SITTING_KIND_LABEL[sitting.kind] })}</span><span>{n} / {of}</span></div>
    <h2 className="books-skill-hero">{sitting.titleEn.trim() || SITTING_KIND_LABEL[sitting.kind]}</h2>
    <div ref={passage} className="books-reading-copy">{passages.map((paragraphs, group) => <div key={group} data-source-passage={group}>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>)}</div>
    {!!sitting.terms?.length && <details className="books-disclosure"><summary>{t('Key terms')}</summary>{sitting.terms.map((term, index) => <div className="books-key-term" key={index}><strong>{term.en}</strong>{term.hook && <p>{term.hook}</p>}</div>)}</details>}
    <div className="books-passage-actions"><button type="button" className="btn" onClick={next}>{t('Continue')}</button></div>
  </article>
}

export function BookPrinciple({ plan, source, onNext }: { plan: BookLearningPlan; source?: BooksSitting; onNext: () => void }) {
  const paragraphs = useMemo(() => bookSourcePassages(plan.principle.explanation).flat(), [plan.principle.explanation])
  return <article className="books-stage books-workshop" data-phase="understand">
    <div className="books-reading-meta"><span>{t('Understand · Added teaching')}</span></div>
    <h2 className="books-skill-hero">{plan.principle.title}</h2>
    <div className="books-reading-copy">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    <button type="button" className="btn" onClick={onNext}>{t('Work through a scenario')}</button>
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
