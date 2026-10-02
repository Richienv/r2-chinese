import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'

const unitLines = (unit, hsk = false) => hsk
  ? [...unit.texts.flatMap((text) => text.lines), ...unit.grammar.flatMap((grammar) => grammar.examples), ...unit.extras.same_char.flatMap((note) => note.examples)]
  : [...unit.words.flatMap((word) => word.example ? [word.example] : []), ...unit.dialogues.flatMap((text) => text.lines), ...unit.notes.flatMap((note) => note.example ? [note.example] : [])]

test('additional teaching examples stay in the current source unit, preserve fields, deduplicate, and cap at four', async () => {
  const transport = createHttpServer()
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { server: transport } }, appType: 'custom' })
  try {
    const { teachingExamples } = await server.ssrLoadModule('/src/lib/teachingExamples.ts')
    const content = await server.ssrLoadModule('/src/lib/content.ts')
    const kerja = await server.ssrLoadModule('/src/lib/kerja.ts')
    const jiaocheng = await server.ssrLoadModule('/src/lib/jiaocheng.ts')
    for (const [course, units, offset] of [['hsk4a', content.lessons, 0], ['kerja', kerja.kerjaChapters, 1000], ['jiaocheng', jiaocheng.jiaochengLessons, 3000]]) {
      const unit = units[0]
      const lines = unitLines(unit, course === 'hsk4a')
      const words = course === 'hsk4a' ? unit.vocab : unit.words
      const word = words.find((entry) => new Set(lines.filter((line) => content.hasWordToken(line.zh, entry.zh)).map((line) => line.zh)).size > 1)
      assert.ok(word, `${course} has multiple real example fixtures`)
      const primary = lines.find((line) => content.hasWordToken(line.zh, word.zh))
      const index = course === 'hsk4a' ? unit.lesson : unit.index
      const examples = teachingExamples(course, index + offset, word.zh, primary)
      assert.equal(examples[0].zh, primary.zh)
      assert.deepEqual(examples[0], { zh: primary.zh, pinyin: primary.pinyin, en: primary.en })
      assert.ok(examples.length > 1 && examples.length <= 4)
      assert.equal(new Set(examples.map((example) => example.zh.trim())).size, examples.length)
      for (const example of examples) {
        assert.ok(content.hasWordToken(example.zh, word.zh))
        assert.ok(lines.some((source) => source.zh === example.zh && source.pinyin === example.pinyin && source.en === example.en), `${course} example must preserve its source`)
      }
      assert.deepEqual(teachingExamples(course, index, word.zh, primary), examples, 'local and persisted namespace indices resolve the same current unit')
      assert.deepEqual(teachingExamples(course, 999, word.zh, null), [], 'missing source unit cannot borrow another lesson')
    }
    const crowded = teachingExamples('hsk4a', 1, '我', null)
    assert.equal(crowded.length, 4)
    const primary = crowded[0]
    assert.equal(teachingExamples('hsk4a', 1, '我', primary).filter((example) => example.zh === primary.zh).length, 1)
    assert.deepEqual(teachingExamples('books', 1, '我', null), [])
    for (const lesson of content.lessons) {
      for (const example of teachingExamples('hsk4a', lesson.lesson, '亮', null)) assert.ok(content.hasWordToken(example.zh, '亮'), '月亮 must not masquerade as a standalone 亮 example')
    }
  } finally { await server.close() }
})
