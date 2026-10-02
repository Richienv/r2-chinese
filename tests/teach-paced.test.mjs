import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const component = fileURLToPath(new URL('../src/screens/TeachBeats.tsx', import.meta.url))
const store = fileURLToPath(new URL('../src/store/store.tsx', import.meta.url))
const course = fileURLToPath(new URL('../src/lib/course.ts', import.meta.url))

async function withTeachingRender(assertion) {
  const directory = mkdtempSync(join(tmpdir(), 'hsk-paced-teach-'))
  try {
    const result = await build({
      stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {TeachView} from ${JSON.stringify(component)}; import {StoreProvider} from ${JSON.stringify(store)}; import {CourseProvider} from ${JSON.stringify(course)}; export function render(prefs, phase='hook') { return renderToStaticMarkup(React.createElement(CourseProvider, {}, React.createElement(StoreProvider, {initial:{prefs}}, React.createElement(TeachView, {phase, word:{zh:'法律', pinyin:'fǎ lǜ', en:'law', pos:'n.', note:''}, example:{zh:'我学法律，因为我喜欢法律。',pinyin:'wǒ xué fǎ lǜ',en:'I study law because I like law.'}, hook:{when:'Use this word for a real rule.',usage:'Keep the action attached to the noun.'},lesson:1,n:1,of:3})))); }`, resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx' },
      bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', define: { 'import.meta.env': '{}' },
      plugins: [{ name: 'static-teaching', setup(builder) {
        builder.onResolve({ filter: /\.(css|bin|TXT)(\?url)?$/ }, (args) => ({ path: args.path, namespace: 'static-asset' }))
        builder.onLoad({ filter: /.*/, namespace: 'static-asset' }, () => ({ contents: 'export default "local-asset"', loader: 'js' }))
        // Vite's content macro is irrelevant to this explicit curriculum fixture.
        builder.onLoad({ filter: /(overlays|kerja|jiaocheng)\.ts$/ }, (args) => ({ contents: readFileSync(args.path, 'utf8').replaceAll('import.meta.glob', '(() => ({}))'), loader: 'ts' }))
      } }],
    })
    const output = join(directory, 'teach.cjs')
    writeFileSync(output, result.outputFiles[0].contents)
    const { render } = createRequire(import.meta.url)(output)
    await assertion(render)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

test('teaching starts with one insight, preserves every direct tip destination, and keeps the source example folded', async () => {
  await withTeachingRender((render) => {
    const html = render({ showEnglish: true, showPinyin: true, soundOn: false })
    assert.equal((html.match(/<article\b/g) ?? []).length, 1)
    assert.match(html, /Insight 1 of 6/)
    for (const title of ['How people use it', 'Give the shape a cue', 'Keep a useful pair', 'Link sound to the shape', 'Retrieve it inside the book line', 'Make it come back']) assert.ok(html.includes(title))
    assert.match(html, /Show the book example/)
    assert.match(html, /aria-expanded="false"/)
    assert.doesNotMatch(html, /我学法律，因为我喜欢法律。|I study law because I like law\./)
    assert.match(html, /Keep the action attached to the noun\./)
    assert.match(html, /Picture the moment/)
    assert.doesNotMatch(html, /Use this word for a real rule\./)
  })
})

test('English Off removes coaching paragraphs while retaining compact navigation and the Hanzi', async () => {
  await withTeachingRender((render) => {
    const html = render({ showEnglish: false, showPinyin: false, soundOn: false })
    assert.match(html, /法律/)
    assert.match(html, /Next insight/)
    assert.match(html, /Show the book example/)
    assert.doesNotMatch(html, /teach-hook-when|paced-card-body|Keep the action attached|Use this word for|Sentence practice uses|fǎ lǜ|I study law/)
  })
})
