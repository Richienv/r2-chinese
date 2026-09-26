import { lookup, vocabIndex } from './content'
import type { Vocab } from './types'

/**
 * Rapid-drill queue: cycle each word `reps` times (5–10) for fast re-learning.
 * Unlike SRS this does not touch a card's schedule — it is deliberate massed
 * practice, so the only rule is "don't show the same word twice in a row".
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

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100_000) / 100_000
  }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const glossable = (v: { en: string }) => v.en.length > 0 && v.en.length < 40

/** Three wrong answers, preferring the same part of speech (quiz.ts style). */
function distractors(answer: Vocab, rand: () => number): Vocab[] {
  const pool = vocabIndex
    .filter((v) => v.zh !== answer.zh && v.tag !== 'proper' && glossable(v))
    .map((v) => ({ zh: v.zh, pinyin: v.pinyin, pos: v.pos, en: v.en, note: '' }))
  const samePos = shuffle(
    pool.filter((v) => answer.pos && v.pos === answer.pos),
    rand,
  )
  const rest = shuffle(pool, rand)
  const picked: Vocab[] = []
  for (const v of [...samePos, ...rest]) {
    if (picked.length === 3) break
    if (picked.some((p) => p.zh === v.zh || p.en === v.en)) continue
    picked.push(v)
  }
  return picked
}

export type DrillMode = 'zh-to-en' | 'en-to-zh' | 'no-gloss'

export interface DrillQuestion {
  mode: DrillMode
  /** Shown above the choices — never the answer side. */
  prompt: string
  promptLang: 'zh' | 'en'
  options: { id: string; label: string }[]
  answerId: string
}

/**
 * Build a phone-friendly multiple-choice recall item. Alternates zh→en / en→zh
 * by rep index. If the book has no meaning, returns `no-gloss` so the UI can
 * stay honest instead of inventing English.
 */
export function buildDrillQuestion(zh: string, round: number): DrillQuestion {
  const word = lookup(zh)
  const en = word?.en?.trim() ?? ''
  if (!en) {
    return {
      mode: 'no-gloss',
      prompt: zh,
      promptLang: 'zh',
      options: [],
      answerId: '',
    }
  }

  const answer: Vocab = word ?? { zh, pinyin: '', pos: '', en, note: '' }
  const rand = rng(seedOf(`${zh}:${round}`))
  const wantEn = round % 2 === 0

  if (wantEn) {
    const wrong = distractors(answer, rand)
    const options = shuffle(
      [{ id: answer.zh, label: answer.en }, ...wrong.map((v) => ({ id: v.zh, label: v.en }))],
      rand,
    )
    return {
      mode: 'zh-to-en',
      prompt: zh,
      promptLang: 'zh',
      options,
      answerId: answer.zh,
    }
  }

  const wrong = distractors(answer, rand)
  const options = shuffle(
    [{ id: answer.zh, label: answer.zh }, ...wrong.map((v) => ({ id: v.zh, label: v.zh }))],
    rand,
  )
  return {
    mode: 'en-to-zh',
    prompt: en,
    promptLang: 'en',
    options,
    answerId: answer.zh,
  }
}
