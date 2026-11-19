import { compactLessonSteps, compactStepId } from '../lib/sessionRoute'
import { useSessionRoute } from '../components/useSessionRoute'
import { PracticeExit, SessionProgress, SessionSummary } from '../components/SessionFlow'
import { StudyMusic } from '../components/StudyMusic'
import { ChapterCheck } from '../components/ChapterCheck'
import { quizAssisted } from '../lib/choiceSupport'
import { isComfortable } from '../lib/learningEngine'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LearningPath } from '../components/LearningPath'
import { useAuth } from '../auth/AuthProvider'
import { DialogueAudio, Glossed, Line, useGloss } from '../components/ChineseText'
import { DialogueRecheck, type RecheckSummary } from '../components/DialogueRecheck'
import { DialoguePractice, SentencePractice } from '../components/ProductionPractice'
import { WordRecall, type RecallResult } from '../components/WordRecall'
import type { ProductionResult } from '../lib/production'
import {
  ChineseHear,
  hasHanzi,
} from '../components/Hear'
import { CloseIcon, LockIcon } from '../components/Icons'
import {
  buildJiaochengSteps,
  getJiaochengLesson,
  hearableZh,
  JIAOCHENG_BOOK,
  jiaochengLessons,
  nodeCaptionJiaocheng,
  nodesForLesson,
  useJiaochengProgress,
  type JiaochengLesson,
} from '../lib/jiaocheng'
import { t } from '../lib/i18n'
import { recordHistory } from '../lib/history'
import { clearLearningCheckpoint, readLearningCheckpoint, writeLearningCheckpoint } from '../lib/resume'
import { playAdvance, playComplete, playCorrect, playWrong } from '../lib/sfx'
import { unlockSpeech } from '../lib/speech'
import { ITEM_XP, NODE_BONUS_XP } from '../lib/wordsSession'
import type { LessonText } from '../lib/types'
import { LINE_RATE } from '../lib/voices'
import { useStore, type PathNode } from '../store/store'
import { TeachView } from './TeachBeats'
import '../styles/jiaocheng-midterm.css'

type QuizState = { wrong: string[]; solved: boolean; missed: boolean }


/** Swap a translated sentence's `{slot}` markers for elements, so a sentence that holds <code> is still one string to translate. */
function withSlots(sentence: string, slots: Record<string, ReactNode>): ReactNode[] {
  return sentence.split(/(\{\w+\})/).map((piece, index) => {
    const slot = /^\{(\w+)\}$/.exec(piece)?.[1]
    return slot && slot in slots ? <Fragment key={index}>{slots[slot]}</Fragment> : piece
  })
}

