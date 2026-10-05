import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { isAuthEnabled } from '../lib/supabase'
import { dueCards } from '../lib/srs'
import { useStore } from '../store/store'
import '../styles/profile.css'

export function Profile({
  onLearn,
  onProgress,
  onReview,
}: {
  onLearn: () => void
  onProgress: () => void
  onReview: () => void
}) {
  const s = useStore()
  const { user, signOut } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)

  const email = user?.email ?? ''
  const name = email ? email.split('@')[0] : 'Learner'
  const dueCount = dueCards(s.cardList).length
  const hasWords = s.cardList.length > 0

  return (
    <div className="stack-page profile-page">
      <header className="profile-header">
        <div className="profile-eyebrow">YOUR LEARNING SPACE</div>
        <h1 className="h2">Profile</h1>
        <p className="sub">Set up the way you like to learn.</p>
      </header>

      <section className="profile-identity card" aria-label="Learner account">
        <div className="profile-avatar" aria-hidden="true">语</div>
        <div className="profile-identity-copy">
          <h2>{name}</h2>
          <p>{email || 'Your personal learning space'}</p>
          <div className="profile-account-meta">
            <span>{s.wordsLearned} {s.wordsLearned === 1 ? 'word' : 'words'} in your trail</span>
            <i aria-hidden="true" />
            <span>{s.xp.toLocaleString()} XP</span>
          </div>
        </div>
        <span className="profile-identity-mark" aria-hidden="true">✳</span>
      </section>

      <section className="profile-quick-actions" aria-label="Learning shortcuts">
        <button className="profile-action profile-action-primary" type="button" onClick={hasWords ? onReview : onLearn}>
          <span className="profile-action-icon" aria-hidden="true">{hasWords ? '↻' : '→'}</span>
          <span className="profile-action-copy">
            <strong>{hasWords ? (dueCount ? `Review ${dueCount} due ${dueCount === 1 ? 'word' : 'words'}` : 'Practice your words') : 'Choose a course'}</strong>
            <small>{hasWords ? (dueCount ? 'Strengthen what is ready to return' : 'Keep your learning trail active') : 'Pick up a proven learning path'}</small>
          </span>
          <span className="profile-action-arrow" aria-hidden="true">↗</span>
        </button>
        <button className="profile-action" type="button" onClick={onProgress}>
          <span className="profile-action-icon profile-action-icon-soft" aria-hidden="true">⌁</span>
          <span className="profile-action-copy">
            <strong>See your progress</strong>
            <small>Recall, course stages, and recent activity</small>
          </span>
          <span className="profile-action-arrow" aria-hidden="true">→</span>
        </button>
      </section>

      <section className="profile-settings card">
        <div className="profile-section-heading">
          <div>
            <div className="profile-eyebrow">MAKE IT YOURS</div>
            <h2>Learning preferences</h2>
          </div>
          <span className="profile-settings-ornament" aria-hidden="true">文</span>
        </div>
        <p className="profile-section-sub">Changes apply right away across lessons and review.</p>
        <div className="profile-toggle-list">
          <ToggleRow
            label="Show pinyin"
            sub={s.prefs.showPinyin ? 'Pronunciation appears under Chinese text' : 'Chinese stays on its own for focused recall'}
            value={s.prefs.showPinyin}
            onChange={(v) => s.setPref('showPinyin', v)}
          />
          <ToggleRow
            label="Show English"
            sub={s.prefs.showEnglish ? 'Translations appear when the lesson provides them' : 'Keep the page in Mandarin until you choose a hint'}
            value={s.prefs.showEnglish}
            onChange={(v) => s.setPref('showEnglish', v)}
          />
          <ToggleRow
            label="Sound and speech"
            sub={s.prefs.soundOn ? 'Word audio and learning feedback are on' : 'Study quietly; audio and effects are muted'}
            value={s.prefs.soundOn}
            onChange={(v) => s.setPref('soundOn', v)}
          />
        </div>
        <div className="profile-settings-note"><span aria-hidden="true">i</span> Hide a hint when you want a cleaner view or a stronger recall challenge.</div>
      </section>

      <section className="profile-data card">
        <div className="profile-section-heading">
          <div>
            <div className="profile-eyebrow">ACCOUNT AND DATA</div>
            <h2>Your progress belongs to you</h2>
          </div>
        </div>
        <p className="profile-section-sub">Reset only when you want to start your learning trail again from zero.</p>
        {confirmReset ? (
          <div className="profile-reset-confirm" role="alert">
            <div className="profile-reset-alert-mark" aria-hidden="true">!</div>
            <div className="profile-reset-copy">
              <strong>Erase all learning progress?</strong>
              <span>Your streak, XP, saved words, and review schedule will be cleared.</span>
            </div>
            <div className="profile-reset-actions">
              <button className="profile-cancel-button" type="button" onClick={() => setConfirmReset(false)}>Keep my progress</button>
              <button className="profile-danger-button" type="button" onClick={() => { s.reset(); setConfirmReset(false) }}>Reset everything</button>
            </div>
          </div>
        ) : (
          <button className="profile-data-action" type="button" onClick={() => setConfirmReset(true)}>
            <span><strong>Reset progress</strong><small>Clear saved learning data on this profile</small></span>
            <span aria-hidden="true">→</span>
          </button>
        )}
      </section>

      {isAuthEnabled && user && (
        <button className="profile-signout" type="button" onClick={() => signOut()}>
          Sign out <span aria-hidden="true">↗</span>
        </button>
      )}

      <p className="profile-source-note">Content and audio recordings from 标准教程 HSK 4上 (HSK Standard Course 4A), © Beijing Language and Culture University Press. Used here for personal study only, not for sale.</p>
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
      className="toggle-row profile-toggle-row"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
    >
      <span className="toggle-copy">
        <strong>{label}</strong>
        <span>{sub}</span>
      </span>
      <span className="switch" data-on={value} aria-hidden>
        <span className="switch-knob" />
      </span>
    </button>
  )
}
