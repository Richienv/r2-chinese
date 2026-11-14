type SearchableWord = { zh: string; pinyin?: string; en?: string }
function plain(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim()
}
function pinyin(text: string): string {
  // Accept tone marks/numbers, ü, v and u:, with or without syllable spaces.
  return plain(text.replace(/u:|ü|v/gi, 'u')).replace(/[1-5\s'’\-]/g, '')
}
export function matchesWord(word: SearchableWord, query: string): boolean {
  const needle = plain(query)
  if (!needle) return true
  if (plain(word.zh).includes(needle) || plain(word.en ?? '').includes(needle)) return true
  const sounds = pinyin(query)
  return !!sounds && !!word.pinyin && pinyin(word.pinyin).includes(sounds)
}
