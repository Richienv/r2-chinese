import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { entryFromSenses, formatDictionaryDefinition, naturalChineseSegments, parseCedictWord, splitFunctionChunk, tonePinyin } from '../src/lib/dictionary-format.ts'

async function sourceEntry(word) {
  const shard = JSON.parse(await readFile(new URL(`../public/dictionary/cedict-${(word.codePointAt(0) % 128).toString(16).padStart(2, '0')}.json`, import.meta.url), 'utf8'))
  return entryFromSenses(word, shard[word])
}

test('natural boundaries keep 是 and 新闻 separate and preserve original text', () => {
  const parts = naturalChineseSegments('这是新闻，不是谣言。')
  assert.ok(parts.includes('新闻'))
  assert.ok(!parts.includes('是新闻'))
  assert.equal(parts.join(''), '这是新闻，不是谣言。')
  assert.deepEqual(naturalChineseSegments('新闻 news 123！').join(''), '新闻 news 123！')
})

test('dictionary pinyin shows the correct tone on compound finals and ü', () => {
  assert.equal(tonePinyin('xin1 wen2'), 'xīn wén')
  assert.equal(tonePinyin('nu:3 hai2'), 'nǚ hái')
  assert.equal(tonePinyin('liu2 shui3'), 'liú shuǐ')
  assert.equal(tonePinyin('Bei3 jing1 ma5'), 'Běi jīng ma')
})

test('ICU function-word glue splits while 新闻 remains a natural lexical word', () => {
  assert.deepEqual(splitFunctionChunk('的是'), ['的', '是'])
  const tokens = naturalChineseSegments('他学的是新闻')
  assert.ok(tokens.includes('新闻'))
  assert.ok(!tokens.includes('的是'))
  assert.equal(tokens.join(''), '他学的是新闻')
  assert.deepEqual(splitFunctionChunk('好的'), ['好的'], 'curated compounds are not split by this correction')
})

test('dictionary references display simplified characters, tone marks and readable measure words', () => {
  const raw = 'news; CL:條|条[tiao2]'
  assert.equal(formatDictionaryDefinition(raw), 'news; measure word: 条 (tiáo)')
  assert.equal(formatDictionaryDefinition('CL:個|个[ge4],位[wei4]'), 'measure word: 个 (gè),位 (wèi)')
  assert.equal(formatDictionaryDefinition('variant of 是[shi4]'), 'variant of 是 (shì)')
  assert.equal(raw, 'news; CL:條|条[tiao2]', 'raw dictionary data are unchanged')
})

test('bundled official dictionary defines 新闻, 是 and their traditional equivalents', async () => {
  const news = await sourceEntry('新闻')
  assert.equal(news.pinyin, 'xīn wén')
  assert.match(news.en, /news/)
  assert.equal(news.source, 'CC-CEDICT')
  assert.equal((await sourceEntry('新聞')).en, news.en)
  assert.equal((await sourceEntry('是')).pinyin, 'shì')
  assert.match((await sourceEntry('是')).en, /to be/)
})

test('an invented glued phrase gets no invented definition', async () => {
  assert.equal(await sourceEntry('是新闻'), null)
  assert.equal(entryFromSenses('空', undefined), null)
})

test('refresh parser matches exact headwords and preserves real senses', () => {
  const text = '# CC-CEDICT\n新聞 新闻 [xin1 wen2] /news/CL:條|条[tiao2],個|个[ge4]/\n新聞報道 新闻报道 [xin1 wen2 bao4 dao4] /news report/\n'
  assert.equal(parseCedictWord(text, '新闻').en, 'news; CL:條|条[tiao2],個|个[ge4]')
  assert.equal(parseCedictWord(text, '新聞').pinyin, 'xīn wén')
  assert.equal(parseCedictWord(text, '新闻报'), null)
})

test('source snapshot includes attribution, license, release and download hash', async () => {
  const metadata = JSON.parse(await readFile(new URL('../public/dictionary/source.json', import.meta.url), 'utf8'))
  assert.equal(metadata.entries, 125166)
  assert.equal(metadata.license, 'CC BY-SA 4.0')
  assert.match(metadata.sourceUrl, /^https:\/\/www\.mdbg\.net\//)
  assert.match(metadata.sha256Gzip, /^[a-f0-9]{64}$/)
})
