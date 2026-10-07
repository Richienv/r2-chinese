// Usage: node scripts/i18n/merge-content.mjs <course> <workdir>
// Reads <workdir>/<course>/index.json and out/*.json and writes one overlay per source file into src/data/i18n/id.
import fs from 'node:fs'
import path from 'node:path'
import { hashOf } from '../../src/lib/localize.ts'
import { SOURCES } from './sources.mjs'
import { validate } from './check-chunk.mjs'

const [course, workdir] = process.argv.slice(2)
const source = SOURCES[course]
const dir = path.join(workdir, course)
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
const translations = {}
let problems = 0
for (const name of fs.readdirSync(path.join(dir, 'chunks')).sort()) {
  const chunk = JSON.parse(fs.readFileSync(path.join(dir, 'chunks', name), 'utf8'))
  const outFile = path.join(dir, 'out', name)
  if (!fs.existsSync(outFile)) { console.log(`no output yet for chunk ${name}`); continue }
  const out = JSON.parse(fs.readFileSync(outFile, 'utf8'))
  const found = validate(chunk, out)
  if (found.length) { console.log(`chunk ${name}: ${found.length} problem(s)`); problems += found.length; found.slice(0, 8).forEach((line) => console.log('  ' + line)) }
  Object.assign(translations, out)
}

const files = new Map(source.files().map((file) => [file.overlay, file.path]))
const overlays = new Map()
const pending = new Map() // overlay\0path -> parts[]
let missing = 0
for (const entry of index) {
  const text = translations[String(entry.id)]
  for (const site of entry.sites) {
    if (typeof text !== 'string' || !text.trim()) { missing++; continue }
    if (site.part === undefined) {
      overlays.set(site.overlay, { ...(overlays.get(site.overlay) ?? {}), [site.path]: text })
    } else {
      const key = `${site.overlay}\u0000${site.path}`
      const parts = pending.get(key) ?? Array.from({ length: site.of }, () => null)
      parts[site.part] = text
      pending.set(key, parts)
    }
  }
}
for (const [key, parts] of pending) {
  if (parts.some((part) => part === null)) { missing++; continue }
  const [overlay, p] = key.split('\u0000')
  overlays.set(overlay, { ...(overlays.get(overlay) ?? {}), [p]: parts.join(' ') })
}

const at = (root, dotted) => dotted.split('.').reduce((node, k) => node?.[k], root)
const outDir = 'src/data/i18n/id'
fs.mkdirSync(outDir, { recursive: true })
let total = 0
for (const [overlay, entries] of overlays) {
  const root = JSON.parse(fs.readFileSync(files.get(overlay), 'utf8'))
  const result = {}
  for (const [p, text] of Object.entries(entries)) {
    const original = at(root, p)
    if (typeof original !== 'string') { console.log(`path vanished: ${overlay} ${p}`); continue }
    result[p] = [hashOf(original), text]
  }
  total += Object.keys(result).length
  fs.writeFileSync(path.join(outDir, `${overlay}.json`), JSON.stringify(result))
}
console.log(`${course}: wrote ${overlays.size} overlay file(s), ${total} strings; ${missing} site(s) without a translation yet; ${problems} validation problem(s)`)
