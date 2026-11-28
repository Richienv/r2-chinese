import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ALL_HSK1_WORDS,
  HSK1_PINYIN_DRILLS,
  HSK1_PINYIN_GROUPS,
  HSK1_TONE_DRILLS,
  HSK1_TONES,
  HSK1_UNITS,
} from '../src/data/hsk1.ts'
import { mergeCoupleEvents } from '../src/lib/coupleSync.ts'
import {
  getActiveCoupleId,
  switchCoupleWorkspace,
} from '../src/lib/coupleProfile.ts'
import {
  COUPLE_GATE_KEY,
  isCoupleGateUnlocked,
  lockCoupleGate,
  unlockCoupleGate,
  verifyCouplePasscode,
} from '../src/lib/coupleAuth.ts'
import {
  classifyLexicalCategory,
  computeCategoryBreakdown,
  computeDailyComparison,
} from '../src/lib/progressAnalytics.ts'
import {
  decomposeHsk1Word,
  HSK1_BASIC_STROKES,
  HSK1_STROKE_QUIZ,
} from '../src/data/hsk1Strokes.ts'
import {
  applyHsk1NodeDone,
  nextPlayableHsk1Unit,
  normalizeHsk1Progress,
} from '../src/lib/hsk1.ts'
import {
  buildSentenceTiles,
  buildVocabWaves,
  reviewHsk1Card,
  selectHsk1RecallQueue,
} from '../src/lib/hsk1Srs.ts'

function makeMemoryStorage() {
  const map = new Map()
  return {
    get length() {
      return map.size
    },
    key(i) {
      return [...map.keys()][i] ?? null
    },
    getItem(k) {
      return map.has(k) ? map.get(k) : null
    },
    setItem(k, v) {
      map.set(k, String(v))
    },
    removeItem(k) {
      map.delete(k)
    },
  }
}

test('HSK 1 Dari Nol curriculum contains 15 structured units and 150 unique official words', () => {
  assert.equal(HSK1_UNITS.length, 15)
  assert.equal(ALL_HSK1_WORDS.length, 150)

  const uniqueZh = new Set(ALL_HSK1_WORDS.map((w) => w.zh))
  assert.equal(uniqueZh.size, 150, 'All 150 HSK 1 words across 15 units must be unique')

  for (const unit of HSK1_UNITS) {
    assert.ok(unit.words.length >= 10)
    assert.ok(unit.grammar.pattern.length > 0)
    assert.ok(unit.grammarQuiz.length >= 2)
    assert.ok(unit.dialogue.length >= 2)
    for (const w of unit.words) {
      assert.ok(w.zh.trim().length > 0)
      assert.ok(w.pinyin.trim().length > 0)
      assert.ok(w.meaningId.trim().length > 0)
      assert.ok(w.exampleZh.trim().length > 0)
    }
  }
})

test('HSK 1 4-Tones guide and Pinyin contrast drills are complete and valid', () => {
  assert.equal(HSK1_TONES.length, 5)
  assert.equal(HSK1_TONE_DRILLS.length, 12)
  assert.equal(HSK1_PINYIN_GROUPS.length, 5)
  assert.equal(HSK1_PINYIN_DRILLS.length, 10)

  for (const d of HSK1_TONE_DRILLS) {
    assert.ok(d.options[d.answerIndex], `missing valid answerIndex in ${d.id}`)
  }
  for (const d of HSK1_PINYIN_DRILLS) {
    assert.ok(d.options[d.answerIndex], `missing valid answerIndex in ${d.id}`)
  }
})

