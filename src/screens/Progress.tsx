import { Flame } from '../components/Flame'
import { BoltIcon, CardsIcon, CheckIcon, TargetIcon } from '../components/Icons'
import { lessons } from '../lib/content'
import { dayKey, useStore } from '../store/store'

/** Rolling last-7-days card counts, oldest → newest, labelled by weekday. */
function weekActivity(log: Record<string, { cards: number }>) {
  const out: { label: string; cards: number; today: boolean }[] = []
  const now = new Date()
  const todayKey = dayKey(now)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = dayKey(d)
    out.push({
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      cards: log[key]?.cards ?? 0,
      today: key === todayKey,
    })
  }
  return out
}

export function Progress() {
  const s = useStore()
  const week = weekActivity(s.log)
  const weekTotal = week.reduce((n, d) => n + d.cards, 0)
  const peak = Math.max(1, ...week.map((d) => d.cards))
  const estMin = Math.round(weekTotal * 0.25)
  const coursePct = s.lessonsDone.length / lessons.length

  return (
    <>
      <header style={{ padding: '18px 0 16px' }}>
        <h1 className="h2">Progress</h1>
        <div className="sub" style={{ marginTop: 4 }}>
          HSK 4A · your last seven days
        </div>
      </header>

      <div className="grid2">
        <Stat icon={<Flame size={18} />} value={s.streak} label="Day streak" />
        <Stat icon={<BoltIcon size={18} />} value={s.xp} label="Total XP" />
        <Stat icon={<CardsIcon size={18} />} value={s.wordsLearned} label="Words learned" />
        <Stat icon={<TargetIcon size={18} />} value={estMin} label="Min this week" />
      </div>

      {/* weekly activity */}
      <section className="metal" style={{ padding: 18, marginTop: 14 }}>
        <div className="between">
          <div className="kicker">This week</div>
          <span className="pill">{weekTotal} cards</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 8,
            alignItems: 'end',
            height: 120,
            marginTop: 16,
          }}
        >
          {week.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(6, (d.cards / peak) * 100)}%`,
                    borderRadius: 8,
                    background: d.today
                      ? 'linear-gradient(180deg,#FFE0B0,#FFFFFF)'
                      : 'rgba(255,255,255,.22)',
                    transition: 'height .4s var(--ease)',
                  }}
                  title={`${d.cards} cards`}
                />
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-red-3)', marginTop: 6 }}>
                {d.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* course progress */}
      <section className="metal" style={{ padding: 18, marginTop: 14 }}>
        <div className="between">
          <div className="kicker">HSK 4A course</div>
          <span className="pill">{Math.round(coursePct * 100)}%</span>
        </div>
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {lessons.map((l) => {
            const done = s.lessonsDone.includes(l.lesson)
            return (
              <div key={l.lesson} className="row" style={{ gap: 10 }}>
                <span
                  className="zh on-red"
                  style={{ fontSize: 13, fontWeight: 700, width: 96, flex: 'none' }}
                  lang="zh-CN"
                >
                  {l.title.zh}
                </span>
                <div className="bar" style={{ flex: 1 }}>
                  <i style={{ width: done ? '100%' : '0%' }} />
                </div>
                {done && <CheckIcon size={16} />}
              </div>
            )
          })}
        </div>
      </section>

      <p style={{ fontSize: 11, color: 'var(--muted-3)', margin: '22px 0 8px', lineHeight: 1.5 }}>
        Minutes are estimated from cards practised. Streak and words are exact.
      </p>
    </>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="metal metal-sm" style={{ padding: 16, borderRadius: 20 }}>
      <span className="glass" style={{ borderRadius: 11, padding: 7, display: 'inline-grid' }}>
        {icon}
      </span>
      <div className="on-red" style={{ fontSize: 30, fontWeight: 800, marginTop: 10, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: 'var(--on-red-3)', fontWeight: 600, marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}
