import { useSyncExternalStore } from 'react'
import data from '../data/jiayin-english.json'
import { emptyEnglishPrepProgress, JIAYIN_ENGLISH_KEY, parseEnglishPrepProgress, type EnglishPrepAttempt, type EnglishPrepDraft, type EnglishPrepProgress, type EnglishPrepQuestion } from './jiayinEnglishPractice'

export const jiayinEnglishData = data
export const englishPrepQuestions: EnglishPrepQuestion[] = data.questions
function load() {
  try { return parseEnglishPrepProgress(JSON.parse(localStorage.getItem(JIAYIN_ENGLISH_KEY) ?? 'null')) }
  catch { return emptyEnglishPrepProgress() }
}
let cache = load()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => cache
function write(next: EnglishPrepProgress) {
  cache = next
  try { localStorage.setItem(JIAYIN_ENGLISH_KEY, JSON.stringify(next)) } catch { /* Keep this session usable if device storage is unavailable. */ }
  for (const listener of listeners) listener()
}
export function useJiayinEnglishProgress() {
  return {
    progress: useSyncExternalStore(subscribe, snapshot, snapshot),
    note: (id: string, value: string) => write({ ...cache, notes: { ...cache.notes, [id]: value } }),
    draft: (id: string, value: EnglishPrepDraft) => write({ ...cache, drafts: { ...cache.drafts, [id]: value } }),
    record: (id: string, attempt: EnglishPrepAttempt) => {
      const drafts = { ...cache.drafts }; delete drafts[id]
      write({ ...cache, drafts, attempts: { ...cache.attempts, [id]: [...cache.attempts[id] ?? [], attempt].slice(-20) } })
    },
  }
}
