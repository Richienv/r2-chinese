/**
 * Context, redaction, structural metadata, synonym disambiguation, and
 * near-synonym feedback for active recall and meaning-to-Hanzi prompts.
 * Pure and relative-import only so Node tests load it directly.
 */
import { coreMeaning, otherMeanings } from './exercises.ts'
import { getLang, t } from './i18n.ts'
import { normalizeChinese } from './production.ts'
import { synonymEntriesFor } from './synonymClusters.ts'
import type { Vocab } from './types.ts'

export interface ContextLine {
  zh: string
  /** Translation aligned to what is shown. Preserved rather than dropped on long sentences. */
  en: string | null
}

export const CONTEXT_MAX = 30
const GAP = '＿'
const HAN = /\p{Script=Han}/u

/** Hanzi and blanks: what a reader actually has to read. */
const size = (text: string) => Array.from(text).filter((ch) => ch === GAP || HAN.test(ch)).length

const clean = (parts: RegExpMatchArray | null, fallback: string) =>
  (parts ?? [fallback]).map((part) => part.trim()).filter(Boolean)

const holdsBlank = (parts: string[]) => Math.max(0, parts.findIndex((part) => part.includes(GAP)))

/**
 * Map sentence `at` of `sentences` to the matching slice of `english` when translators
 * split one Chinese sentence into two English/Indonesian sentences.
 */
function alignMultiSentenceTranslation(sentences: string[], english: string[], at: number, fallback: string): string {
  if (english.length === sentences.length) return english[at]
  if (english.length < sentences.length) return fallback
  const sWeights = sentences.map((s) => Math.max(1, size(s)))
  const eWeights = english.map((e) => Math.max(1, e.length))
  const sTotal = sWeights.reduce((a, b) => a + b, 0)
  const eTotal = eWeights.reduce((a, b) => a + b, 0)
  let sCum = 0
  let eIdx = 0
  let eCum = 0
  const bounds: number[] = [0]
  for (let i = 0; i < sentences.length - 1; i++) {
    sCum += sWeights[i]
    const targetFrac = sCum / sTotal
    const minNext = i + 1
    const maxNext = english.length - (sentences.length - 1 - i)
    while (eIdx < minNext) eCum += eWeights[eIdx++]
    while (eIdx < maxNext) {
      const currDist = Math.abs(eCum / eTotal - targetFrac)
      const nextDist = Math.abs((eCum + eWeights[eIdx]) / eTotal - targetFrac)
      if (nextDist <= currDist) eCum += eWeights[eIdx++]
      else break
    }
    bounds.push(eIdx)
  }
  bounds.push(english.length)
  return english.slice(bounds[at], bounds[at + 1]).join(' ')
}

function sliceLongClauseAroundGap(clause: string, max: number): string {
  const chars = Array.from(clause)
  const gapStart = chars.indexOf(GAP)
  if (gapStart < 0) return chars.slice(0, max).join('')
  let gapEnd = gapStart
  while (gapEnd + 1 < chars.length && chars[gapEnd + 1] === GAP) gapEnd++
  let lo = gapStart
  let hi = gapEnd
  const sliceSize = () => chars.slice(lo, hi + 1).filter((ch) => ch === GAP || HAN.test(ch)).length
  while (sliceSize() < max && (lo > 0 || hi < chars.length - 1)) {
    if (hi < chars.length - 1) {
      const ch = chars[hi + 1]
      if (sliceSize() + (ch === GAP || HAN.test(ch) ? 1 : 0) <= max) hi++
      else break
    }
    if (lo > 0 && sliceSize() < max) {
      const ch = chars[lo - 1]
      if (sliceSize() + (ch === GAP || HAN.test(ch) ? 1 : 0) <= max) lo--
      else break
    }
  }
  const text = chars.slice(lo, hi + 1).join('').replace(/^[，、；：,;:]+|[，、；：,;:]+$/g, '')
  return `${lo > 0 ? '…' : ''}${text}${hi < chars.length - 1 ? '…' : ''}`
}

