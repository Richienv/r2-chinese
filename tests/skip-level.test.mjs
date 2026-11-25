import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'

async function loadModules() {
  const transport = createHttpServer()
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: { server: transport } },
    appType: 'custom',
  })
  const cleanup = async () => {
    await server.close()
    transport.close()
  }
  const [content, flow, jiaocheng, kerja, engine, graphMod, duo] = await Promise.all([
    server.ssrLoadModule('/src/lib/content.ts'),
    server.ssrLoadModule('/src/lib/wordsSession.ts'),
    server.ssrLoadModule('/src/lib/jiaocheng.ts'),
    server.ssrLoadModule('/src/lib/kerja.ts'),
    server.ssrLoadModule('/src/lib/learningEngine.ts'),
    server.ssrLoadModule('/src/lib/learnerGraph.ts'),
    server.ssrLoadModule('/src/lib/duoSession.ts'),
  ])
  return { content, flow, jiaocheng, kerja, engine, graphMod, duo, cleanup }
}

test('Jiaocheng Skip to Lesson 13 unlocks Lesson 13, never fakes mastery, and queues L1-12 words into Active Recall & Mixed Practice', async () => {
  const { content, jiaocheng, engine, graphMod, duo, cleanup } = await loadModules()
  try {
    const now = 1_700_000_000_000
    const initial = { pathDone: {}, skippedLessons: [] }
    const { nextState, skippedSpecs } = jiaocheng.applyJiaochengSkip(initial, 13)

    assert.equal(nextState.unlockedLesson, 13)
    assert.equal(skippedSpecs.length, 12)
    assert.deepEqual(nextState.skippedLessons, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    // Lesson 13 is unlocked and playable right away
    assert.deepEqual(jiaocheng.computeJiaochengNextPlayable(nextState), { lesson: 13, node: 't1' })
    assert.equal(jiaocheng.isJiaochengLessonReached(nextState, 13), true)
    assert.equal(jiaocheng.isJiaochengNodePlayable(nextState, 13, 't1'), true)

    // Prior lessons 1-12 are marked skipped (never complete) and remain revisitable
    for (let l = 1; l <= 12; l++) {
      assert.equal(jiaocheng.isJiaochengLessonSkipped(nextState, l), true, `lesson ${l} should be skipped`)
      assert.equal(jiaocheng.isJiaochengLessonComplete(nextState, l), false, `lesson ${l} must NOT be complete`)
      assert.equal(nextState.pathDone[String(l)], undefined)
      assert.equal(jiaocheng.isJiaochengNodePlayable(nextState, l, 't1'), true, `skipped lesson ${l} remains revisitable`)
    }

    // Carryover into SRS + LearnerGraph without fake mastery
    let data = { cards: {}, mastery: {} }
    for (const spec of skippedSpecs) {
      data = engine.enqueueWords(data, 3000 + spec.lesson, spec.words, now)
    }
    let graph = graphMod.recordSkippedLessons(graphMod.createEmptyGraph(now), {
      course: 'jiaocheng',
      lessons: skippedSpecs,
      at: now,
    })

    const skippedWordSet = new Set()
    for (const spec of skippedSpecs) {
      for (const w of spec.words) {
        if (!w.zh?.trim()) continue
        skippedWordSet.add(w.zh.trim())
        assert.equal(engine.isComfortable(data, w.zh, now), false, `skipped word ${w.zh} must NOT be comfortable`)
        assert.equal(data.mastery[w.zh]?.state, 'new', `skipped word ${w.zh} mastery state must stay new`)
      }
    }
    assert.ok(skippedWordSet.size > 50)

    const queuedInGraph = graphMod.skippedWordsForRecall(graph, 'jiaocheng')
    for (const zh of skippedWordSet) {
      assert.ok(queuedInGraph.includes(zh), `expected ${zh} queued in learnerGraph SKIPPED_NEEDS_RECALL`)
    }

    // Pick a control word not inside L1-12 and verify skipped word outranks it in recommendedWords
    const l25Words = (jiaocheng.getJiaochengLesson(25)?.words ?? []).map((w) => w.zh).filter((zh) => !skippedWordSet.has(zh))
    const controlZh = l25Words[0] || content.lessons[9].vocab[0].zh
    const firstSkippedZh = [...skippedWordSet][0]
    const ranked = engine.recommendedWords(data, [controlZh, firstSkippedZh], now, graph)
    assert.equal(ranked[0], firstSkippedZh, 'skipped-lesson word should rank ahead of unskipped cold word')

    // Lesson 13 Mixed Practice surfaces carryover items from skipped L1-12
    const jcPool = duo.poolOf(jiaocheng.jiaochengLessons)
    const carryover = duo.buildSkippedCarryover(
      graph,
      (zh) => engine.isComfortable(data, zh, now),
      jcPool,
      content.lookup,
    )
    assert.ok(carryover.length > 0)
    const l13Steps = jiaocheng.buildJiaochengSteps(13, 't1')
    const mixedL13 = duo.withMixedPractice(l13Steps, 'jc:13:t1', jcPool, { graph, skippedCarryover: carryover })
    assert.ok(
      mixedL13.some((s) => s.kind === 'exercise' && typeof s.id === 'string' && s.id.startsWith('carryover:')),
      'expected carryover exercise injected into Lesson 13 mixed practice',
    )

    // Clean recall removes skippedPending on that word; unskip removes lesson skip markers cleanly
    graph = graphMod.recordRecallOutcome(graph, { zh: firstSkippedZh, correct: true, assisted: false, course: 'jiaocheng', at: now + 1000 })
    assert.equal(graph.nodes[graphMod.wordNodeId(firstSkippedZh)].skippedPending, false)
    const afterUnskipState = jiaocheng.applyJiaochengUnskip(nextState, 1)
    assert.equal(afterUnskipState.skippedLessons.includes(1), false)
    assert.equal(jiaocheng.isJiaochengLessonSkipped(afterUnskipState, 1), false)
  } finally {
    await cleanup()
  }
})

test('HSK 4 and Kerja skip-level unlock target lesson/chapter while keeping skipped words in Active Recall', async () => {
  const { content, flow, kerja, engine, graphMod, cleanup } = await loadModules()
  try {
    const now = 1_700_000_000_000
    const isDone = () => false
    const skipOpts = { skippedLessons: [1, 2, 3, 4], unlockedLesson: 5 }

    assert.deepEqual(flow.nextPlayable(isDone, skipOpts), { lesson: 5, node: 't1' })
    assert.equal(flow.isNodePlayable(5, 't1', isDone, skipOpts), true)
    assert.equal(flow.isLessonReached(5, isDone, skipOpts), true)

    let data = { cards: {}, mastery: {} }
    const skippedSpecs = content.lessons
      .filter((l) => l.lesson < 5)
      .map((l) => ({
        lesson: l.lesson,
        title: l.title.zh,
        words: content.teachableVocab(l),
        grammarPoints: l.grammar.map((g) => g.point),
      }))
    for (const spec of skippedSpecs) data = engine.enqueueWords(data, spec.lesson, spec.words, now)
    const graph = graphMod.recordSkippedLessons(graphMod.createEmptyGraph(now), {
      course: 'hsk4a',
      lessons: skippedSpecs,
      at: now,
    })

    const sampleSkipped = skippedSpecs[0].words[0].zh
    assert.equal(engine.isComfortable(data, sampleSkipped, now), false)
    assert.ok(graphMod.skippedWordsForRecall(graph, 'hsk4a').includes(sampleSkipped))

    // Kerja skip to Chapter 4
    const kerjaSkip = kerja.applyKerjaSkip({ pathDone: {}, skippedChapters: [] }, 4)
    assert.equal(kerjaSkip.nextState.unlockedChapter, 4)
    assert.equal(kerja.computeKerjaNextPlayable(kerjaSkip.nextState).chapter, 4)
    assert.equal(kerja.isKerjaChapterSkipped(kerjaSkip.nextState, 2), true)
    assert.equal(kerja.isKerjaChapterComplete(kerjaSkip.nextState, 2), false)
    assert.ok(kerjaSkip.skippedSpecs.length === 3)
    const afterKerjaUnskip = kerja.applyKerjaUnskip(kerjaSkip.nextState, 2)
    assert.equal(afterKerjaUnskip.skippedChapters.includes(2), false)
  } finally {
    await cleanup()
  }
})
