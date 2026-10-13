import { t } from '../i18n.ts'
import type { Hit, Lexicon, RuleSet, Severity, TransferRuleId } from './types.ts'
import { clause, each, hit, re, sentence } from './rule-kit.ts'
import { createTransferRules } from './rules-transfer.ts'
import {
  ACTION_VERBS, ACTION_VERBS_SINGLE, ADJECTIVES, ASK_TIME, BA_VERBS, BEFORE_VERB, DE_QUALITIES, DE_VERBS_AMBIGUOUS, DE_VERBS_CLEAR, DEGREE,
  DEGREE_STACK_ADJ, DURATION, EMBEDDING_VERBS, FEELING_VERBS, HABIT_WORDS, HAN, LONG_MOVE_VERBS, MEASURE_NOUNS, MOVE_VERBS, NEGATED_VERBS, NO_LONGER,
  PAST_MARKERS, PLACE_BREAK, PLACE_TAIL, PLACES, SHI_EXEMPT, TIME_WORDS, VERB_OBJECT_DE_OBJECTS, VERB_OBJECT_DE_VERBS, WORD_END, alternation,
} from './tables.ts'

/**
 * Every rule, built once per lexicon. Each one looks for a single shape of mistake and says nothing otherwise.
 * The return type makes the compiler check that every RuleId is defined and nothing else is.
 */
