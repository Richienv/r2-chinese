import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { emptyEnglishPrepProgress, englishEvidence, englishEvidenceKey, englishPrepQueue, isEnglishPrepReady, JIAYIN_ENGLISH_KEY, nextEnglishQuestion, parseEnglishPrepProgress } from '../src/lib/jiayinEnglishPractice.ts'

const data = JSON.parse(readFileSync(new URL('../src/data/jiayin-english.json', import.meta.url)))
const source = JSON.parse(readFileSync(new URL('../src/data/jiayin.json', import.meta.url)))
const questions = data.questions
const intro = questions.find(q => q.id === 'intro')
const erp = questions.find(q => q.id === 'erp')
const attempt = (question, overrides = {}) => ({ at: 1000, seconds: 60, rating: 'ready', answer: 'My own English answer about the business problem and my contribution.', assisted: false, checks: question.criteria, evidence: question.evidenceFields.map(() => 'My actual project detail'), ...overrides })

test('English curriculum covers all five supplied MT strengths with valid optional Mandarin source links', () => {
  assert.equal(data.language, 'English')
  assert.equal(data.explanationLanguage, 'Indonesia')
  assert.equal(data.pillars.length, 5)
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length)
  const sources = new Set(source.units.flatMap(u => u.items.map(i => i.id)))
  for (const question of questions) {
    assert.ok(sources.has(question.sourceId), question.id)
    assert.ok(data.pillars.some(p => p.id === question.pillar))
    assert.ok(question.criteria.length >= 3)
    assert.ok(question.coachId && question.followupEn && question.outline.length)
    assert.doesNotMatch(question.questionEn + question.answerEn, /[\u3400-\u9fff]/)
  }
  assert.equal(questions.filter(q => q.priority).length, 12)
  assert.equal(data.resume.length, 6)
})

test('readiness requires an unassisted answer, every content criterion and complete original evidence', () => {
  assert.equal(isEnglishPrepReady(intro, attempt(intro)), true)
  assert.equal(isEnglishPrepReady(intro, attempt(intro, { assisted: true })), false)
  assert.equal(isEnglishPrepReady(intro, attempt(intro, { answer: ' ' })), false)
  assert.equal(isEnglishPrepReady(intro, attempt(intro, { checks: intro.criteria.slice(1) })), false)
  assert.equal(isEnglishPrepReady(intro, attempt(intro, { rating: 'supported' })), false)
  assert.equal(isEnglishPrepReady(erp, attempt(erp)), true)
  assert.equal(isEnglishPrepReady(erp, attempt(erp, { evidence: [] })), false)
  assert.equal(isEnglishPrepReady(erp, attempt(erp, { evidence: ['Real module', '', 'Verified result'] })), false)
})

test('reference exposure persists across close/reopen and legacy Mandarin saves cannot count as English readiness', () => {
  assert.notEqual(JIAYIN_ENGLISH_KEY, 'yulu.jiayin.v1')
  const old = { attempts: { q01: [{ at: 1000, rating: 3, assisted: false, answer: '你好', seconds: 45 }] }, lessonsDone: { q01: 1000 } }
  assert.deepEqual(parseEnglishPrepProgress(old).attempts.q01, [])
  const raw = { drafts: { intro: { answer: 'My draft', assisted: true, checks: [] } }, attempts: { intro: [attempt(intro, { assisted: true })] } }
  const reloaded = parseEnglishPrepProgress(JSON.parse(JSON.stringify(raw)))
  assert.equal(reloaded.drafts.intro.assisted, true)
  assert.equal(isEnglishPrepReady(intro, reloaded.attempts.intro[0]), false)
})

test('review keeps weak, assisted and unfinished answers without flooding the user with all unseen questions', () => {
  const progress = emptyEnglishPrepProgress()
  assert.deepEqual(englishPrepQueue(questions, progress, 'review'), [])
  progress.attempts.intro = [attempt(intro)]
  progress.attempts.erp = [attempt(erp, { rating: 'again', at: 500 })]
  progress.drafts.bridge = { answer: '', assisted: true, checks: [] }
  assert.deepEqual(englishPrepQueue(questions, progress, 'review').map(q => q.id), ['bridge', 'erp'])
  const mock = englishPrepQueue(questions, progress, 'mock')
  assert.equal(mock.length, 15)
  assert.deepEqual(mock.slice(-3).map(q => q.id), ['partner', 'first-30', 'funnel'])
  assert.equal(mock[0].id, 'intro')
})

test('corrupt saves are safe and original evidence remains separate from draft answers', () => {
  assert.deepEqual(parseEnglishPrepProgress(null), emptyEnglishPrepProgress())
  const progress = parseEnglishPrepProgress({ notes: { a: 2, b: 'keep' }, drafts: { bad: 5, intro: { answer: 'x', assisted: false, checks: [false, 'valid'] } }, attempts: { erp: [attempt(erp, { seconds: -1 }), attempt(erp)] } })
  assert.deepEqual(progress.notes, { b: 'keep' })
  assert.deepEqual(progress.drafts.intro.checks, ['valid'])
  assert.equal(progress.attempts.erp.length, 1)
  erp.evidenceFields.forEach((_, index) => { progress.notes[englishEvidenceKey(erp.id, index)] = `Actual detail ${index}` })
  assert.deepEqual(englishEvidence(erp, progress), ['Actual detail 0', 'Actual detail 1', 'Actual detail 2'])
})

test('finishing a weak one-question sitting offers a different route instead of reopening its finished overlay', () => {
  const progress = emptyEnglishPrepProgress()
  progress.attempts.intro = [attempt(intro, { rating: 'again' })]
  assert.equal(nextEnglishQuestion(questions, progress, 'intro').id, 'stakeholders')
  for (const q of questions.filter(q => q.priority && q.id !== 'intro')) progress.attempts[q.id] = [attempt(q)]
  assert.equal(nextEnglishQuestion(questions, progress, 'intro'), undefined)
  assert.equal(nextEnglishQuestion(questions, progress, 'funnel').id, 'intro')
})
