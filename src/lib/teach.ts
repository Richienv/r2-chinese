import type { Example } from './content'
import { overlayWord } from './overlays'
import type { Vocab } from './types'

export type TeachPhase = 'meet' | 'hook' | 'example' | 'seal'

export type WordHook = {
  when: string
  usage: string
}

export const TEACH_KICKER: Record<TeachPhase, string> = {
  meet: 'See it',
  hook: 'Remember it',
  example: 'Hear it',
  seal: 'Lock it',
}

export const TEACH_TITLE: Record<TeachPhase, string> = {
  meet: 'This is the word',
  hook: 'How to remember it',
  example: 'Is this the example?',
  seal: 'Hanzi, then pinyin',
}

function firstSense(en: string): string {
  const bit = en.split(/[;,/]/)[0]?.trim() ?? en
  return bit.replace(/^to\s+/i, '').toLowerCase() || en.toLowerCase()
}

function posKey(pos: string): 'n' | 'v' | 'adj' | 'adv' | 'conj' | 'name' | 'num' | 'other' {
  const p = pos.toLowerCase()
  if (p.includes('pr.n') || p.includes('prop')) return 'name'
  if (p.includes('num') || p.includes('m.') || p.includes('measure')) return 'num'
  if (p.includes('conj')) return 'conj'
  if (p.includes('adj')) return 'adj'
  if (p.includes('adv')) return 'adv'
  if (p.includes('v')) return 'v'
  if (p.includes('n')) return 'n'
  return 'other'
}

function defaultHook(word: Vocab): WordHook {
  const sense = firstSense(word.en)
  const kind = posKey(word.pos)
  const note = word.note.trim()

  const when =
    kind === 'v'
      ? `Remember ${word.zh} like the word you’ll use when you want to ${sense}.`
      : kind === 'adj'
        ? `Remember ${word.zh} like the word you’ll use when something is ${sense}.`
        : kind === 'adv'
          ? `Remember ${word.zh} like the word you’ll use when you mean “${sense}”.`
          : kind === 'conj'
            ? `Remember ${word.zh} like the glue you’ll use when you need “${sense}” between two ideas.`
            : kind === 'name'
              ? `Remember ${word.zh} as the name ${word.en}. Say it when that person or place comes up.`
              : kind === 'num'
                ? `Remember ${word.zh} like the word you’ll use when you mean ${sense} — usually people, not objects.`
                : `Remember ${word.zh} like the word you’ll use when you need to talk about ${sense}.`

  const usage =
    note ||
    (kind === 'v'
      ? `Most Chinese speakers use it as the everyday verb for this. Say it when the action is happening.`
      : kind === 'adj'
        ? `Most Chinese speakers use it to describe a person or thing that is ${sense}.`
        : kind === 'adv'
          ? `Most Chinese speakers drop it in to shade a sentence — “${sense}”, not a new noun.`
          : kind === 'conj'
            ? `Most Chinese speakers use it to join clauses. It’s grammar you hear, not a thing you can point at.`
            : kind === 'name'
              ? `Treat it as a proper name. Don’t translate it — just recognise it.`
              : kind === 'num'
                ? `Most Chinese speakers use it to count people or name that amount — ${sense} — not as a thing you can point at.`
                : `Most Chinese speakers use it as the everyday noun for ${sense} — the thing itself, not a side detail.`)

  return { when, usage }
}

/** Coach lines: overlay when/usage when the lesson file has them. */
export function wordHook(word: Vocab, example: Example | null, lesson?: number): WordHook {
  void example
  const fallback = defaultHook(word)
  const overlay = overlayWord(word.zh, lesson)
  return {
    when: overlay?.when?.trim() || fallback.when,
    usage: overlay?.usage?.trim() || fallback.usage,
  }
}

export function splitHanzi(zh: string): string[] {
  return [...zh]
}

/** Split a book line so the target word can be highlighted in place. */
export function splitOnWord(zh: string, word: string): Array<{ text: string; hit: boolean }> {
  if (!word || !zh.includes(word)) return [{ text: zh, hit: false }]
  const out: Array<{ text: string; hit: boolean }> = []
  let rest = zh
  while (rest.includes(word)) {
    const i = rest.indexOf(word)
    if (i > 0) out.push({ text: rest.slice(0, i), hit: false })
    out.push({ text: word, hit: true })
    rest = rest.slice(i + word.length)
  }
  if (rest) out.push({ text: rest, hit: false })
  return out
}
