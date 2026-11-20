import test from 'node:test'
import assert from 'node:assert/strict'
import {
  coreMeaning, otherMeanings, interleave, groupWords, composeRecognise, composeContext, composeProduce,
  composeSitting, sentenceTiles, splitAtComma, characterTiles, sameText, exerciseWords,
} from '../src/lib/exercises.ts'
import { rng } from '../src/lib/seeded.ts'

const W = (zh, en, pinyin = 'x', pos = 'n.') => ({ zh, en, pinyin, pos })
const words = [
  { ...W('法律', 'hukum'), example: { zh: '他学的是法律，我学的是新闻。', en: 'Dia belajar hukum, aku belajar jurnalistik.' } },
  { ...W('印象', 'kesan, impresi'), example: { zh: '我对他印象很深。', en: 'Aku punya kesan yang dalam tentang dia.' } },
  { ...W('熟悉', 'familiar, udah kenal banget', 'x', 'adj.'), example: { zh: '后来我们就慢慢熟悉了。', en: 'Lalu kami pelan-pelan jadi akrab.' } },
  { ...W('性格', 'karakter, kepribadian'), example: { zh: '他性格也不错。', en: 'Kepribadiannya juga oke.' } },
  { ...W('深', 'dalam', 'x', 'adj.'), example: null },
]
const pool = [
  W('爱情', 'cinta'), W('感动', 'terharu', 'x', 'v.'), W('浪漫', 'romantis', 'x', 'adj.'), W('幸福', 'bahagia', 'x', 'adj.'),
  W('适合', 'cocok, pas', 'x', 'v.'), W('共同', 'bareng, sama-sama', 'x', 'adj.'), W('从来', 'dari dulu, selama ini', 'x', 'adv.'),
  W('不仅', 'nggak cuma', 'x', 'conj.'), W('开玩笑', 'bercanda', 'x', 'v.'), W('俩', 'berdua, dua orang', 'x', 'num.'),
  W('影响', 'pengaruh'), W('新闻', 'berita'), W('同学', 'teman sekelas'), W('比赛', 'pertandingan'),
]
const known = [...words, ...pool].map((w) => w.zh).sort((a, b) => b.length - a.length)
/** Greedy longest match over the test lexicon, else one character, like the app's segmenter. */
function segment(zh) {
  const out = []
  for (let i = 0; i < zh.length;) {
    const hit = known.find((w) => zh.startsWith(w, i))
    const len = hit ? hit.length : 1
    out.push(zh.slice(i, i + len))
    i += len
  }
  return out
}
const ctx = { pool, segment, seed: 'hsk:1:t1' }

test('the core meaning is the first plain sense, without notes in brackets', () => {
  assert.equal(coreMeaning('kesan, impresi'), 'kesan')
  assert.equal(coreMeaning('love (between a man and a woman)'), 'love')
  assert.equal(coreMeaning('hukum; undang-undang'), 'hukum')
  assert.equal(coreMeaning('habis, hilang (setelah kata kerja)'), 'habis')
  assert.equal(coreMeaning('hukum'), 'hukum')
  assert.equal(coreMeaning(''), '')
  assert.equal(otherMeanings('kesan, impresi'), 'impresi')
  assert.equal(otherMeanings('hukum; undang-undang'), 'undang-undang')
  assert.equal(otherMeanings('habis, hilang (setelah kata kerja)'), 'hilang (setelah kata kerja)')
  assert.equal(otherMeanings('love (between a man and a woman)'), 'between a man and a woman')
  assert.equal(otherMeanings('hukum'), '')
})

test('new words are grouped in balanced groups of at most four', () => {
  assert.deepEqual(groupWords([1, 2, 3, 4, 5, 6, 7]).map((g) => g.length), [4, 3])
  assert.deepEqual(groupWords([1, 2, 3, 4, 5]).map((g) => g.length), [3, 2])
  assert.deepEqual(groupWords([1, 2, 3]).map((g) => g.length), [3])
  assert.deepEqual(groupWords([]), [])
})

