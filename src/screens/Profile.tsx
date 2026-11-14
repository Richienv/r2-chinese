import { StudyMusic } from '../components/StudyMusic'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { LANGUAGES, getLang, setLang, t } from '../lib/i18n'
import { isAuthEnabled } from '../lib/supabase'
import { useStore } from '../store/store'
import '../styles/profile.css'

export function Profile() {
  const s = useStore()
  const { user, signOut } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)

  const email = user?.email ?? ''
  const name = email ? email.split('@')[0] : t('Learner')
  const language = getLang()

  return (
    <div className="stack-page profile-page">
      <header className="profile-header">
        <div className="profile-eyebrow">{t('YOUR LEARNING SPACE')}</div>
        <h1 className="h2">{t('Profile')}</h1>
        <p className="sub">{t('Set up the way you like to learn.')}</p>
      </header>

      <StudyMusic />
      <section className="profile-identity card" aria-label={t('Learner account')}>
        <div className="profile-avatar" aria-hidden="true">
          语
        </div>
        <div className="profile-identity-copy">
          <h2>{name}</h2>
          <p>{email || t('Your personal learning space')}</p>
          <div className="profile-account-meta">
            <span>
              {s.wordsLearned === 1
                ? t('{n} word in your trail', { n: s.wordsLearned })
                : t('{n} words in your trail', { n: s.wordsLearned })}
            </span>
            <i aria-hidden="true" />
            <span>{s.xp.toLocaleString()} XP</span>
          </div>
        </div>
      </section>

      <section className="profile-language card">
        <div className="profile-section-heading">
          <h2 id="profile-language-title">{t('Language')}</h2>
        </div>
        <p className="profile-section-sub">{t('Menus, meanings and tips follow this language.')}</p>
        {/* Names and hints come straight from LANGUAGES: each is written in its own language, so no t(). */}
        <div className="profile-language-options" role="group" aria-labelledby="profile-language-title">
          {LANGUAGES.map((option) => (
            <button
              key={option.id}
              type="button"
              lang={option.id}
              className="profile-language-option"
              aria-pressed={option.id === language}
              onClick={() => setLang(option.id)}
            >
              <strong>{option.name}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="profile-settings card">
        <div className="profile-section-heading">
          <div>
            <div className="profile-eyebrow">{t('MAKE IT YOURS')}</div>
            <h2>{t('Learning preferences')}</h2>
          </div>
          <span className="profile-settings-ornament" aria-hidden="true">
            文
          </span>
        </div>
        <p className="profile-section-sub">{t('Changes apply right away across lessons and review.')}</p>
        <div className="profile-toggle-list">
          <ToggleRow
            label={t('Show pinyin')}
            sub={
              s.prefs.showPinyin
                ? t('Pronunciation appears under Chinese text')
                : t('Chinese stays on its own for focused recall')
            }
            value={s.prefs.showPinyin}
            onChange={(v) => s.setPref('showPinyin', v)}
          />
          <ToggleRow
            label={t('Show translation')}
            sub={
              s.prefs.showEnglish
                ? t('Translations appear when the lesson provides them')
                : t('Keep the page in Mandarin until you choose a hint')
            }
            value={s.prefs.showEnglish}
            onChange={(v) => s.setPref('showEnglish', v)}
          />
          <ToggleRow
            label={t('Sound and speech')}
            sub={
              s.prefs.soundOn
                ? t('Word audio and learning feedback are on')
                : t('Study quietly; audio and effects are muted')
            }
            value={s.prefs.soundOn}
            onChange={(v) => s.setPref('soundOn', v)}
          />
        </div>
        <div className="profile-settings-note">
          <span aria-hidden="true">i</span>{' '}
          {t('Hide a hint when you want a cleaner view or a stronger recall challenge.')}
        </div>
      </section>

      <section className="profile-data card">
        <div className="profile-section-heading">
          <div>
            <div className="profile-eyebrow">{t('ACCOUNT AND DATA')}</div>
            <h2>{t('Your progress belongs to you')}</h2>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={s.exportProgress}>
          {t('Export progress backup')}
        </button>
        <p className="sub" role="status">
          {s.syncStatus === 'saved'
            ? t('Progress synced')
            : s.syncStatus === 'offline'
              ? t('Saved on this device. Sync will retry.')
              : s.syncStatus === 'pending'
                ? t('Saving progress…')
                : t('Saved on this device')}
        </p>
        <details className="profile-reset-disclosure"><summary>{t('Start over')}</summary>
        <p className="profile-section-sub">
          {t('Reset only when you want to start your learning trail again from zero.')}
        </p>
        {confirmReset ? (
          <div className="profile-reset-confirm" role="alert">
            <div className="profile-reset-alert-mark" aria-hidden="true">
              !
            </div>
            <div className="profile-reset-copy">
              <strong>{t('Erase all learning progress?')}</strong>
              <span>{t('Your streak, XP, saved words, and review schedule will be cleared.')}</span>
            </div>
            <div className="profile-reset-actions">
              <button className="profile-cancel-button" type="button" onClick={() => setConfirmReset(false)}>
                {t('Keep my progress')}
              </button>
              <button
                className="profile-danger-button"
                type="button"
                onClick={() => {
                  s.reset()
                  setConfirmReset(false)
                }}
              >
                {t('Reset everything')}
              </button>
            </div>
          </div>
        ) : (
          <button className="profile-data-action" type="button" onClick={() => setConfirmReset(true)}>
            <span>
              <strong>{t('Reset progress')}</strong>
              <small>{t('Clear saved learning data on this profile')}</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        )}
        </details>
      </section>

      {isAuthEnabled && user && (
        <button className="profile-signout" type="button" onClick={() => signOut()}>
          {t('Sign out')} <span aria-hidden="true">↗</span>
        </button>
      )}

      <p className="profile-source-note">
        {t(
          'Content and audio recordings from {book} (HSK Standard Course 4A), © Beijing Language and Culture University Press. Used here for personal study only, not for sale.',
          { book: '标准教程 HSK 4上' },
        )}
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
