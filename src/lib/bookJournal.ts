import { useCallback, useSyncExternalStore } from 'react'

export const BOOK_JOURNAL_KEY = 'yulu.books.journal.v1'
export type BookActionStatus = 'planned' | 'tried' | 'revisit'
export type BookCompletionMode = 'reading-only' | 'reflection-drafted' | null
export interface BookJournalEntry {
  part: number
  index: number
  teachBack: string
  oldBelief: string
  newBelief: string
  nextAction: string
  when: string
  evidence: string
  reviewDate: string
  actionStatus: BookActionStatus
  actionSavedAt: number | null
  updatedAt: number
  completionMode: BookCompletionMode
}
export type BookJournalPatch = Partial<Omit<BookJournalEntry, 'part' | 'index' | 'updatedAt'>>
export type JournalSaveStatus = 'saved' | 'session-only'
type JournalStorage = Pick<Storage, 'getItem' | 'setItem'>
type JournalEntries = Record<string, BookJournalEntry>
interface JournalSnapshot { entries: JournalEntries; saveStatus: JournalSaveStatus }
const TEXT_FIELDS = ['teachBack', 'oldBelief', 'newBelief', 'nextAction', 'when', 'evidence'] as const

export function emptyBookJournal(part: number, index: number): BookJournalEntry {
  return { part, index, teachBack: '', oldBelief: '', newBelief: '', nextAction: '', when: '', evidence: '', reviewDate: '', actionStatus: 'planned', actionSavedAt: null, updatedAt: 0, completionMode: null }
}
function keyFor(part: number, index: number) { return `${part}:${index}` }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function timestamp(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0 }

export function validBookReviewDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}
export function bookReviewDate(days: number, now: number = Date.now()): string {
  const date = new Date(now)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function normalizeEntry(value: unknown, part: number, index: number): BookJournalEntry {
  const entry = emptyBookJournal(part, index)
  if (!record(value)) return entry
  for (const field of TEXT_FIELDS) if (typeof value[field] === 'string') entry[field] = value[field]
  if (validBookReviewDate(value.reviewDate)) entry.reviewDate = value.reviewDate
  if (value.actionStatus === 'tried' || value.actionStatus === 'revisit') entry.actionStatus = value.actionStatus
  entry.actionSavedAt = timestamp(value.actionSavedAt) || null
  entry.updatedAt = timestamp(value.updatedAt)
  if (value.completionMode === 'reading-only' || value.completionMode === 'reflection-drafted') entry.completionMode = value.completionMode
  return entry
}

/** Unsupported or damaged saves remain untouched; the learner can still write in this session. */
export function parseBookJournal(raw: string | null): { entries: JournalEntries; writable: boolean } {
  if (!raw) return { entries: {}, writable: true }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!record(parsed)) return { entries: {}, writable: false }
    if ('version' in parsed && parsed.version !== 1) return { entries: {}, writable: false }
    const values = 'version' in parsed ? parsed.entries : parsed
    if (!record(values)) return { entries: {}, writable: false }
    if (!('version' in parsed) && Object.keys(values).length && !Object.keys(values).some((key) => /^[1-9]\d*:[1-9]\d*$/.test(key))) return { entries: {}, writable: false }
    const entries: JournalEntries = {}
    for (const [key, value] of Object.entries(values)) {
      const match = key.match(/^([1-9]\d*):([1-9]\d*)$/)
      if (!match || !record(value)) continue
      const part = Number(match[1]), index = Number(match[2])
      if (!Number.isSafeInteger(part) || !Number.isSafeInteger(index)) continue
      entries[key] = normalizeEntry(value, part, index)
    }
    return { entries, writable: true }
  } catch { return { entries: {}, writable: false } }
}

/** A completeness check for the draft, never an understanding or transfer score. */
export function hasMeaningfulBookReflection(entry: Pick<BookJournalEntry, 'teachBack' | 'nextAction'>): boolean {
  const words = (text: string, minimum: number) => {
    const letters = text.trim().match(/[\p{L}\p{N}]/gu) ?? []
    return letters.length >= minimum && new Set(letters.map((letter) => letter.toLowerCase())).size >= 4
  }
  return words(entry.teachBack, 20) && words(entry.nextAction, 12)
}

/** Pending plans lead the list; past self-reports remain available as history. */
export function bookJournalActions(entries: BookJournalEntry[], today = bookReviewDate(0)): BookJournalEntry[] {
  const priority = (entry: BookJournalEntry) => {
    const due = !!entry.reviewDate && entry.reviewDate <= today
    return entry.actionStatus === 'tried' ? due ? 2 : 3 : due ? 0 : 1
  }
  return entries.filter((entry) => entry.actionSavedAt && entry.nextAction.trim()).sort((a, b) => priority(a) - priority(b) || (a.reviewDate || '9999').localeCompare(b.reviewDate || '9999') || b.updatedAt - a.updatedAt)
}

