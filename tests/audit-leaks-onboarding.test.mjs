import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { ALL_HSK1_WORDS, HSK1_UNITS } from '../src/data/hsk1.ts'
import { LEGENDARY_BEASTS } from '../src/lib/beastEngine.ts'
import { switchCoupleWorkspace } from '../src/lib/coupleProfile.ts'
import { readCourse } from '../src/lib/course.ts'
import { buildVocabWaves, maskHsk1Hint } from '../src/lib/hsk1Srs.ts'
import {
  getOnboardingSlides,
  isOnboardingDone,
  markOnboardingDone,
  resetOnboarding,
} from '../src/lib/onboarding.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const tempDir = mkdtempSync(join(tmpdir(), 'hsk-audit-leaks-'))
let renderSurface

function makeMemoryStorage() {
  const map = new Map()
  return {
    get length() {
      return map.size
    },
    key(i) {
      return [...map.keys()][i] ?? null
    },
    getItem(k) {
      return map.has(k) ? map.get(k) : null
    },
    setItem(k, v) {
      map.set(k, String(v))
    },
    removeItem(k) {
      map.delete(k)
    },
  }
}

test.before(async () => {
  const res = await build({
    stdin: {
      contents: `import React from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { StoreProvider } from './src/store/store';
        import { CourseProvider } from './src/lib/course';
        import { BeastStageCard } from './src/components/BeastStageCard';
        import { Progress } from './src/screens/Progress';

        export function render(which, activeProfile = 'richie') {
          const store = new Map([
            ['yulu.active-profile.v1', activeProfile],
            ['yulu.course.v1', activeProfile === 'renita' ? 'hsk1' : 'hsk4a'],
            ['yulu.course-entered.v1', '1'],
          ]);
          const prevLocalStorage = globalThis.localStorage;
          const prevDocument = globalThis.document;
          globalThis.localStorage = {
            get length() { return store.size },
            key(i) { return [...store.keys()][i] ?? null },
            getItem(k) { return store.has(k) ? store.get(k) : null },
            setItem(k, v) { store.set(k, String(v)) },
            removeItem(k) { store.delete(k) },
          };
          globalThis.document = { body: {}, addEventListener() {}, removeEventListener() {} };
          try {
            const Comp = which === 'beast' ? BeastStageCard : Progress;
            return renderToStaticMarkup(
              <CourseProvider>
                <StoreProvider initial={{ prefs: { soundOn: false, showPinyin: true, showEnglish: true } }}>
                  <Comp onReview={() => {}} onLearn={() => {}} />
                </StoreProvider>
              </CourseProvider>,
            );
          } finally {
            if (prevLocalStorage) globalThis.localStorage = prevLocalStorage;
            else delete globalThis.localStorage;
            if (prevDocument) globalThis.document = prevDocument;
            else delete globalThis.document;
          }
        }
      `,
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
        name: 'headless-audit',
        setup(b) {
          b.onResolve({ filter: /^react-dom$/ }, () => ({ path: 'react-dom', namespace: 'portal' }))
          b.onLoad({ filter: /.*/, namespace: 'portal' }, () => ({
            contents: 'export const createPortal = (children) => children;',
            loader: 'js',
          }))
          b.onResolve({ filter: /\.(css|bin|TXT)(\?url)?$/ }, (args) => ({ path: args.path, namespace: 'asset' }))
          b.onLoad({ filter: /.*/, namespace: 'asset' }, () => ({
            contents: 'export default "local-asset"',
            loader: 'js',
          }))
          b.onLoad({ filter: /[\/]src[\/]lib[\/].*\.ts$/ }, (args) => ({
            contents: readFileSync(args.path, 'utf8').replaceAll('import.meta.glob', '(() => ({}))'),
            loader: 'ts',
          }))
        },
      },
    ],
  })
  const out = join(tempDir, 'audit.cjs')
  writeFileSync(out, res.outputFiles[0].contents)
  renderSurface = createRequire(import.meta.url)(out).render
})

test.after(() => rmSync(tempDir, { recursive: true, force: true }))

