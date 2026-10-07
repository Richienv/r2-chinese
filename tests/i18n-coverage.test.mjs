import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import id from '../src/i18n/id.ts'
import { literalsIn, placeholders } from '../scripts/i18n/check-dictionary.mjs'

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'i18n' || entry.name === 'data' || entry.name === 'assets' ? [] : sources(full)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') && entry.name !== 'i18n.ts' ? [full] : []
  })
}

const files = sources('src')
const calls = files.map((file) => literalsIn(file))

test('t() is only ever called with a string literal, so every string can be found and translated', () => {
  const bad = calls.flatMap((entry) => entry.bad)
  assert.deepEqual(bad.map((item) => `${item.file}:${item.line} t(${item.text})`), [])
})

test('every English string passed to t() has an Indonesian entry', () => {
  const missing = calls.flatMap((entry) => entry.found).filter((item) => !(item.text in id)).map((item) => `${item.file}:${item.line} ${JSON.stringify(item.text)}`)
  assert.deepEqual(missing, [])
})

test('Indonesian entries keep every placeholder and are not empty', () => {
  const broken = Object.entries(id).filter(([english, indonesian]) => !indonesian.trim() || placeholders(english) !== placeholders(indonesian))
  assert.deepEqual(broken.map(([english]) => english), [])
})

test('Indonesian entries are really translated, not copies of the English', () => {
  const same = Object.entries(id).filter(([english, indonesian]) => english === indonesian && english.split(/\s+/).length >= 3 && /[a-z]{3,}/i.test(english.replace(/\{\w+\}/g, '')))
  assert.deepEqual(same.map(([english]) => english), [])
})

test('Indonesian entries use the written-out style, not text-speak abbreviations', () => {
  const abbreviations = /\b(yg|dgn|bgt|jg|utk|sm|krn|tdk|dlm|pd|spy)\b/i
  const found = Object.entries(id).filter(([, indonesian]) => abbreviations.test(indonesian))
  assert.deepEqual(found.map(([english]) => english), [])
})