function mergeEntries(saved: JournalEntries, current: JournalEntries): JournalEntries {
  const result = { ...saved }
  for (const [key, entry] of Object.entries(current)) if (!result[key] || entry.updatedAt >= result[key].updatedAt) result[key] = entry
  return result
}

/** Injectable storage makes failures and future versions testable without touching course progress. */
export function createBookJournalStore(storage?: JournalStorage) {
  let snapshot: JournalSnapshot | undefined
  const listeners = new Set<() => void>()
  const read = () => {
    if (!storage) return { entries: {}, writable: false }
    try { return parseBookJournal(storage.getItem(BOOK_JOURNAL_KEY)) }
    catch { return { entries: {}, writable: false } }
  }
  function getSnapshot(): JournalSnapshot {
    if (!snapshot) {
      const loaded = read()
      snapshot = { entries: loaded.entries, saveStatus: loaded.writable ? 'saved' : 'session-only' }
    }
    return snapshot
  }
  const notify = () => listeners.forEach((listener) => listener())
  function update(part: number, index: number, patch: BookJournalPatch, now: number = Date.now()) {
    if (!Number.isSafeInteger(part) || part < 1 || !Number.isSafeInteger(index) || index < 1) return
    const current = getSnapshot()
    const latest = read()
    const entries = mergeEntries(latest.entries, current.entries)
    const key = keyFor(part, index)
    const previous = entries[key] ?? emptyBookJournal(part, index)
    const entry = normalizeEntry({ ...previous, ...patch, updatedAt: now }, part, index)
    if (patch.actionSavedAt && !hasMeaningfulBookReflection(entry)) entry.actionSavedAt = previous.actionSavedAt
    if (typeof patch.nextAction === 'string' && patch.nextAction !== previous.nextAction) {
      entry.actionStatus = 'planned'
      entry.actionSavedAt = patch.actionSavedAt && hasMeaningfulBookReflection(entry) ? entry.actionSavedAt : null
    }
    entries[key] = entry
    let saveStatus: JournalSaveStatus = 'session-only'
    if (storage && latest.writable) {
      try { storage.setItem(BOOK_JOURNAL_KEY, JSON.stringify({ version: 1, entries })); saveStatus = 'saved' }
      catch { /* Keep all current notes in memory when device storage is unavailable. */ }
    }
    snapshot = { entries, saveStatus }
    notify()
  }
  function refresh() {
    const current = getSnapshot(), latest = read()
    snapshot = { entries: mergeEntries(latest.entries, current.entries), saveStatus: latest.writable ? current.saveStatus : 'session-only' }
    notify()
  }
  function markAction(part: number, index: number, actionStatus: 'tried' | 'revisit') {
    const entry = getSnapshot().entries[keyFor(part, index)]
    if (entry?.actionSavedAt && entry.nextAction.trim()) update(part, index, { actionStatus })
  }
  return { getSnapshot, update, refresh, markTried: (part: number, index: number) => markAction(part, index, 'tried'), markRevisit: (part: number, index: number) => markAction(part, index, 'revisit'), subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } } }
}

let defaultStore: ReturnType<typeof createBookJournalStore> | undefined
const serverSnapshot: JournalSnapshot = { entries: {}, saveStatus: 'session-only' }
function journalStore() {
  if (!defaultStore) {
    let storage: JournalStorage | undefined
    try { if (typeof localStorage !== 'undefined') storage = localStorage } catch { /* The session remains writable in memory. */ }
    defaultStore = createBookJournalStore(storage)
    if (typeof window !== 'undefined') window.addEventListener('storage', (event) => { if (event.key === BOOK_JOURNAL_KEY) defaultStore?.refresh() })
  }
  return defaultStore
}
export function useBookJournal(part: number, index: number) {
  const store = journalStore()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverSnapshot)
  const entry = snapshot.entries[keyFor(part, index)] ?? emptyBookJournal(part, index)
  const update = useCallback((patch: BookJournalPatch) => store.update(part, index, patch), [store, part, index])
  const markTried = useCallback(() => store.markTried(part, index), [store, part, index])
  const markRevisit = useCallback(() => store.markRevisit(part, index), [store, part, index])
  return { entry, update, markTried, markRevisit, saveStatus: snapshot.saveStatus }
}
export function useBookJournalEntries() {
  const store = journalStore()
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverSnapshot)
  return Object.values(snapshot.entries)
}
