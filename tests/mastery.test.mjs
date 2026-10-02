import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encounter, matchesHanzi, newMastery, normalizeMastery, recordRetrieval } from '../src/lib/mastery.ts'

const day1 = new Date(2026, 9, 3, 10).getTime()
const day2 = new Date(2026, 9, 4, 10).getTime()
const day3 = new Date(2026, 9, 5, 10).getTime()
const recalled = { correct: true, mode: 'recall' }

function produce(record, times, now = day1) {
  for (let i = 0; i < times; i++) record = recordRetrieval(record, recalled, now + i)
  return record
}

test('encounters save exposure without inventing attempts or repeated daily reps', () => {
  const initial = newMastery('安排', 2, day1)
  const reopened = encounter(initial, '安排', 2, day1 + 1000)
  assert.equal(reopened.encounters, 1)
  assert.equal(reopened.attempts, 0)
  assert.equal(reopened.state, 'new')
  assert.equal(encounter(reopened, '安排', 2, day2).encounters, 2)
  assert.equal(initial.lastSeen, day1, 'the original record is not mutated')
})

test('recognition never qualifies as unaided production, even across many days', () => {
  let record = newMastery('安排', 2, day1)
  for (const day of [day1, day2, day3]) {
    for (let i = 0; i < 10; i++) record = recordRetrieval(record, { correct: true, mode: 'recognition' }, day)
  }
  assert.equal(record.attempts, 30)
  assert.equal(record.successes, 30)
  assert.equal(record.unaidedSuccesses, 0)
  assert.deepEqual(record.successDays, [])
  assert.equal(record.state, 'learning')
})

test('massed same-day production stays learning regardless of repetition count', () => {
  const record = produce(newMastery('安排', 2, day1), 20)
  assert.equal(record.unaidedSuccesses, 20)
  assert.equal(record.successDays.length, 1)
  assert.equal(record.state, 'learning')
})

test('mastery requires at least three unaided productions across two days', () => {
  const initial = newMastery('安排', 2, day1)
  const first = recordRetrieval(initial, recalled, day1)
  const second = recordRetrieval(first, { correct: true, mode: 'speaking' }, day2)
  assert.equal(second.state, 'learning', 'two successful days alone are insufficient')
  const third = recordRetrieval(second, { correct: true, mode: 'writing' }, day2 + 1000)
  assert.equal(third.state, 'mastered')
  assert.equal(third.unaidedSuccesses, 3)
  assert.equal(third.lastPractice, day2 + 1000)
  assert.equal(third.modes.recall.successes, 1)
  assert.equal(third.modes.speaking.successes, 1)
  assert.equal(third.modes.writing.successes, 1)
  assert.equal(initial.attempts, 0, 'updates are immutable')
})

test('an error immediately regresses mastery and requires fresh evidence', () => {
  const mastered = recordRetrieval(produce(newMastery('安排', 2, day1), 2), recalled, day2)
  const missed = recordRetrieval(mastered, { correct: false, mode: 'recall' }, day2 + 1000)
  assert.equal(missed.state, 'hard')
  assert.equal(missed.unaidedSuccesses, 0)
  assert.deepEqual(missed.successDays, [])
  const repairedToday = produce(missed, 3, day2 + 2000)
  assert.equal(repairedToday.state, 'learning')
  assert.equal(recordRetrieval(repairedToday, recalled, day3).state, 'mastered')
})

test('a correct assisted answer regresses mastery rather than laundering a hint into success', () => {
  const mastered = recordRetrieval(produce(newMastery('安排', 2, day1), 2), recalled, day2)
  const hinted = recordRetrieval(mastered, { correct: true, assisted: true, mode: 'recall' }, day2 + 1000)
  assert.equal(hinted.state, 'hard')
  assert.equal(hinted.hints, 1)
  assert.equal(hinted.successes, 4, 'correct assisted answers remain visible in attempt statistics')
  assert.equal(hinted.unaidedSuccesses, 0)
  assert.deepEqual(hinted.successDays, [])
})

test('recognition after a miss does not remove the needs-practice state', () => {
  const missed = recordRetrieval(newMastery('安排', 2, day1), { correct: false, mode: 'recall' }, day1)
  const recognised = recordRetrieval(missed, { correct: true, mode: 'recognition' }, day2)
  assert.equal(recognised.state, 'hard')
  assert.equal(recognised.unaidedSuccesses, 0)
})

test('old review cards and favourites migrate to a trail with no inferred mastery', () => {
  const records = normalizeMastery(undefined, { 安排: { lesson: 2 } }, ['准备'], day1)
  assert.deepEqual(Object.keys(records).sort(), ['准备', '安排'])
  assert.equal(records.安排.lesson, 2)
  assert.equal(records.安排.state, 'new')
  assert.equal(records.准备.attempts, 0)
})

test('normalization rejects an unsupported mastered label and duplicate day evidence', () => {
  const records = normalizeMastery({
    安排: { state: 'mastered', attempts: 3, successes: 3, unaidedSuccesses: 3, successDays: ['2026-10-03', '2026-10-03'] },
    准备: { state: 'mastered', attempts: 0, unaidedSuccesses: 9, successDays: ['2026-10-03', '2026-10-04'] },
  }, {}, [], day1)
  assert.equal(records.安排.state, 'learning')
  assert.equal(records.准备.state, 'new')
  assert.equal(records.准备.unaidedSuccesses, 0)
})

test('Hanzi checking accepts only the target characters with harmless punctuation', () => {
  assert.equal(matchesHanzi(' 安排。 ', '安排'), true)
  assert.equal(matchesHanzi('安排！', '安排'), true)
  assert.equal(matchesHanzi('an pai', '安排'), false)
  assert.equal(matchesHanzi('准备', '安排'), false)
  assert.equal(matchesHanzi('', ''), false)
  assert.equal(matchesHanzi('按排', '安排'), false)
})
