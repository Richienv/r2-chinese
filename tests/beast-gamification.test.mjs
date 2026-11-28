import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  describeBeastUnlockState,
  evaluateBeastProgress,
  getBeastMinPower,
  getTrainerAssetSrc,
  LEGENDARY_BEASTS,
} from '../src/lib/beastEngine.ts'
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

test('all 24 evolution tiers across 8x3 cycles and all 48 Richie/Renita Trainer+Partner WebPs exist with valid thresholds', () => {
  assert.equal(LEGENDARY_BEASTS.length, 24)
  const expectedStages = ['bayi', 'matang', 'dewa']
  for (let i = 0; i < LEGENDARY_BEASTS.length; i++) {
    const beast = LEGENDARY_BEASTS[i]
    assert.equal(beast.level, i + 1)
    assert.equal(beast.speciesIndex, Math.floor(i / 3) + 1)
    assert.equal(beast.stage, expectedStages[i % 3])
    for (const memberId of ['richie', 'renita']) {
      const assetPath = getTrainerAssetSrc(beast, memberId)
      const filePath = path.join(rootDir, 'public', assetPath.replace(/^\//, ''))
      assert.ok(fs.existsSync(filePath), `missing trainer asset ${assetPath}`)
      const stat = fs.statSync(filePath)
      assert.ok(stat.size > 15_000, `expected ${assetPath} > 15KB, got ${stat.size}`)
    }
    if (i > 0) {
      assert.ok(
        getBeastMinPower(beast, 'hsk4') > getBeastMinPower(LEGENDARY_BEASTS[i - 1], 'hsk4'),
        `hsk4 threshold must increase at lv ${beast.level}`,
      )
      assert.ok(
        getBeastMinPower(beast, 'hsk1') > getBeastMinPower(LEGENDARY_BEASTS[i - 1], 'hsk1'),
        `hsk1 threshold must increase at lv ${beast.level}`,
      )
    }
  }
})

test('fresh reset progress starts at Lv 1 Baby Jade Qilin with 3 free starter cards on both tracks', () => {
  for (const track of ['hsk4', 'hsk1']) {
    const res = evaluateBeastProgress({
      track,
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
    assert.equal(res.beast.id, 'qilin_bayi')
    assert.equal(res.beast.stage, 'bayi')
    assert.equal(res.beast.speciesIndex, 1)
    assert.equal(res.beast.zhName, '玉麟幼仔')
    assert.equal(res.spiritPower, 0)
    assert.equal(res.nextBeast?.id, 'qilin_matang')
    assert.deepEqual(res.unlockedAchievementKeys, [])
    assert.deepEqual(res.unlockedStageIds, [...FREE_BEAST_STAGE_IDS])
    assert.equal(res.flame.tier, 'cold')
  }
})

test('HSK 4 true-mastery track requires ~50 mastered words (not passive browsing) to unlock Lv 2 and scales to Lv 24', () => {
  const todayNoon = new Date(2026, 10, 27, 12, 0, 0).getTime()

  // 1) Passive exposure-only records yield ZERO Spirit Power and remain Lv 1
  const passiveRes = evaluateBeastProgress({
    track: 'hsk4',
    mastery: {
      好: { ...makeMastery('好', 'new'), unaidedSuccesses: 0, modes: { listening: { attempts: 0, successes: 0 }, recognition: { attempts: 0, successes: 0 }, recall: { attempts: 0, successes: 0 }, speaking: { attempts: 0, successes: 0 }, writing: { attempts: 0, successes: 0 } } },
    },
    cards: {},
    lessonsDone: [],
    pathDone: {},
    streak: 0,
    xp: 500,
    log: {},
    history: [],
    learnerGraph: createEmptyGraph(todayNoon),
    todayKey: '2026-11-27',
    nowMs: todayNoon,
  })
  assert.equal(passiveRes.level, 1)
  assert.equal(passiveRes.spiritPower, 0)

  // 2) 50 truly mastered words cleanly unlock Lv 2 (Baby Jade Qilin)
  const fiftyMastery = {}
  for (let i = 0; i < 50; i++) {
    fiftyMastery[`词${i}`] = makeMastery(`词${i}`, 'mastered', { lastPractice: todayNoon })
  }
  const lv2Res = evaluateBeastProgress({
    track: 'hsk4',
    mastery: fiftyMastery,
    cards: {},
    lessonsDone: [],
    pathDone: {},
    streak: 1,
    xp: 0,
    log: {},
    history: [],
    learnerGraph: createEmptyGraph(todayNoon),
    todayKey: '2026-11-27',
    nowMs: todayNoon,
  })
  assert.ok(lv2Res.spiritPower >= 1800, `expected >= 1800 with 50 mastered words, got ${lv2Res.spiritPower}`)
  assert.ok(lv2Res.level >= 2)

  // 3) High mastery across curriculum unlocks Lv 24 Sovereign Golden Dragon
  const peakMastery = {}
  const peakCards = {}
  for (let i = 0; i < 1200; i++) {
    const zh = `字${i}`
    peakMastery[zh] = makeMastery(zh, 'mastered', { write: 1, lastPractice: todayNoon })
    peakCards[zh] = {
      zh,
      lesson: 1,
      ease: 2.5,
      interval: 14,
      due: todayNoon + 86_400_000,
      reps: 4,
      lastReview: todayNoon - 86_400_000,
    }
  }
  let graph = createEmptyGraph(todayNoon)
  for (let i = 0; i < 25; i++) {
    graph = recordExamOutcome(graph, {
      questionId: `q-${i}`,
      course: 'hsk4a',
      lesson: 1,
      grammarPoint: `语法-${i}`,
      correct: true,
    })
  }
  const peakRes = evaluateBeastProgress({
    track: 'hsk4',
    mastery: peakMastery,
    cards: peakCards,
    lessonsDone: Array.from({ length: 20 }, (_, i) => i + 1),
    pathDone: {},
    streak: 35,
    xp: 5000,
    log: { '2026-11-27': { lessons: 1, cards: 15 } },
    history: [{ t: todayNoon, course: 'hsk4a', kind: 'quiz', lesson: 0, correct: true, xp: 92 }],
    learnerGraph: graph,
    todayKey: '2026-11-27',
    nowMs: todayNoon,
  })
  assert.equal(peakRes.level, 24)
  assert.equal(peakRes.beast.id, 'sovereign_dewa')
  assert.equal(peakRes.beast.stage, 'dewa')
  assert.equal(peakRes.unlockedStageIds.length, BEAST_STAGES.length)
})

test('HSK 1 Dari Nol track unlocks Lv 2 after passing 4 Tones/Pinyin + 6 proven words', () => {
  const todayNoon = new Date(2026, 10, 27, 12, 0, 0).getTime()
  const hsk1Res = evaluateBeastProgress({
    track: 'hsk1',
    mastery: {},
    cards: {},
    lessonsDone: [],
    pathDone: {},
    streak: 1,
    xp: 0,
    log: { '2026-11-27': { lessons: 1, cards: 8 } },
    history: [],
    learnerGraph: createEmptyGraph(todayNoon),
    hsk1Progress: {
      tonesPassed: 4,
      pinyinPassed: 2,
      unitsDone: [1],
      provenWords: ['好', '谢谢', '不客气', '再见', '请', '您'],
      grammarPassed: 2,
    },
    todayKey: '2026-11-27',
    nowMs: todayNoon,
  })
  assert.ok(hsk1Res.spiritPower >= 450, `expected HSK 1 Lv 2 threshold >= 450, got ${hsk1Res.spiritPower}`)
  assert.ok(hsk1Res.level >= 2)
  assert.equal(hsk1Res.questsDoneCount, 1)
})

test('stage lookup & validation fall back cleanly for unknown ids', () => {
  assert.equal(isBeastStageId('unite-jade'), true)
  assert.equal(isBeastStageId('astral-emperor'), true)
  assert.equal(isBeastStageId('unknown-card'), false)
  assert.equal(getBeastStage('unknown-card').id, 'unite-jade')
  assert.equal(getBeastStage('vmax-celestial').rarity, 'legendary')
})

test('describeBeastUnlockState binds counter, progressPct, and copy strictly to shown evolution', () => {
  const freshHsk1 = evaluateBeastProgress({
    track: 'hsk1',
    mastery: {},
    cards: {},
    lessonsDone: [],
    pathDone: {},
    streak: 0,
    xp: 0,
    log: {},
    history: [],
    learnerGraph: createEmptyGraph(0),
    hsk1Progress: { tonesPassed: 0, pinyinPassed: 0, strokesPassed: 0, unitsDone: [], provenWords: [], grammarPassed: 0 },
    todayKey: '2026-11-28',
    nowMs: Date.now(),
  })

  // Case 1: Active unlocked Lv 1
  const lv1Info = describeBeastUnlockState(freshHsk1, freshHsk1.beast)
  assert.equal(lv1Info.isLocked, false)
  assert.equal(lv1Info.counterLabel, '0 / 450 XP')
  assert.equal(lv1Info.progressPct, 0)
  assert.match(lv1Info.headlineSentence, /Butuh 450 XP lagi .* untuk membuka Wujud Lv 2/)

  // Case 2: Peeking locked Lv 14 must NOT display -450 or Lv 2
  const lv14 = LEGENDARY_BEASTS[13]
  const lv14Info = describeBeastUnlockState(freshHsk1, lv14)
  assert.equal(lv14Info.isLocked, true)
  assert.equal(lv14Info.targetLevel, 14)
  const expectedTarget = getBeastMinPower(lv14, 'hsk1')
  assert.equal(lv14Info.targetXp, expectedTarget)
  assert.equal(lv14Info.counterLabel, `0 / ${expectedTarget.toLocaleString('id-ID')} XP`)
  assert.match(lv14Info.headlineSentence, /Terkunci · Lv 14 — Butuh .* XP lagi \(Kamu saat ini Lv 1 · 0 XP\)/)
  assert.equal(lv14Info.headlineSentence.includes('-450'), false)
  assert.equal(lv14Info.headlineSentence.includes('Lv 2'), false)

  // Case 3: Peeking Lv 24 when maxed
  const lv24 = LEGENDARY_BEASTS[23]
  const maxedEval = { ...freshHsk1, level: 24, spiritPower: getBeastMinPower(lv24, 'hsk1') + 200, beast: lv24, nextBeast: null }
  const maxInfo = describeBeastUnlockState(maxedEval, lv24)
  assert.equal(maxInfo.isLocked, false)
  assert.equal(maxInfo.isMaxLevel, true)
  assert.equal(maxInfo.progressPct, 100)
})
