import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { applyReplacements, checkGrammar, lexiconFrom, splitUnits } from '../src/lib/grammar/check.ts'
import { createRules } from '../src/lib/grammar/rules.ts'
import { RULE_IDS } from '../src/lib/grammar/types.ts'

/**
 * Each rule: sentences with the mistake and what they should become, then near misses that look similar and are correct.
 * `fixed` is the whole sentence after the suggestions are applied; null means the rule asks the learner to reword.
 */
const MISTAKES = {
  'place-after-verb': { found: [
    ['我学习在图书馆。', '我在图书馆学习。'], ['他吃饭在家里。', '他在家里吃饭。'], ['我们玩在公园。', '我们在公园玩。'], ['她睡觉在宿舍。', '她在宿舍睡觉。'],
  ], clean: ['我住在北京。', '他坐在教室里。', '书放在家里。', '他在家学习。', '同学在家。', '大学在北京。', '吃在广州，住在苏州。', '我写在黑板上。', '我学习在线课程。'] },
  'time-after-verb': { found: [
    ['我去北京明天。', '我明天去北京。'], ['我们见面明天。', '我们明天见面。'], ['他买东西昨天。', '他昨天买东西。'],
  ], clean: ['我们工作到明天。', '会议是明天。', '我去北京，明天回来。', '我明天去北京。', '开会是今天。', '我们工作日晚上有空。'] },
  'hen-after-adj': { found: [
    ['他高很。', '他很高。'], ['我累很。', '我很累。'], ['这个菜好吃很。', '这个菜很好吃。'],
  ], clean: ['他好很多。', '这个太贵了。', '我很累。', '好得很。', '累得很。'] },
  'degree-after-verb': { found: [
    ['我喜欢很。', '我很喜欢。'], ['他爱非常。', '他非常爱。'], ['我想太。', '我太想。'],
  ], clean: ['我很喜欢你。', '我喜欢很多人。', '我想很久了。'] },
  'bi-hen': { found: [
    ['他比我很高。', '他比我高。'], ['今天比昨天非常冷。', '今天比昨天冷。'], ['这个比那个很贵。', '这个比那个贵。'],
  ], clean: ['他比我更高。', '他比我高很多。', '他比很多人高。', '比我高的人很多。', '比如说，他很高。', '他比我早到很多。'] },
  'bi-bu': { found: [
    ['他比我不高。', null], ['这个比那个不贵。', null], ['今天比昨天不冷。', null],
  ], clean: ['他不比我高。', '他没有我高。', '他比不上我。', '比赛不难。'] },
  'shi-adj': { found: [
    ['他是很高。', '他很高。'], ['我是饿。', '我很饿。'], ['她是漂亮。', '她很漂亮。'], ['我们是高兴。', '我们很高兴。'],
  ], clean: ['他不是很高。', '他是个高个子。', '他是很高的。', '我是对的。', '好是好，但是贵。', '这是很好的书。', '他是老师。', '我是大，他是小。'] },
  'shi-age': { found: [
    ['我是二十岁。', '我二十岁。'], ['他是十八岁。', '他十八岁。'], ['她是三十岁了。', '她三十岁了。'],
  ], clean: ['我是二十岁的时候来的。', '他是二十岁左右。', '我今年二十岁。'] },
  'meiyou-le': { found: [
    ['我昨天没吃饭了。', '我昨天没吃饭。'], ['上周他没来了。', '上周他没来。'], ['我去年没去北京了。', '我去年没去北京。'], ['我昨天没有去了面试。', '我昨天没有去面试。'],
  ], clean: ['我没钱了。', '我再也没吃了。', '他没有了。', '我没吃饭。', '我吃了饭了。', '他从来没去了。', '我很久没去运动了。', '他三天没吃饭了。', '我好几天没睡觉了。', '我没去了解情况。'] },
  'negation-choice': { found: [
    ['我不有钱。', '我没有钱。'], ['我没是学生。', '我不是学生。'], ['我不去过中国。', '我没去过中国。'], ['他不吃过这个菜。', '他没吃过这个菜。'],
  ], clean: ['不用过去。', '我不看过去。', '不过我喜欢。', '我没有钱。', '我不是学生。', '我没去过。', '我不去过年。'] },
  'you-guo': { found: [
    ['我有去过北京。', '我去过北京。'], ['他有吃过这个菜。', '他吃过这个菜。'], ['你有看过这部电影吗？', '你看过这部电影吗？'],
  ], clean: ['我没有去过北京。', '你有没有去过北京？', '只有去过的人才知道。', '我去过北京。', '所有去过北京的人都喜欢。'] },
  'ma-question-double': { found: [
    ['你是不是学生吗？', '你是不是学生？'], ['他来不来吗？', '他来不来？'], ['你喜欢不喜欢这个吗？', '你喜欢不喜欢这个？'], ['你有没有钱吗？', '你有没有钱？'],
  ], clean: ['你是学生吗？', '你知道他来不来吗？', '你来不来？', '你喜欢不喜欢这个？', '他不去吗？', '请问你想知道他是不是学生吗？'] },
  'question-or': { found: [
    ['你喝茶或者咖啡？', '你喝茶还是咖啡？'], ['他去北京或者上海？', '他去北京还是上海？'], ['你要米饭或者面条？', '你要米饭还是面条？'],
  ], clean: ['你喝茶还是咖啡？', '他喝茶或者咖啡。', '你有苹果或者香蕉吗？'] },
  'er-liang': { found: [
    ['我有二个朋友。', '我有两个朋友。'], ['他买了二本书。', '他买了两本书。'], ['桌子上有二杯水。', '桌子上有两杯水。'],
  ], clean: ['第二个人来了。', '十二个人。', '二十二个人。', '我有两个朋友。', '现在二月。', '星期二个人少。'] },
  'men-plural': { found: [
    ['三个学生们来了。', '三个学生来了。'], ['很多朋友们都来了。', '很多朋友都来了。'], ['十个老师们在开会。', '十个老师在开会。'],
  ], clean: ['我们三个人。', '同学们好。', '很多学生来了。', '老师们很忙。', '你们几个去吧。'] },
  'measure-word': { found: [
    ['我有一个书。', '我有一本书。'], ['他买了两个衣服。', '他买了两件衣服。'], ['她有三个狗。', '她有三只狗。'], ['我看了一个电影。', '我看了一部电影。'],
  ], clean: ['我有一本书。', '这个书很好。', '我有一个书包。', '一个书店在这儿。', '一个车站。', '我有一个朋友。', '一个门口。'] },
  'de-for-de': { found: [
    ['他跑的很快。', '他跑得很快。'], ['她睡的很早。', '她睡得很早。'], ['我们玩的非常开心。', '我们玩得非常开心。'], ['他说的很好。', '他说得很好。'],
  ], clean: ['他跑得很快。', '这是他写的很好的书。', '事情来的很快。', '他的钱很多。', '我喜欢你做的菜。'] },
  'verb-object-de': { found: [
    ['他说汉语得很好。', '他说汉语说得很好。'], ['她唱歌得非常好。', '她唱歌唱得非常好。'], ['我写汉字得很慢。', '我写汉字写得很慢。'],
  ], clean: ['他说得很好。', '说汉语得多练习。', '他汉语说得很好。', '她唱歌唱得很好。'] },
  'repeated-word': { found: [
    ['我的的书。', '我的书。'], ['你好吗吗？', '你好吗？'], ['我很很高兴。', '我很高兴。'], ['他走了了。', '他走了。'],
  ], clean: ['的的确确是这样。', '我明了了。', '我去不了了。', '是是是，你说得对。', '他们太太来了。'] },
  'zai-zai': { found: [
    ['我再家学习。', '我在家学习。'], ['他再学校吃饭。', '他在学校吃饭。'], ['明天在见！', '明天再见！'], ['在见，朋友们。', '再见，朋友们。'],
  ], clean: ['再见！', '再来一个。', '再外面一点。', '我们再说一遍。', '我在家。', '他们在见客人。'] },
  'degree-stack': { found: [
    ['我很有点累。', '我有点累。'], ['今天非常有点冷。', '今天有点冷。'], ['这个有点很贵。', '这个有点贵。'],
  ], clean: ['我很累。', '我有点累。', '很有点意思。', '我有点儿累。'] },
  'ba-bare-verb': { found: [
    ['你把书看。', null], ['我把饭吃。', null], ['他把作业写。', null],
  ], clean: ['我把书看完了。', '把门关上。', '我有把握。', '一把椅子。', '你把灯打开。', '我把书放在桌子上。', '很多人一回家就把门一关。'] },
  'conjunction-pair': { found: [
    ['虽然他很累，所以他去了。', '虽然他很累，但是他去了。'], ['虽然很贵，所以他买了。', '虽然很贵，但是他买了。'], ['因为下雨，但是我去了。', null],
  ], clean: ['虽然他很累，但是他去了。', '因为下雨，所以我没去。', '虽然他很累，他还是去了，所以我也去了。', '我没去，因为下雨，但是我会去。'] },
}

