import { t } from './i18n.ts'

export interface GrammarCoachInput {
  expectedZh: string
  expectedEn?: string
  response?: string
  grammar?: string
}

export interface GrammarCoachPart {
  text: string
  role: string
  reason: string
}

export interface GrammarCoachObservation {
  kind: 'particle' | 'word' | 'order'
  text: string
  reason: string
}

/** Coaching describes the source structure; it is never an assessment verdict. */
export interface GrammarCoach {
  pattern: string
  summary: string
  parts: GrammarCoachPart[]
  example: { zh: string; en?: string }
  observations: GrammarCoachObservation[]
}

type Candidate = Omit<GrammarCoach, 'example' | 'observations'> & { priority: number }
const part = (text: string, role: string, reason: string): GrammarCoachPart => ({ text, role, reason })
const compact = (value: string) => value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '')
const clauses = (value: string) => value.normalize('NFKC').split(/[，。！？；,.!?;]/u).map((clause) => clause.trim()).filter(Boolean)

function observationsFor(source: string, response: string): GrammarCoachObservation[] {
  if (!response.trim()) return []
  const result: GrammarCoachObservation[] = []
  const reference = compact(source)
  const actual = compact(response)
  if (reference.includes('法律') && actual.includes('法录') && !actual.includes('法律')) {
    result.push({ kind: 'word', text: '法录 → 法律', reason: t('The source uses 法律 (fǎlǜ) for “law”. 法录 has different Hanzi. If this came from speech, check the recognized spelling before drawing a conclusion about your grammar.') })
  }
  // A bare 半 elsewhere (半天, 一点半) is valid and is never treated as 班.
  if (reference.includes('一个班') && actual.includes('一个半') && !actual.includes('一个班')) {
    result.push({ kind: 'word', text: '一个半 → 一个班', reason: t('Here the book means “the same class”: 班 (bān), not 半 (bàn, “half”). Check the Hanzi and the intended meaning; this comparison does not judge a different sentence using 半.') })
  }
  for (const verb of ['踢', '说', '写', '做', '学', '唱', '跑', '吃', '睡', '玩']) {
    if (!reference.includes(`${verb}得`) || actual.includes(`${verb}得`)) continue
    // Restrict feedback to a completed quality phrase. 踢的好球 is an
    // attributive noun phrase, so substring matching would give a false error.
    const mistaken = new RegExp(`${verb}的((?:很|非常|太|那么|这么|真)?(?:好|不错|快|慢|清楚|认真|流利))(?=$|[，。！？；,.!?;\\s])`, 'u')
    let quality = response.match(mistaken)?.[1]
    // ASR may omit every comma. Require the same following source fragment;
    // this still excludes noun phrases such as 踢的好球.
    if (!quality) {
      const inSource = source.match(new RegExp(`${verb}得((?:很|非常|太|那么|这么|真)?(?:好|不错|快|慢|清楚|认真|流利))(?=[，。！？；,.!?;\\s]|$)`, 'u'))
      if (inSource?.index !== undefined) {
        const following = compact(source.slice(inSource.index + inSource[0].length)).slice(0, 3)
        if (following && actual.includes(`${verb}的${inSource[1]}${following}`)) quality = inSource[1]
      }
    }
    if (quality) result.push({ kind: 'particle', text: `${verb}的${quality} → ${verb}得${quality}`, reason: t('In the source, {verb} is an action and the following phrase describes how well it is performed. 得 links the verb to that description. 的 usually builds a noun modifier or a “what …” phrase; they share the sound de but do different jobs. This observation concerns this action–quality frame, not every use of 的.', { verb }) })
  }
  return result
}

