import test from 'node:test'
import assert from 'node:assert/strict'
import { newCard, schedule, DAY } from '../src/lib/srs.ts'
import {
  initLearning,
  applyEvent,
  undoEvent,
  wordState,
  isComfortable,
  enqueueWords,
  eventFor,
} from '../src/lib/learningEngine.ts'
import { newMastery } from '../src/lib/mastery.ts'
import {
  mergeProgress,
  persistProgress,
  exportLearningStorage,
  progressKey,
} from '../src/lib/progressStorage.ts'
const now = Date.UTC(2026, 10, 14, 12)
const blank = () => ({
  cards: {},
  mastery: {},
  xp: 0,
  log: {},
  starred: [],
  lessonsDone: [],
  pathDone: {},
  prefs: { soundOn: false },
  inProgress: { lesson: 1, step: 4 },
  unknown: 'preserve',
})
const event = (overrides = {}) => ({
  id: 'one',
  zh: '好',
  lesson: 1,
  skill: 'recall',
  at: now,
  day: '2026-11-14',
  rating: 'easy',
  evidence: 'checked',
  assisted: false,
  source: 'review',
  scheduler: 'test',
  xp: 4,
  ...overrides,
})
class MemoryStorage {
  map = new Map()
  limit = Infinity
  writes = 0
  get length() {
    return this.map.size
  }
  key(i) {
    return [...this.map.keys()][i] ?? null
  }
  getItem(k) {
    return this.map.get(k) ?? null
  }
  removeItem(k) {
    this.map.delete(k)
  }
  setItem(k, v) {
    if (++this.writes > this.limit) throw Error('quota')
    this.map.set(k, v)
  }
}
test('migration preserves every legacy date, card, XP, lesson, checkpoint and unknown field', () => {
  const legacy = {
    ...blank(),
    xp: 901,
    lessonsDone: [1, 2],
    starred: ['好'],
    cards: { 好: { zh: '好', lesson: 1, ease: 2.9, reps: 8, interval: 70, due: now + 31 * DAY } },
    mastery: { 好: newMastery('好', 1, now - 100 * DAY) },
  }
  const migrated = { ...legacy, learning: initLearning(legacy) }
  assert.deepEqual(migrated.cards, legacy.cards)
  assert.deepEqual(mergeProgress(migrated, legacy).cards, legacy.cards)
  for (const k of ['xp', 'lessonsDone', 'starred', 'inProgress', 'prefs', 'unknown'])
    assert.deepEqual(mergeProgress(migrated, legacy)[k], legacy[k])
  assert.equal(migrated.mastery.好.attempts, 0)
})
test('placement rests a verified easy word for two weeks then grows at the actual due date', () => {
  let state = applyEvent(blank(), event({ evidence: 'placement' }))
  assert.ok(state.cards.好.interval >= 14)
  assert.equal(isComfortable(state, '好', now), true)
  const due = state.cards.好.due
  state = applyEvent(state, event({ id: 'next', at: due, rating: 'easy' }))
  assert.ok(state.cards.好.interval >= 60, JSON.stringify(state.cards.好))
  assert.ok(state.cards.好.interval <= 365)
})
test('repeated early practice and repeated placement cannot inflate spacing', () => {
  const first = schedule(newCard('好', 1, now), 'easy', now, true)
  assert.deepEqual(schedule(first, 'easy', now + DAY), first)
  assert.deepEqual(schedule(first, 'easy', now + DAY, true), first)
  assert.deepEqual(schedule(first, 'easy', now - 1), first)
})
test('first legacy success retains its interval; lapse shortens only the tested skill', () => {
  const old = { ...newCard('好', 1, now), interval: 90, reps: 12 }
  assert.ok(schedule(old, 'good', now).interval >= 90)
  let state = applyEvent(blank(), event({ evidence: 'placement' }))
  const recall = wordState(state, '好').skills.recall
  state = applyEvent(
    state,
    event({ id: 'listen-fail', skill: 'listening', rating: 'again', at: now + 10000, xp: 0 }),
  )
  assert.deepEqual(wordState(state, '好').skills.recall, recall)
  assert.ok(wordState(state, '好').skills.listening.due < recall.due)
})
test('assisted and unverified work never earn placement or mastery', () => {
  const assisted = applyEvent(blank(), event({ assisted: true, evidence: 'placement' }))
  assert.ok(assisted.cards.好.interval < 14)
  assert.equal(assisted.mastery.好.unaidedSuccesses, 0)
  const uncertain = applyEvent(blank(), event({ evidence: 'unverified' }))
  assert.deepEqual(uncertain.cards, {})
  assert.deepEqual(uncertain.mastery, {})
})
test('idempotency and Undo restore the exact schedule and retrieval evidence', () => {
  const legacy = {
    ...blank(),
    cards: { 好: { ...newCard('好', 1, now), interval: 7, reps: 2 } },
    mastery: { 好: newMastery('好', 1, now) },
  }
  const once = applyEvent(legacy, event())
  assert.equal(applyEvent(once, event()), once)
  const undone = undoEvent(once, 'one', now + 100)
  assert.deepEqual(undone.cards, legacy.cards)
  assert.deepEqual(undone.mastery, legacy.mastery)
  assert.deepEqual(mergeProgress(undone, once).cards, legacy.cards)
})
test('events from two offline devices survive merge with exact review XP and daily credit', () => {
  const initial = { ...blank(), xp: 100, log: { '2026-11-14': { cards: 3, lessons: 1 } } }
  const credit = (s, e) => ({
    ...applyEvent(s, e),
    xp: s.xp + e.xp,
    log: { '2026-11-14': { cards: 4, lessons: 1 } },
  })
  const a = credit(initial, event()),
    b = credit(initial, event({ id: 'two', zh: '你', at: now + 1 }))
  const merged = mergeProgress(a, b)
  assert.equal(Object.keys(merged.learning.events).length, 2)
  assert.equal(merged.xp, 108)
  assert.equal(merged.log['2026-11-14'].cards, 5)
  assert.deepEqual(mergeProgress(merged, b), merged)
  const undo = { ...undoEvent(a, 'one', now + 2), xp: 100, log: initial.log }
  const after = mergeProgress(merged, undo)
  assert.equal(after.xp, 104)
  assert.equal(after.log['2026-11-14'].cards, 4)
  assert.ok(!after.cards.好)
  assert.ok(after.cards.你)
})
test('enqueue after exposure is retained by subsequent sync', () => {
  let state = { ...blank(), mastery: { 好: newMastery('好', 1, now) } }
  state = { ...state, learning: initLearning(state) }
  const queued = enqueueWords(state, 1, [{ zh: '好' }], now + DAY)
  assert.ok(mergeProgress(queued, state).cards.好)
  assert.equal(mergeProgress(queued, state).mastery.好.encounters, 2)
})
test('unstar tombstones and explicit reset survive stale devices', () => {
  const before = { ...blank(), starred: ['好'], xp: 100 }
  const after = { ...before, starred: [], starChanges: { 好: { on: false, at: now } } }
  assert.deepEqual(mergeProgress(after, before).starred, [])
  const reset = { ...blank(), resetAt: now }
  assert.deepEqual(mergeProgress(before, reset), reset)
  assert.deepEqual(mergeProgress(reset, before), reset)
})
test('backup is byte exact, immutable, account scoped, and exported with cloud snapshot', () => {
  const storage = new MemoryStorage(),
    key = progressKey('alice'),
    raw = ' {"xp": 735, "custom":true} '
  storage.setItem(key, raw)
  storage.setItem(progressKey('bob'), 'private')
  persistProgress(storage, key, blank())
  persistProgress(storage, key, { ...blank(), xp: 1 })
  assert.equal(storage.getItem(key + '.before-v2'), raw)
  storage.setItem(key + '.server-before-v2', raw)
  const exported = JSON.parse(exportLearningStorage(storage, key))
  assert.ok(!exported.entries[progressKey('bob')])
  assert.equal(exported.entries[key + '.server-before-v2'], raw)
})
test('quota failure before backup leaves original progress untouched', () => {
  const storage = new MemoryStorage(),
    key = progressKey(),
    raw = JSON.stringify({ xp: 900 })
  storage.setItem(key, raw)
  storage.limit = 1
  assert.throws(() => persistProgress(storage, key, blank()))
  assert.equal(storage.getItem(key), raw)
})
test('interrupted main write leaves a recoverable pending record and original backup', () => {
  const storage = new MemoryStorage(),
    key = progressKey(),
    raw = JSON.stringify({ xp: 900 })
  storage.setItem(key, raw)
  storage.limit = 3
  assert.throws(() => persistProgress(storage, key, blank()))
  assert.equal(storage.getItem(key), raw)
  assert.equal(storage.getItem(key + '.before-v2'), raw)
  assert.deepEqual(JSON.parse(storage.getItem(key + '.pending')), blank())
})
test('malformed saved data is backed up but never silently overwritten with empty progress', () => {
  const storage = new MemoryStorage(),
    key = progressKey()
  storage.setItem(key, '{broken')
  assert.throws(() => persistProgress(storage, key, blank()))
  assert.equal(storage.getItem(key), '{broken')
  assert.equal(storage.getItem(key + '.before-v2'), '{broken')
})
test('missing legacy listening mode does not erase other mode evidence', () => {
  const m = newMastery('好', 1, now)
  delete m.modes.listening
  const state = applyEvent(
    { ...blank(), mastery: { 好: m } },
    eventFor('好', 1, { correct: true, mode: 'listening' }, now),
  )
  assert.equal(state.mastery.好.modes.listening.successes, 1)
  assert.equal(state.mastery.好.modes.recall.successes, 0)
})

