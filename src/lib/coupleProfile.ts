// Couple profile isolation, workspace switching, and editable names for Richie (HSK 4) & Renita (HSK 1).
import { useEffect, useState } from 'react'
import { CLOUD_META_KEY, LOCAL_PROGRESS_EVENT, pushToCloudIfChanged } from './autoSync.ts'
import type { BeastTrack } from './beastEngine.ts'
import type { CourseId } from './course.ts'
import {
  clearAllLearningStorage,
  exportLearningStorage,
  importLearningStorage,
  PROGRESS_KEY,
} from './progressStorage.ts'

export type CoupleMemberId = 'richie' | 'renita'

export interface CoupleMemberMeta {
  id: CoupleMemberId
  defaultName: string
  track: BeastTrack
  defaultCourse: CourseId
  cloudProfile: string
  badge: string
  trackSubtitle: string
  accent: string
}

export const COUPLE_MEMBERS: Record<CoupleMemberId, CoupleMemberMeta> = {
  richie: {
    id: 'richie',
    defaultName: 'Richie',
    track: 'hsk4',
    defaultCourse: 'hsk4a',
    cloudProfile: 'default',
    badge: 'HSK 4',
    trackSubtitle: 'Master ~50 kata di tes & grammar → naik level',
    accent: '#0f766e',
  },
  renita: {
    id: 'renita',
    defaultName: 'Renita',
    track: 'hsk1',
    defaultCourse: 'hsk1',
    cloudProfile: 'renita',
    badge: 'HSK 1 Dari Nol',
    trackSubtitle: '4 Nada, Pinyin & 150 kata dasar → naik level',
    accent: '#be185d',
  },
}

export const COUPLE_ACTIVE_KEY = 'yulu.active-profile.v1'
export const COUPLE_NAMES_KEY = 'yulu.couple-names.v1'
export const COUPLE_CACHE_PREFIX = 'yulu.profile-cache.v1.'
export const COUPLE_CHANGED_EVENT = 'yulu:couple-changed'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function defaultStorage(): StorageLike | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export function isCoupleMemberId(v: unknown): v is CoupleMemberId {
  return v === 'richie' || v === 'renita'
}

export function getActiveCoupleId(storage: StorageLike | null = defaultStorage()): CoupleMemberId {
  if (!storage) return 'richie'
  try {
    const raw = storage.getItem(COUPLE_ACTIVE_KEY)
    return isCoupleMemberId(raw) ? raw : 'richie'
  } catch {
    return 'richie'
  }
}

export function getCoupleNames(storage: StorageLike | null = defaultStorage()): Record<CoupleMemberId, string> {
  const base: Record<CoupleMemberId, string> = {
    richie: COUPLE_MEMBERS.richie.defaultName,
    renita: COUPLE_MEMBERS.renita.defaultName,
  }
  if (!storage) return base
  try {
    const raw = storage.getItem(COUPLE_NAMES_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<Record<CoupleMemberId, unknown>>
    if (typeof parsed.richie === 'string' && parsed.richie.trim()) {
      base.richie = parsed.richie.trim().slice(0, 24)
    }
    if (typeof parsed.renita === 'string' && parsed.renita.trim()) {
      base.renita = parsed.renita.trim().slice(0, 24)
    }
    return base
  } catch {
    return base
  }
}

export function setCoupleMemberName(
  id: CoupleMemberId,
  name: string,
  storage: StorageLike | null = defaultStorage(),
): Record<CoupleMemberId, string> {
  const next = getCoupleNames(storage)
  const clean = name.trim().slice(0, 24)
  next[id] = clean || COUPLE_MEMBERS[id].defaultName
  if (storage) {
    try {
      storage.setItem(COUPLE_NAMES_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota error */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COUPLE_CHANGED_EVENT))
  }
  return next
}

export function mergeRemoteCoupleNames(
  names: Partial<Record<CoupleMemberId, string>>,
  storage: StorageLike | null = defaultStorage(),
): void {
  const cur = getCoupleNames(storage)
  let changed = false
  if (typeof names.richie === 'string' && names.richie.trim() && names.richie.trim() !== cur.richie) {
    cur.richie = names.richie.trim().slice(0, 24)
    changed = true
  }
  if (typeof names.renita === 'string' && names.renita.trim() && names.renita.trim() !== cur.renita) {
    cur.renita = names.renita.trim().slice(0, 24)
    changed = true
  }
  if (changed && storage) {
    try {
      storage.setItem(COUPLE_NAMES_KEY, JSON.stringify(cur))
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(COUPLE_CHANGED_EVENT))
    }
  }
}

