import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'esbuild'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('isCoreBookVocab restricts default Active Recall and Home/Progress due counters to curriculum words', async () => {
  const transport = createHttpServer()
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: { server: transport } },
    appType: 'custom',
  })
  try {
    const [
      { withLang },
      { coreBookVocabSet, isCoreBookVocab },
      { kerjaChapters },
      { jiaochengLessons },
      { ReviewFlow, selectRecallCandidates },
      { MemoryHorizon },
      { Progress },
      { StoreProvider, normalize },
      { newCard },
      { newMastery },
      { createEmptyGraph, recordRecallOutcome, recordSkippedLessons },
    ] = await Promise.all([
      server.ssrLoadModule('/src/lib/i18n.ts'),
      server.ssrLoadModule('/src/lib/content.ts'),
      server.ssrLoadModule('/src/lib/kerja.ts'),
      server.ssrLoadModule('/src/lib/jiaocheng.ts'),
      server.ssrLoadModule('/src/screens/Review.tsx'),
      server.ssrLoadModule('/src/components/MemoryHorizon.tsx'),
      server.ssrLoadModule('/src/screens/Progress.tsx'),
      server.ssrLoadModule('/src/store/store.tsx'),
      server.ssrLoadModule('/src/lib/srs.ts'),
      server.ssrLoadModule('/src/lib/mastery.ts'),
      server.ssrLoadModule('/src/lib/learnerGraph.ts'),
    ])

    // 1. Canonical core curriculum vocabulary membership
    assert.equal(isCoreBookVocab('九'), false, 'Non-curriculum number 九 must not be core book vocab')
    assert.equal(isCoreBookVocab('一'), false)
    assert.equal(isCoreBookVocab('二'), false)
    assert.equal(isCoreBookVocab('王静'), false, 'Proper noun must not be core recall vocab')

    assert.equal(isCoreBookVocab('法律'), true, 'HSK 4 word should be core vocab')
    assert.equal(isCoreBookVocab('顺便'), true, 'HSK 4 / Jiaocheng word should be core vocab')
    const jcWord = jiaochengLessons[0].words.find((w) => !/pr\.? ?n|proper/i.test(w.pos || ''))
    const kerjaWord = kerjaChapters[0].words[0]
    assert.ok(jcWord && isCoreBookVocab(jcWord.zh), 'Jiaocheng lesson word should be core vocab')
    assert.ok(kerjaWord && isCoreBookVocab(kerjaWord.zh), 'Kerja unit word should be core vocab')

    const set = coreBookVocabSet()
    assert.equal(set.has('九'), false)
    assert.equal(set.has('法律'), true)
    assert.equal(set.has(jcWord.zh), true)
    assert.equal(set.has(kerjaWord.zh), true)

    // 2. Default Active Recall queue filters out non-core words from dueCards, skipped, weakGraph, and placement
    const now = Date.now()
    const pastDue = now - 60_000
    let graph = createEmptyGraph(now)
    graph = recordSkippedLessons(graph, {
      course: 'jiaocheng',
      lessons: [{ lesson: 1, title: 'L1', words: ['九', jcWord.zh], grammarPoints: [] }],
      at: now,
    })
    graph = recordRecallOutcome(graph, { zh: '一', correct: false, at: now })
    graph = recordRecallOutcome(graph, { zh: '一', correct: false, at: now + 1 })
    graph = recordRecallOutcome(graph, { zh: '熟悉', correct: false, at: now })
    graph = recordRecallOutcome(graph, { zh: '熟悉', correct: false, at: now + 1 })

    const cards = {
      九: newCard('九', 0, pastDue),
      法律: newCard('法律', 1, pastDue),
    }

    const defaultQueue = selectRecallCandidates({
      cardList: Object.values(cards),
      cards,
      learningTrail: ['九', '法律'],
      graph,
      isWordComfortable: () => false,
    })
    assert.equal(defaultQueue.includes('九'), false)
    assert.equal(defaultQueue.includes('一'), false)
    assert.equal(defaultQueue.includes('法律'), true)
    assert.equal(defaultQueue.includes(jcWord.zh), true)
    assert.equal(defaultQueue.includes('熟悉'), true)

    const placementQueue = selectRecallCandidates({
      placement: true,
      cardList: Object.values(cards),
      cards,
      learningTrail: ['九', '法律'],
      graph,
      isWordComfortable: () => false,
    })
    assert.equal(placementQueue.includes('九'), false)
    assert.equal(placementQueue.includes('法律'), true)

    // Explicit `words` drills still work when requested directly
    const explicitQueue = selectRecallCandidates({
      words: ['九'],
      cardList: Object.values(cards),
      cards,
      learningTrail: ['九'],
      graph,
      isWordComfortable: () => false,
    })
    assert.deepEqual(explicitQueue, ['九'])

    // 3. Rendered UI checks: ReviewFlow, MemoryHorizon, and Progress exclude `九` even when present in legacy saves
    const legacyState = normalize({
      cards: {
        九: newCard('九', 0, pastDue),
      },
      mastery: {
        九: { ...newMastery('九', 0, pastDue), state: 'hard', attempts: 1 },
      },
    })
    const corePlusLegacyState = normalize({
      cards: {
        九: newCard('九', 0, pastDue),
        法律: newCard('法律', 1, pastDue),
      },
      mastery: {},
    })

    const prevLs = globalThis.localStorage
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {}, key: () => null, length: 0 }
    try {
      withLang('id', () => {
        const emptyReviewHtml = renderToStaticMarkup(
          createElement(
            StoreProvider,
            { initial: legacyState },
            createElement(ReviewFlow, { onClose: () => {} }),
          ),
        )
        assert.match(emptyReviewHtml, /Tidak ada yang jatuh tempo|Nothing is due|Belum ada/)

        const horizonHtml = renderToStaticMarkup(
          createElement(
            StoreProvider,
            { initial: corePlusLegacyState },
            createElement(MemoryHorizon, { onReview: () => {}, onPlacement: () => {} }),
          ),
        )
        assert.match(horizonHtml, /1\s+(menunggu|due)/i)

        const progressHtml = renderToStaticMarkup(
          createElement(
            StoreProvider,
            { initial: legacyState },
            createElement(Progress, { onReview: () => {}, onLearn: () => {} }),
          ),
        )
        assert.doesNotMatch(progressHtml, /Review kata yang sudah waktunya|Latihan kata yang susah/)
        assert.match(progressHtml, /Mulai dari materi pilihanmu/)
        assert.match(progressHtml, /Lanjut belajar/)
      })
    } finally {
      if (prevLs) globalThis.localStorage = prevLs
      else delete globalThis.localStorage
    }
  } finally {
    await server.close()
    transport.close()
  }
})

