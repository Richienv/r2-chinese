import test from 'node:test'
import assert from 'node:assert/strict'
import { withLang } from '../src/lib/i18n.ts'
import { compareReviews, describeComparison } from '../src/lib/review.ts'
import { describeStroke } from '../src/lib/handwriting-review.ts'
import { drawingTask, redrawLabel } from '../src/lib/drawing-flow.ts'
import { sourceAssessment } from '../src/lib/production.ts'
import { reviewReply } from '../src/lib/reply-review.ts'
import { reviewWriting, writingTask } from '../src/lib/writing-review.ts'
import { buildRecheck, reviewRecheck } from '../src/lib/dialogue-check.ts'
import { AssessmentServiceError } from '../src/lib/assessmentService.ts'

/** Words that only the English templates use. Indonesian text, Hanzi and data never contain them. */
const LEFTOVER = /\b(the|and|your|you|to|of|is|are|with|from|not|this|that|it|was|word|words|sentence|sentences|requirement|requirements|fix|check|checked|answer|answered|try|again|missing|reply|book|used|none|passed|optional|next)\b/i

/** Every sentence a learner can read in a review. */
function visibleText(review) {
  return [review.headline, review.nextStep, ...review.checks.flatMap((check) => [check.label, check.found, check.expected, check.fix ?? ''])]
}

function assertIndonesian(review) {
  for (const text of visibleText(review)) {
    assert.doesNotMatch(text, /[{}]/, `a placeholder was left unfilled: ${text}`)
    assert.doesNotMatch(text, LEFTOVER, `English template text is left in: ${text}`)
  }
}

const expectedZh = '我们应该遵守法律。'
const glosses = { 遵守: 'mematuhi', 法律: 'hukum' }
const prompt = (response) => ({ expectedZh, expectedEn: 'Kita harus menaati hukum.', response, targetWords: ['遵守', '法律'] })

test('a reply review reads in Indonesian, with the headline, next step and every check filled in', () => {
  withLang('id', () => {
    const response = '我们应该守法'
    const review = reviewReply({ task: 'Balas sebagai pembicara kedua', response, expectedZh, glosses, assessment: sourceAssessment(prompt(response)) })
    assert.equal(review.verdict, 'revise')
    assert.equal(review.headline, '2 syarat yang perlu diperbaiki')
    assert.match(review.nextStep, /kata kunci dari kalimat di buku/)
    assert.match(review.nextStep, /“mematuhi” dan “hukum”/, 'the missing words are pointed at by meaning, joined with Indonesian "dan"')
    assertIndonesian(review)

    const perfect = '我们应该遵守法律'
    const passed = reviewReply({ task: 'Balas sebagai pembicara kedua', response: perfect, expectedZh, glosses, assessment: sourceAssessment(prompt(perfect)) })
    assert.equal(passed.verdict, 'passed')
    assert.equal(passed.headline, 'Semua 2 syarat terpenuhi')
    assert.equal(passed.nextStep, 'Gak ada yang perlu diperbaiki. Lanjut.')
    assertIndonesian(passed)
  })
})

test('a writing review reads in Indonesian and quotes the button it points at in Indonesian too', () => {
  withLang('id', () => {
    const words = ['熟悉', '印象']
    const review = reviewWriting({ response: '我熟悉这里。', words, used: ['熟悉'], grammar: null, reviewerAvailable: true })
    assert.equal(review.headline, '3 syarat yang perlu diperbaiki')
    assert.match(review.nextStep, /^Tambahkan satu kalimat lagi/)
    assert.match(review.checks.find((check) => check.id === 'grammar').fix, /“Cek kalimatku”/)
    assert.equal(review.task, writingTask(2))
    assert.match(review.task, /^Tulis 2 atau 3 kalimat Mandarin/)
    assertIndonesian(review)
  })
})

