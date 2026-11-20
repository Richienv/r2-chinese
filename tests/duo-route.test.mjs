import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import * as R from '../src/lib/sessionRoute.ts'
import { duoLessonSteps, practiceRound, practiceBlock, isPracticeStep } from '../src/lib/sessionRoute.ts'

const meet = (zh) => ({ kind: 'teach', phase: 'meet', id: `meet:t1:${zh}`, word: { zh } })
const ex = (id) => ({ kind: 'exercise', id })

test('words are met in small groups, each followed by its own quick recognition round', () => {
  const source = [
    ...['法律', '印象', '熟悉', '性格', '深'].map(meet),
    { kind: 'read', id: 'read:1' }, { kind: 'note', id: 'note:1' },
    ...['法律', '印象', '熟悉', '性格', '深'].map((zh) => ({ kind: 'recall', id: `recall:${zh}`, word: { zh } })),
    { kind: 'quiz', id: 'quiz:0' }, { kind: 'complete' },
  ]
  const composed = {
    groups: [
      { words: ['法律', '印象', '熟悉'], exercises: [ex('ex1:meaning-pick:法律'), ex('ex1:match:a')] },
      { words: ['性格', '深'], exercises: [ex('ex1:listen-pick:性格')] },
    ],
    context: [ex('ex2:cloze:法律'), ex('ex2:arrange:x')],
    produce: [ex('ex3:build:法律'), ex('ex3:build:印象')],
  }
  const steps = duoLessonSteps(source, composed)
  assert.deepEqual(steps.map((s) => s.id ?? s.kind), [
    'meet:t1:法律', 'meet:t1:印象', 'meet:t1:熟悉', 'ex1:meaning-pick:法律', 'ex1:match:a',
    'meet:t1:性格', 'meet:t1:深', 'ex1:listen-pick:性格',
    'read:1', 'note:1',
    'ex2:cloze:法律', 'ex2:arrange:x', 'ex3:build:法律', 'ex3:build:印象',
    'recall:法律', 'recall:印象', 'recall:熟悉', 'recall:性格', 'recall:深', 'quiz:0', 'complete',
  ])
  assert.deepEqual(steps.filter((s) => s.kind === 'teach').map((s) => [s.n, s.of]), [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5]])
  // The first wave is only the first group's recognition.
  const first = practiceBlock(steps, 3)
  assert.deepEqual(practiceRound(first.steps), ['ex1:meaning-pick:法律', 'ex1:match:a'])
  // The final round: use in context, build, then type only the words that were not built.
  const last = practiceBlock(steps, 10)
  const round = practiceRound(last.steps)
  assert.deepEqual(round.slice(0, 4), ['ex2:cloze:法律', 'ex2:arrange:x', 'ex3:build:法律', 'ex3:build:印象'])
  assert.deepEqual(round.filter((id) => id.startsWith('recall:')).sort(), ['recall:性格', 'recall:深', 'recall:熟悉'].sort())
  assert.equal(round.at(-1), 'quiz:0')
})

test('a long sitting counts words inside the current group, not out of thirty', () => {
  const words = Array.from({ length: 14 }, (_, i) => `词${i}`)
  const source = [...words.map(meet), ...words.map((zh) => ({ kind: 'recall', id: `recall:${zh}`, word: { zh } })), { kind: 'complete' }]
  const groups = [0, 4, 8, 11].map((start, g) => ({ words: words.slice(start, [4, 8, 11, 14][g]), exercises: [ex(`ex1:g${g}`)] }))
  const steps = duoLessonSteps(source, { groups, context: [], produce: [] })
  const counts = steps.filter((s) => s.kind === 'teach').map((s) => `${s.n}/${s.of}`)
  assert.deepEqual(counts.slice(0, 5), ['1/4', '2/4', '3/4', '4/4', '1/4'])
  // Waves: after every two groups, those words are recalled before the next group is met.
  const firstRecall = steps.findIndex((s) => s.kind === 'recall')
  assert.ok(firstRecall < steps.findIndex((s) => s.id === 'meet:t1:词8'))
})

test('meets the composer did not group still come first, and nothing from the book is dropped', () => {
  const source = [meet('甲'), meet('乙'), { kind: 'read', id: 'r' }, { kind: 'recall', id: 'recall:甲', word: { zh: '甲' } }, { kind: 'complete' }]
  const steps = duoLessonSteps(source, { groups: [], context: [], produce: [] })
  assert.deepEqual(steps.map((s) => s.id ?? s.kind), ['meet:t1:甲', 'meet:t1:乙', 'r', 'recall:甲', 'complete'])
})

test('exercise steps count as practice', () => {
  assert.ok(isPracticeStep({ kind: 'exercise' }))
})

