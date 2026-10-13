import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { answerChunks, emptyJiayinProgress, parseJiayinProgress } from '../src/lib/jiayinPractice.ts'
import {
  appendJiayinRetry, buildJiayinLessons, buildJiayinLessonSteps, isJiayinExerciseIndependent,
  jiayinExerciseKey, jiayinLessonPrompt, jiayinLessonReviewSteps, jiayinSentence,
  nextJiayinLesson, nextJiayinLessonReview,
} from '../src/lib/jiayinLesson.ts'

const data = JSON.parse(readFileSync(new URL('../src/data/jiayin.json', import.meta.url)))
const lessons = buildJiayinLessons(data.units, data.extraVocab)
const makeAttempt = (overrides = {}) => ({ at: 1000, correct: true, assisted: false, evidence: 'source-match', ...overrides })

test('every source item has its own lesson, beginning with the manageable short introduction', () => {
  assert.equal(lessons.length, 73)
  assert.equal(lessons[0].id, 'intro-short')
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, 73)
  assert.deepEqual(lessons.filter(lesson => lesson.id.startsWith('q')).map(lesson => lesson.item.number), Array.from({ length: 48 }, (_, index) => index + 1))
  assert.equal(lessons.filter(lesson => lesson.item.hypothetical).length, 6)
})

test('each vocabulary recall word actually appears in its answer, with Indonesian meanings and provenance', () => {
  assert.ok(data.extraVocab.length >= 118)
  for (const lesson of lessons) {
    assert.ok(lesson.words.length >= 1 && lesson.words.length <= 4, lesson.id)
    assert.equal(new Set(lesson.words.map(word => word.zh)).size, lesson.words.length)
    for (const word of lesson.words) {
      assert.ok(lesson.item.answerZh.includes(word.zh), `${lesson.id} ${word.zh}`)
      assert.match(word.zh, /^[\u3400-\u9fff]+$/)
      assert.ok(word.id && word.pinyin && word.tip)
    }
  }
  for (const word of data.extraVocab) {
    const source = lessons.find(lesson => lesson.id === word.sourceItem)
    assert.ok(source.item.answerZh.includes(word.zh))
    assert.equal(source.item.page, word.page)
  }
})

test('all 217 source sentences are read and produced, without adding or paraphrasing Mandarin', () => {
  let count = 0
  for (const lesson of lessons) {
    const steps = buildJiayinLessonSteps(lesson)
    assert.equal(new Set(steps.map(step => step.id)).size, steps.length)
    const source = answerChunks(lesson.item.answerZh)
    assert.equal(steps.filter(step => step.kind === 'read').length, source.length)
    assert.equal(steps.filter(step => step.kind === 'sentence').length, source.length)
    for (const step of steps.filter(step => step.kind === 'sentence')) {
      const example = jiayinSentence(lesson, step.chunk)
      assert.equal(example.zh, source[step.chunk])
      assert.equal(example.en, lesson.item.chunkId[step.chunk])
      assert.equal(example.pinyin, lesson.item.chunkPinyin[step.chunk])
    }
    count += source.length
  }
  assert.equal(count, 217)
})

test('a reading interval separates vocabulary exposure from recall, then production and recheck follow', () => {
  for (const lesson of lessons) {
    const steps = buildJiayinLessonSteps(lesson)
    const firstWord = steps.findIndex(step => step.kind === 'word')
    const lastTeaching = steps.reduce((position, step, index) => step.kind === 'teach' ? index : position, -1)
    const firstSentence = steps.findIndex(step => step.kind === 'sentence')
    assert.ok(firstWord > lastTeaching)
    assert.ok(steps.slice(lastTeaching + 1, firstWord).some(step => step.kind === 'read'))
    assert.ok(firstSentence > firstWord)
    assert.ok(steps.findIndex(step => step.kind === 'answer') > firstSentence)
    assert.equal(steps[steps.length - 1].kind, 'complete')
  }
})

