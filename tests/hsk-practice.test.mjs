import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { listeningScripts, nextListeningScript, learnedHskWords, compositionBundle } from '../src/lib/hskPractice.ts'
import { writingCoverage, reviewComposition } from '../src/lib/composition.ts'
import { alignSpeechBoundaries, parseSpeechMetadata } from '../api/tts.ts'
import { rangesOverlap, timingAt } from '../src/lib/speechTiming.ts'

const { lessons } = JSON.parse(await readFile(new URL('../src/data/hsk4a.json', import.meta.url), 'utf8'))

test('listening combines all 25 exact scripts in lessons 1–5, with ordered speakers and no rewritten text', () => {
  const scripts = listeningScripts(lessons)
  assert.equal(scripts.length, 25)
  assert.equal(scripts.filter((script) => script.text.type === 'dialogue').length, 15)
  assert.deepEqual([...new Set(scripts.map((script) => script.lesson))], [1, 2, 3, 4, 5])
  assert.equal(new Set(scripts.map((script) => script.id)).size, 25)
  for (const script of scripts) assert.ok(lessons.find((lesson) => lesson.lesson === script.lesson).texts.includes(script.text))
  assert.equal(listeningScripts(lessons, 3, 3).length, 5)
})

test('auto-next, repeat one, repeat all and the end of a queue have explicit stopping behavior', () => {
  assert.equal(nextListeningScript(0, 25, true, 'off'), 1)
  assert.equal(nextListeningScript(24, 25, true, 'off'), null)
  assert.equal(nextListeningScript(24, 25, true, 'all'), 0)
  assert.equal(nextListeningScript(7, 25, false, 'all'), null)
  assert.equal(nextListeningScript(7, 25, false, 'script'), 7)
  assert.equal(nextListeningScript(0, 0, true, 'all'), null)
})

test('writing uses only learned/drilled HSK vocabulary and combines lessons without introducing unseen words', () => {
  const a = lessons[0].vocab[0].zh
  const b = lessons[1].vocab[0].zh
  const c = lessons[3].vocab[0].zh
  const pool = learnedHskWords(lessons, [a, b, 'not-in-hsk'], [c, a])
  assert.deepEqual(new Set(pool.map((word) => word.zh)), new Set([a, b, c]))
  const bundle = compositionBundle(pool, { [c]: { state: 'hard', lastPractice: 9 } }, 0)
  assert.equal(bundle[0].zh, c)
  assert.equal(new Set(bundle.map((word) => word.lesson)).size, 3)
  assert.deepEqual(compositionBundle([], {}), [])
})

test('word coverage is separate from grammar and cannot credit substrings or words across punctuation', () => {
  const result = writingCoverage('我的爱好是踢足球。我不仅喜欢足球，也喜欢学习法律。', ['好', '爱好', '不仅', '法律', '俩'])
  assert.deepEqual(new Set(result.used), new Set(['爱好', '不仅', '法律']))
  assert.deepEqual(new Set(result.missing), new Set(['好', '俩']))
  assert.equal(writingCoverage('法。律。', ['法律']).used.length, 0)
})

test('word timing maps real service offsets to repeated source words without guessing positions', () => {
  const data = { Metadata: [
    { Type: 'WordBoundary', Data: { Offset: 1000000, Duration: 2200000, text: { Text: '我' } } },
    { Type: 'WordBoundary', Data: { Offset: 3300000, Duration: 4000000, text: { Text: '法律' } } },
    { Type: 'WordBoundary', Data: { Offset: 9500000, Duration: 4000000, text: { Text: '法律' } } },
    { Type: 'WordBoundary', Data: { Offset: 14000000, Duration: 1, text: { Text: '不存在' } } },
  ] }
  const boundaries = parseSpeechMetadata(`Path:audio.metadata\r\n\r\n${JSON.stringify(data)}`)
  assert.equal(boundaries[0].offset, .1)
  const words = alignSpeechBoundaries('我学法律，喜欢法律。', boundaries)
  assert.deepEqual(words.map((word) => word.charIndex), [0, 2, 7])
  assert.equal(timingAt(words, .05), undefined)
  assert.equal(timingAt(words, 1).charIndex, 7)
  assert.equal(rangesOverlap(2, 2, 3, 1), true)
  assert.equal(rangesOverlap(2, 2, 4, 1), false)
  assert.deepEqual(parseSpeechMetadata('Path:audio.metadata\r\n\r\n{broken'), [])
})

function resMock() {
  return { headers: {}, statusCode: 0, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = JSON.parse(body) } }
}

test('original writing is checked offline: a known mistake gets a specific reason and fix, and word coverage stays separate', () => {
  const result = reviewComposition('我学习在图书馆。', ['法律', '俩'])
  assert.equal(result.verdict, 'errors')
  assert.equal(result.accepted, false)
  assert.equal(result.corrections[0].original, '学习在图书馆')
  assert.equal(result.corrections[0].suggestion, '在图书馆学习')
  assert.match(result.corrections[0].why, /place comes before the action/)
  assert.equal(result.correctedZh, '我在图书馆学习。')
  assert.deepEqual(result.used, [])
  assert.deepEqual(result.missing, ['法律', '俩'])
})

test('review accepts sentences with no known mistake even with unused words, without claiming they are correct', () => {
  const result = reviewComposition('他学习法律。', ['法律', '俩'])
  assert.equal(result.verdict, 'no-known-errors')
  assert.equal(result.accepted, true)
  assert.deepEqual(result.missing, ['俩'])
  assert.match(result.feedback, /not proof/)
  assert.equal(result.correctedZh, '他学习法律。')
})

test('a removal is a valid correction, and a sentence that needs rewording says so instead of guessing', () => {
  const removal = reviewComposition('三个学生们学习法律。', ['法律'])
  assert.equal(removal.corrections[0].suggestion, '')
  assert.equal(removal.correctedZh, '三个学生学习法律。')
  const reword = reviewComposition('你把书看。', ['书'])
  assert.equal(reword.corrections[0].suggestion, null)
  assert.equal(reword.verdict, 'worth-a-look')
  assert.equal(reword.accepted, true)
})

test('empty or non-Chinese writing is not checked and is never accepted', () => {
  assert.equal(reviewComposition('', ['法律']).verdict, 'not-chinese')
  assert.equal(reviewComposition('hello', ['法律']).accepted, false)
})
