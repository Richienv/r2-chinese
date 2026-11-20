import { rng, seedOf, shuffle } from './seeded.ts'

/**
 * Mixed practice, Duolingo-style: the same new word comes back in several forms
 * (meaning, sound, sentence, characters) so it gets familiar without a wall of
 * typing. Pure and deterministic: the same sitting always builds the same set.
 */

export interface ExWord {
  zh: string
  pinyin: string
  /** The gloss in the learner's language (the overlay is already applied). */
  en: string
  pos?: string
}

export interface ExSentence {
  zh: string
  pinyin?: string
  en: string
}

export interface ExSource extends ExWord {
  example?: ExSentence | null
}

export type Exercise =
  | { kind: 'meaning-pick'; stage: 1; word: ExWord; options: ExWord[] }
  | { kind: 'hanzi-pick'; stage: 1; word: ExWord; options: ExWord[] }
  | { kind: 'listen-pick'; stage: 1; word: ExWord; options: ExWord[] }
  | { kind: 'match'; stage: 1; pairs: ExWord[]; meanings: string[] }
  | { kind: 'cloze'; stage: 2; word: ExWord; sentence: ExSentence; before: string; after: string; options: ExWord[] }
  | { kind: 'continue'; stage: 2; sentence: ExSentence; head: string; tail: string; options: string[] }
  | { kind: 'arrange'; stage: 2; sentence: ExSentence; answer: string[]; tiles: string[] }
  | { kind: 'char-build'; stage: 3; word: ExWord; answer: string[]; tiles: string[] }

export type ExerciseKind = Exercise['kind']

export interface ExerciseStep {
  kind: 'exercise'
  id: string
  exercise: Exercise
  /** The single word an exercise is about, so the route can place it in that word's wave. */
  word?: { zh: string }
  n: number
  of: number
}

export interface ComposeContext {
  /** Words from the whole course, used for wrong answers after the sitting's own words. */
  pool: ExWord[]
  /** Natural word boundaries for sentence tiles. */
  segment: (zh: string) => string[]
  seed: string
}

export interface ComposedSitting {
  /** Stage 1, one block per group of new words, played right after that group is met. */
  groups: { words: string[]; exercises: ExerciseStep[] }[]
  /** Stage 2 and 3, played in the final practice round. */
  context: ExerciseStep[]
  produce: ExerciseStep[]
}

const PUNCT = /^[\s，。！？、；：,.!?;:“”"'‘’（）()《》…—-]+$/u
const HAN = /\p{Script=Han}/u
export const GROUP_SIZE = 4
export const MAX_CLOZE = 2
export const MAX_ARRANGE = 2
export const MAX_BUILD = 4
export const MAX_TILES = 8
export const MAX_ARRANGE_HAN = 16
/** Mirrors LONG_SITTING in sessionRoute: above this, a sitting runs in waves. */
export const LONG_WORDS = 12

/**
 * The first, plain sense of a gloss: "kesan, impresi" → "kesan",
 * "love (between a man and a woman)" → "love". Usage notes stay in the full gloss.
 */
export function coreMeaning(gloss: string): string {
  const plain = gloss
    .replace(/\s*[（(][^）)]*[）)]\s*/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const first = plain.split(/\s*;\s*/)[0] ?? ''
  const head = first.split(/\s*,\s*/)[0] ?? ''
  return (head || first || plain).trim()
}

/** The other senses after the core meaning ("kesan, impresi" → "impresi"), for a quiet second line. */
export function otherMeanings(gloss: string): string {
  const senses = gloss.trim().split(/\s*[;,]\s*(?![^（(]*[）)])/).filter(Boolean)
  if (!senses.length) return ''
  const note = senses[0].match(/[（(]([^）)]*)[）)]/)?.[1]?.trim()
  return [note, ...senses.slice(1)].filter((part): part is string => !!part && part !== coreMeaning(gloss)).join(', ')
}

const key = (text: string) => text.toLocaleLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Wrong answers: the sitting's own words first (the real confusions), then the
 * same part of speech, then anything. Never the same word or the same meaning.
 */
