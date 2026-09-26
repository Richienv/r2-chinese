/**
 * Neural Mandarin playback.
 * Fetches /api/tts (Edge Read Aloud, zh-CN neural voices), caches the mp3 for
 * the session, and plays it on one <audio> element unlocked by the first tap.
 * Web Speech is only the fallback when that endpoint cannot be reached.
 */

export type SpeakOpts = {
  voice?: string
  rate?: number
  /** Stable id so a button can show the playing state. */
  key?: string
  /** Group id, e.g. a whole dialogue, that stays "playing" across its lines. */
  group?: string
}

type Status = 'idle' | 'loading' | 'playing'

type Snapshot = { key: string; group: string; status: Status }

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'
const DEFAULT_RATE = -8

let enabled = true
let defaultVoice = DEFAULT_VOICE
let audio: HTMLAudioElement | null = null
let seq = 0
let snapshot: Snapshot = { key: '', group: '', status: 'idle' }

const cache = new Map<string, Promise<string>>()
const listeners = new Set<() => void>()

export function setSpeechEnabled(on: boolean) {
  if (enabled === on) return
  enabled = on
  if (!on) stopSpeech()
}

export function setVoice(name: string) {
  defaultVoice = name
}

export function getSpeechSnapshot(): Snapshot {
  return snapshot
}

export function subscribeSpeech(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function publish(next: Snapshot) {
  snapshot = next
  for (const fn of listeners) fn()
}

function element(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
    audio.setAttribute('playsinline', '')
    audio.id = 'yulu-voice'
    audio.hidden = true
    document.body.appendChild(audio)
  }
  return audio
}

/** Start the shared element inside a tap so later playback is allowed on iOS. */
export function unlockSpeech() {
  const a = element()
  if (!a.src) {
    a.src =
      'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/4wQAAAAA'
  }
  const pending = a.play()
  if (pending) pending.then(() => a.pause()).catch(() => {})
}

export function stopSpeech() {
  seq += 1
  audio?.pause()
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
  publish({ key: '', group: '', status: 'idle' })
}

function cacheKey(text: string, voice: string, rate: number) {
  return `${voice}|${rate}|${text}`
}

function load(text: string, voice: string, rate: number): Promise<string> {
  const id = cacheKey(text, voice, rate)
  let pending = cache.get(id)
  if (!pending) {
    const params = new URLSearchParams({
      text,
      voice,
      rate: String(rate),
    })
    pending = fetch(`/api/tts?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`tts ${res.status}`)
        const blob = await res.blob()
        if (!blob.size) throw new Error('empty audio')
        return URL.createObjectURL(blob)
      })
      .catch((err) => {
        cache.delete(id)
        throw err
      })
    cache.set(id, pending)
  }
  return pending
}

export function prefetch(text: string, opts?: SpeakOpts) {
  const trimmed = text.trim()
  if (!enabled || !trimmed) return
  const voice = opts?.voice ?? defaultVoice
  const rate = opts?.rate ?? DEFAULT_RATE
  void load(trimmed, voice, rate).catch(() => {})
}

function waitUntilDone(a: HTMLAudioElement, mine: number) {
  return new Promise<void>((resolve) => {
    if (mine !== seq) return resolve()
    const finish = () => {
      a.removeEventListener('ended', finish)
      a.removeEventListener('pause', onPause)
      resolve()
    }
    const onPause = () => {
      if (mine !== seq) finish()
    }
    a.addEventListener('ended', finish)
    a.addEventListener('pause', onPause)
  })
}

function pause(ms: number, mine: number) {
  return new Promise<void>((resolve) => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (mine !== seq || Date.now() - started >= ms) {
        window.clearInterval(timer)
        resolve()
      }
    }, 40)
  })
}

async function playNeural(text: string, voice: string, rate: number, mine: number) {
  const url = await load(text, voice, rate)
  if (mine !== seq) return
  const a = element()
  a.pause()
  a.src = url
  a.currentTime = 0
  await a.play()
  await waitUntilDone(a, mine)
}

function playWebSpeech(text: string, mine: number) {
  return new Promise<void>((resolve) => {
    if (mine !== seq || typeof window === 'undefined' || !window.speechSynthesis) return resolve()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.92
    const match = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'))
    if (match) utterance.voice = match
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

async function playOne(text: string, opts: SpeakOpts | undefined, mine: number) {
  const trimmed = text.trim()
  if (!enabled || !trimmed || mine !== seq) return
  const voice = opts?.voice ?? defaultVoice
  const rate = opts?.rate ?? DEFAULT_RATE
  const key = opts?.key ?? cacheKey(trimmed, voice, rate)
  publish({ key, group: opts?.group ?? '', status: 'loading' })
  try {
    await playNeural(trimmed, voice, rate, mine)
  } catch {
    if (mine !== seq) return
    await playWebSpeech(trimmed, mine)
  }
}

/** Speak one phrase. A new call stops whatever is playing. */
export function speak(text: string, opts?: SpeakOpts): Promise<void> {
  if (!enabled || !text.trim()) return Promise.resolve()
  const mine = ++seq
  return playOne(text, opts, mine).finally(() => {
    if (mine === seq) publish({ key: '', group: '', status: 'idle' })
  })
}

/** Speak dialogue lines in order, each with its own voice, with a short breath between them. */
export function speakLines(lines: Array<{ text: string; voice?: string; rate?: number }>, opts?: SpeakOpts): Promise<void> {
  const audible = lines.filter((line) => line.text.trim())
  if (!enabled || audible.length === 0) return Promise.resolve()
  const mine = ++seq
  const group = opts?.group ?? opts?.key ?? 'lines'
  return (async () => {
    for (let i = 0; i < audible.length; i++) {
      if (mine !== seq || !enabled) return
      const line = audible[i]
      await playOne(
        line.text,
        {
          voice: line.voice,
          rate: line.rate,
          key: cacheKey(line.text.trim(), line.voice ?? defaultVoice, line.rate ?? DEFAULT_RATE),
          group,
        },
        mine,
      )
      if (i < audible.length - 1) await pause(160, mine)
    }
  })().finally(() => {
    if (mine === seq) publish({ key: '', group: '', status: 'idle' })
  })
}
