import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewWriting, sentenceCount, writingTask } from '../src/lib/writing-review.ts'
import { compareReviews } from '../src/lib/review.ts'

const words = ['熟悉', '印象']
const review = (response, used, grammar = null, reviewerAvailable = true) => reviewWriting({ response, words, used, grammar, reviewerAvailable })
const find = (result, id) => result.checks.find((check) => check.id === id)

test('sentences are counted by their endings, and a fragment with Hanzi still counts as one', () => {
  assert.equal(sentenceCount(''), 0)
  assert.equal(sentenceCount('我很熟悉这里。'), 1)
  assert.equal(sentenceCount('我很熟悉这里。你对这里印象怎么样？'), 2)
  assert.equal(sentenceCount('我很熟悉这里。你呢'), 2)
  assert.equal(sentenceCount('Hello. 你好！'), 1)
  assert.equal(sentenceCount('好！！！好？'), 2)
})

test('the task is restated with the word count', () => {
  assert.match(writingTask(3), /all 3 words/)
  assert.match(writingTask(1), /the word/)
})

test('every requirement is checked on its own before the reviewer ever runs', () => {
  const result = review('我对这里印象很深。', ['印象'])
  assert.equal(find(result, 'mandarin').status, 'pass')
  assert.equal(find(result, 'sentences').status, 'partial')
  assert.equal(find(result, 'words').status, 'partial')
  assert.match(find(result, 'words').fix, /熟悉/)
  assert.equal(find(result, 'grammar').status, 'unverified')
  assert.equal(result.verdict, 'revise')
  assert.equal(result.issues[0].id, 'sentences', 'instruction problems come first')
})

test('grammar is never passed without the reviewer, and the page says why', () => {
  const ready = review('我熟悉这里。我对这里印象很深。', words)
  assert.equal(ready.verdict, 'unverified')
  assert.match(find(ready, 'grammar').fix, /Check my sentences/)
  const offline = review('我熟悉这里。我对这里印象很深。', words, null, false)
  assert.equal(offline.verdict, 'unverified')
  assert.match(find(offline, 'grammar').fix, /not connected/)
})

test('a reviewed draft passes only when the reviewer accepts and every requirement holds', () => {
  const text = '我熟悉这里。我对这里印象很深。'
  assert.equal(review(text, words, { accepted: true, corrections: [] }).verdict, 'passed')
  const rejected = review(text, words, { accepted: false, corrections: ['对这里印象 → 对这里的印象: add 的 before the noun.'] })
  assert.equal(rejected.verdict, 'revise')
  assert.match(find(rejected, 'grammar').fix, /add 的/)
  assert.equal(review('I know this place. I like it.', [], { accepted: true, corrections: [] }).verdict, 'revise', 'an accepted draft in English is still not Mandarin')
})

test('a revision reports what was fixed', () => {
  const before = review('我熟悉这里。', ['熟悉'])
  const after = review('我熟悉这里。我对这里印象很深。', words)
  const change = compareReviews(before, after)
  assert.deepEqual(change.fixed.map((check) => check.id).sort(), ['sentences', 'words'])
})
