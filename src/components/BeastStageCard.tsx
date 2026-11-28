import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CLOUD_HYDRATED_EVENT, LOCAL_PROGRESS_EVENT } from '../lib/autoSync'
import {
  describeBeastUnlockState,
  evaluateBeastProgress,
  getBeastForMember,
  getTrainerAssetSrc,
  LEGENDARY_BEASTS,
  type BeastTrack,
  type Hsk1ProgressInput,
} from '../lib/beastEngine'
import {
  readBeastPrefs,
  requestBeastReveal,
  subscribeBeastPrefs,
  writeBeastPrefs,
} from '../lib/beastPrefs'
import { playBeastTapChime } from '../lib/beastSound'
import {
  BEAST_STAGES,
  FREE_BEAST_STAGE_IDS,
  getBeastStage,
  RARITY_TAG,
  type BeastStageId,
} from '../lib/beastStages'
import { useCoupleProfile } from '../lib/coupleProfile'
import { readHsk1Progress, subscribeHsk1Progress } from '../lib/hsk1'
import { readHistory, type HistoryEvent } from '../lib/history'
import { dayKey, useStore } from '../store/store'
import { ChevronDown, ChevronLeft, ChevronRight, SparklesIcon } from './Icons'
import { SealedBeastSilhouette } from './SealedBeastSilhouette'
import '../styles/beast-stage.css'

