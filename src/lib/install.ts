export type Platform =
  | 'installed'
  | 'ios-safari'
  | 'ios-other'
  | 'android'
  | 'desktop'
  | 'unknown'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>
}

export interface PlatformEnv {
  userAgent?: string
  maxTouchPoints?: number
  standalone?: boolean
  displayStandalone?: boolean
}

export const INSTALL_DISMISS_KEY = 'yulu.install.dismissed.v1'
export const INSTALL_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000

const IOS_OTHER_RE =
  /(CriOS|FxiOS|EdgiOS|OPiOS|MicroMessenger|WeChat|QQ\/|FBAN|FBAV|Instagram|Line\/)/i

/** Detect the current browser/PWA installation environment safely in browser or Node. */
export function detectPlatform(env?: PlatformEnv): Platform {
  const displayStandalone =
    env?.displayStandalone ??
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)

  const navStandalone =
    env?.standalone ??
    (typeof navigator !== 'undefined' &&
      (navigator as { standalone?: boolean }).standalone === true)

  if (displayStandalone || navStandalone) return 'installed'

  const ua =
    env?.userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (!ua) return 'unknown'

  const touchPoints =
    env?.maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0)

  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && touchPoints > 1)

  if (isIos) {
    return IOS_OTHER_RE.test(ua) ? 'ios-other' : 'ios-safari'
  }

  if (/Android/i.test(ua)) return 'android'
  if (/Windows|Macintosh|Linux|CrOS|X11/i.test(ua)) return 'desktop'

  return 'unknown'
}

/** Remember install prompt dismissal for 30 days. */
export function dismissInstallPrompt(now = Date.now()): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(INSTALL_DISMISS_KEY, String(now))
  } catch {
    /* ignore storage failures */
  }
}

/** Whether the Home Screen banner was dismissed within the last 30 days. */
export function isInstallPromptDismissed(now = Date.now()): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const raw = localStorage.getItem(INSTALL_DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    return now >= ts && now - ts < INSTALL_DISMISS_TTL_MS
  } catch {
    return false
  }
}

/** Retrieve the early-stashed `beforeinstallprompt` event if available. */
export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as { __yuluBip?: BeforeInstallPromptEvent | null }
  return win.__yuluBip ?? null
}

/** Clear the stashed `beforeinstallprompt` event once consumed or installed. */
export function clearDeferredInstallPrompt(): void {
  if (typeof window === 'undefined') return
  const win = window as unknown as { __yuluBip?: BeforeInstallPromptEvent | null }
  win.__yuluBip = null
}
