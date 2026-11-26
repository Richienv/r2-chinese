import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createCloudSyncHandler, computeBackupActivityScore as apiScore } from '../api/cloud-sync.ts'
import {
  PROGRESS_KEY,
  computeBackupActivityScore,
  exportLearningStorage,
  importLearningStorage,
} from '../src/lib/progressStorage.ts'
import { pushToCloudIfChanged, syncWithCloud } from '../src/lib/autoSync.ts'

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
  }
}

function invokeHandler(handler, { method = 'GET', url = '/api/cloud-sync', body = undefined }) {
  return new Promise((resolve, reject) => {
    const payload =
      body === undefined
        ? []
        : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8')]
    const req = Readable.from(payload)
    req.method = method
    req.url = url
    req.headers = { 'content-type': 'application/json' }
    let statusCode = 200
    const headers = {}
    const res = {
      set statusCode(v) {
        statusCode = v
      },
      get statusCode() {
        return statusCode
      },
      setHeader(k, v) {
        headers[k.toLowerCase()] = v
      },
      end(chunk = '') {
        let json = null
        try {
          json = chunk ? JSON.parse(String(chunk)) : null
        } catch {
          json = null
        }
        resolve({ status: statusCode, headers, json })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

function makeMemoryCloud() {
  const rows = new Map()
  const handler = createCloudSyncHandler({
    enabled: true,
    read: async (syncId) => rows.get(syncId) ?? null,
    write: async (row) => {
      rows.set(row.syncId, row)
    },
  })
  const fetchImpl = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : String(input)
    const out = await invokeHandler(handler, {
      method: init.method ?? 'GET',
      url,
      body: init.body,
    })
    return {
      ok: out.status >= 200 && out.status < 300,
      status: out.status,
      json: async () => out.json,
    }
  }
  return { rows, handler, fetchImpl }
}

test('computeBackupActivityScore scores empty defaults as 0 and real HSK/Jiaocheng progress > 0', () => {
  const emptyBackup = {
    format: 'yulu-progress-backup',
    version: 2,
    entries: {
      [PROGRESS_KEY]: JSON.stringify({
        xp: 0,
        lessonsDone: [],
        starred: [],
        log: {},
        cards: {},
        mastery: {},
        pathDone: {},
        unlockedLesson: 1,
        prefs: { showPinyin: true, showEnglish: true, soundOn: true },
      }),
      'yulu.jiaocheng.v1': JSON.stringify({ pathDone: {}, skippedLessons: [] }),
      'yulu.course.v1': 'hsk4a',
      'yulu.lang.v1': 'id',
    },
  }
  assert.equal(computeBackupActivityScore(emptyBackup), 0)
  assert.equal(apiScore(emptyBackup), 0)

  const jiaochengOnly = {
    format: 'yulu-progress-backup',
    version: 2,
    entries: {
      'yulu.jiaocheng.v1': JSON.stringify({ pathDone: { '1': ['t1', 't2'] }, skippedLessons: [] }),
    },
  }
  assert.ok(computeBackupActivityScore(jiaochengOnly) > 0)
  assert.ok(apiScore(jiaochengOnly) > 0)
})

test('importLearningStorage merges Jiaocheng + Kerja + HSK progress without overwriting either device', () => {
  const target = memoryStorage({
    [PROGRESS_KEY]: JSON.stringify({
      xp: 120,
      lessonsDone: [1],
      starred: ['因为'],
      pathDone: { '1': ['t1', 'wrap'] },
      cards: { 因为: { due: 100, stability: 4, reps: 2 } },
      mastery: { 因为: { zh: '因为', encounters: 3, unaidedSuccesses: 1, lastSeen: 1000 } },
      log: { '2026-11-25': { cards: 5, lessons: 1 } },
    }),
    'yulu.jiaocheng.v1': JSON.stringify({
      pathDone: { '1': ['t1', 't2'] },
      skippedLessons: [],
      unlockedLesson: 2,
    }),
  })

  const incomingBackup = JSON.stringify({
    format: 'yulu-progress-backup',
    version: 2,
    entries: {
      [PROGRESS_KEY]: JSON.stringify({
        xp: 240,
        lessonsDone: [2],
        starred: ['所以'],
        pathDone: { '2': ['t1'] },
        cards: { 所以: { due: 200, stability: 3, reps: 1 } },
        mastery: { 所以: { zh: '所以', encounters: 2, unaidedSuccesses: 1, lastSeen: 2000 } },
        log: { '2026-11-26': { cards: 8, lessons: 1 } },
      }),
      'yulu.jiaocheng.v1': JSON.stringify({
        pathDone: { '1': ['t3', 'wrap'], '2': ['t1'] },
        skippedLessons: [3],
        unlockedLesson: 4,
      }),
    },
  })

  const res = importLearningStorage(target, PROGRESS_KEY, incomingBackup)
  assert.equal(res.ok, true)

  const hsk = JSON.parse(target.getItem(PROGRESS_KEY))
  assert.deepEqual(hsk.lessonsDone, [1, 2])
  assert.ok(hsk.starred.includes('因为') && hsk.starred.includes('所以'))

  const jiaocheng = JSON.parse(target.getItem('yulu.jiaocheng.v1'))
  assert.deepEqual(jiaocheng.pathDone['1'].sort(), ['t1', 't2', 't3', 'wrap'])
  assert.deepEqual(jiaocheng.pathDone['2'], ['t1'])
  assert.deepEqual(jiaocheng.skippedLessons, [3])
  assert.equal(jiaocheng.unlockedLesson, 4)
})

test('cloud-sync API handler enforces anti-empty-overwrite, concurrency conflicts, and validation', async () => {
  const disabledHandler = createCloudSyncHandler({
    enabled: false,
    read: async () => null,
    write: async () => {},
  })
  const disabledRes = await invokeHandler(disabledHandler, { method: 'GET' })
  assert.equal(disabledRes.status, 200)
  assert.equal(disabledRes.json.enabled, false)

  const { handler } = makeMemoryCloud()
  const badProfile = await invokeHandler(handler, { url: '/api/cloud-sync?profile=../../etc' })
  assert.equal(badProfile.status, 400)

  const badMethod = await invokeHandler(handler, { method: 'DELETE' })
  assert.equal(badMethod.status, 405)

  const richBackup = {
    format: 'yulu-progress-backup',
    version: 2,
    entries: {
      [PROGRESS_KEY]: JSON.stringify({
        xp: 350,
        lessonsDone: [1, 2],
        pathDone: { '1': ['wrap'] },
        cards: { 因为: { due: 100, stability: 4, reps: 2 } },
      }),
    },
  }
  const saveRes = await invokeHandler(handler, {
    method: 'POST',
    body: { backup: richBackup, expectedUpdatedAt: 0 },
  })
  assert.equal(saveRes.status, 200)
  assert.equal(saveRes.json.action, 'saved')
  const firstAt = saveRes.json.updatedAt

  // Anti-loss guard #1: empty client cannot overwrite saved progress
  const emptyBackup = {
    format: 'yulu-progress-backup',
    version: 2,
    entries: { [PROGRESS_KEY]: JSON.stringify({ xp: 0, lessonsDone: [], cards: {} }) },
  }
  const emptyPost = await invokeHandler(handler, {
    method: 'POST',
    body: { backup: emptyBackup, expectedUpdatedAt: firstAt },
  })
  assert.equal(emptyPost.status, 200)
  assert.equal(emptyPost.json.action, 'pulled')
  assert.equal(emptyPost.json.activityScore, saveRes.json.activityScore)

  // Anti-loss guard #2: stale client gets conflict + latest cloud backup
  const stalePost = await invokeHandler(handler, {
    method: 'POST',
    body: { backup: richBackup, expectedUpdatedAt: 0 },
  })
  assert.equal(stalePost.status, 200)
  assert.equal(stalePost.json.action, 'conflict')
  assert.equal(stalePost.json.updatedAt, firstAt)
})

test('autoSync seamlessly syncs laptop <-> empty iPhone PWA and merges concurrent study', async () => {
  const { fetchImpl } = makeMemoryCloud()

  // Device A: MacBook Pro with active HSK 4 + Jiaocheng progress
  const laptopStorage = memoryStorage({
    [PROGRESS_KEY]: JSON.stringify({
      xp: 320,
      lessonsDone: [1, 2],
      starred: ['因为'],
      pathDone: { '1': ['wrap'], '2': ['wrap'] },
      cards: { 因为: { due: 100, stability: 4, reps: 2 } },
      mastery: { 因为: { zh: '因为', encounters: 3, unaidedSuccesses: 1, lastSeen: 1000 } },
      log: { '2026-11-26': { cards: 8, lessons: 1 } },
    }),
    'yulu.jiaocheng.v1': JSON.stringify({
      pathDone: { '1': ['t1', 't2'] },
      skippedLessons: [],
      unlockedLesson: 2,
    }),
    'yulu.course.v1': 'jiaocheng',
    'yulu.course-entered.v1': '1',
  })

  const laptopSync = await syncWithCloud({ storage: laptopStorage, key: PROGRESS_KEY, fetchImpl })
  assert.equal(laptopSync.status, 'saved')

  // Device B: Brand-new empty iPhone Home Screen PWA
  const iphoneStorage = memoryStorage({
    [PROGRESS_KEY]: JSON.stringify({
      xp: 0,
      lessonsDone: [],
      starred: [],
      log: {},
      cards: {},
      mastery: {},
      pathDone: {},
    }),
    'yulu.course.v1': 'hsk4a',
  })
  let hydratedCalls = 0
  const iphoneSync = await syncWithCloud({
    storage: iphoneStorage,
    key: PROGRESS_KEY,
    fetchImpl,
    onHydrated: () => {
      hydratedCalls++
    },
  })
  assert.equal(iphoneSync.status, 'saved')
  assert.equal(iphoneSync.hydrated, true)
  assert.equal(hydratedCalls, 1)
  assert.equal(iphoneStorage.getItem('yulu.course.v1'), 'jiaocheng')
  assert.deepEqual(JSON.parse(iphoneStorage.getItem(PROGRESS_KEY)).lessonsDone, [1, 2])
  assert.deepEqual(JSON.parse(iphoneStorage.getItem('yulu.jiaocheng.v1')).pathDone['1'], ['t1', 't2'])

  // Concurrent study: Laptop finishes HSK Lesson 3, while iPhone finishes Jiaocheng Unit 2
  const lMain = JSON.parse(laptopStorage.getItem(PROGRESS_KEY))
  lMain.lessonsDone.push(3)
  lMain.xp += 60
  laptopStorage.setItem(PROGRESS_KEY, JSON.stringify(lMain))

  const pushLaptop = await pushToCloudIfChanged({ storage: laptopStorage, key: PROGRESS_KEY, fetchImpl })
  assert.equal(pushLaptop.status, 'saved')

  const iJiaocheng = JSON.parse(iphoneStorage.getItem('yulu.jiaocheng.v1'))
  iJiaocheng.pathDone['2'] = ['t1', 'wrap']
  iphoneStorage.setItem('yulu.jiaocheng.v1', JSON.stringify(iJiaocheng))

  const pushIphone = await pushToCloudIfChanged({ storage: iphoneStorage, key: PROGRESS_KEY, fetchImpl })
  assert.equal(pushIphone.status, 'saved')
  assert.equal(pushIphone.hydrated, true)
  assert.deepEqual(JSON.parse(iphoneStorage.getItem(PROGRESS_KEY)).lessonsDone, [1, 2, 3])
  assert.deepEqual(JSON.parse(iphoneStorage.getItem('yulu.jiaocheng.v1')).pathDone['2'], ['t1', 'wrap'])

  // Laptop pulls and gets iPhone's Jiaocheng Unit 2 too
  const laptopPull = await syncWithCloud({ storage: laptopStorage, key: PROGRESS_KEY, fetchImpl })
  assert.equal(laptopPull.status, 'saved')
  assert.equal(laptopPull.hydrated, true)
  assert.deepEqual(JSON.parse(laptopStorage.getItem('yulu.jiaocheng.v1')).pathDone['2'], ['t1', 'wrap'])
  assert.deepEqual(JSON.parse(laptopStorage.getItem(PROGRESS_KEY)).lessonsDone, [1, 2, 3])
  assert.ok(JSON.parse(exportLearningStorage(laptopStorage, PROGRESS_KEY)).entries['yulu.jiaocheng.v1'])
})
