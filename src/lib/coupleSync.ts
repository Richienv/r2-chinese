// Couple live status snapshot & shared feed sync built on top of `/api/cloud-sync`.
// Uses dedicated profiles: `default` (Richie), `renita` (Renita), and `couple` (shared cheers & milestones).
import {
  evaluateBeastProgress,
  resolveFlameMeta,
  type FlameMeta,
  type LegendaryBeastTier,
} from './beastEngine.ts'
import { defaultBeastStageForMember, getBeastStage, type BeastStageMeta } from './beastStages.ts'
import {
  COUPLE_MEMBERS,
  getCoupleNames,
  mergeRemoteCoupleNames,
  type CoupleMemberId,
} from './coupleProfile.ts'
import { normalizeHsk1Progress, type Hsk1ProgressState } from './hsk1.ts'
import type { HistoryEvent } from './history.ts'
import { createEmptyGraph, normalizeLearnerGraph } from './learnerGraph.ts'
import { normalizeMastery, type MasteryRecord } from './mastery.ts'
import { shouldBlockProdCloudSync } from './qaSandbox.ts'
import type { Card } from './srs.ts'

export type CoupleEventKind = 'evolution' | 'milestone' | 'session' | 'cheer'

export interface CoupleEvent {
  id: string
  from: CoupleMemberId
  kind: CoupleEventKind
  text: string
  beastLevel?: number
  at: number
}

export interface PartnerSnapshot {
  id: CoupleMemberId
  name: string
  badge: string
  accent: string
  beast: LegendaryBeastTier
  stage: BeastStageMeta
  level: number
  spiritPower: number
  streak: number
  flame: FlameMeta
  masteredWords: number
  hsk1UnitsDone: number
  todayCards: number
  yesterdayCards: number
  retentionPct: number
  updatedAt: number
}

const FEED_SEEN_KEY = 'yulu.couple-seen-at.v1'
const MAX_EVENTS = 40

function localDayKey(nowMs = Date.now()): string {
  const d = new Date(nowMs)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function tryJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function mergeCoupleEvents(left: CoupleEvent[], right: CoupleEvent[]): CoupleEvent[] {
  const byId = new Map<string, CoupleEvent>()
  for (const ev of [...left, ...right]) {
    if (!ev || typeof ev.id !== 'string' || !ev.id) continue
    if (ev.from !== 'richie' && ev.from !== 'renita') continue
    if (typeof ev.text !== 'string' || !ev.text.trim()) continue
    byId.set(ev.id, ev)
  }
  return [...byId.values()]
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, MAX_EVENTS)
}

