import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { evaluateBeastProgress, getTrainerAssetSrc, type FlameMeta, type LegendaryBeastTier } from '../lib/beastEngine'
import { COUPLE_MEMBERS, getPartnerId, useCoupleProfile, type CoupleMemberId } from '../lib/coupleProfile'
import {
  fetchCoupleFeed,
  fetchPartnerSnapshot,
  markCoupleFeedSeen,
  postCoupleEvent,
  type CoupleEvent,
  type PartnerSnapshot,
} from '../lib/coupleSync'
import { readHsk1Progress, subscribeHsk1Progress } from '../lib/hsk1'
import { readHistory } from '../lib/history'
import { dayKey, useStore } from '../store/store'
import '../styles/couple-compare.css'

const QUICK_CHEERS = [
  '🔥 Semangat!',
  '🐉 Keren banget!',
  '❤️ Gas belajar!',
  '🏆 Naik level bareng!',
] as const

function timeAgo(ts: number): string {
  const min = Math.max(0, Math.floor((Date.now() - ts) / 60_000))
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}j`
  return `${Math.floor(h / 24)}h`
}

interface FighterSummary {
  id: CoupleMemberId
  name: string
  badge: string
  accent: string
  beast: LegendaryBeastTier
  level: number
  spiritPower: number
  streak: number
  flame: FlameMeta
  masteredWords: number
  todayCards: number
  yesterdayCards: number
  retentionPct: number
}

export function CoupleComparePanel({ markReadOnMount = false }: { markReadOnMount?: boolean }) {
  const s = useStore()
  const { activeId, member, partner, names } = useCoupleProfile()
  const [hsk1Progress, setHsk1Progress] = useState(readHsk1Progress)
  const [partnerSnap, setPartnerSnap] = useState<PartnerSnapshot | null>(null)
  const [feed, setFeed] = useState<CoupleEvent[]>([])
  const [chatText, setChatText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => subscribeHsk1Progress(setHsk1Progress), [])

  const loadShared = useCallback(async () => {
    const partnerId = getPartnerId(activeId)
    const [snap, shared] = await Promise.all([
      fetchPartnerSnapshot(partnerId),
      fetchCoupleFeed(),
    ])
    if (snap) setPartnerSnap(snap)
    setFeed(shared.events)
    if (markReadOnMount && shared.events[0]) {
      markCoupleFeedSeen(shared.events[0].at)
    }
  }, [activeId, markReadOnMount])

  useEffect(() => {
    void loadShared()
  }, [loadShared])

  const todayK = dayKey()
  const yestK = dayKey(Date.now() - 86_400_000)

  const myEval = useMemo(
    () =>
      evaluateBeastProgress({
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
        hsk1Progress,
        todayKey: todayK,
        nowMs: Date.now(),
      }),
    [member.track, s.mastery, s.cards, s.lessonsDone, s.pathDone, s.streak, s.xp, s.log, s.learnerGraph, hsk1Progress, todayK],
  )

  const myFighter: FighterSummary = {
    id: activeId,
    name: member.name,
    badge: member.badge,
    accent: member.accent,
    beast: myEval.beast,
    level: myEval.level,
    spiritPower: myEval.spiritPower,
    streak: s.streak,
    flame: myEval.flame,
    masteredWords: myEval.metrics.unaidedTotalWords,
    todayCards: s.log[todayK]?.cards ?? 0,
    yesterdayCards: s.log[yestK]?.cards ?? 0,
    retentionPct: myEval.retentionPct,
  }

  const partnerFighter: FighterSummary | null = partnerSnap
    ? {
        id: partnerSnap.id,
        name: partner.name,
        badge: partnerSnap.badge,
        accent: partnerSnap.accent,
        beast: partnerSnap.beast,
        level: partnerSnap.level,
        spiritPower: partnerSnap.spiritPower,
        streak: partnerSnap.streak,
        flame: partnerSnap.flame,
        masteredWords: partnerSnap.masteredWords,
        todayCards: partnerSnap.todayCards,
        yesterdayCards: partnerSnap.yesterdayCards,
        retentionPct: partnerSnap.retentionPct,
      }
    : null

  const richieSide = activeId === 'richie' ? myFighter : partnerFighter
  const renitaSide = activeId === 'renita' ? myFighter : partnerFighter

  async function sendMessage(text: string) {
    const clean = text.trim()
    if (!clean || sending) return
    setSending(true)
    try {
      const updated = await postCoupleEvent({
        from: activeId,
        kind: 'cheer',
        text: clean,
        beastLevel: myEval.level,
        names,
      })
      setFeed(updated)
      if (updated[0]) markCoupleFeedSeen(updated[0].at)
      setChatText('')
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void sendMessage(chatText)
  }

  const fighters: FighterSummary[] = [
    ...(richieSide ? [richieSide] : []),
    ...(renitaSide ? [renitaSide] : []),
  ]

  return (
    <div className="cc-panel">
      <div className="cc-duel-grid">
        {fighters.map((f) => (
          <div
            key={f.id}
            className={`cc-fighter${f.id === activeId ? ' is-me' : ''}`}
            style={{ '--cc-accent': COUPLE_MEMBERS[f.id].accent } as CSSProperties}
          >
            <div className="cc-sprite-wrap" style={{ background: `${f.beast.accentHex}18` }}>
              <img
                src={getTrainerAssetSrc(f.beast, f.id)}
                alt={`${f.name} · ${f.beast.name}`}
                onError={(e) => {
                  e.currentTarget.src = '/beasts/v1/beast-02-qilin.webp'
                }}
              />
            </div>
            <div className="cc-fighter-name">{f.name}</div>
            <span className="cc-fighter-lv">
              Lv {f.level}/24 · {f.beast.stageLabel}
            </span>
            <div className="cc-fighter-sub">
              {f.beast.zhName} ({f.badge})
            </div>
          </div>
        ))}
      </div>

      {richieSide && renitaSide && (
        <div className="cc-stat-rows" aria-label="Perbandingan Richie vs Renita">
          <div className="cc-stat-row">
            <span>{richieSide.spiritPower.toLocaleString()}</span>
            <small>灵力 Power</small>
            <span>{renitaSide.spiritPower.toLocaleString()}</span>
          </div>
          <div className="cc-stat-row">
            <span>{richieSide.masteredWords}</span>
            <small>Kata Murni</small>
            <span>{renitaSide.masteredWords}</span>
          </div>
          <div className="cc-stat-row">
            <span>
              {richieSide.todayCards} ({richieSide.todayCards - richieSide.yesterdayCards >= 0 ? '+' : ''}
              {richieSide.todayCards - richieSide.yesterdayCards})
            </span>
            <small>Kartu Hari Ini</small>
            <span>
              {renitaSide.todayCards} ({renitaSide.todayCards - renitaSide.yesterdayCards >= 0 ? '+' : ''}
              {renitaSide.todayCards - renitaSide.yesterdayCards})
            </span>
          </div>
          <div className="cc-stat-row">
            <span>{richieSide.flame.badge}</span>
            <small>Streak & Retensi</small>
            <span>{renitaSide.flame.badge}</span>
          </div>
        </div>
      )}

      <div className="cc-cheers-strip">
        {QUICK_CHEERS.map((msg) => (
          <button
            key={msg}
            type="button"
            className="cc-cheer-chip"
            disabled={sending}
            onClick={() => void sendMessage(msg)}
          >
            {msg}
          </button>
        ))}
      </div>

      <form className="cc-chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="cc-chat-input"
          maxLength={140}
          placeholder={`Kirim pesan semangat ke ${partner.name}…`}
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
        />
        <button type="submit" className="cc-chat-send" disabled={sending || !chatText.trim()}>
          Kirim
        </button>
      </form>

      <div className="cc-feed-box" aria-label="Notifikasi & Chat Berdua">
        {feed.length === 0 ? (
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Belum ada pesan berdua — kirim semangat pertama ke {partner.name}!
          </div>
        ) : (
          feed.slice(0, 15).map((ev) => (
            <div key={ev.id} className={`cc-feed-msg${ev.from === activeId ? ' is-mine' : ''}`}>
              <span>
                <strong>{names[ev.from]}:</strong> {ev.text}
              </span>
              <span style={{ fontSize: 10.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                {timeAgo(ev.at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