export function getMemberProfile(
  id: CoupleMemberId,
  storage: StorageLike | null = defaultStorage(),
): CoupleMemberMeta & { name: string } {
  const names = getCoupleNames(storage)
  const meta = COUPLE_MEMBERS[id]
  return { ...meta, name: names[id] }
}

export function getPartnerId(id: CoupleMemberId): CoupleMemberId {
  return id === 'richie' ? 'renita' : 'richie'
}

/**
 * Switch cleanly between Richie (HSK 4) and Renita (HSK 1 Dari Nol) without page reload.
 * Preserves each partner's local workspace snapshot cleanly and isolates cloud sync metadata.
 */
export function switchCoupleWorkspace(
  targetId: CoupleMemberId,
  storage: StorageLike | null = defaultStorage(),
  opts?: { syncPush?: boolean },
): CoupleMemberId {
  if (!storage) return targetId
  const currentId = getActiveCoupleId(storage)
  const targetMeta = COUPLE_MEMBERS[targetId]

  if (currentId !== targetId) {
    // 1) Snapshot current user workspace locally before switching
    const currentSnapshot = exportLearningStorage(storage, PROGRESS_KEY)
    try {
      storage.setItem(`${COUPLE_CACHE_PREFIX}${currentId}`, currentSnapshot)
    } catch {
      /* ignore quota issues */
    }

    // 2) Fire background keepalive sync for outgoing partner if enabled in browser
    if (typeof window !== 'undefined' && opts?.syncPush !== false) {
      const currentMeta = COUPLE_MEMBERS[currentId]
      void pushToCloudIfChanged({
        storage,
        key: PROGRESS_KEY,
        profile: currentMeta.cloudProfile,
        keepalive: true,
      })
    }

    // 3) Wipe active learning keys + cloud meta so incoming user starts clean
    clearAllLearningStorage(storage, PROGRESS_KEY)
    try {
      storage.removeItem(CLOUD_META_KEY)
    } catch {
      /* ignore */
    }

    // 4) Restore cached snapshot for incoming user OR seed clean default track
    let restored = false
    try {
      const cached = storage.getItem(`${COUPLE_CACHE_PREFIX}${targetId}`)
      if (cached) {
        const res = importLearningStorage(storage, PROGRESS_KEY, cached)
        restored = res.ok
      }
    } catch {
      restored = false
    }

    if (!restored) {
      try {
        storage.setItem('yulu.course.v1', targetMeta.defaultCourse)
        storage.setItem('yulu.course-entered.v1', '1')
      } catch {
        /* ignore */
      }
    } else if (targetId === 'renita') {
      // Ensure Renita opens her HSK 1 track cleanly whenever course is unset/empty
      try {
        const curCourse = storage.getItem('yulu.course.v1')?.trim()
        if (!curCourse) {
          storage.setItem('yulu.course.v1', 'hsk1')
        }
        storage.setItem('yulu.course-entered.v1', '1')
      } catch {
        /* ignore */
      }
    } else {
      try {
        if (!storage.getItem('yulu.course.v1')?.trim()) {
          storage.setItem('yulu.course.v1', targetMeta.defaultCourse)
        }
      } catch {
        /* ignore */
      }
    }
  } else {
    try {
      if (!storage.getItem('yulu.course.v1')?.trim()) {
        storage.setItem('yulu.course.v1', targetMeta.defaultCourse)
      }
      storage.setItem('yulu.course-entered.v1', '1')
    } catch {
      /* ignore */
    }
  }

  try {
    storage.setItem(COUPLE_ACTIVE_KEY, targetId)
  } catch {
    /* ignore */
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COUPLE_CHANGED_EVENT))
    window.dispatchEvent(new CustomEvent(LOCAL_PROGRESS_EVENT))
  }
  return targetId
}

export function useCoupleProfile(): {
  activeId: CoupleMemberId
  member: CoupleMemberMeta & { name: string }
  partner: CoupleMemberMeta & { name: string }
  names: Record<CoupleMemberId, string>
} {
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(COUPLE_CHANGED_EVENT, bump)
    return () => window.removeEventListener(COUPLE_CHANGED_EVENT, bump)
  }, [])
  const activeId = getActiveCoupleId()
  const names = getCoupleNames()
  return {
    activeId,
    member: getMemberProfile(activeId),
    partner: getMemberProfile(getPartnerId(activeId)),
    names,
  }
}
