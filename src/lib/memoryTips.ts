import { t } from './i18n.ts'
import type { Vocab } from './types'

type SourceExample = { zh: string; pinyin: string; en: string }
/**
 * `key` is the English title. It never changes with the interface language, so code can tell the kinds of tip apart
 * (and pick their short labels) without comparing translated text. `title` is what the learner reads.
 */
export type MemoryTip = { key: string; title: string; body: string; cue?: string }

/**
 * Shape cues are mnemonics, never claims about a character's historical origin.
 * Built on demand so the text follows the interface language; the Hanzi in the explanations go in as placeholders.
 */
const COACHING: Record<string, () => MemoryTip[]> = {
  '法律': () => [
    { key: 'Give the shape a cue', title: t('Give the shape a cue'), body: t('{word1} has {left1} on the left and {right1} on the right. {word2} has {left2} on the left and {right2} on the right. Picture a rule keeping things in order. This is a memory image, not an etymology.', { word1: '法', left1: '氵', right1: '去', word2: '律', left2: '彳', right2: '聿' }), cue: '法 = 氵 + 去 · 律 = 彳 + 聿' },
    { key: 'Keep a useful pair', title: t('Keep a useful pair'), body: t('{study} means to study law; {obey} means to obey the law. Attach an action to the noun so you can use it in a sentence.', { study: '学法律', obey: '遵守法律' }), cue: '学法律 · 遵守法律' },
  ],
  '俩': () => [
    { key: 'Give the shape a cue', title: t('Give the shape a cue'), body: t('The left side {radical} points your attention to people. Picture two people standing together. Link the whole character to {phrase}.', { radical: '亻', phrase: '两个人' }), cue: '俩 → 两个人' },
    { key: 'Catch the common mistake', title: t('Catch the common mistake'), body: t('Say {we} or {you}. The counting idea is already inside {word}, so do not add {measure} after it.', { we: '我们俩', you: '你们俩', word: '俩', measure: '个' }), cue: '我们俩 · 你们俩' },
  ],
  '印象': () => [
    { key: 'Give the word an image', title: t('Give the word an image'), body: t('Picture somebody leaving a stamp in your memory. Make the scene specific: who left that impression, and what did they do?'), cue: '印象很深 · 第一印象' },
    { key: 'Keep the sentence frame', title: t('Keep the sentence frame'), body: t('Use {particle} to name who or what left the impression, then describe the impression. Replace the person with someone you actually know.', { particle: '对' }), cue: '我对……印象很深。' },
  ],
  '深': () => [
    { key: 'Connect two meanings', title: t('Connect two meanings'), body: t('Picture deep water, then a memory that sits just as deep. In this lesson {word} describes how strong an impression is.', { word: '深' }), cue: '水很深 → 印象很深' },
    { key: 'Recall the opposite', title: t('Recall the opposite'), body: t('Put {deep} beside {shallow}, shallow. Say both meanings without looking, then return to the lesson phrase.', { deep: '深', shallow: '浅' }), cue: '深 ↔ 浅' },
  ],
  '熟悉': () => [
    { key: 'Give it a personal scene', title: t('Give it a personal scene'), body: t('Think of a Hangzhou street you can navigate without checking your phone. That is a concrete scene for being familiar with something.'), cue: '我熟悉这个地方。' },
    { key: 'Separate two ideas', title: t('Separate two ideas'), body: t('{meet} can mean knowing or meeting a person. {familiar} describes familiarity built over time. Picture the difference between meeting once and knowing someone well.', { meet: '认识', familiar: '熟悉' }), cue: '认识 → 慢慢熟悉' },
  ],
  '不仅': () => [
    { key: 'Learn the whole bridge', title: t('Learn the whole bridge'), body: t('Give {word} a second idea to connect to. The useful pattern is not only one quality, but another as well.', { word: '不仅' }), cue: '不仅……，而且……' },
    { key: 'Make the two sides yours', title: t('Make the two sides yours'), body: t('Choose two true qualities of a friend, a product, or a place. Say both with {pattern}, then change one quality.', { pattern: '不仅……而且……' }), cue: '不仅方便，而且便宜。' },
  ],
  '性格': () => [
    { key: 'Give it a real person', title: t('Give it a real person'), body: t('Choose two people whose personalities are very different. Attach {word} to each person rather than remembering an isolated translation.', { word: '性格' }), cue: '性格开朗 · 性格内向' },
    { key: 'Ask a usable question', title: t('Ask a usable question'), body: t('Describe the person with one quality, then answer the question again about yourself.'), cue: '他的性格怎么样？' },
  ],
}

/** Every course gets source-grounded practice cues, even without bespoke coaching. */
export function memoryTips(word: Vocab, example: SourceExample | null): MemoryTip[] {
  const syllables = word.pinyin.trim().split(/\s+/).filter(Boolean)
  const tips = [...(COACHING[word.zh]?.() ?? [{
    key: 'Make a personal scene',
    title: t('Make a personal scene'),
    body: t('Choose one real person, place, or action connected to “{meaning}”. Imagine using {word} in that scene, then say one short sentence about it.', { meaning: word.en, word: word.zh }),
  }])]
  tips.push({
    key: 'Link sound to the shape',
    title: t('Link sound to the shape'),
    body: syllables.length > 1
      ? t('Say the syllables slowly, then join them into one word. Hide the pinyin and say the word again while looking only at the Hanzi.')
      : t('Listen once, copy the tone aloud, then hide the pinyin and say the word again from the Hanzi. Compare your second attempt with the audio.'),
    cue: word.pinyin,
  })
  if (example?.zh.includes(word.zh)) tips.push({
    key: 'Retrieve it inside the book line',
    title: t('Retrieve it inside the book line'),
    body: t('Fill the gap aloud before revealing it. Then replace a person or detail while keeping the same sentence pattern.'),
    cue: example.zh.split(word.zh).join('____'),
  })
  tips.push({
    key: 'Make it come back',
    title: t('Make it come back'),
    body: t('Look away and say the meaning and the Mandarin. Try again after another word, then tomorrow. If it takes a hint, keep that word in the practice trail.'),
  })
  return tips
}
