import raw from '../data/hsk4a.json'
import { overlayKeys, overlayWord } from './overlays'
import type { BookData, GrammarPoint, IndexedVocab, Lesson, LessonText, Vocab } from './types'

const data = raw as unknown as BookData

export const book = data.book
export const lessons: Lesson[] = data.lessons
export const vocabIndex: IndexedVocab[] = data.vocabIndex

export function getLesson(n: number): Lesson {
  const l = lessons.find((x) => x.lesson === n)
  if (!l) throw new Error(`no lesson ${n}`)
  return l
}

/** zh → entry, for tap-to-gloss. Lesson vocab wins over the book index. */
const byZh = new Map<string, Vocab>()
for (const v of vocabIndex) {
  byZh.set(v.zh, { zh: v.zh, pinyin: v.pinyin, pos: v.pos, en: v.en, note: '' })
}
for (const l of lessons) for (const v of l.vocab) byZh.set(v.zh, v)

export function lookup(word: string): Vocab | undefined {
  return byZh.get(word)
}

export function lessonOf(word: string): number | undefined {
  return vocabIndex.find((v) => v.zh === word)?.lesson
}

const MAX_WORD = 4

export interface Token {
  text: string
  vocab?: Vocab
}

/**
 * Greedy longest-match segmentation against the book vocabulary. Anything that
 * isn't a known word is emitted as a run of plain characters, so a line always
 * reassembles to its original text.
 */
export function segment(line: string): Token[] {
  const out: Token[] = []
  let plain = ''
  let i = 0
  while (i < line.length) {
    let hit: Vocab | undefined
    let len = 0
    for (let n = Math.min(MAX_WORD, line.length - i); n >= 2; n--) {
      const candidate = byZh.get(line.slice(i, i + n))
      if (candidate) {
        hit = candidate
        len = n
        break
      }
    }
    if (hit) {
      if (plain) {
        out.push({ text: plain })
        plain = ''
      }
      out.push({ text: line.slice(i, i + len), vocab: hit })
      i += len
    } else {
      plain += line[i]
      i++
    }
  }
  if (plain) out.push({ text: plain })
  return out
}

export interface Example {
  zh: string
  pinyin: string
  en: string
}

const exampleCache = new Map<string, Example | null>()

/**
 * Compounds that are not always in HSK 4A 生词 but would steal a 1-character
 * target via substring (亮⊂月亮, 高⊂高兴, 马⊂马上, 处⊂好处).
 */
const TOKEN_COMPOUNDS = [
  '月亮',
  '高兴',
  '马上',
  '好处',
  '不高兴',
  '高高兴兴',
  '当然',
  '而且',
  '而是',
  '而已',
]

const tokenLexicon = new Set<string>([...byZh.keys(), ...overlayKeys(), ...TOKEN_COMPOUNDS])
const maxToken = [...tokenLexicon].reduce((n, w) => Math.max(n, w.length), 4)

function insideLongerToken(haystack: string, index: number, word: string): boolean {
  const wordEnd = index + word.length
  const from = Math.max(0, wordEnd - maxToken)
  const to = Math.min(haystack.length, index + maxToken)
  for (let start = from; start <= index; start++) {
    for (let end = wordEnd; end <= to && end - start <= maxToken; end++) {
      if (end - start <= word.length) continue
      if (tokenLexicon.has(haystack.slice(start, end))) return true
    }
  }
  return false
}

/** True when `word` appears as its own token, not inside 月亮 / 高兴 / 马上 / 好处. */
export function hasWordToken(haystack: string, word: string): boolean {
  if (!word || !haystack.includes(word)) return false
  let from = 0
  while (from < haystack.length) {
    const i = haystack.indexOf(word, from)
    if (i < 0) return false
    if (!insideLongerToken(haystack, i, word)) return true
    from = i + 1
  }
  return false
}

/** Overlay example first; else the book's shortest sentence that contains the word as a token. */
export function exampleFor(word: string, lesson?: number): Example | null {
  const overlay = overlayWord(word, lesson)
  if (overlay?.example?.zh) return overlay.example
  const cached = exampleCache.get(word)
  if (cached !== undefined) return cached
  let best: Example | null = null
  const consider = (e: Example) => {
    if (!hasWordToken(e.zh, word)) return
    if (!best || e.zh.length < best.zh.length) best = e
  }
  for (const l of lessons) {
    for (const t of l.texts) for (const line of t.lines) consider(line)
    for (const g of l.grammar) for (const ex of g.examples) consider(ex)
    for (const sc of l.extras.same_char) for (const ex of sc.examples) consider(ex)
  }
  exampleCache.set(word, best)
  return best
}

/** The character a lesson's handwriting step and character-of-the-day use. */
export function focusChar(l: Lesson): string {
  return l.extras.same_char[0]?.char ?? l.vocab[0].zh[0]
}

