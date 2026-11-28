// Permanent QA sandbox isolation & zero-exception guardrail protecting production cloud profiles.
// Testing XP, unlocks, UI flows, or browser automation MUST run locally or under `?profile=qa_sandbox`,
// NEVER mutating `default` (Richie), `renita` (Renita), or `couple`.

export const QA_SANDBOX_PROFILE = 'qa_sandbox'
export const QA_SANDBOX_SESSION_KEY = 'yulu.qa-sandbox.v1'
export const PROTECTED_PROD_PROFILES = ['default', 'renita', 'couple'] as const

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeSessionStorage(explicit?: SessionStorageLike | null): SessionStorageLike | null {
  if (explicit !== undefined) return explicit
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage
}

function safeSearch(explicit?: string): string {
  if (explicit !== undefined) return explicit
  if (typeof window === 'undefined' || !window.location) return ''
  return window.location.search ?? ''
}

export function isProtectedProdProfile(profile: string | undefined | null): boolean {
  const norm = (profile ?? 'default').trim().toLowerCase()
  return (PROTECTED_PROD_PROFILES as readonly string[]).includes(norm)
}

/**
 * True whenever `?profile=qa_sandbox` or `?qa_sandbox=1` is present in the URL or
 * latched into `sessionStorage` for this browser session.
 */
export function isQaSandboxMode(opts?: {
  search?: string
  sessionStorage?: SessionStorageLike | null
}): boolean {
  const search = safeSearch(opts?.search)
  const ss = safeSessionStorage(opts?.sessionStorage)

  if (search) {
    try {
      const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
      const profileParam = params.get('profile')?.trim().toLowerCase()
      const qaFlag = params.get('qa_sandbox')?.trim().toLowerCase()
      if (profileParam === QA_SANDBOX_PROFILE || qaFlag === '1' || qaFlag === 'true') {
        try {
          ss?.setItem(QA_SANDBOX_SESSION_KEY, '1')
        } catch {
          /* ignore restricted storage */
        }
        return true
      }
      if (profileParam && profileParam !== QA_SANDBOX_PROFILE && qaFlag === '0') {
        try {
          ss?.removeItem(QA_SANDBOX_SESSION_KEY)
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore malformed query */
    }
  }

  try {
    return ss?.getItem(QA_SANDBOX_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Resolve requested track (`hsk1` or `hsk4`) from `?track=...` when entering QA Sandbox.
 */
export function readQaSandboxTrackOverride(search?: string): 'hsk1' | 'hsk4' | null {
  const raw = safeSearch(search)
  if (!raw) return null
  try {
    const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`)
    const tr = params.get('track')?.trim().toLowerCase()
    if (tr === 'hsk1' || tr === 'hsk4') return tr
    return null
  } catch {
    return null
  }
}

/**
 * Resolve cloud sync slot safely: in QA Sandbox mode NEVER return `'renita'` or `'default'`.
 */
export function resolveSafeCloudProfile(
  targetProfile: string,
  opts?: { search?: string; sessionStorage?: SessionStorageLike | null },
): string {
  if (isQaSandboxMode(opts)) return QA_SANDBOX_PROFILE
  return targetProfile
}

/**
 * True when any cloud read/write for `targetProfile` should stay strictly offline/local
 * because QA Sandbox mode is active or the target itself is `qa_sandbox`.
 */
export function shouldBlockProdCloudSync(
  targetProfile?: string,
  opts?: { search?: string; sessionStorage?: SessionStorageLike | null },
): boolean {
  const norm = (targetProfile ?? '').trim().toLowerCase()
  if (norm === QA_SANDBOX_PROFILE) return true
  if (isQaSandboxMode(opts)) return true
  return false
}

/**
 * Runtime guardrail against accidental test/sandbox writes to live production accounts.
 */
export function assertCloudWriteSafe(
  targetProfile: string,
  opts?: { search?: string; sessionStorage?: SessionStorageLike | null; operation?: string },
): void {
  if (isQaSandboxMode(opts) && isProtectedProdProfile(targetProfile)) {
    throw new Error(
      `Blocked ${opts?.operation ?? 'cloud write'} to protected production profile "${targetProfile}" inside QA Sandbox mode.`,
    )
  }
}
