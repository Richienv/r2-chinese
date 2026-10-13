import { t } from '../i18n.ts'
import type { Hit, RuleDefinition, TransferRuleId } from './types.ts'
import { clause, each, hit, re } from './rule-kit.ts'
import {
  ADJECTIVES, ADVERB_AFTER_VERBS, BEFORE_VERB, CITIES, COMPARISON_STOP, DATE_PART, DE_MISSING_DEGREE, DE_MISSING_QUALITIES, DE_MISSING_VERBS,
  HAN, IDENTITY_NOUNS, INTEREST_TOPICS, MEASURE_MISSING, TOGETHER_LONG, TOGETHER_SINGLE, WORD_END, alternation,
} from './tables.ts'

/**
 * The mistakes that come from translating word for word out of Indonesian or English. "Kami makan bersama" becomes
 * 我们吃饭一起, "saya tertarik pada musik" becomes 我感兴趣音乐, and "10 Oktober 2026" becomes 10号十月2026年.
 * Same discipline as the core rules: closed lists, a fix wherever one is certain, silence otherwise.
 */
export function createTransferRules(adjective: string): { readonly [K in TransferRuleId]: RuleDefinition } {
  const dateRun = re(`(?:${DATE_PART}){2,3}`)
  const dateParts = re(DATE_PART)
  const rank = (part: string) => (part.endsWith('年') ? 0 : part.endsWith('月') ? 1 : 2)

  const apart = `((?:(?![在和跟与同的了])${HAN}){0,4}?)`
  const togetherLong = re(`(${alternation(TOGETHER_LONG)})${apart}一起(?=$|[吧吗呢啊])`)
  const togetherSingle = re(`${BEFORE_VERB}(${alternation(TOGETHER_SINGLE)})${apart}一起(?=$|[吧吗呢啊])`)

  const deMissing = re(`${BEFORE_VERB}(${alternation(DE_MISSING_VERBS)})(${alternation(DE_MISSING_DEGREE)})(${alternation(DE_MISSING_QUALITIES)})(?=$|[吧呢啊了吗])`)

  const interest = re(`(我们|你们|他们|她们|我|你|他|她|它)(很|非常|特别|十分|比较|挺)?感兴趣(${alternation(INTEREST_TOPICS)})(?=$|[吗呢吧啊])`)

  const stackedHen = re(`(很)(非常|十分|相当|挺)(?=(?:${adjective}))`)
  const stackedOther = re(`(非常|十分|相当|挺|特别)(很)(?=(?:${adjective}))`)

  const cityLi = re(`在(${alternation(CITIES)})(里面|里头|里)`)

  const adverbAfter = re(`(?<=[我你他她它们咱])(${alternation(ADVERB_AFTER_VERBS)})(也|都)(?=$|[吗呢吧啊])`)

  const identity = re(`(?<=[我你他她它们咱])不(?=${alternation(IDENTITY_NOUNS)}${WORD_END})`)
  const possessive = re('(?<=[我你他她它们咱])不(?=[我你他她它]们?的)')

  // Core adjectives only: course vocabulary has 一定 (adj.), and 不一定比北京暖和 is correct.
  const adjectiveBeforeBi = alternation(ADJECTIVES.filter((word) => word !== '好'))
  const biOrder = re(`(更|还|比较)?(${adjectiveBeforeBi})比${COMPARISON_STOP}(${HAN}{1,4})(?=$|[吧吗呢啊])`)

  const measureMissing = new Map(MEASURE_MISSING)
  const missing = re(`(?<![第同])([二两三四五六七八九十]|十[一二三四五六七八九]|二十[一二三四五六七八九]?|几)(${alternation(measureMissing.keys())})${WORD_END}`)

  return {
    'date-order': clause('error', (unit) => {
      const hits: Hit[] = []
      for (const match of unit.text.matchAll(dateRun)) {
        const parts = match[0].match(dateParts) ?? []
        const ranks = parts.map(rank)
        if (ranks.every((value, index) => index === 0 || value > ranks[index - 1])) continue
        const distinct = new Set(ranks).size === ranks.length
        const fixed = distinct ? [...parts].sort((a, b) => rank(a) - rank(b)).join('') : null
        hits.push(hit(unit, match.index ?? 0, match[0].length, fixed, t('year · month · day'),
          t('Chinese dates go from big to small: year, month, day, like 2026年10月8号. Indonesian dates start with the day, which does not work here.')))
      }
      return hits
    }),

    'together-after-verb': clause('error', (unit) => {
      const found = (match: RegExpMatchArray, index: number) => {
        const [whole, verb, between] = match
        return hit(unit, index, whole.length, `一起${verb}${between}`, t('一起 + verb'),
          t('一起 goes before the verb: 我们一起{verb}, not 我们{verb}一起. Indonesian puts “bersama” after the verb; Chinese puts 一起 in front of it.', { verb }))
      }
      return [...each(unit, togetherLong, found), ...each(unit, togetherSingle, found)]
    }),

    'de-missing': clause('error', (unit) =>
      each(unit, deMissing, (match, index) => {
        const [whole, verb, degree, quality] = match
        return hit(unit, index, whole.length, `${verb}得${degree}${quality}`, t('verb + 得 + how well'),
          t('To say how well or how fast an action is done, 得 must come right after the verb: {verb}得{degree}{quality}. Without it the sentence breaks.', { verb, degree, quality }))
      })),

    'ganxingqu-order': clause('error', (unit) =>
      each(unit, interest, (match, index) => {
        const [whole, who, degree = '', topic] = match
        return hit(unit, index, whole.length, `${who}对${topic}${degree}感兴趣`, t('subject + 对 + topic + 感兴趣'),
          t('The topic of interest goes between 对 and 感兴趣: {who}对{topic}{degree}感兴趣. 感兴趣 cannot take the topic right after it.', { who, topic, degree }))
      })),

    'double-degree': clause('error', (unit) => {
      const found = (match: RegExpMatchArray, index: number) => {
        const keep = match[1] === '很' ? match[2] : match[1]
        return hit(unit, index, match[0].length, keep, t('one degree word'),
          t('Use one degree word before an adjective, not two: {keep}好, not {both}好.', { keep, both: match[0] }))
      }
      return [...each(unit, stackedHen, found), ...each(unit, stackedOther, found)]
    }),

    'place-li': clause('error', (unit) =>
      each(unit, cityLi, (match, index) => {
        const [whole, city, inside] = match
        return hit(unit, index, whole.length, `在${city}`, t('在 + city'),
          t('A city or country takes 在 alone: 在{city}. 里 means “inside” a container or building, like 在家里 and 在学校里.', { city }),
          inside === '里' ? 'error' : 'check')
      })),

    'adverb-after-verb': clause('error', (unit) =>
      each(unit, adverbAfter, (match, index) => {
        const [whole, verb, adverb] = match
        return hit(unit, index, whole.length, `${adverb}${verb}`, t('subject + 也/都 + verb'),
          t('也 and 都 go before the verb, never after it: 我{adverb}{verb}, not 我{verb}{adverb}.', { adverb, verb }))
      })),

    'bu-shi-missing': clause('error', (unit) => {
      const fix = (_match: RegExpMatchArray, index: number) => hit(unit, index, 1, '不是', t('不是 + noun'),
        t('To say someone is not a person or a thing, use 不是: 我不是学生. 不 alone does not link two nouns, because it only negates what follows it.'))
      return [...each(unit, identity, fix), ...each(unit, possessive, fix)]
    }),

    'bi-order': clause('error', (unit) =>
      each(unit, biOrder, (match, index) => {
        const [whole, more = '', adjectiveWord, other] = match
        return hit(unit, index, whole.length, `比${other}${more}${adjectiveWord}`, t('A 比 B + adjective'),
          t('The thing you compare with comes right after 比, then the adjective: 我比{other}{adjective}. Indonesian puts “than him” last; Chinese puts it first.', { other, adjective: `${more}${adjectiveWord}` }))
      })),

    'measure-missing': clause('error', (unit) =>
      each(unit, missing, (match, index) => {
        const [whole, number, noun] = match
        if (number === '四' && noun === '书') return null
        const measure = measureMissing.get(noun) ?? '个'
        return hit(unit, index, whole.length, `${number}${measure}${noun}`, t('number + measure word + noun'),
          t('A number needs a measure word before the noun: {number}{measure}{noun}. Indonesian can say “tiga buku”; Chinese cannot say 三书.', { number, measure, noun }))
      })),
  }
}
