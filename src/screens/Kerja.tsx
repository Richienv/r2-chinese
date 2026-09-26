import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DialogueAudio, Line, useGloss } from '../components/ChineseText'
import { ChineseHear, hasHanzi, HearButton, useAutoSpeak, useAutoSpeakLines, useSpeechActive } from '../components/Hear'
import { CheckIcon, CloseIcon, HeartIcon, LockIcon, PlayIcon } from '../components/Icons'
import {
  buildKerjaSteps,
  getKerjaChapter,
  hearableZh,
  KERJA_BOOK,
  KERJA_NODE_LABEL,
  kerjaChapters,
  kerjaPlayableCount,
  kerjaSittingWordCount,
  nodeCaptionKerja,
  nodesForChapter,
  useKerjaProgress,
  type KerjaChapter,
  type KerjaSessionStep,
} from '../lib/kerja'
import { unlockSpeech, speakLines, stopSpeech } from '../lib/speech'
import { ITEM_XP, NODE_BONUS_XP, SESSION_HEARTS } from '../lib/wordsSession'
import type { LessonText } from '../lib/types'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'
import { useStore, type PathNode } from '../store/store'
import { TeachView } from './TeachBeats'

const CORRECT_HOLD_MS = 700
const W = 396
const CX = [118, 278, 108, 288, 116, 270]
const CURRENT = 70
const REST = 58
const GAP = 8

type QuizState = { wrong: string[]; solved: boolean; missed: boolean }
type HeartLoss = { index: number; tick: number }

function nodeClassName(state: 'done' | 'on' | 'lock') {
  if (state === 'done') return 'path-node path-node-done'
  if (state === 'on') return 'path-node path-node-on'
  return 'path-node path-node-lock'
}

function unitLayout(nodeCount: number, currentIndex: number, fillHeight?: number) {
  const sizes = Array.from({ length: nodeCount }, (_, i) => (i === currentIndex ? CURRENT : REST))
  const topPad = currentIndex === 0 ? 44 : 10
  const bottom = 10
  const compact = topPad + sizes.reduce((sum, size, i) => sum + (i === 0 ? size : GAP + size), 0) + bottom
  const gaps = nodeCount - 1
  let gap = GAP
  if (fillHeight && fillHeight > compact && gaps > 0) {
    gap = Math.min(52, GAP + (fillHeight - compact) / gaps)
  }
  const xs: number[] = []
  const ys: number[] = []
  let y = topPad + (sizes[0] ?? REST) / 2
  for (let i = 0; i < nodeCount; i++) {
    xs.push(CX[i % CX.length])
    ys.push(y)
    if (i < nodeCount - 1) y += sizes[i] / 2 + gap + sizes[i + 1] / 2
  }
  const last = Math.max(0, nodeCount - 1)
  return { xs, ys, sizes, height: (ys[last] ?? 0) + (sizes[last] ?? REST) / 2 + bottom }
}

function railPath(xs: number[], ys: number[]) {
  if (!xs.length) return ''
  let d = `M${xs[0]} ${ys[0]}`
  for (let i = 1; i < xs.length; i++) {
    const mid = (ys[i - 1] + ys[i]) / 2
    d += ` C${xs[i - 1]} ${mid} ${xs[i]} ${mid} ${xs[i]} ${ys[i]}`
  }
  return d
}

export function KerjaEmptyState() {
  return (
    <section className="kerja-empty metal">
      <div className="kicker">Mandarin Kerja Nyata</div>
      <h2 className="zh" lang="zh-CN">
        {KERJA_BOOK.titleZh}
      </h2>
      <p className="kerja-empty-en">{KERJA_BOOK.title}</p>
      <p className="sub" style={{ textWrap: 'pretty', marginTop: 10 }}>
        {KERJA_BOOK.blurb}. Chapters appear here automatically when unit JSON is added under{' '}
        <code>src/data/kerja/units/</code>.
      </p>
      <p className="sub" style={{ marginTop: 8 }}>
        No chapters loaded yet — nothing fake to start.
      </p>
    </section>
  )
}

