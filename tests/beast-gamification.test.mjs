import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { evaluateBeastProgress, LEGENDARY_BEASTS } from '../src/lib/beastEngine.ts'
import {
  BEAST_STAGES,
  FREE_BEAST_STAGE_IDS,
  getBeastStage,
  isBeastStageId,
} from '../src/lib/beastStages.ts'
import { createEmptyGraph, recordExamOutcome } from '../src/lib/learnerGraph.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function makeMastery(zh, state, opts) {
  const recall = opts?.recall ?? (state === 'mastered' ? 3 : 1)
  const write = opts?.write ?? 0
  return {
    zh,
    lesson: 1,
    state,
    encounters: 2,
    attempts: recall + write,
    successes: recall + write,
    hints: 0,
    unaidedSuccesses: state === 'mastered' ? 3 : 1,
    successDays: ['2026-11-27'],
    lastSeen: opts?.lastPractice ?? 1_795_700_000_000,
    lastPractice: opts?.lastPractice ?? 1_795_700_000_000,
    modes: {
      listening: { attempts: 0, successes: 0 },
      recognition: { attempts: 1, successes: 1 },
      recall: { attempts: recall, successes: recall },
      speaking: { attempts: 0, successes: 0 },
      writing: { attempts: write, successes: write },
    },
  }
}

test('all 8 Legendary Beast WebP assets exist on disk with valid sizes', () => {
  assert.equal(LEGENDARY_BEASTS.length, 8)
  for (const beast of LEGENDARY_BEASTS) {
    const filePath = path.join(rootDir, 'public', beast.imageSrc.replace(/^\//, ''))
    assert.ok(fs.existsSync(filePath), `missing beast asset ${beast.imageSrc}`)
    const stat = fs.statSync(filePath)
    assert.ok(stat.size > 15_000, `expected ${beast.imageSrc} > 15KB, got ${stat.size}`)
  }
})

test('fresh reset progress starts at Lv 1 Spirit Jade Egg with 3 free starter cards', () => {
  const res = evaluateBeastProgress({
    mastery: {},
    cards: {},
    lessonsDone: [],
    pathDone: {},
    streak: 0,
    xp: 0,
    log: {},
    history: [],
    learnerGraph: createEmptyGraph(0),
    todayKey: '2026-11-27',
    nowMs: 1_795_750_000_000,
  })
  assert.equal(res.level, 1)
  assert.equal(res.beast.id, 'egg')
  assert.equal(res.beast.zhName, '灵蛋')
  assert.equal(res.spiritPower, 0)
  assert.equal(res.nextBeast?.id, 'qilin')
  assert.equal(res.powerToNext, 150)
  assert.deepEqual(res.unlockedAchievementKeys, [])
  assert.deepEqual(res.unlockedStageIds, [...FREE_BEAST_STAGE_IDS])
  assert.equal(res.flame.tier, 'cold')
  assert.equal(res.questsDoneCount, 0)
})

test('6 HSK variables evolve beast stages, unlock achievements, and compute daily quests', () => {
  const todayNoon = new Date(2026, 10, 27, 12, 0, 0).getTime()
  const mastery = {}
  const cards = {}
  for (let i = 0; i < 100; i++) {
    const zh = `词${i}`
    mastery[zh] = makeMastery(zh, 'mastered', {
      write: i < 20 ? 1 : 0,
      lastPractice: todayNoon,
    })
    cards[zh] = {
      zh,
      lesson: 1,
      ease: 2.5,
      interval: 10,
      due: todayNoon + 86_400_000,
      reps: 3,
      lastReview: todayNoon - 86_400_000,
    }
  }

  let graph = createEmptyGraph(todayNoon)
  for (let i = 0; i < 6; i++) {
    graph = recordExamOutcome(graph, {
      questionId: `q-${i}`,
      course: 'hsk4a',
      lesson: 1,
      grammarPoint: `把字句-${i}`,
      correct: true,
    })
  }

  const res = evaluateBeastProgress({
    mastery,
    cards,
    lessonsDone: [1, 2, 3, 4],
    pathDone: {
      '1': ['t1', 't2', 't3', 'wrap'],
      '2': ['t1', 'wrap'],
      '3': ['t1', 'wrap'],
      '5': ['t1', 't2'],
    },
    streak: 8,
    xp: 2400,
    log: {
      '2026-11-26': { lessons: 1, cards: 14 },
      '2026-11-27': { lessons: 1, cards: 15 },
    },
    history: [
      { t: todayNoon - 1000, course: 'hsk4a', kind: 'quiz', lesson: 0, correct: true, xp: 88 },
    ],
    learnerGraph: graph,
    todayKey: '2026-11-27',
    nowMs: todayNoon,
  })

  assert.equal(res.retentionPct, 100)
  assert.equal(res.retentionMultiplier, 1.15)
  assert.equal(res.flame.tier, 'blue')
  assert.ok(res.spiritPower >= 6000, `expected >= 6000 power, got ${res.spiritPower}`)
  assert.equal(res.level, 8)
  assert.equal(res.beast.id, 'sovereign')
  assert.equal(res.questsDoneCount, 3)
  assert.ok(res.unlockedAchievementKeys.includes('unaided_15'))
  assert.ok(res.unlockedAchievementKeys.includes('streak_3'))
  assert.ok(res.unlockedAchievementKeys.includes('wraps_3'))
  assert.ok(res.unlockedAchievementKeys.includes('unaided_50'))
  assert.ok(res.unlockedAchievementKeys.includes('exam_pass'))
  assert.ok(res.unlockedAchievementKeys.includes('master_100'))
  assert.equal(res.unlockedStageIds.length, BEAST_STAGES.length)
})

test('stage lookup & validation fall back cleanly for unknown ids', () => {
  assert.equal(isBeastStageId('unite-jade'), true)
  assert.equal(isBeastStageId('astral-emperor'), true)
  assert.equal(isBeastStageId('unknown-card'), false)
  assert.equal(getBeastStage('unknown-card').id, 'unite-jade')
  assert.equal(getBeastStage('vmax-celestial').rarity, 'legendary')
})
