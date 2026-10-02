import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildGrammarCoach } from '../src/lib/grammarCoach.ts'

const studyLine = '是的，他学的是新闻，我学的是法律，我和他不是一个班。'
const soccerLine = '他不仅足球踢得好，性格也不错。'

test('学的是 coaching distinguishes nominalization from completed-event 是…的 and explains the actual order', () => {
  const coach = buildGrammarCoach({ expectedZh: '他学的是新闻。', expectedEn: 'He studies journalism.' })
  assert.equal(coach.pattern, '学的 + 是 + 专业')
  assert.deepEqual(coach.parts.map((part) => part.text), ['他', '学', '的', '是', '新闻'])
  assert.match(coach.summary, /noun-phrase structure, distinct from/)
  assert.match(coach.parts.find((part) => part.text === '的').reason, /not 得/)
  assert.deepEqual(coach.example, { zh: '他学的是新闻。', en: 'He studies journalism.' })
})

test('source-conditioned homophone cues focus the relevant clause without pretending to assess grammar', () => {
  const coach = buildGrammarCoach({ expectedZh: studyLine, response: '他学的是新闻，我学的是法录，我和他不是一个半。' })
  assert.deepEqual(coach.parts.map((part) => part.text), ['我', '学', '的', '是', '法律'])
  assert.deepEqual(coach.observations.map((issue) => issue.text), ['法录 → 法律', '一个半 → 一个班'])
  assert.match(coach.observations[0].reason, /check the recognized spelling/)
  assert.ok(!('accepted' in coach))
  assert.ok(!('correct' in coach))
  assert.equal(coach.example.zh, studyLine)
  const classCoach = buildGrammarCoach({ expectedZh: studyLine, response: '我和他不是一个半。' })
  assert.equal(classCoach.pattern, '人 + 不是 + 一个班')
  assert.deepEqual(classCoach.parts.map((part) => part.text), ['我和他', '不', '是', '一个', '班'])
})

test('not-only coaching separates the second topic from 也 and explains 得 inside the first quality', () => {
  const coach = buildGrammarCoach({ expectedZh: soccerLine })
  assert.equal(coach.pattern, '不仅……也……')
  assert.deepEqual(coach.parts.map((part) => part.text), ['他', '不仅', '足球踢得好', '性格', '也', '不错'])
  assert.match(coach.parts.find((part) => part.text === '足球踢得好').reason, /verb → 得 → quality/)
  assert.match(coach.parts.find((part) => part.text === '也').reason, /before the second predicate/)
})

test('a source-conditioned 得/的 issue selects degree coaching, including unpunctuated ASR', () => {
  for (const response of ['他不仅足球踢的好，性格也不错。', '他不仅足球踢的好性格也不错']) {
    const coach = buildGrammarCoach({ expectedZh: soccerLine, response })
    assert.equal(coach.pattern, '动作 + 得 + 程度')
    assert.deepEqual(coach.parts.map((part) => part.text), ['他不仅足球', '踢', '得', '好'])
    assert.deepEqual(coach.observations.map((issue) => issue.text), ['踢的好 → 踢得好'])
  }
})

test('valid alternatives and noun modifiers never receive invented deterministic errors', () => {
  const variants = [
    [soccerLine, '他足球踢得很好，而且性格很好。'],
    [soccerLine, '我喜欢他踢的好球。'],
    [studyLine, '我学法律，我们不在同一个班。'],
    [studyLine, '我学的是法律，半天都在上课。'],
    [studyLine, '我学的是法律，不是法录。'],
  ]
  for (const [expectedZh, response] of variants) {
    assert.deepEqual(buildGrammarCoach({ expectedZh, response }).observations, [], response)
  }
})

test('generalized not-only and degree explanations do not claim every source is about soccer', () => {
  const extra = buildGrammarCoach({ expectedZh: '这件衣服不仅漂亮，而且很适合你。' })
  assert.equal(extra.pattern, '不仅……而且……')
  assert.ok(!JSON.stringify(extra).includes('soccer'))
  assert.ok(!JSON.stringify(extra).includes('personality'))
  const speech = buildGrammarCoach({ expectedZh: '她汉语说得那么好，我还以为她是中国人。' })
  assert.equal(speech.pattern, '动作 + 得 + 程度')
  assert.ok(!JSON.stringify(speech).includes('soccer'))
  assert.ok(!JSON.stringify(speech).includes('踢'))
  assert.deepEqual(speech.parts.map((part) => part.text), ['她汉语', '说', '得', '那么好'])
})

test('paired frames isolate the intended sentence and keep the result subject before its marker', () => {
  const coach = buildGrammarCoach({ expectedZh: '你应该多回家看看老人，即使只是跟他们吃吃饭、聊聊天，他们也会觉得很幸福。后来我们回家了。' })
  assert.equal(coach.pattern, '即使……也……')
  assert.deepEqual(coach.parts.map((part) => part.text), ['即使', '只是跟他们吃吃饭、聊聊天', '他们', '也', '会觉得很幸福'])
  assert.equal(coach.parts.length, 5)
  const cause = buildGrammarCoach({ expectedZh: '我们本来打算出国，但是由于老人突然生病了，所以只好放弃这个计划。' })
  assert.equal(cause.pattern, '由于……所以……')
  assert.deepEqual(cause.parts.map((part) => part.text), ['由于', '老人突然生病了', '所以', '只好放弃这个计划'])
})

test('unsupported sentences and lexical marker lookalikes stay unsupported', () => {
  for (const expectedZh of [
    '你好。', '我喜欢这本书。', '我既然来了，又有什么事？',
    '我们越过边境后到了越南。', '他在超越自己，也在超越别人。',
    '我不管他。大家都来了。', '要是今天下雨。明天就晴了。',
    '只有今天有时间。',
  ]) assert.equal(buildGrammarCoach({ expectedZh }), null, expectedZh)
})

test('supported curriculum examples retain their exact provenance and use only source chunks', async () => {
  const curriculum = JSON.parse(await readFile(new URL('../src/data/hsk4a.json', import.meta.url), 'utf8'))
  const normalize = (text) => text.replace(/[\s\p{P}\p{S}]/gu, '')
  const patterns = new Set()
  for (const lesson of curriculum.lessons) {
    for (const grammar of lesson.grammar) {
      for (const example of grammar.examples) {
        const coach = buildGrammarCoach({ expectedZh: example.zh, expectedEn: example.en, grammar: `${grammar.point}: ${grammar.explanation}` })
        if (!coach) continue
        patterns.add(coach.pattern)
        assert.deepEqual(coach.example, { zh: example.zh, en: example.en })
        assert.ok(coach.parts.length >= 3 && coach.parts.length <= 6, example.zh)
        assert.ok(coach.parts.every((part) => normalize(example.zh).includes(normalize(part.text))), example.zh)
        assert.deepEqual(coach.observations, [])
      }
    }
  }
  assert.ok(patterns.has('不仅……而且……'))
  assert.ok(patterns.has('即使……也……'))
  assert.ok(patterns.has('既……又/也/还……'))
  assert.ok(patterns.has('只要……就/一定……'))
  assert.ok(patterns.size >= 10)
})
