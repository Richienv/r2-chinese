import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  answerChunks, buildJiayinQuiz, emptyJiayinProgress, isUnaidedAttempt,
  JIAYIN_STAGES, needsJiayinReview, nextJiayinStage, parseJiayinProgress, selectJiayinMock,
  isJiayinAssemblyCorrect, isJiayinRetained, jiayinBuildParts, jiayinReviewDays,
  selectJiayinReview, shuffledJiayinParts,
  jiayinEvidenceNotes, jiayinRecallPrompt, passesJiayinCheck, passesJiayinRecall,
} from '../src/lib/jiayinPractice.ts'

const data = JSON.parse(readFileSync(new URL('../src/data/jiayin.json', import.meta.url)))
const items = data.units.flatMap(u => u.items)
const question = items.find(q => q.id === 'q10')
const attempt = (props = {}) => ({ at: 1000, rating: 3, assisted: false, answer: '我的贡献是需求协调。', seconds: 60, ...props })

test('covers all 48 source questions once, all cases, and all printed language aids', () => {
  assert.deepEqual(items.filter(q => q.number && !q.hypothetical).map(q => q.number), Array.from({ length: 48 }, (_, i) => i + 1))
  assert.equal(items.filter(q => q.hypothetical).length, 6)
  assert.equal(items.filter(q => q.id.startsWith('phrase')).length, 8)
  assert.equal(items.filter(q => q.id.startsWith('ask')).length, 8)
  assert.equal(new Set(data.units.flatMap(u => u.vocab.map(w => w.zh))).size, 25)
  assert.equal(new Set(items.map(q => q.id)).size, items.length)
  for (const item of items) {
    for (const field of ['questionZh', 'questionId', 'answerZh', 'answerId', 'coach']) assert.ok(item[field]?.trim(), `${item.id}: ${field}`)
    assert.ok(item.page >= 4 && item.page <= 28)
  }
})

test('retains factual distinctions and real-story gaps instead of filling them', () => {
  const q = id => items.find(item => item.id === id)
  assert.match(q('q09').answerZh, /IT Staff.*IT Specialist/)
  assert.match(q('q09').answerZh, /不是公司的 CTO/)
  assert.match(q('q13').answerZh, /8 个月、10 人团队.*100/)
  assert.match(q('q41').answerZh, /2027 年 5 月 1 日/)
  assert.match(q('q43').answerZh, /HSK 3-4/)
  assert.equal(q('q34').needsEvidence, true)
  assert.match(q('q34').coach, /belum mengisi kejadian/)
  assert.equal(q('q33').needsEvidence, true)
  assert.equal(data.company.length, 7)
  assert.ok(data.company.every(s => /[\u3400-\u9fff]/.test(s.zh)))
  assert.ok(data.company.find(s => s.heading.includes('Kaitan Indonesia')).id.includes('21%'))
})

test('translation checks have an unambiguous answer; duplicate opening prompts are excluded', () => {
  for (const unit of data.units) for (const quiz of buildJiayinQuiz(unit)) {
    assert.ok(quiz.choices.length >= 3)
    assert.equal(new Set(quiz.choices).size, quiz.choices.length, quiz.id)
    assert.ok(quiz.answer >= 0 && quiz.answer < quiz.choices.length)
    assert.ok(quiz.explanation.trim())
  }
  assert.ok(buildJiayinQuiz(data.units[0]).every(q => q.id.startsWith('word:')))
  const unit = data.units.find(u => u.items.some(q => q.id === 'q22'))
  const quiz = buildJiayinQuiz(unit).find(q => q.id === 'question:q22')
  assert.equal(quiz.choices[quiz.answer], items.find(q => q.id === 'q22').questionId)
})

test('reading a reference or using notes cannot become unaided recall', () => {
  assert.equal(isUnaidedAttempt(attempt()), true)
  assert.equal(isUnaidedAttempt(attempt({ assisted: true })), false)
  assert.equal(isUnaidedAttempt(attempt({ rating: 2 })), false)
  assert.equal(isUnaidedAttempt(attempt({ answer: '  ' })), false)
  assert.equal(isUnaidedAttempt(undefined), false)
})

test('review includes unseen, assisted and weak attempts, then returns after one day', () => {
  const progress = emptyJiayinProgress()
  assert.equal(needsJiayinReview(question, progress, 1000), true)
  progress.attempts.q10 = [attempt()]
  assert.equal(needsJiayinReview(question, progress, 1001), false)
  assert.equal(needsJiayinReview(question, progress, 1000 + 86_400_000), true)
  progress.attempts.q10.push(attempt({ assisted: true }))
  assert.equal(needsJiayinReview(question, progress, 1001), true)
})