test('a weak exercise reappears after the other activities, once only, with stable source identity', () => {
  const base = buildJiayinLessonSteps(lessons[0])
  const word = base.find(step => step.kind === 'word')
  const updated = appendJiayinRetry(base, word)
  assert.equal(updated[updated.length - 2].id, `retry:${word.id}`)
  assert.equal(updated[updated.length - 2].word.zh, word.word.zh)
  assert.equal(updated[updated.length - 1].kind, 'complete')
  assert.deepEqual(appendJiayinRetry(updated, word), updated)
  assert.deepEqual(appendJiayinRetry(updated, updated[updated.length - 2]), updated)
  assert.equal(jiayinExerciseKey(`retry:${word.id}`), word.id)
})

test('verified language production differs from lesson completion, self ratings, and unverified practice', () => {
  const progress = emptyJiayinProgress()
  progress.lessonsDone.q01 = 1000
  progress.attempts.q01 = [{ at: 1000, rating: 3, assisted: false, answer: '我会分析。', seconds: 30 }]
  assert.equal(isJiayinExerciseIndependent(progress.exercises['answer:q01']?.[0]), false)
  assert.equal(isJiayinExerciseIndependent(makeAttempt()), true)
  assert.equal(isJiayinExerciseIndependent(makeAttempt({ assisted: true })), false)
  assert.equal(isJiayinExerciseIndependent(makeAttempt({ evidence: 'practice' })), false)
  assert.equal(isJiayinExerciseIndependent(makeAttempt({ correct: false })), false)
})

test('review starts with actual misses and assistance, without flooding it with every unseen exercise', () => {
  const progress = emptyJiayinProgress()
  const first = lessons[0]
  assert.deepEqual(jiayinLessonReviewSteps(first, progress, 1000), [])
  const step = buildJiayinLessonSteps(first).find(step => step.kind === 'word')
  progress.exercises[step.id] = [makeAttempt()]
  assert.deepEqual(jiayinLessonReviewSteps(first, progress, 1001), [])
  assert.equal(jiayinLessonReviewSteps(first, progress, 1000 + 86_400_000).length, 1)
  progress.exercises[step.id].push(makeAttempt({ assisted: true }))
  assert.equal(jiayinLessonReviewSteps(first, progress, 1001).length, 1)
  const later = lessons[40]
  progress.exercises[`answer:${later.id}`] = [makeAttempt({ correct: false })]
  assert.equal(nextJiayinLessonReview(lessons, progress, 1001).id, first.id)
  progress.exercises[step.id] = [makeAttempt()]
  assert.equal(nextJiayinLessonReview(lessons, progress, 1001).id, later.id)
})

test('legacy saves retain notes and attempts, without inventing new lesson or exercise completion', () => {
  const saved = { pathDone: { 1: ['context', 'words'] }, notes: { 'answer:q10': 'Actual evidence' }, attempts: { q01: [{ at: 1000, rating: 3, assisted: true, answer: '我的经验。', seconds: 20 }] } }
  const progress = parseJiayinProgress(saved)
  assert.deepEqual(progress.pathDone, saved.pathDone)
  assert.equal(progress.notes['answer:q10'], 'Actual evidence')
  assert.equal(progress.attempts.q01.length, 1)
  assert.deepEqual(progress.lessonsDone, {})
  assert.deepEqual(progress.exercises, {})
  assert.equal(nextJiayinLesson(lessons, progress).id, 'intro-short')
  progress.lessonsDone['intro-short'] = 2000
  assert.equal(nextJiayinLesson(lessons, progress).id, 'intro-long')
})

test('phrase and reverse-question production cue in Indonesian, hiding the target Mandarin', () => {
  for (const lesson of lessons.filter(lesson => /^(phrase|ask)/.test(lesson.id))) {
    const cue = jiayinLessonPrompt(lesson)
    assert.equal(cue.language, 'id')
    assert.ok(!/[\u3400-\u9fff]/.test(cue.text))
    assert.notEqual(cue.text, lesson.item.answerZh)
  }
})