test('recognition asks every word once, rotates the kind and adds a match board', () => {
  const steps = composeRecognise(words.slice(0, 4), ctx)
  const picks = steps.filter((s) => s.exercise.kind !== 'match')
  assert.deepEqual(picks.map((s) => s.exercise.word.zh), ['法律', '印象', '熟悉', '性格'])
  assert.deepEqual(picks.map((s) => s.exercise.kind), ['meaning-pick', 'listen-pick', 'hanzi-pick', 'meaning-pick'])
  const match = steps.find((s) => s.exercise.kind === 'match')
  assert.ok(match, 'a match board for three or more words')
  assert.deepEqual([...match.exercise.meanings].sort(), match.exercise.pairs.map((w) => w.zh).sort())
  for (const s of picks) {
    const { word, options } = s.exercise
    assert.equal(options.length, 4)
    assert.equal(options.filter((o) => o.zh === word.zh).length, 1, 'the answer is offered exactly once')
    const meanings = options.map((o) => coreMeaning(o.en))
    if (s.exercise.kind === 'meaning-pick') assert.equal(new Set(meanings).size, 4, 'no two options read the same')
    assert.equal(new Set(options.map((o) => o.zh)).size, 4)
  }
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length)
})

test('wrong answers come from the sitting first, so real confusions are practised', () => {
  const [first] = composeRecognise(words.slice(0, 4), ctx)
  const sitting = new Set(words.map((w) => w.zh))
  assert.ok(first.exercise.options.filter((o) => o.zh !== '法律').every((o) => sitting.has(o.zh)))
})

test('cloze blanks the word inside its own sentence and offers it among other words', () => {
  const steps = composeContext(words, [], ctx)
  const clozes = steps.filter((s) => s.exercise.kind === 'cloze')
  assert.ok(clozes.length >= 2 && clozes.length <= 3)
  for (const { exercise } of clozes) {
    assert.equal(exercise.before + exercise.word.zh + exercise.after, exercise.sentence.zh)
    assert.equal(exercise.options.filter((o) => o.zh === exercise.word.zh).length, 1)
    assert.ok(exercise.options.every((o) => o.zh === exercise.word.zh || !exercise.sentence.zh.includes(o.zh)))
  }
})

test('continue keeps the head up to a comma and offers the real ending among others', () => {
  const lines = [
    { zh: '我们班跟他们班比赛，他一个人踢进两个球。', en: 'Kelas kami tanding lawan kelas mereka, dia cetak dua gol.' },
    { zh: '听说你男朋友是你同学，是真的吗？', en: 'Katanya pacarmu teman sekelasmu, beneran?' },
    { zh: '他不仅足球踢得好，性格也不错。', en: 'Dia gak cuma jago bola, kepribadiannya juga oke.' },
  ]
  const steps = composeContext(words, lines, ctx)
  const cont = steps.find((s) => s.exercise.kind === 'continue')
  assert.ok(cont)
  const { head, tail, options, sentence } = cont.exercise
  assert.equal(head + tail, sentence.zh)
  assert.ok(head.endsWith('，'))
  assert.equal(options.length, 3)
  assert.equal(options.filter((o) => o === tail).length, 1)
})

test('arrange tiles rebuild the sentence, and the spare tile is not part of it', () => {
  const steps = composeContext(words, [{ zh: '我和他不是一个班。', en: 'Aku dan dia beda kelas.' }], ctx)
  const arranges = steps.filter((s) => s.exercise.kind === 'arrange')
  assert.ok(arranges.length >= 1)
  for (const { exercise } of arranges) {
    assert.equal(exercise.answer.join(''), exercise.sentence.zh)
    assert.ok(exercise.answer.length >= 3 && exercise.answer.length <= 8)
    assert.ok(exercise.tiles.length === exercise.answer.length + 1 || exercise.tiles.length === exercise.answer.length)
    assert.notEqual(exercise.tiles.join(''), exercise.answer.join(''), 'never already in order')
    assert.ok(exercise.answer.every((tile) => !/^[，。！？]$/.test(tile)), 'no punctuation-only tile')
  }
})

test('sentence tiles are natural words with punctuation glued on, never arbitrary chunks', () => {
  assert.deepEqual(sentenceTiles('我对他印象很深。', segment), ['我', '对', '他', '印象', '很', '深。'])
  const long = sentenceTiles('我们是在一次足球比赛中认识的。', segment)
  assert.equal(long.join(''), '我们是在一次足球比赛中认识的。')
  assert.ok(long.every((tile) => tile.length <= 3 || tile.endsWith('。')))
})

