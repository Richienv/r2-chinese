import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { blankedExample, corpusPeers, enrichVocab } from '../lib/content'
import { buildRecallPromptContext } from '../lib/recallContext'
import { coreMeaning, sameText, type Exercise, type ExerciseStep, type ExSentence, type ExWord } from '../lib/exercises'
import { t } from '../lib/i18n'
import { rng, seedOf, shuffle } from '../lib/seeded'
import { haptic, playAdvance, playCorrect, playHint, playListen, playTick, playWrong } from '../lib/sfx'
import { speak, unlockSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import { HearButton, rateForChinese, useAutoSpeak } from './Hear'
import { useMomentum } from './Momentum'
import '../styles/duo.css'

/** Every mixed exercise picks among offered answers, so it is recognition evidence, never production. */
export type EvidenceMode = 'recognition'
export interface ExerciseOutcome {
  missed: boolean
  assisted: boolean
}

interface ExerciseProps {
  step: ExerciseStep
  /** The route key: a returning exercise is a new attempt for the combo. */
  attemptKey: string
  /** The learner already saw this answer earlier in the sitting. */
  repeat?: boolean
  onRecord: (zh: string, correct: boolean, assisted: boolean, mode: EvidenceMode) => void
  onDone: (outcome: ExerciseOutcome) => void
}

/** One exercise of the mixed round, with its own check / feedback bar. */
export function ExerciseView(props: ExerciseProps) {
  const { exercise } = props.step
  const judge = useJudge(props)
  const kind = exercise.kind
  return (
    <section className="duo-exercise" data-kind={kind} data-verdict={judge.verdict === null ? undefined : judge.verdict ? 'right' : 'wrong'}>
      {kind === 'match' ? (
        <MatchBoard exercise={exercise} judge={judge} onRecord={props.onRecord} />
      ) : kind === 'arrange' ? (
        <Arrange exercise={exercise} judge={judge} />
      ) : kind === 'char-build' ? (
        <CharBuild exercise={exercise} judge={judge} />
      ) : kind === 'continue' ? (
        <Continue exercise={exercise} judge={judge} />
      ) : (
        <Pick exercise={exercise} judge={judge} />
      )}
      {judge.verdict !== null && (
        <Feedback exercise={exercise} right={judge.verdict} mixed={judge.mixed} attemptKey={props.attemptKey} onNext={() => {
          playAdvance()
          props.onDone({ missed: !judge.verdict, assisted: judge.helped })
        }} />
      )}
    </section>
  )
}

interface Judge {
  verdict: boolean | null
  helped: boolean
  /** A finished board that had a mix-up: a win on screen, honest in the combo. */
  mixed: boolean
  help: () => void
  /** Settle the exercise once. `words` with a `mode` become store evidence. */
  settle: (correct: boolean, words: string[], mode: EvidenceMode | null, clean?: boolean) => void
}

function useJudge({ attemptKey, repeat, onRecord }: ExerciseProps): Judge {
  const momentum = useMomentum()
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [mixed, setMixed] = useState(false)
  const [helped, setHelped] = useState(!!repeat)
  const settled = useRef(false)
  const helpedRef = useRef(helped)
  helpedRef.current = helped
  return {
    verdict,
    helped,
    mixed,
    help: () => {
      if (!helpedRef.current) playHint()
      setHelped(true)
    },
    settle(correct, words, mode, clean = correct) {
      if (settled.current) return
      settled.current = true
      if (mode) for (const zh of words) onRecord(zh, correct, helpedRef.current, mode)
      momentum.register(attemptKey, clean)
      setMixed(correct && !clean)
      if (correct) {
        playCorrect()
        haptic('good')
      } else {
        playWrong()
        haptic('miss')
      }
      setVerdict(correct)
    },
  }
}

/** The bottom bar lives in the overlay, where the usual footer would be. */
function Bar({ children, tone }: { children: ReactNode; tone?: 'right' | 'wrong' }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setHost((anchor.current?.closest('.overlay') as HTMLElement | null) ?? null)
  }, [])
  const bar = <div className="overlay-foot duo-bar" data-tone={tone}>{children}</div>
  return (
    <>
      <span ref={anchor} hidden />
      {host ? createPortal(bar, host) : bar}
    </>
  )
}

