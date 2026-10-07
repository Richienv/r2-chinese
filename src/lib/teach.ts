import type { Example } from './content'
import { getLang, t } from './i18n.ts'
import { overlayWord } from './overlays'
import type { Vocab } from './types'

export type TeachPhase = 'meet' | 'hook' | 'example' | 'seal'

export type WordHook = {
  when: string
  usage: string
}

export const TEACH_KICKER: Record<TeachPhase, string> = {
  meet: t('See it'),
  hook: t('Remember it'),
  example: t('Hear it'),
  seal: t('Lock it'),
}

export const TEACH_TITLE: Record<TeachPhase, string> = {
  meet: t('This is the word'),
  hook: t('How to remember it'),
  example: t('Hear it in context'),
  seal: t('Hanzi, then pinyin'),
}

/**
 * The first meaning of a gloss, ready to drop into a sentence. English glosses are verb phrases ("to prepare") or
 * nouns ("law"), so the leading "to" goes and the rest is lowercased. Indonesian glosses are already plain words
 * ("mempersiapkan; bersiap", "hukum") and may be proper nouns, so they are used exactly as written.
 */
function firstSense(gloss: string): string {
  const bit = gloss.split(/[;,/]/)[0]?.trim() ?? gloss
  if (getLang() !== 'en') return bit || gloss
  return bit.replace(/^to\s+/i, '').toLowerCase() || gloss.toLowerCase()
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

function defaultHook(word: Vocab, example: Example | null): WordHook {
  const sense = firstSense(word.en)
  const kind = posKey(word.pos)
  const note = word.note.trim()
  const vars = { word: word.zh, sense }

  const when =
    kind === 'v'
      ? t('Remember {word} like the word you’ll use when you want to {sense}.', vars)
      : kind === 'adj'
        ? t('Remember {word} like the word you’ll use when something is {sense}.', vars)
        : kind === 'adv'
          ? t('Remember {word} like the word you’ll use when you mean “{sense}”.', vars)
          : kind === 'conj'
            ? t('Remember {word} like the glue you’ll use when you need “{sense}” between two ideas.', vars)
            : kind === 'name'
              ? t('Remember {word} as the name {name}. Say it when that person or place comes up.', { word: word.zh, name: word.en })
              : kind === 'num'
                ? t('Connect {word} to the amount or counting expression “{sense}”.', vars)
                : t('Remember {word} like the word you’ll use when you need to talk about {sense}.', vars)

  // The sentence must keep ending in ": {line}": TeachBeats lifts that line out into its own "book example" reveal.
  const usage =
    note ||
    (example?.zh.includes(word.zh)
      ? t('Notice what comes before and after {word} in the lesson line: {line}', { word: word.zh, line: example.zh })
      : kind === 'v'
      ? t('Connect this action to its subject and object. Use your curriculum’s example to keep the sentence pattern accurate.')
      : kind === 'adj'
        ? t('Attach this description to a concrete person or thing, then retrieve the description without looking.')
        : kind === 'adv'
          ? t('Notice where this word sits in the source sentence and what it changes about the meaning.')
          : kind === 'conj'
            ? t('Keep the two ideas it connects together when you practise the source sentence.')
            : kind === 'name'
              ? t('Treat it as a proper name. Don’t translate it — just recognise it.')
              : kind === 'num'
                ? t('Keep its counting pattern from the curriculum together with the word.')
                : t('Link this noun to a concrete example and an action that you can use with it.'))

  return { when, usage }
}

/** Coach lines: overlay when/usage when the lesson file has them. */
export function wordHook(word: Vocab, example: Example | null, lesson?: number): WordHook {
  const fallback = defaultHook(word, example)
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
