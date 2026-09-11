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