const KICKER: Record<Exercise['kind'], string> = {
  'meaning-pick': t('What does it mean?'),
  'hanzi-pick': t('Which word is it?'),
  'listen-pick': t('Listen, then choose'),
  match: t('Match the pairs'),
  cloze: t('Choose the word that fits'),
  continue: t('Finish the sentence'),
  arrange: t('Build the sentence'),
  'char-build': t('Build the word'),
}

function Kicker({ kind }: { kind: Exercise['kind'] }) {
  return <p className="duo-kicker"><span className="duo-kicker-dot" aria-hidden />{KICKER[kind]}</p>
}

/** The meaning as Richie wants it: the plain word first, the rest quietly below. */
function Meaning({ core, rest, big }: { core: string; rest?: string; big?: boolean }) {
  return (
    <span className={`duo-meaning${big ? ' duo-meaning-big' : ''}`}>
      <strong>{core}</strong>
      {rest && <small>{rest}</small>}
    </span>
  )
}

function PromptContext({ word, hiddenPeers = [], showSentence = true }: { word: ExWord; hiddenPeers?: readonly string[]; showSentence?: boolean }) {
  const enriched = enrichVocab({ zh: word.zh, pinyin: word.pinyin, pos: word.pos ?? '', en: word.en, note: '' })
  const peers = corpusPeers()
  const blanked = showSentence ? blankedExample(enriched.zh) : null
  const ctx = buildRecallPromptContext({ word: enriched, blanked, peers, hiddenPeers })
  return (
    <div className="duo-prompt duo-prompt-meaning">
      {(ctx.posLabel || ctx.charCountLabel) && (
        <div className="recall-meta-pills duo-meta-pills">
          {ctx.posLabel && <span className="recall-pos-pill">{ctx.posLabel}</span>}
          <span className="recall-slot-pill">
            {ctx.charCountLabel}
            <span className="recall-slots-preview zh" lang="zh-CN" aria-hidden="true">{ctx.slots}</span>
          </span>
        </div>
      )}
      <Meaning core={ctx.coreMeaning || word.en} rest={ctx.otherMeanings} big />
      {ctx.sentence && (
        <div className="recall-context duo-context-inline">
          <p className="zh" lang="zh-CN">{ctx.sentence.zh}</p>
          {ctx.sentence.en && <p className="recall-context-translation">{ctx.sentence.en}</p>}
        </div>
      )}
      {(ctx.whenCue || ctx.disambiguation) && (
        <div className="recall-cue-note duo-cue-inline">
          {ctx.whenCue && <p className="recall-when-cue"><span>{t('Usage cue')}</span> {ctx.whenCue}</p>}
          {ctx.disambiguation && <p className="recall-disambiguation">{ctx.disambiguation}</p>}
        </div>
      )}
    </div>
  )
}

type PickExercise = Extract<Exercise, { kind: 'meaning-pick' | 'hanzi-pick' | 'listen-pick' | 'cloze' }>

