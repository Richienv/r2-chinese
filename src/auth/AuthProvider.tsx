import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { isIndonesian, t } from '../lib/i18n'
import { isAuthEnabled, supabase } from '../lib/supabase'

/**
 * Supabase answers in English. English mode shows its message untouched; Indonesian mode
 * gets a friendly line for the failures people actually hit, and anything else passes through.
 */
function authMessage(error: AuthError): string {
  if (!isIndonesian()) return error.message
  switch (error.code) {
    case 'invalid_credentials':
      return t('Invalid login credentials')
    case 'email_not_confirmed':
      return t('Email not confirmed')
    case 'user_already_exists':
    case 'email_exists':
      return t('User already registered')
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t('Too many attempts. Wait a moment and try again.')
    case 'email_address_invalid':
      return t('That email address does not look right.')
    case 'signup_disabled':
      return t('Sign-ups are closed right now.')
    default:
      return error.name === 'AuthRetryableFetchError'
        ? t('Could not reach the server. Check your connection and try again.')
        : error.message
  }
}

interface AuthValue {
  /** false while the initial session is being restored */
  ready: boolean
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isAuthEnabled)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      async signIn(email, password) {
        if (!supabase) return {}
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? { error: authMessage(error) } : {}
      },
      async signUp(email, password) {
        if (!supabase) return {}
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return { error: authMessage(error) }
        // With email confirmation on, there's no session until the link is clicked.
        return { needsConfirm: !data.session }
      },
      async signOut() {
        await supabase?.auth.signOut()
      },
    }),
    [ready, session],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
