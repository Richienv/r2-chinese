import { useEffect, useMemo, useState } from 'react'
import {
  HSK1_PINYIN_DRILLS,
  HSK1_PINYIN_GROUPS,
  HSK1_TONES,
  HSK1_TONE_DRILLS,
  HSK1_UNITS,
  type Hsk1Unit,
  type Hsk1Word,
} from '../data/hsk1'
import { getActiveCoupleId, getCoupleNames } from '../lib/coupleProfile'
import { postCoupleEvent } from '../lib/coupleSync'
import {
  readHsk1Progress,
  recordHsk1PinyinScore,
  recordHsk1ToneScore,
  recordHsk1UnitResult,
  subscribeHsk1Progress,
} from '../lib/hsk1'
import { recordHistory } from '../lib/history'
import { playComplete, playCorrect, playWrong } from '../lib/sfx'
import { speak, stopSpeech } from '../lib/speech'
import { useStore } from '../store/store'
import '../styles/hsk1.css'

const PHASES: Array<{ phase: 1 | 2 | 3 | 4 | 5; title: string }> = [
  { phase: 1, title: 'Fase 1 · Nada & Sapaan Dasar' },
  { phase: 2, title: 'Fase 2 · Keluarga, Angka & Kepemilikan' },
  { phase: 3, title: 'Fase 3 · Waktu, Lokasi & Belanja' },
  { phase: 4, title: 'Fase 4 · Belajar, Deskripsi & Cuaca' },
  { phase: 5, title: 'Fase 5 · Transportasi & Kalimat Utuh' },
]

