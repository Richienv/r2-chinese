import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CLOUD_HYDRATED_EVENT, LOCAL_PROGRESS_EVENT } from '../lib/autoSync'
import {
  evaluateBeastProgress,
  getBeastMinPower,
  getTrainerAssetSrc,
  LEGENDARY_BEASTS,
  type BeastTrack,
  type Hsk1ProgressInput,
} from '../lib/beastEngine'
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
import { useCoupleProfile } from '../lib/coupleProfile'
import { postCoupleEvent } from '../lib/coupleSync'
import { readHsk1Progress, subscribeHsk1Progress } from '../lib/hsk1'
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
  const [drawer, setDrawer] = useState<'none' | 'quests' | 'vars'>('none')
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

  const activeStageId: BeastStageId = evalRes.unlockedStageIds.includes(prefs.stageId)
    ? prefs.stageId
    : BEAST_STAGES[0].id
  const activeStage = getBeastStage(activeStageId)

  useEffect(() => {
    const newAchievement = evalRes.unlockedAchievementKeys.find(
      (k) => !prefs.earnedAchievementKeys.includes(k),
    )
    if (evalRes.level > prefs.lastSeenLevel) {
      writeBeastPrefs({
        lastSeenLevel: evalRes.level,
        earnedAchievementKeys: evalRes.unlockedAchievementKeys,
      })
      void postCoupleEvent({
        from: activeId,
        kind: 'evolution',
        text: `Naik Lv ${evalRes.level}/24 (${evalRes.beast.stageLabel}): ${evalRes.beast.zhName}!`,
        beastLevel: evalRes.level,
        names,
      })
      setRevealPayload({
        beast: evalRes.beast,
        stage: activeStage,
        reason: 'evolution',
        headline: `EVOLUSI LV ${evalRes.level}/24 · ${evalRes.beast.stageLabel.toUpperCase()}`,
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
    activeId,
    names,
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
  const assetSrc = getTrainerAssetSrc(shownBeast, activeId)

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
        '--stage-accent-soft': `${shownBeast.accentHex}33`,
      }) as CSSProperties,
    [activeStage, shownBeast.accentHex],
  )

  function handleBeastTap() {
    if (!prefs.revealMuted) playBeastTapChime()
    if (isLockedPreview) {
      const req = getBeastMinPower(shownBeast, resolvedTrack)
      setBubbleText(
        `Lv ${shownBeast.level} (${shownBeast.stageLabel}) · ${shownBeast.zhName} terbuka di ${req.toLocaleString()} 灵力!`,
      )
      return
    }
    const q = shownBeast.quotes[quoteCycle % shownBeast.quotes.length]
    setQuoteCycle((n) => n + 1)
    setBubbleText(q)
  }

  return (
    <section className="beast-stage-wrap" aria-label="Arena Trainer dan Beast">
      <div className="beast-card-shell" data-foil={activeStage.foilStyle} style={cardVars}>
        <div className="beast-card-canvas">
          <div className="beast-card-texture" aria-hidden="true" />

          <div className="beast-hud-bar">
            <div className="beast-hud-left">
              <span className="beast-lvl-tag">
                LV {evalRes.level}/24 · {evalRes.beast.stageLabel}
              </span>
              <span className="beast-flame-pill" data-tier={evalRes.flame.tier}>
                {evalRes.flame.badge}
              </span>
            </div>
            <div className="beast-hud-actions">
              <button type="button" className="beast-chip-btn" onClick={() => setPickerOpen(true)}>
                🎴 {evalRes.unlockedStageIds.length}/9
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
                aria-label={`Sentuh ${member.name} & ${shownBeast.name}`}
              >
                <div className="beast-aura-halo" aria-hidden="true" />
                <div className="beast-pedestal" aria-hidden="true" />
                <img
                  className={`beast-figure-img${isLockedPreview ? ' is-locked' : ''}`}
                  src={assetSrc}
                  alt={isLockedPreview ? `Siluet ${shownBeast.name}` : `${member.name} · ${shownBeast.name}`}
                  onError={(e) => {
                    e.currentTarget.src = '/beasts/v1/beast-02-qilin.webp'
                  }}
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
                <span className="beast-en-sub">{shownBeast.name}</span>
              </div>
              <span className="beast-tier-pill">
                Siklus {shownBeast.speciesIndex}/8 · {shownBeast.stageLabel.toUpperCase()}
              </span>
            </div>

            <div className="beast-trainer-meta">
              {member.name}: <strong>{shownBeast.trainerTitle}</strong> · {shownBeast.trainerAccessory}
            </div>

            <div>
              <div className="beast-power-meta">
                <span>⚡ {evalRes.spiritPower.toLocaleString()} 灵力</span>
                <span>
                  {evalRes.nextBeast
                    ? `-${evalRes.powerToNext.toLocaleString()} → ${evalRes.nextBeast.zhName}`
                    : 'Puncak Lv 24'}
                </span>
              </div>
              <div className="beast-power-track" aria-label="Progress Spirit Power">
                <div className="beast-power-fill" style={{ width: `${evalRes.progressPct}%` }} />
              </div>
            </div>

            <div className="beast-compact-tools">
              <div className="beast-tool-tabs">
                <button
                  type="button"
                  className={`beast-tool-btn${drawer === 'quests' ? ' is-active' : ''}`}
                  onClick={() => setDrawer((d) => (d === 'quests' ? 'none' : 'quests'))}
                >
                  🎯 Misi {evalRes.questsDoneCount}/3
                </button>
                <button
                  type="button"
                  className={`beast-tool-btn${drawer === 'vars' ? ' is-active' : ''}`}
                  onClick={() => setDrawer((d) => (d === 'vars' ? 'none' : 'vars'))}
                >
                  📊 6 Variabel ({evalRes.retentionPct}%)
                </button>
              </div>
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
            </div>

            {drawer === 'quests' && (
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

            {drawer === 'vars' && (
              <div className="beast-vars-grid">
                {evalRes.variables.map((v) => (
                  <div key={v.key} className="beast-var-card">
                    <div className="beast-var-top">
                      <span>{v.label}</span>
                      <span>+{v.power} 灵力</span>
                    </div>
                    <div className="beast-var-val">{v.valueText}</div>
                  </div>
                ))}
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
                <strong>Koleksi Kartu Stage ({evalRes.unlockedStageIds.length}/9)</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  3 starter aktif · 6 kartu terbuka dari pencapaian HSK nyata
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

      <BeastRevealOverlay
        payload={revealPayload}
        muted={prefs.revealMuted}
        onToggleMute={() => writeBeastPrefs({ revealMuted: !prefs.revealMuted })}
        onClose={() => setRevealPayload(null)}
      />
    </section>
  )
}
