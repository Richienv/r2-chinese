import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  LEARNER_NODE_ID,
  activeConfusionPairs,
  createEmptyGraph,
  edgeKey,
  grammarNodeId,
  graphSummary,
  mergeLearnerGraphs,
  normalizeLearnerGraph,
  prioritizeWords,
  priorityScore,
  recordExamOutcome,
  recordRecallOutcome,
  recordSkippedLessons,
  skippedWordsForRecall,
  unskipLessonInGraph,
  weakGrammarPoints,
  wordNodeId,
} from '../src/lib/learnerGraph.ts'

test('active recall misses, assists, and clean recalls update weighted edges and priority score', () => {
  let g = createEmptyGraph(1000)
  g = recordRecallOutcome(g, {
    zh: '法律',
    correct: false,
    assisted: false,
    course: 'hsk4a',
    lesson: 1,
    at: 2000,
  })
  assert.ok(g.nodes[wordNodeId('法律')])
  assert.ok(g.edges[edgeKey(LEARNER_NODE_ID, 'STRUGGLED_WITH', wordNodeId('法律'))])
  const missPriority = priorityScore(g, '法律')
  assert.ok(missPriority > 1, `expected missPriority > 1, got ${missPriority}`)

  g = recordRecallOutcome(g, {
    zh: '印象',
    correct: true,
    assisted: true,
    course: 'hsk4a',
    lesson: 1,
    at: 2500,
  })
  assert.ok(priorityScore(g, '印象') > 0)

  g = recordRecallOutcome(g, {
    zh: '熟悉',
    correct: true,
    assisted: false,
    course: 'hsk4a',
    lesson: 1,
    at: 3000,
  })
  assert.ok(g.edges[edgeKey(LEARNER_NODE_ID, 'RECALLED_CLEANLY', wordNodeId('熟悉'))])
  assert.equal(priorityScore(g, '熟悉'), 0)

  const ordered = prioritizeWords(g, ['熟悉', '印象', '法律'])
  assert.equal(ordered[0], '法律')
  assert.equal(ordered[ordered.length - 1], '熟悉')

  // Repeated clean recalls decay prior struggle priority cleanly
  g = recordRecallOutcome(g, { zh: '法律', correct: true, assisted: false, at: 4000 })
  g = recordRecallOutcome(g, { zh: '法律', correct: true, assisted: false, at: 5000 })
  assert.ok(priorityScore(g, '法律') < missPriority)
})

test('confusion pairs (对↔双, 再↔又, 就↔才, 不↔没有, 了↔过) create canonical pair nodes and CONFUSED_WITH edges', () => {
  let g = createEmptyGraph(1000)
  g = recordRecallOutcome(g, {
    zh: '双',
    correct: false,
    confusedWith: '对',
    course: 'jiaocheng',
    lesson: 8,
    at: 2000,
  })
  g = recordExamOutcome(g, {
    questionId: 'jc-zai-you',
    course: 'jiaocheng',
    lesson: 9,
    grammarPoint: '再 vs 又',
    focusWords: ['再', '又'],
    confusedPairs: [
      ['再', '又'],
      ['就', '才'],
      ['不', '没有'],
      ['了', '过'],
    ],
    correct: false,
    picked: '再',
    answer: '又',
    at: 3000,
  })

  const pairs = activeConfusionPairs(g, 10)
  const labels = pairs.map((p) => p.label)
  for (const expected of ['对↔双', '再↔又', '就↔才', '不↔没有', '了↔过']) {
    assert.ok(labels.includes(expected), `missing canonical pair ${expected} in ${labels.join(', ')}`)
  }
  assert.ok(
    g.edges[edgeKey(wordNodeId('双'), 'CONFUSED_WITH', wordNodeId('对'))] ||
      g.edges[edgeKey(wordNodeId('对'), 'CONFUSED_WITH', wordNodeId('双'))],
  )
})

