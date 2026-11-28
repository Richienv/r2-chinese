import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import {
  clearDeferredInstallPrompt,
  detectPlatform,
  dismissInstallPrompt,
  getDeferredInstallPrompt,
  isInstallPromptDismissed,
  type BeforeInstallPromptEvent,
  type Platform,
} from '../lib/install'
import { CloseIcon } from './Icons'
import '../styles/install-card.css'

function ShareGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  )
}

export function InstallCard({ variant }: { variant: 'home' | 'profile' }) {
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform())
  const [dismissed, setDismissed] = useState<boolean>(() => isInstallPromptDismissed())
  const [expanded, setExpanded] = useState(false)
  const [bip, setBip] = useState<BeforeInstallPromptEvent | null>(() => getDeferredInstallPrompt())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPlatform(detectPlatform())
    setBip(getDeferredInstallPrompt())

    const onBip = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      ;(window as unknown as { __yuluBip?: BeforeInstallPromptEvent | null }).__yuluBip = promptEvent
      setBip(promptEvent)
    }

    const onInstalled = () => {
      clearDeferredInstallPrompt()
      setBip(null)
      setPlatform('installed')
    }

    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null
    const onDisplayChange = () => setPlatform(detectPlatform())

    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    mql?.addEventListener?.('change', onDisplayChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
      mql?.removeEventListener?.('change', onDisplayChange)
    }
  }, [])

  async function handleNativeInstall() {
    if (!bip) return
    try {
      await bip.prompt()
      const result = await bip.userChoice
      clearDeferredInstallPrompt()
      setBip(null)
      if (result.outcome === 'accepted') {
        setPlatform('installed')
      }
    } catch {
      clearDeferredInstallPrompt()
      setBip(null)
      setExpanded(true)
    }
  }

  async function handleCopyLink() {
    if (typeof window === 'undefined') return
    const url = window.location.origin
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      /* fallback silent if clipboard blocked */
    }
  }

  function handleDismiss() {
    dismissInstallPrompt()
    setDismissed(true)
  }

  if (variant === 'home') {
    if (platform === 'installed' || platform === 'unknown' || dismissed) return null

    const subtitle =
      platform === 'ios-safari'
        ? t('iPhone: Tap Share → Add to Home Screen')
        : platform === 'ios-other'
          ? t('Open this page in Safari to install')
          : bip
            ? t('One-tap install for full-screen study')
            : t('Open browser menu → Install app')

    return (
      <section className="install-card-home" aria-label={t('Add Yulu to Home Screen')}>
        <div className="install-card-home-row">
          <span className="install-card-brand" aria-hidden="true">
            语
          </span>
          <div className="install-card-home-copy">
            <strong>{t('Add Yulu to Home Screen')}</strong>
            <span>{subtitle}</span>
          </div>
          <div className="install-card-home-actions">
            {bip ? (
              <button type="button" className="install-card-cta" onClick={handleNativeInstall}>
                {t('Install')}
              </button>
            ) : (
              <button
                type="button"
                className="install-card-cta"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? t('Hide') : t('Guide')}
              </button>
            )}
            <button
              type="button"
              className="install-card-dismiss"
              onClick={handleDismiss}
              aria-label={t('Dismiss install prompt')}
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        {expanded && !bip && (
          <div className="install-card-home-steps">
            {platform === 'ios-safari' ? (
              <ol>
                <li>{t('Tap the Share icon at the bottom of Safari')}</li>
                <li>{t('Scroll down and choose Add to Home Screen')}</li>
                <li>{t('Tap Add to launch Yulu full-screen')}</li>
              </ol>
            ) : platform === 'ios-other' ? (
              <>
                <p style={{ margin: 0 }}>
                  {t('In-app browsers and Chrome on iPhone cannot add apps directly. Open this link in Safari, then tap Share → Add to Home Screen.')}
                </p>
                <button type="button" className="install-card-copy-btn" onClick={handleCopyLink}>
                  {copied ? t('Link copied') : t('Copy Yulu link')}
                </button>
              </>
            ) : (
              <p style={{ margin: 0 }}>
                {t('Open your browser menu and select Install app or Add to Home Screen.')}
              </p>
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="card install-card-profile" aria-label={t('Home Screen app')}>
      <div className="install-card-profile-head">
        <span className="install-card-brand" aria-hidden="true">
          语
        </span>
        <div>
          <div className="profile-eyebrow">{t('APP EXPERIENCE')}</div>
          <h2>{t('Add Yulu to Home Screen')}</h2>
        </div>
      </div>

      {platform === 'installed' ? (
        <>
          <div className="install-card-installed" role="status">
            <span aria-hidden="true">✓</span>
            <span>{t('Already installed on Home Screen')}</span>
          </div>
          <p className="install-card-note">
            {t('You are running Yulu in full-screen app mode.')}
          </p>
        </>
      ) : platform === 'ios-safari' ? (
        <>
          <p className="install-card-note">
            {t('Launch Yulu like a native app without browser bars.')}
          </p>
          <ol className="install-card-steps">
            <li>
              {t('Tap the Share icon at the bottom of Safari')}{' '}
              <span className="install-card-share-inline">
                <ShareGlyph />
              </span>
            </li>
            <li>{t('Scroll down and choose Add to Home Screen')}</li>
            <li>{t('Tap Add to launch Yulu full-screen')}</li>
          </ol>
        </>
      ) : platform === 'ios-other' ? (
        <>
          <p className="install-card-note">
            <strong>{t('Open in Safari first')}</strong> —{' '}
            {t('In-app browsers and Chrome on iPhone cannot add apps directly. Open this link in Safari, then tap Share → Add to Home Screen.')}
          </p>
          <div className="install-card-profile-actions">
            <button type="button" className="install-card-profile-btn" onClick={handleCopyLink}>
              {copied ? t('Link copied') : t('Copy Yulu link')}
            </button>
          </div>
        </>
      ) : bip ? (
        <>
          <p className="install-card-note">
            {t('One-tap install for full-screen study')}
          </p>
          <div className="install-card-profile-actions">
            <button type="button" className="install-card-profile-btn" onClick={handleNativeInstall}>
              {t('Install Yulu app')}
            </button>
          </div>
        </>
      ) : (
        <p className="install-card-note">
          {t('Open your browser menu and select Install app or Add to Home Screen.')}
        </p>
      )}
    </section>
  )
}
