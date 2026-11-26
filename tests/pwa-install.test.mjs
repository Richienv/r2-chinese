import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INSTALL_DISMISS_KEY,
  INSTALL_DISMISS_TTL_MS,
  detectPlatform,
  dismissInstallPrompt,
  isInstallPromptDismissed,
} from '../src/lib/install.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

function readPngHeader(filePath) {
  const buf = fs.readFileSync(filePath)
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${filePath} should be a valid PNG`)
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const bitDepth = buf[24]
  const colorType = buf[25]
  return { width, height, bitDepth, colorType }
}

test('detectPlatform identifies standalone, iOS Safari, iOS in-app/Chrome, Android, Desktop, and unknown', () => {
  assert.equal(detectPlatform({ displayStandalone: true, userAgent: 'Mozilla/5.0 (iPhone)' }), 'installed')
  assert.equal(detectPlatform({ standalone: true, userAgent: 'Mozilla/5.0 (iPhone)' }), 'installed')

  assert.equal(
    detectPlatform({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    }),
    'ios-safari',
  )
  assert.equal(
    detectPlatform({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      maxTouchPoints: 5,
    }),
    'ios-safari',
  )

  assert.equal(
    detectPlatform({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1',
    }),
    'ios-other',
  )
  assert.equal(
    detectPlatform({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50(0x18003235) NetType/WIFI Language/zh_CN',
    }),
    'ios-other',
  )
  assert.equal(
    detectPlatform({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 WeChat/8.0',
    }),
    'ios-other',
  )

  assert.equal(
    detectPlatform({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    }),
    'android',
  )
  assert.equal(
    detectPlatform({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      maxTouchPoints: 0,
    }),
    'desktop',
  )
  assert.equal(detectPlatform({ userAgent: '' }), 'unknown')
})

test('dismissInstallPrompt stores a 30-day dismissal timestamp in localStorage', () => {
  const prevStorage = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, String(v))
    },
    removeItem: (k) => {
      store.delete(k)
    },
    clear: () => {
      store.clear()
    },
    key: () => null,
    length: 0,
  }
  try {
    const t0 = 1_700_000_000_000
    assert.equal(isInstallPromptDismissed(t0), false)
    dismissInstallPrompt(t0)
    assert.equal(store.get(INSTALL_DISMISS_KEY), String(t0))
    assert.equal(isInstallPromptDismissed(t0 + 1_000), true)
    assert.equal(isInstallPromptDismissed(t0 + INSTALL_DISMISS_TTL_MS - 1), true)
    assert.equal(isInstallPromptDismissed(t0 + INSTALL_DISMISS_TTL_MS), false)
  } finally {
    if (prevStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = prevStorage
  }
})

test('public/manifest.webmanifest, public/sw.js, index.html, and icon assets are valid and complete', () => {
  const manifestPath = path.join(root, 'public', 'manifest.webmanifest')
  assert.equal(fs.existsSync(manifestPath), true)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.equal(manifest.name, 'Yulu · Mandarin HSK')
  assert.equal(manifest.short_name, 'Yulu')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/?source=pwa')
  assert.equal(manifest.background_color, '#edf3ef')
  assert.equal(manifest.theme_color, '#edf3ef')
  assert.deepEqual(
    manifest.icons.map((i) => [i.src, i.sizes, i.purpose]),
    [
      ['/icons/icon-192.png', '192x192', 'any'],
      ['/icons/icon-512.png', '512x512', 'any'],
      ['/icons/icon-maskable-512.png', '512x512', 'maskable'],
    ],
  )
  assert.deepEqual(
    manifest.shortcuts.map((s) => s.url),
    ['/?action=review', '/?action=exam'],
  )

  const expectedPngs = [
    ['apple-touch-icon.png', 180, 180],
    ['icon-192.png', 192, 192],
    ['icon-512.png', 512, 512],
    ['icon-maskable-512.png', 512, 512],
  ]
  for (const [name, width, height] of expectedPngs) {
    const file = path.join(root, 'public', 'icons', name)
    assert.equal(fs.existsSync(file), true, `${name} should exist`)
    const hdr = readPngHeader(file)
    assert.equal(hdr.width, width, `${name} width`)
    assert.equal(hdr.height, height, `${name} height`)
    // PNG color type 2 = strictly opaque RGB (no alpha channel for iOS apple-touch-icon safety)
    assert.equal(hdr.colorType, 2, `${name} must be opaque RGB`)
  }

  const svgPath = path.join(root, 'public', 'icons', 'favicon.svg')
  assert.equal(fs.existsSync(svgPath), true)
  const svg = fs.readFileSync(svgPath, 'utf8')
  assert.match(svg, /<svg[\s\S]*语[\s\S]*<\/svg>/)
  assert.match(svg, /#27665f/)

  const swPath = path.join(root, 'public', 'sw.js')
  assert.equal(fs.existsSync(swPath), true)
  const sw = fs.readFileSync(swPath, 'utf8')
  assert.match(sw, /v1-yulu-pwa/)
  assert.match(sw, /skipWaiting/)
  assert.match(sw, /clients\.claim/)
  assert.match(sw, /\/api\//)
  assert.match(sw, /skip-waiting/)

  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  assert.match(html, /rel="manifest"\s+href="\/manifest\.webmanifest"/)
  assert.match(html, /rel="apple-touch-icon"\s+sizes="180x180"\s+href="\/icons\/apple-touch-icon\.png"/)
  assert.match(html, /rel="icon"\s+type="image\/svg\+xml"\s+href="\/icons\/favicon\.svg"/)
  assert.match(html, /rel="icon"\s+type="image\/png"\s+sizes="192x192"\s+href="\/icons\/icon-192\.png"/)
  assert.match(html, /viewport-fit=cover/)
  assert.match(html, /window\.__yuluBip/)
})

test('120Hz scroll and safe-area invariants stay intact across phone.ts, App.tsx, and CSS', () => {
  const phone = fs.readFileSync(path.join(root, 'src', 'lib', 'phone.ts'), 'utf8')
  assert.match(phone, /requestAnimationFrame/)
  // Non-passive touchmove must NOT be registered permanently at effect setup time
  const useEdgeSection = phone.slice(phone.indexOf('export function useEdgeSwipeClose'))
  assert.equal(
    /document\.addEventListener\('touchstart'[\s\S]*\)\s*document\.addEventListener\('touchmove'/.test(useEdgeSection),
    false,
  )

  const app = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8')
  assert.match(app, /observer\?\.disconnect\(\)/)
  assert.match(app, /action === 'review'/)
  assert.match(app, /action === 'exam'/)

  const recallCss = fs.readFileSync(path.join(root, 'src', 'styles', 'recall-focus.css'), 'utf8')
  assert.doesNotMatch(recallCss, /backdrop-filter/)
  assert.doesNotMatch(recallCss, /\d+vh\b/)
  assert.match(recallCss, /padding:env\(safe-area-inset-top,0px\) 0 0/)

  const homeCss = fs.readFileSync(path.join(root, 'src', 'styles', 'home-alive.css'), 'utf8')
  assert.doesNotMatch(homeCss, /\d+vh\b/)
  assert.doesNotMatch(homeCss, /backdrop-filter/)
})