test('mock prioritizes weak answers, includes three hypothetical cases, and does not repeat questions', () => {
  const progress = emptyJiayinProgress()
  progress.attempts.q48 = [attempt({ rating: 1 })]
  progress.attempts.q01 = [attempt()]
  const selected = selectJiayinMock(items, progress)
  assert.equal(selected.length, 15)
  assert.equal(selected[0].id, 'q48')
  assert.equal(selected.filter(q => q.hypothetical).length, 3)
  assert.equal(new Set(selected.map(q => q.id)).size, 15)
  assert.equal(selected.some(q => q.id === 'q01'), false)
  progress.attempts.case6 = [attempt({ rating: 1 })]
  assert.equal(selectJiayinMock(items, progress).find(q => q.hypothetical).id, 'case6')
  progress.attempts.case6 = [attempt()]
  progress.attempts.case1 = [attempt()]
  progress.attempts.case2 = [attempt()]
  progress.attempts.case3 = [attempt()]
  assert.deepEqual(selectJiayinMock(items, progress).filter(q => q.hypothetical).map(q => q.id), ['case4', 'case5', 'case1'])
})

test('course stages advance independently and malformed saves do not gain completion', () => {
  const progress = parseJiayinProgress({ pathDone: { 1: ['words', 'invented', 'words'] }, notes: { true: 23, example: 'My original story' }, attempts: { q10: [attempt(), { rating: 3 }] } })
  assert.deepEqual(progress.pathDone['1'], ['words'])
  assert.equal(progress.notes.example, 'My original story')
  assert.equal(progress.notes.true, undefined)
  assert.equal(progress.attempts.q10.length, 1)
  assert.deepEqual(nextJiayinStage(data.units, progress), { unit: 1, stage: 'context' })
  progress.pathDone['1'].push('context')
  assert.deepEqual(nextJiayinStage(data.units, progress), { unit: 1, stage: 'answers' })
  progress.pathDone['1'] = [...JIAYIN_STAGES]
  assert.deepEqual(nextJiayinStage(data.units, progress), { unit: 2, stage: 'context' })
  assert.deepEqual(parseJiayinProgress(null), emptyJiayinProgress())
})

test('progressive answer chunks reconstruct the exact source answer and align every pinyin aid', () => {
  for (const item of items) {
    const chunks = answerChunks(item.answerZh)
    assert.equal(chunks.join(''), item.answerZh)
    assert.equal(item.chunkPinyin.length, chunks.length, item.id)
    assert.equal(item.chunkId.length, chunks.length, item.id)
    assert.ok(item.chunkId.every(line => line.trim()), item.id)
    assert.ok(item.questionPinyin && item.chunkPinyin.every(p => p.trim()))
    assert.ok(item.pinyinSource)
  }
})

test('Indonesian teaching is complete and every question has specific judgement criteria', () => {
  assert.equal(data.language, 'id')
  assert.equal(data.units.length * JIAYIN_STAGES.length, 96)
  for (const unit of data.units) {
    assert.ok(unit.teaching.goal && unit.teaching.scenario && unit.teaching.reason && unit.teaching.task)
    assert.ok(unit.teaching.route.length >= 3 && unit.teaching.pitfalls.length >= 2)
    for (const word of unit.vocab) assert.ok(word.tip && word.id)
    for (const item of unit.items) {
      assert.ok(item.intent && item.followup)
      assert.equal(item.criteria.length, 3)
    }
  }
  assert.match(items.find(item => item.id === 'q12').criteria.join(' '), /sampel|kondisi|ukuran/)
  assert.match(items.find(item => item.id === 'q41').criteria.join(' '), /1 Mei 2027/)
  assert.match(items.find(item => item.id === 'q18').questionId, /diluncurkan/)
  assert.ok(buildJiayinQuiz(data.units[1]).some(quiz => quiz.id === 'question:q04'))
  assert.ok(buildJiayinQuiz(data.units[14]).some(quiz => quiz.id === 'question:phrase8'))
})

test('assembly exercises preserve source text, reject missing/repeated blocks, and accept equivalent blocks', () => {
  for (const item of items) {
    const parts = jiayinBuildParts(item)
    const correct = parts.map((_, index) => index)
    assert.ok(parts.length >= 2, item.id)
    assert.equal(parts.join(''), item.answerZh, item.id)
    const shuffled = shuffledJiayinParts(parts, item.id)
    assert.deepEqual([...shuffled].sort((a, b) => a - b), correct)
    assert.notDeepEqual(shuffled, correct, item.id)
    assert.equal(isJiayinAssemblyCorrect(parts, correct, item.answerZh), true)
    assert.equal(isJiayinAssemblyCorrect(parts, correct.slice(1), item.answerZh), false)
    assert.equal(isJiayinAssemblyCorrect(parts, correct.map(() => 0), item.answerZh), false)
  }
  assert.equal(isJiayinAssemblyCorrect(['同。', '同。'], [1, 0], '同。同。'), true)
  assert.equal(isJiayinAssemblyCorrect(['甲。', '乙。'], [1, 0], '甲。乙。'), false)
  assert.equal(isJiayinAssemblyCorrect(['甲。', '乙。'], [-1, 1], '甲。乙。'), false)
})

