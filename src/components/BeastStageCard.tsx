import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CLOUD_HYDRATED_EVENT, LOCAL_PROGRESS_EVENT } from '../lib/autoSync'
import {
  evaluateBeastProgress,
  getBeastMinPower,
  LEGENDARY_BEASTS,
  type BeastTrack,
  type Hsk1ProgressInput,
} from '../lib/beastEngine'
import { useCoupleProfile } from '../lib/coupleProfile'
import { postCoupleEvent } from '../lib/coupleSync'
import { readHsk1Progress, subscribeHsk1Progress } from '../lib/hsk1'
import {
  readBeastPrefs,
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
import { readHistory, type HistoryEvent } from '../lib/history'
import { dayKey, useStore } from '../store/store'
import { BeastRevealOverlay, type BeastRevealPayload } from './BeastRevealOverlay'
import '../styles/beast-stage.css'

export function BeastStageCard({
  track,
  hsk1Progress,
  onReview,
  onLearn,
  onExam,
}: {
  track?: BeastTrack
  hsk1Progress?: Hsk1ProgressInput
  onReview?: () => void
  onLearn?: () => void
  onExam?: () => void
}) {
  const s = useStore()
  const { activeId, member, names } = useCoupleProfile()
  const resolvedTrack = track ?? member.track
  const [localHsk1, setLocalHsk1] = useState(readHsk1Progress)
  const effectiveHsk1 = hsk1Progress ?? localHsk1
  const [prefs, setPrefs] = useState(readBeastPrefs)
  const [history, setHistory] = useState<HistoryEvent[]>(() => readHistory())
  const [peekLevel, setPeekLevel] = useState<number | null>(null)
  const [bubbleText, setBubbleText] = useState<string | null>(null)
  const [quoteCycle, setQuoteCycle] = useState(0)
  const [showVars, setShowVars] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [revealPayload, setRevealPayload] = useState<BeastRevealPayload | null>(null)

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

  // Ensure selected stage is valid & unlocked; otherwise fall back cleanly to default
  const activeStageId: BeastStageId = evalRes.unlockedStageIds.includes(prefs.stageId)
    ? prefs.stageId
    : BEAST_STAGES[0].id
  const activeStage = getBeastStage(activeStageId)

  // Auto-trigger Legendary Reveal on level-up OR newly earned card unlock
  useEffect(() => {
    const newAchievement = evalRes.unlockedAchievementKeys.find(
      (k) => !prefs.earnedAchievementKeys.includes(k),
    )
    if (evalRes.level > prefs.lastSeenLevel) {
      const upgradedStage = activeStage
      writeBeastPrefs({
        lastSeenLevel: evalRes.level,
        earnedAchievementKeys: evalRes.unlockedAchievementKeys,
      })
      void postCoupleEvent({
        from: activeId,
        kind: 'evolution',
        text: `Berevolusi ke Lv ${evalRes.level}/24: ${evalRes.beast.zhName} (${evalRes.beast.name})!`,
        beastLevel: evalRes.level,
        names,
      })
      setRevealPayload({
        beast: evalRes.beast,
        stage: upgradedStage,
        reason: 'evolution',
        headline: `EVOLUSI LV ${evalRes.level}/24: ${evalRes.beast.zhName}`,
        spiritPower: evalRes.spiritPower,
      })
      return
    }
    if (newAchievement) {
      const unlockedStage = BEAST_STAGES.find((st) => st.achievementKey === newAchievement) ?? activeStage
      writeBeastPrefs({
        earnedAchievementKeys: evalRes.unlockedAchievementKeys,
        stageId: unlockedStage.id,
      })
      setRevealPayload({
        beast: evalRes.beast,
        stage: unlockedStage,
        reason: 'card',
        headline: `KARTU BARU: ${unlockedStage.name}`,
        spiritPower: evalRes.spiritPower,
      })
    }
  }, [
    evalRes.level,
    evalRes.beast,
    evalRes.spiritPower,
    evalRes.unlockedAchievementKeys,
    prefs.lastSeenLevel,
    prefs.earnedAchievementKeys,
    activeStage,
  ])

  const shownLevel = peekLevel ?? evalRes.level
  const shownBeast = LEGENDARY_BEASTS[Math.max(0, Math.min(LEGENDARY_BEASTS.length - 1, shownLevel - 1))]
  const isLockedPreview = shownBeast.level > evalRes.level

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
      }) as CSSProperties,
    [activeStage],
  )

  function handleBeastTap() {
    if (!prefs.revealMuted) playBeastTapChime()
    if (isLockedPreview) {
      const req = getBeastMinPower(shownBeast, resolvedTrack)
      setBubbleText(
        `Siluet Lv ${shownBeast.level} · ${shownBeast.zhName} (${shownBeast.name}) terbuka di ${req.toLocaleString()} 灵力!`,
      )
      return
    }
    const q = shownBeast.quotes[quoteCycle % shownBeast.quotes.length]
    setQuoteCycle((n) => n + 1)
    setBubbleText(q)
  }

  function handleQuestClick(action: 'review' | 'learn' | 'exam') {
    if (action === 'review') onReview?.()
    else if (action === 'exam') onExam?.()
    else onLearn?.()
  }

  return (
    <section className="beast-stage-wrap" aria-label="Pendamping Naga HSK">
      <div className="beast-card-shell" data-foil={activeStage.foilStyle} style={cardVars}>
        <div className="beast-card-canvas">
          <div className="beast-card-texture" aria-hidden="true" />

          <div className="beast-hud-bar">
            <div className="beast-hud-left">
              <span className="beast-lvl-tag">LV {evalRes.level}/24 · {evalRes.beast.element}</span>
              <span className="beast-flame-pill" data-tier={evalRes.flame.tier}>
                {evalRes.flame.badge} {evalRes.flame.label}
              </span>
            </div>
            <div className="beast-hud-actions">
              <button
                type="button"
                className="beast-chip-btn"
                onClick={() => setPickerOpen(true)}
              >
                Kartu ({evalRes.unlockedStageIds.length}/9)
              </button>
              <button
                type="button"
                className="beast-chip-btn reveal"
                onClick={() =>
                  setRevealPayload({
                    beast: isLockedPreview ? evalRes.beast : shownBeast,
                    stage: activeStage,
                    reason: 'replay',
                    spiritPower: evalRes.spiritPower,
                  })
                }
              >
                ✨ Reveal
              </button>
            </div>
          </div>

          <div className="beast-stage-grid">
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
                  ‹
                </button>

                <button
                  type="button"
                  className="beast-figure-hit"
                  onClick={handleBeastTap}
                  aria-label={`Sentuh ${shownBeast.name}`}
                >
                  <div className="beast-pedestal" aria-hidden="true" />
                  <img
                    className={`beast-figure-img${isLockedPreview ? ' is-locked' : ''}`}
                    src={shownBeast.imageSrc}
                    alt={isLockedPreview ? `Siluet ${shownBeast.name}` : `${shownBeast.zhName} ${shownBeast.name}`}
                  />
                  {isLockedPreview && (
                    <span className="beast-lock-pill">
                      Butuh {getBeastMinPower(shownBeast, resolvedTrack).toLocaleString()} 灵力
                    </span>
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
                  ›
                </button>
              </div>

              {bubbleText && <div className="beast-bubble">{bubbleText}</div>}
            </div>

            <div className="beast-info-panel">
              <div className="beast-name-line">
                <div>
                  <span className="beast-zh-big" lang="zh-CN">{shownBeast.zhName}</span>{' '}
                  <span className="beast-en-sub">{shownBeast.pinyin} · {shownBeast.name}</span>
                </div>
                <span className="beast-badge-code">
                  {activeStage.cardCode} {RARITY_TAG[activeStage.rarity]}
                </span>
              </div>

              <div>
                <div className="beast-power-meta">
                  <span>⚡ {evalRes.spiritPower.toLocaleString()} 灵力</span>
                  <span>
                    {evalRes.nextBeast
                      ? `-${evalRes.powerToNext.toLocaleString()} menuju ${evalRes.nextBeast.zhName}`
                      : 'Puncak 至尊金龙 Tercapai'}
                  </span>
                </div>
                <div className="beast-power-track" aria-label="Progress Spirit Power">
                  <div className="beast-power-fill" style={{ width: `${evalRes.progressPct}%` }} />
                </div>
                <div className="beast-retention-row">
                  <span>{evalRes.retentionLabel}</span>
                  <span>Retensi {evalRes.retentionPct}% ({evalRes.retentionMultiplier.toFixed(2)}×)</span>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {evalRes.benchmarkHint}
                </div>
              </div>

              <div className="beast-swatches-row" aria-label="Pilih Latar Kartu">
                {quickSwatches.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`beast-swatch${activeStage.id === st.id ? ' is-active' : ''}`}
                    onClick={() => writeBeastPrefs({ stageId: st.id })}
                  >
                    <span className="beast-swatch-dot" style={{ background: st.previewGradient }} />
                    <span>{st.name}</span>
                  </button>
                ))}
              </div>

              <div className="beast-quests-list">
                {evalRes.quests.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    className={`beast-quest-btn${q.done ? ' is-done' : ''}`}
                    onClick={() => handleQuestClick(q.action)}
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

              <button
                type="button"
                className="beast-drawer-toggle"
                aria-expanded={showVars}
                onClick={() => setShowVars((v) => !v)}
              >
                {showVars ? '▾ Sembunyikan 6 Variabel HSK' : '▸ Lihat Detail 6 Variabel Penentu Level HSK'}
              </button>

              {showVars && (
                <div className="beast-vars-grid">
                  {evalRes.variables.map((v) => (
                    <div key={v.key} className="beast-var-card">
                      <div className="beast-var-top">
                        <span>{v.label}</span>
                        <span>+{v.power} 灵力</span>
                      </div>
                      <div className="beast-var-val">{v.valueText}</div>
                      <div className="beast-var-sub">{v.subText}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                <strong>Koleksi Kartu Stage ({evalRes.unlockedStageIds.length}/9)</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  3 kartu starter langsung aktif · 6 kartu terbuka otomatis lewat pencapaian HSK
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
                      <span>{unlocked ? RARITY_TAG[st.rarity] : '🔒 TERKUNCI'}</span>
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

      <BeastRevealOverlay
        payload={revealPayload}
        muted={prefs.revealMuted}
        onToggleMute={() => writeBeastPrefs({ revealMuted: !prefs.revealMuted })}
        onClose={() => setRevealPayload(null)}
      />
    </section>
  )
}