function distractors(
  target: ExWord,
  near: readonly ExWord[],
  pool: readonly ExWord[],
  count: number,
  rand: () => number,
  by: 'meaning' | 'zh',
): ExWord[] {
  const usable = (w: ExWord) =>
    w.zh !== target.zh &&
    HAN.test(w.zh) &&
    (by === 'zh' || coreMeaning(w.en).length > 0) &&
    !(by === 'zh' && (w.zh.includes(target.zh) || target.zh.includes(w.zh)))
  const length = Array.from(target.zh).length
  const ranked = [
    ...shuffle(near.filter(usable), rand),
    ...shuffle(pool.filter((w) => usable(w) && w.pos && w.pos === target.pos && (by === 'meaning' || Array.from(w.zh).length === length)), rand),
    ...shuffle(pool.filter((w) => usable(w) && (by === 'meaning' || Array.from(w.zh).length === length)), rand),
    ...shuffle(pool.filter(usable), rand),
  ]
  const seenZh = new Set([target.zh])
  const seenMeaning = new Set([key(coreMeaning(target.en))])
  const picked: ExWord[] = []
  for (const w of ranked) {
    if (picked.length === count) break
    const meaning = key(coreMeaning(w.en))
    if (seenZh.has(w.zh) || (meaning && seenMeaning.has(meaning))) continue
    seenZh.add(w.zh)
    if (meaning) seenMeaning.add(meaning)
    picked.push(w)
  }
  return picked
}

/**
 * Keep variety: avoid the same exercise kind or the same word twice in a row
 * whenever another order allows it. Stable otherwise.
 */
export function interleave<T>(items: readonly T[], kindOf: (item: T) => string, wordsOf: (item: T) => string[]): T[] {
  const left = items.slice()
  const out: T[] = []
  while (left.length) {
    const last = out[out.length - 1]
    const lastWords = last ? new Set(wordsOf(last)) : new Set<string>()
    let index = left.findIndex((item) => !last || (kindOf(item) !== kindOf(last) && !wordsOf(item).some((w) => lastWords.has(w))))
    if (index < 0) index = left.findIndex((item) => !last || kindOf(item) !== kindOf(last))
    if (index < 0) index = 0
    out.push(left.splice(index, 1)[0])
  }
  return out
}

/** Words an exercise is about, for recording evidence and keeping repeats apart. */
export function exerciseWords(exercise: Exercise): string[] {
  switch (exercise.kind) {
    case 'match':
      return exercise.pairs.map((w) => w.zh)
    case 'continue':
    case 'arrange':
      return []
    default:
      return [exercise.word.zh]
  }
}

function step(id: string, exercise: Exercise): ExerciseStep {
  const words = exerciseWords(exercise)
  return { kind: 'exercise', id, exercise, ...(words.length === 1 && exercise.kind !== 'match' ? { word: { zh: words[0] } } : {}), n: 0, of: 0 }
}

/** Balanced groups of at most four: 7 → 4 + 3, 5 → 3 + 2. */
export function groupWords<T>(words: readonly T[], size = GROUP_SIZE): T[][] {
  if (!words.length) return []
  const groups = Math.ceil(words.length / size)
  const per = Math.ceil(words.length / groups)
  const out: T[][] = []
  for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per))
  return out
}

const PICKS = ['meaning-pick', 'listen-pick', 'hanzi-pick'] as const

/** Stage 1: recognise the words just met. Easy wins first, every word once, then a match board. */
export function composeRecognise(words: readonly ExSource[], ctx: ComposeContext, offset = 0, near: readonly ExWord[] = words, sparse = false): ExerciseStep[] {
  const glossed = words.filter((w) => coreMeaning(w.en))
  const pairs = uniqueByMeaning(glossed).slice(0, 5)
  const onBoard = new Set(pairs.length >= 3 ? pairs.map((w) => w.zh) : [])
  // In a long sitting the match board already covers its words; ask every other one alone.
  const asked = words.filter((word, index) => !sparse || !onBoard.has(word.zh) || index % 2 === offset % 2)
  const picks = asked.map((word) => {
    const index = words.indexOf(word)
    const rand = rng(seedOf(`${ctx.seed}:pick:${word.zh}`))
    let kind: (typeof PICKS)[number] = PICKS[(index + offset) % PICKS.length]
    if (!coreMeaning(word.en)) kind = 'listen-pick'
    const by = kind === 'meaning-pick' ? 'meaning' : 'zh'
    const wrong = distractors(word, near, ctx.pool, 3, rand, by)
    const options = shuffle([plain(word), ...wrong.map(plain)], rand)
    return { id: `ex1:${kind}:${word.zh}`, exercise: { kind, stage: 1 as const, word: plain(word), options } }
  }).filter((pick) => pick.exercise.options.length >= 3).map((pick) => step(pick.id, pick.exercise))
  const out: ExerciseStep[] = [...picks]
  if (pairs.length >= 3) {
    const rand = rng(seedOf(`${ctx.seed}:match:${pairs.map((w) => w.zh).join('')}`))
    const meanings = shuffle(pairs.map((w) => w.zh), rand)
    out.splice(Math.ceil(picks.length / 2), 0, step(`ex1:match:${pairs.map((w) => w.zh).join('·')}`, { kind: 'match', stage: 1, pairs: pairs.map(plain), meanings }))
  }
  return out
}

