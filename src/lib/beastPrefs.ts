// Client preferences & unlock tracking for Yulu's Legendary Beast & TCG card stages.
// Persists in localStorage (`yulu.beast.v1`) and participates in automatic cloud sync.
import { CLOUD_HYDRATED_EVENT, LOCAL_PROGRESS_EVENT } from './autoSync.ts'
import {
  BEAST_STORAGE_KEY,
  DEFAULT_BEAST_STAGE_ID,
  isBeastStageId,
  type BeastStageId,
} from './beastStages.ts'

export const BEAST_PREFS_EVENT = 'yulu:beast-prefs'

export interface BeastPrefs {
  stageId: BeastStageId
  lastSeenLevel: number
  earnedAchievementKeys: string[]
  revealMuted: boolean
  updatedAt: number
}

const DEFAULT_PREFS: BeastPrefs = {
  stageId: DEFAULT_BEAST_STAGE_ID,
  lastSeenLevel: 1,
  earnedAchievementKeys: [],
  revealMuted: false,
  updatedAt: 0,
}

function normalizeBeastPrefs(raw: unknown): BeastPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_PREFS }
  const obj = raw as Record<string, unknown>
  const earned = Array.isArray(obj.earnedAchievementKeys)
    ? [...new Set(obj.earnedAchievementKeys.filter((k): k is string => typeof k === 'string' && k.length > 0))]
    : []
  const lastSeenLevel =
    typeof obj.lastSeenLevel === 'number' && Number.isFinite(obj.lastSeenLevel)
      ? Math.max(1, Math.min(24, Math.floor(obj.lastSeenLevel)))
      : 1
  return {
    stageId: isBeastStageId(obj.stageId) ? obj.stageId : DEFAULT_BEAST_STAGE_ID,
    lastSeenLevel,
    earnedAchievementKeys: earned,
    revealMuted: Boolean(obj.revealMuted),
    updatedAt: typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : 0,
  }
}

export function readBeastPrefs(): BeastPrefs {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS }
  try {
    const raw = localStorage.getItem(BEAST_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return normalizeBeastPrefs(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function writeBeastPrefs(patch: Partial<BeastPrefs>): BeastPrefs {
  const prev = readBeastPrefs()
  const next: BeastPrefs = normalizeBeastPrefs({
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  })
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BEAST_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota errors */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BEAST_PREFS_EVENT, { detail: next }))
    window.dispatchEvent(new CustomEvent(LOCAL_PROGRESS_EVENT))
  }
  return next
}

export function resetBeastPrefs(): BeastPrefs {
  const next: BeastPrefs = { ...DEFAULT_PREFS, updatedAt: Date.now() }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BEAST_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota errors */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BEAST_PREFS_EVENT, { detail: next }))
  }
  return next
}

export function subscribeBeastPrefs(cb: (prefs: BeastPrefs) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onUpdate = () => cb(readBeastPrefs())
  const onStorage = (e: StorageEvent) => {
    if (e.key === BEAST_STORAGE_KEY || e.key === null) onUpdate()
  }
  window.addEventListener(BEAST_PREFS_EVENT, onUpdate)
  window.addEventListener(CLOUD_HYDRATED_EVENT, onUpdate)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(BEAST_PREFS_EVENT, onUpdate)
    window.removeEventListener(CLOUD_HYDRATED_EVENT, onUpdate)
    window.removeEventListener('storage', onStorage)
  }
}
