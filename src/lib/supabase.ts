import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Auth + cloud sync are enabled only when Supabase config is present. Without it
 * the app runs exactly as before — local, anonymous, single-device — so the live
 * site never breaks before the keys are wired in.
 */
export const isAuthEnabled = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isAuthEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/** One JSONB row per user holds the whole progress blob. */
export const PROGRESS_TABLE = 'user_progress'
