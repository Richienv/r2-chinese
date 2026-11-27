// Shared couple login gate with passcode `arci` (matching R2 Fit).
import { useEffect, useState } from 'react'
import { switchCoupleWorkspace, type CoupleMemberId } from './coupleProfile.ts'

export const COUPLE_GATE_KEY = 'yulu.couple-gate.v1'
export const COUPLE_GATE_EVENT = 'yulu:couple-gate'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getStorage(): StorageLike | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export function verifyCouplePasscode(input: string): boolean {
  return input.trim().toLowerCase() === 'arci'
}

export function isCoupleGateUnlocked(storage: StorageLike | null = getStorage()): boolean {
  if (!storage) return false
  try {
    return storage.getItem(COUPLE_GATE_KEY) === 'unlocked'
  } catch {
    return false
  }
}

export function unlockCoupleGate(
  memberId: CoupleMemberId,
  storage: StorageLike | null = getStorage(),
): void {
  if (storage) {
    try {
      storage.setItem(COUPLE_GATE_KEY, 'unlocked')
    } catch {
      /* ignore quota limits */
    }
  }
  switchCoupleWorkspace(memberId, storage as Storage | null)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COUPLE_GATE_EVENT, { detail: { unlocked: true } }))
  }
}

export function lockCoupleGate(storage: StorageLike | null = getStorage()): void {
  if (storage) {
    try {
      storage.removeItem(COUPLE_GATE_KEY)
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COUPLE_GATE_EVENT, { detail: { unlocked: false } }))
  }
}

export function useCoupleGate(): boolean {
  const [unlocked, setUnlocked] = useState(() => isCoupleGateUnlocked())
  useEffect(() => {
    const sync = () => setUnlocked(isCoupleGateUnlocked())
    window.addEventListener(COUPLE_GATE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(COUPLE_GATE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return unlocked
}
