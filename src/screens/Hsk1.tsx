import { useEffect, useMemo, useState } from 'react'
import {
  ALL_HSK1_WORDS,
  HSK1_PINYIN_DRILLS,
  HSK1_PINYIN_GROUPS,
  HSK1_TONE_DRILLS,
  HSK1_TONES,
  HSK1_UNITS,
  type Hsk1Unit,
  type Hsk1Word,
} from '../data/hsk1'
import {
  decomposeHsk1Word,
  HSK1_BASIC_STROKES,
  HSK1_STROKE_QUIZ,
} from '../data/hsk1Strokes'
import { evaluateBeastProgress, getTrainerAssetSrc } from '../lib/beastEngine'
import { getActiveCoupleId, getCoupleNames } from '../lib/coupleProfile'
import { postCoupleEvent } from '../lib/coupleSync'
import {
  nextPlayableHsk1Unit,
  readHsk1Progress,
  recordHsk1NodeDone,
  recordHsk1PinyinScore,
  recordHsk1SrsBatch,
  recordHsk1StrokeScore,
  recordHsk1ToneScore,
  recordHsk1UnitResult,
  subscribeHsk1Progress,
} from '../lib/hsk1'
import {
  buildSentenceTiles,
  buildVocabWaves,
  formatHsk1Interval,
  getHsk1MemorySummary,
  HSK1_NODE_META,
  HSK1_NODE_ORDER,
  reviewHsk1Card,
  selectHsk1RecallQueue,
  type Hsk1NodeId,
} from '../lib/hsk1Srs'
import { recordHistory } from '../lib/history'
import { readHsk1Progress as _readHsk1ForBeast } from '../lib/hsk1'
import { playAdvance, playCombo, playComplete, playCorrect, playHint, playListen, playStart, playWrong } from '../lib/sfx'
import { speak, stopSpeech } from '../lib/speech'
import type { Rating } from '../lib/srs'
import { dayKey, useStore } from '../store/store'
import { BasicStrokeSvg, HanziTracePad, ToneWaveSvg } from '../components/Hsk1Visuals'
import '../styles/duo.css'
import '../styles/hsk1.css'

const PHASES: Array<{ phase: 1 | 2 | 3 | 4 | 5; title: string }> = [
  { phase: 1, title: 'Fase 1 · Nada & Sapaan Dasar' },
  { phase: 2, title: 'Fase 2 · Keluarga, Angka & Kepemilikan' },
  { phase: 3, title: 'Fase 3 · Waktu, Lokasi & Belanja' },
  { phase: 4, title: 'Fase 4 · Belajar, Deskripsi & Cuaca' },
  { phase: 5, title: 'Fase 5 · Transportasi & Kalimat Utuh' },
]

const WIND_5 = [0, 32, 46, 26, 0]

function speakNormal(text: string) {
  playListen()
  void speak(text)
}

function speakSlow(text: string) {
  playListen()
  void speak(text, { rate: -32 })
}

function useRenitaChampionArt() {
  const s = useStore()
  const [hsk1, setHsk1] = useState(_readHsk1ForBeast)
  useEffect(() => subscribeHsk1Progress(setHsk1), [])
  return useMemo(() => {
    const evalRes = evaluateBeastProgress({
      track: 'hsk1',
      mastery: s.mastery,
      cards: s.cards,
      lessonsDone: s.lessonsDone,
      pathDone: s.pathDone,
      streak: s.streak,
      xp: s.xp,
      log: s.log,
      history: [],
      learnerGraph: s.learnerGraph,
      hsk1Progress: hsk1,
      todayKey: dayKey(),
      nowMs: Date.now(),
    })
    return {
      src: getTrainerAssetSrc(evalRes.beast, 'renita'),
      beastName: evalRes.beast.name,
      trainerTitle: evalRes.beast.trainerTitle,
    }
  }, [s.mastery, s.cards, s.lessonsDone, s.pathDone, s.streak, s.xp, s.log, s.learnerGraph, hsk1])
}

/* ============================================================================
 * 1. Hsk1HomePath — Clean Duolingo Winding Map (Zero Cramped Cards)
 * ============================================================================ */

