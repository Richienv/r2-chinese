import { useEffect, useMemo, useRef, useState } from 'react'
import { LearningPath } from '../components/LearningPath'
import { RecallFeedback } from '../components/LearningMotion'
import { CheckIcon, CloseIcon, LockIcon } from '../components/Icons'
import { BookJournal, BookJournalReview } from '../components/BookJournal'
import { BookMindset, BookPrinciple, BookScenario, BookSourceReader } from '../components/BookTeaching'
import { booksResumeIndex, booksWorkshopSteps } from '../components/bookReading'
import {
  BOOKS_COURSE, booksChapters, booksLessonNumber, booksParts, buildBooksSteps,
  getBooksChapter, LESSON_NODE, nodeLabelBooks, useBooksProgress,
  type BooksChapter, type BooksNode, type BooksSitting,
} from '../lib/books'
import { getBookLearningPlan } from '../lib/bookLearning'
import { bookReviewDate, hasMeaningfulBookReflection, useBookJournal, type BookCompletionMode } from '../lib/bookJournal'
import { recordHistory } from '../lib/history'
import { t } from '../lib/i18n'
import { clearLearningCheckpoint, clearStep, readLearningCheckpoint, readStep, writeLearningCheckpoint, writeStep } from '../lib/resume'
import { playAdvance, playComplete, playCorrect, playWrong } from '../lib/sfx'
import { ITEM_XP, NODE_BONUS_XP } from '../lib/wordsSession'
import { useStore } from '../store/store'
import '../styles/books.css'

type QuizState = { wrong: number[]; solved: boolean; missed: boolean }
/** The stage ids are compared in code; only the label is shown to the learner. */
const STAGES = [{ id: 'Read', label: t('Read') }, { id: 'Understand', label: t('Understand') }, { id: 'Apply', label: t('Apply') }, { id: 'Reflect', label: t('Reflect') }] as const
const SELECTED_BOOK_KEY = 'yulu.books.selected.v1'
const SELECTED_BOOK_EVENT = 'books:selected'

