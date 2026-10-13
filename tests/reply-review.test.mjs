import test from 'node:test'
import assert from 'node:assert/strict'
import { assessProduction, sourceAssessment } from '../src/lib/production.ts'
import { reviewReply } from '../src/lib/reply-review.ts'
import { compareReviews } from '../src/lib/review.ts'

const expectedZh = '我们应该遵守法律。'
const prompt = (response) => ({ expectedZh, expectedEn: 'We should obey the law.', response, targetWords: ['遵守', '法律'] })
const task = 'Reply as the second speaker'
const glosses = { 遵守: 'to obey', 法律: 'law' }
const review = (response, assessment = assessProduction(prompt(response))) => reviewReply({ task, response, expectedZh, glosses, assessment })
const find = (result, id) => result.checks.find((check) => check.id === id)

test('the book sentence passes every requirement', () => {
  const result = review('我们应该遵守法律')
  assert.equal(result.verdict, 'passed')
  assert.equal(find(result, 'matches').found, 'Same Hanzi and word order')
  assert.equal(find(result, 'key-words').status, 'pass')
})

test('a different wording with every key word is unverified, not passed, when nothing can verify it', () => {
  const result = review('法律我们必须遵守')
  assert.equal(result.verdict, 'unverified')
  assert.equal(find(result, 'matches').status, 'unverified')
  assert.equal(find(result, 'key-words').status, 'pass')
  assert.match(find(result, 'matches').fix, /cannot be confirmed/)
})

test('a missing key word is named by meaning, not printed, and fails the review', () => {
  const result = review('我们应该守法')
  assert.equal(result.verdict, 'revise')
  const words = find(result, 'key-words')
  assert.equal(words.status, 'fail')
  assert.equal(words.decisive, true)
  assert.match(words.fix, /to obey/)
  assert.doesNotMatch(words.fix, /遵守/, 'the fix points at the word without giving it away')
  assert.equal(words.spoils, true)
  assert.equal(result.issues[0].id, 'key-words', 'recall problems come before the final result')
})

test('a partly recalled set of key words is partial', () => {
  const result = review('我们应该守法律')
  assert.equal(find(result, 'key-words').status, 'partial')
  assert.equal(find(result, 'key-words').found, 'Used 法律')
})

test('writing in English or not at all fails the instruction first', () => {
  const english = review('We should obey the law')
  assert.equal(english.verdict, 'revise')
  assert.equal(english.issues[0].id, 'mandarin')
  assert.equal(find(english, 'mandarin').status, 'fail')
  const mixed = review('我 should 遵守法律')
  assert.equal(find(mixed, 'mandarin').status, 'partial')
})

test('only the book sentence is ever confirmed correct; a different wording with no known mistake is never a pass', () => {
  const result = review('我们必须遵守法律')
  assert.equal(result.verdict, 'unverified')
  assert.equal(find(result, 'matches').status, 'unverified')
  assert.equal(find(result, 'key-words').status, 'pass')
})

test('a known mistake is named with its reason and the learner’s own sentence, fixed', () => {
  const result = review('我们应该遵守法律，我累很。')
  assert.equal(result.verdict, 'revise')
  assert.equal(find(result, 'matches').status, 'fail')
  assert.match(find(result, 'matches').fix, /degree word goes before the adjective/)
  assert.match(find(result, 'matches').fix, /Suggested: 我们应该遵守法律，我很累。/)
})

test('a mistake that needs rewording quotes the reason without printing the book reply', () => {
  const result = review('我们把法律遵守。')
  assert.equal(find(result, 'matches').status, 'unverified', 'a worth-a-look note is not a failure')
  assert.doesNotMatch(find(result, 'matches').fix ?? '', /我们应该遵守法律/)
})

test('the closeness check names what is missing and what is extra, and never decides the verdict', () => {
  const result = review('我们应该遵守法律吗')
  const closeness = find(result, 'closeness')
  assert.equal(closeness.decisive, false)
  assert.match(closeness.fix, /not in the book: 吗/)
  const after = review('我们应该遵守法律')
  assert.equal(find(after, 'closeness'), undefined, 'a matching reply needs no closeness coaching')
})

test('a retest shows what was fixed', () => {
  const before = review('我们应该守法')
  const after = review('我们应该遵守法律')
  const change = compareReviews(before, after)
  assert.ok(change.fixed.some((check) => check.id === 'key-words'))
  assert.ok(change.fixed.some((check) => check.id === 'matches'))
  assert.equal(change.regressed.length, 0)
})
