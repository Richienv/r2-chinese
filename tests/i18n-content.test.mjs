import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { extractStrings, hashOf } from '../src/lib/localize.ts'
import { SOURCES } from '../scripts/i18n/sources.mjs'

const OVERLAYS = 'src/data/i18n/id'
const at = (root, dotted) => dotted.split('.').reduce((node, key) => node?.[key], root)

// For every course: each overlay entry still matches the English it was written against, and nearly every
// translatable string has a translation. A stale entry would silently fall back to English in the app.
for (const course of ['hsk4a', 'teach', 'kerja', 'jiaocheng']) {
  test(`${course}: overlays match their source and cover the course`, () => {
    const source = SOURCES[course]
    const stale = []
    let wanted = 0
    let covered = 0
    for (const file of source.files()) {
      const root = JSON.parse(fs.readFileSync(file.path, 'utf8'))
      const overlayFile = path.join(OVERLAYS, `${file.overlay}.json`)
      const overlay = fs.existsSync(overlayFile) ? JSON.parse(fs.readFileSync(overlayFile, 'utf8')) : {}
      for (const [p, [hash, text]] of Object.entries(overlay)) {
        const original = at(root, p)
        if (typeof original !== 'string' || hashOf(original) !== hash) stale.push(`${file.overlay} ${p}`)
        if (typeof text !== 'string' || !text.trim()) stale.push(`${file.overlay} ${p} (empty)`)
      }
      for (const found of extractStrings(root, source.wanted)) {
        wanted++
        if (found.path in overlay) covered++
      }
    }
    assert.deepEqual(stale.slice(0, 10), [], `${stale.length} stale or empty entries`)
    assert.ok(wanted > 0)
    assert.ok(covered / wanted >= 0.995, `${course}: ${covered} of ${wanted} strings translated`)
  })
}

test('the Chinese in a translated sentence is never lost', () => {
  const HAN = /[㐀-鿿]/gu
  const overlay = JSON.parse(fs.readFileSync(path.join(OVERLAYS, 'hsk4a.json'), 'utf8'))
  const root = JSON.parse(fs.readFileSync('src/data/hsk4a.json', 'utf8'))
  const lost = []
  for (const [p, [, text]] of Object.entries(overlay)) {
    const original = at(root, p)
    const before = (original.match(HAN) ?? []).sort().join('')
    const after = (text.match(HAN) ?? []).sort().join('')
    if (before !== after) lost.push(p)
  }
  assert.deepEqual(lost.slice(0, 10), [])
})
