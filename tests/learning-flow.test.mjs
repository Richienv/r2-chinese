import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'

test('Mandarin sittings retrieve actual source words and keep production source-grounded', async () => {
  // Attach the transform runtime to an unbound server; the test needs no open ports.
  const transport = createHttpServer()
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { server: transport } }, appType: 'custom' })
  try {
    const content = await server.ssrLoadModule('/src/lib/content.ts')
    const flow = await server.ssrLoadModule('/src/lib/wordsSession.ts')
    for (const lesson of content.lessons) {
      for (const node of flow.PATH_NODES) {
        const steps = flow.buildSteps(lesson.lesson, node)
        assert.equal(steps.at(-1).kind, 'complete')
        const active = steps.filter((step) => step.kind !== 'complete')
        assert.equal(new Set(active.map((step) => step.id)).size, active.length, `duplicate activity ${lesson.lesson}:${node}`)
        const recalls = active.filter((step) => step.kind === 'recall')
        const expected = node === 'wrap' ? flow.teachVocab(lesson.lesson) : content.textSitting(lesson, content.textNodeIndex(node)).words
        assert.deepEqual(recalls.map((step) => step.word.zh), expected.map((word) => word.zh))
        if (node !== 'wrap') {
          const examples = active.filter((step) => step.kind === 'teach' && step.phase === 'example').map((step) => step.example.zh)
          assert.equal(new Set(examples).size, examples.length, 'a standalone example line should not repeat for every word')
          const sitting = content.textSitting(lesson, content.textNodeIndex(node))
          const source = [...sitting.text.lines, ...(sitting.grammar?.examples ?? [])]
          const production = active.filter((step) => step.kind === 'produce')
          assert.equal(production.length, 1)
          assert.ok(source.some((example) => example.zh === production[0].example.zh && example.en === production[0].example.en))
          assert.ok(production[0].words.every((word) => production[0].example.zh.includes(word)))
          const dialogue = active.find((step) => step.kind === 'dialogue')
          if (sitting.text.type === 'dialogue' && sitting.text.lines.length > 1) assert.equal(dialogue.text, sitting.text)
        }
      }
    }
    const kerja = await server.ssrLoadModule('/src/lib/kerja.ts')
    const jiaocheng = await server.ssrLoadModule('/src/lib/jiaocheng.ts')
    for (const [units, nodesFor, builder] of [
      [kerja.kerjaChapters, kerja.nodesForChapter, kerja.buildKerjaSteps],
      [jiaocheng.jiaochengLessons, jiaocheng.nodesForLesson, jiaocheng.buildJiaochengSteps],
    ]) {
      for (const unit of units) {
        for (const node of nodesFor(unit)) {
          const steps = builder(unit.index, node)
          assert.equal(steps.at(-1).kind, 'complete')
          const active = steps.filter((step) => step.kind !== 'complete')
          assert.equal(new Set(active.map((step) => step.id)).size, active.length)
          const sourceExamples = [
            ...unit.words.flatMap((word) => word.example ? [word.example] : []),
            ...unit.notes.flatMap((note) => note.example ? [note.example] : []),
            ...unit.dialogues.flatMap((text) => text.lines),
          ]
          for (const step of active) {
            if (step.kind === 'recall') assert.ok(unit.words.some((word) => word.zh === step.word.zh))
            if (step.kind === 'dialogue') assert.ok(unit.dialogues.some((text) => text.lines.some((line) => step.text.lines.some((reply) => reply.zh === line.zh))))
            if (step.kind === 'produce') assert.ok(sourceExamples.some((example) => example.zh === step.example.zh && example.en === step.example.en))
          }
        }
      }
    }
  } finally { await server.close() }
})

test('semantic resume keeps retries and assisted evidence, and rejects malformed cache', async () => {
  const cache = new Map()
  globalThis.localStorage = { getItem: (key) => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) }
  const { readLearningCheckpoint, writeLearningCheckpoint, clearLearningCheckpoint } = await import('../src/lib/resume.ts')
  const checkpoint = { stepId: 'retry:法律', retryWords: ['法律'], assistedSteps: ['recall:t1:法律'] }
  writeLearningCheckpoint('hsk:test', checkpoint)
  assert.deepEqual(readLearningCheckpoint('hsk:test'), checkpoint)
  clearLearningCheckpoint('hsk:test')
  assert.equal(readLearningCheckpoint('hsk:test'), undefined)
  cache.set('yulu.learning-checkpoints.v1', '{broken')
  assert.equal(readLearningCheckpoint('hsk:test'), undefined)
  delete globalThis.localStorage
})
