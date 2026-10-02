import type { Vocab } from './types'

type SourceExample = { zh: string; pinyin: string; en: string }
export type MemoryTip = { title: string; body: string; cue?: string }

/** Shape cues are mnemonics, never claims about a character's historical origin. */
const COACHING: Record<string, MemoryTip[]> = {
  '法律': [
    { title: 'Give the shape a cue', body: '法 has 氵 on the left and 去 on the right. 律 has 彳 on the left and 聿 on the right. Picture a rule keeping things in order. This is a memory image, not an etymology.', cue: '法 = 氵 + 去 · 律 = 彳 + 聿' },
    { title: 'Keep a useful pair', body: '学法律 means to study law; 遵守法律 means to obey the law. Attach an action to the noun so you can use it in a sentence.', cue: '学法律 · 遵守法律' },
  ],
  '俩': [
    { title: 'Give the shape a cue', body: 'The left side 亻 points your attention to people. Picture two people standing together. Link the whole character to 两个人.', cue: '俩 → 两个人' },
    { title: 'Catch the common mistake', body: 'Say 我们俩 or 你们俩. The counting idea is already inside 俩, so do not add 个 after it.', cue: '我们俩 · 你们俩' },
  ],
  '印象': [
    { title: 'Give the word an image', body: 'Picture somebody leaving a stamp in your memory. Make the scene specific: who left that impression, and what did they do?', cue: '印象很深 · 第一印象' },
    { title: 'Keep the sentence frame', body: 'Use 对 to name who or what left the impression, then describe the impression. Replace the person with someone you actually know.', cue: '我对……印象很深。' },
  ],
  '深': [
    { title: 'Connect two meanings', body: 'Picture deep water, then a memory that sits just as deep. In this lesson 深 describes how strong an impression is.', cue: '水很深 → 印象很深' },
    { title: 'Recall the opposite', body: 'Put 深 beside 浅, shallow. Say both meanings without looking, then return to the lesson phrase.', cue: '深 ↔ 浅' },
  ],
  '熟悉': [
    { title: 'Give it a personal scene', body: 'Think of a Hangzhou street you can navigate without checking your phone. That is a concrete scene for being familiar with something.', cue: '我熟悉这个地方。' },
    { title: 'Separate two ideas', body: '认识 can mean knowing or meeting a person. 熟悉 describes familiarity built over time. Picture the difference between meeting once and knowing someone well.', cue: '认识 → 慢慢熟悉' },
  ],
  '不仅': [
    { title: 'Learn the whole bridge', body: 'Give 不仅 a second idea to connect to. The useful pattern is not only one quality, but another as well.', cue: '不仅……，而且……' },
    { title: 'Make the two sides yours', body: 'Choose two true qualities of a friend, a product, or a place. Say both with 不仅……而且……, then change one quality.', cue: '不仅方便，而且便宜。' },
  ],
  '性格': [
    { title: 'Give it a real person', body: 'Choose two people whose personalities are very different. Attach 性格 to each person rather than remembering an isolated translation.', cue: '性格开朗 · 性格内向' },
    { title: 'Ask a usable question', body: 'Describe the person with one quality, then answer the question again about yourself.', cue: '他的性格怎么样？' },
  ],
}

/** Every course gets source-grounded practice cues, even without bespoke coaching. */
export function memoryTips(word: Vocab, example: SourceExample | null): MemoryTip[] {
  const syllables = word.pinyin.trim().split(/\s+/).filter(Boolean)
  const tips = [...(COACHING[word.zh] ?? [{
    title: 'Make a personal scene',
    body: `Choose one real person, place, or action connected to “${word.en}”. Imagine using ${word.zh} in that scene, then say one short sentence about it.`,
  }])]
  tips.push({
    title: 'Link sound to the shape',
    body: syllables.length > 1
      ? 'Say the syllables slowly, then join them into one word. Hide the pinyin and say the word again while looking only at the Hanzi.'
      : 'Listen once, copy the tone aloud, then hide the pinyin and say the word again from the Hanzi. Compare your second attempt with the audio.',
    cue: word.pinyin,
  })
  if (example?.zh.includes(word.zh)) tips.push({
    title: 'Retrieve it inside the book line',
    body: 'Fill the gap aloud before revealing it. Then replace a person or detail while keeping the same sentence pattern.',
    cue: example.zh.split(word.zh).join('____'),
  })
  tips.push({
    title: 'Make it come back',
    body: 'Look away and say the meaning and the Mandarin. Try again after another word, then tomorrow. If it takes a hint, keep that word in the practice trail.',
  })
  return tips
}