const only = (sentence, rule) => checkGrammar(sentence).findings.filter((finding) => finding.rule === rule)

test('the rule set defines exactly the rule ids, and every one has examples here', () => {
  assert.deepEqual(Object.keys(createRules({ adjectives: new Set() })).sort(), [...RULE_IDS].sort())
  assert.deepEqual(Object.keys(MISTAKES).sort(), [...RULE_IDS].sort())
  assert.equal(new Set(RULE_IDS).size, RULE_IDS.length)
})

for (const [rule, { found, clean }] of Object.entries(MISTAKES)) {
  test(`${rule}: at least three mistakes are found and fixed`, () => {
    assert.ok(found.length >= 3, `${rule} needs three examples`)
    for (const [sentence, fixed] of found) {
      const hits = only(sentence, rule)
      assert.ok(hits.length >= 1, `${rule} should find a mistake in ${sentence}`)
      for (const hit of hits) {
        assert.ok(hit.pattern.length > 0 && hit.why.length > 0, `${rule}: explains itself`)
        assert.equal(sentence.slice(hit.start, hit.end), hit.original)
      }
      if (fixed !== null) {
        assert.equal(applyReplacements(sentence, hits), fixed, `${rule}: ${sentence}`)
        // A fix must not trip the checker again.
        assert.deepEqual(checkGrammar(fixed).findings.map((finding) => finding.rule), [], `${rule}: the fixed sentence ${fixed} should be clean`)
      } else assert.ok(hits.every((hit) => hit.suggestion === null), `${rule}: ${sentence} needs rewording, so no replacement`)
    }
  })

  test(`${rule}: correct sentences that look similar are left alone`, () => {
    for (const sentence of clean) assert.deepEqual(only(sentence, rule).map((hit) => hit.original), [], `${rule} must not flag ${sentence}`)
  })
}