function Pick({ exercise, judge }: { exercise: PickExercise; judge: Judge }) {
  const { prefs } = useStore()
  const [picked, setPicked] = useState<string | null>(null)
  const [showMeaning, setShowMeaning] = useState(false)
  const [showPinyin, setShowPinyin] = useState(false)
  const { word, options } = exercise
  // Four options to listen against is recognition; real dictation stays in recall.
  const mode: EvidenceMode = 'recognition'
  const done = judge.verdict !== null
  const byMeaning = exercise.kind === 'meaning-pick'
  const clozeCtx =
    exercise.kind === 'cloze'
      ? buildRecallPromptContext({
          word: enrichVocab({ zh: word.zh, pinyin: word.pinyin, pos: word.pos ?? '', en: word.en, note: '' }),
          blanked: null,
          peers: corpusPeers(),
          hiddenPeers: options.map((o) => o.zh),
        })
      : null

  function choose(option: ExWord) {
    if (done) return
    setPicked(option.zh)
    judge.settle(option.zh === word.zh, [word.zh], mode)
  }

  return (
    <>
      <Kicker kind={exercise.kind} />
      {exercise.kind === 'meaning-pick' && <WordPrompt word={word} pinyin={prefs.showPinyin} />}
      {exercise.kind === 'hanzi-pick' && (
        <PromptContext word={word} hiddenPeers={options.map((o) => o.zh)} />
      )}
      {exercise.kind === 'listen-pick' && (
        <ListenPrompt word={word} showPinyin={showPinyin || done} onPinyin={() => { judge.help(); setShowPinyin(true) }} />
      )}
      {exercise.kind === 'cloze' && (
        <div className="duo-prompt duo-sentence">
          {clozeCtx && (clozeCtx.posLabel || clozeCtx.charCountLabel) && (
            <div className="recall-meta-pills duo-meta-pills">
              {clozeCtx.posLabel && <span className="recall-pos-pill">{clozeCtx.posLabel}</span>}
              <span className="recall-slot-pill">{clozeCtx.charCountLabel}</span>
            </div>
          )}
          <p className="zh" lang="zh-CN">
            {exercise.before}
            <span className="duo-blank" data-filled={!!picked || undefined} data-tone={done ? (judge.verdict ? 'right' : 'wrong') : undefined}>
              {picked ?? '　　'}
            </span>
            {exercise.after}
          </p>
          {(showMeaning || done) && exercise.sentence.en && <p className="duo-translation">{exercise.sentence.en}</p>}
          {!showMeaning && !done && exercise.sentence.en && (
            <button type="button" className="duo-link" onClick={() => { judge.help(); setShowMeaning(true) }}>{t('Show the meaning')}</button>
          )}
        </div>
      )}
      <div className={`duo-options${byMeaning ? ' duo-options-meaning' : ' duo-options-zh'}`} role="group" aria-label={KICKER[exercise.kind]}>
        {options.map((option, index) => {
          const state = !done ? (picked === option.zh ? 'picked' : undefined)
            : option.zh === word.zh ? 'right' : option.zh === picked ? 'wrong' : 'dim'
          return (
            <button
              key={option.zh}
              type="button"
              className="duo-option"
              data-state={state}
              style={{ ['--i' as string]: index }}
              disabled={done}
              onPointerDown={() => unlockSpeech()}
              onClick={() => choose(option)}
            >
              <span className="duo-option-key" aria-hidden>{index + 1}</span>
              {byMeaning ? (
                <span className="duo-option-text">{coreMeaning(option.en)}</span>
              ) : (
                <span className="duo-option-text zh" lang="zh-CN">{option.zh}</span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

function WordPrompt({ word, pinyin }: { word: ExWord; pinyin: boolean }) {
  useAutoSpeak(word.zh)
  return (
    <div className="duo-prompt duo-prompt-word">
      <p className="duo-hanzi zh" lang="zh-CN">{word.zh}</p>
      {pinyin && word.pinyin && <p className="duo-pinyin">{word.pinyin}</p>}
      <HearButton text={word.zh} label={t('Hear the word')} />
    </div>
  )
}

function ListenPrompt({ word, showPinyin, onPinyin }: { word: ExWord; showPinyin: boolean; onPinyin: () => void }) {
  const rate = rateForChinese(word.zh)
  useAutoSpeak(word.zh, undefined, rate)
  const [pulse, setPulse] = useState(0)
  return (
    <div className="duo-prompt duo-prompt-listen">
      <button
        type="button"
        key={pulse}
        className="duo-speaker"
        aria-label={t('Play the sound again')}
        onPointerDown={() => unlockSpeech()}
        onClick={() => {
          playListen()
          setPulse((n) => n + 1)
          void speak(word.zh, { rate, key: `duo-listen|${word.zh}|${pulse}` })
        }}
      >
        <SpeakerGlyph />
      </button>
      {showPinyin ? (
        <p className="duo-pinyin">{word.pinyin}</p>
      ) : (
        <button type="button" className="duo-link" onClick={onPinyin}>{t('Can’t listen now? Show pinyin')}</button>
      )}
    </div>
  )
}

function Continue({ exercise, judge }: { exercise: Extract<Exercise, { kind: 'continue' }>; judge: Judge }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [showMeaning, setShowMeaning] = useState(false)
  const done = judge.verdict !== null
  return (
    <>
      <Kicker kind="continue" />
      <div className="duo-prompt duo-sentence">
        <p className="zh" lang="zh-CN">
          {exercise.head}
          <span className="duo-blank duo-blank-wide" data-filled={!!picked || undefined} data-tone={done ? (judge.verdict ? 'right' : 'wrong') : undefined}>
            {picked ?? '……'}
          </span>
        </p>
        {(showMeaning || done) && <p className="duo-translation">{exercise.sentence.en}</p>}
        {!showMeaning && !done && (
          <button type="button" className="duo-link" onClick={() => { judge.help(); setShowMeaning(true) }}>{t('Show the meaning')}</button>
        )}
      </div>
      <div className="duo-options duo-options-lines" role="group" aria-label={KICKER.continue}>
        {exercise.options.map((option, index) => {
          const state = !done ? undefined : option === exercise.tail ? 'right' : option === picked ? 'wrong' : 'dim'
          return (
            <button key={option} type="button" className="duo-option" data-state={state} style={{ ['--i' as string]: index }} disabled={done}
              onClick={() => {
                if (done) return
                setPicked(option)
                judge.settle(option === exercise.tail, [], null)
              }}>
              <span className="duo-option-text zh" lang="zh-CN">{option}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

/** Tap tiles into a line; tap a placed tile to send it back. */
function useTiles(tiles: readonly string[]) {
  const [placed, setPlaced] = useState<number[]>([])
  return {
    placed,
    text: placed.map((index) => tiles[index]),
    add: (index: number) => setPlaced((list) => (list.includes(index) ? list : [...list, index])),
    remove: (index: number) => setPlaced((list) => list.filter((i) => i !== index)),
    reset: () => setPlaced([]),
  }
}

function Arrange({ exercise, judge }: { exercise: Extract<Exercise, { kind: 'arrange' }>; judge: Judge }) {
  const tiles = useTiles(exercise.tiles)
  const done = judge.verdict !== null
  return (
    <>
      <Kicker kind="arrange" />
      <div className="duo-prompt duo-prompt-cue">
        <p className="duo-cue">{exercise.sentence.en}</p>
      </div>
      <TileLine tiles={exercise.tiles} placed={tiles.placed} done={done} right={judge.verdict === true} onRemove={tiles.remove} lines />
      <TileBank tiles={exercise.tiles} placed={tiles.placed} done={done} onAdd={(index) => { playTick(); tiles.add(index) }} />
      {!done && (
        <Bar>
          <button type="button" className="btn" disabled={tiles.placed.length === 0}
            onClick={() => judge.settle(sameText(tiles.text, exercise.answer), [], null)}>
            {t('Check')}
          </button>
        </Bar>
      )}
    </>
  )
}

function CharBuild({ exercise, judge }: { exercise: Extract<Exercise, { kind: 'char-build' }>; judge: Judge }) {
  const tiles = useTiles(exercise.tiles)
  const done = judge.verdict !== null
  const full = tiles.placed.length === exercise.answer.length
  useEffect(() => {
    if (!full || done) return
    // A beat to see the last character land before the verdict.
    // Choosing offered characters is recognition; typing it from memory follows later in the round.
    const timer = window.setTimeout(() => judge.settle(sameText(tiles.text, exercise.answer), [exercise.word.zh], 'recognition'), 260)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, done])
  return (
    <>
      <Kicker kind="char-build" />
      <PromptContext word={exercise.word} />
      <div className="duo-slots" aria-live="polite">
        {exercise.answer.map((_, slot) => {
          const index = tiles.placed[slot]
          const filled = index !== undefined
          return (
            <button key={slot} type="button" className="duo-slot zh" lang="zh-CN" data-filled={filled || undefined}
              data-tone={done ? (judge.verdict ? 'right' : 'wrong') : undefined}
              disabled={!filled || done} onClick={() => filled && tiles.remove(index)}
              aria-label={filled ? exercise.tiles[index] : t('Empty slot')}>
              {filled ? exercise.tiles[index] : ''}
            </button>
          )
        })}
      </div>
      <TileBank tiles={exercise.tiles} placed={tiles.placed} done={done || full} zh onAdd={(index) => { playTick(); tiles.add(index) }} />
    </>
  )
}

function TileLine({ tiles, placed, done, right, onRemove, lines }: { tiles: readonly string[]; placed: number[]; done: boolean; right: boolean; onRemove: (index: number) => void; lines?: boolean }) {
  return (
    <div className={`duo-line${lines ? ' duo-line-ruled' : ''}`} data-tone={done ? (right ? 'right' : 'wrong') : undefined} aria-live="polite">
      {placed.map((index) => (
        <button key={index} type="button" className="duo-tile zh" lang="zh-CN" disabled={done} onClick={() => onRemove(index)}>{tiles[index]}</button>
      ))}
    </div>
  )
}

function TileBank({ tiles, placed, done, onAdd, zh }: { tiles: readonly string[]; placed: number[]; done: boolean; onAdd: (index: number) => void; zh?: boolean }) {
  return (
    <div className={`duo-bank${zh ? ' duo-bank-chars' : ''}`}>
      {tiles.map((tile, index) => {
        const used = placed.includes(index)
        return (
          <span key={index} className="duo-tile-socket" style={{ ['--i' as string]: index }}>
            <button type="button" className="duo-tile zh" lang="zh-CN" data-used={used || undefined} disabled={used || done}
              onPointerDown={() => unlockSpeech()} onClick={() => onAdd(index)}>{tile}</button>
          </span>
        )
      })}
    </div>
  )
}

function MatchBoard({ exercise, judge, onRecord }: { exercise: Extract<Exercise, { kind: 'match' }>; judge: Judge; onRecord: ExerciseProps['onRecord'] }) {
  const [left] = useState(() => shuffle(exercise.pairs.map((w) => w.zh), rng(seedOf(`left:${exercise.pairs.map((w) => w.zh).join('')}`))))
  const byZh = new Map(exercise.pairs.map((w) => [w.zh, w]))
  const [pickLeft, setPickLeft] = useState<string | null>(null)
  const [pickRight, setPickRight] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [shake, setShake] = useState<{ l: string; r: string; n: number } | null>(null)
  const first = useRef(new Map<string, boolean>())
  const missed = useRef(false)
  const calm = useRef<number>()

  function attempt(l: string, r: string) {
    setPickLeft(null)
    setPickRight(null)
    if (l === r) {
      if (!first.current.has(l)) first.current.set(l, true)
      const next = [...matched, l]
      setMatched(next)
      if (next.length === exercise.pairs.length) {
        for (const w of exercise.pairs) onRecord(w.zh, first.current.get(w.zh) ?? true, judge.helped, 'recognition')
        judge.settle(true, [], null, !missed.current)
      } else {
        playTick()
        haptic('good')
      }
      return
    }
    // The Hanzi tapped was given the wrong meaning; the other word was never tried.
    if (!first.current.has(l)) first.current.set(l, false)
    missed.current = true
    playWrong()
    haptic('miss')
    setShake((s) => ({ l, r, n: (s?.n ?? 0) + 1 }))
    window.clearTimeout(calm.current)
    calm.current = window.setTimeout(() => setShake(null), 650)
  }
  useEffect(() => () => window.clearTimeout(calm.current), [])

  const cell = (zh: string, side: 'l' | 'r') => {
    const done = matched.includes(zh)
    const picked = side === 'l' ? pickLeft === zh : pickRight === zh
    const shaking = shake && (side === 'l' ? shake.l === zh : shake.r === zh)
    const word = byZh.get(zh)!
    return (
      <button
        key={`${side}:${zh}:${shaking ? shake!.n : 0}`}
        type="button"
        className={`duo-match-cell${side === 'l' ? ' zh' : ''}`}
        lang={side === 'l' ? 'zh-CN' : undefined}
        data-state={done ? 'done' : picked ? 'picked' : shaking ? 'wrong' : undefined}
        disabled={done || judge.verdict !== null}
        onPointerDown={() => unlockSpeech()}
        onClick={() => {
          if (side === 'l') {
            void speak(zh, { rate: rateForChinese(zh), key: `duo-match|${zh}` })
            if (pickRight) attempt(zh, pickRight)
            else setPickLeft(zh === pickLeft ? null : zh)
          } else if (pickLeft) attempt(pickLeft, zh)
          else setPickRight(zh === pickRight ? null : zh)
        }}
      >
        {side === 'l' ? zh : coreMeaning(word.en)}
      </button>
    )
  }

  return (
    <>
      <Kicker kind="match" />
      <p className="duo-sub">{t('Tap a word, then its meaning.')}</p>
      <div className="duo-match">
        <div className="duo-match-col">{left.map((zh) => cell(zh, 'l'))}</div>
        <div className="duo-match-col">{exercise.meanings.map((zh) => cell(zh, 'r'))}</div>
      </div>
    </>
  )
}

const PRAISE = ['Nice!', 'Great!', 'Spot on!', 'That’s it!', 'Locked in!', 'Clean!'] as const
const PRAISE_T: Record<(typeof PRAISE)[number], string> = {
  'Nice!': t('Nice!'),
  'Great!': t('Great!'),
  'Spot on!': t('Spot on!'),
  'That’s it!': t('That’s it!'),
  'Locked in!': t('Locked in!'),
  'Clean!': t('Clean!'),
}

function Feedback({ exercise, right, mixed, attemptKey, onNext }: { exercise: Exercise; right: boolean; mixed: boolean; attemptKey: string; onNext: () => void }) {
  const { combo } = useMomentum()
  const { prefs } = useStore()
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // The bar moves into the overlay on its first layout pass; focus the moved button.
    const frame = requestAnimationFrame(() => next.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [])
  const praise = PRAISE_T[PRAISE[seedOf(attemptKey) % PRAISE.length]]
  const title = mixed
    ? t('All matched! The mixed-up ones come back later.')
    : right
      ? combo >= 3 ? t('{n} in a row!', { n: combo }) : praise
      : t('Not quite')
  const sentence: ExSentence | null = exercise.kind === 'cloze' || exercise.kind === 'continue' || exercise.kind === 'arrange' ? exercise.sentence : null
  const word: ExWord | null = 'word' in exercise ? exercise.word : null
  return (
    <Bar tone={right ? 'right' : 'wrong'}>
      <div className="duo-feedback" role="status">
        <p className="duo-feedback-title">
          <span className="duo-feedback-icon" aria-hidden>{right ? <CheckGlyph /> : <RetryGlyph />}</span>
          {title}
        </p>
        {!right && exercise.kind !== 'match' && <p className="duo-feedback-label">{t('Correct answer:')}</p>}
        {sentence ? (
          <div className="duo-feedback-answer">
            <p className="zh" lang="zh-CN">{sentence.zh}</p>
            {prefs.showPinyin && sentence.pinyin && <p className="duo-feedback-pinyin">{sentence.pinyin}</p>}
            {sentence.en && <p className="duo-feedback-meaning">{sentence.en}</p>}
            <HearButton text={sentence.zh} label={t('Hear the line')} />
          </div>
        ) : word ? (
          <div className="duo-feedback-answer duo-feedback-word">
            <p><span className="zh" lang="zh-CN">{word.zh}</span> <span className="duo-feedback-pinyin">{word.pinyin}</span></p>
            <Meaning core={coreMeaning(word.en)} rest={word.en.replace(coreMeaning(word.en), '').replace(/^[\s;,]+/, '')} />
            <HearButton text={word.zh} label={t('Hear the word')} />
          </div>
        ) : null}
      </div>
      <button ref={next} type="button" className="btn duo-next" onPointerDown={() => unlockSpeech()} onClick={onNext}>
        {t('Continue')}
      </button>
    </Bar>
  )
}

function SpeakerGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  )
}

function RetryGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5" />
    </svg>
  )
}
