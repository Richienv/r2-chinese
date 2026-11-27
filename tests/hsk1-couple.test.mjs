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