function study(source: string, observations: GrammarCoachObservation[]): Candidate | null {
  const sourceClauses = clauses(source)
  const lawFirst = observations.some((observation) => observation.text.includes('法律'))
  const options = sourceClauses.filter((clause) => /学的是[^，。！？]+/u.test(clause))
  const chosen = lawFirst ? options.find((clause) => clause.includes('法律')) ?? options[0] : options[0]
  const match = chosen?.match(/^(.+?)学的是(.+)$/u)
  if (!match) return null
  return {
    pattern: '学的 + 是 + 专业', priority: lawFirst ? 100 : 70,
    summary: t('学的 means “what someone studies”. Put 的 after 学 to turn that action into the thing being identified; 是 then names the field. This is a noun-phrase structure, distinct from the completed-event emphasis pattern 是……的.'),
    parts: [
      part(match[1], t('Person'), t('Name the person whose studies you are talking about before 学.')),
      part('学', t('Action'), t('The action comes before 的: together 学的 means “what [this person] studies”.')),
      part('的', t('Make “what …”'), t('的 closes the action phrase and makes it a noun-like unit that 是 can identify. It is not 得, which introduces a description of how an action is performed.')),
      part('是', t('Identify'), t('是 goes after the completed 学的 phrase, then introduces its identity or category.')),
      part(match[2], t('Field of study'), t('The field belongs after 是 because it answers what the person studies. 我学法律 is also a possible simpler sentence; this frame puts the field in focus.')),
    ],
  }
}

function sameClass(source: string, observations: GrammarCoachObservation[]): Candidate | null {
  const chosen = clauses(source).find((clause) => clause.endsWith('不是一个班'))
  if (!chosen) return null
  const person = chosen.slice(0, -'不是一个班'.length)
  if (!person) return null
  return {
    pattern: '人 + 不是 + 一个班', priority: observations.some((observation) => observation.text.includes('一个班')) ? 100 : 60,
    summary: t('In this book line, 一个班 means one shared class. Name the people first, negate 是 with 不 before it, then give the class relationship. 我们不在同一个班 is a valid way to express a similar meaning.'),
    parts: [
      part(person, t('People'), t('Keep the coordinated people together: 我和他 means “he and I”. The relationship that follows applies to both.')),
      part('不', t('Negation'), t('不 goes immediately before 是 to negate this class relationship. It does not negate the noun 班 on its own.')),
      part('是', t('Relationship'), t('是 links the people to the shared-class description; together 不是 says that relationship is not true.')),
      part('一个', t('One shared unit'), t('The number 一 and classifier 个 come before the noun. Here they indicate being members of one and the same class.')),
      part('班', t('Class'), t('班 names the class. It is bān, distinct from 半 (bàn, “half”).')),
    ],
  }
}

function degree(source: string, observations: GrammarCoachObservation[]): Candidate | null {
  const chosen = clauses(source).find((clause) => /[踢说写做学唱跑吃睡玩]得[^，。！？]+/u.test(clause))
  const match = chosen?.match(/^(.*?)([踢说写做学唱跑吃睡玩])得(.+)$/u)
  if (!match) return null
  const prefix = match[1]
  const soccer = match[2] === '踢' && prefix.includes('足球')
  return {
    pattern: '动作 + 得 + 程度', priority: observations.some((observation) => observation.kind === 'particle') ? 110 : 50,
    summary: soccer
      ? t('得 follows the action verb and opens the description of how it is performed. Keep {verb} → 得 → {quality} together. In this source, 足球 is put before 踢 while 得{quality} stays attached to the action. 的 and 得 both sound de here, but their written functions are different.', { verb: match[2], quality: match[3] })
      : t('得 follows the action verb and opens the description of how it is performed. Keep {verb} → 得 → {quality} together. 的 and 得 both sound de here, but their written functions are different.', { verb: match[2], quality: match[3] }),
    parts: [
      ...(prefix ? [part(prefix, t('Person / topic'), soccer
        ? t('This source places the person or activity topic before the action. 足球 comes before 踢 so the verb and its 得 complement stay together.')
        : t('This source places the person or activity topic before the action.'))] : []),
      part(match[2], t('Action'), t('Put the action before 得 so the following quality clearly describes that action.')),
      part('得', t('Link to quality'), t('得 introduces the degree or quality complement immediately after the verb. It is not the noun-modifying 的.')),
      part(match[3], t('How it is done'), soccer && match[3] === '好'
        ? t('This description follows 得 because it evaluates the performance of {verb}. 踢得好 means “play/kick well”.', { verb: match[2] })
        : t('This description follows 得 because it evaluates the performance of {verb}.', { verb: match[2] })),
    ],
  }
}

