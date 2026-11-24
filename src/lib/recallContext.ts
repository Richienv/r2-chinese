/**
 * The sentence shown under a recall cue so a meaning that fits several words
 * points at one. Book sentences can run past sixty characters, which is too much
 * to read in the middle of a quick recall, so a long one is cut down to the part
 * around the blank. Pure and relative-import only so node can test it directly.
 */
export interface ContextLine {
  zh: string
  /** The translation, only when it still matches what is shown. */
  en: string | null
}

export const CONTEXT_MAX = 30
const GAP = '＿'

/** Hanzi and blanks: what a reader actually has to read. */
const size = (text: string) => Array.from(text).filter((ch) => ch === GAP || /\p{Script=Han}/u.test(ch)).length

const clean = (parts: RegExpMatchArray | null, fallback: string) => (parts ?? [fallback]).map((part) => part.trim()).filter(Boolean)
const holdsBlank = (parts: string[]) => Math.max(0, parts.findIndex((part) => part.includes(GAP)))

export function contextWindow(blank: string, en?: string | null, max = CONTEXT_MAX): ContextLine {
  const translation = en?.trim() || null
  if (size(blank) <= max) return { zh: blank, en: translation }

  // One sentence is enough: the one holding the blank, with its own translation when the two line up.
  const sentences = clean(blank.match(/[^。！？!?]+[。！？!?”’」』]*/g), blank)
  const english = translation ? clean(translation.match(/[^.!?]+[.!?]*["”’]*\s*/g), translation) : []
  const at = holdsBlank(sentences)
  const sentence = sentences[at]
  const aligned = sentences.length === 1 ? translation : english.length === sentences.length ? english[at] : null
  if (size(sentence) <= max) return { zh: sentence, en: aligned }

  // One long sentence: the clauses around the blank, grown to a readable length. No translation then.
  const clauses = clean(sentence.match(/[^，、；：,;:]+[，、；：,;:]*/g), sentence)
  let lo = holdsBlank(clauses)
  let hi = lo
  const span = () => clauses.slice(lo, hi + 1).join('')
  for (;;) {
    const after = clauses[hi + 1]
    const before = clauses[lo - 1]
    if (after !== undefined && size(span() + after) <= max && size(span()) < max * 0.5) hi++
    else if (before !== undefined && size(before + span()) <= max && size(span()) < max * 0.5) lo--
    else break
  }
  const text = span().replace(/[，、；：,;:]$/, '')
  return { zh: `${lo > 0 ? '…' : ''}${text}${hi < clauses.length - 1 ? '…' : ''}`, en: null }
}