function uniqueByMeaning(words: readonly ExWord[]): ExWord[] {
  const seen = new Set<string>()
  return words.filter((w) => {
    const meaning = key(coreMeaning(w.en))
    if (!meaning || seen.has(meaning)) return false
    seen.add(meaning)
    return true
  })
}

function plain(w: ExWord): ExWord {
  return { zh: w.zh, pinyin: w.pinyin, en: w.en, ...(w.pos ? { pos: w.pos } : {}) }
}

/** Sentence tiles: natural words, with punctuation glued to its neighbour. Never arbitrary chunks. */
export function sentenceTiles(zh: string, segment: (zh: string) => string[]): string[] {
  const raw = segment(zh).filter((part) => part.length > 0)
  const tiles: string[] = []
  for (const part of raw) {
    if (PUNCT.test(part) && tiles.length) tiles[tiles.length - 1] += part
    else if (/^\s+$/.test(part)) continue
    else tiles.push(part)
  }
  // A leading punctuation tile joins the next one.
  if (tiles.length > 1 && PUNCT.test(tiles[0])) tiles.splice(0, 2, tiles[0] + tiles[1])
  return tiles
}

/** Split a sentence at the comma nearest its middle: head ends with the comma. */
export function splitAtComma(zh: string): { head: string; tail: string } | null {
  const commas: number[] = []
  Array.from(zh).forEach((ch, i) => { if (ch === '，' || ch === ',') commas.push(i) })
  if (!commas.length) return null
  const chars = Array.from(zh)
  const middle = chars.length / 2
  const at = commas.reduce((best, i) => (Math.abs(i - middle) < Math.abs(best - middle) ? i : best), commas[0])
  const head = chars.slice(0, at + 1).join('')
  const tail = chars.slice(at + 1).join('')
  const hanCount = (s: string) => Array.from(s).filter((c) => HAN.test(c)).length
  if (hanCount(head) < 3 || hanCount(tail) < 3) return null
  return { head, tail }
}

const hanLength = (zh: string) => Array.from(zh).filter((c) => HAN.test(c)).length

/** Stage 2: use the words in real sentences. Choose the word, finish the line, build the line. */
export function composeContext(words: readonly ExSource[], lines: readonly ExSentence[], ctx: ComposeContext): ExerciseStep[] {
  const out: ExerciseStep[] = []
  const usedSentences = new Set<string>()
  const sentences = dedupeSentences([...words.flatMap((w) => (w.example ? [w.example] : [])), ...lines])

  // Cloze: the book line with the word blanked; wrong answers are the sitting's other words.
  for (const word of words) {
    if (out.length >= MAX_CLOZE) break
    const sentence = (word.example?.zh.includes(word.zh) ? word.example : null) ?? sentences.find((s) => s.zh.includes(word.zh) && !usedSentences.has(s.zh))
    if (!sentence || hanLength(sentence.zh) > 40) continue
    const at = sentence.zh.indexOf(word.zh)
    const rand = rng(seedOf(`${ctx.seed}:cloze:${word.zh}`))
    const wrong = distractors(word, words, ctx.pool, 3, rand, 'zh').filter((w) => !sentence.zh.includes(w.zh))
    if (wrong.length < 2) continue
    usedSentences.add(sentence.zh)
    out.push(step(`ex2:cloze:${word.zh}`, {
      kind: 'cloze', stage: 2, word: plain(word), sentence,
      before: sentence.zh.slice(0, at), after: sentence.zh.slice(at + word.zh.length),
      options: shuffle([plain(word), ...wrong.slice(0, 3).map(plain)], rand),
    }))
  }

  // Continue the sentence: the head stays, three possible endings.
  const splittable = sentences
    .map((s) => ({ s, parts: splitAtComma(s.zh) }))
    .filter((c): c is { s: ExSentence; parts: { head: string; tail: string } } => !!c.parts && hanLength(c.s.zh) <= 34 && !!c.s.en)
  const wordsIn = (s: ExSentence) => words.filter((w) => s.zh.includes(w.zh)).length
  const target = [...splittable].sort((a, b) => wordsIn(b.s) - wordsIn(a.s))[0]
  if (target) {
    const rand = rng(seedOf(`${ctx.seed}:continue:${target.s.zh}`))
    const endings = shuffle(splittable.filter((c) => c.parts.tail !== target.parts.tail && c.s.zh !== target.s.zh), rand)
      .sort((a, b) => Math.abs(hanLength(a.parts.tail) - hanLength(target.parts.tail)) - Math.abs(hanLength(b.parts.tail) - hanLength(target.parts.tail)))
      .slice(0, 2)
      .map((c) => c.parts.tail)
    if (endings.length === 2) {
      out.push(step(`ex2:continue:${seedOf(target.s.zh).toString(36)}`, {
        kind: 'continue', stage: 2, sentence: target.s, head: target.parts.head, tail: target.parts.tail,
        options: shuffle([target.parts.tail, ...endings], rand),
      }))
    }
  }

  // Arrange: build the line from tiles, cued by its meaning, plus one tile that does not belong.
  const arrangeable = sentences.filter((s) => {
    const n = hanLength(s.zh)
    return !!s.en && n >= 5 && n <= MAX_ARRANGE_HAN && !usedSentences.has(s.zh) && s.zh !== target?.s.zh
  })
  const ranked = [...arrangeable].sort((a, b) => wordsIn(b) - wordsIn(a))
  let arranged = 0
  for (const sentence of ranked) {
    if (arranged >= MAX_ARRANGE) break
    const answer = sentenceTiles(sentence.zh, ctx.segment)
    // Too many words would mean gluing them into odd chunks; such a line is skipped.
    if (answer.length < 3 || answer.length > MAX_TILES) continue
    const rand = rng(seedOf(`${ctx.seed}:arrange:${sentence.zh}`))
    const spare = shuffle([...words, ...ctx.pool].filter((w) => HAN.test(w.zh) && !sentence.zh.includes(w.zh) && !answer.includes(w.zh)), rand)[0]
    const tiles = shuffle([...answer, ...(spare ? [spare.zh] : [])], rand)
    // A shuffle that lands in order teaches nothing; rotate it.
    if (tiles.join('') === answer.join('')) tiles.push(tiles.shift()!)
    usedSentences.add(sentence.zh)
    arranged++
    out.push(step(`ex2:arrange:${seedOf(sentence.zh).toString(36)}`, { kind: 'arrange', stage: 2, sentence, answer, tiles }))
  }
  return out
}