test('maskHsk1Hint strips target Hanzi and Pinyin across all 150 HSK 1 words and radical micro-checks', () => {
  for (const w of ALL_HSK1_WORDS) {
    const masked = maskHsk1Hint(w.literalTip, w)
    assert.equal(masked.includes(w.zh), false, `literalTip leaked zh for ${w.zh}: ${masked}`)
    const pyParts = w.pinyin
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const part of pyParts) {
      const re = new RegExp(`(?<![A-Za-zÀ-ÿ\\u0100-\\u01FF])${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-zÀ-ÿ\\u0100-\\u01FF])`, 'i')
      assert.equal(re.test(masked), false, `literalTip leaked pinyin "${part}" for ${w.zh}: ${masked}`)
    }
  }

  for (const unit of HSK1_UNITS) {
    const waves = buildVocabWaves(unit.words, 3)
    for (const wave of waves) {
      for (const chk of wave.microChecks) {
        if (chk.kind !== 'radical') continue
        assert.equal(
          chk.promptId.includes(chk.target.zh),
          false,
          `radical prompt leaked target zh in Unit ${unit.unit}: ${chk.promptId}`,
        )
      }
    }
  }
})

test('fresh Lv 1 BeastStageCard and Progress seal all locked lv-02..24 artwork URLs and names', () => {
  for (const member of ['richie', 'renita']) {
    for (const surface of ['beast', 'progress']) {
      const html = renderSurface(surface, member)
      assert.match(html, /lv-01\.webp/, `${member} ${surface} should render unlocked Lv 1 artwork`)
      for (let lv = 2; lv <= 24; lv++) {
        const padded = String(lv).padStart(2, '0')
        assert.equal(
          html.includes(`lv-${padded}.webp`),
          false,
          `${member} ${surface} leaked locked lv-${padded}.webp image URL`,
        )
        const lockedTier = LEGENDARY_BEASTS[lv - 1]
        assert.equal(
          html.includes(lockedTier.zhName),
          false,
          `${member} ${surface} leaked locked beast zhName ${lockedTier.zhName}`,
        )
        assert.equal(
          html.includes(lockedTier.name),
          false,
          `${member} ${surface} leaked locked beast name ${lockedTier.name}`,
        )
        assert.equal(
          html.includes(lockedTier.trainerTitle),
          false,
          `${member} ${surface} leaked locked trainerTitle ${lockedTier.trainerTitle}`,
        )
      }
    }
  }
})

test('onboarding isolates completion per member and generates track-specific 3-slide guides', () => {
  const storage = makeMemoryStorage()
  assert.equal(isOnboardingDone('richie', storage), false)
  assert.equal(isOnboardingDone('renita', storage), false)

  markOnboardingDone('richie', storage)
  assert.equal(isOnboardingDone('richie', storage), true)
  assert.equal(isOnboardingDone('renita', storage), false)

  resetOnboarding('richie', storage)
  assert.equal(isOnboardingDone('richie', storage), false)

  const richieSlides = getOnboardingSlides('richie', 'Richie')
  const renitaSlides = getOnboardingSlides('renita', 'Renita')
  assert.equal(richieSlides.length, 3)
  assert.equal(renitaSlides.length, 3)
  assert.match(richieSlides[0].title, /HSK 4/)
  assert.match(renitaSlides[0].title, /HSK 1 Dari Nol/)
})

test('readCourse and switchCoupleWorkspace isolate Richie on hsk4a and Renita on hsk1 cleanly', () => {
  const storage = makeMemoryStorage()
  assert.equal(readCourse(storage), 'hsk4a')

  switchCoupleWorkspace('renita', storage, { syncPush: false })
  assert.equal(readCourse(storage), 'hsk1')

  // Simulate missing course key when active profile is renita -> still resolves to hsk1
  storage.removeItem('yulu.course.v1')
  assert.equal(readCourse(storage), 'hsk1')

  switchCoupleWorkspace('richie', storage, { syncPush: false })
  assert.equal(readCourse(storage), 'hsk4a')

  // Switching back to same profile ensures course key is populated cleanly
  switchCoupleWorkspace('renita', storage, { syncPush: false })
  storage.removeItem('yulu.course.v1')
  switchCoupleWorkspace('renita', storage, { syncPush: false })
  assert.equal(readCourse(storage), 'hsk1')
})
