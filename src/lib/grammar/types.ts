/**
 * A free, offline grammar classifier for learner Mandarin. No model, no network, no key.
 *
 * It does not understand sentences. It recognises a fixed set of mistakes that learners
 * make over and over, each as a typed rule, and stays silent about everything else.
 * "No known mistakes" is therefore not "correct": the report says so, and callers must
 * not treat it as verified grammar.
 */

/** Mistakes learners make whatever their first language: wrong order, wrong particle, wrong pair. */
export const CORE_RULE_IDS = [
  'place-after-verb',
  'time-after-verb',
  'hen-after-adj',
  'degree-after-verb',
  'bi-hen',
  'bi-bu',
  'shi-adj',
  'shi-age',
  'meiyou-le',
  'negation-choice',
  'you-guo',
  'ma-question-double',
  'question-or',
  'er-liang',
  'men-plural',
  'measure-word',
  'de-for-de',
  'verb-object-de',
  'repeated-word',
  'zai-zai',
  'degree-stack',
  'ba-bare-verb',
  'conjunction-pair',
] as const

/**
 * Mistakes that come from translating word for word out of Indonesian or English: the date written
 * day-month-year, "together" left at the end, "I interested in" with no 对. Same engine, own file.
 */
export const TRANSFER_RULE_IDS = [
  'date-order',
  'together-after-verb',
  'de-missing',
  'ganxingqu-order',
  'double-degree',
  'place-li',
  'adverb-after-verb',
  'bu-shi-missing',
  'bi-order',
  'measure-missing',
] as const

/** Every rule the classifier has. createRules (rules.ts) must define exactly these, which the compiler enforces. */
export const RULE_IDS = [...CORE_RULE_IDS, ...TRANSFER_RULE_IDS] as const

export type RuleId = (typeof RULE_IDS)[number]
export type TransferRuleId = (typeof TRANSFER_RULE_IDS)[number]

/**
 * - error: wrong in standard Mandarin (and on the HSK). Counts against the sentence.
 * - check: usually wrong, but it depends on what was meant or on the register. Shown, never failed on.
 */
export type Severity = 'error' | 'check'

/** A stretch of the learner's text: one sentence or one comma-separated clause, with where it starts. */
export interface Unit {
  text: string
  /** Offset of `text` inside the full input. */
  start: number
  /** The punctuation that ended it, '' when the text just stops. */
  terminator: string
}

/** What a rule reports. Offsets are into the full input, not the unit. */
export interface Hit {
  start: number
  end: number
  /** Text for [start, end) that fixes it. null when the fix needs the learner to reword. */
  replacement: string | null
  /** Overrides the rule's default severity for this one hit. */
  severity?: Severity
  /** The short pattern to remember, already localised. */
  pattern: string
  /** Why this is wrong, specific to this sentence, already localised. */
  why: string
}

export interface Lexicon {
  /** Adjectives from the course vocabulary (single part of speech only, so a noun is never taken for one). */
  readonly adjectives: ReadonlySet<string>
}

export interface RuleDefinition {
  readonly scope: 'clause' | 'sentence'
  readonly severity: Severity
  find(unit: Unit): Hit[]
}

/** Every rule id mapped to its definition. A missing or extra id is a compile error. */
export type RuleSet = { readonly [K in RuleId]: RuleDefinition }

/** One mistake found, ready to show. */
export interface Finding {
  rule: RuleId
  severity: Severity
  start: number
  end: number
  /** Exactly what the learner wrote there. */
  original: string
  /** What to write instead, or null when the fix needs rewording. */
  suggestion: string | null
  pattern: string
  why: string
}

/**
 * - errors: at least one error-severity finding.
 * - worth-a-look: only check-severity findings.
 * - no-known-errors: nothing matched. This is not a pass for correctness; see the file comment.
 * - not-chinese: no Hanzi to look at.
 */
export type GrammarVerdict = 'errors' | 'worth-a-look' | 'no-known-errors' | 'not-chinese'

export interface GrammarReport {
  verdict: GrammarVerdict
  findings: Finding[]
  /** The learner's text with every available suggestion applied. Equal to the input when nothing applies. */
  correctedZh: string
  /** Whether correctedZh fixes every error-severity finding. False when some need rewording. */
  fullyCorrected: boolean
  /** How many mistake patterns were looked for, so the report can say how narrow the check is. */
  rulesChecked: number
}
