import { encounter, recordRetrieval, type MasteryRecord, type RecallInput } from './mastery.ts'
import { newCard, schedule, type Card, type Rating, type Skill, SCHEDULER } from './srs.ts'
import { priorityScore, type LearnerGraphState } from './learnerGraph.ts'
export interface ReviewEvent {
  id: string
  day?: string
  zh: string
  lesson: number
  skill: Skill
  at: number
  rating: Rating
  evidence: 'self-report' | 'checked' | 'placement' | 'unverified'
  assisted: boolean
  source: string
  scheduler: string
  xp: number
  /** A return date the learner chose, in days; replaces the model's interval. */
  delayDays?: number
}
export interface CreditEvent {
  id: string
  at: number
  day: string
  xp: number
  cards: number
  lessons: number
  source: string
}
export interface LearningState {
  credits?: Record<string, CreditEvent>
  version: 2
  origins: Record<string, { card?: Card; mastery?: MasteryRecord }>
  events: Record<string, ReviewEvent>
  undone: Record<string, number>
}
export interface LearningData {
  cards: Record<string, Card>
  mastery: Record<string, MasteryRecord>
  learning?: LearningState
}
export type SkillDeck = Partial<Record<Skill, Card>>
export function initLearning(data: LearningData): LearningState {
  if (data.learning?.version === 2) {
    const origins = { ...data.learning.origins }
    let added = false
    for (const zh of new Set([...Object.keys(data.cards), ...Object.keys(data.mastery)])) {
      if (!(zh in origins)) {
        origins[zh] = { card: data.cards[zh], mastery: data.mastery[zh] }
        added = true
      }
    }
    return added ? { ...data.learning, origins } : data.learning
  }
  const origins: LearningState['origins'] = {}
  for (const zh of new Set([...Object.keys(data.cards), ...Object.keys(data.mastery)]))
    origins[zh] = { card: data.cards[zh], mastery: data.mastery[zh] }
  return { version: 2, origins, events: {}, undone: {} }
}
export function skillFor(mode: RecallInput['mode']): Skill {
  return mode === 'recognition' ? 'reading' : mode
}
export function eventFor(zh: string, lesson: number, input: RecallInput, at = Date.now()): ReviewEvent {
  return {
    id: crypto.randomUUID(),
    zh,
    lesson,
    at,
    skill: input.skill ?? skillFor(input.mode),
    rating: !input.correct ? 'again' : input.assisted ? 'hard' : (input.rating ?? 'good'),
    assisted: !!input.assisted,
    evidence: input.unverified ? 'unverified' : input.placement ? 'placement' : 'checked',
    source: input.source ?? 'lesson',
    scheduler: SCHEDULER,
    xp: 0,
  }
}
export function wordState(data: LearningData, zh: string) {
  const learning = initLearning(data),
    origin = learning.origins[zh]
  const skills: SkillDeck = origin?.card ? { [origin.card.skill ?? 'recall']: origin.card } : {}
  let mastery = origin?.mastery
  const events = Object.values(learning.events)
    .filter((e) => e.zh === zh && !learning.undone[e.id])
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  for (const e of events) {
    if (e.evidence === 'unverified') continue
    const before = skills[e.skill] ?? newCard(zh, e.lesson, e.at)
    const rating = e.assisted && e.rating !== 'again' ? 'hard' : e.rating
    skills[e.skill] = {
      ...schedule(before, rating, e.at, e.evidence === 'placement' && !e.assisted, e.delayDays),
      skill: e.skill,
    }
    if (e.evidence !== 'self-report')
      mastery = recordRetrieval(
        mastery ?? encounter(undefined, zh, e.lesson, e.at),
        {
          mode: e.skill === 'reading' ? 'recognition' : e.skill,
          correct: e.rating !== 'again',
          assisted: e.assisted,
        },
        e.at,
      )
  }
  const exposure = data.mastery[zh]
  if (mastery && exposure)
    mastery = {
      ...mastery,
      lastSeen: Math.max(mastery.lastSeen, exposure.lastSeen),
      encounters: Math.max(mastery.encounters, exposure.encounters),
    }
  return { card: Object.values(skills).sort((a, b) => a.due - b.due)[0], skills, mastery }
}
export function applyEvent<T extends LearningData>(data: T, event: ReviewEvent): T {
  const initial = initLearning(data)
  if (initial.events[event.id]) return data
  const origin = initial.origins[event.zh] ?? { card: data.cards[event.zh], mastery: data.mastery[event.zh] }
  const learning = {
    ...initial,
    origins: { ...initial.origins, [event.zh]: origin },
    events: { ...initial.events, [event.id]: event },
  }
  const next = { ...data, learning },
    word = wordState(next, event.zh)
  return {
    ...next,
    cards: word.card ? { ...data.cards, [event.zh]: word.card } : data.cards,
    mastery: word.mastery ? { ...data.mastery, [event.zh]: word.mastery } : data.mastery,
  }
}
export function undoEvent<T extends LearningData>(data: T, id: string, now = Date.now()): T {
  const current = initLearning(data),
    event = current.events[id]
  if (!event || current.undone[id]) return data
  const learning = { ...current, undone: { ...current.undone, [id]: now } },
    next = { ...data, learning }
  const word = wordState(next, event.zh),
    cards = { ...data.cards },
    mastery = { ...data.mastery }
  if (word.card) cards[event.zh] = word.card
  else delete cards[event.zh]
  if (word.mastery) mastery[event.zh] = word.mastery
  else delete mastery[event.zh]
  return { ...next, cards, mastery }
}
export function isComfortable(
  data: LearningData,
  zh: string,
  now = Date.now(),
  skill: Skill = 'recall',
): boolean {
  const card = wordState(data, zh).skills[skill]
  return !!card && card.interval >= 14 && card.due > now
}
export function recommendedWords(
  data: LearningData,
  words: string[],
  now = Date.now(),
  graph?: LearnerGraphState,
): string[] {
  return [...new Set(words)]
    .filter((zh) => !isComfortable(data, zh, now))
    .sort((a, b) => {
      const scoreB = (data.mastery[b]?.state === 'hard' ? 10 : 0) + (graph ? priorityScore(graph, b) : 0)
      const scoreA = (data.mastery[a]?.state === 'hard' ? 10 : 0) + (graph ? priorityScore(graph, a) : 0)
      return scoreB - scoreA
    })
}
export function activeEvents(data: LearningData): ReviewEvent[] {
  const s = initLearning(data)
  return Object.values(s.events).filter((e) => !s.undone[e.id])
}