export function BeastStageCard({
  track,
  hsk1Progress,
  primaryCtaLabel,
  onReview,
  onLearn,
  onExam,
}: {
  track?: BeastTrack
  hsk1Progress?: Hsk1ProgressInput
  primaryCtaLabel?: string
  onReview?: () => void
  onLearn?: () => void
  onExam?: () => void
}) {
  const s = useStore()
  const { activeId, member } = useCoupleProfile()
  const resolvedTrack = track ?? member.track
  const [localHsk1, setLocalHsk1] = useState(readHsk1Progress)
  const effectiveHsk1 = hsk1Progress ?? localHsk1
  const [prefs, setPrefs] = useState(readBeastPrefs)
  const [history, setHistory] = useState<HistoryEvent[]>(() => readHistory())
  const [peekLevel, setPeekLevel] = useState<number | null>(null)
  const [bubbleText, setBubbleText] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'tips' | 'quests' | 'vars'>('tips')
  const [quoteCycle, setQuoteCycle] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    setPeekLevel(null)
    setBubbleText(null)
    setDetailsOpen(false)
    setPickerOpen(false)
    setPrefs(readBeastPrefs())
    setHistory(readHistory())
  }, [activeId])

  useEffect(() => {
    const refreshHistory = () => setHistory(readHistory())
    window.addEventListener(LOCAL_PROGRESS_EVENT, refreshHistory)
    window.addEventListener(CLOUD_HYDRATED_EVENT, refreshHistory)
    const unsubPrefs = subscribeBeastPrefs((next) => setPrefs(next))
    const unsubHsk1 = subscribeHsk1Progress((next) => setLocalHsk1(next))
    return () => {
      window.removeEventListener(LOCAL_PROGRESS_EVENT, refreshHistory)
      window.removeEventListener(CLOUD_HYDRATED_EVENT, refreshHistory)
      unsubPrefs()
      unsubHsk1()
    }
  }, [])

  const evalRes = useMemo(
    () =>
      evaluateBeastProgress({
        track: resolvedTrack,
        mastery: s.mastery,
        cards: s.cards,
        lessonsDone: s.lessonsDone,
        pathDone: s.pathDone,
        streak: s.streak,
        xp: s.xp,
        log: s.log,
        history,
        learnerGraph: s.learnerGraph,
        hsk1Progress: effectiveHsk1,
        todayKey: dayKey(),
        nowMs: Date.now(),
      }),
    [
      resolvedTrack,
      s.mastery,
      s.cards,
      s.lessonsDone,
      s.pathDone,
      s.streak,
      s.xp,
      s.log,
      history,
      s.learnerGraph,
      effectiveHsk1,
    ],
  )

  const activeStageId: BeastStageId = evalRes.unlockedStageIds.includes(prefs.stageId)
    ? prefs.stageId
    : BEAST_STAGES[0].id
  const activeStage = getBeastStage(activeStageId)

  const shownLevel = peekLevel ?? evalRes.level
  const shownBeast = getBeastForMember(
    LEGENDARY_BEASTS[Math.max(0, Math.min(LEGENDARY_BEASTS.length - 1, shownLevel - 1))],
    activeId,
  )
  const isLockedPreview = shownBeast.level > evalRes.level
  const assetSrc = getTrainerAssetSrc(shownBeast, activeId)
  const unlockState = useMemo(() => describeBeastUnlockState(evalRes, shownBeast), [evalRes, shownBeast])

  const quickSwatches = useMemo(() => {
    const unlockedExtras = BEAST_STAGES.filter(
      (st) => st.achievementKey && evalRes.unlockedStageIds.includes(st.id),
    )
    const starters = BEAST_STAGES.filter((st) => FREE_BEAST_STAGE_IDS.includes(st.id))
    return [...starters, ...unlockedExtras]
  }, [evalRes.unlockedStageIds])

  const cardVars = useMemo(
    () =>
      ({
        '--stage-foil': activeStage.foilGradient,
        '--stage-bg': activeStage.previewGradient,
        '--stage-accent-soft': `${activeStage.accent}20`,
      }) as CSSProperties,
    [activeStage],
  )

  function handleBeastTap() {
    if (!prefs.revealMuted) playBeastTapChime()
    if (isLockedPreview) {
      setBubbleText(unlockState.headlineSentence)
      return
    }
    const q = shownBeast.quotes[quoteCycle % shownBeast.quotes.length]
    setQuoteCycle((n) => n + 1)
    setBubbleText(q)
  }

  const defaultPrimaryCta =
    resolvedTrack === 'hsk1'
      ? 'Mulai Belajar HSK 1 (+140 XP)'
      : 'Mulai Sesi Berikutnya (+150 XP)'

  return (
    <section className="beast-stage-wrap" aria-label="Arena Trainer dan Partner">
      <div className="beast-card-shell" data-foil={activeStage.foilStyle} data-stage-id={activeStage.id} style={cardVars}>
        <div className="beast-card-canvas">
          <div className="beast-card-texture" aria-hidden="true" />

          {/* 1. Header Minimal: 2 indikator tenang */}
          <div className="beast-hud-bar">
            <span className="beast-lvl-tag">
              {isLockedPreview ? `Lv ${shownBeast.level} · Terkunci` : `Lv ${evalRes.level} · ${evalRes.beast.stageLabel}`}
            </span>
            <div className="beast-hud-actions">
              {isLockedPreview ? (
                <button
                  type="button"
                  className="beast-chip-btn"
                  onClick={() => {
                    setPeekLevel(null)
                    setBubbleText(null)
                  }}
                >
                  Kembali ke Lv {evalRes.level}
                </button>
              ) : (
                <button
                  type="button"
                  className="beast-chip-btn reveal"
                  onClick={() =>
                    requestBeastReveal({
                      beast: shownBeast,
                      stage: activeStage,
                      reason: 'replay',
                      spiritPower: evalRes.spiritPower,
                      nextTargetXp: evalRes.nextBeast ? evalRes.powerToNext : 0,
                    })
                  }
                >
                  <SparklesIcon size={13} />
                  <span>Reveal</span>
                </button>
              )}
              <span className="beast-page-count" aria-label={`Halaman ${shownBeast.level} dari ${LEGENDARY_BEASTS.length}`}>
                {shownBeast.level} / {LEGENDARY_BEASTS.length}
              </span>
            </div>
          </div>

          {/* 2. Visual HD Centerpiece (Bebas stiker menumpuk) */}
          <div className="beast-arena-box">
            <div className="beast-peek-row">
              <button
                type="button"
                className="beast-nav-btn"
                disabled={shownBeast.level <= 1}
                onClick={() => {
                  setBubbleText(null)
                  setPeekLevel(Math.max(1, shownBeast.level - 1))
                }}
                aria-label="Evolusi sebelumnya"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                className="beast-figure-hit"
                onClick={handleBeastTap}
                aria-label={isLockedPreview ? `Wujud Rahasia Lv ${shownBeast.level}` : `Sentuh ${member.name} & ${shownBeast.name}`}
              >
                {isLockedPreview ? (
                  <>
                    <div className="beast-locked-backlight" aria-hidden="true" />
                    <div className="beast-locked-sparkles" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </>
                ) : (
                  <div className="beast-aura-halo" aria-hidden="true" />
                )}
                <div className="beast-pedestal" aria-hidden="true" />
                {isLockedPreview ? (
                  <SealedBeastSilhouette
                    key={`locked-${activeId}-${shownBeast.level}`}
                    src={assetSrc}
                    level={shownBeast.level}
                    memberId={activeId}
                    accentHex={shownBeast.accentHex}
                    className="beast-figure-canvas"
                    animateFloat
                  />
                ) : (
                  <img
                    key={`unlocked-${activeId}-${shownBeast.level}`}
                    className="beast-figure-img"
                    src={assetSrc}
                    alt={`${member.name} · ${shownBeast.name}`}
                    onError={(e) => {
                      e.currentTarget.src = '/beasts/v1/beast-02-qilin.webp'
                    }}
                  />
                )}
              </button>

              <button
                type="button"
                className="beast-nav-btn"
                disabled={shownBeast.level >= LEGENDARY_BEASTS.length}
                onClick={() => {
                  setBubbleText(null)
                  setPeekLevel(Math.min(LEGENDARY_BEASTS.length, shownBeast.level + 1))
                }}
                aria-label="Evolusi berikutnya"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {bubbleText && <div className="beast-bubble reveal-fade-in">{bubbleText}</div>}
          </div>

          {/* 3. Judul, 1 Progress Bar Konsisten & Kalimat Tunggal Yang Jelas */}
          <div className="beast-info-panel">
            <div className="beast-title-block">
              <div className="beast-name-line">
                <span className="beast-zh-big" lang={isLockedPreview ? undefined : 'zh-CN'}>
                  {isLockedPreview ? `Wujud Rahasia Lv ${shownBeast.level}` : shownBeast.zhName}
                </span>
                {!isLockedPreview && <span className="beast-en-sub">{shownBeast.name}</span>}
              </div>
              <div className="beast-trainer-meta">
                {isLockedPreview
                  ? `Tahap ${shownBeast.stageLabel} · Terbuka saat XP Evolusi terpenuhi`
                  : `${member.name} · ${shownBeast.trainerTitle}`}
              </div>
            </div>

            <div className="beast-unlock-block">
              <div className="beast-power-meta">
                <span>{unlockState.counterLabel}</span>
                <span className="beast-power-status">{unlockState.statusTag}</span>
              </div>
              <div className="beast-power-track" aria-label="Progres evolusi">
                <div className="beast-power-fill" style={{ width: `${unlockState.progressPct}%` }} />
              </div>
              <p className="beast-next-sentence">{unlockState.headlineSentence}</p>
            </div>

            {/* 4. Satu Aksi Utama + Pemicu Progressive Disclosure */}
            {onLearn && (
              <button type="button" className="beast-primary-cta" onClick={onLearn}>
                <span>{primaryCtaLabel ?? defaultPrimaryCta}</span>
                <span aria-hidden="true">→</span>
              </button>
            )}

            <button
              type="button"
              className="beast-disclosure-trigger"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <span>Detail progres, cara dapat XP & tema</span>
              <ChevronDown size={16} className={detailsOpen ? 'is-flipped' : undefined} />
            </button>

            {detailsOpen && (
              <div className="beast-drawer-sheet reveal-fade-in">
                <div className="beast-drawer-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === 'tips'}
                    className={`beast-tool-btn${drawerTab === 'tips' ? ' is-active' : ''}`}
                    onClick={() => setDrawerTab('tips')}
                  >
                    Cara Dapat XP
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === 'quests'}
                    className={`beast-tool-btn${drawerTab === 'quests' ? ' is-active' : ''}`}
                    onClick={() => setDrawerTab('quests')}
                  >
                    Misi Harian ({evalRes.questsDoneCount}/3)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === 'vars'}
                    className={`beast-tool-btn${drawerTab === 'vars' ? ' is-active' : ''}`}
                    onClick={() => setDrawerTab('vars')}
                  >
                    6 Pilar ({evalRes.retentionPct}%)
                  </button>
                </div>

                {drawerTab === 'tips' && (
                  <div className="beast-tips-grid">
                    {unlockState.howToEarnTips.map((tip) => (
                      <div key={tip.label} className="beast-var-card">
                        <div className="beast-var-top">
                          <span>{tip.label}</span>
                          <span>{tip.reward}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {drawerTab === 'quests' && (
                  <div className="beast-quests-list">
                    {evalRes.quests.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        className={`beast-quest-btn${q.done ? ' is-done' : ''}`}
                        onClick={() => (q.action === 'review' ? onReview?.() : q.action === 'exam' ? onExam?.() : onLearn?.())}
                      >
                        <span className="beast-quest-title">
                          {q.done ? '✓ ' : '○ '}
                          {q.title}
                        </span>
                        <span className="beast-quest-prog">
                          {q.progress}/{q.target}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {drawerTab === 'vars' && (
                  <div className="beast-vars-grid">
                    {evalRes.variables.map((v) => (
                      <div key={v.key} className="beast-var-card">
                        <div className="beast-var-top">
                          <span>{v.label}</span>
                          <span>+{v.power} XP</span>
                        </div>
                        <div className="beast-var-val">{v.valueText}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="beast-drawer-theme-row">
                  <div className="beast-swatches-mini" aria-label="Pilih Latar Kartu">
                    {quickSwatches.slice(0, 5).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        title={st.name}
                        aria-label={st.name}
                        className={`beast-dot-btn${activeStage.id === st.id ? ' is-active' : ''}`}
                        style={{ background: st.previewGradient }}
                        onClick={() => writeBeastPrefs({ stageId: st.id })}
                      />
                    ))}
                  </div>
                  <button type="button" className="beast-tool-btn" onClick={() => setPickerOpen(true)}>
                    Koleksi Latar ({evalRes.unlockedStageIds.length}/{BEAST_STAGES.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {pickerOpen && (
        <div
          className="beast-picker-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Pilih Latar Kartu Kolektor"
          onClick={() => setPickerOpen(false)}
        >
          <div className="beast-picker-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="beast-picker-head">
              <div>
                <strong>
                  Koleksi Kartu Stage ({evalRes.unlockedStageIds.length}/{BEAST_STAGES.length})
                </strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {FREE_BEAST_STAGE_IDS.length} starter aktif ·{' '}
                  {BEAST_STAGES.length - FREE_BEAST_STAGE_IDS.length} kartu terbuka dari pencapaian HSK nyata
                </div>
              </div>
              <button type="button" className="beast-chip-btn" onClick={() => setPickerOpen(false)}>
                Tutup
              </button>
            </div>
            <div className="beast-picker-grid">
              {BEAST_STAGES.map((st) => {
                const unlocked = evalRes.unlockedStageIds.includes(st.id)
                const isSelected = activeStage.id === st.id
                return (
                  <button
                    key={st.id}
                    type="button"
                    disabled={!unlocked}
                    className={`beast-stage-option${isSelected ? ' is-active' : ''}${!unlocked ? ' is-locked' : ''}`}
                    onClick={() => {
                      writeBeastPrefs({ stageId: st.id })
                      setPickerOpen(false)
                    }}
                  >
                    <div className="beast-stage-preview" style={{ background: st.previewGradient }}>
                      <span>{st.cardCode}</span>
                      <span>{unlocked ? RARITY_TAG[st.rarity] : '🔒'}</span>
                    </div>
                    <div className="beast-stage-name">{st.name}</div>
                    <div className="beast-stage-desc">{st.tagline}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
