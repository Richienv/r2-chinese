export interface Book {
  title_zh: string
  title_en: string
  publisher: string
  lead_author: string
  authors: string[]
}

export interface Vocab {
  zh: string
  pinyin: string
  pos: string
  en: string
  note: string
}

/** Entry in the book-wide index — same as Vocab plus provenance. */
export interface IndexedVocab {
  zh: string
  pinyin: string
  pos: string
  en: string
  lesson: number
  related: string
  tag: '' | 'known-char' | 'proper' | 'supra'
}

export interface TextLine {
  speaker: string
  zh: string
  pinyin: string
  en: string
}

export interface LessonText {
  label: string
  heading_zh: string
  heading_en: string
  type: 'dialogue' | 'passage'
  lines: TextLine[]
}

export interface GrammarExample {
  zh: string
  pinyin: string
  en: string
}

export interface GrammarPoint {
  point: string
  pinyin: string
  explanation: string
  examples: GrammarExample[]
}

export interface CompareNote {
  a: string
  b: string
  note: string
}

export interface SameCharNote {
  char: string
  words: string[]
  examples: GrammarExample[]
}

export interface CultureNote {
  title_zh: string
  title_en: string
  summary: string
}

export interface LessonExtras {
  compare: CompareNote[]
  same_char: SameCharNote[]
  culture: CultureNote[]
  exercises: string[]
}

export interface Lesson {
  lesson: number
  title: { zh: string; pinyin: string; en: string }
  warmup: string[]
  texts: LessonText[]
  vocab: Vocab[]
  grammar: GrammarPoint[]
  extras: LessonExtras
}

export interface BookData {
  book: Book
  contents: unknown[]
  lessons: Lesson[]
  vocabIndex: IndexedVocab[]
  properNouns: unknown[]
  supplementary: unknown[]
  knownCharWords: unknown[]
  supraWords: unknown[]
}