test('lesson and drill credit from two devices merges without losing XP or double-counting', async () => {
  const { creditProgress } = await import('../src/lib/learningEngine.ts')
  const initial = { ...blank(), xp: 100, log: { '2026-11-14': { cards: 3, lessons: 1 } } }
  const a = creditProgress(initial, {
    id: 'c1',
    at: now,
    day: '2026-11-14',
    xp: 20,
    cards: 4,
    lessons: 1,
    source: 'lesson',
  })
  const b = creditProgress(initial, {
    id: 'c2',
    at: now + 1,
    day: '2026-11-14',
    xp: 12,
    cards: 3,
    lessons: 0,
    source: 'drill',
  })
  const merged = mergeProgress(a, b)
  assert.equal(merged.xp, 132)
  assert.deepEqual(merged.log['2026-11-14'], { cards: 10, lessons: 2 })
  assert.deepEqual(mergeProgress(merged, b), merged)
})
test('a stale pending save cannot replace newer main progress', async () => {
  const { readProgress } = await import('../src/lib/progressStorage.ts')
  const storage = new MemoryStorage(),
    key = progressKey()
  storage.setItem(key, JSON.stringify({ ...blank(), xp: 800, updatedAt: now }))
  storage.setItem(key + '.pending', JSON.stringify({ ...blank(), xp: 500, updatedAt: now - 1000 }))
  assert.equal(readProgress(storage, key).xp, 800)
})
test('sync cannot resurrect mastery from an undone first-ever answer', () => {
  const learned = applyEvent(blank(), event()),
    undone = undoEvent(learned, 'one', now + 1)
  const merged = mergeProgress(undone, learned)
  assert.deepEqual(merged.cards, {})
  assert.deepEqual(merged.mastery, {})
})
