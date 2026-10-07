import { createRules } from './rules.ts'
import { RULE_IDS, type Finding, type GrammarReport, type Hit, type Lexicon, type RuleId, type RuleSet, type Unit } from './types.ts'

export const MAX_LENGTH = 2000

export const EMPTY_LEXICON: Lexicon = { adjectives: new Set() }

/** Adjectives from vocabulary rows `{ zh, pos }`. Only words that are an adjective and nothing else, so a noun is never taken for one. */
export function lexiconFrom(entries: ReadonlyArray<{ zh: string; pos: string }>): Lexicon {
  const adjectives = new Set<string>()
  for (const { zh, pos } of entries) {
    if (!/^[㐀-鿿]{1,4}$/u.test(zh)) continue
    const kinds = pos.toLowerCase().split(/[./\s-]+/).filter(Boolean)
    if (kinds.length === 1 && kinds[0] === 'adj') adjectives.add(zh)
  }
  return { adjectives }
}

const SENTENCE_END = /[。！？!?；;\n]+[”’」』"')）]*|(?<!\d)\.(?!\d)/gu
const CLAUSE_END = /[。！？!?；;\n，,、：:]+[”’」』"')）]*|(?<!\d)\.(?!\d)/gu

/** Split into sentences or clauses, with where each starts, trimmed of surrounding spaces. */
export function splitUnits(text: string, separator: RegExp): Unit[] {
  const units: Unit[] = []
  const push = (from: number, to: number, terminator: string) => {
    const raw = text.slice(from, to)
    const trimmed = raw.trim()
    if (!trimmed) return
    units.push({ text: trimmed, start: from + raw.indexOf(trimmed), terminator })
  }
  let from = 0
  for (const match of text.matchAll(separator)) {
    push(from, match.index ?? 0, match[0])
    from = (match.index ?? 0) + match[0].length
  }
  push(from, text.length, '')
  return units
}

const rulesFor = new WeakMap<Lexicon, RuleSet>()
function rulesOf(lexicon: Lexicon): RuleSet {
  let rules = rulesFor.get(lexicon)
  if (!rules) { rules = createRules(lexicon); rulesFor.set(lexicon, rules) }
  return rules
}

interface Raw { rule: RuleId; order: number; hit: Hit; severity: Finding['severity'] }

/** Errors win an overlap over checks; otherwise the earlier rule in RULE_IDS does. */
function withoutOverlaps(all: Raw[]): Raw[] {
  const ranked = [...all].sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error') || a.order - b.order || a.hit.start - b.hit.start)
  const kept: Raw[] = []
  for (const candidate of ranked) {
    if (!kept.some((other) => candidate.hit.start < other.hit.end && other.hit.start < candidate.hit.end)) kept.push(candidate)
  }
  return kept.sort((a, b) => a.hit.start - b.hit.start || a.hit.end - b.hit.end)
}

export function applyReplacements(text: string, findings: ReadonlyArray<Pick<Finding, 'start' | 'end' | 'suggestion'>>): string {
  let result = ''
  let at = 0
  for (const finding of [...findings].sort((a, b) => a.start - b.start)) {
    if (finding.suggestion === null || finding.start < at) continue
    result += text.slice(at, finding.start) + finding.suggestion
    at = finding.end
  }
  return result + text.slice(at)
}

/**
 * Look for known mistakes in learner Mandarin. Pure and synchronous: no network, no model.
 * An empty result means "none of the patterns matched", which is never proof the sentence is right.
 */
export function checkGrammar(input: string, options: { lexicon?: Lexicon } = {}): GrammarReport {
  const text = input.slice(0, MAX_LENGTH)
  const base = { rulesChecked: RULE_IDS.length }
  if (!/\p{Script=Han}/u.test(text)) return { verdict: 'not-chinese', findings: [], correctedZh: text, fullyCorrected: true, ...base }

  const rules = rulesOf(options.lexicon ?? EMPTY_LEXICON)
  const sentences = splitUnits(text, SENTENCE_END)
  const clauses = splitUnits(text, CLAUSE_END)
  const raw: Raw[] = []
  RULE_IDS.forEach((rule, order) => {
    const definition = rules[rule]
    for (const unit of definition.scope === 'sentence' ? sentences : clauses) {
      for (const hit of definition.find(unit)) raw.push({ rule, order, hit, severity: hit.severity ?? definition.severity })
    }
  })

  const findings: Finding[] = withoutOverlaps(raw).map(({ rule, hit, severity }) => ({
    rule, severity, start: hit.start, end: hit.end, original: text.slice(hit.start, hit.end), suggestion: hit.replacement, pattern: hit.pattern, why: hit.why,
  }))
  const errors = findings.filter((finding) => finding.severity === 'error')
  return {
    verdict: errors.length ? 'errors' : findings.length ? 'worth-a-look' : 'no-known-errors',
    findings,
    // Only what is wrong in standard Mandarin is rewritten. A "worth a look" note keeps the learner's wording.
    correctedZh: applyReplacements(text, errors),
    fullyCorrected: errors.every((finding) => finding.suggestion !== null),
    ...base,
  }
}
