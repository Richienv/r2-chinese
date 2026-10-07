/**
 * What a drill round asks, and how a session remembers how it went.
 * Pure on purpose: the screen only renders these decisions.
 */

/** What the learner is given. The answer is always the Hanzi. */
export type DrillCue = 'meaning' | 'sound' | 'pinyin'

export interface DrillRound {
  zh: string
  cue: DrillCue
  /** A missed word coming back for another try. */
  repair: boolean
}

const CYCLE: readonly DrillCue[] = ['meaning', 'sound', 'pinyin']

/**
 * Each pass over a word changes how it is asked: see the meaning first, then hear
 * it, then read its pinyin. Without sound the listening pass falls back to the meaning.
 */
export function cueForPass(pass: number, canHear: boolean): DrillCue {
  const cue = CYCLE[((pass % CYCLE.length) + CYCLE.length) % CYCLE.length]
  return cue === 'sound' && !canHear ? 'meaning' : cue
}

/** Turn a plain word queue into rounds, varying the cue each time a word returns. */
export function planRounds(queue: string[], canHear: boolean): DrillRound[] {
  const passes = new Map<string, number>()
  return queue.map((zh) => {
    const pass = passes.get(zh) ?? 0
    passes.set(zh, pass + 1)
    return { zh, cue: cueForPass(pass, canHear), repair: false }
  })
}

/**
 * A missed word returns a couple of rounds later, asked by its meaning (the easiest
 * cue), and never lands next to itself.
 */
export function requeueRound(rounds: DrillRound[], from: number, zh: string): DrillRound[] {
  const rest = rounds.slice(from + 1)
  const target = Math.min(rest.length, rest[0]?.zh === zh ? 2 : 1)
  rest.splice(target, 0, { zh, cue: 'meaning', repair: true })
  return [...rounds.slice(0, from + 1), ...rest]
}

export type HintStep = 'meaning' | 'first' | 'pinyin' | 'word'

/**
 * Hints reveal only what the cue has not already shown, easiest-to-withhold last.
 * Every hint counts as help; none of them is ever the whole answer before the last.
 */
export function hintLadder(cue: DrillCue): HintStep[] {
  return cue === 'meaning' ? ['first', 'pinyin', 'word'] : ['meaning', 'first', 'word']
}

export type RoundResult = 'unaided' | 'assisted' | 'missed'

/** A round that had any wrong check is a miss, even if the learner then got it with help. */
export function classifyRound(round: { missed: boolean; assisted: boolean }): RoundResult {
  return round.missed ? 'missed' : round.assisted ? 'assisted' : 'unaided'
}

/** The run of unaided successes. Any help or miss ends it. */
export function nextStreak(streak: number, result: RoundResult): number {
  return result === 'unaided' ? streak + 1 : 0
}

/** How strongly the flow indicator glows. */
export function streakTier(streak: number): 0 | 1 | 2 | 3 {
  return streak >= 8 ? 3 : streak >= 5 ? 2 : streak >= 3 ? 1 : 0
}

export interface WordOutcome {
  unaided: number
  assisted: number
  missed: number
  last: RoundResult | null
}

export type Outcomes = Record<string, WordOutcome>

export function addOutcome(outcomes: Outcomes, zh: string, result: RoundResult): Outcomes {
  const before = outcomes[zh] ?? { unaided: 0, assisted: 0, missed: 0, last: null }
  return { ...outcomes, [zh]: { ...before, [result]: before[result] + 1, last: result } }
}

export type PipState = 'waiting' | 'current' | 'unaided' | 'assisted' | 'missed'

/** One dot per word. It shows how the latest round on that word went, never the word itself. */
export function pipState(outcome: WordOutcome | undefined, isCurrent: boolean): PipState {
  if (isCurrent) return 'current'
  return outcome?.last ?? 'waiting'
}

/** Words whose most recent round was not an unaided success, in the order given. */
export function wordsToRevisit(outcomes: Outcomes, words: string[]): string[] {
  return words.filter((zh) => {
    const last = outcomes[zh]?.last
    return last !== undefined && last !== null && last !== 'unaided'
  })
}
