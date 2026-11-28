// Strict workspace & HSK 1 vocabulary isolation for Renita's account (`profile=renita`).
// Zero DOM dependencies so client sync, couple switching, and Node tests share identical rules.
import { HSK1_UNITS } from '../data/hsk1.ts'
import { BEAST_STORAGE_KEY, isBeastStageId } from './beastStages.ts'

export const HSK1_WORD_SET: ReadonlySet<string> = new Set(
  HSK1_UNITS.flatMap((u) => u.words.map((w) => w.zh)),
)

export function isHsk1Word(zh: string): boolean {
  return HSK1_WORD_SET.has(zh)
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function filterRecordByHsk1Words<T>(rec: unknown): Record<string, T> {
  if (!isRecord(rec)) return {}
  const out: Record<string, T> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (HSK1_WORD_SET.has(k)) {
      out[k] = v as T
    }
  }
  return out
}

/** True when `yulu.hsk1.v1` contains real zero-foundation study evidence for Renita. */
export function hasRealHsk1Progress(raw: unknown): boolean {
  if (!isRecord(raw)) return false
  if (Array.isArray(raw.unitsDone) && raw.unitsDone.length > 0) return true
  if (Array.isArray(raw.provenWords) && raw.provenWords.length > 0) return true
  if (typeof raw.tonesPassed === 'number' && raw.tonesPassed > 0) return true
  if (typeof raw.pinyinPassed === 'number' && raw.pinyinPassed > 0) return true
  if (typeof raw.strokesPassed === 'number' && raw.strokesPassed > 0) return true
  if (typeof raw.grammarPassed === 'number' && raw.grammarPassed > 0) return true
  if (isRecord(raw.nodeDone) && Object.keys(raw.nodeDone).length > 0) return true
  if (isRecord(raw.srsCards) && Object.keys(raw.srsCards).length > 0) return true
  return false
}

/**
 * Strip leaked HSK 4 course/cards/lessons/XP/Beast state from Renita's storage so she
 * ALWAYS stays strictly on HSK 1 Dari Nol + Sakura Pink theme (Lv 1 / 0 spirit power when new).
 * Returns true if any foreign HSK 4 data or mismatched course/stage was cleaned.
 */