test('exam errors log grammar_point nodes and GRAMMAR_ERROR_ON edges', () => {
  let g = createEmptyGraph(1000)
  g = recordExamOutcome(g, {
    questionId: 'hsk4-ba-1',
    course: 'hsk4a',
    lesson: 6,
    grammarPoint: '把字句（把 + O + V + 结果/趋向补语）',
    focusWords: ['收拾'],
    correct: false,
    picked: 'A',
    answer: 'B',
    at: 2000,
  })

  const gId = grammarNodeId('把字句（把 + O + V + 结果/趋向补语）')
  assert.ok(g.nodes[gId])
  assert.ok(g.edges[edgeKey(LEARNER_NODE_ID, 'GRAMMAR_ERROR_ON', gId)])
  const weak = weakGrammarPoints(g)
  assert.equal(weak[0].point, '把字句（把 + O + V + 结果/趋向补语）')
  assert.ok(weak[0].weight > 0)
  assert.ok(priorityScore(g, '收拾') > 0)
})

test('skipped lessons record SKIPPED_NEEDS_RECALL until unskipped or cleanly recalled', () => {
  let g = createEmptyGraph(1000)
  g = recordSkippedLessons(g, {
    course: 'jiaocheng',
    lessons: [
      {
        lesson: 3,
        title: '我去邮局寄包裹',
        words: [{ zh: '寄' }, { zh: '顺便' }],
        grammarPoints: ['顺便 + Verb'],
      },
    ],
    at: 2000,
  })

  const skipped = skippedWordsForRecall(g, 'jiaocheng')
  assert.ok(skipped.includes('寄'))
  assert.ok(skipped.includes('顺便'))
  assert.ok(priorityScore(g, '寄') >= 2)
  assert.ok(g.edges[edgeKey(LEARNER_NODE_ID, 'SKIPPED_NEEDS_RECALL', wordNodeId('寄'))])

  // Clean recall clears skippedPending for that word
  g = recordRecallOutcome(g, { zh: '寄', correct: true, assisted: false, course: 'jiaocheng', lesson: 3, at: 3000 })
  assert.equal(g.nodes[wordNodeId('寄')].skippedPending, false)
  assert.ok(skippedWordsForRecall(g, 'jiaocheng').includes('顺便'))

  // Unskip clears remaining skipped markers on that lesson
  g = unskipLessonInGraph(g, { course: 'jiaocheng', lesson: 3, at: 4000 })
  const summary = graphSummary(g)
  assert.ok(!summary.skippedWords.includes('顺便'))
  assert.equal(summary.skippedPendingCount, 0)
})

test('normalizeLearnerGraph and mergeLearnerGraphs preserve higher struggle & skip evidence', () => {
  let local = createEmptyGraph(1000)
  local = recordSkippedLessons(local, {
    course: 'hsk4a',
    lessons: [{ lesson: 1, title: '简单的爱情', words: [{ zh: '法律' }] }],
    at: 2000,
  })

  let remote = createEmptyGraph(1000)
  remote = recordExamOutcome(remote, {
    questionId: 'hsk4-q1',
    course: 'hsk4a',
    lesson: 2,
    grammarPoint: '既然…就…',
    focusWords: ['既然'],
    correct: false,
    at: 3000,
  })

  const merged = normalizeLearnerGraph(mergeLearnerGraphs(local, remote))
  assert.ok(skippedWordsForRecall(merged, 'hsk4a').includes('法律'))
  assert.ok(weakGrammarPoints(merged).some((w) => w.point === '既然…就…'))
})

test('repo agent graph memory passes zero-poison hygiene check', () => {
  const out = execFileSync('python3', ['_tools/graph-memory/graph_memory.py', 'hygiene', '--json'], {
    encoding: 'utf8',
  })
  const report = JSON.parse(out)
  assert.equal(report.verdict, 'CLEAN')
  assert.equal(report.alerts, 0)
  assert.equal(report.journal_mode, 'wal')
})
