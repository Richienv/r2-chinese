import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { ALL_HSK1_WORDS, HSK1_UNITS } from '../src/data/hsk1.ts'
import { evaluateBeastProgress, LEGENDARY_BEASTS } from '../src/lib/beastEngine.ts'
import { readBeastPrefs } from '../src/lib/beastPrefs.ts'
import { switchCoupleWorkspace } from '../src/lib/coupleProfile.ts'
import { readCourse } from '../src/lib/course.ts'
import { buildVocabWaves, maskHsk1Hint } from '../src/lib/hsk1Srs.ts'
import {
  getOnboardingSlides,
  isOnboardingDone,
  markOnboardingDone,
  resetOnboarding,
} from '../src/lib/onboarding.ts'
import { importLearningStorage } from '../src/lib/progressStorage.ts'
import { sanitizeRenitaStorage } from '../src/lib/renitaIsolation.ts'

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
      contents: `import React, { Suspense } from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { StoreProvider } from './src/store/store';
        import { CourseProvider } from './src/lib/course';
        import { BeastStageCard } from './src/components/BeastStageCard';
        import { Home } from './src/screens/Home';
        import { Progress } from './src/screens/Progress';
        import { ReviewFlow } from './src/screens/Review';
        import { Hsk1HomePath, Hsk1RecallOverlay } from './src/screens/Hsk1';

        export function render(which, activeProfile = 'richie', extraEntries = []) {
          const store = new Map([
            ['yulu.active-profile.v1', activeProfile],
            ['yulu.course.v1', activeProfile === 'renita' ? 'hsk1' : 'hsk4a'],
            ['yulu.course-entered.v1', '1'],
            ...extraEntries,
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
            const noop = () => {};
            let content;
            if (which === 'beast') {
              content = <BeastStageCard onReview={noop} onLearn={noop} />;
            } else if (which === 'review') {
              content = <ReviewFlow words={['法律']} onClose={noop} />;
            } else if (which === 'hsk1recall') {
              content = <Hsk1RecallOverlay onClose={noop} />;
            } else if (which === 'hsk1path') {
              content = <Hsk1HomePath onOpenUnit={noop} onOpenToneLab={noop} onOpenRecall={noop} />;
            } else if (which === 'home') {
              content = (
                <Home
                  onSession={noop}
                  onLesson={noop}
                  onReview={noop}
                  onPlacement={noop}
                  onTrail={noop}
                  onBrowse={noop}
                  onKerjaSession={noop}
                  onJiaochengSession={noop}
                  onJiaochengMidterm={noop}
                  onMagangSession={noop}
                  onInterviewSession={noop}
                  onBooksSession={noop}
                  onJiayinSession={noop}
                  onHsk1Unit={noop}
                  onHsk1Tones={noop}
                  onHsk1Recall={noop}
                  onProgress={noop}
                />
              );
            } else {
              content = <Progress onReview={noop} onLearn={noop} />;
            }
            return renderToStaticMarkup(
              <CourseProvider>
                <StoreProvider initial={{ prefs: { soundOn: false, showPinyin: true, showEnglish: true } }}>
                  <Suspense fallback={null}>{content}</Suspense>
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

test('sanitizeRenitaStorage, importLearningStorage, and evaluateBeastProgress block HSK 4 pollution from Renita', () => {
  const storage = makeMemoryStorage()
  const pollutedBackup = JSON.stringify({
    format: 'yulu-progress-backup',
    entries: {
      'yulu.course.v1': 'hsk4a',
      'yulu.course-entered.v1': '1',
      'yulu.beast.v1': JSON.stringify({
        stageId: 'gold-imperial',
        lastSeenLevel: 4,
        earnedAchievementKeys: ['unaided_15'],
        revealMuted: false,
        updatedAt: 1795826772510,
      }),
      'yulu.hsk4a.v1': JSON.stringify({
        lessonsDone: [1],
        pathDone: { '1': ['t1', 'wrap'] },
        xp: 40,
        log: { '2026-11-28': { lessons: 1, cards: 4 } },
        cards: {
          法律: { zh: '法律', lesson: 1, ease: 2.5, interval: 1, due: 9999999999999, reps: 1 },
          俩: { zh: '俩', lesson: 1, ease: 2.5, interval: 1, due: 9999999999999, reps: 1 },
        },
        mastery: {
          法律: { state: 'mastered', unaidedSuccesses: 3 },
          俩: { state: 'learning', unaidedSuccesses: 1 },
        },
        starred: ['法律'],
      }),
      'yulu.hsk1.v1': JSON.stringify({
        unitsDone: [],
        provenWords: [],
        tonesPassed: 0,
        pinyinPassed: 0,
        strokesPassed: 0,
        grammarPassed: 0,
        bestUnitScores: {},
        nodeDone: {},
        srsCards: {},
        updatedAt: 1795791818886,
      }),
    },
  })

  const res = importLearningStorage(storage, 'yulu.hsk4a.v1', pollutedBackup, { profile: 'renita' })
  assert.equal(res.ok, true)
  assert.equal(storage.getItem('yulu.course.v1'), 'hsk1')

  const mainAfter = JSON.parse(storage.getItem('yulu.hsk4a.v1'))
  assert.equal(mainAfter.xp, 0)
  assert.deepEqual(mainAfter.lessonsDone, [])
  assert.deepEqual(mainAfter.pathDone, {})
  assert.deepEqual(mainAfter.cards, {})
  assert.deepEqual(mainAfter.mastery, {})

  const beastAfter = JSON.parse(storage.getItem('yulu.beast.v1'))
  assert.equal(beastAfter.stageId, 'sakura-unite')
  assert.equal(beastAfter.lastSeenLevel, 1)

  // Evaluating Beast progress on track hsk1 must give 0 spirit power even if raw HSK4 inputs were passed
  const hsk1Eval = evaluateBeastProgress({
    track: 'hsk1',
    mastery: {
      法律: {
        zh: '法律',
        state: 'mastered',
        unaidedSuccesses: 5,
        lastPractice: Date.now(),
        encounters: 5,
        assistedSuccesses: 0,
        lapses: 0,
        modes: {
          recall: { successes: 3, attempts: 3 },
          writing: { successes: 2, attempts: 2 },
          speaking: { successes: 0, attempts: 0 },
        },
      },
    },
    cards: {
      法律: { zh: '法律', lesson: 1, ease: 2.5, interval: 1, due: 9999999999999, reps: 1 },
    },
    lessonsDone: [1],
    pathDone: { '1': ['t1', 'wrap'] },
    streak: 3,
    xp: 40,
    log: { '2026-11-28': { lessons: 1, cards: 4 } },
    history: [{ kind: 'quiz', course: 'hsk4a', t: Date.now(), xp: 100, correct: true }],
    learnerGraph: { version: 1, updatedAt: 0, nodes: {} },
    hsk1Progress: {
      tonesPassed: 0,
      pinyinPassed: 0,
      strokesPassed: 0,
      unitsDone: [],
      provenWords: [],
      grammarPassed: 0,
    },
    todayKey: '2026-11-28',
    nowMs: Date.now(),
  })
  assert.equal(hsk1Eval.spiritPower, 0)
  assert.equal(hsk1Eval.level, 1)

  // Calling sanitizeRenitaStorage again reports idempotent clean state
  assert.equal(sanitizeRenitaStorage(storage), false)
  assert.equal(readCourse({ getItem: (k) => storage.getItem(k) }), 'hsk1')
})

test('Home SSR as Renita stays locked to HSK 1 Dari Nol & Sakura Pink even with polluted HSK 4 storage keys', () => {
  const pollutedRenitaEntries = [
    ['yulu.course.v1', 'hsk4a'],
    ['yulu.course-entered.v1', '1'],
    [
      'yulu.beast.v1',
      JSON.stringify({ stageId: 'sakura-unite', lastSeenLevel: 1, earnedAchievementKeys: [] }),
    ],
  ]
  const html = renderSurface('home', 'renita', pollutedRenitaEntries)
  assert.match(html, /HSK 1 Dari Nol/)
  assert.match(html, /Renita/)
  assert.match(html, /Pondasi/)
  assert.match(html, /Goresan/)
  assert.match(html, /aria-label="Unite Sakura" class="beast-dot-btn is-active"/)
  assert.match(html, /⚡ 0 灵力/)
  assert.equal(html.includes('Simulator'), false)
  assert.equal(html.includes('Skip to lesson'), false)
  assert.equal(html.includes('Simple Love'), false)
  assert.equal(html.includes('简单的爱情'), false)

  // Verify Richie home stays vibrant HSK 4 emerald identity without leaking Sakura default
  const richieHtml = renderSurface('home', 'richie')
  assert.match(richieHtml, /Richie/)
  assert.match(richieHtml, /HSK 4/)
  assert.match(richieHtml, /aria-label="Unite Jade" class="beast-dot-btn is-active"/)

  // Verify ReviewFlow obeys Active Recall BAN 3 & BAN 5 (zero upfront sentence translation + icon-only Check)
  const reviewHtml = renderSurface('review', 'richie')
  assert.equal(reviewHtml.includes('focus-sentence-translation'), false)
  assert.match(reviewHtml, /class="focus-check-icon-btn"/)
  assert.equal(reviewHtml.includes('Right without a hint'), false)

  // Verify Hsk1RecallOverlay (Renita) renders HSK 1 with sound toggle & zero upfront translation spoiler
  const hsk1RecallHtml = renderSurface('hsk1recall', 'renita', [
    [
      'yulu.hsk1.v1',
      JSON.stringify({
        unitsDone: [1],
        provenWords: ['好', '谢谢'],
        tonesPassed: 8,
        pinyinPassed: 7,
        strokesPassed: 5,
        grammarPassed: 2,
      }),
    ],
  ])
  assert.match(hsk1RecallHtml, /Renita/)
  assert.match(hsk1RecallHtml, /hsk1-sound-btn/)
  assert.equal(hsk1RecallHtml.includes('法律'), false)

  // Verify Hsk1HomePath (Renita) renders HSK 1 Pondasi + Unit 1 without any HSK 4 leakage
  const hsk1PathHtml = renderSurface('hsk1path', 'renita')
  assert.match(hsk1PathHtml, /4 Nada/)
  assert.match(hsk1PathHtml, /Salam &amp; Sopan Santun Pertama|Salam & Sopan Santun Pertama/)
  assert.equal(hsk1PathHtml.includes('Simple Love'), false)
  assert.equal(hsk1PathHtml.includes('简单的爱情'), false)

  // Also check readBeastPrefs defaults cleanly to sakura-unite when active profile is renita
  const prevStorage = globalThis.localStorage
  const s = makeMemoryStorage()
  s.setItem('yulu.active-profile.v1', 'renita')
  globalThis.localStorage = s
  try {
    assert.equal(readBeastPrefs().stageId, 'sakura-unite')
  } finally {
    if (prevStorage) globalThis.localStorage = prevStorage
    else delete globalThis.localStorage
  }
})