function streakFromLog(log: Record<string, { lessons?: number; cards?: number }>): number {
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 365; i++) {
    const k = localDayKey(cursor.getTime())
    const entry = log[k]
    if (entry && ((entry.cards ?? 0) > 0 || (entry.lessons ?? 0) > 0)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else if (i === 0) {
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export async function fetchPartnerSnapshot(
  partnerId: CoupleMemberId,
  fetchImpl: typeof fetch = fetch,
): Promise<PartnerSnapshot | null> {
  const meta = COUPLE_MEMBERS[partnerId]
  if (shouldBlockProdCloudSync(meta.cloudProfile)) return null
  const names = getCoupleNames()
  try {
    const res = await fetchImpl(`/api/cloud-sync?profile=${encodeURIComponent(meta.cloudProfile)}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      ok?: boolean
      backup?: { entries?: Record<string, unknown> } | null
      updatedAt?: number
    }
    if (!data?.ok) return null

    const entries = data.backup?.entries ?? {}
    const main = (tryJson(entries['yulu.hsk4a.v1']) ?? {}) as {
      cards?: Record<string, Card>
      mastery?: Record<string, MasteryRecord>
      lessonsDone?: number[]
      pathDone?: Record<string, string[]>
      log?: Record<string, { lessons: number; cards: number }>
      xp?: number
      starred?: string[]
      learnerGraph?: unknown
    }
    const hsk1: Hsk1ProgressState = normalizeHsk1Progress(tryJson(entries['yulu.hsk1.v1']))
    const historyRaw = tryJson(entries['yulu.history.v1'])
    const history: HistoryEvent[] = Array.isArray(historyRaw) ? (historyRaw as HistoryEvent[]) : []
    const beastRaw = tryJson(entries['yulu.beast.v1']) as { stageId?: string } | null
    const graphRaw = tryJson(entries['yulu.learner-graph.v1']) ?? main.learnerGraph

    const nowMs = Date.now()
    const todayKey = localDayKey(nowMs)
    const yestKey = localDayKey(nowMs - 86_400_000)
    const cards = main.cards && typeof main.cards === 'object' ? main.cards : {}
    const mastery = normalizeMastery(main.mastery, cards, main.starred ?? [], nowMs)
    const log = main.log && typeof main.log === 'object' ? main.log : {}
    const streak = streakFromLog(log)

    const evalRes = evaluateBeastProgress({
      track: meta.track,
      mastery,
      cards,
      lessonsDone: Array.isArray(main.lessonsDone) ? main.lessonsDone : [],
      pathDone: main.pathDone && typeof main.pathDone === 'object' ? main.pathDone : {},
      streak,
      xp: typeof main.xp === 'number' ? main.xp : 0,
      log,
      history,
      learnerGraph: graphRaw ? normalizeLearnerGraph(graphRaw) : createEmptyGraph(0),
      hsk1Progress: hsk1,
      todayKey,
      nowMs,
    })

    return {
      id: partnerId,
      name: names[partnerId],
      badge: meta.badge,
      accent: meta.accent,
      beast: evalRes.beast,
      stage: getBeastStage(beastRaw?.stageId ?? defaultBeastStageForMember(partnerId)),
      level: evalRes.level,
      spiritPower: evalRes.spiritPower,
      streak,
      flame: resolveFlameMeta(streak),
      masteredWords: evalRes.metrics.unaidedTotalWords,
      hsk1UnitsDone: evalRes.metrics.hsk1UnitsDoneCount,
      todayCards: log[todayKey]?.cards ?? 0,
      yesterdayCards: log[yestKey]?.cards ?? 0,
      retentionPct: evalRes.retentionPct,
      updatedAt: Number(data.updatedAt ?? 0),
    }
  } catch {
    return null
  }
}

export async function fetchCoupleFeed(
  fetchImpl: typeof fetch = fetch,
): Promise<{ events: CoupleEvent[]; names: Partial<Record<CoupleMemberId, string>> }> {
  if (shouldBlockProdCloudSync('couple')) return { events: [], names: {} }
  try {
    const res = await fetchImpl('/api/cloud-sync?profile=couple')
    if (!res.ok) return { events: [], names: {} }
    const data = (await res.json()) as {
      ok?: boolean
      backup?: { entries?: Record<string, unknown> } | null
    }
    if (!data?.ok) return { events: [], names: {} }
    const rawFeed = tryJson(data.backup?.entries?.['yulu.couple-feed.v1']) as {
      events?: unknown
      names?: Partial<Record<CoupleMemberId, string>>
    } | null
    const events = Array.isArray(rawFeed?.events)
      ? mergeCoupleEvents([], rawFeed.events as CoupleEvent[])
      : []
    const names = rawFeed?.names ?? {}
    if (names.richie || names.renita) mergeRemoteCoupleNames(names)
    return { events, names }
  } catch {
    return { events: [], names: {} }
  }
}

export async function postCoupleEvent(
  input: Omit<CoupleEvent, 'id' | 'at'> & { names?: Partial<Record<CoupleMemberId, string>> },
  fetchImpl: typeof fetch = fetch,
): Promise<CoupleEvent[]> {
  const newEv: CoupleEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from: input.from,
    kind: input.kind,
    text: input.text,
    beastLevel: input.beastLevel,
    at: Date.now(),
  }
  if (shouldBlockProdCloudSync('couple')) {
    return [newEv]
  }
  try {
    const current = await fetchCoupleFeed(fetchImpl)
    const mergedEvents = mergeCoupleEvents([newEv], current.events)
    const mergedNames = {
      ...getCoupleNames(),
      ...current.names,
      ...input.names,
    }
    const backup = {
      format: 'yulu-progress-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: {
        'yulu.couple-feed.v1': JSON.stringify({
          events: mergedEvents,
          names: mergedNames,
        }),
      },
    }
    await fetchImpl('/api/cloud-sync?profile=couple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup, expectedUpdatedAt: 0, force: true }),
    })
    return mergedEvents
  } catch {
    return [newEv]
  }
}

export function markCoupleFeedSeen(latestAt: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(FEED_SEEN_KEY, String(latestAt))
  } catch {
    /* ignore */
  }
}

export function countUnreadPartnerEvents(events: CoupleEvent[], myId: CoupleMemberId): number {
  if (typeof localStorage === 'undefined') return 0
  let seenAt = 0
  try {
    seenAt = Number(localStorage.getItem(FEED_SEEN_KEY) ?? 0) || 0
  } catch {
    seenAt = 0
  }
  return events.filter((ev) => ev.from !== myId && ev.at > seenAt).length
}