function notOnly(source: string): Candidate | null {
  const sourceSentence = source.split(/[。！？.!?]/u).find((sentence) => sentence.includes('不仅'))
  const match = sourceSentence?.match(/(?:^|[，,])([^，,]*?)不仅([^，,]+)[，,]([^，,]*?)(也|还|而且)([^，,]+)/u)
  if (!match) return null
  const soccerPersonality = match[2].includes('足球踢得') && match[3] === '性格'
  const parts = [
    ...(match[1] ? [part(match[1], t('Person / setup'), t('This source names the person before 不仅 because the added qualities concern that person. With two different subjects, 不仅 can appear before the first subject.'))] : []),
    part('不仅', t('Not only'), t('Put 不仅 before the first quality or action. It signals that the first point will be followed by another.')),
    part(match[2], t('First point'), match[2].includes('足球踢得') ? t('足球 is the activity topic; 踢 is the action; 得 links it to the following description. Keep verb → 得 → quality together, with 足球 before the action.') : t('State the first quality or action after 不仅. The second clause will add another point rather than negate this one.')),
    ...(match[3] ? [part(match[3], t('Second topic'), soccerPersonality
      ? t('Name the second topic before its comment. Here 性格 is the topic and 也不错 is the comment about it.')
      : t('Name the second topic before its comment.'))] : []),
    part(match[4], t('Add another point'), match[4] === '而且' ? t('而且 introduces the added clause. It connects the second point to the first.') : t('{marker} comes before the second predicate, adding another quality or action. It need not sit immediately beside 不仅.', { marker: match[4] })),
    part(match[5], t('Second point'), t('End with the added quality or action. The second clause completes the “not only … also …” relationship.')),
  ]
  return {
    pattern: `不仅……${match[4]}……`, priority: 80,
    summary: soccerPersonality
      ? t('Give the first point after 不仅, then use 也、还 or 而且 to add a second point. In this source, the first point is his soccer performance and the second is his personality; 性格 comes before 也 because it is the topic being described.')
      : t('Give the first point after 不仅, then use 也、还 or 而且 to add a second point. The second marker belongs with the added point, rather than beside 不仅.'),
    parts,
  }
}

type PairText = { summary: string; firstReason: string; middleReason: string; secondReason: string; finalReason: string }
/** `text` is a thunk: only the rule that matches is ever translated, and in the language in use at that moment. */
type PairRule = { first: string; seconds: string[]; pattern: string; text: () => PairText; priority?: number }

