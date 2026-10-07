/** CC-CEDICT's open data format; no translations are inferred here. */
export type CedictSense = [pinyin: string, definitions: string[]]
export type CedictShard = Record<string, CedictSense[]>
export const DICTIONARY_SOURCE = 'https://www.mdbg.net/chinese/dictionary?page=cc-cedict'
export const DICTIONARY_LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/'

export interface DictionaryEntry {
  zh: string
  pinyin: string
  en: string
  readings: Array<{ pinyin: string; definitions: string[] }>
  source: 'CC-CEDICT'
  sourceUrl: string
  refreshedAt?: number
  cachedAt?: number
}

/** Render dictionary tone numbers as visible tone marks, preserving pronunciation. */
export function tonePinyin(text: string): string {
  const marks: Record<string, string> = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' }
  return text.replace(/([A-Za-züÜvV:]+)([1-5])/g, (_match, raw: string, digit: string) => {
    const syllable = raw.replace(/u:/gi, (value) => value[0] === 'U' ? 'Ü' : 'ü').replace(/v/g, 'ü').replace(/V/g, 'Ü')
    if (digit === '5') return syllable
    const lower = syllable.toLowerCase()
    let index = lower.indexOf('a')
    if (index < 0) index = lower.indexOf('e')
    if (index < 0 && lower.includes('ou')) index = lower.indexOf('o')
    if (index < 0) for (let i = lower.length - 1; i >= 0; i--) if (marks[lower[i]]) { index = i; break }
    if (index < 0) return syllable
    let marked = marks[lower[index]][Number(digit) - 1]
    if (syllable[index] === syllable[index].toUpperCase()) marked = marked.toUpperCase()
    return syllable.slice(0, index) + marked + syllable.slice(index + 1)
  })
}

/**
 * Friendly presentation of CC-CEDICT references; the source assets stay raw.
 * `measureWord` names what CC-CEDICT calls "CL:". It is a parameter, not a t() call, because this module is also
 * bundled into the dictionary API function, which must not pull in the interface-language code.
 */
export function formatDictionaryDefinition(text: string, measureWord = 'measure word'): string {
  return text
    .replace(/([\p{Script=Han}·・]+)(?:\|([\p{Script=Han}·・]+))?\[([^\]]+)\]/gu, (_match, traditional: string, simplified: string | undefined, pinyin: string) => `${simplified || traditional} (${tonePinyin(pinyin)})`)
    .replace(/\[([A-Za-züÜvV:1-5\s·,'-]+)\]/g, (_match, pinyin: string) => `(${tonePinyin(pinyin)})`)
    .replace(/\bCL:\s*/g, () => `${measureWord}: `)
}

/** ICU versions sometimes glue function words; these are not lexical compounds. */
export function splitFunctionChunk(text: string): string[] {
  return text === '的是' || text === '也是' ? Array.from(text) : [text]
}

export function entryFromSenses(zh: string, senses: CedictSense[] | undefined): DictionaryEntry | null {
  if (!Array.isArray(senses) || !senses.length) return null
  const valid = senses.filter((sense) => Array.isArray(sense) && typeof sense[0] === 'string' && Array.isArray(sense[1]) && sense[1].every((definition) => typeof definition === 'string'))
  if (!valid.length) return null
  // Common word senses precede surname-only entries; all source senses remain available.
  const ordered = [...valid].sort((a, b) => Number(a[1].every((value) => /^surname\b/i.test(value))) - Number(b[1].every((value) => /^surname\b/i.test(value))))
  const readings = ordered.map(([pinyin, definitions]) => ({ pinyin: tonePinyin(pinyin), definitions }))
  return { zh, pinyin: readings[0].pinyin, en: [...new Set(readings.flatMap((reading) => reading.definitions))].join('; '), readings, source: 'CC-CEDICT', sourceUrl: DICTIONARY_SOURCE }
}

/** Exact headword lookup, supporting both traditional and simplified forms. */
export function parseCedictWord(text: string, word: string): DictionaryEntry | null {
  const senses: CedictSense[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(`${word} `) && !line.includes(` ${word} [`)) continue
    const match = /^(\S+) (\S+) \[(.+?)\] \/(.+)\/$/.exec(line)
    if (match && (match[1] === word || match[2] === word)) senses.push([match[3], match[4].split('/')])
  }
  return entryFromSenses(word, senses)
}

/** Natural word boundaries prevent arbitrary 4-character taps such as 是新闻. */
export function naturalChineseSegments(text: string): string[] {
  type SegmenterLike = new (locale: string, options: { granularity: 'word' }) => { segment: (value: string) => Iterable<{ segment: string }> }
  const Segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterLike }).Segmenter
  if (!Segmenter) return Array.from(text)
  return Array.from(new Segmenter('zh-CN', { granularity: 'word' }).segment(text), (part) => part.segment).flatMap(splitFunctionChunk)
}
