/**
 * Rapid-drill queue: cycle each word `reps` times (5–10) for fast re-learning.
 * Unlike SRS this does not touch a card's schedule — it is deliberate massed
 * practice, so the only rule is "don't show the same word twice in a row".
 */
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

/**
 * Re-insert a missed word a few positions ahead so it comes back inside the
 * session without immediately repeating. Never lands adjacent to itself.
 */
export function requeue(queue: string[], from: number, zh: string): string[] {
  const rest = queue.slice(from + 1)
  const target = Math.min(rest.length, rest[0] === zh ? 2 : 1)
  rest.splice(target, 0, zh)
  return [...queue.slice(0, from + 1), ...rest]
}
