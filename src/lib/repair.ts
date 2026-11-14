import { alignChinese, normalizeChinese } from './production.ts'
export type RepairPart = { kind: 'keep'; text: string } | { kind: 'edit'; original: string; target: string }
/** Alignment keeps matching runs, grouping only adjacent changes into editable slots. */
export function repairParts(response: string, reference: string): RepairPart[] {
  if (normalizeChinese(response).length > 600 || normalizeChinese(reference).length > 600)
    return [{ kind: 'edit', original: normalizeChinese(response), target: normalizeChinese(reference) }]
  const parts: RepairPart[] = []
  for (const part of alignChinese(response, reference)) {
    if (part.kind === 'same') {
      parts.push({ kind: 'keep', text: part.text })
      continue
    }
    let last = parts[parts.length - 1]
    if (!last || last.kind !== 'edit') {
      last = { kind: 'edit', original: '', target: '' }
      parts.push(last)
    }
    if (part.kind === 'added') last.original += part.text
    else last.target += part.text
  }
  return parts
}
export function repairAnswer(parts: RepairPart[], edits: Record<number, string>): string {
  return parts.map((p, i) => (p.kind === 'keep' ? p.text : (edits[i] ?? p.original))).join('')
}
export function guidedPrompt(sentence: string, words: string[]) {
  const target = words.find((w) => normalizeChinese(w).length >= 1 && sentence.includes(w))
  if (!target) return null
  const start = sentence.indexOf(target)
  return { prefix: sentence.slice(0, start), target, suffix: sentence.slice(start + target.length) }
}
