// Pure state & persistence helper for Renita's HSK 1 Dari Nol curriculum (`yulu.hsk1.v1`).
import { HSK1_UNITS } from '../data/hsk1.ts'
import { CLOUD_HYDRATED_EVENT, LOCAL_PROGRESS_EVENT } from './autoSync.ts'
import { HSK1_NODE_ORDER, reviewHsk1Card, type Hsk1NodeId } from './hsk1Srs.ts'
import type { Card, Rating } from './srs.ts'

export const HSK1_STORAGE_KEY = 'yulu.hsk1.v1'
export const HSK1_UPDATED_EVENT = 'yulu:hsk1-updated'

export interface Hsk1ProgressState {
  unitsDone: number[]
  provenWords: string[]
  tonesPassed: number
  pinyinPassed: number
  strokesPassed: number
  grammarPassed: number
  bestUnitScores: Record<string, number>
  nodeDone: Record<string, Hsk1NodeId[]>
  srsCards: Record<string, Card>
  updatedAt: number
}

const VALID_NODES = new Set<string>(HSK1_NODE_ORDER)

const EMPTY_HSK1: Hsk1ProgressState = {
  unitsDone: [],
  provenWords: [],
  tonesPassed: 0,
  pinyinPassed: 0,
  strokesPassed: 0,
  grammarPassed: 0,
  bestUnitScores: {},
  nodeDone: {},
  srsCards: {},
  updatedAt: 0,
}

function normalizeSrsCards(raw: unknown): Record<string, Card> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, Card> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const rec = v as Partial<Card>
    if (
      typeof rec.zh === 'string' &&
      typeof rec.lesson === 'number' &&
      typeof rec.due === 'number' &&
      typeof rec.interval === 'number' &&
      typeof rec.reps === 'number'
    ) {
      out[k] = {
        ...rec,
        zh: rec.zh,
        lesson: rec.lesson,
        ease: typeof rec.ease === 'number' ? rec.ease : 2.5,
        interval: rec.interval,
        due: rec.due,
        reps: rec.reps,
      }
    }
  }
  return out
}

export function normalizeHsk1Progress(raw: unknown): Hsk1ProgressState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_HSK1, bestUnitScores: {}, nodeDone: {}, srsCards: {} }
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
  const nodeDone: Record<string, Hsk1NodeId[]> = {}
  if (obj.nodeDone && typeof obj.nodeDone === 'object' && !Array.isArray(obj.nodeDone)) {
    for (const [k, list] of Object.entries(obj.nodeDone as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        const clean = [...new Set(list.filter((n): n is Hsk1NodeId => typeof n === 'string' && VALID_NODES.has(n)))]
        if (clean.length > 0) nodeDone[k] = clean
      }
    }
  }
  // Backfill nodeDone cleanly for units already completed before node tracking existed
  for (const u of unitsDone) {
    const uk = String(u)
    if (!nodeDone[uk] || !nodeDone[uk].includes('bos')) {
      nodeDone[uk] = [...HSK1_NODE_ORDER]
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
    strokesPassed:
      typeof obj.strokesPassed === 'number' && Number.isFinite(obj.strokesPassed)
        ? Math.max(0, Math.floor(obj.strokesPassed))
        : 0,
    grammarPassed:
      typeof obj.grammarPassed === 'number' && Number.isFinite(obj.grammarPassed)
        ? Math.max(0, Math.floor(obj.grammarPassed))
        : 0,
    bestUnitScores,
    nodeDone,
    srsCards: normalizeSrsCards(obj.srsCards),
    updatedAt:
      typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? Math.max(0, obj.updatedAt) : 0,
  }
}

