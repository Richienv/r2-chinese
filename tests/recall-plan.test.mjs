import test from 'node:test'
import assert from 'node:assert/strict'
import { BOOK_STYLE, bookOf, recallChoices, timelinePosition } from '../src/lib/recallPlan.ts'
import { DAY, newCard, recallChance, schedule, whenText } from '../src/lib/srs.ts'

test('each book has its own recall style, read from the card lesson offset', () => {
  assert.deepEqual(bookOf(4), { book: 'hsk', unit: 4 })
  assert.deepEqual(bookOf(1003), { book: 'kerja', unit: 3 })
  assert.deepEqual(bookOf(3012), { book: 'jiaocheng', unit: 12 })
  assert.equal(BOOK_STYLE.hsk, 'meaning')
  assert.equal(BOOK_STYLE.jiaocheng, 'dictation')
  assert.equal(BOOK_STYLE.kerja, 'sentence')
})

test('how badly a word was forgotten decides when it returns; hints push the date closer', () => {
  const allowed = ['again', 'hard', 'good', 'easy']
  const forgot = recallChoices({ failed: true, hints: 0, selfMode: false, allowed })
  assert.deepEqual(forgot.map((c) => [c.key, c.rating, c.delayDays]), [['blank', 'again', undefined], ['fuzzy', 'again', 1], ['almost', 'again', 2]])
  assert.deepEqual(recallChoices({ failed: false, hints: 1, selfMode: false, allowed }), [{ key: 'continue', rating: 'hard' }])
  assert.deepEqual(recallChoices({ failed: false, hints: 2, selfMode: false, allowed }), [{ key: 'continue', rating: 'hard', delayDays: 1 }])
  assert.deepEqual(recallChoices({ failed: false, hints: 0, selfMode: false, allowed }).map((c) => c.key), ['hard', 'good', 'easy'])
  assert.deepEqual(recallChoices({ failed: false, hints: 0, selfMode: true, allowed }).map((c) => c.key), allowed)
})

test('a chosen delay replaces the interval but the memory model still learns from the rating', () => {
  const now = Date.UTC(2026, 10, 17, 9)
  const card = newCard('熟悉', 1, now)
  const blank = schedule(card, 'again', now)
  const fuzzy = schedule(card, 'again', now, false, 1)
  assert.ok(blank.due - now < DAY)
  assert.equal(fuzzy.due, now + DAY)
  assert.equal(fuzzy.memory.stability, blank.memory.stability)
})

test('recall chance starts empty, is high right after a review and falls with time', () => {
  const now = Date.UTC(2026, 10, 17, 9)
  assert.equal(recallChance(newCard('熟悉', 1, now), now), null)
  const reviewed = schedule(newCard('熟悉', 1, now), 'good', now)
  const fresh = recallChance(reviewed, now + 60_000)
  const later = recallChance(reviewed, now + 30 * DAY)
  assert.ok(fresh > 0.95)
  assert.ok(later < fresh)
})

test('return dates read as words and sit on a log timeline', () => {
  const now = new Date(2026, 10, 17, 9).getTime()
  assert.equal(whenText(now + 10 * 60_000, now), 'in 10 min')
  assert.equal(whenText(now + DAY, now), 'tomorrow')
  assert.equal(whenText(now + 2 * DAY, now), 'the day after tomorrow')
  assert.equal(whenText(now + 5 * DAY, now), 'in 5 days')
  assert.equal(timelinePosition(now, now), 0)
  assert.ok(timelinePosition(now + DAY, now) < timelinePosition(now + 7 * DAY, now))
  assert.equal(timelinePosition(now + 400 * DAY, now), 1)
})
