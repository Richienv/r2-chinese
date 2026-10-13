import { useSyncExternalStore } from 'react'
import data from '../data/jiayin.json'
import { emptyJiayinProgress, parseJiayinProgress, type JiayinAttempt, type JiayinExerciseAttempt, type JiayinProgress, type JiayinStage, type JiayinUnit } from './jiayinPractice'
import { buildJiayinLessons } from './jiayinLesson'

export const JIAYIN_PROGRESS_KEY = 'yulu.jiayin.v1'
export const jiayinData = data
export const jiayinUnits: JiayinUnit[] = data.units
export const jiayinItems = jiayinUnits.flatMap(u => u.items)
export const jiayinLessons = buildJiayinLessons(jiayinUnits, data.extraVocab)
function load(): JiayinProgress {
  try { return parseJiayinProgress(JSON.parse(localStorage.getItem(JIAYIN_PROGRESS_KEY) ?? 'null')) }
  catch { return emptyJiayinProgress() }
}
let cache = load()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => cache
function write(next: JiayinProgress) {
  cache = next
  try { localStorage.setItem(JIAYIN_PROGRESS_KEY, JSON.stringify(next)) } catch { /* Session remains usable if storage is full. */ }
  for (const listener of listeners) listener()
}
export function useJiayinProgress() {
  const progress = useSyncExternalStore(subscribe, snapshot, snapshot)
  return {
    progress,
    complete: (unit: number, stage: JiayinStage | 'mock') => {
      const key = String(unit)
      if (cache.pathDone[key]?.includes(stage)) return
      write({ ...cache, pathDone: { ...cache.pathDone, [key]: [...cache.pathDone[key] ?? [], stage] } })
    },
    note: (key: string, text: string) => write({ ...cache, notes: { ...cache.notes, [key]: text } }),
    attempt: (id: string, attempt: JiayinAttempt) => write({ ...cache, attempts: { ...cache.attempts, [id]: [...cache.attempts[id] ?? [], attempt].slice(-20) } }),
    finishLesson: (id: string) => {
      if (!cache.lessonsDone[id]) write({ ...cache, lessonsDone: { ...cache.lessonsDone, [id]: Date.now() } })
    },
    exercise: (id: string, attempt: JiayinExerciseAttempt) => write({ ...cache, exercises: { ...cache.exercises, [id]: [...cache.exercises[id] ?? [], attempt].slice(-20) } }),
  }
}
