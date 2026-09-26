/** Neural Mandarin voices. Xiaoxiao / Xiaoyi are women; Yunxi / Yunjian are men. */
export const VOICE = {
  xiaoxiao: 'zh-CN-XiaoxiaoNeural',
  xiaoyi: 'zh-CN-XiaoyiNeural',
  yunxi: 'zh-CN-YunxiNeural',
  yunjian: 'zh-CN-YunjianNeural',
} as const

/** Clear enough to hear the tones, still conversational. */
export const WORD_RATE = -12
export const LINE_RATE = -6

const VOICE_BY_SPEAKER: Record<string, string> = {
  孙月: VOICE.xiaoxiao,
  王静: VOICE.xiaoyi,
  小夏: VOICE.xiaoyi,
  小雨: VOICE.xiaoxiao,
  小林: VOICE.xiaoyi,
  售货员: VOICE.xiaoyi,
  李进: VOICE.yunxi,
  马克: VOICE.yunxi,
  小李: VOICE.yunxi,
  张远: VOICE.yunxi,
  李老师: VOICE.yunjian,
  高老师: VOICE.yunjian,
  马经理: VOICE.yunjian,
  王经理: VOICE.yunjian,
  师傅: VOICE.yunjian,
}

/** Same person keeps the same voice across the book. Narration uses Xiaoxiao. */
export function voiceForSpeaker(speaker: string): string {
  const name = speaker.trim()
  if (!name) return VOICE.xiaoxiao
  return VOICE_BY_SPEAKER[name] ?? VOICE.xiaoxiao
}