function dedupeSentences(list: readonly ExSentence[]): ExSentence[] {
  const seen = new Set<string>()
  return list.filter((s) => {
    if (!s?.zh?.trim() || seen.has(s.zh)) return false
    seen.add(s.zh)
    return true
  })
}

/** Stage 3: build the word from its characters, from the meaning alone. */
export function composeProduce(words: readonly ExSource[], ctx: ComposeContext, waves = false): ExerciseStep[] {
  const out: ExerciseStep[] = []
  // A long sitting of new words builds a third of them, so every wave has some tiles.
  // A review sitting keeps typing from memory for all but a few.
  const cap = waves ? Math.max(MAX_BUILD, Math.ceil(words.length / 3)) : MAX_BUILD
  for (const word of words) {
    if (out.length >= cap) break
    const answer = Array.from(word.zh)
    if (answer.length < 2 || !answer.every((c) => HAN.test(c)) || !coreMeaning(word.en)) continue
    const rand = rng(seedOf(`${ctx.seed}:build:${word.zh}`))
    out.push(step(`ex3:build:${word.zh}`, { kind: 'char-build', stage: 3, word: plain(word), answer, tiles: characterTiles(word.zh, [...words, ...ctx.pool], rand) }))
  }
  return out
}

/** The word's characters plus look-alike company from nearby words, six tiles or more. */
export function characterTiles(zh: string, near: readonly ExWord[], rand: () => number): string[] {
  const answer = Array.from(zh)
  const wanted = Math.max(2, 6 - answer.length)
  const spare: string[] = []
  for (const w of [...near.slice(0, 12), ...shuffle(near.slice(12), rand)]) {
    for (const ch of Array.from(w.zh)) {
      if (spare.length >= wanted) break
      if (HAN.test(ch) && !answer.includes(ch) && !spare.includes(ch)) spare.push(ch)
    }
    if (spare.length >= wanted) break
  }
  const tiles = shuffle([...answer, ...spare], rand)
  if (tiles.slice(0, answer.length).join('') === zh) tiles.push(tiles.shift()!)
  return tiles
}

/** Everything a sitting needs, in play order inside each stage. */
export function composeSitting(words: readonly ExSource[], lines: readonly ExSentence[], ctx: ComposeContext, meetWords: readonly string[] = words.map((w) => w.zh)): ComposedSitting {
  const met = words.filter((w) => meetWords.includes(w.zh))
  const long = met.length > LONG_WORDS
  const groups = groupWords(met).map((group, index) => ({
    words: group.map((w) => w.zh),
    exercises: composeRecognise(group, ctx, index, words, long),
  }))
  const kindOf = (s: ExerciseStep) => s.exercise.kind
  const wordsOf = (s: ExerciseStep) => exerciseWords(s.exercise)
  return {
    groups,
    context: interleave(composeContext(words, lines, ctx), kindOf, wordsOf),
    produce: composeProduce(words, ctx, long),
  }
}

/** Is a built answer right? Tiles may repeat, so compare the text, not the tile identity. */
export function sameText(chosen: readonly string[], answer: readonly string[]): boolean {
  return chosen.join('') === answer.join('')
}
