import type { Hit, RuleDefinition, Severity, Unit } from './types.ts'

export const re = (source: string) => new RegExp(source, 'gu')

/** A rule's way of reporting: offsets are relative to the unit here and absolute in the Hit. */
export function hit(unit: Unit, index: number, length: number, replacement: string | null, pattern: string, why: string, severity?: Severity): Hit {
  return { start: unit.start + index, end: unit.start + index + length, replacement, pattern, why, ...(severity ? { severity } : {}) }
}

export function each(unit: Unit, pattern: RegExp, visit: (match: RegExpMatchArray, index: number) => Hit | null): Hit[] {
  const hits: Hit[] = []
  for (const match of unit.text.matchAll(pattern)) {
    const found = visit(match, match.index ?? 0)
    if (found) hits.push(found)
  }
  return hits
}

export const clause = (severity: Severity, find: (unit: Unit) => Hit[]): RuleDefinition => ({ scope: 'clause', severity, find })
export const sentence = (severity: Severity, find: (unit: Unit) => Hit[]): RuleDefinition => ({ scope: 'sentence', severity, find })
