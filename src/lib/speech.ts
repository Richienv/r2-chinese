import { timingAt, type WordTiming } from './speechTiming.ts'

export type SpeakOpts = {
  voice?: string
  rate?: number
  key?: string
  group?: string
  /** Request real word boundaries from the synthesizer. */
  trackWords?: boolean
  onLine?: (index: number) => void
}
export type SpeechSnapshot = {
  key: string
  group: string
  status: 'idle' | 'loading' | 'playing'
  text: string
  charIndex: number | null
  charLength: number
  timing: 'words' | 'line'
  error?: string
}
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'
const DEFAULT_RATE = -8
const idle: SpeechSnapshot = { key: '', group: '', status: 'idle', text: '', charIndex: null, charLength: 0, timing: 'line' }
let enabled = true
let defaultVoice = DEFAULT_VOICE
let audio: HTMLAudioElement | null = null
let seq = 0
let snapshot = idle
type Clip = { url: string; words: WordTiming[] }
const cache = new Map<string, Promise<Clip>>()
const listeners = new Set<() => void>()
// SpeechSynthesis does not consistently fire onend when cancelled. Resolve
// playback explicitly so stopping a playlist cannot leave it hung.
const cancellations = new Set<() => void>()

export function setSpeechEnabled(on: boolean) {
  if (enabled === on) return
  enabled = on
  if (!on) stopSpeech()
}
export function setVoice(name: string) { defaultVoice = name }
export function getSpeechSnapshot(): SpeechSnapshot { return snapshot }
export function subscribeSpeech(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn) } }
function publish(next: SpeechSnapshot) { snapshot = next; for (const fn of listeners) fn() }
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
/** Unlock once inside a user gesture without interrupting an active clip. */
export function unlockSpeech() {
  const a = element()
  if (a.src) return
  a.src = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/4wQAAAAA'
  const mine = seq
  void a.play()?.then(() => { if (mine === seq && snapshot.status === 'idle') a.pause() }).catch(() => {})
}
function begin(): number {
  seq += 1
  for (const cancel of [...cancellations]) cancel()
  audio?.pause()
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  return seq
}
export function stopSpeech() { begin(); publish(idle) }
function cacheKey(text: string, voice: string, rate: number) { return `${voice}|${rate}|${text}` }
function load(text: string, voice: string, rate: number, timings = false): Promise<Clip> {
  const id = `${cacheKey(text, voice, rate)}|${timings}`
  let pending = cache.get(id)
  if (!pending) {
    const params = new URLSearchParams({ text, voice, rate: String(rate), ...(timings ? { timings: '1' } : {}) })
    pending = fetch(`/api/tts?${params}`).then(async (res) => {
      if (!res.ok) throw new Error(`tts ${res.status}`)
      if (timings) {
        const data = await res.json() as { audio?: string; words?: WordTiming[] }
        if (!data.audio) throw new Error('empty audio')
        const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))
        const words = (Array.isArray(data.words) ? data.words : []).filter((word) => Number.isFinite(word.start) && word.start >= 0 && Number.isFinite(word.duration) && word.duration >= 0 && Number.isInteger(word.charIndex) && word.charIndex >= 0 && Number.isInteger(word.charLength) && word.charLength > 0 && word.charIndex + word.charLength <= text.length).sort((a, b) => a.start - b.start)
        return { url: URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })), words }
      }
      const blob = await res.blob()
      if (!blob.size) throw new Error('empty audio')
      return { url: URL.createObjectURL(blob), words: [] }
    }).catch((err) => { cache.delete(id); throw err })
    cache.set(id, pending)
    if (cache.size > 220) {
      const oldest = cache.keys().next().value!
      const clip = cache.get(oldest)!
      cache.delete(oldest)
      void clip.then(({ url }) => { if (audio?.src !== url) URL.revokeObjectURL(url) }).catch(() => {})
    }
  }
  return pending
}
export function prefetch(text: string, opts?: SpeakOpts) {
  const trimmed = text.trim()
  if (!enabled || !trimmed) return
  void load(trimmed, opts?.voice ?? defaultVoice, opts?.rate ?? DEFAULT_RATE, opts?.trackWords).catch(() => {})
}
/** Cancellation settles network waits; the cached download may finish. */
function cancellable<T>(work: Promise<T>, mine: number): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (mine !== seq) return resolve(undefined)
    const cancel = () => { cancellations.delete(cancel); resolve(undefined) }
    cancellations.add(cancel)
    work.then((value) => { cancellations.delete(cancel); resolve(mine === seq ? value : undefined) }, (err) => { cancellations.delete(cancel); if (mine === seq) reject(err); else resolve(undefined) })
  })
}
async function playNeural(text: string, voice: string, rate: number, tracked: boolean, mine: number, base: SpeechSnapshot): Promise<boolean> {
  const clip = await cancellable(load(text, voice, rate, tracked), mine)
  if (!clip || mine !== seq) return false
  const a = element()
  a.src = clip.url
  a.currentTime = 0
  return new Promise<boolean>((resolve, reject) => {
    let frame = 0
    let finished = false
    let lastIndex: number | null = null
    function finish(completed: boolean, error?: Error) {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      a.removeEventListener('ended', ended)
      a.removeEventListener('error', failed)
      cancellations.delete(cancel)
      if (error) reject(error)
      else resolve(completed)
    }
    const cancel = () => finish(false)
    const ended = () => finish(mine === seq)
    const failed = () => finish(false, new Error('audio playback failed'))
    const follow = () => {
      if (finished || mine !== seq) return
      const word = timingAt(clip.words, a.currentTime)
      if (word && word.charIndex !== lastIndex) {
        lastIndex = word.charIndex
        publish({ ...base, status: 'playing', timing: 'words', charIndex: word.charIndex, charLength: word.charLength })
      }
      if (clip.words.length) frame = requestAnimationFrame(follow)
    }
    cancellations.add(cancel)
    a.addEventListener('ended', ended)
    a.addEventListener('error', failed)
    void a.play().then(() => {
      if (finished || mine !== seq) return
      publish({ ...base, status: 'playing', timing: clip.words.length ? 'words' : 'line' })
      follow()
    }).catch((err) => finish(false, err))
  })
}
function playWebSpeech(text: string, rate: number, mine: number, base: SpeechSnapshot): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (mine !== seq) return resolve(false)
    if (typeof window === 'undefined' || !window.speechSynthesis) return reject(new Error('speech unavailable'))
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = Math.max(.5, 1 + rate / 100)
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'))
    if (voice) utterance.voice = voice
    const finish = (done: boolean) => { cancellations.delete(cancel); resolve(done) }
    const cancel = () => finish(false)
    cancellations.add(cancel)
    utterance.onstart = () => { if (mine === seq) publish({ ...base, status: 'playing' }) }
    utterance.onboundary = (event) => {
      if (mine !== seq || event.name !== 'word') return
      publish({ ...base, status: 'playing', timing: 'words', charIndex: event.charIndex, charLength: event.charLength || 1 })
    }
    utterance.onend = () => finish(mine === seq)
    utterance.onerror = () => { cancellations.delete(cancel); if (mine === seq) reject(new Error('speech unavailable')); else resolve(false) }
    window.speechSynthesis.speak(utterance)
  })
}
async function playOne(text: string, opts: SpeakOpts | undefined, mine: number): Promise<boolean> {
  const trimmed = text.trim()
  if (!enabled || !trimmed || mine !== seq) return false
  const voice = opts?.voice ?? defaultVoice
  const rate = opts?.rate ?? DEFAULT_RATE
  const base: SpeechSnapshot = { ...idle, key: opts?.key ?? cacheKey(trimmed, voice, rate), group: opts?.group ?? '', text: trimmed, status: 'loading' }
  publish(base)
  try { return await playNeural(trimmed, voice, rate, !!opts?.trackWords, mine, base) }
  catch {
    if (mine !== seq) return false
    return playWebSpeech(trimmed, rate, mine, base)
  }
}
function run(work: (mine: number) => Promise<boolean>): Promise<boolean> {
  if (!enabled) { publish({ ...idle, error: 'Sound is off. Enable it to listen.' }); return Promise.resolve(false) }
  const mine = begin()
  return work(mine).then((completed) => {
    if (mine === seq) publish(idle)
    return completed
  }).catch(() => {
    if (mine === seq) publish({ ...idle, error: 'Audio could not play. Check your connection and try again.' })
    return false
  })
}
/** False means interrupted or unavailable, never a completed listening rep. */
export function speak(text: string, opts?: SpeakOpts): Promise<boolean> { return run((mine) => playOne(text, opts, mine)) }
export function speakLines(lines: Array<{ text: string; voice?: string; rate?: number }>, opts?: SpeakOpts): Promise<boolean> {
  const audible = lines.filter((line) => line.text.trim())
  return run(async (mine) => {
    const group = opts?.group ?? opts?.key ?? 'lines'
    for (let i = 0; i < audible.length; i++) {
      if (mine !== seq || !enabled) return false
      opts?.onLine?.(i)
      const line = audible[i]
      if (!await playOne(line.text, { ...opts, ...line, group, key: cacheKey(line.text.trim(), line.voice ?? defaultVoice, line.rate ?? DEFAULT_RATE) }, mine)) return false
      if (i < audible.length - 1) await cancellable(new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 180)), mine)
    }
    return audible.length > 0 && mine === seq
  })
}
