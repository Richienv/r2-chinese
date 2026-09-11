import { useState } from 'react'
import { dayKey } from '../store/store'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function StreakCalendar({ days }: { days: string[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const done = new Set(days)
  const today = new Date()
  const todayKey = dayKey(today)
  const year = today.getFullYear()
  const month = today.getMonth()

  const first = new Date(year, month, 1)
  // Monday-first offset
  const lead = (first.getDay() + 6) % 7
  const length = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, i) => new Date(year, month, i + 1)),
  ]

  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const practisedThisMonth = cells.filter((d) => d && done.has(dayKey(d))).length

  return (
    <section className="metal" style={{ padding: 18, marginTop: 14 }}>
      <div className="between" style={{ marginBottom: 12 }}>
        <div>
          <div className="kicker">Practice calendar</div>
          <div className="on-red" style={{ fontWeight: 800, fontSize: 17, marginTop: 3 }}>
            {monthName}
          </div>
        </div>
        <span className="pill">{practisedThisMonth} days</span>
      </div>

      <div className="cal" style={{ marginBottom: 6 }}>
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 800,
              color: 'rgba(255,236,228,.6)',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="cal">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const key = dayKey(d)
          const state = done.has(key)
            ? 'done'
            : key > todayKey
              ? 'future'
              : 'missed'
          return (
            <button
              key={i}
              data-state={state}
              data-sel={selected === key}
              onClick={() => setSelected(selected === key ? null : key)}
              aria-label={`${key} — ${state}`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,236,228,.82)' }}>
        {selected
          ? done.has(selected)
            ? `${selected} · practised ✅`
            : selected > todayKey
              ? `${selected} · not yet`
              : `${selected} · missed`
          : 'Tap a day to inspect it.'}
      </div>
    </section>
  )
}