/**
 * Some same-character entries in the source are polluted with inline pinyin,
 * em-dash glosses, or literal JSON. Recover a clean {zh, pinyin, en} from each.
 */
function cleanSameCharWord(raw: string): Vocab {
  const s = raw.trim()
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s) as { zh?: string; pinyin?: string; en?: string }
      if (o.zh) return { zh: o.zh, pinyin: o.pinyin ?? '', pos: '', en: o.en ?? '', note: '' }
    } catch {
      /* fall through to text parsing */
    }
  }
  const han = s.match(/^[㐀-鿿豈-﫿]+/)
  const zh = han ? han[0] : s
  const found = lookup(zh)
  if (found) return found
  const rest = s.slice(zh.length).trim()
  const paren = rest.match(/^(.+?)\s*[（(](.+)[)）]\s*$/)
  const dash = rest.match(/^(.+?)\s*[–—-]\s*(.+)$/)
  const [pinyin, en] = paren
    ? [paren[1].trim(), paren[2].trim()]
    : dash
      ? [dash[1].trim(), dash[2].trim()]
      : [rest, '']
  return { zh, pinyin, pos: '', en, note: '' }
}

/** Words sharing the lesson's focus character, glossed where the book has them. */
export function sameCharWords(l: Lesson): Vocab[] {
  const note = l.extras.same_char[0]
  if (!note) return []
  return note.words.map(cleanSameCharWord)
}

export const totalVocab = lessons.reduce((n, l) => n + l.vocab.length, 0)

/** One 课文-unit sitting stays at Duolingo length: 8–10 new words, usually ~6. */
export const TEXT_WORD_CAP = 10

export const TEXT_NODES = ['t1', 't2', 't3', 't4', 't5'] as const
export type TextNode = (typeof TEXT_NODES)[number]

const properPos = (v: Vocab) => /proper|pr\.n/i.test(v.pos)

function asTeachable(v: Vocab): Vocab | null {
  if (!v.zh || !v.en || properPos(v)) return null
  return v
}

/**
 * 生词 for a sitting: the lesson list plus that lesson’s known-char 补充生词.
 * Proper names still stay out.
 */
export function teachableVocab(l: Lesson): Vocab[] {
  const seen = new Set<string>()
  const out: Vocab[] = []
  const add = (v: Vocab) => {
    const keep = asTeachable(v)
    if (!keep || seen.has(keep.zh)) return
    seen.add(keep.zh)
    out.push(keep)
  }
  for (const v of l.vocab) add(v)
  for (const v of vocabIndex) {
    if (v.lesson !== l.lesson || v.tag !== 'known-char') continue
    add({
      zh: v.zh,
      pinyin: v.pinyin,
      pos: v.pos,
      en: v.en,
      note: v.related ? `补充生词 · ${v.related}` : '补充生词',
    })
  }
  return out
}

function textHasWord(text: LessonText, word: string): boolean {
  return text.lines.some((line) => hasWordToken(line.zh, word))
}

/**
 * Attach each teachable 生词 to the first 课文 whose lines contain it.
 * Words that never appear go to 课文5. HSK 4A stays at 5–8 words per 课文;
 * if a 课文 ever exceeds the cap, overflow is a second chunk still labeled
 * for that 课文 (the 6-node path still plays chunk 0; extras join 课文5).
 */
export function attachVocab(l: Lesson): Vocab[][] {
  const texts = l.texts
  const last = Math.max(0, texts.length - 1)
  const buckets: Vocab[][] = texts.map(() => [])

  for (const word of teachableVocab(l)) {
    const idx = texts.findIndex((t) => textHasWord(t, word.zh))
    buckets[idx >= 0 ? idx : last].push(word)
  }

  for (let i = 0; i < last; i++) {
    if (buckets[i].length <= TEXT_WORD_CAP) continue
    const extra = buckets[i].splice(TEXT_WORD_CAP)
    buckets[last].push(...extra)
  }
  return buckets
}

export interface TextSitting {
  textIndex: number
  text: LessonText
  words: Vocab[]
  grammar: GrammarPoint | undefined
}

/** Sitting for 课文 n (0-based): its attached 生词 plus that 语言点. */
export function textSitting(l: Lesson, textIndex: number): TextSitting | undefined {
  const text = l.texts[textIndex]
  if (!text) return undefined
  const words = attachVocab(l)[textIndex] ?? []
  return {
    textIndex,
    text,
    words,
    grammar: l.grammar[textIndex],
  }
}

export function textNodeIndex(node: TextNode): number {
  return TEXT_NODES.indexOf(node)
}

export function sittingHint(l: Lesson, textIndex: number): string {
  const sitting = textSitting(l, textIndex)
  if (!sitting) return ''
  const first = sitting.words[0]?.zh
  if (first) return first
  return sitting.text.heading_zh || sitting.text.heading_en || sitting.text.label
}
