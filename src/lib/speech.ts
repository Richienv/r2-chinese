let enabled = true
let voice = 'zh-CN-XiaoxiaoNeural'

export function setSpeechEnabled(on: boolean) {
  enabled = on
  if (!on) stop()
}

export function setVoice(name: string) {
  voice = name
}

// Cache decoded audio per phrase so a repeated word plays instantly and offline
// after its first fetch. The HTTP layer also caches /api/tts, so even a cold
// reload is fast.
const cache = new Map<string, string>()

// One shared, pre-unlocked audio element. iOS only allows playback on an
// element that was first started inside a user gesture, so we unlock it on the
// first tap; afterwards play() works even after the (awaited) fetch resolves.
let player: HTMLAudioElement | null = null
let unlocked = false
const SILENCE =
  'data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA'

function ensurePlayer(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!player) player = new Audio()
  return player
}

function unlock() {
  if (unlocked) return
  const p = ensurePlayer()
  if (!p) return
  unlocked = true
  p.src = SILENCE
  p.play().then(() => p.pause()).catch(() => {})
}

if (typeof window !== 'undefined') {
  const once = () => {
    unlock()
    window.removeEventListener('pointerdown', once)
    window.removeEventListener('touchstart', once)
  }
  window.addEventListener('pointerdown', once, { once: true })
  window.addEventListener('touchstart', once, { once: true })
}

function stop() {
  if (player) {
    player.pause()
  }
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

/** Fallback to the browser's built-in voice when the neural endpoint is unreachable. */
function browserSpeak(text: string) {
  if (typeof window === 'undefined') return
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'zh-CN'
  u.rate = 0.85
  const v = synth.getVoices().find((x) => x.lang.replace('_', '-').startsWith('zh'))
  if (v) u.voice = v
  synth.speak(u)
}

async function fetchAudioUrl(text: string): Promise<string> {
  const key = `${voice}:${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}`)
  if (!res.ok) throw new Error(`tts ${res.status}`)
  const url = URL.createObjectURL(await res.blob())
  cache.set(key, url)
  return url
}

let token: object | null = null

/** Speak `text` with Microsoft's neural Mandarin voice, falling back gracefully. */
export function speak(text: string) {
  if (!enabled || typeof window === 'undefined' || !text) return
  unlock()
  stop()
  const mine = {}
  token = mine
  fetchAudioUrl(text)
    .then((url) => {
      // A newer speak() call superseded this one while we were fetching.
      if (token !== mine || !enabled) return
      const p = ensurePlayer()
      if (!p) return browserSpeak(text)
      p.src = url
      p.play().catch(() => browserSpeak(text))
    })
    .catch(() => {
      if (token === mine) browserSpeak(text)
    })
}
