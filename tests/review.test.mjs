import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReview, compareReviews, describeComparison, issuesOf, passedCount, verdictOf } from '../src/lib/review.ts'

const check = (id, status, extra = {}) => ({ id, stage: 'output', label: id, status, found: 'f', expected: 'e', decisive: true, ...extra })

test('a task passes only when every decisive check passes', () => {
  assert.equal(verdictOf([check('a', 'pass'), check('b', 'pass')]), 'passed')
  assert.equal(verdictOf([check('a', 'pass'), check('b', 'fail')]), 'revise')
  assert.equal(verdictOf([check('a', 'partial')]), 'revise', 'two of three words is not done')
  assert.equal(verdictOf([]), 'passed')
})

test('an unverifiable decisive check is never a pass, and a real failure outranks it', () => {
  assert.equal(verdictOf([check('a', 'pass'), check('grammar', 'unverified')]), 'unverified')
  assert.equal(verdictOf([check('a', 'fail'), check('grammar', 'unverified')]), 'revise')
})

test('coaching checks never change the verdict', () => {
  const coaching = check('strokes', 'partial', { decisive: false, fix: 'Count your strokes.' })
  assert.equal(verdictOf([check('shape', 'pass'), coaching]), 'passed')
  assert.equal(verdictOf([check('shape', 'fail'), coaching]), 'revise')
})

test('issues come in the order a learner should fix them: instruction first, worst first within a stage', () => {
  const checks = [
    check('grammar', 'unverified', { stage: 'output' }),
    check('words', 'partial', { stage: 'recall' }),
    check('mandarin', 'fail', { stage: 'instruction' }),
    check('shape', 'pass', { stage: 'output' }),
    check('count', 'fail', { stage: 'recall' }),
  ]
  assert.deepEqual(issuesOf(checks).map((entry) => entry.id), ['mandarin', 'count', 'words', 'grammar'])
})

test('the review states the requirement count and gives one concrete next step', () => {
  const failing = buildReview('Write 2-3 sentences', [
    check('count', 'fail', { stage: 'instruction', fix: 'Write at least two sentences.' }),
    check('words', 'partial', { stage: 'recall', fix: 'Add 熟悉.' }),
    check('mandarin', 'pass', { stage: 'instruction' }),
  ])
  assert.equal(failing.verdict, 'revise')
  assert.equal(failing.headline, '2 requirements to fix')
  assert.equal(failing.nextStep, 'Write at least two sentences.')
  assert.equal(failing.task, 'Write 2-3 sentences')
  assert.deepEqual(passedCount(failing), { passed: 1, total: 3 })

  const single = buildReview('x', [check('only', 'fail', { fix: 'Fix it.' })])
  assert.equal(single.headline, '1 requirement to fix')

  const clean = buildReview('x', [check('a', 'pass'), check('b', 'pass')])
  assert.equal(clean.headline, 'All 2 requirements met')
  assert.equal(clean.nextStep, 'Nothing to fix. Continue.')

  const withNote = buildReview('x', [check('a', 'pass'), check('strokes', 'partial', { decisive: false, fix: 'Check the stroke order.' })])
  assert.equal(withNote.verdict, 'passed')
  assert.match(withNote.nextStep, /Optional: Check the stroke order\./)
})

test('an unverified result says so rather than claiming success', () => {
  const review = buildReview('Reply in Mandarin', [check('mandarin', 'pass', { stage: 'instruction' }), check('grammar', 'unverified', { fix: 'Connect the grammar reviewer.' })])
  assert.equal(review.verdict, 'unverified')
  assert.match(review.headline, /cannot be verified/)
  assert.equal(review.nextStep, 'Connect the grammar reviewer.')
})

test('a retest reports what was fixed, what remains, and anything newly broken', () => {
  const before = buildReview('t', [check('a', 'fail', { fix: 'a' }), check('b', 'fail', { fix: 'b' }), check('c', 'pass')])
  const after = buildReview('t', [check('a', 'pass'), check('b', 'fail', { fix: 'b' }), check('c', 'fail', { fix: 'c' })])
  const comparison = compareReviews(before, after)
  assert.deepEqual(comparison.fixed.map((entry) => entry.id), ['a'])
  assert.deepEqual(comparison.remaining.map((entry) => entry.id), ['b'])
  assert.deepEqual(comparison.regressed.map((entry) => entry.id), ['c'])
  assert.equal(describeComparison(comparison), 'Fixed 1 · 1 still to fix · 1 newly wrong')
  const same = compareReviews(before, before)
  assert.equal(describeComparison({ fixed: [], remaining: [], regressed: [] }), 'No change from your last attempt')
  assert.equal(same.fixed.length, 0)
  assert.equal(same.remaining.length, 2)
})
