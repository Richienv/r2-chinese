// Usage: node scripts/i18n/extract-content.mjs <course> <workdir> [maxChars]
// Lists the English in a course's JSON as translation work. Identical (kind, zh, text) strings are translated once.
// Writes <workdir>/<course>/chunks/NN.json and <workdir>/<course>/index.json (id -> paths + hash).
import fs from 'node:fs'
import path from 'node:path'
import { extractStrings, hashOf } from '../../src/lib/localize.ts'
import { SOURCES } from './sources.mjs'

const [course, workdir, max = '22000'] = process.argv.slice(2)
const source = SOURCES[course]
if (!source) { console.error('unknown course', course, Object.keys(SOURCES).join(', ')); process.exit(1) }

const items = []
for (const file of source.files()) {
  const root = JSON.parse(fs.readFileSync(file.path, 'utf8'))
  for (const found of extractStrings(root, source.wanted)) {
    if (found.path.split('.').some((part) => part === '')) throw new Error('empty path part ' + found.path)
    const ctx = source.context(root, found.path)
    items.push({ overlay: file.overlay, path: found.path, text: found.text, kind: source.kind(found.path), ctx })
  }
}

// Notes mix boilerplate ("Book headword pinyin printed as ...") with word-specific advice. Translate them
// sentence by sentence so the boilerplate is translated once and every word's note stays consistent.
const SPLIT = /(?<=[.!?])\s+(?=[A-Z“"(])/
const pieces = []
for (const item of items) {
  if (item.kind !== 'note') { pieces.push(item); continue }
  const parts = item.text.split(SPLIT)
  parts.forEach((part, index) => pieces.push({ ...item, text: part, part: { index, of: parts.length, whole: item.text } }))
}

const unique = new Map()
for (const item of pieces) {
  const key = `${item.kind}\u0001${item.kind === 'note' ? '' : item.ctx.zh ?? ''}\u0001${item.text}`
  let entry = unique.get(key)
  if (!entry) { entry = { id: unique.size + 1, kind: item.kind, text: item.text, ctx: item.ctx, sites: [] }; unique.set(key, entry) }
  entry.sites.push({ overlay: item.overlay, path: item.path, ...(item.part ? { part: item.part.index, of: item.part.of, whole: item.part.whole } : {}) })
}

const dir = path.join(workdir, course)
fs.rmSync(dir, { recursive: true, force: true })
fs.mkdirSync(path.join(dir, 'chunks'), { recursive: true })
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify([...unique.values()].map((e) => ({ id: e.id, kind: e.kind, hash: hashOf(e.text), text: e.text, sites: e.sites })), null, 0))

const byKind = new Map()
for (const entry of unique.values()) byKind.set(entry.kind, [...(byKind.get(entry.kind) ?? []), entry])
let n = 0
const summary = []
for (const [kind, entries] of byKind) {
  let chunk = [], size = 0
  const flush = () => {
    if (!chunk.length) return
    n++
    const name = String(n).padStart(2, '0')
    fs.writeFileSync(path.join(dir, 'chunks', `${name}.json`), JSON.stringify({ course, kind, items: chunk.map((e) => ({ id: e.id, text: e.text, ...e.ctx })) }, null, 1))
    summary.push(`${name}\t${kind}\t${chunk.length} items\t${size} chars`)
    chunk = []; size = 0
  }
  for (const entry of entries) {
    if (size + entry.text.length > Number(max) && chunk.length) flush()
    chunk.push(entry); size += entry.text.length
  }
  flush()
}
console.log(`${items.length} strings (${pieces.length} pieces), ${unique.size} unique, ${n} chunks`)
console.log(summary.join('\n'))
