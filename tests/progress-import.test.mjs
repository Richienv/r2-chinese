import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROGRESS_KEY,
  exportLearningStorage,
  importLearningStorage,
} from '../src/lib/progressStorage.ts'

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null
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
    dump() {
      return Object.fromEntries(map)
    },
  }
}

test('round-trips full export backup into a fresh Home Screen storage', () => {
  const sourceKey = `${PROGRESS_KEY}.user-old`
  const source = memoryStorage({
    [sourceKey]: JSON.stringify({
      xp: 420,
      lessonsDone: [1, 2, 3],
      skippedLessons: [4],
      unlockedLesson: 5,
      starred: ['因为', '所以'],
      pathDone: { '1': ['t1', 'wrap'] },
      cards: { 因为: { due: 100, stability: 4, reps: 2 } },
      mastery: { 因为: { zh: '因为', encounters: 3, unaidedSuccesses: 1, lastSeen: 1000 } },
      log: { '2026-11-25': { cards: 8, lessons: 1 } },
      prefs: { showPinyin: false, showEnglish: true, soundOn: true },
    }),
    'yulu.jiaocheng.v1': JSON.stringify({ currentLesson: 13, done: ['1-1', '12-3'] }),
    'yulu.course.v1': 'jiaocheng',
    'yulu.lang.v1': 'id',
    'yulu.hsk-writing.v1:user-old': JSON.stringify({ draft1: '我今天学习汉语' }),
    'yulu.learner-graph.v1': JSON.stringify({
      version: 1,
      updatedAt: 5000,
      nodes: {
        'word:因为': {
          id: 'word:因为',
          kind: 'word',
          label: '因为',
          struggleScore: 2,
          cleanCount: 1,
          struggleCount: 1,
          skippedPending: false,
          updatedAt: 5000,
        },
      },
      edges: {},
    }),
  })

  const backupJson = exportLearningStorage(source, sourceKey)
  const freshPwa = memoryStorage({
    [PROGRESS_KEY]: JSON.stringify({
      xp: 0,
      lessonsDone: [],
      starred: [],
      log: {},
      cards: {},
      mastery: {},
      pathDone: {},
      prefs: { showPinyin: true, showEnglish: true, soundOn: true },
    }),
  })

  const res = importLearningStorage(freshPwa, progressKeyFor('local'), backupJson)
  assert.equal(res.ok, true)
  if (!res.ok) return

  const restoredMain = JSON.parse(freshPwa.getItem(PROGRESS_KEY))
  assert.deepEqual(restoredMain.lessonsDone, [1, 2, 3])
  assert.equal(restoredMain.unlockedLesson, 5)
  assert.deepEqual(restoredMain.starred, ['因为', '所以'])
  assert.equal(restoredMain.prefs.showPinyin, false)
  assert.ok(restoredMain.xp >= 420)

  assert.equal(JSON.parse(freshPwa.getItem('yulu.jiaocheng.v1')).currentLesson, 13)
  assert.equal(freshPwa.getItem('yulu.course.v1'), 'jiaocheng')
  assert.equal(freshPwa.getItem('yulu.lang.v1'), 'id')
  assert.ok(freshPwa.getItem('yulu.hsk-writing.v1:local').includes('我今天学习汉语'))
  const restoredGraph = JSON.parse(freshPwa.getItem('yulu.learner-graph.v1'))
  assert.ok(restoredGraph.nodes['word:因为'])
})

function progressKeyFor(scope) {
  return scope === 'local' ? PROGRESS_KEY : `${PROGRESS_KEY}.${scope}`
}

test('merges imported backup with existing non-empty progress non-destructively', () => {
  const target = memoryStorage({
    [`${PROGRESS_KEY}.acc2`]: JSON.stringify({
      xp: 120,
      lessonsDone: [2],
      starred: ['所以'],
      pathDone: { '2': ['t1'] },
      cards: { 所以: { due: 200, stability: 2, reps: 1 } },
      mastery: { 所以: { zh: '所以', encounters: 1, unaidedSuccesses: 1, lastSeen: 2000 } },
      log: { '2026-11-26': { cards: 3, lessons: 1 } },
    }),
  })

  const backup = JSON.stringify({
    format: 'yulu-progress-backup',
    version: 2,
    entries: {
      [PROGRESS_KEY]: JSON.stringify({
        xp: 250,
        lessonsDone: [1],
        starred: ['因为'],
        pathDone: { '1': ['wrap'] },
        cards: { 因为: { due: 100, stability: 4, reps: 2 } },
        mastery: { 因为: { zh: '因为', encounters: 2, unaidedSuccesses: 1, lastSeen: 1500 } },
        log: { '2026-11-25': { cards: 5, lessons: 1 } },
      }),
      'evil.arbitrary.key': 'should-be-ignored',
    },
  })

  const res = importLearningStorage(target, `${PROGRESS_KEY}.acc2`, backup)
  assert.equal(res.ok, true)
  const merged = JSON.parse(target.getItem(`${PROGRESS_KEY}.acc2`))
  assert.deepEqual(merged.lessonsDone, [1, 2])
  assert.ok(merged.starred.includes('因为'))
  assert.ok(merged.starred.includes('所以'))
  assert.equal(target.getItem('evil.arbitrary.key'), null)
})

test('rejects invalid JSON and backups with no recognized Yulu entries', () => {
  const storage = memoryStorage()
  assert.deepEqual(importLearningStorage(storage, PROGRESS_KEY, '{not json'), {
    ok: false,
    error: 'invalid-json',
  })
  assert.deepEqual(
    importLearningStorage(
      storage,
      PROGRESS_KEY,
      JSON.stringify({ format: 'other-app', entries: { foo: 'bar' } }),
    ),
    { ok: false, error: 'unrecognized-format' },
  )
  assert.deepEqual(
    importLearningStorage(
      storage,
      PROGRESS_KEY,
      JSON.stringify({ format: 'yulu-progress-backup', entries: { unknown: '123' } }),
    ),
    { ok: false, error: 'no-valid-entries' },
  )
})
