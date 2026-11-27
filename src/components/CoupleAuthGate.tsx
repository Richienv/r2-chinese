import { useState, type FormEvent } from 'react'
import { LEGENDARY_BEASTS, getTrainerAssetSrc } from '../lib/beastEngine'
import { unlockCoupleGate, verifyCouplePasscode } from '../lib/coupleAuth'
import { COUPLE_MEMBERS, getActiveCoupleId, getCoupleNames, type CoupleMemberId } from '../lib/coupleProfile'
import '../styles/couple-auth.css'

export function CoupleAuthGate({ onUnlocked }: { onUnlocked?: () => void }) {
  const names = getCoupleNames()
  const [selected, setSelected] = useState<CoupleMemberId>(() => getActiveCoupleId())
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const lv1 = LEGENDARY_BEASTS[0]

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!verifyCouplePasscode(passcode)) {
      setError('Password salah — masukkan kode berdua kita.')
      return
    }
    setError(null)
    unlockCoupleGate(selected)
    onUnlocked?.()
  }

  return (
    <div className="ca-gate" role="main" aria-label="Pilih Akun Yulu Berdua">
      <div className="ca-card">
        <div className="ca-head">
          <span className="ca-badge">语路 YULU · COUPLE EDITION</span>
          <h1>Siapa yang belajar sekarang?</h1>
          <p>Pilih akun trainer dan masukkan password akses berdua.</p>
        </div>

        <div className="ca-accounts" role="radiogroup" aria-label="Akun Richie dan Renita">
          {(['richie', 'renita'] as const).map((id) => {
            const meta = COUPLE_MEMBERS[id]
            const active = selected === id
            return (
              <button
                key={id}
                type="button"
                data-member={id}
                role="radio"
                aria-checked={active}
                className={`ca-account-btn${active ? ' is-selected' : ''}`}
                onClick={() => {
                  setSelected(id)
                  setError(null)
                }}
              >
                <div className="ca-avatar-frame">
                  <img
                    src={getTrainerAssetSrc(lv1, id)}
                    alt={`${names[id]} Trainer`}
                    onError={(e) => {
                      e.currentTarget.src = '/beasts/v1/beast-02-qilin.webp'
                    }}
                  />
                </div>
                <span className="ca-account-name">{names[id]}</span>
                <span className="ca-account-track">{meta.badge}</span>
              </button>
            )
          })}
        </div>

        <form className="ca-form" onSubmit={handleSubmit}>
          <label className="ca-label">
            Password Akses Berdua
            <input
              type="password"
              className="ca-input"
              placeholder="Masukkan password..."
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value)
                if (error) setError(null)
              }}
            />
          </label>
          {error && (
            <p className="ca-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" data-member={selected} className="ca-submit">
            Masuk sebagai {names[selected]} ›
          </button>
        </form>
      </div>
    </div>
  )
}