test('a line with more than eight words is not offered for arranging', () => {
  const lines = [{ zh: '听说你男朋友李进跟你是一个学校的，是你同学吗？', en: 'Katanya pacarmu satu sekolah sama kamu?' }]
  const steps = composeContext([words[4]], lines, ctx)
  assert.equal(steps.filter((s) => s.exercise.kind === 'arrange').length, 0)
})

test('a comma split needs real words on both sides', () => {
  assert.deepEqual(splitAtComma('他不仅足球踢得好，性格也不错。'), { head: '他不仅足球踢得好，', tail: '性格也不错。' })
  assert.equal(splitAtComma('好，我知道了。'), null)
  assert.equal(splitAtComma('没有逗号。'), null)
})

test('character building covers multi-character words, with the right characters among the tiles', () => {
  const steps = composeProduce(words, ctx)
  assert.deepEqual(steps.map((s) => s.exercise.word.zh), ['法律', '印象', '熟悉', '性格'])
  for (const { exercise } of steps) {
    assert.equal(exercise.answer.join(''), exercise.word.zh)
    for (const ch of exercise.answer) assert.ok(exercise.tiles.includes(ch))
    assert.ok(exercise.tiles.length >= 6)
  }
  const tiles = characterTiles('法律', pool, rng(7))
  assert.notEqual(tiles.slice(0, 2).join(''), '法律')
})

test('a long sitting spreads its few builds across the list instead of front-loading them', () => {
  const many = Array.from({ length: 24 }, (_, i) => W(`${'甲乙丙丁戊己庚辛壬癸子丑'[i % 12]}${'寅卯辰巳午未'[i % 6]}${i}`.replace(/\d+/, ''), `arti ${i}`))
  const unique = [...new Map(many.map((w) => [w.zh, w])).values()]
  const steps = composeProduce(unique, ctx, true)
  assert.ok(steps.length >= 1 && steps.length <= Math.ceil(unique.length / 8))
  const positions = steps.map((s) => unique.findIndex((w) => w.zh === s.exercise.word.zh))
  if (positions.length > 1) assert.ok(positions.at(-1) >= unique.length / 2, 'later words get built too')
})

test('continue never offers the same ending twice', () => {
  const lines = [
    { zh: '我们班跟他们班比赛，他一个人踢进两个球。', en: 'a' },
    { zh: '他学的是法律，我学的是新闻。', en: 'b' },
    { zh: '她学的是历史，我学的是新闻。', en: 'c' },
    { zh: '他不仅足球踢得好，性格也不错。', en: 'd' },
  ]
  const cont = composeContext(words, lines, ctx).find((s) => s.exercise.kind === 'continue')
  assert.ok(cont)
  assert.equal(new Set(cont.exercise.options).size, cont.exercise.options.length)
})

test('interleave avoids the same kind or word back to back when it can', () => {
  const items = [
    { k: 'a', w: ['1'] }, { k: 'a', w: ['2'] }, { k: 'b', w: ['1'] }, { k: 'b', w: ['3'] }, { k: 'c', w: ['2'] },
  ]
  const out = interleave(items, (i) => i.k, (i) => i.w)
  for (let i = 1; i < out.length; i++) assert.notEqual(out[i].k, out[i - 1].k)
  assert.equal(out.length, items.length)
})

test('a sitting composes deterministically and gives every exercise a unique id', () => {
  const a = composeSitting(words, [], ctx)
  const b = composeSitting(words, [], ctx)
  assert.deepEqual(a, b)
  assert.deepEqual(a.groups.map((g) => g.words), [['法律', '印象', '熟悉'], ['性格', '深']])
  const ids = [...a.groups.flatMap((g) => g.exercises), ...a.context, ...a.produce].map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('built answers compare by text, so repeated tiles are fine', () => {
  assert.ok(sameText(['我', '的', '的'], ['我的', '的']))
  assert.ok(!sameText(['的', '我'], ['我', '的']))
})

test('evidence words: single-word exercises name their word, sentence exercises none', () => {
  const steps = composeContext(words, [], ctx)
  for (const s of steps) {
    if (s.exercise.kind === 'cloze') assert.deepEqual(exerciseWords(s.exercise), [s.exercise.word.zh])
    else assert.deepEqual(exerciseWords(s.exercise), [])
  }
})