export function Hsk1HomePath({
  onOpenUnit,
  onOpenToneLab,
  onOpenRecall,
}: {
  onOpenUnit: (unit: number, node?: Hsk1NodeId) => void
  onOpenToneLab: (track?: 'tones' | 'pinyin' | 'strokes') => void
  onOpenRecall?: () => void
}) {
  const [progress, setProgress] = useState(readHsk1Progress)
  useEffect(() => subscribeHsk1Progress(setProgress), [])

  const memory = useMemo(
    () => getHsk1MemorySummary(progress.srsCards, progress.provenWords),
    [progress.srsCards, progress.provenWords],
  )
  const nextActive = useMemo(() => nextPlayableHsk1Unit(progress), [progress])
  const activeUnit = useMemo(
    () => HSK1_UNITS.find((u) => u.unit === nextActive.unit) ?? HSK1_UNITS[0],
    [nextActive.unit],
  )
  const doneNodes = progress.nodeDone[String(activeUnit.unit)] ?? []

  const tonesOk = progress.tonesPassed >= 7
  const pinyinOk = progress.pinyinPassed >= 6
  const strokesOk = progress.strokesPassed >= 5
  const foundationDone = tonesOk && pinyinOk && strokesOk

  const foundationItems: Array<{
    key: 'tones' | 'pinyin' | 'strokes'
    emoji: string
    label: string
    scoreText: string
    done: boolean
  }> = [
    { key: 'tones', emoji: '🎵', label: '4 Nada', scoreText: `${progress.tonesPassed}/12`, done: tonesOk },
    { key: 'pinyin', emoji: '🗣️', label: 'Bunyi Pinyin', scoreText: `${progress.pinyinPassed}/10`, done: pinyinOk },
    { key: 'strokes', emoji: '✍️', label: '8 Goresan', scoreText: `${progress.strokesPassed}/8`, done: strokesOk },
  ]
  const currentFoundation = foundationItems.find((f) => !f.done)?.key

  return (
    <div className="hsk1-home-wrap">
      {memory.totalTracked > 0 && (
        <section className="hsk1-srs-banner" aria-label="Jadwal Ulasan Ingatan FSRS-6">
          <div className="hsk1-srs-copy">
            <div className="hsk1-kicker-pink">SPACED REPETITION · FSRS-6</div>
            <strong>
              {memory.dueCount > 0
                ? `🎯 ${memory.dueCount} kata siap disegarkan hari ini`
                : '🧠 Semua ingatanmu masih hangat!'}
            </strong>
            <div className="hsk1-srs-stats">
              <span>{memory.totalTracked} kata dilacak</span>
              <span>·</span>
              <span>Retensi {memory.avgRetentionPct}%</span>
              <span>·</span>
              <span>{memory.strongCount} kata kuat</span>
            </div>
            <div className="hsk1-retention-bar" aria-hidden="true">
              <i style={{ width: `${memory.avgRetentionPct}%` }} />
            </div>
          </div>
          <button
            type="button"
            className="hsk1-btn-3d-jade"
            onClick={() => {
              playStart()
              onOpenRecall?.()
            }}
          >
            🔁 Recall
          </button>
        </section>
      )}

      {!foundationDone ? (
        <section className="hsk1-foundation-card" aria-label="Pondasi Dari Nol">
          <div className="hsk1-foundation-head">
            <div>
              <div className="hsk1-kicker-pink">LANGKAH 0 · PONDASI BAYI DARI NOL</div>
              <strong>Nada, Bunyi Mulut & Arti Goresan</strong>
            </div>
            <span className="hsk1-pill-count">
              {[tonesOk, pinyinOk, strokesOk].filter(Boolean).length}/3 siap
            </span>
          </div>
          <ol className="duo-path hsk1-foundation-path">
            {foundationItems.map((item, idx) => {
              const isCurrent = item.key === currentFoundation
              const state = item.done ? 'done' : isCurrent ? 'current' : 'available'
              return (
                <li
                  key={item.key}
                  className="duo-path-stop"
                  data-state={state}
                  style={{ '--x': `${[-26, 26, -18][idx]}px`, '--i': idx } as React.CSSProperties}
                >
                  {isCurrent && <span className="duo-path-tip">Mulai</span>}
                  <button
                    type="button"
                    className="duo-node"
                    data-state={state}
                    onClick={() => {
                      playStart()
                      onOpenToneLab(item.key)
                    }}
                  >
                    {item.done ? '✓' : item.emoji}
                  </button>
                  <span className="duo-node-label">
                    {item.label} · {item.scoreText}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      ) : (
        <div className="hsk1-foundation-compact" aria-label="Pondasi Tuntas">
          <span className="hsk1-foundation-badge">✓ Pondasi Lulus</span>
          <div className="hsk1-foundation-pills">
            {foundationItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="hsk1-mini-pill"
                onClick={() => {
                  playStart()
                  onOpenToneLab(item.key)
                }}
              >
                {item.emoji} {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="hsk1-active-unit-card" aria-label={`Unit Aktif ${activeUnit.unit}`}>
        <div className="hsk1-unit-map-top">
          <div>
            <div className="hsk1-kicker-jade">
              SESI AKTIF · UNIT {activeUnit.unit} DARI {HSK1_UNITS.length}
            </div>
            <h2>
              <span lang="zh-CN">{activeUnit.titleZh}</span> · {activeUnit.titleId}
            </h2>
          </div>
          <span className="hsk1-pill-count">
            {doneNodes.length}/{HSK1_NODE_ORDER.length} simpul
          </span>
        </div>

        <div className="hsk1-progress-line" aria-hidden="true">
          <i style={{ width: `${Math.round((doneNodes.length / HSK1_NODE_ORDER.length) * 100)}%` }} />
        </div>

        <ol className="duo-path hsk1-unit-path">
          {HSK1_NODE_ORDER.map((nodeId, idx) => {
            const meta = HSK1_NODE_META[nodeId]
            const isDone = doneNodes.includes(nodeId)
            const isCurrent = nodeId === nextActive.node
            const nodeState = isDone ? 'done' : isCurrent ? 'current' : 'available'
            return (
              <li
                key={nodeId}
                className="duo-path-stop"
                data-state={nodeState}
                style={{ '--x': `${WIND_5[idx % WIND_5.length]}px`, '--i': idx } as React.CSSProperties}
              >
                {isCurrent && <span className="duo-path-tip">Mulai</span>}
                <button
                  type="button"
                  className="duo-node"
                  data-state={nodeState}
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => {
                    playStart()
                    onOpenUnit(activeUnit.unit, nodeId)
                  }}
                >
                  {isDone ? '✓' : meta.emoji}
                </button>
                <span className="duo-node-label">
                  {meta.label} · <span lang="zh-CN">{meta.shortZh}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <button
          type="button"
          className="hsk1-btn-3d-jade hsk1-start-cta"
          onClick={() => {
            playStart()
            onOpenUnit(activeUnit.unit, nextActive.node)
          }}
        >
          {HSK1_NODE_META[nextActive.node].emoji} Lanjut: {HSK1_NODE_META[nextActive.node].label} ›
        </button>
      </section>

      <details className="hsk1-all-units">
        <summary>
          <span>🗺️ Lihat Semua 15 Unit HSK 1</span>
          <span className="hsk1-pill-count">{progress.unitsDone.length}/15 tuntas</span>
        </summary>
        <div className="hsk1-phases">
          {PHASES.map(({ phase, title }) => {
            const units = HSK1_UNITS.filter((u) => u.phase === phase)
            return (
              <section key={phase} className="hsk1-phase-card">
                <div className="hsk1-phase-head">
                  <span>{title}</span>
                  <span>
                    {units.filter((u) => progress.unitsDone.includes(u.unit)).length}/{units.length}
                  </span>
                </div>
                <div className="hsk1-unit-grid">
                  {units.map((u) => {
                    const done = progress.unitsDone.includes(u.unit)
                    const best = progress.bestUnitScores[String(u.unit)]
                    const ndCount = (progress.nodeDone[String(u.unit)] ?? []).length
                    return (
                      <button
                        key={u.unit}
                        type="button"
                        className={`hsk1-unit-btn${done ? ' is-done' : ''}`}
                        onClick={() => {
                          playStart()
                          const dList = progress.nodeDone[String(u.unit)] ?? []
                          const firstTodo = HSK1_NODE_ORDER.find((n) => !dList.includes(n)) ?? 'kenali'
                          onOpenUnit(u.unit, firstTodo)
                        }}
                      >
                        <span className="hsk1-unit-num">{done ? '✓' : u.unit}</span>
                        <div className="hsk1-unit-body">
                          <div className="hsk1-unit-zh" lang="zh-CN">
                            {u.titleZh}
                          </div>
                          <div className="hsk1-unit-title">
                            {u.titleId} · {ndCount}/5 simpul
                          </div>
                        </div>
                        <span className="hsk1-unit-score">{best !== undefined ? `${best}%` : 'Buka ›'}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </details>
    </div>
  )
}

/* ============================================================================
 * 2. Hsk1ToneLabOverlay — One-Card-At-A-Time Animated Foundation Quests
 * ============================================================================ */

type ToneLabCard =
  | { kind: 'tone-teach'; id: string; toneIdx: number }
  | { kind: 'tone-quiz'; id: string; drillIdx: number; retry?: boolean }
  | { kind: 'pinyin-teach'; id: string; grpIdx: number }
  | { kind: 'pinyin-quiz'; id: string; drillIdx: number; retry?: boolean }
  | { kind: 'stroke-teach'; id: string; strokeIdx: number }
  | { kind: 'stroke-quiz'; id: string; quizIdx: number; retry?: boolean }

function buildFoundationDeck(track: 'tones' | 'pinyin' | 'strokes'): ToneLabCard[] {
  if (track === 'tones') {
    const usedDrills = new Set<number>()
    const cards: ToneLabCard[] = []
    HSK1_TONES.forEach((tGuide, tIdx) => {
      cards.push({ kind: 'tone-teach', id: `tt-${tGuide.tone}`, toneIdx: tIdx })
      const dIdx = HSK1_TONE_DRILLS.findIndex((d, i) => !usedDrills.has(i) && d.targetTone === tGuide.tone)
      if (dIdx >= 0) {
        usedDrills.add(dIdx)
        cards.push({ kind: 'tone-quiz', id: `tq-${HSK1_TONE_DRILLS[dIdx].id}`, drillIdx: dIdx })
      }
    })
    HSK1_TONE_DRILLS.forEach((d, i) => {
      if (!usedDrills.has(i)) {
        cards.push({ kind: 'tone-quiz', id: `tq-${d.id}`, drillIdx: i })
      }
    })
    return cards
  }

  if (track === 'pinyin') {
    const cards: ToneLabCard[] = []
    HSK1_PINYIN_GROUPS.forEach((grp, gIdx) => {
      cards.push({ kind: 'pinyin-teach', id: `pt-${grp.id}`, grpIdx: gIdx })
      const startDrill = gIdx * 2
      if (HSK1_PINYIN_DRILLS[startDrill]) {
        cards.push({ kind: 'pinyin-quiz', id: `pq-${HSK1_PINYIN_DRILLS[startDrill].id}`, drillIdx: startDrill })
      }
      if (HSK1_PINYIN_DRILLS[startDrill + 1]) {
        cards.push({
          kind: 'pinyin-quiz',
          id: `pq-${HSK1_PINYIN_DRILLS[startDrill + 1].id}`,
          drillIdx: startDrill + 1,
        })
      }
    })
    return cards
  }

  // Strokes: interleave 2 stroke guides + 2 stroke quizzes so learning never feels like a textbook
  const cards: ToneLabCard[] = []
  for (let i = 0; i < HSK1_BASIC_STROKES.length; i += 2) {
    cards.push({ kind: 'stroke-teach', id: `st-${HSK1_BASIC_STROKES[i].id}`, strokeIdx: i })
    if (HSK1_BASIC_STROKES[i + 1]) {
      cards.push({ kind: 'stroke-teach', id: `st-${HSK1_BASIC_STROKES[i + 1].id}`, strokeIdx: i + 1 })
    }
    if (HSK1_STROKE_QUIZ[i]) {
      cards.push({ kind: 'stroke-quiz', id: `sq-${HSK1_STROKE_QUIZ[i].id}`, quizIdx: i })
    }
    if (HSK1_STROKE_QUIZ[i + 1]) {
      cards.push({ kind: 'stroke-quiz', id: `sq-${HSK1_STROKE_QUIZ[i + 1].id}`, quizIdx: i + 1 })
    }
  }
  return cards
}

export function Hsk1ToneLabOverlay({
  initialTrack = 'tones',
  onClose,
}: {
  initialTrack?: 'tones' | 'pinyin' | 'strokes'
  onClose: () => void
}) {
  const s = useStore()
  const champion = useRenitaChampionArt()
  const [track, setTrack] = useState<'tones' | 'pinyin' | 'strokes'>(initialTrack)
  const [deck, setDeck] = useState<ToneLabCard[]>(() => buildFoundationDeck(initialTrack))
  const [stepIdx, setStepIdx] = useState(0)
  const [pickedOpt, setPickedOpt] = useState<number | null>(null)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [xpGain, setXpGain] = useState(0)
  const [firstPassCorrect, setFirstPassCorrect] = useState<Record<string, boolean>>({})
  const [playingWave, setPlayingWave] = useState(false)
  const [strokePlayKey, setStrokePlayKey] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => () => stopSpeech(), [])

  function switchTrack(nextTrack: 'tones' | 'pinyin' | 'strokes') {
    stopSpeech()
    setTrack(nextTrack)
    setDeck(buildFoundationDeck(nextTrack))
    setStepIdx(0)
    setPickedOpt(null)
    setCombo(0)
    setBestCombo(0)
    setXpGain(0)
    setFirstPassCorrect({})
    setFinished(false)
  }

  const card = deck[stepIdx]
  const progressPct = finished ? 100 : Math.round(((stepIdx + 1) / Math.max(1, deck.length)) * 100)

  function handleQuizPick(optIdx: number, answerIdx: number, cardId: string, retryCard: ToneLabCard) {
    if (pickedOpt !== null) return
    setPickedOpt(optIdx)
    const right = optIdx === answerIdx

    if (!card.kind.endsWith('teach') && !(card as { retry?: boolean }).retry) {
      setFirstPassCorrect((prev) => ({ ...prev, [cardId]: right }))
    }

    if (right) {
      const nextCombo = combo + 1
      setCombo(nextCombo)
      setBestCombo((b) => Math.max(b, nextCombo))
      setXpGain((x) => x + (nextCombo >= 3 ? 12 : 8))
      if (nextCombo >= 2) playCombo(nextCombo)
      else playCorrect()
    } else {
      setCombo(0)
      playWrong()
      setDeck((prev) => [...prev, { ...retryCard, id: `${retryCard.id}-retry-${prev.length}`, retry: true }])
    }
  }

  function advanceDeck() {
    stopSpeech()
    setPickedOpt(null)
    setPlayingWave(false)
    if (stepIdx + 1 < deck.length) {
      playAdvance()
      setStepIdx((i) => i + 1)
      return
    }

    // Complete track!
    const passedTotal = Object.values(firstPassCorrect).filter(Boolean).length
    if (track === 'tones') {
      recordHsk1ToneScore(passedTotal)
      s.logDrill(HSK1_TONE_DRILLS.length, 25)
      s.awardXp(Math.max(20, xpGain))
      recordHistory({
        course: 'hsk1',
        kind: 'quiz',
        lesson: 0,
        title: 'HSK 1 Lab 4 Nada',
        correct: passedTotal >= 7,
        xp: Math.round((passedTotal / HSK1_TONE_DRILLS.length) * 100),
      })
    } else if (track === 'pinyin') {
      recordHsk1PinyinScore(passedTotal)
      s.logDrill(HSK1_PINYIN_DRILLS.length, 25)
      s.awardXp(Math.max(20, xpGain))
      recordHistory({
        course: 'hsk1',
        kind: 'quiz',
        lesson: 0,
        title: 'HSK 1 Lab Pinyin',
        correct: passedTotal >= 6,
        xp: Math.round((passedTotal / HSK1_PINYIN_DRILLS.length) * 100),
      })
    } else {
      recordHsk1StrokeScore(passedTotal)
      s.logDrill(HSK1_STROKE_QUIZ.length, 25)
      s.awardXp(Math.max(20, xpGain))
      recordHistory({
        course: 'hsk1',
        kind: 'quiz',
        lesson: 0,
        title: 'HSK 1 Lab 8 Goresan Dasar',
        correct: passedTotal >= 5,
        xp: Math.round((passedTotal / HSK1_STROKE_QUIZ.length) * 100),
      })
    }

    const me = getActiveCoupleId()
    const names = getCoupleNames()
    void postCoupleEvent({
      from: me,
      kind: 'milestone',
      text: `Menuntaskan Pondasi ${track === 'tones' ? '4 Nada' : track === 'pinyin' ? 'Bunyi Pinyin' : '8 Goresan'} (${passedTotal} benar)!`,
      names,
    })

    playComplete()
    setFinished(true)
  }

  const isQuizCard = card && (card.kind === 'tone-quiz' || card.kind === 'pinyin-quiz' || card.kind === 'stroke-quiz')
  const canContinue = finished || !isQuizCard || pickedOpt !== null

  return (
    <div className="hsk1-overlay" role="dialog" aria-modal="true" aria-label="Pondasi Dari Nol">
      <header className="hsk1-session-topbar">
        <button type="button" className="hsk1-icon-close" onClick={onClose} aria-label="Tutup">
          ✕
        </button>
        <div className="hsk1-top-progress" aria-label={`Progres ${progressPct}%`}>
          <i style={{ width: `${progressPct}%` }} />
        </div>
        <div className="hsk1-hud-badges">
          {combo >= 2 && <span className="hsk1-combo-pill">🔥 {combo}×</span>}
          <span className="hsk1-xp-pill">+{xpGain} XP</span>
        </div>
      </header>

      <div className="hsk1-track-switcher" role="tablist">
        <button
          type="button"
          className={`hsk1-track-pill${track === 'tones' ? ' is-active' : ''}`}
          onClick={() => switchTrack('tones')}
        >
          🎵 4 Nada
        </button>
        <button
          type="button"
          className={`hsk1-track-pill${track === 'pinyin' ? ' is-active' : ''}`}
          onClick={() => switchTrack('pinyin')}
        >
          🗣️ Pinyin
        </button>
        <button
          type="button"
          className={`hsk1-track-pill${track === 'strokes' ? ' is-active' : ''}`}
          onClick={() => switchTrack('strokes')}
        >
          ✍️ 8 Goresan
        </button>
      </div>

      <main className="hsk1-stage-body">
        {finished ? (
          <div className="hsk1-stage-card hsk1-victory-card">
            <img className="hsk1-victory-art" src={champion.src} alt={champion.trainerTitle} />
            <div className="hsk1-kicker-jade">PONDASI SELESAI!</div>
            <h2>Luar Biasa, Renita! 🎉</h2>
            <p className="hsk1-victory-sub">
              Skor bersih: <strong>{Object.values(firstPassCorrect).filter(Boolean).length}</strong> · Kombo
              tertinggi: <strong>{bestCombo}×</strong> · Tambahan <strong>+{Math.max(20, xpGain)} XP</strong>
            </p>
            <div className="hsk1-victory-actions">
              {track !== 'strokes' && (
                <button
                  type="button"
                  className="hsk1-btn-3d-jade"
                  onClick={() => switchTrack(track === 'tones' ? 'pinyin' : 'strokes')}
                >
                  Lanjut Quest Berikutnya ›
                </button>
              )}
              <button type="button" className="hsk1-btn-soft" onClick={onClose}>
                Kembali ke Peta Belajar
              </button>
            </div>
          </div>
        ) : card?.kind === 'tone-teach' ? (
          (() => {
            const tone = HSK1_TONES[card.toneIdx]
            return (
              <div key={card.id} className="hsk1-stage-card hsk1-focus-center">
                <span className="hsk1-step-tag" style={{ color: tone.colorHex }}>
                  PANDUAN NADA · {card.toneIdx + 1}/{HSK1_TONES.length}
                </span>
                <ToneWaveSvg tone={tone.tone} colorHex={tone.colorHex} playing={playingWave} size={184} />
                <div className="hsk1-hero-hanzi" lang="zh-CN">
                  {tone.sampleZh}
                </div>
                <div className="hsk1-hero-pinyin" style={{ color: tone.colorHex }}>
                  {tone.sampleSyllable} · {tone.sampleMeaning}
                </div>
                <div className="hsk1-analogy-box">
                  <strong>{tone.label}:</strong> {tone.howTo}
                </div>
                <div className="hsk1-audio-pair">
                  <button
                    type="button"
                    className="hsk1-audio-btn"
                    style={{ background: tone.colorHex }}
                    onClick={() => {
                      setPlayingWave(true)
                      speakNormal(tone.sampleZh)
                    }}
                  >
                    🔊 Dengar Normal
                  </button>
                  <button
                    type="button"
                    className="hsk1-btn-soft"
                    onClick={() => {
                      setPlayingWave(true)
                      speakSlow(tone.sampleZh)
                    }}
                  >
                    🐢 Pelan
                  </button>
                </div>
              </div>
            )
          })()
        ) : card?.kind === 'tone-quiz' ? (
          (() => {
            const drill = HSK1_TONE_DRILLS[card.drillIdx]
            return (
              <div key={card.id} className="hsk1-stage-card">
                <span className="hsk1-step-tag">
                  {card.retry ? '🔁 PERBAIKI NADA INI' : '🎧 TEBAK NADA YANG DIDENGAR'}
                </span>
                <h3 className="hsk1-quiz-prompt">{drill.promptHint}</h3>
                <div className="hsk1-audio-pair">
                  <button type="button" className="hsk1-audio-btn" onClick={() => speakNormal(drill.promptAudio)}>
                    🔊 Putar Audio
                  </button>
                  <button type="button" className="hsk1-btn-soft" onClick={() => speakSlow(drill.promptAudio)}>
                    🐢 Pelan
                  </button>
                </div>
                <div className="hsk1-option-list">
                  {drill.options.map((opt, idx) => {
                    const answered = pickedOpt !== null
                    const right = answered && idx === drill.answerIndex
                    const wrong = answered && pickedOpt === idx && idx !== drill.answerIndex
                    return (
                      <button
                        key={opt.zh}
                        type="button"
                        disabled={answered}
                        className={`hsk1-option-btn${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                        onClick={() => handleQuizPick(idx, drill.answerIndex, card.id, card)}
                      >
                        <span className="hsk1-opt-zh" lang="zh-CN">
                          {opt.zh}
                        </span>
                        <span className="hsk1-opt-meta">
                          {opt.pinyin} — {opt.meaning}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {pickedOpt !== null && <div className="hsk1-tip-box">{drill.explainId}</div>}
              </div>
            )
          })()
        ) : card?.kind === 'pinyin-teach' ? (
          (() => {
            const grp = HSK1_PINYIN_GROUPS[card.grpIdx]
            return (
              <div key={card.id} className="hsk1-stage-card hsk1-focus-center">
                <span className="hsk1-step-tag">
                  BUNYI MULUT · {card.grpIdx + 1}/{HSK1_PINYIN_GROUPS.length}
                </span>
                <h2 className="hsk1-card-title">{grp.title}</h2>
                <div className="hsk1-symbol-hero">{grp.symbols}</div>
                <div className="hsk1-analogy-box">{grp.tipId}</div>
                <div className="hsk1-chip-row">
                  {grp.examples.map((ex) => (
                    <button
                      key={ex.pinyin}
                      type="button"
                      className="hsk1-sound-bubble"
                      onClick={() => speakNormal(ex.zh)}
                    >
                      <strong>🔊 {ex.pinyin}</strong>
                      <span>
                        {ex.zh} · {ex.meaning}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()
        ) : card?.kind === 'pinyin-quiz' ? (
          (() => {
            const drill = HSK1_PINYIN_DRILLS[card.drillIdx]
            return (
              <div key={card.id} className="hsk1-stage-card">
                <span className="hsk1-step-tag">
                  {card.retry ? '🔁 LATIH LAGI BUNYI INI' : '🗣️ BEDAKAN BUNYI PINYIN'}
                </span>
                <h3 className="hsk1-quiz-prompt">{drill.questionId}</h3>
                <div className="hsk1-audio-pair">
                  <button type="button" className="hsk1-audio-btn" onClick={() => speakNormal(drill.promptAudio)}>
                    🔊 Putar Audio
                  </button>
                  <button type="button" className="hsk1-btn-soft" onClick={() => speakSlow(drill.promptAudio)}>
                    🐢 Pelan
                  </button>
                </div>
                <div className="hsk1-option-list">
                  {drill.options.map((opt, idx) => {
                    const answered = pickedOpt !== null
                    const right = answered && idx === drill.answerIndex
                    const wrong = answered && pickedOpt === idx && idx !== drill.answerIndex
                    return (
                      <button
                        key={opt.pinyin}
                        type="button"
                        disabled={answered}
                        className={`hsk1-option-btn${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                        onClick={() => handleQuizPick(idx, drill.answerIndex, card.id, card)}
                      >
                        <span className="hsk1-opt-zh">{opt.pinyin}</span>
                        <span className="hsk1-opt-meta">
                          {opt.zh} · {opt.meaning}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {pickedOpt !== null && <div className="hsk1-tip-box">{drill.explainId}</div>}
              </div>
            )
          })()
        ) : card?.kind === 'stroke-teach' ? (
          (() => {
            const stroke = HSK1_BASIC_STROKES[card.strokeIdx]
            return (
              <div key={card.id} className="hsk1-stage-card hsk1-focus-center">
                <span className="hsk1-step-tag" style={{ color: stroke.colorHex }}>
                  GORESAN DASAR · {card.strokeIdx + 1}/{HSK1_BASIC_STROKES.length}
                </span>
                <BasicStrokeSvg stroke={stroke} playKey={strokePlayKey} size={146} />
                <div className="hsk1-stroke-title-row">
                  <span lang="zh-CN">{stroke.zh}</span>
                  <strong>({stroke.pinyin})</strong>
                </div>
                <div className="hsk1-hero-pinyin" style={{ color: stroke.colorHex }}>
                  {stroke.nameId} — {stroke.metaphorId}
                </div>
                <div className="hsk1-analogy-box">
                  <strong>Makna & Arah:</strong> {stroke.meaningRoleId} {stroke.directionHint}
                </div>
                <div className="hsk1-chip-row">
                  <button
                    type="button"
                    className="hsk1-mini-pill"
                    onClick={() => setStrokePlayKey((n) => n + 1)}
                  >
                    ↻ Putar Goresan
                  </button>
                  {stroke.examples.map((ex) => (
                    <button
                      key={ex.zh}
                      type="button"
                      className="hsk1-sound-bubble"
                      onClick={() => speakNormal(ex.zh)}
                    >
                      <strong lang="zh-CN">🔊 {ex.zh}</strong>
                      <span>
                        {ex.pinyin} · {ex.meaningId}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()
        ) : card?.kind === 'stroke-quiz' ? (
          (() => {
            const sq = HSK1_STROKE_QUIZ[card.quizIdx]
            const targetGuide = HSK1_BASIC_STROKES.find((s) => s.id === sq.strokeId)
            return (
              <div key={card.id} className="hsk1-stage-card">
                <span className="hsk1-step-tag">
                  {card.retry ? '🔁 ULANG GORESAN' : '✍️ TEBAK ARTI & NAMA GORESAN'}
                </span>
                {targetGuide && (
                  <div className="hsk1-quiz-visual-row">
                    <BasicStrokeSvg stroke={targetGuide} size={96} />
                    <div className="hsk1-quiz-char-badge" lang="zh-CN">
                      {sq.targetZh}
                    </div>
                  </div>
                )}
                <h3 className="hsk1-quiz-prompt">{sq.promptId}</h3>
                <div className="hsk1-option-list">
                  {sq.options.map((opt, idx) => {
                    const answered = pickedOpt !== null
                    const right = answered && idx === sq.answerIndex
                    const wrong = answered && pickedOpt === idx && idx !== sq.answerIndex
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={answered}
                        className={`hsk1-option-btn${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                        onClick={() => handleQuizPick(idx, sq.answerIndex, card.id, card)}
                      >
                        <span className="hsk1-opt-zh" lang="zh-CN">
                          {opt.zh}
                        </span>
                        <span className="hsk1-opt-meta">
                          {opt.nameId} · {opt.hintId}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {pickedOpt !== null && <div className="hsk1-tip-box">{sq.explainId}</div>}
              </div>
            )
          })()
        ) : null}
      </main>

      {!finished && (
        <footer className="hsk1-stage-foot">
          <button
            type="button"
            className="hsk1-btn-3d-jade"
            disabled={!canContinue}
            onClick={advanceDeck}
          >
            {stepIdx + 1 < deck.length ? 'Lanjut ›' : 'Selesaikan Quest ✓'}
          </button>
        </footer>
      )}
    </div>
  )
}

/* ============================================================================
 * 3. Hsk1SessionOverlay — 5 Bite-Sized Duolingo Quests Inside Every Unit
 * ============================================================================ */

function buildDistractorOptions(unit: Hsk1Unit, target: Hsk1Word, count = 4): Hsk1Word[] {
  const pool = unit.words.filter((w) => w.zh !== target.zh)
  const step = Math.max(1, Math.floor(pool.length / 3))
  const chosen: Hsk1Word[] = [target]
  for (let i = 0; i < pool.length && chosen.length < count; i++) {
    const candidate = pool[(i * step) % pool.length]
    if (candidate && !chosen.some((w) => w.zh === candidate.zh)) chosen.push(candidate)
  }
  return chosen.sort((a, b) => a.zh.localeCompare(b.zh))
}

function pickTraceTargets(words: readonly Hsk1Word[], limit = 4): Array<{ char: string; sourceWord: Hsk1Word }> {
  const result: Array<{ char: string; sourceWord: Hsk1Word }> = []
  const seen = new Set<string>()
  const pushChar = (ch: string, w: Hsk1Word) => {
    if (seen.has(ch) || !/\p{Script=Han}/u.test(ch)) return
    seen.add(ch)
    result.push({ char: ch, sourceWord: w })
  }
  for (const w of words) {
    if (result.length >= limit) break
    if (Array.from(w.zh).length === 1) pushChar(w.zh, w)
  }
  for (const w of words) {
    if (result.length >= limit) break
    for (const ch of Array.from(w.zh)) {
      if (result.length >= limit) break
      pushChar(ch, w)
    }
  }
  return result
}

type KenaliStep =
  | { kind: 'intro'; id: string; waveIdx: number; totalWaves: number; word: Hsk1Word }
  | { kind: 'check'; id: string; waveIdx: number; checkKind: 'meaning' | 'audio' | 'radical'; promptId: string; target: Hsk1Word; options: Hsk1Word[] }

type KalimatStep =
  | { kind: 'formula'; id: string }
  | { kind: 'tiles'; id: string; sentenceZh: string; sentencePinyin: string; sentenceId: string }
  | { kind: 'quiz'; id: string; qIdx: number }
  | { kind: 'dialogue'; id: string }

interface BossItem {
  id: string
  word: Hsk1Word
  mode: 'meaning' | 'audio'
  retry?: boolean
}

export function Hsk1SessionOverlay({
  unitNumber,
  initialNode = 'kenali',
  onClose,
}: {
  unitNumber: number
  initialNode?: Hsk1NodeId
  onClose: () => void
}) {
  const s = useStore()
  const champion = useRenitaChampionArt()
  const unit = useMemo(
    () => HSK1_UNITS.find((u) => u.unit === unitNumber) ?? HSK1_UNITS[0],
    [unitNumber],
  )
  const [progressState, setProgressState] = useState(readHsk1Progress)
  useEffect(() => subscribeHsk1Progress(setProgressState), [])

  const [node, setNode] = useState<Hsk1NodeId>(initialNode)
  const [stepIdx, setStepIdx] = useState(0)
  const [nodeDoneView, setNodeDoneView] = useState(false)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [xpGain, setXpGain] = useState(0)
  const [pickedZh, setPickedZh] = useState<string | null>(null)
  const [selectedRadicalStory, setSelectedRadicalStory] = useState<string | null>(null)

  // Node 2 (goresan) tracing state
  const traceTargets = useMemo(() => pickTraceTargets(unit.words, 4), [unit.words])
  const [traceDoneMap, setTraceDoneMap] = useState<Record<string, boolean>>({})

  // Node 3 (dengar + pair match) state
  const [matchLeftSel, setMatchLeftSel] = useState<string | null>(null)
  const [matchRightSel, setMatchRightSel] = useState<string | null>(null)
  const [matchedZh, setMatchedZh] = useState<string[]>([])
  const [mismatchPair, setMismatchPair] = useState(false)

  // Node 4 (kalimat) state
  const [tilePlaced, setTilePlaced] = useState<number[]>([])
  const [tileChecked, setTileChecked] = useState<'idle' | 'right' | 'wrong'>('idle')
  const [grammarPick, setGrammarPick] = useState<string | null>(null)

  // Node 5 (bos recall + FSRS-6 + recovery) state
  const [bossDeck, setBossDeck] = useState<BossItem[]>(() =>
    unit.words.map((w, idx) => ({ id: `boss-${w.zh}`, word: w, mode: idx % 2 === 0 ? 'meaning' : 'audio' })),
  )
  const [hintTier, setHintTier] = useState<0 | 1 | 2>(0)
  const [bossRatings, setBossRatings] = useState<Record<string, Rating>>({})
  const [bossForecast, setBossForecast] = useState<Array<{ zh: string; nextLabel: string }>>([])
  const [bossScorePct, setBossScorePct] = useState(0)

  useEffect(() => () => stopSpeech(), [])

  const kenaliDeck = useMemo<KenaliStep[]>(() => {
    const waves = buildVocabWaves(unit.words, 3)
    const out: KenaliStep[] = []
    for (const wv of waves) {
      for (const word of wv.introWords) {
        out.push({ kind: 'intro', id: `in-${wv.waveIndex}-${word.zh}`, waveIdx: wv.waveIndex, totalWaves: wv.totalWaves, word })
      }
      for (const chk of wv.microChecks) {
        out.push({
          kind: 'check',
          id: chk.id,
          waveIdx: wv.waveIndex,
          checkKind: chk.kind,
          promptId: chk.promptId,
          target: chk.target,
          options: chk.options,
        })
      }
    }
    return out
  }, [unit.words])

  const dengarSteps = useMemo(() => {
    const first4 = unit.words.slice(0, 4)
    const next4 = unit.words.slice(4, 8)
    const audioTargets = [unit.words[0], unit.words[2], unit.words[4], unit.words[6], unit.words[8] ?? unit.words[1], unit.words[9] ?? unit.words[3]].filter(Boolean)
    return [
      { kind: 'match' as const, id: 'm-1', words: first4, shuffledMeanings: [...first4].sort((a, b) => a.meaningId.localeCompare(b.meaningId)) },
      { kind: 'ear' as const, id: 'e-1', target: audioTargets[0], options: buildDistractorOptions(unit, audioTargets[0], 4) },
      { kind: 'ear' as const, id: 'e-2', target: audioTargets[1], options: buildDistractorOptions(unit, audioTargets[1], 4) },
      { kind: 'match' as const, id: 'm-2', words: next4, shuffledMeanings: [...next4].sort((a, b) => a.meaningId.localeCompare(b.meaningId)) },
      { kind: 'ear' as const, id: 'e-3', target: audioTargets[4], options: buildDistractorOptions(unit, audioTargets[4], 4) },
      { kind: 'ear' as const, id: 'e-4', target: audioTargets[5], options: buildDistractorOptions(unit, audioTargets[5], 4) },
    ]
  }, [unit])

  const kalimatDeck = useMemo<KalimatStep[]>(() => {
    const out: KalimatStep[] = [{ kind: 'formula', id: 'kf' }]
    unit.grammar.examples.slice(0, 2).forEach((ex, i) => {
      out.push({ kind: 'tiles', id: `kt-${i}`, sentenceZh: ex.zh, sentencePinyin: ex.pinyin, sentenceId: ex.id })
    })
    unit.grammarQuiz.forEach((_, qi) => {
      out.push({ kind: 'quiz', id: `kq-${qi}`, qIdx: qi })
    })
    out.push({ kind: 'dialogue', id: 'kd' })
    return out
  }, [unit])

  function enterNode(targetNode: Hsk1NodeId) {
    stopSpeech()
    setNode(targetNode)
    setStepIdx(0)
    setNodeDoneView(false)
    setPickedZh(null)
    setSelectedRadicalStory(null)
    setMatchLeftSel(null)
    setMatchRightSel(null)
    setMatchedZh([])
    setMismatchPair(false)
    setTilePlaced([])
    setTileChecked('idle')
    setGrammarPick(null)
    setHintTier(0)
    if (targetNode === 'bos') {
      setBossDeck(
        unit.words.map((w, idx) => ({ id: `boss-${w.zh}`, word: w, mode: idx % 2 === 0 ? 'meaning' : 'audio' })),
      )
      setBossRatings({})
    }
  }

  function rewardRight(baseXp = 8) {
    const nextCombo = combo + 1
    setCombo(nextCombo)
    setBestCombo((b) => Math.max(b, nextCombo))
    setXpGain((x) => x + baseXp + (nextCombo >= 3 ? 4 : 0))
    if (nextCombo >= 2) playCombo(nextCombo)
    else playCorrect()
  }

  function registerWrong() {
    setCombo(0)
    playWrong()
  }

  const totalStepsInNode =
    node === 'kenali'
      ? kenaliDeck.length
      : node === 'goresan'
        ? traceTargets.length
        : node === 'dengar'
          ? dengarSteps.length
          : node === 'kalimat'
            ? kalimatDeck.length
            : bossDeck.length

  const progressPct = nodeDoneView ? 100 : Math.round(((stepIdx + 1) / Math.max(1, totalStepsInNode)) * 100)

  function finishCurrentNode() {
    stopSpeech()
    if (node === 'kenali') {
      for (const w of unit.words) s.encounterWord(w.zh, 900 + unit.unit)
      recordHsk1NodeDone(unit.unit, 'kenali')
      s.awardXp(Math.max(15, xpGain))
      playComplete()
      setNodeDoneView(true)
      return
    }
    if (node === 'goresan') {
      recordHsk1NodeDone(unit.unit, 'goresan')
      s.awardXp(Math.max(15, xpGain))
      playComplete()
      setNodeDoneView(true)
      return
    }
    if (node === 'dengar') {
      recordHsk1NodeDone(unit.unit, 'dengar')
      s.logDrill(unit.words.length, 20)
      s.awardXp(Math.max(20, xpGain))
      playComplete()
      setNodeDoneView(true)
      return
    }
    if (node === 'kalimat') {
      recordHsk1NodeDone(unit.unit, 'kalimat')
      s.awardXp(Math.max(20, xpGain))
      playComplete()
      setNodeDoneView(true)
      return
    }

    // Node 5 ('bos') -> finalize FSRS-6 + Unit Result + Couple feed!
    const now = Date.now()
    const reviews = unit.words.map((w) => ({
      zh: w.zh,
      unit: unit.unit,
      rating: bossRatings[w.zh] ?? 'good',
    }))
    const proven = reviews
      .filter((r) => r.rating === 'good' || r.rating === 'easy')
      .map((r) => r.zh)
    const scorePct = Math.round((proven.length / Math.max(1, unit.words.length)) * 100)

    const updated = recordHsk1SrsBatch(reviews, now)
    recordHsk1UnitResult({
      unit: unit.unit,
      provenWords: proven,
      grammarCorrectCount: unit.grammarQuiz.length,
      scorePct,
    })

    s.addCards(
      900 + unit.unit,
      unit.words.map((w) => ({ zh: w.zh })),
    )
    for (const r of reviews) {
      s.recordRecall(r.zh, {
        correct: r.rating !== 'again',
        mode: 'recall',
        assisted: r.rating === 'hard',
      })
    }
    s.logDrill(unit.words.length, 30)
    s.awardXp(Math.max(30, xpGain))
    recordHistory({
      course: 'hsk1',
      kind: 'node',
      lesson: unit.unit,
      title: `HSK 1 Unit ${unit.unit}: ${unit.titleId}`,
      correct: scorePct >= 60,
      xp: scorePct,
    })

    const me = getActiveCoupleId()
    const names = getCoupleNames()
    void postCoupleEvent({
      from: me,
      kind: 'milestone',
      text: `Menuntaskan Unit ${unit.unit} (${unit.titleId}) · ${proven.length}/${unit.words.length} kata diingat murni (${scorePct}%)!`,
      names,
    })

    setBossForecast(
      unit.words.slice(0, 4).map((w) => ({
        zh: w.zh,
        nextLabel: updated.srsCards[w.zh]
          ? formatHsk1Interval(updated.srsCards[w.zh].due, now)
          : 'Besok',
      })),
    )
    setBossScorePct(scorePct)
    playComplete()
    setNodeDoneView(true)
  }

  function advanceStep() {
    stopSpeech()
    setPickedZh(null)
    setSelectedRadicalStory(null)
    setMatchLeftSel(null)
    setMatchRightSel(null)
    setMatchedZh([])
    setMismatchPair(false)
    setTilePlaced([])
    setTileChecked('idle')
    setGrammarPick(null)
    setHintTier(0)
    if (stepIdx + 1 < totalStepsInNode) {
      playAdvance()
      setStepIdx((i) => i + 1)
    } else {
      finishCurrentNode()
    }
  }

  // Pair-match click handler
  function handlePairPick(side: 'left' | 'right', zh: string) {
    if (matchedZh.includes(zh) || mismatchPair) return
    if (side === 'left') {
      speakNormal(zh)
      if (matchRightSel) {
        if (matchRightSel === zh) {
          setMatchedZh((prev) => [...prev, zh])
          setMatchLeftSel(null)
          setMatchRightSel(null)
          rewardRight(6)
        } else {
          setMatchLeftSel(zh)
          setMismatchPair(true)
          registerWrong()
          window.setTimeout(() => {
            setMatchLeftSel(null)
            setMatchRightSel(null)
            setMismatchPair(false)
          }, 420)
        }
      } else {
        setMatchLeftSel(zh)
      }
    } else {
      if (matchLeftSel) {
        if (matchLeftSel === zh) {
          setMatchedZh((prev) => [...prev, zh])
          setMatchLeftSel(null)
          setMatchRightSel(null)
          rewardRight(6)
        } else {
          setMatchRightSel(zh)
          setMismatchPair(true)
          registerWrong()
          window.setTimeout(() => {
            setMatchLeftSel(null)
            setMatchRightSel(null)
            setMismatchPair(false)
          }, 420)
        }
      } else {
        setMatchRightSel(zh)
      }
    }
  }

  const nextNodeIdx = HSK1_NODE_ORDER.indexOf(node) + 1
  const nextNodeId = HSK1_NODE_ORDER[nextNodeIdx]

  // Determine whether current card allows advancing
  let canAdvance = true
  if (nodeDoneView) canAdvance = true
  else if (node === 'kenali') {
    const cur = kenaliDeck[stepIdx]
    if (cur?.kind === 'check') canAdvance = pickedZh !== null
  } else if (node === 'goresan') {
    const tTarget = traceTargets[stepIdx]
    if (tTarget) canAdvance = Boolean(traceDoneMap[tTarget.char])
  } else if (node === 'dengar') {
    const dStep = dengarSteps[stepIdx]
    if (dStep?.kind === 'match') canAdvance = matchedZh.length >= dStep.words.length
    else if (dStep?.kind === 'ear') canAdvance = pickedZh !== null
  } else if (node === 'kalimat') {
    const kStep = kalimatDeck[stepIdx]
    if (kStep?.kind === 'tiles') canAdvance = tileChecked === 'right'
    else if (kStep?.kind === 'quiz') canAdvance = grammarPick !== null
  } else if (node === 'bos') {
    canAdvance = pickedZh !== null
  }

  return (
    <div className="hsk1-overlay" role="dialog" aria-modal="true" aria-label={`HSK 1 Unit ${unit.unit}`}>
      <header className="hsk1-session-topbar">
        <button type="button" className="hsk1-icon-close" onClick={onClose} aria-label="Tutup">
          ✕
        </button>
        <div className="hsk1-top-progress" aria-label={`Progres ${progressPct}%`}>
          <i style={{ width: `${progressPct}%` }} />
        </div>
        <div className="hsk1-hud-badges">
          {combo >= 2 && <span className="hsk1-combo-pill">🔥 {combo}×</span>}
          <span className="hsk1-xp-pill">+{xpGain} XP</span>
        </div>
      </header>

      <div className="hsk1-node-bar" role="tablist">
        {HSK1_NODE_ORDER.map((nid) => {
          const meta = HSK1_NODE_META[nid]
          const isDone = (progressState.nodeDone[String(unit.unit)] ?? []).includes(nid)
          const isActive = node === nid
          return (
            <button
              key={nid}
              type="button"
              className={`hsk1-track-pill${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
              onClick={() => enterNode(nid)}
            >
              {isDone ? '✓' : meta.emoji} {meta.label}
            </button>
          )
        })}
      </div>

      <main className="hsk1-stage-body">
        {nodeDoneView ? (
          <div className="hsk1-stage-card hsk1-victory-card">
            <img className="hsk1-victory-art" src={champion.src} alt={champion.trainerTitle} />
            <div className="hsk1-kicker-jade">
              {node === 'bos' ? `UNIT ${unit.unit} DITUNTASKAN!` : `SIMPUL "${HSK1_NODE_META[node].label.toUpperCase()}" SELESAI!`}
            </div>
            <h2>{node === 'bos' ? `Skor ${bossScorePct}% · Hebat Renita! 🏆` : 'Mulus & Lancar! ✨'}</h2>
            <p className="hsk1-victory-sub">
              Kombo terbaik: <strong>{bestCombo}×</strong> · Total <strong>+{xpGain} XP</strong>
            </p>
            {node === 'bos' && bossForecast.length > 0 && (
              <div className="hsk1-forecast-grid">
                {bossForecast.map((f) => (
                  <div key={f.zh} className="hsk1-forecast-chip">
                    <strong lang="zh-CN">{f.zh}</strong>
                    <span>{f.nextLabel}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="hsk1-victory-actions">
              {nextNodeId ? (
                <button
                  type="button"
                  className="hsk1-btn-3d-jade"
                  onClick={() => {
                    playStart()
                    enterNode(nextNodeId)
                  }}
                >
                  {HSK1_NODE_META[nextNodeId].emoji} Lanjut: {HSK1_NODE_META[nextNodeId].label} ›
                </button>
              ) : unit.unit < HSK1_UNITS.length ? (
                <button type="button" className="hsk1-btn-3d-jade" onClick={onClose}>
                  Buka Unit {unit.unit + 1} di Peta ›
                </button>
              ) : null}
              <button type="button" className="hsk1-btn-soft" onClick={onClose}>
                Kembali ke Beranda
              </button>
            </div>
          </div>
        ) : node === 'kenali' ? (
          (() => {
            const step = kenaliDeck[stepIdx]
            if (!step) return null
            if (step.kind === 'intro') {
              const decomp = decomposeHsk1Word(step.word)
              return (
                <div key={step.id} className="hsk1-stage-card hsk1-focus-center">
                  <span className="hsk1-step-tag">
                    GELOMBANG {step.waveIdx}/{step.totalWaves} · KENALI KATA BARU
                  </span>
                  <div className="hsk1-hero-hanzi" lang="zh-CN">
                    {step.word.zh}
                  </div>
                  <div className="hsk1-hero-pinyin">{step.word.pinyin}</div>
                  <div className="hsk1-hero-meaning">{step.word.meaningId}</div>

                  <div className="hsk1-audio-pair">
                    <button type="button" className="hsk1-audio-btn" onClick={() => speakNormal(step.word.zh)}>
                      🔊 Dengar
                    </button>
                    <button type="button" className="hsk1-btn-soft" onClick={() => speakSlow(step.word.zh)}>
                      🐢 Pelan
                    </button>
                  </div>

                  <div className="hsk1-puzzle-box">
                    <div className="hsk1-puzzle-title">🧩 Akar Pembentuk Aksara (tap untuk lihat cerita)</div>
                    {decomp.characters.map((ch) => (
                      <div key={ch.char} className="hsk1-puzzle-char-row">
                        <span className="hsk1-puzzle-glyph" lang="zh-CN">
                          {ch.char}
                        </span>
                        <span className="hsk1-puzzle-eq">=</span>
                        <div className="hsk1-puzzle-parts">
                          {ch.parts.map((pt, pi) => (
                            <button
                              key={`${ch.char}-${pt.glyph}-${pi}`}
                              type="button"
                              className="hsk1-part-chip"
                              onClick={() => setSelectedRadicalStory(`${pt.emoji} ${pt.glyph}: ${pt.meaningId} — ${ch.storyId}`)}
                            >
                              {pt.emoji} <b lang="zh-CN">{pt.glyph}</b> ({pt.meaningId})
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="hsk1-puzzle-story">
                      {selectedRadicalStory ?? decomp.characters[0]?.storyId ?? step.word.literalTip}
                    </p>
                  </div>

                  <details className="hsk1-example-toggle">
                    <summary>Lihat contoh kalimat sehari-hari</summary>
                    <div className="hsk1-example-inner">
                      <div lang="zh-CN" style={{ fontWeight: 800, fontSize: 16 }}>
                        {step.word.exampleZh}
                      </div>
                      <div style={{ color: '#be185d', fontWeight: 700, fontSize: 13 }}>
                        {step.word.examplePinyin}
                      </div>
                      <div style={{ color: '#475569', fontSize: 13 }}>{step.word.exampleId}</div>
                      <button
                        type="button"
                        className="hsk1-mini-pill"
                        onClick={() => speakNormal(step.word.exampleZh)}
                      >
                        🔊 Putar Kalimat
                      </button>
                    </div>
                  </details>
                </div>
              )
            }

            // Micro-check card inside wave
            return (
              <div key={step.id} className="hsk1-stage-card">
                <span className="hsk1-step-tag">
                  ⚡ CEK CEPAT GELOMBANG {step.waveIdx} ({step.checkKind === 'audio' ? 'Dengar' : step.checkKind === 'radical' ? 'Akar Kata' : 'Arti'})
                </span>
                <h3 className="hsk1-quiz-prompt">{step.promptId}</h3>
                {step.checkKind === 'audio' && (
                  <div className="hsk1-audio-pair">
                    <button type="button" className="hsk1-audio-btn" onClick={() => speakNormal(step.target.zh)}>
                      🔊 Putar Audio
                    </button>
                    <button type="button" className="hsk1-btn-soft" onClick={() => speakSlow(step.target.zh)}>
                      🐢 Pelan
                    </button>
                  </div>
                )}
                <div className="hsk1-option-list">
                  {step.options.map((opt) => {
                    const answered = pickedZh !== null
                    const right = answered && opt.zh === step.target.zh
                    const wrong = answered && pickedZh === opt.zh && opt.zh !== step.target.zh
                    return (
                      <button
                        key={opt.zh}
                        type="button"
                        disabled={answered}
                        className={`hsk1-option-btn${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                        onClick={() => {
                          setPickedZh(opt.zh)
                          if (opt.zh === step.target.zh) rewardRight(8)
                          else registerWrong()
                        }}
                      >
                        <span className="hsk1-opt-zh" lang="zh-CN">
                          {opt.zh}
                        </span>
                        {answered && (
                          <span className="hsk1-opt-meta">
                            {opt.pinyin} · {opt.meaningId}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {pickedZh !== null && (
                  <div className="hsk1-tip-box">
                    <strong lang="zh-CN">{step.target.zh}</strong> ({step.target.pinyin}) = {step.target.meaningId}
                  </div>
                )}
              </div>
            )
          })()
        ) : node === 'goresan' ? (
          (() => {
            const target = traceTargets[stepIdx]
            if (!target) return null
            const decomp = decomposeHsk1Word({
              ...target.sourceWord,
              zh: target.char,
            })
            const chInfo = decomp.characters[0]
            return (
              <div key={`trace-${target.char}-${stepIdx}`} className="hsk1-stage-card hsk1-focus-center">
                <span className="hsk1-step-tag">
                  ✍️ LATIHAN URUTAN & ARTI GORESAN · {stepIdx + 1}/{traceTargets.length}
                </span>
                <div className="hsk1-trace-head-info">
                  <strong style={{ fontSize: 18 }}>
                    {target.sourceWord.zh} ({target.sourceWord.pinyin}) = {target.sourceWord.meaningId}
                  </strong>
                  <button
                    type="button"
                    className="hsk1-mini-pill"
                    onClick={() => speakNormal(target.char)}
                  >
                    🔊
                  </button>
                </div>

                {chInfo && (
                  <div className="hsk1-stroke-meaning-pills">
                    {chInfo.strokeGuides.slice(0, 4).map((sg) => (
                      <span
                        key={sg.id}
                        className="hsk1-stroke-chip"
                        style={{ borderColor: sg.colorHex, color: sg.colorHex }}
                      >
                        <strong lang="zh-CN">{sg.zh.split(' / ')[0]}</strong> {sg.nameId}
                      </span>
                    ))}
                  </div>
                )}

                <HanziTracePad
                  char={target.char}
                  onComplete={() => {
                    setTraceDoneMap((prev) => ({ ...prev, [target.char]: true }))
                    rewardRight(10)
                  }}
                  onMistake={() => setCombo(0)}
                />

                {chInfo && <div className="hsk1-tip-box">{chInfo.storyId}</div>}
              </div>
            )
          })()
        ) : node === 'dengar' ? (
          (() => {
            const dStep = dengarSteps[stepIdx]
            if (!dStep) return null
            if (dStep.kind === 'match') {
              return (
                <div key={dStep.id} className="hsk1-stage-card">
                  <span className="hsk1-step-tag">
                    🔗 PASANGKAN KATA & ARTI ({matchedZh.length}/{dStep.words.length})
                  </span>
                  <h3 className="hsk1-quiz-prompt">
                    Ketuk Hanzi di kiri (otomatis berbunyi), lalu ketuk artinya di kanan:
                  </h3>
                  <div className="hsk1-match-cols">
                    <div className="hsk1-match-col">
                      {dStep.words.map((w) => {
                        const isMatched = matchedZh.includes(w.zh)
                        const isSel = matchLeftSel === w.zh
                        return (
                          <button
                            key={w.zh}
                            type="button"
                            disabled={isMatched}
                            className={`hsk1-match-tile${isMatched ? ' is-matched' : ''}${isSel ? ' is-selected' : ''}${mismatchPair && isSel ? ' is-wrong' : ''}`}
                            onClick={() => handlePairPick('left', w.zh)}
                          >
                            <span lang="zh-CN" className="hsk1-match-zh">
                              {w.zh}
                            </span>
                            <small>🔊</small>
                          </button>
                        )
                      })}
                    </div>
                    <div className="hsk1-match-col">
                      {dStep.shuffledMeanings.map((w) => {
                        const isMatched = matchedZh.includes(w.zh)
                        const isSel = matchRightSel === w.zh
                        return (
                          <button
                            key={`m-${w.zh}`}
                            type="button"
                            disabled={isMatched}
                            className={`hsk1-match-tile${isMatched ? ' is-matched' : ''}${isSel ? ' is-selected' : ''}${mismatchPair && isSel ? ' is-wrong' : ''}`}
                            onClick={() => handlePairPick('right', w.zh)}
                          >
                            <span>{w.meaningId}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={dStep.id} className="hsk1-stage-card">
                <span className="hsk1-step-tag">🎧 DENGAR TANPA PINYIN</span>
                <h3 className="hsk1-quiz-prompt">Putar suara kata ini lalu pilih karakter & arti yang cocok:</h3>
                <div className="hsk1-audio-pair">
                  <button type="button" className="hsk1-audio-btn" onClick={() => speakNormal(dStep.target.zh)}>
                    🔊 Putar Kata
                  </button>
                  <button type="button" className="hsk1-btn-soft" onClick={() => speakSlow(dStep.target.zh)}>
                    🐢 Pelan
                  </button>
                </div>
                <div className="hsk1-option-list">
                  {dStep.options.map((opt) => {
                    const answered = pickedZh !== null
                    const right = answered && opt.zh === dStep.target.zh
                    const wrong = answered && pickedZh === opt.zh && opt.zh !== dStep.target.zh
                    return (
                      <button
                        key={opt.zh}
                        type="button"
                        disabled={answered}
                        className={`hsk1-option-btn${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                        onClick={() => {
                          setPickedZh(opt.zh)
                          s.recordRecall(dStep.target.zh, { correct: opt.zh === dStep.target.zh, mode: 'listening' })
                          if (opt.zh === dStep.target.zh) rewardRight(8)
                          else registerWrong()
                        }}
                      >
                        <span className="hsk1-opt-zh" lang="zh-CN">
                          {opt.zh}
                        </span>
                        <span className="hsk1-opt-meta">{opt.meaningId}</span>
                      </button>
                    )
                  })}
                </div>
                {pickedZh !== null && (
                  <div className="hsk1-tip-box">
                    <strong lang="zh-CN">{dStep.target.zh}</strong> ({dStep.target.pinyin}) — {dStep.target.meaningId}
                  </div>
                )}
              </div>
            )
          })()
        ) : node === 'kalimat' ? (
          (() => {
            const kStep = kalimatDeck[stepIdx]
            if (!kStep) return null
            if (kStep.kind === 'formula') {
              return (
                <div key={kStep.id} className="hsk1-stage-card">
                  <span className="hsk1-step-tag">🧩 POLA KALIMAT UNIT {unit.unit}</span>
                  <h2 className="hsk1-card-title">{unit.grammar.titleId}</h2>
                  <div className="hsk1-formula-pill">{unit.grammar.pattern}</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#334155' }}>
                    {unit.grammar.explainId}
                  </p>
                  <div className="hsk1-option-list">
                    {unit.grammar.examples.slice(0, 2).map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        className="hsk1-sound-bubble"
                        onClick={() => speakNormal(ex.zh)}
                      >
                        <strong lang="zh-CN">🔊 {ex.zh}</strong>
                        <span>
                          {ex.pinyin} — {ex.id}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            }

            if (kStep.kind === 'tiles') {
              const built = buildSentenceTiles(kStep.sentenceZh, unit.words)
              const currentSentence = tilePlaced.map((idx) => built.bankTokens[idx]).join('')
              return (
                <div key={kStep.id} className="hsk1-stage-card">
                  <span className="hsk1-step-tag">🧩 SUSUN KATA JADI KALIMAT</span>
                  <div className="hsk1-hero-meaning" style={{ textAlign: 'left' }}>
                    "{kStep.sentenceId}"
                  </div>
                  <button
                    type="button"
                    className="hsk1-mini-pill"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => speakSlow(kStep.sentenceZh)}
                  >
                    🐢 Dengar Petunjuk Audio
                  </button>

                  <div className={`hsk1-tile-tray${tileChecked === 'wrong' ? ' is-wrong' : ''}`}>
                    {tilePlaced.length === 0 ? (
                      <span className="hsk1-tile-placeholder">Ketuk balok kata di bawah untuk menyusun…</span>
                    ) : (
                      tilePlaced.map((bankIdx, pos) => (
                        <button
                          key={`placed-${bankIdx}-${pos}`}
                          type="button"
                          className="hsk1-word-chip is-placed"
                          onClick={() => {
                            if (tileChecked === 'right') return
                            setTileChecked('idle')
                            setTilePlaced((prev) => prev.filter((_, p) => p !== pos))
                          }}
                        >
                          <span lang="zh-CN">{built.bankTokens[bankIdx]}</span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="hsk1-tile-bank">
                    {built.bankTokens.map((tok, bIdx) => {
                      const used = tilePlaced.includes(bIdx)
                      return (
                        <button
                          key={`bank-${tok}-${bIdx}`}
                          type="button"
                          disabled={used || tileChecked === 'right'}
                          className={`hsk1-word-chip${used ? ' is-used' : ''}`}
                          onClick={() => {
                            speakNormal(tok)
                            setTileChecked('idle')
                            setTilePlaced((prev) => [...prev, bIdx])
                          }}
                        >
                          <span lang="zh-CN">{tok}</span>
                        </button>
                      )
                    })}
                  </div>

                  {tileChecked !== 'right' && tilePlaced.length > 0 && (
                    <button
                      type="button"
                      className="hsk1-btn-soft"
                      onClick={() => {
                        if (currentSentence === built.cleanSentence) {
                          setTileChecked('right')
                          rewardRight(10)
                          void speak(kStep.sentenceZh)
                        } else {
                          setTileChecked('wrong')
                          registerWrong()
                        }
                      }}
                    >
                      Periksa Susunan ✓
                    </button>
                  )}

                  {tileChecked === 'right' && (
                    <div className="hsk1-tip-box">
                      ✓ Benar! <strong lang="zh-CN">{kStep.sentenceZh}</strong> ({kStep.sentencePinyin})
                    </div>
                  )}
                  {tileChecked === 'wrong' && (
                    <div className="hsk1-tip-box">
                      Hampir tepat! Urutan Mandarin menempatkan Subjek → Keterangan/Negasi → Kata Kerja. Ketuk balok untuk menyusun ulang.
                    </div>
                  )}
                </div>
              )
            }

            if (kStep.kind === 'quiz') {
              const q = unit.grammarQuiz[kStep.qIdx]
              return (
                <div key={kStep.id} className="hsk1-stage-card">
                  <span className="hsk1-step-tag">🎯 LENGKAPI GRAMMAR</span>
                  <h3 className="hsk1-quiz-prompt">{q.promptId}</h3>
                  <div className="hsk1-sentence-box" lang="zh-CN">
                    {q.sentence}
                  </div>
                  <div className="hsk1-option-list">
                    {q.options.map((opt) => {
                      const answered = grammarPick !== null
                      const right = answered && opt === q.answer
                      const wrong = answered && grammarPick === opt && opt !== q.answer
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={answered}
                          className={`hsk1-option-btn${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                          onClick={() => {
                            setGrammarPick(opt)
                            if (opt === q.answer) rewardRight(8)
                            else registerWrong()
                          }}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                  {grammarPick !== null && <div className="hsk1-tip-box">{q.explainId}</div>}
                </div>
              )
            }

            return (
              <div key={kStep.id} className="hsk1-stage-card">
                <span className="hsk1-step-tag">💬 DIALOG MINI DUNIA NYATA</span>
                <div className="hsk1-dialogue-list">
                  {unit.dialogue.map((line, i) => (
                    <button
                      key={i}
                      type="button"
                      className="hsk1-dialogue-bubble"
                      onClick={() => speakNormal(line.zh)}
                    >
                      <strong className="hsk1-speaker-lbl">🔊 {line.speaker}</strong>
                      <span lang="zh-CN" className="hsk1-dialogue-zh">
                        {line.zh}
                      </span>
                      <span className="hsk1-dialogue-py">{line.pinyin}</span>
                      <span className="hsk1-dialogue-id">{line.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })()
        ) : (
          // Node 5: Boss Active Recall + Graduated Hint Ladder + Mistake Loop + FSRS
          (() => {
            const bItem = bossDeck[stepIdx]
            if (!bItem) return null
            const options = buildDistractorOptions(unit, bItem.word, 4)
            const decomp = decomposeHsk1Word(bItem.word)
            const radicalClue =
              decomp.characters[0]?.parts.map((p) => `${p.emoji} ${p.meaningId}`).join(' + ') || bItem.word.literalTip
            return (
              <div key={`${bItem.id}-${stepIdx}`} className="hsk1-stage-card">
                <span className="hsk1-step-tag">
                  {bItem.retry
                    ? '🔁 RONDE PERBAIKAN · KUNCI INGATANMU'
                    : bItem.mode === 'audio'
                      ? `🏆 BOS RECALL · DENGAR (${stepIdx + 1}/${bossDeck.length})`
                      : `🏆 BOS RECALL · TANPA HINT (${stepIdx + 1}/${bossDeck.length})`}
                </span>

                {bItem.mode === 'audio' ? (
                  <>
                    <h3 className="hsk1-quiz-prompt">Dengar kata Mandarinnya, lalu pilih aksara yang tepat:</h3>
                    <div className="hsk1-audio-pair">
                      <button type="button" className="hsk1-audio-btn" onClick={() => speakNormal(bItem.word.zh)}>
                        🔊 Putar Kata
                      </button>
                      <button type="button" className="hsk1-btn-soft" onClick={() => speakSlow(bItem.word.zh)}>
                        🐢 Pelan
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#475569' }}>
                      Pilih karakter Mandarin untuk arti berikut tanpa bantuan hint agar FSRS menjadwalkannya sebagai kuat:
                    </p>
                    <div className="hsk1-hero-meaning" style={{ textAlign: 'left' }}>
                      "{bItem.word.meaningId}"
                    </div>
                  </>
                )}

                {hintTier === 0 && pickedZh === null && (
                  <button
                    type="button"
                    className="hsk1-mini-pill"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      playHint()
                      setHintTier(1)
                    }}
                  >
                    💡 Petunjuk 1: Cerita Akar Kata
                  </button>
                )}
                {hintTier >= 1 && (
                  <div className="hsk1-tip-box">
                    <strong>Akar Kata:</strong> {radicalClue} — {bItem.word.literalTip}
                    {hintTier === 1 && pickedZh === null && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="hsk1-mini-pill"
                          onClick={() => {
                            playHint()
                            setHintTier(2)
                            void speak(bItem.word.zh)
                          }}
                        >
                          🔊 Petunjuk 2: Dengar & Pinyin
                        </button>
                      </div>
                    )}
                    {hintTier >= 2 && (
                      <div style={{ marginTop: 4, fontWeight: 800, color: '#be185d' }}>
                        Pinyin: {bItem.word.pinyin}
                      </div>
                    )}
                  </div>
                )}

                <div className="hsk1-option-list">
                  {options.map((opt) => {
                    const answered = pickedZh !== null
                    const right = answered && opt.zh === bItem.word.zh
                    const wrong = answered && pickedZh === opt.zh && opt.zh !== bItem.word.zh
                    return (
                      <button
                        key={opt.zh}
                        type="button"
                        disabled={answered}
                        className={`hsk1-option-btn${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                        onClick={() => {
                          setPickedZh(opt.zh)
                          const isRight = opt.zh === bItem.word.zh
                          if (isRight) {
                            const rating: Rating = hintTier > 0 ? 'hard' : combo >= 3 ? 'easy' : 'good'
                            if (!bItem.retry) {
                              setBossRatings((prev) => ({ ...prev, [bItem.word.zh]: rating }))
                            }
                            rewardRight(hintTier > 0 ? 5 : 10)
                          } else {
                            if (!bItem.retry) {
                              setBossRatings((prev) => ({ ...prev, [bItem.word.zh]: 'again' }))
                            }
                            registerWrong()
                            setBossDeck((prev) => [
                              ...prev,
                              { id: `${bItem.id}-rec-${prev.length}`, word: bItem.word, mode: 'meaning', retry: true },
                            ])
                          }
                        }}
                      >
                        <span className="hsk1-opt-zh" lang="zh-CN">
                          {opt.zh}
                        </span>
                        {answered && (
                          <span className="hsk1-opt-meta">
                            {opt.pinyin} · {opt.meaningId}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {pickedZh !== null && (
                  <div className="hsk1-tip-box">
                    <strong lang="zh-CN">{bItem.word.zh}</strong> ({bItem.word.pinyin}) = {bItem.word.meaningId} · Contoh:{' '}
                    <span lang="zh-CN">{bItem.word.exampleZh}</span>
                  </div>
                )}
              </div>
            )
          })()
        )}
      </main>

      {!nodeDoneView && (
        <footer className="hsk1-stage-foot">
          <button
            type="button"
            className="hsk1-btn-3d-jade"
            disabled={!canAdvance}
            onClick={advanceStep}
          >
            {stepIdx + 1 < totalStepsInNode ? 'Lanjut ›' : `Selesaikan ${HSK1_NODE_META[node].label} ✓`}
          </button>
        </footer>
      )}
    </div>
  )
}

/* ============================================================================
 * 4. Hsk1RecallOverlay — FSRS-6 Spaced Repetition Due-Word Active Recall
 * ============================================================================ */

export function Hsk1RecallOverlay({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const champion = useRenitaChampionArt()
  const [progress] = useState(readHsk1Progress)
  const initialQueue = useMemo(
    () => selectHsk1RecallQueue(progress.srsCards, progress.provenWords, ALL_HSK1_WORDS, Date.now(), 10),
    [progress.srsCards, progress.provenWords],
  )

  const [deck, setDeck] = useState<Array<{ id: string; word: Hsk1Word; kind: 'meaning' | 'cloze'; retry?: boolean }>>(
    () =>
      initialQueue.map((word, idx) => ({
        id: `rec-${word.zh}`,
        word,
        kind: idx % 2 === 1 && word.exampleZh.includes(word.zh) ? 'cloze' : 'meaning',
      })),
  )
  const [idx, setIdx] = useState(0)
  const [pickedZh, setPickedZh] = useState<string | null>(null)
  const [hintTier, setHintTier] = useState<0 | 1 | 2>(0)
  const [combo, setCombo] = useState(0)
  const [xpGain, setXpGain] = useState(0)
  const [srsCardsDraft, setSrsCardsDraft] = useState(progress.srsCards)
  const [reviews, setReviews] = useState<Record<string, Rating>>({})
  const [lastIntervalBadge, setLastIntervalBadge] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => () => stopSpeech(), [])

  const cur = deck[idx]
  const options = useMemo(() => {
    if (!cur) return []
    const others = ALL_HSK1_WORDS.filter((w) => w.zh !== cur.word.zh)
    const start = Math.max(0, ALL_HSK1_WORDS.findIndex((w) => w.zh === cur.word.zh))
    const picks = [others[(start + 3) % others.length], others[(start + 17) % others.length], others[(start + 37) % others.length]]
    return [cur.word, ...picks].sort((a, b) => a.zh.localeCompare(b.zh))
  }, [cur])

  function handleAnswer(opt: Hsk1Word) {
    if (!cur || pickedZh !== null) return
    setPickedZh(opt.zh)
    const right = opt.zh === cur.word.zh
    const rating: Rating = right ? (hintTier > 0 ? 'hard' : combo >= 3 ? 'easy' : 'good') : 'again'

    const unitOwner = HSK1_UNITS.find((u) => u.words.some((w) => w.zh === cur.word.zh))?.unit ?? 1
    const res = reviewHsk1Card(srsCardsDraft, cur.word.zh, unitOwner, rating, Date.now())
    setSrsCardsDraft(res.nextCards)
    setLastIntervalBadge(res.nextLabel)

    if (!cur.retry) {
      setReviews((prev) => ({ ...prev, [cur.word.zh]: rating }))
    }

    s.recordRecall(cur.word.zh, {
      correct: right,
      mode: 'recall',
      assisted: hintTier > 0,
    })

    if (right) {
      const nc = combo + 1
      setCombo(nc)
      setXpGain((x) => x + (hintTier > 0 ? 6 : 12))
      if (nc >= 2) playCombo(nc)
      else playCorrect()
    } else {
      setCombo(0)
      playWrong()
      setDeck((prev) => [...prev, { id: `${cur.id}-loop-${prev.length}`, word: cur.word, kind: 'meaning', retry: true }])
    }
  }

  function advanceRecall() {
    stopSpeech()
    setPickedZh(null)
    setHintTier(0)
    setLastIntervalBadge(null)
    if (idx + 1 < deck.length) {
      playAdvance()
      setIdx((i) => i + 1)
      return
    }

    const batch = Object.entries(reviews).map(([zh, rating]) => ({
      zh,
      unit: HSK1_UNITS.find((u) => u.words.some((w) => w.zh === zh))?.unit ?? 1,
      rating,
    }))
    recordHsk1SrsBatch(batch, Date.now())
    s.logDrill(batch.length, 25)
    s.awardXp(Math.max(20, xpGain))
    recordHistory({
      course: 'hsk1',
      kind: 'drill',
      lesson: 0,
      title: 'HSK 1 Recall Terjadwal (FSRS-6)',
      correct: true,
      xp: Math.max(20, xpGain),
    })

    playComplete()
    setDone(true)
  }

  const pct = done ? 100 : Math.round(((idx + 1) / Math.max(1, deck.length)) * 100)
  const clozeSentence = cur ? cur.word.exampleZh.replace(cur.word.zh, ' [ ____ ] ') : ''
  const decomp = cur ? decomposeHsk1Word(cur.word) : null

  return (
    <div className="hsk1-overlay" role="dialog" aria-modal="true" aria-label="HSK 1 Recall Terjadwal">
      <header className="hsk1-session-topbar">
        <button type="button" className="hsk1-icon-close" onClick={onClose} aria-label="Tutup">
          ✕
        </button>
        <div className="hsk1-top-progress">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="hsk1-hud-badges">
          {combo >= 2 && <span className="hsk1-combo-pill">🔥 {combo}×</span>}
          <span className="hsk1-xp-pill">+{xpGain} XP</span>
        </div>
      </header>

      <main className="hsk1-stage-body">
        {done ? (
          <div className="hsk1-stage-card hsk1-victory-card">
            <img className="hsk1-victory-art" src={champion.src} alt={champion.trainerTitle} />
            <div className="hsk1-kicker-jade">FSRS-6 RECALL SELESAI!</div>
            <h2>Ingatanmu Makin Tajam! 🧠✨</h2>
            <p className="hsk1-victory-sub">
              <strong>{Object.keys(reviews).length} kata</strong> baru saja dijadwalkan ulang otomatis berdasarkan
              kekuatan memori aslimu (+{Math.max(20, xpGain)} XP).
            </p>
            <div className="hsk1-victory-actions">
              <button type="button" className="hsk1-btn-3d-jade" onClick={onClose}>
                Selesai & Cek Beranda ›
              </button>
            </div>
          </div>
        ) : cur ? (
          <div key={`${cur.id}-${idx}`} className="hsk1-stage-card">
            <span className="hsk1-step-tag">
              {cur.retry
                ? '🔁 ULANG LAGI · KUNCI MEMORI'
                : cur.kind === 'cloze'
                  ? `🧩 LENGKAPI KALIMAT (${idx + 1}/${deck.length})`
                  : `🧠 SEGARKAN INGATAN (${idx + 1}/${deck.length})`}
            </span>

            {cur.kind === 'cloze' ? (
              <>
                <div className="hsk1-sentence-box" lang="zh-CN">
                  {clozeSentence}
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>"{cur.word.exampleId}"</p>
                <button
                  type="button"
                  className="hsk1-mini-pill"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => speakSlow(cur.word.exampleZh)}
                >
                  🐢 Dengar Kalimat
                </button>
              </>
            ) : (
              <div className="hsk1-hero-meaning" style={{ textAlign: 'left' }}>
                "{cur.word.meaningId}"
              </div>
            )}

            {hintTier === 0 && pickedZh === null && (
              <button
                type="button"
                className="hsk1-mini-pill"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  playHint()
                  setHintTier(1)
                }}
              >
                💡 Petunjuk 1: Cerita Akar Kata
              </button>
            )}
            {hintTier >= 1 && (
              <div className="hsk1-tip-box">
                <strong>Akar Kata:</strong>{' '}
                {decomp?.characters[0]?.parts.map((p) => `${p.emoji} ${p.meaningId}`).join(' + ')} —{' '}
                {cur.word.literalTip}
                {hintTier === 1 && pickedZh === null && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="hsk1-mini-pill"
                      onClick={() => {
                        playHint()
                        setHintTier(2)
                        void speak(cur.word.zh)
                      }}
                    >
                      🔊 Petunjuk 2: Dengar & Pinyin
                    </button>
                  </div>
                )}
                {hintTier >= 2 && (
                  <div style={{ marginTop: 4, fontWeight: 800, color: '#be185d' }}>Pinyin: {cur.word.pinyin}</div>
                )}
              </div>
            )}

            <div className="hsk1-option-list">
              {options.map((opt) => {
                const answered = pickedZh !== null
                const right = answered && opt.zh === cur.word.zh
                const wrong = answered && pickedZh === opt.zh && opt.zh !== cur.word.zh
                return (
                  <button
                    key={opt.zh}
                    type="button"
                    disabled={answered}
                    className={`hsk1-option-btn${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                    onClick={() => handleAnswer(opt)}
                  >
                    <span className="hsk1-opt-zh" lang="zh-CN">
                      {opt.zh}
                    </span>
                    {answered && (
                      <span className="hsk1-opt-meta">
                        {opt.pinyin} · {opt.meaningId}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {pickedZh !== null && (
              <div className="hsk1-tip-box" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <span>
                  <strong lang="zh-CN">{cur.word.zh}</strong> ({cur.word.pinyin}) = {cur.word.meaningId}
                </span>
                {lastIntervalBadge && (
                  <strong style={{ color: '#0f766e' }}>📅 Diulang lagi: {lastIntervalBadge}</strong>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>

      {!done && (
        <footer className="hsk1-stage-foot">
          <button
            type="button"
            className="hsk1-btn-3d-jade"
            disabled={pickedZh === null}
            onClick={advanceRecall}
          >
            {idx + 1 < deck.length ? 'Lanjut ›' : 'Selesai Recall ✓'}
          </button>
        </footer>
      )}
    </div>
  )
}
