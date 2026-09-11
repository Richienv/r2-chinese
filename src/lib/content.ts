import raw from '../data/hsk4a.json'
import type { BookData, IndexedVocab, Lesson, Vocab } from './types'

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

/** The book's own shortest sentence containing a word — used on review cards. */
export function exampleFor(word: string): Example | null {
  const cached = exampleCache.get(word)
  if (cached !== undefined) return cached
  let best: Example | null = null
  const consider = (e: Example) => {
    if (!e.zh.includes(word)) return
    if (!best || e.zh.length < best.zh.length) best = e
  }
  for (const l of lessons) {
    for (const t of l.texts) for (const line of t.lines) consider(line)
    for (const g of l.grammar) for (const ex of g.examples) consider(ex)
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
