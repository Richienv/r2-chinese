import test from 'node:test'
import assert from 'node:assert/strict'
import { BOOK_JOURNAL_KEY, bookJournalActions, bookReviewDate, createBookJournalStore, emptyBookJournal, hasMeaningfulBookReflection, parseBookJournal, validBookReviewDate } from '../src/lib/bookJournal.ts'

function device() {
  const values = new Map([['yulu.books.v1', '{"reading-progress":"kept"}']])
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
const reflection = { teachBack: 'A smaller experiment reveals which assumption I should challenge next.', nextAction: 'Ask three customers to compare the two offer descriptions.' }

test('each edit persists in its own chapter, survives reopening, and never touches course progress', () => {
  const storage = device(), store = createBookJournalStore(storage)
  for (const [field, value] of Object.entries({ ...reflection, oldBelief: 'I assumed more features always helped.', newBelief: 'I want evidence before adding scope.', when: 'At the customer call tomorrow.', evidence: 'Two people preferred the simpler promise.', reviewDate: '2026-10-06' })) store.update(1, 1, { [field]: value }, 1000)
  store.update(2, 1, { teachBack: 'A separate book and chapter reflection stays separate.' }, 2000)
  const reopened = createBookJournalStore(storage).getSnapshot()
  assert.equal(reopened.entries['1:1'].nextAction, reflection.nextAction)
  assert.equal(reopened.entries['1:1'].evidence, 'Two people preferred the simpler promise.')
  assert.equal(reopened.entries['1:1'].reviewDate, '2026-10-06')
  assert.equal(reopened.entries['2:1'].nextAction, '')
  assert.equal(reopened.entries['1:1'].updatedAt, 1000)
  assert.equal(storage.values.get('yulu.books.v1'), '{"reading-progress":"kept"}')
  assert.equal(JSON.parse(storage.values.get(BOOK_JOURNAL_KEY)).version, 1)
})

test('draft completeness keeps actions deliberate; tried/revisit statuses are persisted self-reports without scoring', () => {
  const storage = device(), store = createBookJournalStore(storage)
  assert.equal(hasMeaningfulBookReflection(emptyBookJournal(1, 1)), false)
  assert.equal(hasMeaningfulBookReflection({ teachBack: 'yes', nextAction: 'do it' }), false)
  store.update(1, 1, { teachBack: 'yes', nextAction: 'do it', actionSavedAt: 100 }, 100)
  assert.equal(store.getSnapshot().entries['1:1'].actionSavedAt, null)
  store.markTried(1, 1)
  assert.equal(store.getSnapshot().entries['1:1'].actionStatus, 'planned')
  store.update(1, 1, reflection, 200)
  assert.equal(hasMeaningfulBookReflection(store.getSnapshot().entries['1:1']), true)
  assert.equal(store.getSnapshot().entries['1:1'].actionSavedAt, null, 'having text must not automatically keep or score an action')
  store.update(1, 1, { actionSavedAt: 250, completionMode: 'reflection-drafted' }, 250)
  store.markTried(1, 1)
  assert.equal(store.getSnapshot().entries['1:1'].actionStatus, 'tried')
  store.markRevisit(1, 1)
  assert.equal(createBookJournalStore(storage).getSnapshot().entries['1:1'].actionStatus, 'revisit')
  assert.equal(store.getSnapshot().entries['1:1'].completionMode, 'reflection-drafted')
  assert.ok(!['score', 'mastery', 'xp', 'verified'].some((key) => key in store.getSnapshot().entries['1:1']))
  store.update(2, 1, { completionMode: 'reading-only' }, 300)
  assert.equal(store.getSnapshot().entries['2:1'].completionMode, 'reading-only')
})

test('future versions, malformed data and unsupported objects stay intact while new writing remains usable', () => {
  for (const raw of ['{"version":2,"entries":{"1:1":{"teachBack":"future data"}}}', '{broken', '[1,2]', '{"unknownFutureFormat":"keep me"}']) {
    const storage = device()
    storage.values.set(BOOK_JOURNAL_KEY, raw)
    const store = createBookJournalStore(storage)
    store.update(1, 1, reflection, 1000)
    assert.equal(storage.values.get(BOOK_JOURNAL_KEY), raw)
    assert.equal(store.getSnapshot().entries['1:1'].teachBack, reflection.teachBack)
    assert.equal(store.getSnapshot().saveStatus, 'session-only')
  }
})

test('quota and access failures retain all session drafts and can recover on a later edit', () => {
  const storage = device(), store = createBookJournalStore(storage)
  store.update(1, 1, reflection, 1000)
  const write = storage.setItem
  storage.setItem = () => { throw new Error('quota') }
  store.update(1, 1, { evidence: 'This observation survives the failed write.' }, 2000)
  store.update(2, 1, { nextAction: 'A second draft survives too.' }, 2100)
  assert.equal(store.getSnapshot().entries['1:1'].evidence, 'This observation survives the failed write.')
  assert.equal(store.getSnapshot().saveStatus, 'session-only')
  storage.setItem = write
  store.update(2, 1, { when: 'Friday' }, 2200)
  const restored = createBookJournalStore(storage).getSnapshot()
  assert.equal(restored.entries['1:1'].evidence, 'This observation survives the failed write.')
  assert.equal(restored.entries['2:1'].nextAction, 'A second draft survives too.')
  assert.equal(store.getSnapshot().saveStatus, 'saved')
  const denied = createBookJournalStore({ getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } })
  denied.update(1, 1, reflection, 10)
  assert.equal(denied.getSnapshot().entries['1:1'].nextAction, reflection.nextAction)
})