function useSelectedBook(fallback: number) {
  const [selected, setSelected] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(SELECTED_BOOK_KEY))
      return booksParts().some((book) => book.part === saved) ? saved : fallback
    } catch { return fallback }
  })
  useEffect(() => {
    const sync = () => {
      try {
        const saved = Number(localStorage.getItem(SELECTED_BOOK_KEY))
        if (booksParts().some((book) => book.part === saved)) setSelected(saved)
      } catch { /* The current selection still works in this session. */ }
    }
    window.addEventListener(SELECTED_BOOK_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(SELECTED_BOOK_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  return [selected, (part: number) => {
    setSelected(part)
    try { localStorage.setItem(SELECTED_BOOK_KEY, String(part)); window.dispatchEvent(new Event(SELECTED_BOOK_EVENT)) } catch { /* Device preference is optional. */ }
  }] as const
}

/** Review opens the existing notebook, without replaying the source or changing unlocks. */
function openBookJournal(part: number, index: number, onPlay: (part: number, index: number) => void) {
  const steps = booksWorkshopSteps(buildBooksSteps(part, index))
  const journal = steps.findIndex((step) => step.kind === 'journal')
  if (journal >= 0) writeStep(`books:${part}:${index}:${LESSON_NODE}`, journal)
  onPlay(part, index)
}

export function BooksEmptyState() {
  return <section className="books-empty"><div className="kicker">{t('Books')}</div><h2>{BOOKS_COURSE.title}</h2><p>{BOOKS_COURSE.blurb}.</p><p>{t('The book library is being prepared.')}</p></section>
}

/** Each book keeps its own source order and unlock sequence. */
export function BooksPartPath({ chapters, partTitle, onPlay }: { chapters: BooksChapter[]; partTitle: string; onPlay?: (part: number, index: number) => void }) {
  const progress = useBooksProgress()
  return <div className="books-book-path"><LearningPath kicker={t('Book path')} title={partTitle} subtitle={t('{n} chapters · Read, understand, apply, reflect', { n: chapters.length })} items={chapters.map((chapter) => {
    const node: BooksNode = LESSON_NODE
    const done = progress.isNodeDone(chapter.part, chapter.index, node)
    const playable = progress.isNodePlayable(chapter.part, chapter.index, node)
    return { id: `${chapter.part}:${chapter.index}`, label: t('Chapter {n}', { n: chapter.index }), title: nodeLabelBooks(chapter), state: done ? 'done' as const : playable ? 'current' as const : 'locked' as const, playable, onSelect: () => onPlay?.(chapter.part, chapter.index) }
  })} /></div>
}

export function BooksHomePath({ onPlay }: { onPlay: (part: number, index: number) => void }) {
  const progress = useBooksProgress()
  const next = booksChapters.find((chapter) => !progress.isNodeDone(chapter.part, chapter.index, LESSON_NODE) && progress.isNodePlayable(chapter.part, chapter.index, LESSON_NODE)) ?? booksChapters[0]
  const [selected] = useSelectedBook(next?.part ?? 1)
  if (!next) return <BooksEmptyState />
  const part = booksParts().find((book) => book.part === selected) ?? booksParts()[0]
  return <div className="books-learn books-home"><BookJournalReview onOpen={(part, index) => openBookJournal(part, index, onPlay)} /><BooksPartPath chapters={part.chapters} partTitle={part.titleEn} onPlay={onPlay} /></div>
}

export function BooksLearn({ onPlay }: { onPlay: (part: number, index: number) => void }) {
  const progress = useBooksProgress()
  const parts = booksParts()
  const next = booksChapters.find((chapter) => !progress.isNodeDone(chapter.part, chapter.index, LESSON_NODE) && progress.isNodePlayable(chapter.part, chapter.index, LESSON_NODE)) ?? booksChapters[0]
  const [selected, select] = useSelectedBook(next?.part ?? 1)
  if (!parts.length) return <BooksEmptyState />
  const current = parts.find((part) => part.part === selected) ?? parts[0]
  return <div className="books-learn">
    <section className="books-library-selector" aria-label={t('Choose a book')}><div className="books-library-heading"><span>{t('Five books')}</span><p>{t('One idea, then something to try.')}</p></div><div className="books-library-tabs" role="group" aria-label={t('Books')}>{parts.map((part, position) => <button type="button" key={part.part} aria-pressed={part.part === current.part} onClick={() => select(part.part)}><span aria-hidden="true">{String(position + 1).padStart(2, '0')}</span>{part.titleEn}</button>)}</div></section>
    <BookJournalReview onOpen={(part, index) => { select(part); openBookJournal(part, index, onPlay) }} />
    <BooksPartPath key={current.part} partTitle={current.titleEn} chapters={current.chapters} onPlay={onPlay} />
  </div>
}

export function BooksSession({ part, index, node, onClose }: { part: number; index: number; node: string; onClose: () => void }) {
  const progress = useBooksProgress()
  const chapter = getBooksChapter(part, index)
  if (!chapter || node !== LESSON_NODE || !progress.isNodePlayable(part, index, LESSON_NODE)) return <LockedView onClose={onClose} />
  return <BooksRunner key={`${part}:${index}`} part={part} index={index} onClose={onClose} />
}

function BooksRunner({ part, index, onClose }: { part: number; index: number; onClose: () => void }) {
  const { awardXp, practiceLog } = useStore()
  const { isNodeDone, markNodeDone } = useBooksProgress()
  const chapter = getBooksChapter(part, index)!
  const resumeId = `books:${part}:${index}:${LESSON_NODE}`
  const lessonNo = booksLessonNumber(part, index)
  const sourceSteps = useMemo(() => buildBooksSteps(part, index), [part, index])
  const steps = useMemo(() => booksWorkshopSteps(sourceSteps), [sourceSteps])
  const plan = useMemo(() => getBookLearningPlan(chapter), [chapter])
  const { entry, update } = useBookJournal(part, index)
  const reflectionReady = hasMeaningfulBookReflection(entry)
  const alreadyDone = useRef(isNodeDone(part, index, LESSON_NODE))
  const credited = useRef(new Set<string>())
  const finished = useRef(false)
  const left = useRef(new Set<number>())
  const xpRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(() => booksResumeIndex(readStep(resumeId), steps))
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const [assisted, setAssisted] = useState<string[]>(() => readLearningCheckpoint(resumeId)?.assistedSteps ?? [])
  const [scenario, setScenario] = useState<number | null>(null)
  const [xp, setXp] = useState(0)
  const [completionMode, setCompletionMode] = useState<BookCompletionMode>(null)
  const step = steps[Math.min(i, steps.length - 1)] ?? null
  const isComplete = step?.kind === 'complete'
  const total = Math.max(1, steps.length - 1)
  const quizState = step?.kind === 'quiz' ? quiz[step.id] : undefined
  const source = sourceSteps.find((item) => item.kind !== 'complete' && item.sitting.id === plan.principle.sourceSittingId)

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [i])
  useEffect(() => {
    if (!step || isComplete) return
    writeStep(resumeId, i)
    writeLearningCheckpoint(resumeId, { stepId: step.id, retryWords: [], assistedSteps: assisted })
  }, [i, isComplete, resumeId, step, assisted])
  useEffect(() => {
    if (!isComplete || finished.current) return
    finished.current = true
    playComplete()
    clearStep(resumeId)
    clearLearningCheckpoint(resumeId)
    markNodeDone(part, index, LESSON_NODE)
    recordHistory({ course: 'books', kind: 'node', lesson: lessonNo, node: LESSON_NODE, title: completionMode === 'reflection-drafted' ? t('{title} · reflection drafted', { title: chapter.titleEn }) : t('{title} · reading complete', { title: chapter.titleEn }) })
    // A reading advance earns nothing. The bonus acknowledges a completed reflection draft.
    if (!alreadyDone.current && completionMode === 'reflection-drafted') {
      awardXp(NODE_BONUS_XP)
      xpRef.current += NODE_BONUS_XP
      setXp(xpRef.current)
    }
  }, [isComplete, awardXp, markNodeDone, part, index, resumeId, lessonNo, chapter.titleEn, completionMode])

  function credit(id: string) {
    if (credited.current.has(id)) return
    credited.current.add(id)
    xpRef.current += ITEM_XP
    setXp(xpRef.current)
    awardXp(ITEM_XP)
    practiceLog()
  }
  function goForward() {
    if (left.current.has(i)) return
    left.current.add(i)
    playAdvance()
    setI((current) => Math.min(current + 1, steps.length - 1))
  }
  function markAssisted(id: string) {
    setAssisted((current) => current.includes(id) ? current : [...current, id])
  }
  function answerQuiz(picked: number, answer: number) {
    if (step?.kind !== 'quiz') return
    const key = step.id
    const previous = quiz[key] ?? { wrong: [], solved: false, missed: assisted.includes(key) }
    if (previous.solved || previous.wrong.includes(picked)) return
    if (picked === answer) {
      playCorrect()
      credit(key)
      const missed = previous.missed || assisted.includes(key) || previous.wrong.length > 0
      recordHistory({ course: 'books', kind: 'quiz', lesson: lessonNo, node: LESSON_NODE, title: missed ? t('{title} · resolved after assistance', { title: chapter.titleEn }) : t('{title} · source check', { title: chapter.titleEn }), correct: true })
      setQuiz((current) => ({ ...current, [key]: { wrong: previous.wrong, solved: true, missed } }))
    } else {
      playWrong()
      markAssisted(key)
      recordHistory({ course: 'books', kind: 'quiz', lesson: lessonNo, node: LESSON_NODE, title: chapter.titleEn, correct: false })
      setQuiz((current) => ({ ...current, [key]: { wrong: [...previous.wrong, picked], solved: false, missed: true } }))
    }
  }
  function finish(mode: Exclude<BookCompletionMode, null>) {
    if (step?.kind !== 'journal' || mode === 'reflection-drafted' && !reflectionReady) return
    update(mode === 'reflection-drafted' ? { completionMode: mode, actionSavedAt: entry.actionSavedAt ?? Date.now(), reviewDate: entry.reviewDate || bookReviewDate(1) } : { completionMode: mode })
    setCompletionMode(mode)
    if (mode === 'reflection-drafted') credit('workshop:journal')
    goForward()
  }
  const phase = !step || isComplete || step.kind === 'mindset' || step.kind === 'journal' ? 'Reflect' : step.kind === 'scenario' ? 'Apply' : step.kind === 'explain' || step.kind === 'quiz' ? 'Understand' : 'Read'
  const showFooter = !step || isComplete || step.kind === 'scenario' || step.kind === 'mindset' || step.kind === 'journal'

  return <div className="overlay session learning-session books-session">
    <div className="overlay-head"><button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close chapter')}><CloseIcon /></button><div className="step-bar"><i className="yl-progress" style={{ width: `${isComplete ? 100 : Math.min(100, (i + 1) / total * 100)}%` }} /></div>{xp > 0 && <span className="session-xp" aria-label={t('{xp} XP earned this session', { xp })}>+{xp}</span>}</div>
    <div className="overlay-body" ref={bodyRef}>
      <nav className="learning-route" aria-label={t('Learning stages')}>{STAGES.map((stage) => <span key={stage.id} data-active={phase === stage.id} aria-current={phase === stage.id ? 'step' : undefined}>{stage.label}</span>)}</nav>
      <div className="books-chapter-context"><span>{chapter.partTitleEn}</span><span>{t('Chapter {n}', { n: index })}</span></div>
      <div key={!step ? 'empty' : step.kind === 'complete' ? 'complete' : step.id} className="session-beat">
        {!step ? <EmptyChapter /> : step.kind === 'idea' ? <BookSourceReader sitting={step.sitting} n={step.n} of={step.of} passageKey={`${resumeId}:passage:${step.sitting.id}`} onNext={goForward} /> : step.kind === 'quiz' ? <CheckScreen prompt={step.prompt} choices={step.choices} answer={step.answer} sitting={step.sitting} n={step.n} of={step.of} state={quizState} onPick={answerQuiz} passageKey={`${resumeId}:passage:${step.sitting.id}`} onNext={goForward} /> : step.kind === 'explain' ? <BookPrinciple plan={plan} source={source && source.kind !== 'complete' ? source.sitting : undefined} onNext={goForward} /> : step.kind === 'scenario' ? <BookScenario plan={plan} selected={scenario} onPick={setScenario} /> : step.kind === 'mindset' ? <BookMindset plan={plan} /> : step.kind === 'journal' ? <div className="books-stage books-notebook-stage"><div className="books-reading-meta"><span>{t('Reflect · Your own words')}</span></div><BookJournal chapter={chapter} teachBackPrompt={plan.teachBackPrompt} actionPrompt={plan.actionPrompt} reviewPrompt={plan.reviewPrompt} /><p className="books-passages-note">{t('A complete draft keeps an explanation and an action. Understanding and real-world results are yours to revisit.')}</p></div> : <DoneView chapter={chapter} xp={xp} mode={completionMode} />}
      </div>
    </div>
    {showFooter && <div className="overlay-foot">
      {step?.kind === 'journal' ? <><button type="button" className="btn" disabled={!reflectionReady} onClick={() => finish('reflection-drafted')}>{t('Finish with my reflection')}</button><button type="button" className="books-text-button books-reading-only" onClick={() => finish('reading-only')}>{t('Skip reflection · finish reading only')}</button></> : <button type="button" className="btn" disabled={step?.kind === 'scenario' && scenario === null} onClick={isComplete || !step ? onClose : goForward}>{isComplete || !step ? t('Return to the book') : step.kind === 'scenario' ? t('Consider your perspective') : t('Open my notebook')}</button>}
    </div>}
  </div>
}

function CheckScreen({ prompt, choices, answer, sitting, n, of, state, onPick, passageKey, onNext }: { prompt: string; choices: string[]; answer: number; sitting: BooksSitting; n: number; of: number; state: QuizState | undefined; onPick: (picked: number, answer: number) => void; passageKey: string; onNext: () => void }) {
  const wrong = state?.wrong ?? []
  const solved = state?.solved ?? false
  return <div className="books-stage books-source-check" data-phase="check">
    {solved ? <>
      <div className="books-check-result"><RecallFeedback state="correct" label={state?.missed ? t('Resolved after a retry') : t('Source check passed')} /><details className="books-disclosure"><summary>{t('Question and answer')}</summary><p>{prompt}</p><p>{choices[answer]}</p></details></div>
      <BookSourceReader sitting={sitting} n={n} of={of} passageKey={passageKey} onNext={onNext} />
    </> : <>
      <div className="books-reading-meta"><span>{t('Source check · {n} / {of}', { n, of })}</span></div><h2 className="books-check-q">{prompt}</h2>
      <div className="session-options">{choices.map((label, index) => { const missed = wrong.includes(index); return <button key={index} type="button" className="option" data-state={missed ? 'wrong' : undefined} disabled={missed} onClick={() => onPick(index, answer)}>{label}</button> })}</div>
      {wrong.length > 0 && <div className="books-check-result"><RecallFeedback state="retry" label={t('Revisit the idea and choose again')} /><details className="books-disclosure"><summary>{t('Revisit the source notes')}</summary><div className="books-reading-copy">{sitting.bodyEn.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></details></div>}
    </>}
  </div>
}

function DoneView({ chapter, xp, mode }: { chapter: BooksChapter; xp: number; mode: BookCompletionMode }) {
  const reflected = mode === 'reflection-drafted'
  return <div className="books-done"><div className="books-done-seal"><CheckIcon size={28} /></div><span className="books-reading-meta">{t('Chapter {n}', { n: chapter.index })}</span><h2>{reflected ? t('Reflection drafted') : t('Reading complete')}</h2><p>{nodeLabelBooks(chapter)}</p>{xp > 0 && <span className="books-earned-xp">{t('+{xp} XP from checks and workshop participation', { xp })}</span>}<div className="books-reading-copy"><p>{reflected ? t('Your explanation and next action are kept in your notebook. Try the action, then return to see what changed.') : t('You finished the source and explored the scenario. Your unfinished notebook stays available for another visit.')}</p><p>{t('Revisit one idea without opening the notes. A finished chapter does not automatically prove understanding.')}</p></div></div>
}
function EmptyChapter() { return <div className="books-empty"><h2>{t('This chapter is being prepared')}</h2><p>{t('Come back when its source passages are ready.')}</p></div> }
function LockedView({ onClose }: { onClose: () => void }) { return <div className="overlay session books-session"><div className="overlay-head"><button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close')}><CloseIcon /></button></div><div className="overlay-body books-locked"><div><LockIcon size={32} /><h2>{t('Continue the book in order')}</h2><p>{t('Finish the previous chapter in this book first.')}</p></div></div><div className="overlay-foot"><button type="button" className="btn" onClick={onClose}>{t('Return to the book')}</button></div></div> }
