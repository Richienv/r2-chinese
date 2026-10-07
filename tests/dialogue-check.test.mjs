import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRecheck, retestQuestions, reviewRecheck } from '../src/lib/dialogue-check.ts'
import { compareReviews } from '../src/lib/review.ts'

const line = (speaker, zh, en) => ({ speaker, zh, pinyin: '', en })
const text = {
  label: 'Text 1', heading_zh: '', heading_en: '', type: 'dialogue',
  lines: [
    line('小明', '你好，你最近怎么样？', 'Hi, how have you been?'),
    line('小红', '我最近很忙，要准备考试。', 'I have been busy preparing for exams.'),
    line('小明', '你应该注意休息，别太累了。', 'You should rest, do not get too tired.'),
    line('小红', '谢谢你的关心，我会注意的。', 'Thanks for caring, I will watch out.'),
    line('小明', '考试以后我们一起去爬山吧。', 'Let us go hiking together after exams.'),
    line('小红', '好主意，我很期待。', 'Good idea, I am looking forward to it.'),
  ],
}
const words = [
  { zh: '准备', pinyin: 'zhǔnbèi', en: 'to prepare', pos: 'v', note: '' },
  { zh: '注意', pinyin: 'zhùyì', en: 'to pay attention', pos: 'v', note: '' },
  { zh: '期待', pinyin: 'qīdài', en: 'to look forward to', pos: 'v', note: '' },
  { zh: '关心', pinyin: 'guānxīn', en: 'to care about', pos: 'v', note: '' },
]

test('the check is built from the dialogue itself and is stable between renders', () => {
  const first = buildRecheck(text, words)
  assert.deepEqual(first.map((question) => question.id), buildRecheck(text, words).map((question) => question.id))
  assert.ok(first.length >= 3 && first.length <= 5)
  assert.ok(first.some((question) => question.kind === 'reply'))
  assert.ok(first.some((question) => question.kind === 'speaker'))
  assert.ok(first.some((question) => question.kind === 'word'))
  for (const question of first) {
    assert.ok(question.options.includes(question.answer), `${question.id}: the answer is among the options`)
    assert.equal(new Set(question.options).size, question.options.length, `${question.id}: no duplicate options`)
    assert.ok(question.options.length >= (question.kind === 'speaker' ? 2 : 3), `${question.id}: enough options`)
    assert.ok(question.explanation.length > 8, `${question.id}: the explanation quotes the book`)
  }
})

test('what came next never gives the answer away, and its distractors are lines the same speaker said', () => {
  const replies = buildRecheck(text, words).filter((question) => question.kind === 'reply')
  for (const question of replies) {
    const asked = text.lines.findIndex((entry) => entry.zh === question.context.zh)
    const speaker = text.lines[asked + 1].speaker
    assert.equal(question.answer, text.lines[asked + 1].zh)
    for (const option of question.options) assert.equal(text.lines.find((entry) => entry.zh === option).speaker, speaker, 'every option is something that speaker said')
    assert.notEqual(question.context.zh, question.answer)
  }
})

test('a key-word question blanks the word in its own line and keeps the answer among same-length words', () => {
  const question = buildRecheck(text, words).find((entry) => entry.kind === 'word')
  assert.match(question.context.zh, /＿＿/)
  assert.ok(!question.context.zh.includes(question.answer))
  assert.ok(text.lines.some((entry) => entry.zh.replace(question.answer, '＿＿') === question.context.zh))
  assert.ok(question.clue.length > 0)
  assert.equal(question.word, question.answer)
})

test('speaker questions are only asked when the book names the speakers', () => {
  const anonymous = { ...text, lines: text.lines.map((entry) => ({ ...entry, speaker: '' })) }
  assert.ok(!buildRecheck(anonymous, words).some((question) => question.kind === 'speaker'))
  assert.ok(buildRecheck(anonymous, words).some((question) => question.kind === 'reply'))
  assert.deepEqual(buildRecheck({ ...text, lines: text.lines.slice(0, 2) }, words), [], 'too short to check')
})

test('the report names each wrong choice and quotes the book, and an unanswered question is never a pass', () => {
  const questions = buildRecheck(text, words)
  const right = questions.map((question) => ({ id: question.id, picked: question.answer }))
  assert.equal(reviewRecheck('Check the dialogue', questions, right).verdict, 'passed')

  const wrong = right.map((answer, index) => index === 0 ? { id: answer.id, picked: questions[0].options.find((option) => option !== questions[0].answer) } : answer)
  const review = reviewRecheck('Check the dialogue', questions, wrong)
  assert.equal(review.verdict, 'revise')
  assert.equal(review.issues.length, 1)
  assert.equal(review.issues[0].id, questions[0].id)
  assert.equal(review.issues[0].expected, questions[0].answer)
  assert.equal(review.issues[0].fix, questions[0].explanation)

  const partial = reviewRecheck('Check the dialogue', questions, right.slice(1))
  assert.equal(partial.verdict, 'revise')
  assert.equal(partial.issues[0].id, 'answered-all', 'not answering is an instruction failure and comes first')
})

test('the retest asks only what was missed, in a different order, and shows what was fixed', () => {
  const questions = buildRecheck(text, words)
  const first = questions.map((question, index) => ({ id: question.id, picked: index < 2 ? question.options.find((option) => option !== question.answer) : question.answer }))
  const again = retestQuestions(questions, first, 1)
  assert.deepEqual(again.map((question) => question.id), questions.slice(0, 2).map((question) => question.id))
  for (const [index, question] of again.entries()) {
    assert.notDeepEqual(question.options, questions[index].options)
    assert.deepEqual([...question.options].sort(), [...questions[index].options].sort(), 'same options, new order')
  }
  const before = reviewRecheck('t', questions, first)
  const second = first.map((answer) => ({ ...answer, picked: questions.find((question) => question.id === answer.id).answer }))
  const change = compareReviews(before, reviewRecheck('t', questions, second))
  assert.equal(change.fixed.length, 2)
  assert.equal(change.remaining.length, 0)
})
