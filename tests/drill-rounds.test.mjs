import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addOutcome, classifyRound, cueForPass, hintLadder, nextStreak, pipState, planRounds, requeueRound, streakTier, wordsToRevisit,
} from '../src/lib/drillRounds.ts'

test('each pass over a word changes how it is asked: meaning, then sound, then pinyin', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((pass) => cueForPass(pass, true)), ['meaning', 'sound', 'pinyin', 'meaning', 'sound', 'pinyin'])
})

test('without sound the listening pass is asked by meaning instead of being skipped or silent', () => {
  assert.deepEqual([0, 1, 2].map((pass) => cueForPass(pass, false)), ['meaning', 'meaning', 'pinyin'])
})

test('a word queue becomes rounds whose cue follows how many times that word has come up', () => {
  const rounds = planRounds(['a', 'b', 'a', 'b', 'a', 'b'], true)
  assert.deepEqual(rounds.filter((round) => round.zh === 'a').map((round) => round.cue), ['meaning', 'sound', 'pinyin'])
  assert.deepEqual(rounds.filter((round) => round.zh === 'b').map((round) => round.cue), ['meaning', 'sound', 'pinyin'])
  assert.ok(rounds.every((round) => round.repair === false))
  assert.deepEqual(planRounds([], true), [])
})

test('a missed word returns a couple of rounds later with the easiest cue and never next to itself', () => {
  const rounds = planRounds(['a', 'b', 'c', 'a', 'b', 'c'], true)
  const again = requeueRound(rounds, 0, 'a')
  assert.equal(again.length, rounds.length + 1)
  assert.equal(again[0].zh, 'a')
  assert.deepEqual(again.slice(1, 3).map((round) => round.zh), ['b', 'a'])
  const inserted = again.find((round) => round.repair)
  assert.deepEqual(inserted, { zh: 'a', cue: 'meaning', repair: true })
  for (let i = 1; i < again.length; i++) assert.notEqual(again[i].zh, again[i - 1].zh)
  // The rounds already played are untouched.
  assert.deepEqual(again.slice(0, 1), rounds.slice(0, 1))
})

test('requeueing the final round of a single-word drill still works and avoids an immediate repeat', () => {
  const rounds = planRounds(['a', 'a', 'a'], true)
  const again = requeueRound(rounds, 2, 'a')
  assert.equal(again.length, 4)
  assert.equal(again[3].repair, true)
  const next = requeueRound(planRounds(['a', 'a'], true), 0, 'a')
  assert.equal(next.length, 3)
})

test('hints never repeat what the cue already shows, and always end by revealing the word', () => {
  assert.deepEqual(hintLadder('meaning'), ['first', 'pinyin', 'word'])
  assert.deepEqual(hintLadder('sound'), ['meaning', 'first', 'word'])
  assert.deepEqual(hintLadder('pinyin'), ['meaning', 'first', 'word'])
  for (const cue of ['meaning', 'sound', 'pinyin']) {
    const ladder = hintLadder(cue)
    assert.equal(ladder.at(-1), 'word')
    assert.equal(new Set(ladder).size, ladder.length)
  }
})

test('a wrong check makes the round a miss even if the learner then succeeds with help', () => {
  assert.equal(classifyRound({ missed: false, assisted: false }), 'unaided')
  assert.equal(classifyRound({ missed: false, assisted: true }), 'assisted')
  assert.equal(classifyRound({ missed: true, assisted: false }), 'missed')
  assert.equal(classifyRound({ missed: true, assisted: true }), 'missed')
})

test('the flow streak counts unaided successes and any help or miss ends it', () => {
  let streak = 0
  for (const result of ['unaided', 'unaided', 'unaided']) streak = nextStreak(streak, result)
  assert.equal(streak, 3)
  assert.equal(nextStreak(streak, 'assisted'), 0)
  assert.equal(nextStreak(streak, 'missed'), 0)
  assert.deepEqual([0, 2, 3, 4, 5, 7, 8, 20].map(streakTier), [0, 0, 1, 1, 2, 2, 3, 3])
})

test('per word outcomes keep counts and the latest result, and pips never reveal an unplayed word', () => {
  let outcomes = {}
  outcomes = addOutcome(outcomes, 'a', 'missed')
  outcomes = addOutcome(outcomes, 'a', 'unaided')
  outcomes = addOutcome(outcomes, 'b', 'assisted')
  assert.deepEqual(outcomes.a, { unaided: 1, assisted: 0, missed: 1, last: 'unaided' })
  assert.deepEqual(outcomes.b, { unaided: 0, assisted: 1, missed: 0, last: 'assisted' })
  assert.equal(pipState(outcomes.a, false), 'unaided')
  assert.equal(pipState(outcomes.b, false), 'assisted')
  assert.equal(pipState(undefined, false), 'waiting')
  assert.equal(pipState(outcomes.a, true), 'current')
})

test('the words to revisit are those whose latest round was not an unaided success', () => {
  let outcomes = {}
  outcomes = addOutcome(outcomes, 'a', 'missed')
  outcomes = addOutcome(outcomes, 'a', 'unaided')
  outcomes = addOutcome(outcomes, 'b', 'unaided')
  outcomes = addOutcome(outcomes, 'b', 'missed')
  outcomes = addOutcome(outcomes, 'c', 'assisted')
  assert.deepEqual(wordsToRevisit(outcomes, ['a', 'b', 'c', 'd']), ['b', 'c'])
  assert.deepEqual(wordsToRevisit({}, ['a']), [])
})
