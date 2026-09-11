import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isAuthEnabled, supabase } from '../lib/supabase'

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
        return error ? { error: error.message } : {}
      },
      async signUp(email, password) {
        if (!supabase) return {}
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return { error: error.message }
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
