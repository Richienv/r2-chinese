import type { BooksSessionStep } from '../lib/books'

/** Reflow preserves every source word; only whitespace and paragraph breaks change. */
export function bookSourcePassages(body: string, paragraphsPerPassage = 2): string[][] {
  const paragraphs: string[] = []
  for (const original of body.trim().split(/\n\s*\n/).filter(Boolean)) {
    const sentences: string[] = []
    let start = 0
    const boundaries = /[.!?]+["'”’)\]]*\s+/g
    for (const boundary of original.matchAll(boundaries)) {
      const end = boundary.index! + boundary[0].trimEnd().length
      const before = original.slice(start, end)
      if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)\.$/i.test(before) || /\b(?:e\.g|i\.e)\.$/i.test(before)) continue
      sentences.push(before.trim())
      start = boundary.index! + boundary[0].length
    }
    if (original.slice(start).trim()) sentences.push(original.slice(start).trim())
    let current = ''
    let count = 0
    for (const sentence of sentences) {
      // A long source sentence also gets a readable break, without losing text.
      const pieces = sentence.length > 260 ? sentence.match(/.{1,220}(?:\s+|$)|\S+/g)?.map((part) => part.trim()).filter(Boolean) ?? [sentence] : [sentence]
      for (const piece of pieces) {
        if (current && (current.length + piece.length > 260 || count >= 2)) { paragraphs.push(current); current = ''; count = 0 }
        current = current ? `${current} ${piece}` : piece
        count++
      }
    }
    if (current) paragraphs.push(current)
  }
  const size = Number.isInteger(paragraphsPerPassage) && paragraphsPerPassage > 0 ? paragraphsPerPassage : 2
  return Array.from({ length: Math.ceil(paragraphs.length / size) }, (_, index) => paragraphs.slice(index * size, (index + 1) * size))
}

export type BooksWorkshopKind = 'explain' | 'scenario' | 'mindset' | 'journal'
export type BooksReaderStep = BooksSessionStep | { kind: BooksWorkshopKind; id: string }

/** Append teaching before the old completion index, never between source sittings. */
export function booksWorkshopSteps(source: BooksSessionStep[]): BooksReaderStep[] {
  if (!source.length) return []
  const reading = source.filter((step) => step.kind !== 'complete')
  if (!reading.length) return []
  return [...reading, ...(['explain', 'scenario', 'mindset', 'journal'] as const).map((kind) => ({ kind, id: `workshop:${kind}` })), { kind: 'complete' }]
}

/** An old completion index now opens the workshop; no save can auto-complete. */
export function booksResumeIndex(saved: number, steps: BooksReaderStep[]): number {
  if (!Number.isFinite(saved) || saved < 0 || !steps.length) return 0
  const value = Math.floor(saved)
  if (value < steps.length - 1) return value
  return Math.max(0, steps.findIndex((step) => step.kind === 'explain'))
}
