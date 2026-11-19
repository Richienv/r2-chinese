import test from 'node:test'
import assert from 'node:assert/strict'
import { buildJiaochengMidterm, partPoints } from '../src/lib/jiaochengMidterm.ts'

const paper = buildJiaochengMidterm()

test('lessons 1 to 12 each have a textbook fill-in section', () => {
  const fillLessons = paper.filter((part) => part.kind === 'blanks').map((part) => part.lesson)
  for (let lesson = 1; lesson <= 12; lesson++) {
    if (lesson === 5) continue
    assert.ok(fillLessons.includes(lesson), `lesson ${lesson}`)
  }
  assert.ok(paper.some((part) => part.kind === 'choice' && part.lesson === 5))
})

test('every blank answer is one of the printed word-bank words', () => {
  for (const part of paper) {
    if (part.kind !== 'blanks') continue
    const marks = [...part.lines.join('\n').matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]))
    assert.deepEqual(marks, part.blanks.map((blank) => blank.n))
    for (const blank of part.blanks) assert.ok(part.bank.includes(blank.answer), `${part.id} ${blank.n}`)
    assert.equal(partPoints(part), part.blanks.length)
  }
})

test('single-choice answers are one of the options', () => {
  const choices = paper.filter((part) => part.kind === 'choice')
  assert.ok(choices.length >= 6)
  for (const part of choices) {
    assert.ok(part.options.includes(part.answer))
    assert.equal(partPoints(part), 1)
  }
})