/** Explicit enqueue captures a legacy origin without turning exposure into recall. */
export function enqueueWords<T extends LearningData>(
  data: T,
  lesson: number,
  words: { zh: string }[],
  now = Date.now(),
): T {
  const cards = { ...data.cards },
    mastery = { ...data.mastery },
    learning = initLearning(data),
    origins = { ...learning.origins }
  for (const { zh } of words) {
    if (!zh.trim()) continue
    mastery[zh] = encounter(mastery[zh], zh, lesson, now)
    if (!cards[zh]) {
      cards[zh] = newCard(zh, lesson, now)
      origins[zh] = { ...origins[zh], card: cards[zh], mastery: origins[zh]?.mastery ?? mastery[zh] }
    }
  }
  return { ...data, cards, mastery, learning: { ...learning, origins } }
}

export function creditProgress<
  T extends LearningData & { xp: number; log: Record<string, { cards: number; lessons: number }> },
>(data: T, credit: CreditEvent): T {
  const learning = initLearning(data)
  if (learning.credits?.[credit.id]) return data
  const day = data.log[credit.day] ?? { cards: 0, lessons: 0 }
  return {
    ...data,
    learning: { ...learning, credits: { ...learning.credits, [credit.id]: credit } },
    xp: data.xp + credit.xp,
    log: {
      ...data.log,
      [credit.day]: { cards: day.cards + credit.cards, lessons: day.lessons + credit.lessons },
    },
  }
}
