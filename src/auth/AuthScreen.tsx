import { useState } from 'react'
import { useAuth } from './AuthProvider'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setNotice(null)
    if (!email || password.length < 6) {
      setError('Enter an email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    const res = mode === 'in' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (res.error) {
      setError(res.error)
    } else if ('needsConfirm' in res && res.needsConfirm) {
      setNotice('Check your email for a confirmation link, then sign in.')
      setMode('in')
    }
    // On success with a session, AuthProvider flips and the app renders.
  }

  return (
    <div className="app">
      <div className="safe-top" />
      <div className="scroll" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div
            className="avatar"
            style={{ width: 92, height: 92, borderRadius: 30, fontSize: 40, margin: '0 auto' }}
          >
            语
          </div>
          <h1 className="h1" style={{ marginTop: 18 }}>
            hsk4-r2
          </h1>
          <p className="sub" style={{ marginTop: 6 }}>
            {mode === 'in' ? 'Sign in to keep your progress' : 'Create an account to save your progress'}
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            style={inputStyle}
          />
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            style={inputStyle}
          />

          {error && (
            <div
              className="explain"
              style={{ background: 'var(--err-bg)', borderColor: 'var(--err-line)', color: 'var(--err)' }}
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              className="explain"
              style={{ background: 'var(--ok-bg)', borderColor: 'var(--ok-line)', color: 'var(--ok)' }}
            >
              {notice}
            </div>
          )}

          <button className="btn" type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          className="btn btn-ghost"
          style={{ marginTop: 12 }}
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in')
            setError(null)
            setNotice(null)
          }}
        >
          {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>

        <p style={{ fontSize: 11, color: 'var(--muted-3)', textAlign: 'center', marginTop: 22, lineHeight: 1.5 }}>
          Your progress syncs to your account across devices.
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 52,
  borderRadius: 14,
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  padding: '0 16px',
  fontSize: 16,
  color: 'var(--ink)',
  fontFamily: 'var(--ui)',
}
