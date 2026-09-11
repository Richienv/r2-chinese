import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Flame } from '../components/Flame'
import { BoltIcon, CardsIcon, CheckIcon, LockIcon, PencilIcon, TargetIcon } from '../components/Icons'
import { lessons } from '../lib/content'
import { isAuthEnabled } from '../lib/supabase'
import { type Prefs, useStore } from '../store/store'

interface Achievement {
  icon: React.ReactNode
  label: string
  earned: boolean
}

export function Profile() {
  const s = useStore()
  const { user, signOut } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)

  const email = user?.email ?? ''
  const name = email ? email.split('@')[0] : 'Learner'

  const rank =
    s.xp >= 1000 ? 'Advanced' : s.xp >= 400 ? 'Intermediate' : s.xp >= 100 ? 'Elementary' : 'Beginner'

  const achievements: Achievement[] = [
    { icon: <CheckIcon size={22} />, label: 'First lesson', earned: s.lessonsDone.length >= 1 },
    { icon: <CardsIcon size={22} />, label: '25 words', earned: s.wordsLearned >= 25 },
    { icon: <Flame size={20} />, label: '3-day streak', earned: s.streak >= 3 },
    { icon: <BoltIcon size={22} />, label: '250 XP', earned: s.xp >= 250 },
    { icon: <TargetIcon size={22} />, label: '7-day streak', earned: s.streak >= 7 },
    { icon: <PencilIcon size={22} />, label: 'Course done', earned: s.lessonsDone.length >= lessons.length },
  ]

  return (
    <>
      <header style={{ textAlign: 'center', padding: '26px 0 10px' }}>
        <div
          className="avatar"
          style={{ width: 84, height: 84, borderRadius: 28, fontSize: 34, margin: '0 auto' }}
        >
          语
        </div>
        <h1 className="h2" style={{ marginTop: 14, textTransform: 'capitalize' }}>
          {name}
        </h1>
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <span className="pill-ink">HSK 4A · {rank}</span>
        </div>
        <div className="sub" style={{ marginTop: 8, fontSize: 13 }}>
          {email || 'Learning since July 2026'}
        </div>
      </header>

      {/* mini stats */}
      <section className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '18px 0' }}>
        <MiniStat value={s.streak} label="Streak" />
        <MiniStat value={s.wordsLearned} label="Words" border />
        <MiniStat value={s.xp} label="XP" />
      </section>

      {/* achievements */}
      <h3 className="kicker-ink" style={{ margin: '24px 0 12px' }}>
        Achievements
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {achievements.map((a, i) => (
          <div
            key={i}
            className={a.earned ? 'metal metal-sm' : undefined}
            style={{
              borderRadius: 18,
              padding: '18px 8px',
              textAlign: 'center',
              opacity: a.earned ? 1 : 0.55,
              background: a.earned ? undefined : 'var(--card)',
              border: a.earned ? undefined : '1px solid var(--line-2)',
            }}
          >
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 46,
                height: 46,
                borderRadius: 999,
                margin: '0 auto 8px',
                color: a.earned ? '#fff' : 'var(--muted-2)',
                background: a.earned ? 'rgba(255,255,255,.2)' : '#ece7df',
              }}
            >
              {a.earned ? a.icon : <LockIcon size={18} />}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: a.earned ? 'var(--on-red-2)' : 'var(--muted)',
              }}
            >
              {a.label}
            </div>
          </div>
        ))}
      </div>

      {/* settings */}
      <h3 className="kicker-ink" style={{ margin: '24px 0 12px' }}>
        Settings
      </h3>
      <section className="card" style={{ padding: 4 }}>
        <ToggleRow
          label="Sound effects"
          sub="Pronunciation & feedback"
          pref="soundOn"
          value={s.prefs.soundOn}
          onChange={(v) => s.setPref('soundOn', v)}
        />
        <ToggleRow
          label="Show pinyin"
          sub="Romanisation under Chinese"
          pref="showPinyin"
          value={s.prefs.showPinyin}
          onChange={(v) => s.setPref('showPinyin', v)}
        />
        <ToggleRow
          label="Show English"
          sub="Translations in texts"
          pref="showEnglish"
          value={s.prefs.showEnglish}
          onChange={(v) => s.setPref('showEnglish', v)}
        />
        <Row label="Character set" value="Simplified" />
        <Row label="Daily reminder" value="8:00 PM" />
      </section>

      <section className="card" style={{ padding: 4, marginTop: 12 }}>
        {confirmReset ? (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--err)' }}>
              Erase all progress?
            </div>
            <div className="sub" style={{ fontSize: 13, marginTop: 4 }}>
              Streak, XP, saved words and review schedule will be cleared.
            </div>
            <div className="row" style={{ marginTop: 12, gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: 'var(--err)', backgroundImage: 'none' }}
                onClick={() => {
                  s.reset()
                  setConfirmReset(false)
                }}
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          <button
            className="between"
            style={{ width: '100%', padding: '14px 16px', textAlign: 'left', color: 'var(--link-hover)' }}
            onClick={() => setConfirmReset(true)}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>Reset progress</span>
          </button>
        )}
      </section>

      {isAuthEnabled && user && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: 14, color: 'var(--err)' }}
          onClick={() => signOut()}
        >
          Sign out
        </button>
      )}

      <p style={{ fontSize: 11, color: 'var(--muted-3)', margin: '22px 0 8px', lineHeight: 1.5 }}>
        Content from 标准教程 HSK 4上, Beijing Language and Culture University Press.
      </p>
    </>
  )
}

function MiniStat({ value, label, border }: { value: number; label: string; border?: boolean }) {
  return (
    <div
      style={{
        textAlign: 'center',
        borderLeft: border ? '1px solid var(--line-2)' : undefined,
        borderRight: border ? '1px solid var(--line-2)' : undefined,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value.toLocaleString()}</div>
      <div className="sub" style={{ fontSize: 12, marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="between" style={{ padding: '14px 16px', borderTop: '1px solid var(--line)' }}>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      <span className="sub" style={{ fontSize: 14 }}>
        {value}
      </span>
    </div>
  )
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string
  sub: string
  pref: keyof Prefs
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="between" style={{ padding: '12px 16px' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
        <div className="sub" style={{ fontSize: 12, marginTop: 1 }}>
          {sub}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        style={{
          width: 48,
          height: 28,
          borderRadius: 999,
          padding: 3,
          display: 'flex',
          justifyContent: value ? 'flex-end' : 'flex-start',
          background: value ? undefined : '#dcd6cc',
          backgroundImage: value ? 'var(--metal-sheen), var(--metal-base)' : 'none',
          transition: 'background .2s',
          flex: 'none',
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.25)',
            transition: 'all .2s',
          }}
        />
      </button>
    </div>
  )
}