export function createRules(lexicon: Lexicon): RuleSet {
  const adjectives = new Set<string>([...ADJECTIVES, ...lexicon.adjectives])
  const adjective = alternation(adjectives)
  const adjectiveAfterShi = alternation([...adjectives].filter((word) => !SHI_EXEMPT.has(word)))
  const degree = alternation(DEGREE)
  const places = alternation(PLACES)
  const time = alternation([...TIME_WORDS, ...HABIT_WORDS])

  const placeAfterLong = re(`(${alternation(ACTION_VERBS)})在(${places})${PLACE_TAIL}${PLACE_BREAK}`)
  const placeAfterSingle = re(`${BEFORE_VERB}(${alternation(ACTION_VERBS_SINGLE)})在(${places})${PLACE_TAIL}${PLACE_BREAK}`)

  const timeGap = `((?:(?!${time}|[的了过着是在到从至于])${HAN})`
  const timeSequence = `((?:${time})+)`
  const timeAfterLong = re(`(${alternation(LONG_MOVE_VERBS)})${timeGap}{0,6}?)${timeSequence}$`)
  const timeAfterSingle = re(`${BEFORE_VERB}(${alternation(MOVE_VERBS)})${timeGap}{1,6}?)${timeSequence}$`)
  const ask = alternation(ASK_TIME)
  const askAfterLong = re(`(${alternation(LONG_MOVE_VERBS)})${timeGap}{0,6}?)(${ask})$`)
  const askAfterSingle = re(`${BEFORE_VERB}(${alternation(MOVE_VERBS)})${timeGap}{0,6}?)(${ask})$`)

  const bi = '比(?!如|较|赛|方|喻|例|率|分)'
  const biGap = `((?:(?![的是有吗])${HAN}){1,6}?)`

  const baVerb = alternation(BA_VERBS)
  const measureNouns = new Map(MEASURE_NOUNS.map((entry) => [entry.noun, entry]))
  const measure = re(`(?<![这那哪每第])[一二两三四五六七八九十百几]+(个)(${alternation(measureNouns.keys())})${WORD_END}`)

  const henAfterAdjective = re(`(${adjective})很(?=$|[吗呢吧啊的了嘛])`)
  const biHen = re(`${bi}${biGap}(很|非常|特别|十分|挺|太|真)(?!多|少|久)(?=(?:${adjective}))`)
  const biBu = re(`${bi}${biGap}不(?=(?:${adjective}))`)
  const shiAdjective = re(`(?<=[我你他她它们])是(${degree})?(${adjectiveAfterShi})(?=$|[吗呢吧啊])`)
  const noLonger = new RegExp(`${NO_LONGER.join('|')}|${DURATION}没`, 'u')
  const pastMarker = new RegExp(PAST_MARKERS.join('|'), 'u')
  const embedding = new RegExp(alternation(EMBEDDING_VERBS), 'u')
  const aNotA = re(`(${HAN}{1,3})[不没]\\1`)

  const deClear = re(`${BEFORE_VERB}(${alternation(DE_VERBS_CLEAR)})(的)((?:${degree})?(?:${alternation(DE_QUALITIES)}))(?=$|[吧呢啊了吗])`)
  const deAmbiguous = re(`${BEFORE_VERB}(${alternation(DE_VERBS_AMBIGUOUS)})(的)((?:${degree})?(?:${alternation(DE_QUALITIES)}))(?=$|[吧呢啊了吗])`)

  const core = {
    'place-after-verb': clause('error', (unit) => {
      const found = (match: RegExpMatchArray, index: number) => {
        const [whole, verb, place] = match
        const tail = whole.slice(verb.length + 1 + place.length)
        return hit(unit, index, whole.length, `在${place}${tail}${verb}`, t('在 + place + verb'),
          t('In Mandarin the place comes before the action: 在{place}{verb}. 在 after the verb is only for verbs like 住, 坐, 放 and 站.', { place: `${place}${tail}`, verb }))
      }
      return [...each(unit, placeAfterLong, found), ...each(unit, placeAfterSingle, found)]
    }),

    'time-after-verb': clause('check', (unit) => {
      const found = (asking: boolean) => (match: RegExpMatchArray, index: number) => {
        const [whole, verb, gap, when] = match
        // The lookbehind consumed nothing, so the verb starts exactly where the match does.
        return hit(unit, index, whole.length, `${when}${verb}${gap}`, t('time + verb'), asking
          ? t('A question about time goes before the verb too: 你{when}{verb}. Indonesian puts “kapan” last; Chinese puts it right after the subject.', { when, verb })
          : t('A time word such as {time} goes before the verb, right after the subject, not at the end of the sentence.', { time: when }),
        asking ? 'error' : 'check')
      }
      return [
        ...each(unit, timeAfterLong, found(false)), ...each(unit, timeAfterSingle, found(false)),
        ...each(unit, askAfterLong, found(true)), ...each(unit, askAfterSingle, found(true)),
      ]
    }),

    'hen-after-adj': clause('error', (unit) =>
      each(unit, henAfterAdjective, (match, index) => hit(unit, index, match[0].length, `很${match[1]}`, t('很 + adjective'),
        t('The degree word goes before the adjective: 很{adj}, not {adj}很.', { adj: match[1] })))),

    'degree-after-verb': clause('error', (unit) =>
      each(unit, re(`(${alternation(FEELING_VERBS)})(很|非常|特别|十分|太)(?=$|[吗呢吧啊的了])`), (match, index) =>
        hit(unit, index, match[0].length, `${match[2]}${match[1]}`, t('很 + feeling verb'),
          t('With a feeling verb like {verb}, the degree word goes in front: {degree}{verb}.', { verb: match[1], degree: match[2] })))),

    'bi-hen': clause('error', (unit) =>
      each(unit, biHen, (match, index) => {
        const offset = index + 1 + match[1].length
        return hit(unit, offset, match[2].length, '', t('A 比 B + adjective'),
          t('In a 比 sentence the adjective stands alone. 很 can’t follow 比; to say “even more” use 更 or 还 (他比我更高), or say how much with 一点 or 得多.'))
      })),

    'bi-bu': clause('check', (unit) =>
      each(unit, biBu, (match, index) =>
        hit(unit, index + 1 + match[1].length, 1, null, t('A 没有 B + adjective'),
          t('To say “not as … as”, use 没有 (他没有我高), or put 不 before 比 (他不比我高). 比 … 不 + adjective is not a standard pattern.')))),

    'shi-adj': clause('error', (unit) =>
      each(unit, shiAdjective, (match, index) =>
        hit(unit, index, 1, match[1] ? '' : '很', t('subject + 很 + adjective'),
          t('An adjective works as the predicate by itself, usually with 很. Don’t put 是 in front of it: 是 links nouns.')))),

    'shi-age': clause('check', (unit) =>
      each(unit, re('(?<=[我你他她它们])是[一二两三四五六七八九十零\\d]+岁(?![的以左多])'), (_match, index) =>
        hit(unit, index, 1, '', t('subject + number + 岁'),
          t('Age needs no 是: say 我二十岁 or 我今年二十岁.')))),

    'meiyou-le': clause('check', (unit) => {
      // "No longer" (再也没来了) and "for N days I haven't" (三天没吃饭了) are correct with a final 了.
      if (noLonger.test(unit.text)) return []
      const past = pastMarker.test(unit.text)
      const verb = alternation(NEGATED_VERBS)
      const why = t('没(有) already says the action did not happen, so it does not take 了. Leave 了 out.')
      const pattern = t('没(有) + verb, no 了')
      return [
        ...each(unit, re(`没(?:有)?(${verb})((?:(?![了的过着])${HAN}){0,4}?)(了)(?=$|[吗呢吧啊嘛])`), (match, index) =>
          hit(unit, index + match[0].length - 1, 1, '', pattern, why, past ? 'error' : 'check')),
        // 没有去了面试: 了 straight after the verb, with the object still to come. 去了解 is a word, so it is left alone.
        ...each(unit, re(`没(?:有)?(${verb})(了)(?![解结得])(?=${HAN})`), (match, index) =>
          hit(unit, index + match[0].length - 1, 1, '', pattern, why, 'error')),
      ]
    }),

    'negation-choice': clause('error', (unit) => [
      ...each(unit, re('不有(?![名所关限])'), (_match, index) => hit(unit, index, 2, '没有', t('没有, not 不有'),
        t('“Have” is negated with 没: 没有. 不有 is not used.'))),
      ...each(unit, re('没是'), (_match, index) => hit(unit, index, 2, '不是', t('不是, not 没是'),
        t('是 is negated with 不: 不是. 没 negates having or something that happened.'))),
      ...each(unit, re(`不(${alternation(['去', '来', '吃', '看', '学', '做', '听', '见', '到', '买', '喝', '说', '写', '试', '玩', '坐', '读', '住'])})过(?![去来程期年节份分敏关头度界渡桥路河街])`), (match, index) =>
        hit(unit, index, 1, '没', t('没(有) + verb + 过'),
          t('To say you have never done something, use 没(有) + verb + 过: 没{verb}过. 不 is for habits, wishes and the future.', { verb: match[1] }))),
    ]),

    'you-guo': clause('check', (unit) =>
      each(unit, re(`(?<![只还没才就所拥具共])有(?=(?:${alternation(['去', '来', '吃', '看', '学', '做', '听', '见', '到', '买', '喝', '说', '写', '试', '玩', '坐', '读', '住', '爱'])})过)`), (_match, index) =>
        hit(unit, index, 1, '', t('verb + 过'),
          t('To say you have done something before, use the verb + 过 directly: 我去过北京. 有 + verb + 过 is heard in some regions but is not standard Mandarin.')))),

    'ma-question-double': sentence('error', (unit) => {
      const particle = re('吗(?=$|[”’」』"\')）\\s])')
      const hits: Hit[] = []
      for (const ma of unit.text.matchAll(particle)) {
        const before = unit.text.slice(0, ma.index)
        const form = [...before.matchAll(aNotA)].find((candidate) => !embedding.test(before.slice(0, candidate.index ?? 0)))
        if (form) hits.push(hit(unit, ma.index ?? 0, 1, '', t('A-not-A question, or 吗'),
          t('A question that already has the A-not-A form ({form}) does not also take 吗. Use one or the other.', { form: form[0] })))
      }
      return hits
    }),

    'question-or': sentence('check', (unit) => {
      if (!/^[？?]/u.test(unit.terminator) || /吗/u.test(unit.text)) return []
      return each(unit, re('或者'), (_match, index) => hit(unit, index, 2, '还是', t('还是 in a question'),
        t('In a question that offers a choice, use 还是. 或者 is for statements: 他喝茶或者咖啡。')))
    }),

    'er-liang': clause('error', (unit) =>
      each(unit, re('(?<![一二三四五六七八九十零百千万亿第周期礼拜月号\\d])二(?=(?:个|本|张|件|只|条|辆|杯|瓶|台|把|间|双|种|家|顿))'), (_match, index) =>
        hit(unit, index, 1, '两', t('两 + measure word'),
          t('Before a measure word, “two” is 两, not 二: 两个, 两本.')))),

    'men-plural': clause('error', (unit) =>
      each(unit, re(`(?:[二两三四五六七八九十几]|很多|许多|不少)(?:个|位|名)?((?![我你他她它咱])${HAN}{1,3})们`), (match, index) =>
        hit(unit, index + match[0].length - 1, 1, '', t('number + noun, without 们'),
          t('A noun after a number or “many” is already plural, so it takes no 们: {phrase}.', { phrase: match[0].slice(0, -1) })))),

    'measure-word': clause('error', (unit) =>
      each(unit, measure, (match, index) => {
        const entry = measureNouns.get(match[2])
        if (!entry) return null
        const at = index + match[0].length - match[2].length - 1
        const pattern = t('number + {measure} + {noun}', { measure: entry.measure, noun: entry.noun })
        return entry.informal
          ? hit(unit, at, 1, entry.measure, pattern, t('个 works in everyday speech, but the measure word books and the HSK use for {noun} is {measure}.', { noun: entry.noun, measure: entry.measure }), 'check')
          : hit(unit, at, 1, entry.measure, pattern, t('{noun} takes the measure word {measure}, not 个.', { noun: entry.noun, measure: entry.measure }))
      })),

    'de-for-de': clause('error', (unit) => {
      const swap = (match: RegExpMatchArray, index: number, severity: Severity) => {
        const [, verb, , quality] = match
        return hit(unit, index + verb.length, 1, '得', t('verb + 得 + how well'), severity === 'error'
          ? t('To say how well or how fast an action is done, put 得 after the verb: {verb}得{quality}. 的 builds a noun phrase.', { verb, quality })
          : t('If you mean how well they {verb}, use 得: {verb}得{quality}. If you mean “what they {verb}”, 的 is right.', { verb, quality }), severity)
      }
      return [...each(unit, deClear, (match, index) => swap(match, index, 'error')), ...each(unit, deAmbiguous, (match, index) => swap(match, index, 'check'))]
    }),

    'verb-object-de': clause('error', (unit) =>
      each(unit, re(`(${alternation(VERB_OBJECT_DE_VERBS)})(${alternation(VERB_OBJECT_DE_OBJECTS)})得(?=很|非常|特别|十分|挺|相当|太|真)`), (match, index) =>
        hit(unit, index, match[0].length, `${match[1]}${match[2]}${match[1]}得`, t('verb + object + verb + 得'),
          t('When the verb has an object, say the verb again before 得: {verb}{object}{verb}得…. You can also put the object first: {object}{verb}得….', { verb: match[1], object: match[2] })))),

    'repeated-word': clause('error', (unit) =>
      each(unit, re('的的(?!确)|吗吗|很很|(?<![明不])了了(?![无之])'), (match, index) =>
        hit(unit, index, 2, match[0][0], t('one word, once'), t('{word} is typed twice. Keep one.', { word: match[0] })))),

    'zai-zai': clause('error', (unit) => [
      ...each(unit, re(`再(?=(?:${alternation(PLACES.filter((place) => !['外面', '里面', '楼上', '楼下'].includes(place)))})${PLACE_BREAK})`), (_match, index) =>
        hit(unit, index, 1, '在', t('在 + place'), t('再 means “again”. To say where something happens, use 在: 在家, 在学校.'))),
      ...each(unit, re('(?<=^|明天|后天|下次|以后|晚上|下周|回头|待会儿|一会儿)在见(?=$|[！!。，,\\s…])'), (_match, index) =>
        hit(unit, index, 2, '再见', t('再见'), t('“Goodbye” is 再见: 再 (again) + 见 (see).'))),
    ]),

    'degree-stack': clause('error', (unit) => {
      const stacked = alternation(DEGREE_STACK_ADJ)
      return [
        ...each(unit, re(`(很|非常|太|十分)(有(?:一)?点(?:儿)?)(?=${stacked})`), (match, index) =>
          hit(unit, index, match[0].length, match[2], t('有点 + adjective'), t('有点 already means “a bit too …”, so it takes no degree word in front: 有点累, not {wrong}累.', { wrong: match[0] }))),
        ...each(unit, re(`(有(?:一)?点(?:儿)?)(很|非常|太|十分)(?=${stacked})`), (match, index) =>
          hit(unit, index, match[0].length, match[1], t('有点 + adjective'), t('有点 already means “a bit too …”, so it takes no degree word after it: 有点累, not {wrong}累.', { wrong: match[0] }))),
      ]
    }),

    'ba-bare-verb': clause('check', (unit) =>
      each(unit, re(`(?<![一二两三四五六七八九十几每这那半])把(?![握手柄关守持式])((?:(?![把被了的]|${baVerb})${HAN}){1,5}?)(?<!一)(${baVerb})(?=$|[吗呢吧啊嘛])`), (match, index) =>
        hit(unit, index, match[0].length, null, t('把 + object + verb + result'),
          t('A 把 sentence must say what happens to the object. Add a result or 了 after the verb: 把{object}{verb}完 or 把{object}{verb}了.', { object: match[1], verb: match[2] })))),

    'conjunction-pair': sentence('check', (unit) => {
      const opening = unit.text.match(/^[^，,。]{0,6}?(虽然|因为)/u)
      if (!opening) return []
      if (opening[1] === '虽然') {
        const so = unit.text.indexOf('所以')
        if (so < 0 || /但|可是|却|不过|然而|还是|仍然/u.test(unit.text)) return []
        return [hit(unit, so, 2, '但是', t('虽然 … 但是 …'), t('虽然 pairs with 但是 (or 可是): “although … but …”. 所以 means “so”.'))]
      }
      const but = unit.text.search(/但是|可是/u)
      if (but < 0 || /所以|因此/u.test(unit.text)) return []
      return [hit(unit, but, 2, null, t('因为 … 所以 …'), t('因为 pairs with 所以: “because … so …”. 但是 starts a contrast, which does not follow “because”.'))]
    }),
  } satisfies Omit<RuleSet, TransferRuleId>

  return { ...core, ...createTransferRules(adjective) }
}
