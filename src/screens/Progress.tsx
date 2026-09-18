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

  return (
    <div className="stack-page">
      <header style={{ padding: '18px 0 16px' }}>
        <h1 className="h2">Progress</h1>
        <div className="sub" style={{ marginTop: 4 }}>
          HSK 4A
        </div>
      </header>

      <section className="metal" style={{ padding: '20px 8px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Glance value={s.streak} label="Streak" />
          <Glance value={s.xp} label="XP" />
          <Glance value={s.wordsLearned} label="Words" />
        </div>
      </section>

      <section className="card" style={{ marginTop: 14, padding: '16px 18px 18px' }}>
        <div className="kicker-ink">This week</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 8,
            marginTop: 16,
          }}
        >
          {week.map((d, i) => {
            const on = d.cards > 0
            return (
              <div key={i} style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
                <span
                  title={`${d.cards} cards`}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: on ? 'var(--ink)' : 'transparent',
                    border: d.today
                      ? '2px solid var(--ink)'
                      : on
                        ? '2px solid var(--ink)'
                        : '2px solid var(--line-2)',
                    boxSizing: 'border-box',
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: d.today ? 'var(--ink)' : 'var(--muted-2)',
                  }}
                >
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Glance({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="on-red" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: 'var(--on-red-3)', fontWeight: 600, marginTop: 6 }}>
        {label}
      </div>
    </div>
  )
}
