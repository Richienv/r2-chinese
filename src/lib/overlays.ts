export type OverlayExample = {
  zh: string
  pinyin: string
  en: string
}

export type OverlayWord = {
  zh: string
  pinyin: string
  en: string
  pos: string
  when: string
  usage: string
  example: OverlayExample
}

export type LessonOverlay = {
  lesson: number
  title: string
  words: Record<string, OverlayWord>
}

const files = import.meta.glob('../data/teach/lesson-*.json', { eager: true })

const byLesson = new Map<number, Map<string, OverlayWord>>()
const byZh = new Map<string, OverlayWord>()

for (const [path, mod] of Object.entries(files)) {
  if (!/lesson-\d+\.json$/.test(path)) continue
  const data = (mod as { default: LessonOverlay }).default
  if (!data?.words) continue
  const map = new Map<string, OverlayWord>()
  for (const [zh, word] of Object.entries(data.words)) {
    map.set(zh, word)
    if (!byZh.has(zh)) byZh.set(zh, word)
  }
  byLesson.set(data.lesson, map)
}

/** Lesson overlay wins when a sitting knows which 课 it is; else first file that has the word. */
export function overlayWord(zh: string, lesson?: number): OverlayWord | undefined {
  if (lesson != null) {
    const hit = byLesson.get(lesson)?.get(zh)
    if (hit) return hit
  }
  return byZh.get(zh)
}

export function overlayKeys(): Iterable<string> {
  return byZh.keys()
}
