/**
 * Rapid-drill queue: cycle each word `reps` times for fast re-learning.
 * Unlike SRS this does not touch a card's schedule — it is deliberate massed
 * practice, so the only rule is "don't show the same word twice in a row".
 * `drillRounds.ts` decides how each of these prompts is asked.
 */
/** The tapped word first, then every other saved card, so the session alternates. */
export function mixWithSaved(zh: string, starred: string[]): string[] {
  const rest = starred.filter((w) => w && w !== zh)
  return [zh, ...rest]
}

export function buildDrillQueue(words: string[], reps: number): string[] {
  const unique = [...new Set(words)].filter(Boolean)
  if (unique.length === 0) return []
  if (unique.length === 1) return Array(reps).fill(unique[0])

  // Round-robin: one pass per rep, so consecutive items are always different.
  const queue: string[] = []
  for (let r = 0; r < reps; r++) {
    const pass = rotate(unique, r)
    for (const w of pass) queue.push(w)
  }
  return queue
}

function rotate<T>(items: T[], by: number): T[] {
  const n = items.length
  const k = ((by % n) + n) % n
  return [...items.slice(k), ...items.slice(0, k)]
}