export function sanitizeRenitaStorage(
  storage: StorageLike,
  mainKey = 'yulu.hsk4a.v1',
): boolean {
  let cleaned = false

  // 1) Lock active course to HSK 1 Dari Nol
  try {
    const curCourse = storage.getItem('yulu.course.v1')
    if (curCourse !== 'hsk1') {
      storage.setItem('yulu.course.v1', 'hsk1')
      cleaned = true
    }
    if (storage.getItem('yulu.course-entered.v1') !== '1') {
      storage.setItem('yulu.course-entered.v1', '1')
    }
  } catch {
    /* ignore storage errors */
  }

  const hsk1Obj = parseJson(storage.getItem('yulu.hsk1.v1'))
  const hasHsk1 = hasRealHsk1Progress(hsk1Obj)

  // 2) Sanitize shared main progress JSON (`yulu.hsk4a.v1`) by removing HSK 4 lessons/words
  let remainingHsk1Words = 0
  const mainRaw = storage.getItem(mainKey)
  const mainObj = parseJson(mainRaw)
  if (isRecord(mainObj)) {
    const prevCards = isRecord(mainObj.cards) ? Object.keys(mainObj.cards).length : 0
    const prevMastery = isRecord(mainObj.mastery) ? Object.keys(mainObj.mastery).length : 0
    const prevLessons = Array.isArray(mainObj.lessonsDone) ? mainObj.lessonsDone.length : 0
    const prevPathKeys = isRecord(mainObj.pathDone) ? Object.keys(mainObj.pathDone).length : 0
    const prevSkipped = Array.isArray(mainObj.skippedLessons) ? mainObj.skippedLessons.length : 0
    const prevUnlocked = typeof mainObj.unlockedLesson === 'number' ? mainObj.unlockedLesson : 1

    const nextCards = filterRecordByHsk1Words(mainObj.cards)
    const nextMastery = filterRecordByHsk1Words(mainObj.mastery)
    const nextStarred = Array.isArray(mainObj.starred)
      ? mainObj.starred.filter((w): w is string => typeof w === 'string' && HSK1_WORD_SET.has(w))
      : []
    const nextStarChanges = filterRecordByHsk1Words(mainObj.starChanges)

    remainingHsk1Words = Object.keys(nextCards).length + Object.keys(nextMastery).length

    const hadForeignCards =
      Object.keys(nextCards).length !== prevCards ||
      Object.keys(nextMastery).length !== prevMastery ||
      prevLessons > 0 ||
      prevPathKeys > 0 ||
      prevSkipped > 0 ||
      prevUnlocked > 1 ||
      Boolean(mainObj.inProgress)

    if (hadForeignCards) cleaned = true

    const nextMain: Record<string, unknown> = {
      ...mainObj,
      cards: nextCards,
      mastery: nextMastery,
      lessonsDone: [],
      pathDone: {},
      starred: nextStarred,
      starChanges: nextStarChanges,
    }
    delete nextMain.skippedLessons
    delete nextMain.unlockedLesson
    delete nextMain.inProgress

    if (isRecord(mainObj.learning)) {
      const learning = mainObj.learning
      const origins = filterRecordByHsk1Words(learning.origins)
      const events: Record<string, unknown> = {}
      if (isRecord(learning.events)) {
        for (const [id, ev] of Object.entries(learning.events)) {
          if (isRecord(ev) && typeof ev.zh === 'string' && HSK1_WORD_SET.has(ev.zh)) {
            events[id] = ev
          }
        }
      }
      nextMain.learning = {
        ...learning,
        origins,
        events,
        credits: hasHsk1 ? learning.credits : {},
      }
    }

    if (!hasHsk1 && remainingHsk1Words === 0) {
      if (typeof mainObj.xp === 'number' && mainObj.xp > 0) cleaned = true
      if (isRecord(mainObj.log) && Object.keys(mainObj.log).length > 0) cleaned = true
      nextMain.xp = 0
      nextMain.log = {}
      delete nextMain.learnerGraph
    }

    if (cleaned || hadForeignCards || (!hasHsk1 && remainingHsk1Words === 0)) {
      try {
        storage.setItem(mainKey, JSON.stringify(nextMain))
        storage.removeItem(`${mainKey}.pending`)
      } catch {
        /* ignore */
      }
    }
  }

  // 3) Clear polluted pending backup / foreign HSK-4 learner graph if no HSK 1 evidence exists
  if (!hasHsk1 && remainingHsk1Words === 0) {
    try {
      storage.removeItem(`${mainKey}.pending`)
      storage.removeItem('yulu.learner-graph.v1')
    } catch {
      /* ignore */
    }
  }

  // 4) Keep ONLY HSK 1 events in `yulu.history.v1`
  const historyObj = parseJson(storage.getItem('yulu.history.v1'))
  if (Array.isArray(historyObj)) {
    const cleanHistory = historyObj.filter((ev) => isRecord(ev) && ev.course === 'hsk1')
    if (cleanHistory.length !== historyObj.length) {
      cleaned = true
      try {
        storage.setItem('yulu.history.v1', JSON.stringify(cleanHistory))
      } catch {
        /* ignore */
      }
    }
  }

  // 5) Ensure Lv 1 Beast stage starts cleanly on Sakura Pink when Renita is fresh
  const beastObj = parseJson(storage.getItem(BEAST_STORAGE_KEY))
  if (!hasHsk1 && remainingHsk1Words === 0) {
    const curStage = isRecord(beastObj) ? beastObj.stageId : undefined
    const curLevel = isRecord(beastObj) ? beastObj.lastSeenLevel : undefined
    const curEarned =
      isRecord(beastObj) && Array.isArray(beastObj.earnedAchievementKeys)
        ? beastObj.earnedAchievementKeys.length
        : 0
    if (curStage !== 'sakura-unite' || curLevel !== 1 || curEarned > 0) {
      cleaned = true
      try {
        storage.setItem(
          BEAST_STORAGE_KEY,
          JSON.stringify({
            stageId: 'sakura-unite',
            lastSeenLevel: 1,
            earnedAchievementKeys: [],
            revealMuted: isRecord(beastObj) ? Boolean(beastObj.revealMuted) : false,
            updatedAt: 0,
          }),
        )
      } catch {
        /* ignore */
      }
    }
  } else if (isRecord(beastObj) && (beastObj.stageId === 'unite-jade' || !isBeastStageId(beastObj.stageId))) {
    cleaned = true
    try {
      storage.setItem(
        BEAST_STORAGE_KEY,
        JSON.stringify({
          ...beastObj,
          stageId: 'sakura-unite',
        }),
      )
    } catch {
      /* ignore */
    }
  }

  return cleaned
}