export function Hsk1HomePath({
  onOpenUnit,
  onOpenToneLab,
}: {
  onOpenUnit: (unit: number) => void
  onOpenToneLab: () => void
}) {
  const [progress, setProgress] = useState(readHsk1Progress)
  useEffect(() => subscribeHsk1Progress(setProgress), [])

  return (
    <div className="hsk1-home-wrap">
      <button type="button" className="hsk1-tonelab-banner" onClick={onOpenToneLab}>
        <div>
          <div className="hsk1-tonelab-kicker">PONDASI ZERO-TO-HERO · 声调与拼音</div>
          <div className="hsk1-tonelab-title">Lab 4 Nada & Pinyin Dari Nol</div>
          <div className="hsk1-tonelab-sub">
            Pahami 4 nada dasar, aturan Sandhi, bunyi j/q/x vs zh/ch/sh & vokal ü lewat kuis dengar.
          </div>
          <div className="hsk1-tonelab-pills">
            <span className="hsk1-pill">Nada: {progress.tonesPassed}/12</span>
            <span className="hsk1-pill">Pinyin: {progress.pinyinPassed}/10</span>
            <span className="hsk1-pill">Unit Tuntas: {progress.unitsDone.length}/15</span>
            <span className="hsk1-pill">Kata Terbukti: {progress.provenWords.length}/150</span>
          </div>
        </div>
        <span style={{ fontSize: 20, fontWeight: 900, color: '#be185d' }}>›</span>
      </button>

      <div className="hsk1-phases">
        {PHASES.map(({ phase, title }) => {
          const units = HSK1_UNITS.filter((u) => u.phase === phase)
          return (
            <section key={phase} className="hsk1-phase-card">
              <div className="hsk1-phase-head">
                <span>{title}</span>
                <span style={{ color: '#64748b', fontSize: 12 }}>
                  {units.filter((u) => progress.unitsDone.includes(u.unit)).length}/{units.length} selesai
                </span>
              </div>
              <div className="hsk1-unit-grid">
                {units.map((u) => {
                  const done = progress.unitsDone.includes(u.unit)
                  const best = progress.bestUnitScores[String(u.unit)]
                  return (
                    <button
                      key={u.unit}
                      type="button"
                      className={`hsk1-unit-btn${done ? ' is-done' : ''}`}
                      onClick={() => onOpenUnit(u.unit)}
                    >
                      <span className="hsk1-unit-num">{done ? '✓' : u.unit}</span>
                      <div className="hsk1-unit-body">
                        <div className="hsk1-unit-zh" lang="zh-CN">
                          {u.titleZh}
                        </div>
                        <div className="hsk1-unit-title">
                          {u.titleId} · {u.words.length} kata
                        </div>
                      </div>
                      <span className="hsk1-unit-score">
                        {best !== undefined ? `${best}%` : 'Mulai ›'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export function Hsk1ToneLabOverlay({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [tab, setTab] = useState<'guide' | 'tones' | 'pinyin'>('guide')
  const [toneIdx, setToneIdx] = useState(0)
  const [toneAnswers, setToneAnswers] = useState<Record<number, number>>({})
  const [pinyinIdx, setPinyinIdx] = useState(0)
  const [pinyinAnswers, setPinyinAnswers] = useState<Record<number, number>>({})

  useEffect(() => () => stopSpeech(), [])

  const currentToneDrill = HSK1_TONE_DRILLS[toneIdx]
  const currentPinyinDrill = HSK1_PINYIN_DRILLS[pinyinIdx]

  const toneCorrect = Object.entries(toneAnswers).filter(
    ([idx, pick]) => HSK1_TONE_DRILLS[Number(idx)]?.answerIndex === pick,
  ).length
  const pinyinCorrect = Object.entries(pinyinAnswers).filter(
    ([idx, pick]) => HSK1_PINYIN_DRILLS[Number(idx)]?.answerIndex === pick,
  ).length

  function pickToneOption(optIdx: number) {
    if (toneAnswers[toneIdx] !== undefined) return
    const right = optIdx === currentToneDrill.answerIndex
    const nextMap = { ...toneAnswers, [toneIdx]: optIdx }
    setToneAnswers(nextMap)
    if (right) playCorrect()
    else playWrong()

    const totalRight = Object.entries(nextMap).filter(
      ([idx, p]) => HSK1_TONE_DRILLS[Number(idx)]?.answerIndex === p,
    ).length
    recordHsk1ToneScore(totalRight)

    if (Object.keys(nextMap).length === HSK1_TONE_DRILLS.length) {
      playComplete()
      s.logDrill(HSK1_TONE_DRILLS.length, 30)
      s.awardXp(totalRight >= 8 ? 45 : 20)
      recordHistory({
        course: 'hsk1',
        kind: 'quiz',
        lesson: 0,
        title: 'HSK 1 Lab 4 Nada',
        correct: totalRight >= 8,
        xp: Math.round((totalRight / HSK1_TONE_DRILLS.length) * 100),
      })
      const me = getActiveCoupleId()
      const names = getCoupleNames()
      void postCoupleEvent({
        from: me,
        kind: 'milestone',
        text: `Menyelesaikan Lab 4 Nada HSK 1 (${totalRight}/${HSK1_TONE_DRILLS.length} benar)!`,
        names,
      })
    }
  }

  function pickPinyinOption(optIdx: number) {
    if (pinyinAnswers[pinyinIdx] !== undefined) return
    const right = optIdx === currentPinyinDrill.answerIndex
    const nextMap = { ...pinyinAnswers, [pinyinIdx]: optIdx }
    setPinyinAnswers(nextMap)
    if (right) playCorrect()
    else playWrong()

    const totalRight = Object.entries(nextMap).filter(
      ([idx, p]) => HSK1_PINYIN_DRILLS[Number(idx)]?.answerIndex === p,
    ).length
    recordHsk1PinyinScore(totalRight)

    if (Object.keys(nextMap).length === HSK1_PINYIN_DRILLS.length) {
      playComplete()
      s.logDrill(HSK1_PINYIN_DRILLS.length, 30)
      s.awardXp(totalRight >= 7 ? 45 : 20)
      recordHistory({
        course: 'hsk1',
        kind: 'quiz',
        lesson: 0,
        title: 'HSK 1 Lab Pinyin',
        correct: totalRight >= 7,
        xp: Math.round((totalRight / HSK1_PINYIN_DRILLS.length) * 100),
      })
      const me = getActiveCoupleId()
      const names = getCoupleNames()
      void postCoupleEvent({
        from: me,
        kind: 'milestone',
        text: `Menyelesaikan Lab Pinyin HSK 1 (${totalRight}/${HSK1_PINYIN_DRILLS.length} benar)!`,
        names,
      })
    }
  }

  return (
    <div className="hsk1-overlay" role="dialog" aria-modal="true" aria-label="Lab 4 Nada & Pinyin">
      <header className="hsk1-overlay-head">
        <div>
          <strong>Lab 4 Nada & Pinyin Dari Nol</strong>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Nada: {toneCorrect}/{HSK1_TONE_DRILLS.length} · Pinyin: {pinyinCorrect}/{HSK1_PINYIN_DRILLS.length}
          </div>
        </div>
        <button type="button" className="hsk1-btn-ghost" onClick={onClose}>
          Tutup ✕
        </button>
      </header>

      <main className="hsk1-overlay-body">
        <div className="hsk1-stage-tabs" role="tablist">
          <button
            type="button"
            className={`hsk1-stage-tab${tab === 'guide' ? ' is-active' : ''}`}
            onClick={() => setTab('guide')}
          >
            1. Panduan 4 Nada & Pinyin
          </button>
          <button
            type="button"
            className={`hsk1-stage-tab${tab === 'tones' ? ' is-active' : ''}`}
            onClick={() => setTab('tones')}
          >
            2. Tes Dengar 4 Nada ({HSK1_TONE_DRILLS.length})
          </button>
          <button
            type="button"
            className={`hsk1-stage-tab${tab === 'pinyin' ? ' is-active' : ''}`}
            onClick={() => setTab('pinyin')}
          >
            3. Tes Bunyi Pinyin ({HSK1_PINYIN_DRILLS.length})
          </button>
        </div>

        {tab === 'guide' && (
          <>
            <div className="hsk1-tone-grid">
              {HSK1_TONES.map((tone) => (
                <div key={tone.tone} className="hsk1-tone-tile">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: tone.colorHex }}>{tone.label}</strong>
                    <span style={{ fontSize: 18, fontWeight: 900 }}>{tone.mark}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {tone.contour} · {tone.zhName}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900 }} lang="zh-CN">
                    {tone.sampleZh}{' '}
                    <span style={{ fontSize: 15, color: tone.colorHex }}>
                      ({tone.sampleSyllable} = {tone.sampleMeaning})
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: '#334155' }}>
                    {tone.howTo}
                  </p>
                  <button
                    type="button"
                    className="hsk1-audio-btn"
                    style={{ background: tone.colorHex }}
                    onClick={() => void speak(tone.sampleZh)}
                  >
                    🔊 Dengar "{tone.sampleSyllable}"
                  </button>
                </div>
              ))}
            </div>

            {HSK1_PINYIN_GROUPS.map((grp) => (
              <div key={grp.id} className="hsk1-card">
                <strong>{grp.title}</strong>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#be185d' }}>{grp.symbols}</div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#334155' }}>{grp.tipId}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {grp.examples.map((ex) => (
                    <button
                      key={ex.pinyin}
                      type="button"
                      className="hsk1-btn-ghost"
                      onClick={() => void speak(ex.zh)}
                    >
                      🔊 {ex.zh} ({ex.pinyin}) · {ex.meaning}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'tones' && currentToneDrill && (
          <div className="hsk1-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>
                Soal Nada {toneIdx + 1} / {HSK1_TONE_DRILLS.length}
              </strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>Skor benar: {toneCorrect}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#334155' }}>{currentToneDrill.promptHint}</p>
            <button
              type="button"
              className="hsk1-audio-btn"
              onClick={() => void speak(currentToneDrill.promptAudio)}
            >
              🔊 Putar Audio Soal
            </button>
            <div className="hsk1-option-list">
              {currentToneDrill.options.map((opt, idx) => {
                const picked = toneAnswers[toneIdx]
                const answered = picked !== undefined
                const isRight = answered && idx === currentToneDrill.answerIndex
                const isWrong = answered && picked === idx && idx !== currentToneDrill.answerIndex
                return (
                  <button
                    key={opt.zh}
                    type="button"
                    disabled={answered}
                    className={`hsk1-option-btn${isRight ? ' is-right' : ''}${isWrong ? ' is-wrong' : ''}`}
                    onClick={() => pickToneOption(idx)}
                  >
                    {opt.zh} · {opt.pinyin} — {opt.meaning}
                  </button>
                )
              })}
            </div>
            {toneAnswers[toneIdx] !== undefined && (
              <div className="hsk1-tip-box">{currentToneDrill.explainId}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button
                type="button"
                className="hsk1-btn-ghost"
                disabled={toneIdx === 0}
                onClick={() => setToneIdx((i) => Math.max(0, i - 1))}
              >
                ‹ Sebelumnya
              </button>
              <button
                type="button"
                className="hsk1-btn-primary"
                onClick={() =>
                  toneIdx + 1 < HSK1_TONE_DRILLS.length ? setToneIdx((i) => i + 1) : setTab('pinyin')
                }
              >
                {toneIdx + 1 < HSK1_TONE_DRILLS.length ? 'Soal Berikutnya ›' : 'Lanjut ke Tes Pinyin ›'}
              </button>
            </div>
          </div>
        )}

        {tab === 'pinyin' && currentPinyinDrill && (
          <div className="hsk1-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>
                Soal Pinyin {pinyinIdx + 1} / {HSK1_PINYIN_DRILLS.length}
              </strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>Skor benar: {pinyinCorrect}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#334155' }}>{currentPinyinDrill.questionId}</p>
            <button
              type="button"
              className="hsk1-audio-btn"
              onClick={() => void speak(currentPinyinDrill.promptAudio)}
            >
              🔊 Putar Audio Soal
            </button>
            <div className="hsk1-option-list">
              {currentPinyinDrill.options.map((opt, idx) => {
                const picked = pinyinAnswers[pinyinIdx]
                const answered = picked !== undefined
                const isRight = answered && idx === currentPinyinDrill.answerIndex
                const isWrong = answered && picked === idx && idx !== currentPinyinDrill.answerIndex
                return (
                  <button
                    key={opt.zh}
                    type="button"
                    disabled={answered}
                    className={`hsk1-option-btn${isRight ? ' is-right' : ''}${isWrong ? ' is-wrong' : ''}`}
                    onClick={() => pickPinyinOption(idx)}
                  >
                    {opt.pinyin} ({opt.zh}) — {opt.meaning}
                  </button>
                )
              })}
            </div>
            {pinyinAnswers[pinyinIdx] !== undefined && (
              <div className="hsk1-tip-box">{currentPinyinDrill.explainId}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button
                type="button"
                className="hsk1-btn-ghost"
                disabled={pinyinIdx === 0}
                onClick={() => setPinyinIdx((i) => Math.max(0, i - 1))}
              >
                ‹ Sebelumnya
              </button>
              <button
                type="button"
                className="hsk1-btn-primary"
                onClick={() =>
                  pinyinIdx + 1 < HSK1_PINYIN_DRILLS.length ? setPinyinIdx((i) => i + 1) : onClose()
                }
              >
                {pinyinIdx + 1 < HSK1_PINYIN_DRILLS.length ? 'Soal Berikutnya ›' : 'Selesai Lab ✓'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function buildRecallDistractors(unit: Hsk1Unit, target: Hsk1Word): Hsk1Word[] {
  const others = unit.words.filter((w) => w.zh !== target.zh)
  const step = Math.max(1, Math.floor(others.length / 3))
  const picks = [others[0], others[step % others.length], others[(step * 2) % others.length]]
  const unique = [...new Set([target, ...picks].filter(Boolean))]
  return unique.sort((a, b) => a.zh.localeCompare(b.zh))
}

export function Hsk1SessionOverlay({
  unitNumber,
  onClose,
}: {
  unitNumber: number
  onClose: () => void
}) {
  const s = useStore()
  const unit = useMemo(
    () => HSK1_UNITS.find((u) => u.unit === unitNumber) ?? HSK1_UNITS[0],
    [unitNumber],
  )
  const [step, setStep] = useState<'vocab' | 'listen' | 'grammar' | 'recall' | 'summary'>('vocab')
  const [wordIdx, setWordIdx] = useState(0)
  const [listenIdx, setListenIdx] = useState(0)
  const [listenPick, setListenPick] = useState<string | null>(null)
  const [grammarAnswers, setGrammarAnswers] = useState<Record<string, string>>({})
  const [recallIdx, setRecallIdx] = useState(0)
  const [recallHintShown, setRecallHintShown] = useState(false)
  const [recallPick, setRecallPick] = useState<string | null>(null)
  const [provenWords, setProvenWords] = useState<string[]>([])
  const [summaryScore, setSummaryScore] = useState<number | null>(null)

  useEffect(() => () => stopSpeech(), [])

  const currentWord = unit.words[wordIdx] ?? unit.words[0]
  const listenWord = unit.words[listenIdx] ?? unit.words[0]
  const listenOptions = useMemo(() => buildRecallDistractors(unit, listenWord), [unit, listenWord])
  const recallWord = unit.words[recallIdx] ?? unit.words[0]
  const recallOptions = useMemo(() => buildRecallDistractors(unit, recallWord), [unit, recallWord])

  useEffect(() => {
    if (step === 'vocab' && currentWord) {
      s.encounterWord(currentWord.zh, 900 + unit.unit)
    }
  }, [step, currentWord, unit.unit, s])

  function handleListenAnswer(choice: Hsk1Word) {
    if (listenPick !== null) return
    setListenPick(choice.zh)
    const right = choice.zh === listenWord.zh
    s.recordRecall(listenWord.zh, { correct: right, mode: 'listening' })
    if (right) playCorrect()
    else playWrong()
  }

  function handleRecallAnswer(choice: Hsk1Word) {
    if (recallPick !== null) return
    setRecallPick(choice.zh)
    const right = choice.zh === recallWord.zh
    s.recordRecall(recallWord.zh, {
      correct: right,
      mode: 'recall',
      assisted: recallHintShown,
    })
    if (right && !recallHintShown) {
      setProvenWords((prev) => [...new Set([...prev, recallWord.zh])])
    }
    if (right) playCorrect()
    else playWrong()
  }

  function finishUnit(finalProven: string[]) {
    const grammarRight = unit.grammarQuiz.filter((q) => grammarAnswers[q.id] === q.answer).length
    const totalChecks = unit.words.length + unit.grammarQuiz.length
    const earned = finalProven.length + grammarRight
    const scorePct = Math.round((earned / Math.max(1, totalChecks)) * 100)

    s.addCards(
      900 + unit.unit,
      unit.words.map((w) => ({ zh: w.zh })),
    )
    recordHsk1UnitResult({
      unit: unit.unit,
      provenWords: finalProven,
      grammarCorrectCount: grammarRight,
      scorePct,
    })
    recordHistory({
      course: 'hsk1',
      kind: 'node',
      lesson: unit.unit,
      title: `HSK 1 Unit ${unit.unit}: ${unit.titleId}`,
      correct: scorePct >= 60,
      xp: scorePct,
    })
    s.logDrill(unit.words.length, 30)
    s.awardXp(scorePct >= 60 ? 55 : 25)
    playComplete()

    const me = getActiveCoupleId()
    const names = getCoupleNames()
    void postCoupleEvent({
      from: me,
      kind: 'milestone',
      text: `Menuntaskan HSK 1 Unit ${unit.unit} (${unit.titleId}) · ${finalProven.length}/10 kata murni (${scorePct}%)!`,
      names,
    })

    setSummaryScore(scorePct)
    setStep('summary')
  }

  return (
    <div className="hsk1-overlay" role="dialog" aria-modal="true" aria-label={`HSK 1 Unit ${unit.unit}`}>
      <header className="hsk1-overlay-head">
        <div>
          <strong>
            Unit {unit.unit}/15 · {unit.titleId}
          </strong>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {unit.titleZh} · {unit.focusTip}
          </div>
        </div>
        <button type="button" className="hsk1-btn-ghost" onClick={onClose}>
          Tutup ✕
        </button>
      </header>

      <main className="hsk1-overlay-body">
        <div className="hsk1-stage-tabs">
          <span className={`hsk1-stage-tab${step === 'vocab' ? ' is-active' : ''}`}>1. Kenali</span>
          <span className={`hsk1-stage-tab${step === 'listen' ? ' is-active' : ''}`}>2. Dengar</span>
          <span className={`hsk1-stage-tab${step === 'grammar' ? ' is-active' : ''}`}>3. Grammar</span>
          <span className={`hsk1-stage-tab${step === 'recall' ? ' is-active' : ''}`}>4. Uji Ingatan</span>
        </div>

        {step === 'vocab' && currentWord && (
          <>
            <div className="hsk1-card">
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>
                Kata {wordIdx + 1} dari {unit.words.length}
              </div>
              <div className="hsk1-big-hanzi" lang="zh-CN">
                {currentWord.zh}
              </div>
              <div className="hsk1-pinyin-line">{currentWord.pinyin}</div>
              <div className="hsk1-meaning-line">{currentWord.meaningId}</div>
              <button
                type="button"
                className="hsk1-audio-btn"
                onClick={() => void speak(currentWord.zh)}
              >
                🔊 Dengar Pengucapan
              </button>
              <div className="hsk1-tip-box">
                <strong>Cara Ingat Cepat:</strong> {currentWord.literalTip}
              </div>
              <div style={{ paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }} lang="zh-CN">
                  {currentWord.exampleZh}
                </div>
                <div style={{ fontSize: 13, color: '#be185d', fontWeight: 700 }}>
                  {currentWord.examplePinyin}
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>{currentWord.exampleId}</div>
                <button
                  type="button"
                  className="hsk1-btn-ghost"
                  style={{ marginTop: 8, minHeight: 36 }}
                  onClick={() => void speak(currentWord.exampleZh)}
                >
                  🔊 Putar Contoh Kalimat
                </button>
              </div>
            </div>

            {wordIdx === unit.words.length - 1 && (
              <div className="hsk1-card">
                <strong>Dialog Mini Unit {unit.unit}</strong>
                {unit.dialogue.map((line, i) => (
                  <div key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                    <strong style={{ color: '#0f766e' }}>{line.speaker}:</strong>{' '}
                    <span lang="zh-CN" style={{ fontWeight: 800 }}>{line.zh}</span>{' '}
                    <span style={{ color: '#be185d' }}>({line.pinyin})</span>
                    <div style={{ color: '#475569' }}>{line.id}</div>
                  </div>
                ))}
                <button
                  type="button"
                  className="hsk1-btn-ghost"
                  onClick={() => void speak(unit.dialogue.map((d) => d.zh).join(' '))}
                >
                  🔊 Dengarkan Dialog Lengkap
                </button>
              </div>
            )}
          </>
        )}

        {step === 'listen' && listenWord && (
          <div className="hsk1-card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>
                Latihan Dengar Tanpa Pinyin ({listenIdx + 1}/{unit.words.length})
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: '#475569' }}>
              Putar audio lalu pilih karakter & arti yang kamu dengar:
            </p>
            <button
              type="button"
              className="hsk1-audio-btn"
              onClick={() => void speak(listenWord.zh)}
            >
              🔊 Putar Audio Kata
            </button>
            <div className="hsk1-option-list">
              {listenOptions.map((opt) => {
                const answered = listenPick !== null
                const isRight = answered && opt.zh === listenWord.zh
                const isWrong = answered && listenPick === opt.zh && opt.zh !== listenWord.zh
                return (
                  <button
                    key={opt.zh}
                    type="button"
                    disabled={answered}
                    className={`hsk1-option-btn${isRight ? ' is-right' : ''}${isWrong ? ' is-wrong' : ''}`}
                    onClick={() => handleListenAnswer(opt)}
                  >
                    <span lang="zh-CN" style={{ fontSize: 18, marginRight: 8 }}>
                      {opt.zh}
                    </span>
                    {opt.meaningId}
                  </button>
                )
              })}
            </div>
            {listenPick !== null && (
              <div className="hsk1-tip-box">
                <strong>
                  {listenWord.zh} ({listenWord.pinyin})
                </strong>{' '}
                = {listenWord.meaningId}
              </div>
            )}
          </div>
        )}

        {step === 'grammar' && (
          <>
            <div className="hsk1-card">
              <div style={{ fontSize: 11, fontWeight: 900, color: '#0f766e', letterSpacing: '0.06em' }}>
                POLA GRAMMAR INTI
              </div>
              <strong style={{ fontSize: 17 }}>{unit.grammar.titleId}</strong>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#be185d' }}>{unit.grammar.pattern}</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: '#334155' }}>
                {unit.grammar.explainId}
              </p>
              {unit.grammar.examples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  className="hsk1-btn-ghost"
                  style={{ textAlign: 'left', height: 'auto', padding: '8px 12px' }}
                  onClick={() => void speak(ex.zh)}
                >
                  🔊 <strong lang="zh-CN">{ex.zh}</strong> · {ex.pinyin} — {ex.id}
                </button>
              ))}
            </div>

            {unit.grammarQuiz.map((q, qi) => {
              const picked = grammarAnswers[q.id]
              const answered = picked !== undefined
              return (
                <div key={q.id} className="hsk1-card">
                  <strong>
                    Kuis Grammar {qi + 1}/{unit.grammarQuiz.length}
                  </strong>
                  <p style={{ margin: 0, fontSize: 13.5 }}>{q.promptId}</p>
                  <div style={{ fontSize: 18, fontWeight: 800 }} lang="zh-CN">
                    {q.sentence}
                  </div>
                  <div className="hsk1-option-list">
                    {q.options.map((opt) => {
                      const isRight = answered && opt === q.answer
                      const isWrong = answered && picked === opt && opt !== q.answer
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={answered}
                          className={`hsk1-option-btn${isRight ? ' is-right' : ''}${isWrong ? ' is-wrong' : ''}`}
                          onClick={() => {
                            setGrammarAnswers((prev) => ({ ...prev, [q.id]: opt }))
                            if (opt === q.answer) playCorrect()
                            else playWrong()
                          }}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                  {answered && <div className="hsk1-tip-box">{q.explainId}</div>}
                </div>
              )
            })}
          </>
        )}

        {step === 'recall' && recallWord && (
          <div className="hsk1-card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>
                Ujian Ingatan Murni ({recallIdx + 1}/{unit.words.length})
              </strong>
              <span style={{ fontSize: 12, color: '#0f766e', fontWeight: 800 }}>
                Terbukti: {provenWords.length} kata
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: '#475569' }}>
              Arti bahasa Indonesia berikut ini berbunyi dan berkarakter Mandarin yang mana?
            </p>
            <div className="hsk1-meaning-line" style={{ fontSize: 22, padding: '8px 0' }}>
              "{recallWord.meaningId}"
            </div>
            {recallHintShown ? (
              <div className="hsk1-tip-box">Petunjuk Pinyin: {recallWord.pinyin}</div>
            ) : (
              <button
                type="button"
                className="hsk1-btn-ghost"
                style={{ alignSelf: 'flex-start', minHeight: 36 }}
                onClick={() => setRecallHintShown(true)}
              >
                Tampilkan Petunjuk Pinyin (tidak dihitung murni)
              </button>
            )}
            <div className="hsk1-option-list">
              {recallOptions.map((opt) => {
                const answered = recallPick !== null
                const isRight = answered && opt.zh === recallWord.zh
                const isWrong = answered && recallPick === opt.zh && opt.zh !== recallWord.zh
                return (
                  <button
                    key={opt.zh}
                    type="button"
                    disabled={answered}
                    className={`hsk1-option-btn${isRight ? ' is-right' : ''}${isWrong ? ' is-wrong' : ''}`}
                    onClick={() => handleRecallAnswer(opt)}
                  >
                    <span lang="zh-CN" style={{ fontSize: 20 }}>
                      {opt.zh}
                    </span>
                  </button>
                )
              })}
            </div>
            {recallPick !== null && (
              <div className="hsk1-tip-box">
                <strong>
                  {recallWord.zh} ({recallWord.pinyin})
                </strong>{' '}
                — {recallWord.exampleZh} ({recallWord.exampleId})
              </div>
            )}
          </div>
        )}

        {step === 'summary' && (
          <div className="hsk1-card" style={{ textAlign: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f766e' }}>UNIT {unit.unit} SELESAI</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#0f172a' }}>{summaryScore ?? 0}%</div>
            <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.5 }}>
              Kamu membuktikan <strong>{provenWords.length} kata HSK 1 tanpa bantuan hint</strong> dan
              menambahkan semua kata ke jadwal ulasan memori!
            </p>
            <button type="button" className="hsk1-btn-primary" onClick={onClose}>
              Kembali & Cek Evolusi Beast ›
            </button>
          </div>
        )}
      </main>

      {step !== 'summary' && (
        <footer className="hsk1-overlay-foot">
          {step === 'vocab' && (
            <>
              <button
                type="button"
                className="hsk1-btn-ghost"
                disabled={wordIdx === 0}
                onClick={() => setWordIdx((i) => Math.max(0, i - 1))}
              >
                ‹ Sebelumnya
              </button>
              <button
                type="button"
                className="hsk1-btn-primary"
                onClick={() => {
                  if (wordIdx + 1 < unit.words.length) setWordIdx((i) => i + 1)
                  else {
                    setListenIdx(0)
                    setListenPick(null)
                    setStep('listen')
                  }
                }}
              >
                {wordIdx + 1 < unit.words.length ? 'Kata Berikutnya ›' : 'Lanjut ke Tes Dengar ›'}
              </button>
            </>
          )}

          {step === 'listen' && (
            <>
              <button type="button" className="hsk1-btn-ghost" onClick={() => setStep('vocab')}>
                ‹ Ulangi Kata
              </button>
              <button
                type="button"
                className="hsk1-btn-primary"
                disabled={listenPick === null}
                onClick={() => {
                  if (listenIdx + 1 < unit.words.length) {
                    setListenIdx((i) => i + 1)
                    setListenPick(null)
                  } else {
                    setStep('grammar')
                  }
                }}
              >
                {listenIdx + 1 < unit.words.length ? 'Audio Berikutnya ›' : 'Lanjut ke Grammar ›'}
              </button>
            </>
          )}

          {step === 'grammar' && (
            <>
              <button type="button" className="hsk1-btn-ghost" onClick={() => setStep('listen')}>
                ‹ Kembali
              </button>
              <button
                type="button"
                className="hsk1-btn-primary"
                disabled={!unit.grammarQuiz.every((q) => grammarAnswers[q.id] !== undefined)}
                onClick={() => {
                  setRecallIdx(0)
                  setRecallHintShown(false)
                  setRecallPick(null)
                  setStep('recall')
                }}
              >
                Mulai Ujian Ingatan ›
              </button>
            </>
          )}

          {step === 'recall' && (
            <>
              <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
                Langkah {recallIdx + 1} / {unit.words.length}
              </span>
              <button
                type="button"
                className="hsk1-btn-primary"
                disabled={recallPick === null}
                onClick={() => {
                  if (recallIdx + 1 < unit.words.length) {
                    setRecallIdx((i) => i + 1)
                    setRecallHintShown(false)
                    setRecallPick(null)
                  } else {
                    finishUnit(provenWords)
                  }
                }}
              >
                {recallIdx + 1 < unit.words.length ? 'Soal Berikutnya ›' : 'Selesaikan Unit ✓'}
              </button>
            </>
          )}
        </footer>
      )}
    </div>
  )
}
