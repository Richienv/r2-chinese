import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isAuthEnabled } from '../lib/supabase'
import { useStore } from '../store/store'

export function Profile() {
  const s = useStore()
  const { user, signOut } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)

  const email = user?.email ?? ''
  const name = email ? email.split('@')[0] : 'Learner'

  return (
    <div className="stack-page">
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
        <div className="sub" style={{ marginTop: 8, fontSize: 13 }}>
          {email || 'HSK 4A'}
        </div>
      </header>

      <section className="card" style={{ padding: 4, marginTop: 18 }}>
        <ToggleRow
          label="Show pinyin"
          sub="On by default — under Chinese"
          value={s.prefs.showPinyin}
          onChange={(v) => s.setPref('showPinyin', v)}
        />
        <ToggleRow
          label="Show English"
          sub="On by default — in texts"
          value={s.prefs.showEnglish}
          onChange={(v) => s.setPref('showEnglish', v)}
        />
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
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      className="toggle-row"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
    >
      <span className="toggle-copy">
        <strong>{label}</strong>
        <span className="sub" style={{ fontSize: 12, marginTop: 1, display: 'block' }}>
          {sub}
        </span>
      </span>
      <span className="switch" data-on={value} aria-hidden>
        <span className="switch-knob" />
      </span>
    </button>
  )
}