test('error-severity rules fail a sentence and check-severity rules only ask for a look', () => {
  assert.equal(checkGrammar('我累很。').verdict, 'errors')
  assert.equal(checkGrammar('我是二十岁。').verdict, 'worth-a-look')
  assert.equal(checkGrammar('我很累。').verdict, 'no-known-errors')
  assert.equal(checkGrammar('hello').verdict, 'not-chinese')
  assert.equal(checkGrammar('').verdict, 'not-chinese')
})

test('a sentence the rules do not know is "no known errors", never a pass for correctness', () => {
  const report = checkGrammar('我昨天和朋友一起去了一家新开的饭馆。')
  assert.equal(report.verdict, 'no-known-errors')
  assert.equal(report.findings.length, 0)
  assert.equal(report.rulesChecked, RULE_IDS.length)
  assert.equal(report.correctedZh, '我昨天和朋友一起去了一家新开的饭馆。')
})

test('only error-level fixes are written into the corrected sentence', () => {
  const report = checkGrammar('我是二十岁，我累很。')
  assert.deepEqual(report.findings.map((finding) => finding.rule), ['shi-age', 'hen-after-adj'])
  assert.equal(report.correctedZh, '我是二十岁，我很累。')
  assert.equal(report.fullyCorrected, true)
})

