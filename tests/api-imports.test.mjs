import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const apiDir = new URL('../api/', import.meta.url)

/** Relative imports that name a .ts file. Vercel's function runtime cannot resolve these. */
export function tsExtensionImports(source) {
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
  return specifiers.filter((specifier) => specifier.startsWith('.') && specifier.endsWith('.ts'))
}

test('the guard recognizes the import form that crashed /api/tts and /api/dictionary in production', () => {
  assert.deepEqual(tsExtensionImports("import { a } from '../src/lib/speechTiming.ts'"), ['../src/lib/speechTiming.ts'])
  assert.deepEqual(tsExtensionImports("const m = await import('./x.ts')"), ['./x.ts'])
  assert.deepEqual(tsExtensionImports("import WebSocket from 'ws'\nimport { createHash } from 'node:crypto'\nimport { f } from '../src/lib/dictionary-format.js'"), [])
})

test('no serverless function imports a .ts file by path, which answers FUNCTION_INVOCATION_FAILED on Vercel', () => {
  const files = readdirSync(apiDir).filter((name) => name.endsWith('.ts'))
  assert.ok(files.length >= 2, 'expected the tts and dictionary functions')
  for (const name of files) {
    assert.deepEqual(tsExtensionImports(readFileSync(new URL(name, apiDir), 'utf8')), [], `api/${name} must not import .ts paths`)
  }
})
