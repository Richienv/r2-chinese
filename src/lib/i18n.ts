import id from '../i18n/id.ts'

/**
 * Two interface languages. English is the source text: every `t('...')` call
 * carries the English, and Indonesian looks it up by that exact string.
 * A missing entry shows the English, never a blank or a key.
 *
 * The language is fixed for the life of the page: changing it reloads, so course
 * data, generated questions and anything memoised are all built in one language.
 */
export type Lang = 'en' | 'id'

export const LANGUAGES: ReadonlyArray<{ id: Lang; name: string; hint: string }> = [
  { id: 'en', name: 'English', hint: 'Meanings and tips in English' },
  { id: 'id', name: 'Indonesia (Gen Z)', hint: 'Arti dan tips pakai bahasa santai' },
]

const KEY = 'yulu.lang.v1'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'id') return saved
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en'
  } catch { return 'en' }
}

let current: Lang = detect()

export function getLang(): Lang { return current }

/** Switch language. Reloads, so every module rebuilds its data in the new language. */
export function setLang(next: Lang): void {
  if (next === current) return
  try { localStorage.setItem(KEY, next) } catch { /* the choice just will not persist */ }
  current = next
  if (typeof location !== 'undefined') location.reload()
}

/** Run something in another language without touching storage. For tests. */
export function withLang<T>(lang: Lang, run: () => T): T {
  const before = current
  current = lang
  try { return run() } finally { current = before }
}

export type Vars = Record<string, string | number>

function fill(template: string, vars?: Vars): string {
  return vars ? template.replace(/\{(\w+)\}/g, (whole, name: string) => name in vars ? String(vars[name]) : whole) : template
}

/** Translate an English interface string. `{name}` placeholders are filled from `vars`. */
export function t(source: string, vars?: Vars): string {
  return fill(current === 'id' ? id[source] ?? source : source, vars)
}

export const isIndonesian = (): boolean => current === 'id'

/** The word for the translation layer in the current language, for toggles and labels. */
export function meaningLabel(): string { return t('English') }