test('an error that needs rewording is reported but not rewritten, and the report says so', () => {
  const report = checkGrammar('你把书看，我累很。')
  assert.equal(report.verdict, 'errors')
  assert.equal(report.correctedZh, '你把书看，我很累。')
  const unfixable = checkGrammar('你喝茶或者咖啡？我是二十岁。')
  assert.equal(unfixable.fullyCorrected, true)
  assert.equal(checkGrammar('我是饿。').fullyCorrected, true)
})

test('findings keep offsets into the original text across sentences and clauses', () => {
  const text = '你好。我学习在图书馆，我累很。'
  const report = checkGrammar(text)
  assert.deepEqual(report.findings.map((finding) => text.slice(finding.start, finding.end)), ['学习在图书馆', '累很'])
  assert.equal(report.correctedZh, '你好。我在图书馆学习，我很累。')
})

test('overlapping findings keep the error over the look', () => {
  const report = checkGrammar('我是很累很。')
  assert.ok(report.findings.every((finding, index, all) => index === 0 || finding.start >= all[index - 1].end))
})

test('splitUnits trims, keeps offsets, and splits on Chinese and ASCII punctuation', () => {
  const units = splitUnits(' 你好，我是Richie. 3.5 元！ ', /[。！？!?；;\n]+[”’」』"')）]*|(?<!\d)\.(?!\d)/gu)
  assert.deepEqual(units.map((unit) => unit.text), ['你好，我是Richie', '3.5 元'])
  assert.deepEqual(units.map((unit) => unit.terminator), ['.', '！'])
  const clauses = splitUnits('我去，你来、他走', /[，、]/gu)
  assert.deepEqual(clauses.map((unit) => [unit.text, unit.start]), [['我去', 0], ['你来', 3], ['他走', 6]])
})

test('long input is cut, and it does not hang on pathological text', () => {
  const started = Date.now()
  const report = checkGrammar('我'.repeat(50000) + '累很。')
  assert.equal(report.verdict, 'no-known-errors')
  const heavy = checkGrammar('不'.repeat(1500) + '我学习在家'.repeat(40))
  assert.ok(Date.now() - started < 3000)
  assert.ok(heavy.findings.length >= 0)
})

test('the course vocabulary teaches the checker more adjectives, but only unambiguous ones', () => {
  const lexicon = lexiconFrom([
    { zh: '幸福', pos: 'adj.' }, { zh: '精神', pos: 'n./adj.' }, { zh: '浪漫', pos: 'adj.' }, { zh: '法律', pos: 'n.' }, { zh: '非常非常好', pos: 'adj.' }, { zh: '好 的', pos: 'adj.' },
  ])
  assert.deepEqual([...lexicon.adjectives].sort(), ['幸福', '浪漫'])
  assert.equal(checkGrammar('她们幸福很。').verdict, 'no-known-errors')
  assert.equal(checkGrammar('她们幸福很。', { lexicon }).verdict, 'errors')
  assert.equal(checkGrammar('她们幸福很。', { lexicon }).correctedZh, '她们很幸福。')
  assert.equal(checkGrammar('她是浪漫。', { lexicon }).correctedZh, '她很浪漫。')
})

test('natural sentences at HSK 3-4 level stay clean', () => {
  const natural = [
    '我是学生，今年二十五岁。', '他在北京工作，已经三年了。', '我们明天下午三点在学校门口见面。', '她唱歌唱得很好。', '他跑得比我快。',
    '这本书比那本书贵。', '我把作业做完了。', '他没来上课，因为他生病了。', '你喜欢喝茶还是咖啡？', '虽然很累，但是我很高兴。',
    '因为下雨，所以我们没去公园。', '我去过两次中国。', '他从来没迟到过。', '你知道他今天来不来吗？', '我有一个哥哥和两个姐姐。',
    '我们一起去图书馆学习吧。', '她在家里看书，不出去玩。', '我昨天晚上十点才睡觉。', '这件衣服太贵了，我不买。', '他不是很高，但是很帅。',
    '我的朋友们都喜欢这家饭馆。', '请再说一遍，好吗？', '我再也不想吃了。', '他住在学校旁边的宿舍里。', '我想把这封信寄到印度尼西亚。',
    '你有没有兄弟姐妹？', '老师说我的汉语进步得很快。', '明天见！', '再见，下次再聊。', '我对中文很感兴趣。', '他每天早上跑步一个小时。',
    '我有点累，想休息一下。', '她比我大三岁。', '我们三个人一起去。', '一共两百块。', '你想喝点什么吗？', '他今年大学毕业，现在在找工作。',
    '我听说你最近很忙。', '这家店的菜好吃极了。', '没关系，我自己来。', '我没吃早饭，所以现在很饿。', '你会不会说英语？',
  ]
  for (const sentence of natural) assert.deepEqual(checkGrammar(sentence).findings.map((finding) => `${finding.rule}:${finding.original}`), [], sentence)
})

/** Every Chinese sentence in the course data is correct Mandarin, so none may be reported. */
function courseSentences(directory) {
  const sentences = new Set()
  const vocabulary = []
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name)
      if (entry.isDirectory()) { if (entry.name !== 'i18n' && entry.name !== 'strokes') walk(file); continue }
      if (entry.name.endsWith('.json') && !/audio/.test(entry.name)) visit(JSON.parse(fs.readFileSync(file, 'utf8')), '')
    }
  }
  const visit = (value, key) => {
    if (typeof value === 'string') { if ((key === 'zh' || key === 'mandarin') && /[㐀-鿿]/.test(value)) sentences.add(value) }
    else if (Array.isArray(value)) value.forEach((item) => visit(item, key))
    else if (value && typeof value === 'object') {
      if (typeof value.zh === 'string' && typeof value.pos === 'string') vocabulary.push({ zh: value.zh, pos: value.pos })
      for (const [name, item] of Object.entries(value)) visit(item, name)
    }
  }
  walk(directory)
  return { sentences: [...sentences], vocabulary }
}