export function KerjaPath({
  chapter,
  current,
  nodeDone,
  onPlay,
  fill,
}: {
  chapter: KerjaChapter
  current: { chapter: number; node: PathNode }
  nodeDone: (chapter: number, node: PathNode) => boolean
  onPlay?: (chapter: number, node: PathNode) => void
  fill?: boolean
}) {
  const progress = useKerjaProgress()
  const slotRef = useRef<HTMLDivElement>(null)
  const [fillHeight, setFillHeight] = useState(0)
  const nodes = nodesForChapter(chapter)

  useLayoutEffect(() => {
    if (!fill) return
    const el = slotRef.current
    if (!el) return
    const sync = () => setFillHeight(el.clientHeight)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fill, chapter.id])

  const currentIndex = nodes.findIndex((n) => current.chapter === chapter.index && current.node === n)
  const { xs, ys, sizes, height } = unitLayout(nodes.length, currentIndex, fill ? fillHeight || undefined : undefined)
  const litTo = nodes.reduce((acc, n, i) => (nodeDone(chapter.index, n) ? i + 1 : acc), 0)
  const litEnd = current.chapter === chapter.index ? Math.max(litTo, currentIndex) : litTo
  const showLit = current.chapter === chapter.index || litTo > 0
  const litXs = showLit ? xs.slice(0, Math.max(1, litEnd + 1)) : []
  const litYs = ys.slice(0, litXs.length)
  const open = progress.isChapterReached(chapter.index)

  return (
    <section className={fill ? 'path-lesson path-lesson-fill' : 'path-lesson'}>
      <div className={`path-banner metal${open ? '' : ' path-banner-lock'}`}>
        <div className="path-banner-copy">
          <div className="kicker">Bab {chapter.index}</div>
          <h2 className="zh path-banner-zh" lang="zh-CN">
            {chapter.titleZh || chapter.titleEn}
          </h2>
          <div className="path-banner-en">{chapter.titleEn || chapter.titleZh}</div>
          {chapter.sourcePages ? <div className="path-later-kicker">pp. {chapter.sourcePages}</div> : null}
        </div>
        <span className="path-banner-read">单元</span>
      </div>

      <div className="path-unit-slot" ref={slotRef}>
        <div className="path-unit" style={{ height }}>
          <svg className="path-rail" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden>
            <path className="path-rail-track" d={railPath(xs, ys)} />
            {litXs.length > 0 && <path className="path-rail-lit" d={railPath(litXs, litYs)} />}
          </svg>

          {nodes.map((node, i) => {
            const done = nodeDone(chapter.index, node)
            const on = current.chapter === chapter.index && current.node === node
            const playable = progress.isNodePlayable(chapter.index, node)
            const state = done ? 'done' : on ? 'on' : 'lock'
            const r = sizes[i] / 2
            const caption = nodeCaptionKerja(chapter, node)
            const side = xs[i] < W / 2 ? 'left' : 'right'
            return (
              <button
                key={node}
                type="button"
                className={`${nodeClassName(state)} tap44`}
                data-state={state}
                data-node={node}
                data-side={side}
                disabled={!playable}
                style={
                  {
                    '--path-d': `${sizes[i]}px`,
                    left: `${(xs[i] / W) * 100}%`,
                    top: ys[i] - r,
                    marginLeft: -r,
                  } as CSSProperties
                }
                onPointerDown={() => {
                  if (playable) unlockSpeech()
                }}
                onClick={() => {
                  if (!playable) return
                  onPlay?.(chapter.index, node)
                }}
                aria-label={`${caption.zh}${caption.hint ? ` ${caption.hint}` : ''}${done ? ', done' : on ? ', start' : ', locked'}`}
              >
                {on && <span className="path-start">START</span>}
                <span className="path-glyph" aria-hidden>
                  {done ? <CheckIcon size={22} /> : on ? <PlayIcon size={22} /> : <LockIcon size={16} />}
                </span>
                <span className="path-meta">
                  <span className="path-en zh" lang="zh-CN">
                    {caption.zh}
                  </span>
                  <span className="path-zh zh" lang="zh-CN">
                    {caption.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function KerjaHomePath({
  onPlay,
}: {
  onPlay: (chapter: number, node: PathNode) => void
}) {
  const { nextPlayable, isNodeDone } = useKerjaProgress()
  if (kerjaChapters.length === 0) return <KerjaEmptyState />
  const chapter = getKerjaChapter(nextPlayable.chapter) ?? kerjaChapters[0]
  return (
    <KerjaPath
      fill
      chapter={chapter}
      current={nextPlayable}
      nodeDone={isNodeDone}
      onPlay={onPlay}
    />
  )
}

export function KerjaLearn({
  onPlay,
}: {
  onPlay: (chapter: number, node: PathNode) => void
}) {
  const { nextPlayable, isNodeDone } = useKerjaProgress()
  if (kerjaChapters.length === 0) {
    return (
      <div className="path-page">
        <KerjaEmptyState />
      </div>
    )
  }
  return (
    <div className="path-page">
      {kerjaChapters.map((ch) => (
        <KerjaPath
          key={ch.id}
          chapter={ch}
          current={nextPlayable}
          nodeDone={isNodeDone}
          onPlay={onPlay}
        />
      ))}
    </div>
  )
}

export function KerjaSession({
  chapter,
  node,
  onClose,
}: {
  chapter: number
  node: PathNode
  onClose: () => void
}) {
  const progress = useKerjaProgress()
  const ch = getKerjaChapter(chapter)
  if (!ch || !progress.isNodePlayable(chapter, node)) {
    return <LockedView onClose={onClose} />
  }
  return <KerjaRunner chapter={chapter} node={node} onClose={onClose} />
}

function KerjaRunner({
  chapter,
  node,
  onClose,
}: {
  chapter: number
  node: PathNode
  onClose: () => void
}) {
  const store = useStore()
  const progress = useKerjaProgress()
  const ch = getKerjaChapter(chapter)!
  const steps = useMemo(() => buildKerjaSteps(chapter, node), [chapter, node])
  const alreadyDone = useRef(progress.isNodeDone(chapter, node))
  const credited = useRef(new Set<string>())
  const finished = useRef(false)
  const left = useRef(new Set<number>())
  const xpRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [i, setI] = useState(0)
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({})
  const [hearts, setHearts] = useState(SESSION_HEARTS)
  const [heartLoss, setHeartLoss] = useState<HeartLoss | null>(null)
  const [failed, setFailed] = useState(false)
  const [xp, setXp] = useState(0)

  const step = steps[Math.min(i, steps.length - 1)]
  const quizState = step.kind === 'quiz' ? quiz[step.id] : undefined
  const isComplete = !failed && step.kind === 'complete'
  const total = kerjaPlayableCount(steps)
  const footerLocked = !failed && step.kind === 'quiz' && !quizState?.solved
  const beatKey = failed ? 'failed' : step.kind === 'complete' ? 'complete' : step.id

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [i, failed])

  useEffect(() => {
    if (!isComplete || finished.current) return
    finished.current = true
    progress.markNodeDone(chapter, node)
    if (!alreadyDone.current) {
      store.awardXp(NODE_BONUS_XP)
      xpRef.current += NODE_BONUS_XP
      setXp(xpRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, chapter, node])

  useEffect(() => {
    if (failed || step.kind !== 'quiz' || !quizState?.solved) return
    const from = i
    const t = window.setTimeout(() => {
      if (left.current.has(from)) return
      left.current.add(from)
      setI((cur) => (cur === from ? cur + 1 : cur))
    }, CORRECT_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [failed, i, quizState?.solved, step.kind])

  function credit(id: string) {
    if (credited.current.has(id)) return
    credited.current.add(id)
    xpRef.current += ITEM_XP
    setXp(xpRef.current)
    store.awardXp(ITEM_XP)
    store.practiceLog()
  }

  function meetWord(word: { zh: string }, id: string) {
    store.addCards(chapter + 1000, [word])
    credit(id)
  }

  function goForward() {
    if (left.current.has(i)) return
    left.current.add(i)
    setI((cur) => Math.min(cur + 1, steps.length - 1))
  }

  function advance() {
    if (footerLocked) return
    if (step.kind === 'teach' && step.phase === 'meet') meetWord(step.word, step.id)
    if (step.kind === 'note' || step.kind === 'read') credit(step.id)
    if (failed || isComplete) {
      onClose()
      return
    }
    goForward()
  }

  function answerQuiz(picked: string, answer: string) {
    if (step.kind !== 'quiz') return
    const key = step.id
    const prev = quiz[key] ?? { wrong: [], solved: false, missed: false }
    if (prev.solved || prev.wrong.includes(picked)) return

    if (picked === answer) {
      credit(key)
      setQuiz((q) => ({
        ...q,
        [key]: { wrong: prev.wrong, solved: true, missed: prev.missed || prev.wrong.length > 0 },
      }))
      return
    }

    const nextHearts = hearts - 1
    setHearts(Math.max(0, nextHearts))
    setHeartLoss({ index: Math.max(0, nextHearts), tick: Date.now() })
    setQuiz((q) => ({
      ...q,
      [key]: { wrong: [...prev.wrong, picked], solved: false, missed: true },
    }))
    if (nextHearts <= 0) setFailed(true)
  }

  const progressPct = failed ? (i / total) * 100 : isComplete ? 100 : ((i + 1) / total) * 100
  const showFooter =
    failed || isComplete || step.kind === 'teach' || step.kind === 'note' || step.kind === 'read'
  const footerLabel = failed || isComplete ? 'Continue' : 'Next'

  return (
    <div className="overlay session">
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label="Close session">
          <CloseIcon />
        </button>
        <div className="step-bar">
          <i className="yl-progress" style={{ width: `${Math.min(100, progressPct)}%` }} />
        </div>
        <Hearts count={hearts} loss={heartLoss} />
        {xp > 0 && (
          <span key={xp} className="session-xp yl-pop" aria-label={`${xp} XP earned this session`}>
            +{xp}
          </span>
        )}
      </div>

      <div className="overlay-body" ref={bodyRef}>
        <div key={beatKey} className="session-beat yl-enter">
          {failed ? (
            <FailedView xp={xp} wordsMet={countMet(steps, credited.current)} loss={heartLoss} />
          ) : step.kind === 'teach' ? (
            <TeachView
              phase={step.phase}
              word={step.word}
              example={step.example}
              hook={step.hook}
              lesson={chapter + 1000}
              n={step.n}
              of={step.of}
            />
          ) : step.kind === 'read' ? (
            <ReadView text={step.text} />
          ) : step.kind === 'note' ? (
            <NoteView title={step.title} body={step.body} example={step.example} n={step.n} of={step.of} />
          ) : step.kind === 'quiz' ? (
            <MatchView question={step.question} n={step.n} of={step.of} state={quizState} onPick={answerQuiz} />
          ) : (
            <DoneView
              node={node}
              titleZh={ch.titleZh}
              titleEn={ch.titleEn}
              wordCount={kerjaSittingWordCount(chapter, node)}
              xp={xp}
              replay={alreadyDone.current}
            />
          )}
        </div>
      </div>

      {showFooter && (
        <div className="overlay-foot">
          <button type="button" className="btn" onPointerDown={() => unlockSpeech()} onClick={advance}>
            {footerLabel}
          </button>
        </div>
      )}
    </div>
  )
}

function countMet(steps: KerjaSessionStep[], credited: Set<string>): number {
  return steps.filter((s) => s.kind === 'teach' && s.phase === 'meet' && credited.has(s.id)).length
}

function Hearts({ count, loss }: { count: number; loss?: HeartLoss | null }) {
  return (
    <div className="session-hearts hearts" aria-label={`${count} of ${SESSION_HEARTS} hearts`}>
      {Array.from({ length: SESSION_HEARTS }, (_, n) => {
        const justLost = loss?.index === n
        return (
          <span
            key={justLost ? `lost-${loss.tick}` : `h-${n}`}
            className={justLost ? 'heart yl-heart-loss' : 'heart'}
            data-off={n >= count}
          >
            <HeartIcon size={15} filled={n < count} />
          </span>
        )
      })}
    </div>
  )
}

function StepHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="session-step-head">
      <div className="kicker-ink">{kicker}</div>
      <h2 className="session-step-title">{title}</h2>
    </header>
  )
}

function ReadView({ text }: { text: LessonText }) {
  const { onWord, sheet } = useGloss()
  const heading = text.heading_zh || text.heading_en || text.label
  return (
    <>
      <StepHead
        kicker={`${text.label} · ${text.type === 'dialogue' ? 'Dialogue' : 'Passage'}`}
        title={heading}
      />
      {text.heading_en && text.heading_zh && <p className="session-read-en">{text.heading_en}</p>}
      <DialogueAudio text={text} />
      <div className="session-read">
        {text.lines.map((line, i) => (
          <Line
            key={`${text.label}-${i}`}
            line={line}
            self={text.type === 'dialogue' && i % 2 === 1}
            showPinyin
            showEnglish
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
  const head = of > 1 ? `Note · ${n} of ${of}` : 'Note'
  const exampleZh = hearableZh(example?.zh)
  const titleZh = hearableZh(title)
  const bodyZh = hearableZh(body)

  return (
    <>
      <StepHead kicker={head} title={title} />
      <p className="sub" style={{ textWrap: 'pretty', lineHeight: 1.55 }}>
        {body}
      </p>
      {example && exampleZh && (
        <div className="card session-prompt">
          <p className="zh" lang="zh-CN" style={{ fontSize: 20, fontWeight: 800, margin: 0, textWrap: 'pretty' }}>
            {example.zh}
          </p>
          {example.pinyin && (
            <p className="sub" style={{ margin: '6px 0 0', color: 'var(--red-mid)' }}>
              {example.pinyin}
            </p>
          )}
          {example.en && <p className="sub" style={{ margin: '8px 0 0' }}>{example.en}</p>}
          <div style={{ marginTop: 12 }}>
            <ChineseHear text={exampleZh} label="Hear the line" rate={LINE_RATE} />
          </div>
        </div>
      )}
      {!exampleZh && titleZh && (
        <div style={{ marginTop: 14 }}>
          <ChineseHear text={titleZh} label="Hear it" />
        </div>
      )}
      {!exampleZh && !titleZh && bodyZh && (
        <div style={{ marginTop: 14 }}>
          <ChineseHear text={bodyZh} label="Hear it" />
        </div>
      )}
    </>
  )
}

function MatchView({
  question,
  n,
  of,
  state,
  onPick,
}: {
  question: { prompt: string; context?: { zh: string; pinyin: string; en: string }; options: { zh: string; label: string }[]; answer: string }
  n: number
  of: number
  state: QuizState | undefined
  onPick: (picked: string, answer: string) => void
}) {
  const wrong = state?.wrong ?? []
  const solved = state?.solved ?? false
  const missed = state?.missed ?? false
  const contextZh = question.context?.zh?.trim() ?? ''
  const chineseChoices = question.options
    .map((o) => o.label)
    .filter((label) => hasHanzi(label) && !/[A-Za-z]{3,}/.test(label))
  const choiceKey = chineseChoices.join('\u0001')
  const choicesPlaying = useSpeechActive(`lines|${choiceKey}`)

  useAutoSpeak(contextZh, VOICE.xiaoxiao, LINE_RATE)
  useAutoSpeakLines(contextZh ? [] : chineseChoices, VOICE.xiaoxiao, WORD_RATE)

  return (
    <>
      <StepHead kicker={of > 1 ? `Check · ${n} of ${of}` : 'Check'} title={question.prompt} />
      {question.context && (
        <div className="card session-prompt">
          <p className="zh" lang="zh-CN" style={{ fontSize: 22, fontWeight: 800, margin: 0, textWrap: 'pretty' }}>
            {question.context.zh}
          </p>
          <div style={{ marginTop: 12 }}>
            <HearButton text={question.context.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label="Hear the line" />
          </div>
        </div>
      )}
      {!question.context && chineseChoices.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="hear hear-ink"
            data-on={choicesPlaying}
            aria-label={choicesPlaying ? 'Stop choices' : 'Hear choices'}
            aria-pressed={choicesPlaying}
            onPointerDown={() => unlockSpeech()}
            onClick={() => {
              if (choicesPlaying) {
                stopSpeech()
                return
              }
              void speakLines(
                chineseChoices.map((text) => ({ text, voice: VOICE.xiaoxiao, rate: WORD_RATE })),
                { group: `lines|${choiceKey}`, key: `lines|${choiceKey}` },
              )
            }}
          >
            <span>{choicesPlaying ? 'Playing' : 'Hear choices'}</span>
          </button>
        </div>
      )}
      <div className="session-options">
        {question.options.map((o) => {
          const isAnswer = o.zh === question.answer
          const isWrong = wrong.includes(o.zh)
          const st = solved && isAnswer ? 'correct' : isWrong ? 'wrong' : undefined
          const motion = solved && isAnswer ? ' yl-correct' : isWrong ? ' yl-wrong' : ''
          return (
            <button
              key={isWrong ? `${o.zh}-miss` : o.zh}
              type="button"
              className={`option zh${motion}`}
              data-state={st}
              disabled={solved || isWrong}
              onPointerDown={() => unlockSpeech()}
              onClick={() => onPick(o.zh, question.answer)}
              lang="zh-CN"
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {solved && (
        <div className="yl-enter-up" style={{ textAlign: 'center', marginTop: 2 }} aria-live="polite">
          <strong style={{ fontSize: 16, fontWeight: 800, color: 'var(--red-deep)' }}>
            {missed ? 'That’s it' : 'Nice!'}
          </strong>
        </div>
      )}
    </>
  )
}

function DoneView({
  node,
  titleZh,
  titleEn,
  wordCount,
  xp,
  replay,
}: {
  node: PathNode
  titleZh: string
  titleEn: string
  wordCount: number
  xp: number
  replay: boolean
}) {
  const label = KERJA_NODE_LABEL[node]
  return (
    <div style={{ textAlign: 'center', paddingTop: 36 }}>
      <div className="medal pop">
        <CheckIcon size={46} />
      </div>
      <h2 className="h1 yl-enter" style={{ marginTop: 22, textWrap: 'balance' }}>
        {label.en} complete
      </h2>
      <p className="sub yl-enter-up" style={{ marginTop: 8, animationDelay: '80ms', textWrap: 'pretty' }}>
        {titleZh} · {titleEn}
      </p>
      <div
        className="session-xp yl-pop"
        style={{ marginTop: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', animationDelay: '120ms' }}
      >
        +{xp} XP
      </div>
      <div
        className="row yl-enter-up"
        style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap', animationDelay: '180ms' }}
      >
        <span className="pill-ink">+{ITEM_XP} XP / item</span>
        {!replay && <span className="pill-ink">+{NODE_BONUS_XP} node</span>}
        {wordCount > 0 && <span className="pill-ink">{wordCount} words</span>}
      </div>
    </div>
  )
}

function FailedView({
  xp,
  wordsMet,
  loss,
}: {
  xp: number
  wordsMet: number
  loss?: HeartLoss | null
}) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <Hearts count={0} loss={loss ?? { index: 0, tick: 1 }} />
      </div>
      <h2 className="h1" style={{ marginTop: 12, textWrap: 'balance' }}>
        Out of hearts
      </h2>
      <p className="sub" style={{ marginTop: 8, textWrap: 'pretty' }}>
        Try this node again when you’re ready.
      </p>
      <div className="session-xp" style={{ marginTop: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        +{xp} XP
      </div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <span className="pill-ink">{wordsMet} words met</span>
        <span className="pill-ink">Node not marked done</span>
      </div>
    </div>
  )
}

function LockedView({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay session">
      <div className="overlay-head">
        <button type="button" className="icon-round tap44" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="yl-enter" style={{ textAlign: 'center' }}>
          <LockIcon size={36} />
          <h2 className="h1" style={{ marginTop: 16 }}>
            Locked
          </h2>
          <p className="sub" style={{ marginTop: 8 }}>
            Finish the earlier Kerja nodes first.
          </p>
        </div>
      </div>
    </div>
  )
}
