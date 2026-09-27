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

/** Upsert a user's progress blob (last-write-wins). Best-effort; ignores offline errors. */
export async function saveProgress(userId: string, state: unknown): Promise<void> {
  if (!supabase) return
  try {
    await supabase
      .from(PROGRESS_TABLE)
      .upsert({ user_id: userId, state, updated_at: new Date().toISOString() })
  } catch {
    /* offline — the localStorage cache still holds the change until next sync */
  }
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