test('review interval grows across distinct days, with weak attempts resetting it', () => {
  const monday = Date.parse('2026-10-12T12:00:00+08:00')
  const history = [attempt({ at: monday }), attempt({ at: monday + 1000 })]
  assert.equal(jiayinReviewDays(history), 1)
  assert.equal(isJiayinRetained(history), false)
  history.push(attempt({ at: monday + 86_400_000 }))
  assert.equal(jiayinReviewDays(history), 2)
  assert.equal(isJiayinRetained(history), true)
  const progress = emptyJiayinProgress(); progress.attempts.q10 = history
  assert.equal(needsJiayinReview(question, progress, monday + 2 * 86_400_000), false)
  assert.equal(needsJiayinReview(question, progress, monday + 3 * 86_400_000), true)
  history.push(attempt({ at: monday + 3 * 86_400_000 }))
  assert.equal(jiayinReviewDays(history), 4)
  history.push(attempt({ at: monday + 4 * 86_400_000, assisted: true }))
  assert.equal(jiayinReviewDays(history), 1)
  assert.equal(isJiayinRetained(history), false)
})

test('review queue cannot hide weak later questions behind unseen early questions', () => {
  const progress = emptyJiayinProgress()
  progress.attempts.q48 = [attempt({ rating: 1 })]
  progress.attempts.q47 = [attempt({ assisted: true })]
  progress.attempts.q01 = [attempt()]
  const review = selectJiayinReview(items, progress, 1000 + 86_400_000, 3)
  assert.deepEqual(review.map(item => item.id), ['q47', 'q48', 'q01'])
})

test('recall completion requires every answer unaided and real evidence notes where required', () => {
  const unit = data.units[3]
  const progress = emptyJiayinProgress()
  assert.equal(passesJiayinRecall(unit.items, progress), false)
  for (const item of unit.items) progress.attempts[item.id] = [attempt()]
  assert.equal(passesJiayinRecall(unit.items, progress), false)
  for (const item of unit.items) if (item.needsEvidence) progress.notes[`answer:${item.id}`] = 'Original evidence supplied by the learner'
  assert.equal(passesJiayinRecall(unit.items, progress), true)
  progress.attempts[unit.items[0].id].push(attempt({ assisted: true }))
  assert.equal(passesJiayinRecall(unit.items, progress), false)
  assert.equal(passesJiayinRecall([], progress), false)
})

test('graded stages need complete first-attempt scores at or above 80 percent', () => {
  assert.equal(passesJiayinCheck([true, true, true, true, false], 5), true)
  assert.equal(passesJiayinCheck([true, true, true, false, false], 5), false)
  assert.equal(passesJiayinCheck([true, true, true, true], 5), false)
  assert.equal(passesJiayinCheck([], 0), false)
  assert.equal(passesJiayinCheck([true, true, false], 3), false)
})

test('real worksheets feed linked answer notes without copying unrelated stories or inventing content', () => {
  const progress = emptyJiayinProgress()
  assert.equal(jiayinEvidenceNotes('q10', progress, data.worksheets), '')
  progress.notes['worksheet:erp:0'] = 'My actual module and users'
  assert.match(jiayinEvidenceNotes('q10', progress, data.worksheets), /Modul dan pengguna: My actual module and users/)
  assert.equal(jiayinEvidenceNotes('q34', progress, data.worksheets), '')
  progress.notes['answer:q10'] = 'My edited personal answer'
  assert.equal(jiayinEvidenceNotes('q10', progress, data.worksheets), 'My edited personal answer')
})

test('phrase and interviewer-question recall never expose their Mandarin reference as the cue', () => {
  for (const item of items.filter(item => /^(phrase|ask)/.test(item.id))) {
    const cue = jiayinRecallPrompt(item)
    assert.equal(cue.language, 'id')
    assert.equal(cue.text, item.questionId)
    assert.notEqual(cue.text, item.answerZh)
    assert.ok(!/[\u3400-\u9fff]/.test(cue.text))
  }
  assert.deepEqual(jiayinRecallPrompt(question), { text: question.questionZh, language: 'zh-CN' })
})
