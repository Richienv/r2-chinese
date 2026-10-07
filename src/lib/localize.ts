/**
 * Course content in another language, as an overlay: a map from the path of an
 * English string in the source JSON to its translation. The source stays the
 * single place content is authored; the overlay is applied once, when the data
 * loads, so every screen reads translated text without knowing it.
 *
 * Each entry also carries a hash of the English it was written against. If the
 * source later changes, the stale entry is skipped and the English shows, rather
 * than a translation of a sentence that no longer exists.
 */

export type OverlayEntry = [hash: string, text: string]
export type Overlay = Record<string, OverlayEntry>

/** FNV-1a, 32 bit, as 8 hex digits. Enough to notice a changed source string. */
export function hashOf(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export interface Found {
  path: string
  text: string
}

/** Walk JSON and list the strings `wanted` accepts. `path` is dot-joined keys and indexes. */
export function extractStrings(root: unknown, wanted: (path: string, key: string, value: string) => boolean): Found[] {
  const out: Found[] = []
  const walk = (node: unknown, path: string, key: string): void => {
    if (typeof node === 'string') {
      if (node.trim() && wanted(path, key, node)) out.push({ path, text: node })
    } else if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, path ? `${path}.${index}` : `${index}`, key))
    } else if (node && typeof node === 'object') {
      for (const [name, child] of Object.entries(node)) walk(child, path ? `${path}.${name}` : name, name)
    }
  }
  walk(root, '', '')
  return out
}

function parent(root: unknown, path: string): { holder: Record<string, unknown> | unknown[]; key: string } | null {
  const keys = path.split('.')
  let node: unknown = root
  for (const key of keys.slice(0, -1)) {
    if (node && typeof node === 'object') node = (node as Record<string, unknown>)[key]
    else return null
  }
  return node && typeof node === 'object' ? { holder: node as Record<string, unknown>, key: keys[keys.length - 1] } : null
}

export interface Applied {
  applied: number
  /** Paths whose English changed since they were translated, or that no longer exist. */
  stale: string[]
}

/** Replace English with its translation in place. Anything that does not match is left in English. */
export function applyOverlay(root: unknown, overlay: Overlay): Applied {
  let applied = 0
  const stale: string[] = []
  for (const [path, [hash, text]] of Object.entries(overlay)) {
    const spot = parent(root, path)
    const current = spot ? (spot.holder as Record<string, unknown>)[spot.key] : undefined
    if (spot && typeof current === 'string' && hashOf(current) === hash) {
      ;(spot.holder as Record<string, unknown>)[spot.key] = text
      applied++
    } else stale.push(path)
  }
  return { applied, stale }
}
