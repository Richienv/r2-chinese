import { useState } from 'react'
import { getLang, t } from '../lib/i18n'
import { dayKey } from '../store/store'

const indonesian = getLang() === 'id'
// Monday first. Indonesian initials: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu.
const WEEKDAYS = indonesian ? ['S', 'S', 'R', 'K', 'J', 'S', 'M'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']
/** The `data-state` values stay as they are for CSS; only the spoken label is translated. */
const STATE_LABEL = { done: t('done'), future: t('future'), missed: t('missed') }

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

  const monthName = today.toLocaleDateString(indonesian ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })
  const practisedThisMonth = cells.filter((d) => d && done.has(dayKey(d))).length

  return (
    <section className="metal" style={{ padding: 18, marginTop: 14 }}>
      <div className="between" style={{ marginBottom: 12 }}>
        <div>
          <div className="kicker">{t('Practice calendar')}</div>
          <div className="on-red" style={{ fontWeight: 800, fontSize: 17, marginTop: 3 }}>
            {monthName}
          </div>
        </div>
        <span className="pill">{t('{n} days', { n: practisedThisMonth })}</span>
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
              aria-label={t('{date} — {state}', { date: key, state: STATE_LABEL[state] })}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,236,228,.82)' }}>
        {selected
          ? done.has(selected)
            ? t('{date} · practised ✅', { date: selected })
            : selected > todayKey
              ? t('{date} · not yet', { date: selected })
              : t('{date} · missed', { date: selected })
          : t('Tap a day to inspect it.')}
      </div>
    </section>
  )
}