const PAIRS: PairRule[] = [
  { first: '即使', seconds: ['也'], pattern: '即使……也……', text: () => ({
    summary: t('即使 introduces a concession; the result after 也 still holds despite it. Both 即使 before the subject and after the subject are possible.'),
    firstReason: t('Place 即使 before the condition or concession you want the listener to consider.'),
    middleReason: t('Complete the concession before giving the result that remains true.'),
    secondReason: t('也 appears before the result predicate to show that the concession does not change the outcome.'),
    finalReason: t('The result follows 也 because it is the point that still holds.'),
  }) },
  { first: '既', seconds: ['又', '也', '还'], pattern: '既……又/也/还……', text: () => ({
    summary: t('既 and its partner connect two coexisting qualities or actions. Keep the two sides parallel in meaning and structure.'),
    firstReason: t('既 introduces the first of the two coexisting qualities or actions.'),
    middleReason: t('Finish the first quality or action before connecting the second.'),
    secondReason: t('The partner marker introduces the second quality or action at the same structural level.'),
    finalReason: t('The second quality or action follows the partner marker and completes the pair.'),
  }) },
  { first: '要是', seconds: ['就'], pattern: '要是……就……', text: () => ({
    summary: t('State the assumed condition after 要是, then the action or result after 就. This source uses the condition before its consequence.'),
    firstReason: t('要是 opens the assumed condition; it is not the result marker.'),
    middleReason: t('Give the condition first so the listener knows when the result applies.'),
    secondReason: t('就 goes before the consequence or response to that condition.'),
    finalReason: t('The result follows 就 because it depends on the earlier assumption.'),
  }) },
  { first: '只要', seconds: ['就', '一定'], pattern: '只要……就/一定……', text: () => ({
    summary: t('只要 introduces a sufficient condition: when it is met, the following result is assured. It does not mean the condition is the only possible route.'),
    firstReason: t('只要 comes before the condition presented as sufficient for the result.'),
    middleReason: t('State what is enough to bring about the result before giving that result.'),
    secondReason: t('就 or 一定 introduces or strengthens the result that follows from the sufficient condition.'),
    finalReason: t('Give the result after the condition-and-result marker.'),
  }) },
  { first: '不管', seconds: ['都'], pattern: '不管……都……', text: () => ({
    summary: t('不管 opens the varying circumstances; 都 introduces the outcome that does not change across them.'),
    firstReason: t('不管 introduces the range of circumstances, often with 什么、谁、怎么 or an alternative.'),
    middleReason: t('Complete the range of possible circumstances before stating what stays constant.'),
    secondReason: t('都 belongs before the unchanged result predicate.'),
    finalReason: t('The result follows 都 because it applies across all the circumstances just named.'),
  }) },
  { first: '尽管', seconds: ['还是', '却', '但是', '可是'], pattern: '尽管……还是/却/但是……', text: () => ({
    summary: t('尽管 states a fact; the later clause gives an outcome that contrasts with what that fact would normally lead you to expect.'),
    firstReason: t('尽管 introduces the acknowledged fact before the contrasting outcome.'),
    middleReason: t('Finish the fact that creates the expectation before showing the contrast.'),
    secondReason: t('The transition introduces the contrasting result; 还是 and 却 precede its predicate.'),
    finalReason: t('The outcome follows the contrast marker and is understood against the earlier fact.'),
  }) },
  { first: '虽然', seconds: ['但是', '可是', '却', '还是'], pattern: '虽然……但是/可是……', text: () => ({
    summary: t('虽然 acknowledges one fact; the second clause contrasts with the expectation created by that fact.'),
    firstReason: t('虽然 introduces the acknowledged fact first.'),
    middleReason: t('State the fact before adding the contrasting point.'),
    secondReason: t('The transition marks the start of the contrasting point.'),
    finalReason: t('The contrasting outcome belongs after its transition marker.'),
  }) },
  { first: '因为', seconds: ['所以'], pattern: '因为……所以……', text: () => ({
    summary: t('This source gives the reason after 因为 and the consequence after 所以. The relation explains why the consequence happens.'),
    firstReason: t('因为 introduces the reason.'),
    middleReason: t('Give the reason before its consequence in this source frame.'),
    secondReason: t('所以 opens the consequence of the stated reason.'),
    finalReason: t('The consequence belongs after 所以. Other sentence arrangements can also express causation.'),
  }) },
  { first: '由于', seconds: ['所以'], pattern: '由于……所以……', text: () => ({
    summary: t('由于 introduces the cause; 所以 introduces the consequence in this book example.'),
    firstReason: t('由于 goes before the reason or cause, either a phrase or a clause.'),
    middleReason: t('State the cause before moving to the consequence.'),
    secondReason: t('所以 introduces the consequence of the cause just named.'),
    finalReason: t('The consequence follows 所以 in this source pattern.'),
  }) },
  { first: '首先', seconds: ['其次'], pattern: '首先……其次……', text: () => ({
    summary: t('首先 opens the first listed point; 其次 opens the next one. These markers organize the sequence of the explanation.'),
    firstReason: t('首先 signals the first point before it is stated.'),
    middleReason: t('Complete the first point before introducing the next one.'),
    secondReason: t('其次 signals the next point before it is stated.'),
    finalReason: t('The next point follows 其次, keeping the explanation ordered.'),
  }) },
  { first: '越', seconds: ['越'], pattern: '越……越……', text: () => ({
    summary: t('The first 越 introduces a changing degree; the second 越 introduces the related change. The two degrees move together.'),
    firstReason: t('The first 越 goes immediately before the first changing action or degree.'),
    middleReason: t('Describe the first change before its linked effect.'),
    secondReason: t('The second 越 introduces the linked change in degree, sometimes after 也就.'),
    finalReason: t('This degree follows the second 越 and changes with the first.'),
  }) },
]

