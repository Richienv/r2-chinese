import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewWriting, sentenceCount, writingTask } from '../src/lib/writing-review.ts'
import { compareReviews } from '../src/lib/review.ts'

const words = ['熟悉', '印象']
const clean = { verdict: 'no-known-errors', errors: [], looks: [], rulesChecked: 23 }
const review = (response, used, grammar = clean) => reviewWriting({ response, words, used, grammar })
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

test('every requirement is checked on its own, and grammar is just one of them', () => {
  const result = review('我对这里印象很深。', ['印象'])
  assert.equal(find(result, 'mandarin').status, 'pass')
  assert.equal(find(result, 'sentences').status, 'partial')
  assert.equal(find(result, 'words').status, 'partial')
  assert.match(find(result, 'words').fix, /熟悉/)
  assert.equal(find(result, 'grammar').status, 'pass')
  assert.equal(result.verdict, 'revise')
  assert.equal(result.issues[0].id, 'sentences', 'instruction problems come first')
})

test('a clean grammar result says how narrow the check is, and is never worded as "correct"', () => {
  const grammar = find(review('我熟悉这里。我对这里印象很深。', words), 'grammar')
  assert.equal(grammar.label, 'No common grammar mistakes')
  assert.equal(grammar.found, 'None of 23 common patterns matched')
  assert.doesNotMatch(`${grammar.label} ${grammar.found} ${grammar.expected}`, /correct/i)
})

test('grammar that has not been checked is unverified, never a pass', () => {
  const none = review('我熟悉这里。我对这里印象很深。', words, null)
  assert.equal(find(none, 'grammar').status, 'unverified')
  assert.equal(none.verdict, 'unverified')
  const notChinese = review('I know this place. I like it.', [], { verdict: 'not-chinese', errors: [], looks: [], rulesChecked: 23 })
  assert.equal(find(notChinese, 'grammar').status, 'unverified')
  assert.equal(notChinese.verdict, 'revise')
})

test('a draft passes only when no known mistake is found and every requirement holds', () => {
  const text = '我熟悉这里。我对这里印象很深。'
  assert.equal(review(text, words).verdict, 'passed')
  const wrong = review(text, words, { verdict: 'errors', errors: ['“累很” → “很累”. The degree word goes before the adjective.'], looks: [], rulesChecked: 23 })
  assert.equal(wrong.verdict, 'revise')
  assert.equal(find(wrong, 'grammar').status, 'fail')
  assert.match(find(wrong, 'grammar').fix, /degree word/)
  assert.equal(find(wrong, 'grammar').found, '1 mistake found')
})

test('something that is only worth a look is shown but never fails the task', () => {
  const look = review('我熟悉这里。我对这里印象很深。', words, { verdict: 'worth-a-look', errors: [], looks: ['“或者” → “还是”.'], rulesChecked: 23 })
  assert.equal(look.verdict, 'passed')
  const note = find(look, 'grammar-look')
  assert.equal(note.decisive, false)
  assert.equal(note.status, 'partial')
  assert.match(look.nextStep, /Optional/)
})

test('a revision reports what was fixed', () => {
  const before = review('我熟悉这里。', ['熟悉'])
  const after = review('我熟悉这里。我对这里印象很深。', words)
  const change = compareReviews(before, after)
  assert.deepEqual(change.fixed.map((check) => check.id).sort(), ['sentences', 'words'])
})