function MidtermEntry({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null
  return (
    <button type="button" className="jiaocheng-midterm-entry" onClick={onClick}>
      <span className="kicker">第二册上 · 第1–12课</span>
      <strong>{t('Midterm mock')}</strong>
      <span>{t('The textbook’s own blanks, choices, corrections and reading.')}</span>
    </button>
  )
}

function bookPartLabel(book: JiaochengLesson['book']): string {
  return book === '2-2' ? '下' : '上'
}

export function JiaochengEmptyState() {
  return (
    <section className="kerja-empty metal">
      <div className="kicker">{JIAOCHENG_BOOK.edition}</div>
      <h2 className="zh" lang="zh-CN">
        {JIAOCHENG_BOOK.titleZh}
      </h2>
      <p className="kerja-empty-en">{JIAOCHENG_BOOK.title}</p>
      <p className="sub" style={{ textWrap: 'pretty', marginTop: 10 }}>
        {withSlots(
          // {part1} and {part2} stay in the text as markers, then become the <code> elements.
          t('{blurb}. Lessons appear when JSON lands under {part1} and {part2}.', {
            blurb: JIAOCHENG_BOOK.blurb,
            part1: '{part1}',
            part2: '{part2}',
          }),
          { part1: <code>src/data/jiaocheng/part1/</code>, part2: <code>part2/</code> },
        )}
      </p>
      <p className="sub" style={{ marginTop: 8 }}>
        {t('No lessons loaded yet — nothing fake to start.')}
      </p>
    </section>
  )
}

export function JiaochengPath({
  lesson,
  current,
  nodeDone,
  onPlay,
  fill,
}: {
  lesson: JiaochengLesson
  current: { lesson: number; node: PathNode }
  nodeDone: (lesson: number, node: PathNode) => boolean
  onPlay?: (lesson: number, node: PathNode) => void
  fill?: boolean
}) {
  const progress = useJiaochengProgress()
  const nodes = nodesForLesson(lesson)
  return (
    <LearningPath
      fill={fill}
      kicker={`第 ${lesson.bookLesson} 课 · 第二册${bookPartLabel(lesson.book)}`}
      title={lesson.titleZh || lesson.titleEn}
      subtitle={lesson.titleEn}
      source={lesson.sourcePages ? t('pp. {pages}', { pages: lesson.sourcePages }) : undefined}
      open={progress.isLessonReached(lesson.index)}
      items={nodes.map((node) => {
        const done = nodeDone(lesson.index, node)
        const on = current.lesson === lesson.index && current.node === node
        const caption = nodeCaptionJiaocheng(lesson, node)
        const activityTitle =
          node === 't2'
            ? lesson.dialogues[0]?.headingZh || lesson.dialogues[0]?.label
            : node === 't3'
              ? lesson.notes[0]?.title
              : undefined
        const title =
          (node === 't1' ? lesson.words[0]?.zh : undefined) ||
          activityTitle ||
          lesson.titleZh ||
          lesson.titleEn
        const subtitle =
          node === 't1'
            ? lesson.words
                .slice(1, 4)
                .map((word) => word.zh)
                .join(' · ') || lesson.words[0]?.en
            : node === 't2'
              ? lesson.dialogues[0]?.headingEn
              : node === 't3'
                ? [lesson.notes[0]?.example?.zh, lesson.notes[1]?.title].find(
                    (text) => text && text.trim() !== title.trim(),
                  )
                : undefined
        return {
          id: node,
          label: caption.zh,
          title,
          subtitle: subtitle?.trim() !== title.trim() ? subtitle : undefined,
          state: done ? ('done' as const) : on ? ('current' as const) : ('locked' as const),
          playable: progress.isNodePlayable(lesson.index, node),
          onSelect: () => onPlay?.(lesson.index, node),
        }
      })}
    />
  )
}

export function JiaochengHomePath({ onPlay, onMidterm }: { onPlay: (lesson: number, node: PathNode) => void; onMidterm?: () => void }) {
  const { nextPlayable, isNodeDone } = useJiaochengProgress()
  if (jiaochengLessons.length === 0) return <JiaochengEmptyState />
  const lesson = getJiaochengLesson(nextPlayable.lesson) ?? jiaochengLessons[0]
  return (
    <>
      <MidtermEntry onClick={onMidterm} />
      <JiaochengPath fill lesson={lesson} current={nextPlayable} nodeDone={isNodeDone} onPlay={onPlay} />
    </>
  )
}

export function JiaochengLearn({ onPlay, onMidterm }: { onPlay: (lesson: number, node: PathNode) => void; onMidterm?: () => void }) {
  const { nextPlayable, isNodeDone } = useJiaochengProgress()
  if (jiaochengLessons.length === 0) {
    return <JiaochengEmptyState />
  }
  return (
    <>
      <MidtermEntry onClick={onMidterm} />
      {jiaochengLessons.map((unit) => (
        <JiaochengPath
          key={unit.id}
          lesson={unit}
          current={nextPlayable}
          nodeDone={isNodeDone}
          onPlay={onPlay}
        />
      ))}
    </>
  )
}

export function JiaochengSession({
  lesson,
  node,
  onClose,
}: {
  lesson: number
  node: PathNode
  onClose: () => void
}) {
  const progress = useJiaochengProgress()
  const unit = getJiaochengLesson(lesson)
  if (!unit || !progress.isNodePlayable(lesson, node)) {
    return <LockedView onClose={onClose} />
  }
  return <JiaochengRunner lesson={lesson} node={node} onClose={onClose} />
}

function JiaochengRunner({ lesson, node, onClose }: { lesson: number; node: PathNode; onClose: () => void }) {
  const store = useStore()
  const progress = useJiaochengProgress()
  const unit = getJiaochengLesson(lesson)!
  const { user } = useAuth()
  const resumeId = `jiaocheng:production-v2:${user?.id ?? 'local'}:${lesson}:${node}`
  const checkpoint = useRef(readLearningCheckpoint(resumeId))
  const steps = useMemo(
    () =>
      (node === 't1' ? (steps: ReturnType<typeof buildJiaochengSteps>) => steps : compactLessonSteps)(buildJiaochengSteps(lesson, node).filter(
        (step) =>
          !(
            (step.kind === 'teach' || step.kind === 'recall') &&
            isComfortable(store, step.word.zh) &&
            step.id !== compactStepId(checkpoint.current?.stepId)
          ),
      )),
    [lesson, node],
  )
  const sessionWords = useMemo(
    () => [
      ...new Set(
        steps.flatMap((activity) => {
          if (activity.kind === 'teach' || activity.kind === 'recall') return [activity.word.zh]
          if (activity.kind === 'produce') return activity.words
          if (activity.kind === 'dialogue')
            return unit.words
              .filter((word) => activity.text.lines.some((line) => line.zh.includes(word.zh)))
              .map((word) => word.zh)
          return []
        }),
      ),
    ],
    [steps, unit.words],
  )
  const alreadyDone = useRef(progress.isNodeDone(lesson, node))
  const credited = useRef(new Set<string>())
  const finished = useRef(false)
  const left = useRef(new Set<string>())
  const bodyRef = useRef<HTMLDivElement>(null)
  const route = useSessionRoute(steps, checkpoint.current)
  const { i, step } = route
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const [assistedSteps, setAssistedSteps] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((checkpoint.current?.assistedSteps ?? []).map((id) => [id, true])),
  )
  const quizState = step.kind === 'quiz' ? quiz[step.id] : undefined
  const isComplete = step.kind === 'complete'
  const footerLocked = step.kind === 'quiz' && !quizState?.solved
  const beatKey = step.kind === 'complete' ? 'complete' : route.key

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [i])

  // The trail starts on encounter, even if the learner closes before advancing.
  useEffect(() => {
    if (step.kind === 'teach' && step.phase === 'meet') store.addCards(lesson + 3000, [step.word])
    if (step.kind === 'recall') store.encounterWord(step.word.zh, lesson + 3000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, lesson])

  useEffect(() => {
    if (isComplete) return
    writeLearningCheckpoint(resumeId, {
      stepId: step.id,
      practiceIds: route.selected ?? [],
      retryWords: [],
      assistedSteps: Object.keys(assistedSteps).filter((id) => assistedSteps[id]),
    })
  }, [i, isComplete, resumeId, step, assistedSteps, route.selected])

  useEffect(() => {
    if (!isComplete || finished.current) return
    finished.current = true
    playComplete()
    clearLearningCheckpoint(resumeId)
    progress.markNodeDone(lesson, node)
    recordHistory({
      course: 'jiaocheng',
      kind: 'node',
      lesson: lesson,
      node,
      title: unit.titleEn || unit.titleZh || undefined,
    })
    if (!alreadyDone.current) {
      store.awardXp(NODE_BONUS_XP)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, lesson, node, resumeId])

  function credit(id: string) {
    if (credited.current.has(id)) return
    credited.current.add(id)
    store.awardXp(ITEM_XP)
    store.practiceLog()
  }

  function markAssisted(turnId?: string) {
    if (step.kind === 'complete') return
    const scope = turnId ? `${step.id}::${turnId}` : step.id
    setAssistedSteps((previous) => (previous[scope] ? previous : { ...previous, [scope]: true }))
  }

  function goForward(repeat = false) {
    if (left.current.has(route.key)) return
    left.current.add(route.key)
    route.next(repeat)
  }

  function advance() {
    if (footerLocked) return
    if (step.kind === 'teach' && step.phase === 'meet') credit(step.id)
    if (step.kind === 'note' || step.kind === 'read') credit(step.id)
    if (isComplete) {
      onClose()
      return
    }
    playAdvance()
    goForward()
  }

  function finishRecall(result: RecallResult) {
    if (step.kind !== 'recall') return
    credit(step.id)
    playAdvance()
    goForward(result.missed || result.assisted)
  }

  function finishProduction(result: ProductionResult) {
    if (step.kind !== 'dialogue' && step.kind !== 'produce') return
    const outcomes = result.outcomes ?? result.words.map((word) => ({ word, ...result }))
    for (const outcome of outcomes) {
      if (outcome.evidence === 'practice') continue
      store.encounterWord(outcome.word, lesson + 3000)
      store.recordRecall(outcome.word, {
        correct: outcome.correct,
        assisted: outcome.assisted,
        mode: outcome.mode,
      })
    }
    credit(step.id)
    recordHistory({
      course: 'jiaocheng',
      kind: 'quiz',
      lesson: lesson,
      node,
      correct: result.evidence === 'practice' ? undefined : result.correct,
      title: result.evidence === 'practice' ? t('Sentence practice · ungraded') : undefined,
    })
    playAdvance()
    goForward()
  }

  function finishRecheck(summary: RecheckSummary) {
    if (step.kind !== 'recheck') return
    credit(step.id)
    recordHistory({
      course: 'jiaocheng',
      kind: 'quiz',
      lesson: lesson,
      node,
      correct: summary.unaided === summary.total,
      title: t('Dialogue check'),
    })
    playAdvance()
    goForward()
  }

  function answerQuiz(picked: string, answer: string, helped = false) {
    if (step.kind !== 'quiz') return
    const key = step.id
    const previous = quiz[key] ?? { wrong: [], solved: false, missed: false }
    if (previous.solved || previous.wrong.includes(picked)) return
    if (unit.words.some((word) => word.zh === answer)) {
      store.recordRecall(answer, {
        correct: picked === answer,
        assisted: quizAssisted(previous.missed, !!assistedSteps[step.id], helped),
        mode: 'recognition',
      })
    }
    if (picked === answer) {
      playCorrect()
      credit(key)
      recordHistory({ course: 'jiaocheng', kind: 'quiz', lesson: lesson, node, correct: true })
      setQuiz((questions) => ({
        ...questions,
        [key]: { wrong: previous.wrong, solved: true, missed: previous.missed },
      }))
    } else {
      playWrong()
      recordHistory({ course: 'jiaocheng', kind: 'quiz', lesson: lesson, node, correct: false })
      setQuiz((questions) => ({
        ...questions,
        [key]: { wrong: [...previous.wrong, picked], solved: false, missed: true },
      }))
    }
  }

  const progressPct = route.progress
  const showFooter =
    isComplete ||
    step.kind === 'teach' ||
    step.kind === 'note' ||
    step.kind === 'read' ||
    (step.kind === 'quiz' && quizState?.solved)

  return (
    <div className="overlay session learning-session">
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close session')}>
          <CloseIcon />
        </button><StudyMusic compact />
        <div className="step-bar">
          <i className="yl-progress" style={{ width: `${Math.min(100, progressPct)}%` }} />
        </div>
      </div>
      <SessionProgress kind={step.kind} {...('n' in step && (step.kind === 'teach' || route.inPractice) ? { n: step.n, of: step.of } : {})} />

      <div className="overlay-body" ref={bodyRef}>
        <div key={beatKey} className="session-beat yl-enter">
          {step.kind === 'teach' ? (
            <TeachView
              phase={step.phase}
              word={step.word}
              example={step.example}
              hook={step.hook}
              lesson={lesson + 3000}
              n={step.n}
              of={step.of}
            />
          ) : step.kind === 'read' ? (
            <ReadView text={step.text} />
          ) : step.kind === 'recall' ? (
            <WordRecall
              word={step.word}
              n={step.n}
              of={step.of}
              cue={node === 't2' ? 'sentence' : node === 'wrap' ? 'meaning' : 'sound'}
              repeatOnHelp={route.canRepeat}
              externallyAssisted={route.pass ? false : assistedSteps[step.id]}
              onAssistance={() => {
                markAssisted()
              }}
              onAttempt={(correct, assisted, mode) => {
                store.recordRecall(step.word.zh, { correct, assisted, mode })
                markAssisted()
              }}
              onComplete={finishRecall}
            />
          ) : step.kind === 'dialogue' ? (
            <DialoguePractice
              short
              text={step.text}
              lesson={lesson}
              targetWords={unit.words.map((word) => word.zh)}
              externallyAssisted={assistedSteps[step.id]}
              assistedTurns={Object.keys(assistedSteps)
                .filter((id) => id.startsWith(`${step.id}::`))
                .map((id) => id.slice(step.id.length + 2))}
              onAssistance={markAssisted}
              onComplete={finishProduction}
            />
          ) : step.kind === 'recheck' ? (
            <DialogueRecheck
              text={step.text}
              words={step.words}
              onRecord={(zh, correct, assisted) =>
                store.recordRecall(zh, { correct, assisted, mode: 'recognition' })
              }
              onDone={finishRecheck}
            />
          ) : step.kind === 'produce' ? (
            <SentencePractice
              example={step.example}
              targetWords={step.words}
              grammar={step.grammar}
              lesson={lesson}
              externallyAssisted={assistedSteps[step.id]}
              onAssistance={markAssisted}
              onComplete={finishProduction}
            />
          ) : step.kind === 'note' ? (
            <NoteView title={step.title} body={step.body} example={step.example} n={step.n} of={step.of} />
          ) : step.kind === 'quiz' ? (
            <ChapterCheck
              key={step.id}
              question={step.question}
              n={step.n}
              of={step.of}
              state={quizState}
              assisted={!!assistedSteps[step.id]}
              onAssistance={markAssisted}
              onPick={answerQuiz}
            />
          ) : (
            <SessionSummary title={unit.titleZh} words={sessionWords} />
          )}
          {route.inPractice && !(step.kind === 'quiz' && quizState?.solved) && <PracticeExit onFinish={route.finish} />}
        </div>
      </div>
      {showFooter && (
        <div className="overlay-foot">
          <button type="button" className="btn" onPointerDown={() => unlockSpeech()} onClick={advance}>
            {isComplete ? t('Done') : t('Continue')}
          </button>
        </div>
      )}
    </div>
  )
}

function ReadView({ text }: { text: LessonText }) {
  const { onWord, sheet } = useGloss()
  const { prefs } = useStore()
  const heading = text.heading_zh || text.heading_en || text.label
  return (
    <>
      <header className="session-step-head">
        <div className="kicker-ink">
          {text.type === 'dialogue'
            ? t('{label} · Dialogue', { label: text.label })
            : t('{label} · Passage', { label: text.label })}
        </div>
        <h2 className="session-step-title" lang={hasHanzi(heading) ? 'zh-CN' : undefined}>
          {hasHanzi(heading) ? <Glossed text={heading} onWord={onWord} /> : heading}
        </h2>
      </header>
      {prefs.showEnglish && text.heading_en && text.heading_zh && (
        <p className="session-read-en">{text.heading_en}</p>
      )}
      <DialogueAudio text={text} />
      <div className="session-read">
        {text.lines.map((line, i) => (
          <Line
            key={`${text.label}-${i}`}
            line={line}
            self={text.type === 'dialogue' && i % 2 === 1}
            showPinyin={prefs.showPinyin}
            showEnglish={prefs.showEnglish}
            onWord={onWord}
          />
        ))}
      </div>
      {sheet}
    </>
  )
}

function NoteView({
  title,
  body,
  example,
  n,
  of,
}: {
  title: string
  body: string
  example: { zh: string; pinyin: string; en: string } | null
  n: number
  of: number
}) {
  const { onWord, sheet } = useGloss()
  const { prefs } = useStore()
  const head = of > 1 ? t('Note · {n} of {of}', { n, of }) : t('Note')
  const exampleZh = hearableZh(example?.zh)
  const titleZh = hearableZh(title)
  const bodyZh = hearableZh(body)

  return (
    <>
      <header className="session-step-head">
        <div className="kicker-ink">{head}</div>
        <h2 className="session-step-title" lang={hasHanzi(title) ? 'zh-CN' : undefined}>
          {hasHanzi(title) ? <Glossed text={title} onWord={onWord} /> : title}
        </h2>
      </header>
      <p
        className="sub"
        style={{ textWrap: 'pretty', lineHeight: 1.55 }}
        lang={hasHanzi(body) ? 'zh-CN' : undefined}
      >
        {hasHanzi(body) ? <Glossed text={body} onWord={onWord} /> : body}
      </p>
      {example && exampleZh && (
        <div className="card session-prompt">
          <p
            className="zh"
            lang="zh-CN"
            style={{ fontSize: 20, fontWeight: 800, margin: 0, textWrap: 'pretty' }}
          >
            <Glossed text={example.zh} onWord={onWord} />
          </p>
          {prefs.showPinyin && example.pinyin && (
            <p className="sub" style={{ margin: '6px 0 0', color: 'var(--red-mid)' }}>
              {example.pinyin}
            </p>
          )}
          {prefs.showEnglish && example.en && (
            <p className="sub" style={{ margin: '8px 0 0' }}>
              {example.en}
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <ChineseHear text={exampleZh} label={t('Hear the line')} rate={LINE_RATE} />
          </div>
        </div>
      )}
      {!exampleZh && titleZh && (
        <div style={{ marginTop: 14 }}>
          <ChineseHear text={titleZh} label={t('Hear it')} />
        </div>
      )}
      {!exampleZh && !titleZh && bodyZh && (
        <div style={{ marginTop: 14 }}>
          <ChineseHear text={bodyZh} label={t('Hear it')} />
        </div>
      )}
      {sheet}
    </>
  )
}


function LockedView({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay session">
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label={t('Close')}>
          <CloseIcon />
        </button>
      </div>
      <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="yl-enter" style={{ textAlign: 'center' }}>
          <LockIcon size={36} />
          <h2 className="h1" style={{ marginTop: 16 }}>
            {t('Locked')}
          </h2>
          <p className="sub" style={{ marginTop: 8 }}>
            {t('Finish the earlier Jiaocheng nodes first.')}
          </p>
        </div>
      </div>
    </div>
  )
}
