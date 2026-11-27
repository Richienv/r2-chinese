// Pure state & persistence helper for Renita's HSK 1 Dari Nol curriculum (`yulu.hsk1.v1`).
import { HSK1_UNITS } from '../data/hsk1.ts'
import { CLOUD_HYDRATED_EVENT, LOCAL_PROGRESS_EVENT } from './autoSync.ts'

export const HSK1_STORAGE_KEY = 'yulu.hsk1.v1'
export const HSK1_UPDATED_EVENT = 'yulu:hsk1-updated'

export interface Hsk1ProgressState {
  unitsDone: number[]
  provenWords: string[]
  tonesPassed: number
  pinyinPassed: number
  grammarPassed: number
  bestUnitScores: Record<string, number>
  updatedAt: number
}

const EMPTY_HSK1: Hsk1ProgressState = {
  unitsDone: [],
  provenWords: [],
  tonesPassed: 0,
  pinyinPassed: 0,
  grammarPassed: 0,
  bestUnitScores: {},
  updatedAt: 0,
}

export function normalizeHsk1Progress(raw: unknown): Hsk1ProgressState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_HSK1, bestUnitScores: {} }
  }
  const obj = raw as Record<string, unknown>
  const unitsDone = Array.isArray(obj.unitsDone)
    ? [
        ...new Set(
          obj.unitsDone.filter(
            (n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= HSK1_UNITS.length,
          ),
        ),
      ].sort((a, b) => a - b)
    : []
  const provenWords = Array.isArray(obj.provenWords)
    ? [...new Set(obj.provenWords.filter((w): w is string => typeof w === 'string' && w.trim().length > 0))]
    : []
  const bestUnitScores: Record<string, number> = {}
  if (obj.bestUnitScores && typeof obj.bestUnitScores === 'object' && !Array.isArray(obj.bestUnitScores)) {
    for (const [k, v] of Object.entries(obj.bestUnitScores as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        bestUnitScores[k] = Math.max(0, Math.min(100, Math.round(v)))
      }
    }
  }
  return {
    unitsDone,
    provenWords,
    tonesPassed:
      typeof obj.tonesPassed === 'number' && Number.isFinite(obj.tonesPassed)
        ? Math.max(0, Math.floor(obj.tonesPassed))
        : 0,
    pinyinPassed:
      typeof obj.pinyinPassed === 'number' && Number.isFinite(obj.pinyinPassed)
        ? Math.max(0, Math.floor(obj.pinyinPassed))
        : 0,
    grammarPassed:
      typeof obj.grammarPassed === 'number' && Number.isFinite(obj.grammarPassed)
        ? Math.max(0, Math.floor(obj.grammarPassed))
        : 0,
    bestUnitScores,
    updatedAt:
      typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? Math.max(0, obj.updatedAt) : 0,
  }
}

export function readHsk1Progress(): Hsk1ProgressState {
  if (typeof localStorage === 'undefined') return { ...EMPTY_HSK1, bestUnitScores: {} }
  try {
    const raw = localStorage.getItem(HSK1_STORAGE_KEY)
    if (!raw) return { ...EMPTY_HSK1, bestUnitScores: {} }
    return normalizeHsk1Progress(JSON.parse(raw))
  } catch {
    return { ...EMPTY_HSK1, bestUnitScores: {} }
  }
}

function writeHsk1Progress(next: Hsk1ProgressState): Hsk1ProgressState {
  const clean = normalizeHsk1Progress({ ...next, updatedAt: Date.now() })
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(HSK1_STORAGE_KEY, JSON.stringify(clean))
    } catch {
      /* ignore storage errors */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HSK1_UPDATED_EVENT, { detail: clean }))
    window.dispatchEvent(new CustomEvent(LOCAL_PROGRESS_EVENT))
  }
  return clean
}

export function recordHsk1ToneScore(passedCount: number): Hsk1ProgressState {
  const prev = readHsk1Progress()
  return writeHsk1Progress({
    ...prev,
    tonesPassed: Math.max(prev.tonesPassed, Math.max(0, Math.round(passedCount))),
  })
}

export function recordHsk1PinyinScore(passedCount: number): Hsk1ProgressState {
  const prev = readHsk1Progress()
  return writeHsk1Progress({
    ...prev,
    pinyinPassed: Math.max(prev.pinyinPassed, Math.max(0, Math.round(passedCount))),
  })
}

export function recordHsk1UnitResult(input: {
  unit: number
  provenWords: string[]
  grammarCorrectCount: number
  scorePct: number
}): Hsk1ProgressState {
  const prev = readHsk1Progress()
  const scorePct = Math.max(0, Math.min(100, Math.round(input.scorePct)))
  const unitKey = String(input.unit)
  const unitsDone =
    scorePct >= 60 && !prev.unitsDone.includes(input.unit)
      ? [...prev.unitsDone, input.unit].sort((a, b) => a - b)
      : prev.unitsDone
  const provenWords = [...new Set([...prev.provenWords, ...input.provenWords])]
  const bestUnitScores = {
    ...prev.bestUnitScores,
    [unitKey]: Math.max(prev.bestUnitScores[unitKey] ?? 0, scorePct),
  }
  return writeHsk1Progress({
    ...prev,
    unitsDone,
    provenWords,
    grammarPassed: prev.grammarPassed + Math.max(0, Math.round(input.grammarCorrectCount)),
    bestUnitScores,
  })
}

export function subscribeHsk1Progress(cb: (state: Hsk1ProgressState) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const fire = () => cb(readHsk1Progress())
  const onStorage = (e: StorageEvent) => {
    if (e.key === HSK1_STORAGE_KEY || e.key === null) fire()
  }
  window.addEventListener(HSK1_UPDATED_EVENT, fire)
  window.addEventListener(CLOUD_HYDRATED_EVENT, fire)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(HSK1_UPDATED_EVENT, fire)
    window.removeEventListener(CLOUD_HYDRATED_EVENT, fire)
    window.removeEventListener('storage', onStorage)
  }
}