test('a dialogue recheck reads in Indonesian, from the question label to the book quote', () => {
  withLang('id', () => {
    const line = (speaker, zh, en) => ({ speaker, zh, pinyin: '', en })
    const text = {
      label: 'Teks 1', heading_zh: '', heading_en: '', type: 'dialogue',
      lines: [
        line('小明', '你好，你最近怎么样？', 'Hai, kabarmu gimana akhir-akhir ini?'),
        line('小红', '我最近很忙，要准备考试。', 'Aku lagi sibuk, mau menyiapkan ujian.'),
        line('小明', '你应该注意休息，别太累了。', 'Kamu harus istirahat, jangan terlalu capek.'),
        line('小红', '谢谢你的关心，我会注意的。', 'Makasih udah perhatian, aku bakal hati-hati.'),
        line('小明', '考试以后我们一起去爬山吧。', 'Habis ujian, yuk kita mendaki bareng.'),
        line('小红', '好主意，我很期待。', 'Ide bagus, aku nunggu-nunggu banget.'),
      ],
    }
    const words = [
      { zh: '准备', pinyin: 'zhǔnbèi', en: 'mempersiapkan', pos: 'v', note: '' }, { zh: '注意', pinyin: 'zhùyì', en: 'memperhatikan', pos: 'v', note: '' },
      { zh: '期待', pinyin: 'qīdài', en: 'menantikan', pos: 'v', note: '' }, { zh: '关心', pinyin: 'guānxīn', en: 'peduli', pos: 'v', note: '' },
    ]
    const questions = buildRecheck(text, words)
    const wordQuestion = questions.find((question) => question.kind === 'word')
    assert.match(wordQuestion.prompt, /^Kata mana yang pas/)
    assert.equal(wordQuestion.label, 'Kata kunci')
    const answers = questions.map((question) => ({ id: question.id, picked: question === wordQuestion ? question.options.find((option) => option !== question.answer) : question.answer }))
    const review = reviewRecheck('Cek dialog', questions, answers)
    assert.equal(review.headline, '1 syarat yang perlu diperbaiki')
    assert.match(review.nextStep, new RegExp(`^${wordQuestion.answer} \\(.+\\), .+\\. Di buku: `))
    assert.match(review.checks.find((check) => check.id === wordQuestion.id).label, /^Kata kunci: /)
    assertIndonesian(review)

    const unanswered = reviewRecheck('Cek dialog', questions, [])
    assert.equal(unanswered.nextStep, 'Jawab dulu pertanyaan yang tersisa sebelum dicek.')
    assert.equal(unanswered.checks[0].found, `0 dari ${questions.length} udah dijawab`)
    assertIndonesian(unanswered)
  })
})

test('the retest summary, stroke names, drawing task and service errors follow the language', () => {
  withLang('id', () => {
    const check = (id, status) => ({ id, stage: 'output', label: id, status, found: 'f', expected: 'e', decisive: true, fix: 'x' })
    const before = reviewReply({ task: 't', response: '我们应该守法', expectedZh, glosses, assessment: sourceAssessment(prompt('我们应该守法')) })
    const after = reviewReply({ task: 't', response: '我们应该遵守法律', expectedZh, glosses, assessment: sourceAssessment(prompt('我们应该遵守法律')) })
    assert.equal(describeComparison(compareReviews(before, after)), '2 sudah diperbaiki')
    assert.equal(describeComparison({ fixed: [check('a')], remaining: [check('b')], regressed: [check('c')] }), '1 sudah diperbaiki · 1 masih perlu diperbaiki · 1 jadi salah')
    assert.equal(describeComparison({ fixed: [], remaining: [], regressed: [] }), 'Gak ada perubahan dari percobaan terakhirmu')

    // Noun first, so the same word order works in both languages; "top left" flips to "kiri atas".
    assert.equal(describeStroke(Float32Array.from([0.2, 0.9, 0.8, 0.9])), 'goresan horizontal di bagian bawah')
    assert.equal(describeStroke(Float32Array.from([0.3, 0.1, 0.35, 0.3, 0.1, 0.5])), 'goresan turun ke kiri yang melengkung di kiri atas')

    assert.equal(drawingTask('meaning', { en: 'hukum', pinyin: 'fǎlǜ' }, 2), 'Gambar kata untuk “hukum” (2 karakter)')
    assert.equal(redrawLabel([0, 2], 3), 'Gambar ulang karakter 1 dan 3')
    assert.equal(redrawLabel([0, 1], 2), 'Gambar ulang katanya')
    assert.equal(new AssessmentServiceError('rate_limited').message, 'Beberapa pengecekan berjalan berdekatan. Tunggu semenit, lalu coba lagi.')
  })
  // Leaving Indonesian mode leaves nothing behind.
  assert.equal(describeStroke(Float32Array.from([0.2, 0.9, 0.8, 0.9])), 'horizontal stroke at the bottom')
  assert.equal(new AssessmentServiceError('rate_limited').message, 'A few checks ran close together. Wait a minute, then try again.')
})