test('GlossSheet distinguishes incidental dictionary lookups from core curriculum words', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const directory = mkdtempSync(join(tmpdir(), 'hsk-gloss-check-'))
  try {
    const result = await build({
      stdin: {
        contents: `import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlossSheet } from './src/components/ChineseText';
import { StoreProvider } from './src/store/store';
import { withLang } from './src/lib/i18n';
export function renderGloss(word) {
  return withLang('id', () =>
    renderToStaticMarkup(
      <StoreProvider initial={{ prefs: { soundOn: false, showPinyin: true, showEnglish: true } }}>
        <GlossSheet word={word} onClose={() => {}} />
      </StoreProvider>
    )
  );
}`,
        resolveDir: root,
        loader: 'tsx',
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
      define: { 'import.meta.env': '{}' },
      plugins: [
        {
          name: 'gloss-ssr',
          setup(b) {
            b.onResolve({ filter: /^react-dom$/ }, () => ({ path: 'react-dom', namespace: 'portal' }))
            b.onLoad({ filter: /.*/, namespace: 'portal' }, () => ({
              contents: 'export const createPortal = (children) => children;',
              loader: 'js',
            }))
            b.onResolve({ filter: /\.(css|bin|TXT)(\?url)?$/ }, (args) => ({ path: args.path, namespace: 'asset' }))
            b.onLoad({ filter: /.*/, namespace: 'asset' }, () => ({ contents: 'export default ""', loader: 'js' }))
            b.onLoad({ filter: /[/]src[/]lib[/].*\.ts$/ }, (args) => ({
              contents: readFileSync(args.path, 'utf8').replaceAll('import.meta.glob', '(() => ({}))'),
              loader: 'ts',
            }))
          },
        },
      ],
    })
    const output = join(directory, 'gloss.cjs')
    writeFileSync(output, result.outputFiles[0].contents)
    const { renderGloss } = createRequire(import.meta.url)(output)
    const prevDoc = globalThis.document
    globalThis.document = { body: {}, addEventListener() {}, removeEventListener() {} }
    try {
      const nonCoreHtml = renderGloss({ zh: '九', pinyin: 'jiǔ', pos: '', en: 'nine; 9', note: '' })
      assert.match(nonCoreHtml, /Hanya pencarian kamus/)
      assert.doesNotMatch(nonCoreHtml, /Otomatis tersimpan di jejak belajarmu/)

      const coreHtml = renderGloss({ zh: '法律', pinyin: 'fǎlǜ', pos: 'n.', en: 'law', note: '' })
      assert.match(coreHtml, /Otomatis tersimpan di jejak belajarmu/)
    } finally {
      if (prevDoc) globalThis.document = prevDoc
      else delete globalThis.document
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