test('couple profile switcher isolates Richie (HSK 4) and Renita (HSK 1) workspaces cleanly', () => {
  const storage = makeMemoryStorage()

  // Seed Richie with real HSK 4 progress
  storage.setItem('yulu.active-profile.v1', 'richie')
  storage.setItem('yulu.course.v1', 'hsk4a')
  storage.setItem('yulu.course-entered.v1', '1')
  storage.setItem('yulu.hsk4a.v1', JSON.stringify({ xp: 850, lessonsDone: [1], cards: {}, log: {}, mastery: {}, pathDone: {}, starred: [] }))

  // Switch to Renita -> should clear Richie's active workspace and default to hsk1
  const nextId = switchCoupleWorkspace('renita', storage, { syncPush: false })
  assert.equal(nextId, 'renita')
  assert.equal(getActiveCoupleId(storage), 'renita')
  assert.equal(storage.getItem('yulu.course.v1'), 'hsk1')
  assert.equal(storage.getItem('yulu.hsk4a.v1'), null)

  // Save Renita's HSK 1 unit progress
  storage.setItem('yulu.hsk1.v1', JSON.stringify({ unitsDone: [1], provenWords: ['好', '谢谢'], tonesPassed: 6, pinyinPassed: 4, grammarPassed: 2 }))

  // Switch back to Richie -> should restore Richie's 850 XP and hide Renita's HSK 1 state
  switchCoupleWorkspace('richie', storage, { syncPush: false })
  assert.equal(getActiveCoupleId(storage), 'richie')
  assert.equal(storage.getItem('yulu.course.v1'), 'hsk4a')
  const restoredRichie = JSON.parse(storage.getItem('yulu.hsk4a.v1'))
  assert.equal(restoredRichie.xp, 850)

  // Switch back to Renita -> should restore Renita's HSK 1 state cleanly
  switchCoupleWorkspace('renita', storage, { syncPush: false })
  const restoredRenita = JSON.parse(storage.getItem('yulu.hsk1.v1'))
  assert.deepEqual(restoredRenita.provenWords, ['好', '谢谢'])
})

test('mergeCoupleEvents deduplicates by id and keeps newest events first', () => {
  const left = [
    { id: 'e1', from: 'richie', kind: 'cheer', text: 'Semangat!', at: 1000 },
    { id: 'e2', from: 'renita', kind: 'milestone', text: 'Lulus Nada!', at: 3000 },
  ]
  const right = [
    { id: 'e2', from: 'renita', kind: 'milestone', text: 'Lulus Nada!', at: 3000 },
    { id: 'e3', from: 'richie', kind: 'evolution', text: 'Naik Lv 2!', at: 2000 },
  ]
  const merged = mergeCoupleEvents(left, right)
  assert.deepEqual(merged.map((e) => e.id), ['e2', 'e3', 'e1'])
})

test('couple passcode gate validates arci case-insensitively and switches selected profile', () => {
  const storage = makeMemoryStorage()
  assert.equal(verifyCouplePasscode('arci'), true)
  assert.equal(verifyCouplePasscode('  ARCI '), true)
  assert.equal(verifyCouplePasscode('wrong'), false)
  assert.equal(isCoupleGateUnlocked(storage), false)

  unlockCoupleGate('renita', storage)
  assert.equal(isCoupleGateUnlocked(storage), true)
  assert.equal(storage.getItem(COUPLE_GATE_KEY), 'unlocked')
  assert.equal(getActiveCoupleId(storage), 'renita')
  assert.equal(storage.getItem('yulu.course.v1'), 'hsk1')

  lockCoupleGate(storage)
  assert.equal(isCoupleGateUnlocked(storage), false)
})

test('progress analytics computes yesterday vs today deltas, 7-day trend, and lexical categories', () => {
  const cmp = computeDailyComparison(
    {
      '2026-11-26': { cards: 14, lessons: 1 },
      '2026-11-27': { cards: 22, lessons: 2 },
    },
    '2026-11-27',
  )
  assert.equal(cmp.yesterdayCards, 14)
  assert.equal(cmp.todayCards, 22)
  assert.equal(cmp.deltaCards, 8)
  assert.equal(cmp.series7Days.length, 7)
  assert.equal(cmp.series7Days[5].cards, 14)
  assert.equal(cmp.series7Days[6].isToday, true)

  assert.equal(classifyLexicalCategory('吃饭', 'v.'), 'verb')
  assert.equal(classifyLexicalCategory('医院', 'n.'), 'place')
  assert.equal(classifyLexicalCategory('昨天', 'n.'), 'time')
  assert.equal(classifyLexicalCategory('虽然', 'conj.'), 'particle')
  assert.equal(classifyLexicalCategory('漂亮', 'adj.'), 'adj')

  const breakdown = computeCategoryBreakdown(
    {
      学习: {
        zh: '学习',
        lesson: 1,
        state: 'mastered',
        encounters: 3,
        attempts: 3,
        successes: 3,
        hints: 0,
        unaidedSuccesses: 3,
        successDays: ['2026-11-26', '2026-11-27'],
        lastSeen: 1000,
        lastPractice: 1000,
        modes: {
          listening: { attempts: 0, successes: 0 },
          recognition: { attempts: 1, successes: 1 },
          recall: { attempts: 2, successes: 2 },
          speaking: { attempts: 0, successes: 0 },
          writing: { attempts: 0, successes: 0 },
        },
      },
    },
    ['漂亮', '今天'],
    (zh) => (zh === '学习' ? 'v.' : undefined),
  )
  const verbRow = breakdown.find((r) => r.category === 'verb')
  const adjRow = breakdown.find((r) => r.category === 'adj')
  assert.equal(verbRow?.mastered, 1)
  assert.equal(adjRow?.mastered, 1)
})