test('safe legacy parsing rejects invalid fields and dates, and review choices use local calendar days', () => {
  const parsed = parseBookJournal(JSON.stringify({ '1:2': { teachBack: 'Kept text', nextAction: 9, reviewDate: '2026-02-30', actionStatus: 'mastered', updatedAt: -1 } }))
  assert.equal(parsed.writable, true)
  assert.equal(parsed.entries['1:2'].teachBack, 'Kept text')
  assert.equal(parsed.entries['1:2'].nextAction, '')
  assert.equal(parsed.entries['1:2'].reviewDate, '')
  assert.equal(parsed.entries['1:2'].actionStatus, 'planned')
  assert.equal(parsed.entries['1:2'].updatedAt, 0)
  assert.equal(validBookReviewDate('2028-02-29'), true)
  assert.equal(validBookReviewDate('2026-02-29'), false)
  const now = new Date(2026, 9, 31, 23, 30).getTime()
  assert.equal(bookReviewDate(1, now), '2026-11-01')
  assert.equal(bookReviewDate(3, now), '2026-11-03')
  assert.equal(bookReviewDate(7, now), '2026-11-07')
})

test('two chapter writers merge their drafts instead of overwriting each other', () => {
  const storage = device(), first = createBookJournalStore(storage), second = createBookJournalStore(storage)
  first.getSnapshot(); second.getSnapshot()
  first.update(1, 1, { teachBack: reflection.teachBack }, 100)
  second.update(2, 1, { teachBack: 'The second chapter stays separate in shared storage.' }, 200)
  first.update(1, 1, { nextAction: reflection.nextAction }, 300)
  assert.deepEqual(Object.keys(createBookJournalStore(storage).getSnapshot().entries).sort(), ['1:1', '2:1'])
})

test('editing a kept action removes its old tried status and requires a fresh deliberate save', () => {
  const storage = device(), store = createBookJournalStore(storage)
  store.update(1, 1, { ...reflection, oldBelief: 'Old assumption', evidence: 'What happened last time', reviewDate: '2026-10-05' }, 100)
  store.update(1, 1, { actionSavedAt: 110 }, 110)
  store.markTried(1, 1)
  store.update(1, 1, { nextAction: 'Run a separate experiment with five different customers.' }, 200)
  const entry = store.getSnapshot().entries['1:1']
  assert.equal(entry.actionStatus, 'planned')
  assert.equal(entry.actionSavedAt, null)
  assert.equal(entry.teachBack, reflection.teachBack)
  assert.equal(entry.oldBelief, 'Old assumption')
  assert.equal(entry.evidence, 'What happened last time')
  assert.equal(entry.reviewDate, '2026-10-05')
  assert.deepEqual(bookJournalActions([entry]), [])
  store.markTried(1, 1)
  assert.equal(store.getSnapshot().entries['1:1'].actionStatus, 'planned')
  store.update(1, 1, { actionSavedAt: 210 }, 210)
  assert.equal(bookJournalActions(Object.values(store.getSnapshot().entries)).length, 1)
})

test('due pending plans lead the compact review list while tried reports remain in history', () => {
  const base = { ...emptyBookJournal(1, 1), ...reflection, actionSavedAt: 100 }
  const tried = { ...base, index: 1, actionStatus: 'tried', reviewDate: '2026-10-01' }
  const pending = { ...base, index: 2, actionStatus: 'planned', reviewDate: '2026-10-04' }
  const revisit = { ...base, index: 3, actionStatus: 'revisit', reviewDate: '2026-10-03' }
  const future = { ...base, index: 4, actionStatus: 'planned', reviewDate: '2026-10-08' }
  const sorted = bookJournalActions([tried, future, pending, revisit], '2026-10-05')
  assert.deepEqual(sorted.map((entry) => entry.index), [3, 2, 4, 1])
  assert.equal(sorted.at(-1).actionStatus, 'tried')
})
