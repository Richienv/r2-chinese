import { syncProgress } from './progressSyncCore'
import { PROGRESS_TABLE, supabase } from './supabase'

/** Fetch a user's stored progress blob, or null if they have no row yet / offline. */
export async function fetchProgress(userId: string): Promise<unknown | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from(PROGRESS_TABLE)
      .select('state')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return null
    return data?.state ?? null
  } catch {
    return null
  }
}

/** Compare-and-swap prevents concurrent devices from silently replacing each other. */
export async function saveProgress<T>(
  userId: string,
  state: T,
  merge: (local: T, remote: T) => T,
): Promise<T | null> {
  if (!supabase) return null
  const db = supabase
  return syncProgress(
    state,
    {
      read: async () => {
        const { data, error } = await db
          .from(PROGRESS_TABLE)
          .select('state,updated_at')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw error
        return data ? { value: data.state as T, token: data.updated_at as string } : null
      },
      backup: (value) => {
        const key = 'yulu.hsk4a.v1.' + userId + '.server-before-v2'
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value))
      },
      update: async (value, token) => {
        const updated_at = new Date(Math.max(Date.now(), Date.parse(token) + 1)).toISOString()
        const { data, error } = await db
          .from(PROGRESS_TABLE)
          .update({ state: value, updated_at })
          .eq('user_id', userId)
          .eq('updated_at', token)
          .select('state')
          .maybeSingle()
        if (error) throw error
        return !!data
      },
      insert: async (value) => {
        const { error } = await db
          .from(PROGRESS_TABLE)
          .insert({ user_id: userId, state: value, updated_at: new Date().toISOString() })
        if (error && error.code !== '23505') throw error
        return !error
      },
    },
    merge,
  )
}

const HISTORY_TABLE = 'user_history'

/** Append up to 20 history events. Best-effort; ignores offline / unconfigured errors. */
export async function saveHistory(userId: string, events: unknown[]): Promise<void> {
  if (!supabase) return
  try {
    const rows = events.slice(0, 20).map((event) => ({ user_id: userId, event }))
    if (rows.length === 0) return
    await supabase.from(HISTORY_TABLE).insert(rows)
  } catch {
    /* offline / table missing — progress blob sync is unaffected */
  }
}

/** Latest 200 history events (newest first), or [] if offline / unconfigured. */
export async function fetchHistory(userId: string): Promise<unknown[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from(HISTORY_TABLE)
      .select('event')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return []
    return (data ?? []).map((row) => row.event)
  } catch {
    return []
  }
}
