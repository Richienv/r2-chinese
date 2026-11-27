import { useCallback, useEffect, useState } from 'react'
import { LEGENDARY_BEASTS, evaluateBeastProgress } from '../lib/beastEngine'
import {
  COUPLE_MEMBERS,
  getPartnerId,
  switchCoupleWorkspace,
  useCoupleProfile,
} from '../lib/coupleProfile'
import {
  countUnreadPartnerEvents,
  fetchCoupleFeed,
  fetchPartnerSnapshot,
  markCoupleFeedSeen,
  postCoupleEvent,
  type CoupleEvent,
  type PartnerSnapshot,
} from '../lib/coupleSync'
import { readHsk1Progress } from '../lib/hsk1'
import { readHistory } from '../lib/history'
import { dayKey, useStore } from '../store/store'
import '../styles/couple-hub.css'

const CHEERS = [
  '🔥 Semangat hari ini!',
  '🐉 Naga kamu keren!',
  '❤️ Gas lanjut belajar!',
] as const

function timeAgo(ts: number): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60_000))
  if (diffMin < 1) return 'baru saja'
  if (diffMin < 60) return `${diffMin}m lalu`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${h}j lalu`
  return `${Math.floor(h / 24)}h lalu`
}

export function CoupleHub() {
  const s = useStore()
  const { activeId, member, partner, names } = useCoupleProfile()
  const [partnerSnap, setPartnerSnap] = useState<PartnerSnapshot | null>(null)
  const [feed, setFeed] = useState<CoupleEvent[]>([])
  const [feedOpen, setFeedOpen] = useState(false)
  const [sendingCheer, setSendingCheer] = useState(false)
  const [cheerNotice, setCheerNotice] = useState<string | null>(null)

  const refreshCouple = useCallback(async () => {
    const partnerId = getPartnerId(activeId)
    const [snap, shared] = await Promise.all([
      fetchPartnerSnapshot(partnerId),
      fetchCoupleFeed(),
    ])
    if (snap) setPartnerSnap(snap)
    setFeed(shared.events)
  }, [activeId])

  useEffect(() => {
    void refreshCouple()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshCouple()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [refreshCouple])

  const myBeastLevel = evaluateBeastProgress({
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

  const unreadCount = countUnreadPartnerEvents(feed, activeId)
  const latestEvent = feed[0]

  async function handleCheer(text: string) {
    if (sendingCheer) return
    setSendingCheer(true)
    try {
      const updated = await postCoupleEvent({
        from: activeId,
        kind: 'cheer',
        text,
        beastLevel: myBeastLevel,
        names,
      })
      setFeed(updated)
      setCheerNotice(`Terkirim ke ${partner.name}!`)
      window.setTimeout(() => setCheerNotice(null), 2200)
    } finally {
      setSendingCheer(false)
    }
  }

  return (
    <section className="couple-hub" aria-label="Ruang Belajar Berdua">
      <div className="couple-switcher-row">
        <div className="couple-pills" role="group" aria-label="Pilih Profil Pembelajar">
          {(['richie', 'renita'] as const).map((id) => {
            const m = COUPLE_MEMBERS[id]
            const active = activeId === id
            return (
              <button
                key={id}
                type="button"
                data-member={id}
                className={`couple-pill-btn${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => switchCoupleWorkspace(id)}
              >
                <span>{names[id]}</span>
                <span className="couple-pill-tag">{m.badge}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="couple-feed-toggle"
          aria-expanded={feedOpen}
          onClick={() => {
            const next = !feedOpen
            setFeedOpen(next)
            if (next && feed[0]) markCoupleFeedSeen(feed[0].at)
          }}
        >
          Aktivitas Berdua
          {unreadCount > 0 && <span className="couple-unread-dot">{unreadCount}</span>}
        </button>
      </div>

      <div className="partner-card">
        <div className="partner-main-row">
          <div
            className="partner-avatar-box"
            style={{
              background: partnerSnap?.stage.previewGradient ?? LEGENDARY_BEASTS[0].accentHex,
            }}
          >
            <img
              src={partnerSnap?.beast.imageSrc ?? LEGENDARY_BEASTS[0].imageSrc}
              alt={partnerSnap ? `${partnerSnap.beast.zhName} milik ${partner.name}` : partner.name}
            />
          </div>

          <div className="partner-info">
            <div className="partner-name-row">
              <strong>
                {partner.name} · Lv {partnerSnap?.level ?? 1}/24 ({partnerSnap?.beast.zhName ?? '灵蛋'})
              </strong>
              <span className="partner-track-pill">{partner.badge}</span>
            </div>
            <div className="partner-stats-row">
              <span>⚡ {(partnerSnap?.spiritPower ?? 0).toLocaleString()} 灵力</span>
              <span>{partnerSnap?.flame.badge ?? '🌱 0H'}</span>
              <span>
                {partnerSnap?.masteredWords ?? 0} kata · {partnerSnap?.todayCards ?? 0} hari ini
              </span>
            </div>
          </div>
        </div>

        <div className="partner-cheers-row">
          {CHEERS.map((msg) => (
            <button
              key={msg}
              type="button"
              className="partner-cheer-btn"
              disabled={sendingCheer}
              onClick={() => void handleCheer(msg)}
            >
              {msg}
            </button>
          ))}
          {cheerNotice && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0f766e' }}>
              {cheerNotice}
            </span>
          )}
        </div>

        {!feedOpen && latestEvent && (
          <div className="couple-feed-item">
            <span>
              <span className="couple-feed-who">{names[latestEvent.from]}:</span>{' '}
              {latestEvent.text}
            </span>
            <span className="couple-feed-time">{timeAgo(latestEvent.at)}</span>
          </div>
        )}

        {feedOpen && (
          <div className="couple-feed-list">
            {feed.length === 0 ? (
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Belum ada notifikasi berdua — selesaikan 1 sesi atau kirim semangat!
              </div>
            ) : (
              feed.slice(0, 12).map((ev) => (
                <div key={ev.id} className="couple-feed-item">
                  <span>
                    <span className="couple-feed-who">{names[ev.from]}:</span> {ev.text}
                  </span>
                  <span className="couple-feed-time">{timeAgo(ev.at)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  )
}