function paired(source: string, rule: PairRule): Candidate | null {
  let firstIndex = source.indexOf(rule.first)
  // These spellings contain a marker character but are not that relation.
  while (firstIndex >= 0 && (rule.first === '既' && source[firstIndex + 1] === '然'
    || rule.first === '越' && (/[超跨穿卓优]/u.test(source[firstIndex - 1] ?? '') || /[南过境]/u.test(source[firstIndex + 1] ?? '')))) {
    firstIndex = source.indexOf(rule.first, firstIndex + rule.first.length)
  }
  if (firstIndex < 0) return null
  const sentenceEnd = source.slice(firstIndex).search(/[。！？.!?]/u)
  const end = sentenceEnd < 0 ? source.length : firstIndex + sentenceEnd
  const second = rule.seconds.map((text) => ({ text, index: source.indexOf(text, firstIndex + rule.first.length) })).filter((item) => item.index >= 0 && item.index < end).sort((a, b) => a.index - b.index)[0]
  if (!second) return null
  let firstText = source.slice(firstIndex + rule.first.length, second.index).replace(/[，。！？；,.!?;]+$/u, '').trim()
  const lastText = source.slice(second.index + second.text.length, end).trim()
  if (!firstText || !lastText) return null
  let resultSubject = ''
  const comma = Math.max(firstText.lastIndexOf('，'), firstText.lastIndexOf(','))
  if (comma >= 0) {
    const possibleSubject = firstText.slice(comma + 1).trim()
    // A short pronoun/name before the second marker belongs to the result,
    // rather than being part of the condition or first quality.
    if (/^(我|你|他|她|它|我们|你们|他们|她们|它们|大家|人们|您)$/u.test(possibleSubject)) {
      resultSubject = possibleSubject
      firstText = firstText.slice(0, comma).trim()
    }
  }
  const text = rule.text()
  return { pattern: rule.pattern, priority: rule.priority ?? 40, summary: text.summary, parts: [part(rule.first, t('Open the relation'), text.firstReason), part(firstText, t('First part'), text.middleReason), ...(resultSubject ? [part(resultSubject, t('Result subject'), t('The subject of the result appears before the second marker, which qualifies its following predicate.'))] : []), part(second.text, t('Connect the result'), text.secondReason), part(lastText, t('Second part'), text.finalReason)] }
}

function perspective(source: string): Candidate | null {
  const match = source.match(/(对(.+?)来说|在(.+?)看来)[，,]?(.+?)[。.!！?？]?$/u)
  if (!match) return null
  const first = match[2] ? '对' : '在'
  const person = match[2] ?? match[3]
  const last = first === '对' ? '来说' : '看来'
  return { pattern: `${first}……${last}`, priority: 45, summary: t('Establish whose viewpoint matters before giving the judgment. This frame marks a perspective rather than claiming the judgment is true for everyone.'), parts: [part(first, t('Open the perspective'), t('{marker} comes before the person or group whose viewpoint is being named.', { marker: first })), part(person, t('Whose viewpoint'), t('Keep the viewpoint holder between {first} and {last}.', { first, last })), part(last, t('Close the perspective'), t('{marker} closes the perspective phrase, preparing the listener for the statement that follows.', { marker: last })), part(match[4], t('Judgment'), t('The judgment follows the viewpoint frame so the listener knows who it applies to.'))] }
}

/** Return null rather than inventing a generic decomposition for an unknown frame. */
export function buildGrammarCoach(input: GrammarCoachInput): GrammarCoach | null {
  const source = input.expectedZh.trim()
  if (!source) return null
  const observations = observationsFor(source, input.response ?? '')
  const candidates = [study(source, observations), sameClass(source, observations), degree(source, observations), notOnly(source), perspective(source), ...PAIRS.map((rule) => paired(source, rule))].filter((candidate): candidate is Candidate => candidate !== null)
  const chosen = candidates.sort((a, b) => b.priority - a.priority)[0]
  if (!chosen) return null
  return { pattern: chosen.pattern, summary: chosen.summary, parts: chosen.parts, example: { zh: source, ...(input.expectedEn ? { en: input.expectedEn } : {}) }, observations }
}
