import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { highlightWords, MAX_HINT_LENGTH, writingHints } from '../src/lib/writing-hints.ts'

const line = (zh, en = zh) => ({ zh, pinyin: '', en })
const lesson = ({ dialogue = [], passage = [], grammar = [], sameChar = [] }) => ({
  texts: [{ type: 'dialogue', lines: dialogue.map((zh) => line(zh)) }, { type: 'passage', lines: passage.map((zh) => line(zh)) }],
  grammar: [{ examples: grammar.map((zh) => line(zh)) }],
  extras: { same_char: [{ examples: sameChar.map((zh) => line(zh)) }] },
})

test('a line that uses several of the words together comes first, then every word gets a line', () => {
  const lessons = [lesson({
    dialogue: ['他对法律很熟悉。', '我喜欢法律。', '我对这里印象很好。'],
    grammar: ['法律和印象都很重要。'],
  })]
  const hints = writingHints(['印象', '法律', '熟悉'], lessons)
  assert.equal(hints[0].words.length, 2, 'two of the words together beats one: that is how they combine')
  assert.equal(hints[0].zh, '他对法律很熟悉。', 'and of two such lines the dialogue comes before the grammar example')
  assert.deepEqual(hints[0].words, ['法律', '熟悉'])
  for (const word of ['印象', '法律', '熟悉']) assert.ok(hints.some((hint) => hint.words.includes(word)), `${word} has a line`)
})

test('at most the limit, never the same sentence twice, and one word does not crowd out the others', () => {
  const lessons = [lesson({
    dialogue: ['我喜欢法律。', '法律很难。', '他学法律。', '法律专业不错。', '我很熟悉这里。'],
    passage: ['我喜欢法律。'],
  })]
  const hints = writingHints(['法律', '熟悉'], lessons, undefined, 3)
  assert.equal(hints.length, 3)
  assert.equal(new Set(hints.map((hint) => hint.zh)).size, 3)
  assert.ok(hints.some((hint) => hint.words.includes('熟悉')), 'the second word is shown even though the first has more lines')
})

test('dialogue before a passage before a grammar example, and the shorter line wins a tie', () => {
  const lessons = [lesson({ dialogue: ['你好，我想了解一下法律。'], passage: ['法律。'], grammar: ['法律！'] })]
  assert.deepEqual(writingHints(['法律'], lessons, undefined, 3).map((hint) => hint.source), ['dialogue', 'passage', 'example'])
  const sameKind = [lesson({ dialogue: ['他明天一定会去学法律的。', '我学法律。'] })]
  assert.equal(writingHints(['法律'], sameKind, undefined, 1)[0].zh, '我学法律。')
})

test('a long line is not a model to copy from, but a word with nothing else still gets a fallback line', () => {
  const long = `${'这是一个很长的句子'.repeat(8)}法律`
  assert.ok([...long].length > MAX_HINT_LENGTH)
  assert.deepEqual(writingHints(['法律'], [lesson({ dialogue: [long] })]), [])
  const withFallback = writingHints(['法律'], [lesson({ dialogue: [long] })], undefined, 4, (word) => word === '法律' ? line('我学法律。', 'I study law.') : null)
  assert.equal(withFallback[0].zh, '我学法律。')
  assert.equal(withFallback[0].en, 'I study law.')
})

test('the caller decides what "uses a word" means, so 好 is not found inside 爱好', () => {
  const lessons = [lesson({ dialogue: ['我的爱好是读书。', '这本书很好。'] })]
  const whole = (zh, word) => zh.replace('爱好', '').includes(word)
  assert.deepEqual(writingHints(['好'], lessons, whole).map((hint) => hint.zh), ['这本书很好。'])
  assert.equal(writingHints(['好'], lessons).length, 2)
})

test('nothing asked, nothing found', () => {
  assert.deepEqual(writingHints([], [lesson({ dialogue: ['我学法律。'] })]), [])
  assert.deepEqual(writingHints(['法律'], []), [])
})

test('highlighting marks the longest word first and merges the plain stretches', () => {
  assert.deepEqual(highlightWords('他对法律很熟悉。', ['法律', '熟悉']), [
    { text: '他对', hit: false }, { text: '法律', hit: true }, { text: '很', hit: false }, { text: '熟悉', hit: true }, { text: '。', hit: false },
  ])
  assert.deepEqual(highlightWords('第一印象', ['印象', '印']), [{ text: '第一', hit: false }, { text: '印象', hit: true }])
  assert.deepEqual(highlightWords('没有', []), [{ text: '没有', hit: false }])
  assert.deepEqual(highlightWords('', ['法律']), [])
})

test('with the real lessons almost every word has a book sentence, and each one really uses its word', () => {
  const data = JSON.parse(fs.readFileSync('src/data/hsk4a.json', 'utf8'))
  const words = [...new Set(data.lessons.flatMap((entry) => entry.vocab.map((vocab) => vocab.zh)).filter((zh) => /^[㐀-鿿]{2,}$/.test(zh)))]
  assert.ok(words.length > 200)
  let without = 0
  for (const word of words) {
    const hints = writingHints([word], data.lessons)
    if (!hints.length) without++
    for (const hint of hints) assert.ok(hint.zh.includes(word) && hint.words.includes(word), `${word} in ${hint.zh}`)
  }
  assert.ok(without / words.length < 0.02, `${without} of ${words.length} words have no sentence`)
})
