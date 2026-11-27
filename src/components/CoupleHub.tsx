import { useCallback, useEffect, useState } from 'react'
import { evaluateBeastProgress, getTrainerAssetSrc, LEGENDARY_BEASTS } from '../lib/beastEngine'
import { lockCoupleGate } from '../lib/coupleAuth'
import { COUPLE_MEMBERS, getPartnerId, switchCoupleWorkspace, useCoupleProfile } from '../lib/coupleProfile'
import {
  countUnreadPartnerEvents,
  fetchCoupleFeed,
  fetchPartnerSnapshot,
  type CoupleEvent,
  type PartnerSnapshot,
} from '../lib/coupleSync'
import { readHsk1Progress } from '../lib/hsk1'
import { readHistory } from '../lib/history'
import { dayKey, useStore } from '../store/store'
import { CoupleComparePanel } from './CoupleComparePanel'
import '../styles/couple-hub.css'

export function CoupleHub({ openSheetExternal, onCloseExternal }: { openSheetExternal?: boolean; onCloseExternal?: () => void }) {
  const s = useStore()
  const { activeId, member, partner, names } = useCoupleProfile()
  const [partnerSnap, setPartnerSnap] = useState<PartnerSnapshot | null>(null)
  const [feed, setFeed] = useState<CoupleEvent[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)

  const effectiveOpen = sheetOpen || Boolean(openSheetExternal)
  const closeSheet = () => {
    setSheetOpen(false)
    onCloseExternal?.()
  }

  const refresh = useCallback(async () => {
    const [snap, shared] = await Promise.all([
      fetchPartnerSnapshot(getPartnerId(activeId)),
      fetchCoupleFeed(),
    ])
    if (snap) setPartnerSnap(snap)
    setFeed(shared.events)
  }, [activeId])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  // Ensure current evaluation updates live cleanly
  const myLevel = evaluateBeastProgress({
    track: member.track,
    mastery: s.mastery,
    cards: s.cards,
    lessonsDone: s.lessonsDone,
    pathDone: s.pathDone,
    streak: s.streak,
    xp: s.xp,
    log: s.log,
    history: readHistory(),
    learnerGraph: s.learnerGraph,
    hsk1Progress: readHsk1Progress(),
    todayKey: dayKey(),
    nowMs: Date.now(),
  }).level

  const unread = countUnreadPartnerEvents(feed, activeId)
  const partnerBeast = partnerSnap?.beast ?? LEGENDARY_BEASTS[0]
  const partnerSprite = getTrainerAssetSrc(partnerBeast, getPartnerId(activeId))

  return (
    <>
      <div className="ch-bar" aria-label="Akun Berdua & Partner">
        <div className="ch-pills" role="group" aria-label="Pilih Profil">
          {(['richie', 'renita'] as const).map((id) => {
            const active = activeId === id
            return (
              <button
                key={id}
                type="button"
                data-member={id}
                className={`ch-pill${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => switchCoupleWorkspace(id)}
              >
                <span>{names[id]}</span>
                <small>{COUPLE_MEMBERS[id].track === 'hsk4' ? 'HSK4' : 'HSK1'}</small>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="ch-partner-chip"
          title={`Anda Lv ${myLevel} · Klik untuk lihat ${partner.name} & Chat`}
          onClick={() => setSheetOpen(true)}
        >
          <img
            src={partnerSprite}
            alt=""
            className="ch-mini-sprite"
            onError={(e) => {
              e.currentTarget.src = '/beasts/v1/beast-02-qilin.webp'
            }}
          />
          <span>
            {partner.name} Lv{partnerSnap?.level ?? 1}
          </span>
          {unread > 0 && <span className="ch-unread">{unread}</span>}
        </button>

        <button
          type="button"
          className="ch-lock-btn"
          title="Kunci / Ganti Akun"
          aria-label="Kunci dan Ganti Akun"
          onClick={() => lockCoupleGate()}
        >
          🔐
        </button>
      </div>

      {effectiveOpen && (
        <div
          className="beast-picker-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Perbandingan & Chat Berdua"
          onClick={closeSheet}
        >
          <div className="beast-picker-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="beast-picker-head">
              <div>
                <strong>Richie & Renita · Progress & Chat</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Bandingkan progres belajar & kirim semangat langsung
                </div>
              </div>
              <button type="button" className="beast-chip-btn" onClick={closeSheet}>
                Tutup
              </button>
            </div>
            <CoupleComparePanel markReadOnMount />
          </div>
        </div>
      )}
    </>
  )
}