export function contextWindow(blank: string, en?: string | null, max = CONTEXT_MAX): ContextLine {
  const translation = en?.trim() || null
  if (size(blank) <= max) return { zh: blank, en: translation }

  // One sentence is enough: the one holding the blank, with its aligned translation.
  const sentences = clean(blank.match(/[^。！？!?]+[。！？!?”’」』]*/g), blank)
  const english = translation ? clean(translation.match(/[^.!?]+[.!?]*["”’]*\s*/g), translation) : []
  const at = holdsBlank(sentences)
  const sentence = sentences[at]
  const aligned = !translation
    ? null
    : sentences.length === 1
      ? translation
      : alignMultiSentenceTranslation(sentences, english, at, translation)
  if (size(sentence) <= max) return { zh: sentence, en: aligned }

  // One long sentence: grow the clauses around the blank up to `max` Hanzi, preserving the translation.
  const clauses = clean(sentence.match(/[^，、；：,;:]+[，、；：,;:]*/g), sentence)
  const blankClause = holdsBlank(clauses)
  let lo = blankClause
  let hi = blankClause
  const span = () => clauses.slice(lo, hi + 1).join('')
  for (;;) {
    const after = clauses[hi + 1]
    const before = clauses[lo - 1]
    const canAfter = after !== undefined && size(span() + after) <= max
    const canBefore = before !== undefined && size(before + span()) <= max
    if (!canAfter && !canBefore) break
    if (canAfter && (!canBefore || hi - blankClause <= blankClause - lo)) hi++
    else lo--
  }

  let zh: string
  if (size(span()) > max) {
    zh = sliceLongClauseAroundGap(clauses[blankClause], max)
  } else {
    const text = span().replace(/[，、；：,;:]$/, '')
    zh = `${lo > 0 ? '…' : ''}${text}${hi < clauses.length - 1 ? '…' : ''}`
  }

  let enWindow = aligned
  if (aligned && clauses.length > 1) {
    const enClauses = clean(aligned.match(/[^,;:—–]+[,;:—–]*/g), aligned)
    if (enClauses.length === clauses.length) {
      const text = enClauses.slice(lo, hi + 1).join(' ').replace(/[,;:—–]$/, '')
      enWindow = `${lo > 0 ? '…' : ''}${text}${hi < clauses.length - 1 ? '…' : ''}`
    }
  }
  return { zh, en: enWindow }
}

const INFERRED_POS: Record<string, string> = {
  开玩笑: 'v. phr.',
  购物: 'v.',
  抽烟: 'v.',
  百分之: 'num.',
  不得不: 'aux.',
  上街: 'v.',
  不要紧: 'adj.',
  不好意思: 'adj.',
  遇到: 'v.',
  戒烟: 'v.',
  出汗: 'v.',
  辣子鸡丁: 'n.',
  糖醋鱼: 'n.',
  零下: 'n.',
  甲: 'num.',
  十字路口儿: 'n.',
  看样子: 'phrase',
  岁寒三友: 'n.',
  中国通: 'n.',
  少: 'adj.',
  上菜: 'v.',
  敬酒: 'v.',
  上次: 'n.',
  下次: 'n.',
  对: 'm.',
  双: 'm.',
  副: 'm.',
  刚: 'adv.',
  刚才: 'n.',
  还是: 'adv.',
  或者: 'conj.',
}

function mapSinglePos(token: string): string {
  const p = token.trim().toLowerCase()
  if (!p) return ''
  if (p === 'm.' || p === 'm.w.' || p === 'mw.' || p === 'mw' || p === 'm' || p === 'cl.' || p === 'cl' || p === 'measure word' || p === 'classifier' || p === '量词' || p === '量')
    return t('Classifier')
  if (p === 'num.-m.') return t('Number + classifier')
  if (p === 'num.' || p === 'num' || p === '数词') return t('Number')
  if (p === 'pr.n.' || p === 'pr. n.' || p === 'prop.' || p === 'prop. n.' || p === 'proper noun' || p === '专名')
    return t('Proper noun')
  if (p === 'v. phr.' || p === 'v.o.' || p === 'v. phr') return t('Verb phrase')
  if (p === 'v.' || p === 'v' || p === '动词') return t('Verb')
  if (p === 'n.' || p === 'n' || p === '名词') return t('Noun')
  if (p === 'adj.' || p === 'adj' || p === '形容词') return t('Adjective')
  if (p === 'adv.' || p === 'adv' || p === '副词') return t('Adverb')
  if (p === 'conj.' || p === 'conj' || p === '连词') return t('Conjunction')
  if (p === 'prep.' || p === 'prep' || p === '介词') return t('Preposition')
  if (p === 'pron.' || p === 'pron' || p === '代词') return t('Pronoun')
  if (p === 'part.' || p === 'part' || p === '助词') return t('Particle')
  if (p === 'aux.' || p === 'mod.' || p === 'aux' || p === '助动词' || p === '能愿动词') return t('Auxiliary')
  if (p === 'interj.' || p === 'interj' || p === '叹词') return t('Interjection')
  if (p === 'onom.' || p === 'onom' || p === '拟声词' || p === '象声词') return t('Onomatopoeia')
  if (p === 'pref.' || p === 'pref') return t('Prefix')
  if (p === 'suf.' || p === 'suf') return t('Suffix')
  if (p === 'phrase' || p === '短语' || p === '熟语') return t('Phrase')
  if (p === 'pattern' || p === 'frame' || p === '句式') return t('Sentence pattern')
  return ''
}

/** Human-readable part-of-speech label in the learner's language. */
export function posLabel(pos?: string, zh?: string): string {
  let raw = pos?.trim() ?? ''
  if (!raw && zh) {
    if (zh.includes('……')) raw = 'pattern'
    else raw = INFERRED_POS[zh] ?? ''
  }
  if (!raw) return ''
  const parts = raw.split('/').map(mapSinglePos).filter(Boolean)
  return [...new Set(parts)].join(' / ')
}

export function isClassifierPos(pos?: string): boolean {
  const p = pos?.toLowerCase() ?? ''
  return /\b(m\.?w?\.?|num\.-m\.)\b/.test(p) || p === 'm' || p === 'mw' || p.includes('量词')
}

export function characterCountOf(zh: string): number {
  return Array.from(normalizeChinese(zh)).filter((ch) => HAN.test(ch)).length || Array.from(normalizeChinese(zh)).length
}

export function blankSlots(zh: string): string {
  if (zh.includes('……')) {
    const parts = zh
      .split(/……+/)
      .map((part) => Array.from(normalizeChinese(part)).filter((ch) => HAN.test(ch)).length)
      .filter((len) => len > 0)
    if (parts.length >= 2) return parts.map((len) => GAP.repeat(len)).join(' … ')
  }
  const count = Math.max(1, characterCountOf(zh))
  return GAP.repeat(count)
}

export function slotCountLabel(zh: string): string {
  const n = Math.max(1, characterCountOf(zh))
  return n === 1 ? t('{n} character', { n: 1 }) : t('{n} characters', { n })
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasToneMark = (s: string) => /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ]/i.test(s)
const stripTones = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function hanziVariants(zh: string): string[] {
  const out: string[] = []
  const push = (val: string) => {
    const tVal = val.trim()
    if (tVal && !out.includes(tVal)) out.push(tVal)
  }
  push(zh)
  if (/[()（）]/.test(zh)) {
    push(zh.replace(/[()（）]/g, ''))
    push(zh.replace(/[（(][^）)]*[）)]/g, ''))
  }
  if (zh.includes('……')) {
    for (const part of zh.split(/……+/)) {
      const cleanPart = part.replace(/[()（）\s，。！？,.!?]/g, '').trim()
      if (HAN.test(cleanPart)) push(cleanPart)
    }
  }
  const plain = normalizeChinese(zh)
  if (plain && Array.from(plain).length === 1) push(plain)
  return out.sort((a, b) => b.length - a.length)
}

function stripPinyinLeaks(
  text: string,
  pinyin?: string,
  stripPlainMulti = true,
  inlineReplacement = '',
): string {
  const raw = pinyin?.trim()
  if (!raw) return text
  let out = text
  const syllables = raw.split(/[\s·'-]+/).filter(Boolean)
  const compact = raw.replace(/[\s·'-]+/g, '')

  // 1. Strip parenthetical pinyin markers like `(děi)` or `（yǎnjìngr）` even for short syllables.
  const allForms = [...new Set([raw, compact, stripTones(raw), stripTones(compact)].filter(Boolean))]
  for (const form of allForms) {
    out = out.replace(new RegExp(`[（(]\\s*${escapeRe(form)}\\s*[)）]`, 'gi'), '')
  }

  // 2. Strip any tone-marked pinyin phrase or individual tone-marked syllable unconditionally.
  const toneForms = [raw, compact, ...syllables].filter((f) => hasToneMark(f) && f.length >= 2)
  for (const form of [...new Set(toneForms)].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`(?<![A-Za-zÀ-ž])${escapeRe(form)}(?![A-Za-zÀ-ž])`, 'gi'), inlineReplacement)
  }

  // 3. Strip tone-numbered forms like fa3 lv4 or dui4.
  if (syllables.length > 0) {
    const numbered = syllables.map((s) => `${escapeRe(stripTones(s))}[1-5]?`).join('\\s*')
    if (/[1-5]/.test(numbered) || syllables.length >= 2) {
      out = out.replace(new RegExp(`(?<![A-Za-z])${numbered}(?![A-Za-z])`, 'gi'), (m) =>
        /[1-5]/.test(m) ? inlineReplacement : m,
      )
    }
  }

  // 4. Strip unmarked multi-syllable pinyin (length >= 4) unless disabled.
  if (stripPlainMulti && syllables.length >= 2) {
    const plainPhrase = syllables.map((s) => escapeRe(stripTones(s))).join('[\\s\'-]*')
    const plainCompact = stripTones(compact)
    if (plainCompact.length >= 4) {
      out = out.replace(new RegExp(`(?<![A-Za-z])${plainPhrase}(?![A-Za-z])`, 'gi'), inlineReplacement)
    }
  }

  return out
}

function redactHanziTokens(text: string, word: { zh: string }): string {
  let out = text
  for (const v of hanziVariants(word.zh)) {
    const gap = GAP.repeat(Math.max(1, Array.from(normalizeChinese(v)).length))
    out = out.split(v).join(gap)
  }
  const coreChars = Array.from(normalizeChinese(word.zh)).filter((ch) => HAN.test(ch))
  if (coreChars.length === 1) {
    out = out.split(coreChars[0]).join(GAP)
  }
  return out
}

function redactTranslation(text: string | undefined | null, word: { zh: string; pinyin?: string }): string | null {
  const raw = text?.trim()
  if (!raw) return null
  const out = redactHanziTokens(stripPinyinLeaks(raw, word.pinyin, false, GAP), word)
    .replace(/\(\s*\)|（\s*）/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return out || raw
}

function stripBoilerplateLead(text: string, variants: string[]): string {
  const alt = variants.map(escapeRe).join('|')
  let out = text
  // English boilerplate openings: "Remember X like the word you'll use when ..."
  out = out
    .replace(
      new RegExp(
        `^Remember\\s+(?:${alt})\\s+(?:\\([^)]*\\)\\s+)?(?:like|as)\\s+(?:the\\s+)?(?:word|glue|ending|measure|polite address|school level|choice|phrase|pattern|expression)[^—–:.]*?(?:you[’']ll\\s+(?:use|add)\\s+)?(?:when|if|for|to)\\s+`,
        'i',
      ),
      '',
    )
    .replace(new RegExp(`^Remember\\s+(?:this\\s+)?(?:${alt})\\s+(?:\\([^)]*\\)\\s+)?(?:when|like|as)\\s+`, 'i'), '')
  // Indonesian boilerplate openings: "Inget X sebagai kata yang kamu pakai kalau/waktu/saat ..."
  out = out
    .replace(
      new RegExp(
        `^Inget\\s+(?:${alt})\\s+(?:\\([^)]*\\)\\s+)?sebagai\\s+(?:kata|perekat|kata bantu bilangan|kata ganti|ungkapan|sapaan|pilihan|akhiran)[^—–:.]*?(?:yang\\s+(?:bakal\\s+|akan\\s+)?kamu\\s+(?:pakai|gunakan|tambahin)\\s+)?(?:kalau|waktu|saat|jika|untuk|buat)\\s+`,
        'i',
      ),
      '',
    )
    .replace(new RegExp(`^Inget\\s+(?:${alt})\\s+(?:\\([^)]*\\)\\s+)?(?:waktu|saat|kalau|di)\\s+`, 'i'), '')
  return out
}

const META_ONLY_CUE = /^(Listed under the numbered shengci|Tercatat di bawah|Book headword|Pinyin kata utama)/i

/**
 * Redact a `when` / `usage` / disambiguation cue so neither the target Hanzi nor
 * target Pinyin leaks before the learner answers.
 */
export function redactCue(text: string | undefined | null, word: { zh: string; pinyin?: string }): string {
  const raw = text?.trim()
  if (!raw || META_ONLY_CUE.test(raw)) return ''
  const variants = hanziVariants(word.zh)
  let out = stripBoilerplateLead(raw, variants)
  out = redactHanziTokens(stripPinyinLeaks(out, word.pinyin, true), word)

  out = out
    .replace(/\(\s*\)|（\s*）/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s—–:,;.-]+/, '')
    .trim()

  if (!out || /^＿+\.?$/.test(out)) return ''
  return out.charAt(0).toLocaleUpperCase() + out.slice(1)
}

/** Extract primary and secondary senses, redacting any accidental target Hanzi leak in the gloss. */
export function cleanGloss(gloss: string, word: { zh: string; pinyin?: string }): { core: string; other: string } {
  const scrub = (s: string) => {
    if (!s) return ''
    let out = s
    for (const v of hanziVariants(word.zh)) {
      if (HAN.test(v)) out = out.split(v).join(GAP.repeat(Math.max(1, Array.from(normalizeChinese(v)).length)))
    }
    out = stripPinyinLeaks(out, word.pinyin, false)
    return out.replace(/\s{2,}/g, ' ').trim()
  }
  return {
    core: scrub(coreMeaning(gloss) || gloss),
    other: scrub(otherMeanings(gloss)),
  }
}

const SENSE_STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'as', 'is', 'be', 'do', 'or', 'and',
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'buat', 'ini', 'itu', 'dengan', 'secara', 'pada', 'hal', 'orang',
  'sesuatu', 'kata', 'satuan', 'seseorang', 'benda', 'sudah', 'udah', 'lagi', 'tidak', 'gak', 'nggak',
])

export function normalizedSenses(gloss: string): string[] {
  const raw = gloss
    .replace(/\s*[（(][^）)]*[）)]\s*/gu, ' ')
    .split(/\s*[;,/]\s*/)
    .map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((s) => s.length >= 2 && !SENSE_STOPWORDS.has(s))
  return [...new Set(raw)]
}

function sharesHanziChar(a: string, b: string): boolean {
  const setA = new Set(Array.from(a).filter((ch) => HAN.test(ch)))
  return Array.from(b).some((ch) => setA.has(ch))
}

export function overlappingCorpusPeers(word: { zh: string; en: string }, peers: readonly Vocab[]): Vocab[] {
  const targetSenses = new Set(normalizedSenses(word.en))
  if (!targetSenses.size) return []
  const seen = new Set<string>([normalizeChinese(word.zh)])
  const out: Vocab[] = []
  for (const peer of peers) {
    const normPeer = normalizeChinese(peer.zh)
    if (!normPeer || seen.has(normPeer)) continue
    if (normalizedSenses(peer.en).some((s) => targetSenses.has(s))) {
      seen.add(normPeer)
      out.push(peer)
    }
  }
  return out
}

export function disambiguationCue(
  word: { zh: string; pinyin?: string; pos?: string; en: string },
  peers: readonly Vocab[] = [],
  options: { hiddenPeers?: readonly string[] } = {},
): string | null {
  const lang = getLang() === 'id' ? 'id' : 'en'
  const hidden = new Set((options.hiddenPeers ?? []).map((zh) => normalizeChinese(zh)))
  const curated = synonymEntriesFor(word.zh)
  if (curated.length > 0) {
    const role = curated[0].self[lang]
    const contrasts = [
      ...new Set(
        curated.flatMap((entry) =>
          entry.cluster.members
            .filter((m) => m.zh !== word.zh && !hidden.has(normalizeChinese(m.zh)) && !sharesHanziChar(m.zh, word.zh))
            .map((m) => m.zh),
        ),
      ),
    ].slice(0, 3)
    const note = contrasts.length
      ? `${role}. ${t('Different nuance from: {peers}', { peers: contrasts.join(' / ') })}`
      : role
    return redactCue(note, word) || null
  }

  const overlaps = overlappingCorpusPeers(word, peers)
  if (!overlaps.length) return null
  const safeContrasts = overlaps
    .filter((p) => !hidden.has(normalizeChinese(p.zh)) && !sharesHanziChar(p.zh, word.zh))
    .slice(0, 3)
    .map((p) => p.zh)
  const pos = posLabel(word.pos, word.zh)
  const sizeLabel = slotCountLabel(word.zh)
  const lead = pos ? t('Use a {pos} ({size}) here.', { pos, size: sizeLabel }) : ''
  const diff = safeContrasts.length ? t('Different nuance from: {peers}', { peers: safeContrasts.join(' / ') }) : ''
  const combined = [lead, diff].filter(Boolean).join(' ')
  return combined ? redactCue(combined, word) || null : null
}

export interface RecallPromptContext {
  coreMeaning: string
  otherMeanings: string
  posLabel: string
  charCount: number
  charCountLabel: string
  slots: string
  sentence: ContextLine | null
  whenCue: string | null
  disambiguation: string | null
  isAmbiguous: boolean
}

export function buildRecallPromptContext({
  word,
  blanked,
  peers = [],
  hiddenPeers = [],
  hideMeaning = false,
}: {
  word: Vocab
  blanked: { blank: string; en?: string | null } | null
  peers?: readonly Vocab[]
  hiddenPeers?: readonly string[]
  hideMeaning?: boolean
}): RecallPromptContext {
  const { core, other } = hideMeaning ? { core: '', other: '' } : cleanGloss(word.en, word)
  const pos = posLabel(word.pos, word.zh)
  const charCount = characterCountOf(word.zh)
  const charCountLabel = slotCountLabel(word.zh)
  const slots = blankSlots(word.zh)
  const rawSentence = blanked ? contextWindow(blanked.blank, blanked.en) : null
  const sentence = rawSentence
    ? {
        zh: redactHanziTokens(rawSentence.zh, word),
        en: redactTranslation(rawSentence.en, word),
      }
    : null
  const disambiguation = hideMeaning ? null : disambiguationCue(word, peers, { hiddenPeers })
  const rawWhen = redactCue(word.when, word) || redactCue(word.usage, word) || redactCue(word.note, word)
  const isAmbiguous = Boolean(
    !sentence ||
      disambiguation ||
      charCount === 1 ||
      isClassifierPos(word.pos) ||
      (sentence && size(sentence.zh) < 10) ||
      other.length > 0,
  )
  const whenCue = !hideMeaning && rawWhen && (!sentence || isAmbiguous) ? rawWhen : null

  return {
    coreMeaning: core,
    otherMeanings: other,
    posLabel: pos,
    charCount,
    charCountLabel,
    slots,
    sentence,
    whenCue,
    disambiguation,
    isAmbiguous,
  }
}

export interface NearSynonymMatch {
  typedZh: string
  typedMeaning: string
  message: string
}

/**
 * Detect whether a learner's wrong Hanzi input is actually a valid near-synonym
 * (e.g., typing 双/副 when asked for 对, or 刚才 for 刚), and return an empathetic,
 * zero-leak explanation of why the target word fits this context.
 */
export function nearSynonymFeedback(
  typed: string,
  target: Vocab,
  peers: readonly Vocab[] = [],
): NearSynonymMatch | null {
  const normTyped = normalizeChinese(typed)
  const normTarget = normalizeChinese(target.zh)
  if (!normTyped || normTyped === normTarget) return null

  const lang = getLang() === 'id' ? 'id' : 'en'
  const pos = posLabel(target.pos, target.zh)
  const sizeLabel = slotCountLabel(target.zh)
  const curated = synonymEntriesFor(target.zh)

  // 1. Check curated confusion clusters first (covers both corpus and common non-corpus synonyms like 两/二/刚才/合适).
  for (const entry of curated) {
    const matched = entry.cluster.members.find((m) => normalizeChinese(m.zh) === normTyped && m.zh !== target.zh)
    if (!matched) continue
    const peerInfo = peers.find((p) => normalizeChinese(p.zh) === normTyped)
    const typedMeaning = peerInfo ? coreMeaning(peerInfo.en) || peerInfo.en : matched[lang]
    const targetRole = redactCue(entry.self[lang], target)
    const safeTyped = sharesHanziChar(matched.zh, target.zh)
    const message = safeTyped
      ? pos
        ? t('Your answer ({meaning}) is close, but this context uses a {pos} ({size}): {cue}', {
            meaning: typedMeaning,
            pos,
            size: sizeLabel,
            cue: targetRole,
          })
        : t('Your answer ({meaning}) is close, but this context needs a different {size} word: {cue}', {
            meaning: typedMeaning,
            size: sizeLabel,
            cue: targetRole,
          })
      : pos
        ? t('“{typed}” ({meaning}) is close, but this context uses a {pos} ({size}): {cue}', {
            typed: matched.zh,
            meaning: typedMeaning,
            pos,
            size: sizeLabel,
            cue: targetRole,
          })
        : t('“{typed}” ({meaning}) is close, but this context needs a different {size} word: {cue}', {
            typed: matched.zh,
            meaning: typedMeaning,
            size: sizeLabel,
            cue: targetRole,
          })
    return {
      typedZh: matched.zh,
      typedMeaning,
      message: redactCue(message, target) || message,
    }
  }

  // 2. Check dynamic corpus sense overlaps.
  const overlap = overlappingCorpusPeers(target, peers).find((p) => normalizeChinese(p.zh) === normTyped)
  if (!overlap) return null
  const typedMeaning = coreMeaning(overlap.en) || overlap.en
  const targetCue =
    redactCue(target.when, target) ||
    redactCue(target.usage, target) ||
    disambiguationCue(target, peers, { hiddenPeers: [overlap.zh] })
  const safeTyped = sharesHanziChar(overlap.zh, target.zh)
  const message = targetCue
    ? safeTyped
      ? pos
        ? t('Your answer ({meaning}) is close, but this context uses a {pos} ({size}): {cue}', {
            meaning: typedMeaning,
            pos,
            size: sizeLabel,
            cue: targetCue,
          })
        : t('Your answer ({meaning}) is close, but this context needs a different {size} word: {cue}', {
            meaning: typedMeaning,
            size: sizeLabel,
            cue: targetCue,
          })
      : pos
        ? t('“{typed}” ({meaning}) is close, but this context uses a {pos} ({size}): {cue}', {
            typed: overlap.zh,
            meaning: typedMeaning,
            pos,
            size: sizeLabel,
            cue: targetCue,
          })
        : t('“{typed}” ({meaning}) is close, but this context needs a different {size} word: {cue}', {
            typed: overlap.zh,
            meaning: typedMeaning,
            size: sizeLabel,
            cue: targetCue,
          })
    : safeTyped
      ? pos
        ? t('Your answer is close in meaning, but this context needs a {pos} ({size}). Try another word.', {
            pos,
            size: sizeLabel,
          })
        : t('Your answer is close in meaning, but this context needs a different {size} word. Try another word.', {
            size: sizeLabel,
          })
      : pos
        ? t('“{typed}” is close in meaning, but this context needs a {pos} ({size}). Try another word.', {
            typed: overlap.zh,
            pos,
            size: sizeLabel,
          })
        : t('“{typed}” is close in meaning, but this context needs a different {size} word. Try another word.', {
            typed: overlap.zh,
            size: sizeLabel,
          })

  return {
    typedZh: overlap.zh,
    typedMeaning,
    message: redactCue(message, target) || message,
  }
}