test('HSK 1 stroke semantics and radical decomposition cover all 150 words cleanly', () => {
  assert.equal(HSK1_BASIC_STROKES.length, 8)
  for (const s of HSK1_BASIC_STROKES) {
    assert.ok(s.svgPath.trim().length > 5)
    assert.ok(s.examples.length >= 3)
  }
  assert.equal(HSK1_STROKE_QUIZ.length, 8)
  for (const q of HSK1_STROKE_QUIZ) {
    assert.ok(q.options[q.answerIndex], `invalid stroke quiz option in ${q.id}`)
  }
  for (const w of ALL_HSK1_WORDS) {
    const dec = decomposeHsk1Word(w)
    assert.ok(dec.characters.length >= 1, `missing decomposition for ${w.zh}`)
    for (const ch of dec.characters) {
      assert.ok(ch.parts.length >= 1, `missing parts for ${ch.char}`)
      assert.ok(ch.strokeGuides.length >= 1, `missing stroke guides for ${ch.char}`)
    }
  }
})

test('HSK 1 micro-waves, sentence tiles, FSRS-6 scheduling, and node progression work cohesively', () => {
  const unit1 = HSK1_UNITS[0]
  const waves = buildVocabWaves(unit1.words, 3)
  assert.equal(waves.length, 3)
  assert.deepEqual(
    waves.map((w) => w.introWords.length),
    [3, 3, 4],
  )
  for (const wv of waves) {
    assert.equal(wv.microChecks.length, wv.introWords.length)
  }

  const tiled = buildSentenceTiles('你好！谢谢你！', unit1.words)
  assert.equal(tiled.answerTokens.join(''), tiled.cleanSentence)
  assert.ok(tiled.bankTokens.length >= tiled.answerTokens.length + 2)

  // FSRS-6 card progression: 'good' pushes due date into the future; 'again' drops interval
  const now = 1_795_800_000_000
  const goodRes = reviewHsk1Card({}, '好', 1, 'good', now)
  assert.ok(goodRes.updated.due > now)
  const mature = reviewHsk1Card(goodRes.nextCards, '好', 1, 'easy', now + 86_400_000)
  assert.ok(mature.updated.interval > goodRes.updated.interval)
  const lapsed = reviewHsk1Card(mature.nextCards, '好', 1, 'again', now + 2 * 86_400_000)
  assert.ok(lapsed.updated.interval < mature.updated.interval)

  // Queue prioritizes overdue cards first
  const q = selectHsk1RecallQueue(
    {
      谢谢: { zh: '谢谢', lesson: 901, ease: 2.5, interval: 1, due: now - 3_600_000, reps: 1, lastReview: now - 90_000_000 },
      好: { zh: '好', lesson: 901, ease: 2.5, interval: 5, due: now + 5 * 86_400_000, reps: 2, lastReview: now },
    },
    ['您'],
    ALL_HSK1_WORDS,
    now,
    5,
  )
  assert.equal(q[0].zh, '谢谢')

  // Node progression advances cleanly through kenali -> goresan -> dengar -> kalimat -> bos -> Unit 2
  let state = normalizeHsk1Progress({})
  assert.deepEqual(nextPlayableHsk1Unit(state), { unit: 1, node: 'kenali' })
  state = applyHsk1NodeDone(state, 1, 'kenali')
  assert.deepEqual(nextPlayableHsk1Unit(state), { unit: 1, node: 'goresan' })
  state = applyHsk1NodeDone(state, 1, 'goresan')
  assert.deepEqual(nextPlayableHsk1Unit(state), { unit: 1, node: 'dengar' })
  state = applyHsk1NodeDone(state, 1, 'dengar')
  assert.deepEqual(nextPlayableHsk1Unit(state), { unit: 1, node: 'kalimat' })
  state = applyHsk1NodeDone(state, 1, 'kalimat')
  assert.deepEqual(nextPlayableHsk1Unit(state), { unit: 1, node: 'bos' })
  state = applyHsk1NodeDone(state, 1, 'bos', ['好'])
  assert.deepEqual(nextPlayableHsk1Unit(state), { unit: 2, node: 'kenali' })
})
