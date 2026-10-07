import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeChinese, sourceAssessment, sourceWords, alignChinese, dialogueTurnIndexes, assessProduction } from '../src/lib/production.ts'
import { createMandarinRecognition, canRecognizeMandarin } from '../src/lib/recognition.ts'

const prompt = {
  expectedZh: '他不仅足球踢得好，性格也不错。',
  expectedEn: 'Not only does he play soccer well, his personality is great too.',
  targetWords: ['性格', '足球', '新闻'],
  response: '他不仅足球踢得好 性格也不错!',
}

test('source matching ignores punctuation and spacing, while preserving Hanzi and meaning-sensitive particles', () => {
  assert.equal(normalizeChinese(' 他，Ａ。 '), '他A')
  assert.equal(sourceAssessment(prompt).accepted, true)
  assert.equal(sourceAssessment({ ...prompt, response: '他不仅足球踢得好，性格不错。' }).accepted, null)
  assert.equal(sourceAssessment({ ...prompt, response: '她不仅足球踢得好，性格也不错。' }).accepted, null)
  assert.deepEqual(sourceWords(prompt.expectedZh, prompt.targetWords), ['性格', '足球'])
})

test('a different valid paraphrase is left unverified, never labelled grammatically wrong by string comparison', () => {
  const result = sourceAssessment({ ...prompt, response: '他足球踢得很好，而且性格也很好。' })
  assert.equal(result.accepted, null)
  assert.equal(result.evidence, 'practice')
  assert.match(result.feedback, /may be a valid alternative/)
  assert.deepEqual(result.usedWords, ['性格', '足球'])
  assert.deepEqual(result.missingWords, [])
})

test('alignment describes missing and added characters without inventing grammar errors', () => {
  assert.deepEqual(alignChinese('我爱你。', '我很爱你'), [
    { kind: 'same', text: '我' }, { kind: 'missing', text: '很' }, { kind: 'same', text: '爱你' },
  ])
  assert.deepEqual(alignChinese('我很爱你', '我爱你'), [
    { kind: 'same', text: '我' }, { kind: 'added', text: '很' }, { kind: 'same', text: '爱你' },
  ])
})

test('dialogue selects the requested source speaker and caps each activity at three actual replies', () => {
  const text = { lines: Array.from({ length: 10 }, (_, index) => ({ speaker: index % 2 ? '王静' : '孙月', zh: `句子${index}` })) }
  assert.deepEqual(dialogueTurnIndexes(text, '王静'), [1, 3, 5])
  assert.deepEqual(dialogueTurnIndexes(text, '孙月'), [0, 2, 4])
})

test('the book sentence is correct; a different wording is feedback only and never graded', () => {
  assert.equal(assessProduction(prompt).evidence, 'source-match')
  assert.equal(assessProduction(prompt).accepted, true)
  const differentButFine = assessProduction({ ...prompt, response: '他足球踢得很好，而且性格也很好。' })
  assert.equal(differentButFine.accepted, null)
  assert.equal(differentButFine.evidence, 'practice')
  assert.equal(differentButFine.grammar.verdict, 'no-known-errors')
  assert.match(differentButFine.feedback, /cannot confirm/)
  assert.equal(differentButFine.suggestedZh, undefined)
})

test('a known mistake in a different wording is named and fixed, still as practice evidence', () => {
  const wrong = assessProduction({ ...prompt, response: '他不仅足球踢得好，性格也不有错。' })
  assert.equal(wrong.accepted, false)
  assert.equal(wrong.evidence, 'practice', 'a heuristic must never write a wrong answer into mastery')
  assert.equal(wrong.suggestedZh, '他不仅足球踢得好，性格也没有错。')
  assert.equal(wrong.correctedZh, prompt.expectedZh, 'the book wording is still what is compared against')
  assert.match(wrong.issues[0], /没有/)
  const reword = assessProduction({ ...prompt, response: '你把书看。' })
  assert.equal(reword.accepted, null, 'only a "worth a look" note, so nothing is called wrong')
  assert.equal(reword.evidence, 'practice')
  assert.equal(reword.issues.length, 1)
})

test('recognition is user-started, includes interim Mandarin, replaces repeated finals, and aborts on disposal', () => {
  const originalWindow = globalThis.window
  const instances = []
  class Recognition {
    starts = 0
    stops = 0
    aborts = 0
    constructor() { instances.push(this) }
    start() { this.starts++ }
    stop() { this.stops++ }
    abort() { this.aborts++ }
  }
  const states = []
  const finals = []
  try {
    globalThis.window = { isSecureContext: true, SpeechRecognition: Recognition }
    assert.equal(canRecognizeMandarin(), true)
    const controller = createMandarinRecognition({ onState: (state) => states.push(state), onFinal: (value) => finals.push(value) })
    assert.equal(instances.length, 0)
    controller.start()
    const recognition = instances[0]
    assert.equal(recognition.lang, 'zh-CN')
    assert.equal(recognition.starts, 1)
    recognition.onstart()
    recognition.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: '我爱' } }] })
    assert.equal(states.at(-1).interim, '我爱')
    assert.equal(finals.length, 0)
    recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '我爱中文' } }] })
    recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '我爱中文' } }] })
    assert.equal(finals.at(-1), '我爱中文')
    controller.stop()
    assert.equal(recognition.stops, 1)
    controller.dispose()
    assert.equal(recognition.aborts, 1)
    assert.equal(recognition.onresult, null)
  } finally { globalThis.window = originalWindow }
})

test('unsupported recognition retains a typed fallback without microphone requests', () => {
  const originalWindow = globalThis.window
  try {
    globalThis.window = { isSecureContext: false }
    let snapshot
    const controller = createMandarinRecognition({ onState: (value) => { snapshot = value }, onFinal() { assert.fail('No result expected') } })
    controller.start()
    assert.equal(snapshot.status, 'unsupported')
    assert.match(snapshot.error, /Type below/)
    controller.dispose()
  } finally { globalThis.window = originalWindow }
})