function checkExercise(step, where) {
  const e = step.exercise
  const label = `${where} ${step.id}`
  if ('options' in e && e.kind !== 'continue') {
    assert.equal(e.options.filter((o) => o.zh === e.word.zh).length, 1, `${label}: answer offered once`)
    assert.ok(e.options.length >= 3, `${label}: at least three options`)
  }
  if (e.kind === 'cloze') assert.equal(e.before + e.word.zh + e.after, e.sentence.zh, label)
  if (e.kind === 'continue') assert.equal(e.options.filter((o) => o === e.tail).length, 1, label)
  if (e.kind === 'arrange') {
    assert.equal(e.answer.join(''), e.sentence.zh, label)
    assert.ok(e.answer.length >= 3 && e.answer.length <= 8, label)
  }
  if (e.kind === 'char-build') for (const ch of e.answer) assert.ok(e.tiles.includes(ch), label)
  if (e.kind === 'match') assert.ok(e.pairs.length >= 3, label)
}

test('every real sitting in all three courses builds a valid mixed session', async () => {
  const transport = createHttpServer()
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { server: transport } }, appType: 'custom' })
  try {
    const content = await server.ssrLoadModule('/src/lib/content.ts')
    const flow = await server.ssrLoadModule('/src/lib/wordsSession.ts')
    const duo = await server.ssrLoadModule('/src/lib/duoSession.ts')
    const kerja = await server.ssrLoadModule('/src/lib/kerja.ts')
    const jiaocheng = await server.ssrLoadModule('/src/lib/jiaocheng.ts')
    const sittings = []
    for (const lesson of content.lessons) for (const node of flow.PATH_NODES) sittings.push([`hsk:${lesson.lesson}:${node}`, flow.buildSteps(lesson.lesson, node), []])
    const kerjaPool = duo.poolOf(kerja.kerjaChapters)
    for (const unit of kerja.kerjaChapters) for (const node of kerja.nodesForChapter(unit)) sittings.push([`kerja:${unit.index}:${node}`, kerja.buildKerjaSteps(unit.index, node), kerjaPool])
    const jcPool = duo.poolOf(jiaocheng.jiaochengLessons)
    for (const unit of jiaocheng.jiaochengLessons) for (const node of jiaocheng.nodesForLesson(unit)) sittings.push([`jc:${unit.index}:${node}`, jiaocheng.buildJiaochengSteps(unit.index, node), jcPool])

    let total = 0
    const kinds = new Map()
    for (const [where, base, pool] of sittings) {
      const steps = duo.withMixedPractice(base, where, pool)
      assert.equal(steps.at(-1).kind, 'complete', where)
      const active = steps.filter((s) => s.kind !== 'complete')
      assert.equal(new Set(active.map((s) => s.id)).size, active.length, `${where}: unique ids`)
      for (const step of steps.filter((s) => s.kind === 'exercise')) {
        checkExercise(step, where)
        kinds.set(step.exercise.kind, (kinds.get(step.exercise.kind) ?? 0) + 1)
        total++
      }
      // Every word met is recognised at least once before the reading.
      const met = steps.filter((s) => s.kind === 'teach').map((s) => s.word.zh)
      const readAt = steps.findIndex((s) => s.kind === 'read' || s.kind === 'note')
      const early = steps.slice(0, readAt < 0 ? steps.length : readAt).filter((s) => s.kind === 'exercise')
      const recognised = new Set(early.flatMap((s) => s.exercise.kind === 'match' ? s.exercise.pairs.map((w) => w.zh) : 'word' in s.exercise ? [s.exercise.word.zh] : []))
      for (const zh of met) assert.ok(recognised.has(zh), `${where}: ${zh} recognised after it is met`)
      // In a long sitting, a word built from tiles is built in its own wave, before the reading.
      if (met.length > R.LONG_SITTING && readAt > 0) {
        const builds = steps.filter((s) => s.kind === 'exercise' && s.exercise.kind === 'char-build' && met.includes(s.exercise.word.zh))
        assert.ok(builds.length > 0, `${where}: long sitting has builds`)
        for (const b of builds) assert.ok(steps.indexOf(b) < readAt, `${where}: ${b.id} sits in its wave`)
      }
      // No sitting balloons: the whole played queue stays bounded.
      let played = 0
      for (let i = 0; i < steps.length; i++) {
        if (!isPracticeStep(steps[i])) { played++; continue }
        const block = practiceBlock(steps, i)
        played += practiceRound(block.steps).length
        i = block.end
      }
      const old = R.compactLessonSteps(base)
      let before = 0
      for (let i = 0; i < old.length; i++) {
        if (!isPracticeStep(old[i])) { before++; continue }
        const block = practiceBlock(old, i)
        before += practiceRound(block.steps).length
        i = block.end
      }
      assert.ok(played <= Math.ceil(before * 1.75) + 6, `${where}: ${played} steps (was ${before}) is too long`)
    }
    for (const kind of ['meaning-pick', 'hanzi-pick', 'listen-pick', 'match', 'cloze', 'continue', 'arrange', 'char-build']) {
      assert.ok((kinds.get(kind) ?? 0) > 0, `${kind} appears somewhere in the courses`)
    }
    assert.ok(total > 500)
  } finally {
    await server.close()
    transport.close()
  }
})