export function readHsk1Progress(): Hsk1ProgressState {
  if (typeof localStorage === 'undefined') return { ...EMPTY_HSK1, bestUnitScores: {}, nodeDone: {}, srsCards: {} }
  try {
    const raw = localStorage.getItem(HSK1_STORAGE_KEY)
    if (!raw) return { ...EMPTY_HSK1, bestUnitScores: {}, nodeDone: {}, srsCards: {} }
    return normalizeHsk1Progress(JSON.parse(raw))
  } catch {
    return { ...EMPTY_HSK1, bestUnitScores: {}, nodeDone: {}, srsCards: {} }
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

export function recordHsk1StrokeScore(passedCount: number): Hsk1ProgressState {
  const prev = readHsk1Progress()
  return writeHsk1Progress({
    ...prev,
    strokesPassed: Math.max(prev.strokesPassed, Math.max(0, Math.round(passedCount))),
  })
}

export function applyHsk1NodeDone(
  prev: Hsk1ProgressState,
  unit: number,
  node: Hsk1NodeId,
  provenWords: string[] = [],
): Hsk1ProgressState {
  const unitKey = String(unit)
  const prevNodes = prev.nodeDone[unitKey] ?? []
  const nextNodes = prevNodes.includes(node) ? prevNodes : [...prevNodes, node]
  const nextNodeDone = { ...prev.nodeDone, [unitKey]: nextNodes }
  const mergedProven =
    provenWords.length > 0 ? [...new Set([...prev.provenWords, ...provenWords])] : prev.provenWords
  const unitsDone =
    node === 'bos' && !prev.unitsDone.includes(unit)
      ? [...prev.unitsDone, unit].sort((a, b) => a - b)
      : prev.unitsDone
  return {
    ...prev,
    unitsDone,
    provenWords: mergedProven,
    nodeDone: nextNodeDone,
  }
}

export function recordHsk1NodeDone(
  unit: number,
  node: Hsk1NodeId,
  provenWords: string[] = [],
): Hsk1ProgressState {
  return writeHsk1Progress(applyHsk1NodeDone(readHsk1Progress(), unit, node, provenWords))
}

export function recordHsk1SrsBatch(
  reviews: Array<{ zh: string; unit: number; rating: Rating }>,
  nowMs = Date.now(),
): Hsk1ProgressState {
  const prev = readHsk1Progress()
  let nextCards = { ...prev.srsCards }
  const newlyProven: string[] = []
  for (const r of reviews) {
    const res = reviewHsk1Card(nextCards, r.zh, r.unit, r.rating, nowMs)
    nextCards = res.nextCards
    if (r.rating === 'good' || r.rating === 'easy') {
      newlyProven.push(r.zh)
    }
  }
  return writeHsk1Progress({
    ...prev,
    provenWords: newlyProven.length > 0 ? [...new Set([...prev.provenWords, ...newlyProven])] : prev.provenWords,
    srsCards: nextCards,
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
  const existingNodes = prev.nodeDone[unitKey] ?? []
  const nextNodes =
    scorePct >= 60 ? ([...HSK1_NODE_ORDER] as Hsk1NodeId[]) : existingNodes.includes('bos') ? existingNodes : [...existingNodes, 'bos' as Hsk1NodeId]
  return writeHsk1Progress({
    ...prev,
    unitsDone,
    provenWords,
    grammarPassed: prev.grammarPassed + Math.max(0, Math.round(input.grammarCorrectCount)),
    bestUnitScores,
    nodeDone: { ...prev.nodeDone, [unitKey]: nextNodes },
  })
}

export function nextPlayableHsk1Unit(state: Hsk1ProgressState): { unit: number; node: Hsk1NodeId } {
  for (const u of HSK1_UNITS) {
    if (state.unitsDone.includes(u.unit)) continue
    const doneList = state.nodeDone[String(u.unit)] ?? []
    const nextNode = HSK1_NODE_ORDER.find((n) => !doneList.includes(n))
    if (nextNode) return { unit: u.unit, node: nextNode }
  }
  return { unit: HSK1_UNITS[HSK1_UNITS.length - 1]?.unit ?? 15, node: 'bos' }
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