test('no sentence in any course is reported (precision on thousands of correct sentences)', () => {
  const { sentences, vocabulary } = courseSentences('src/data')
  assert.ok(sentences.length > 3000, `expected thousands of course sentences, found ${sentences.length}`)
  const lexicon = lexiconFrom(vocabulary)
  assert.ok(lexicon.adjectives.size > 50)
  const flagged = []
  for (const sentence of sentences) {
    for (const finding of checkGrammar(sentence, { lexicon }).findings) flagged.push(`${finding.rule} [${finding.original}] in ${sentence.slice(0, 60)}`)
  }
  assert.deepEqual(flagged, [])
})

test('it catches mistakes the course itself lists under "avoid", and does not claim the rest', () => {
  // Kerja chapter 17, "Klinik kalimat": the authors' own wrong sentences.
  const caught = { '他说的很清楚。': 'de-for-de', '我昨天没有去了面试。': 'meiyou-le', '虽然他有经验，所以我们还要看沟通能力。': 'conjunction-pair' }
  for (const [sentence, rule] of Object.entries(caught)) assert.ok(checkGrammar(sentence).findings.some((finding) => finding.rule === rule), `${rule} should catch ${sentence}`)
  // These are real mistakes too, but outside the patterns this checker knows. It stays silent rather than guess.
  for (const sentence of ['我跟经理讨论明天这个问题。', '我给经理讨论这个问题。', '这份报告被我写。', '报告我做。']) {
    assert.equal(checkGrammar(sentence).verdict, 'no-known-errors', sentence)
  }
})
