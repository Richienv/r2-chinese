import { audioResponse, mandarinVoice, speechChunks } from './audioCache.ts'
import type { BookClip } from './bookAudioIndex.ts'
import { timingAt, type WordTiming } from './speechTiming.ts'
import { t } from './i18n.ts'

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
  source?: 'recording' | 'neural' | 'device'
  offset?: number
  error?: string
}
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'
const DEFAULT_RATE = -8
const idle: SpeechSnapshot = {
  key: '',
  group: '',
  status: 'idle',
  text: '',
  charIndex: null,
  charLength: 0,
  timing: 'line',
}
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
// Exact book lines and vocabulary play the publisher's recording when it is
// installed; everything else (and any missing recording) uses the neural voice.
let clipFor: (text: string) => BookClip | null = () => null
const warmed = new Set<string>()

export function setClipResolver(resolve: (text: string) => BookClip | null) {
  clipFor = resolve
}
export function setSpeechEnabled(on: boolean) {
  if (enabled === on) return
  enabled = on
  if (!on) stopSpeech()
}
export function setVoice(name: string) {
  defaultVoice = name
}
export function getSpeechSnapshot(): SpeechSnapshot {
  return snapshot
}
export function subscribeSpeech(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
function publish(next: SpeechSnapshot) {
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
/** Unlock once inside a user gesture without interrupting an active clip. */
export function unlockSpeech() {
  const a = element()
  if (a.src) return
  a.src =
    'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/4wQAAAAA'
  const mine = seq
  void a
    .play()
    ?.then(() => {
      if (mine === seq && snapshot.status === 'idle') a.pause()
    })
    .catch(() => {})
}
function begin(): number {
  seq += 1
  for (const cancel of [...cancellations]) cancel()
  audio?.pause()
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  return seq
}
export function stopSpeech() {
  begin()
  publish(idle)
}
function cacheKey(text: string, voice: string, rate: number) {
  return `${voice}|${rate}|${text}`
}
function load(text: string, voice: string, rate: number, timings = false): Promise<Clip> {
  const id = `${cacheKey(text, voice, rate)}|${timings}`
  let pending = cache.get(id)
  if (!pending) {
    const params = new URLSearchParams({
      text,
      voice,
      rate: String(rate),
      ...(timings ? { timings: '1' } : {}),
    })
    pending = audioResponse(`/api/tts?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`tts ${res.status}`)
        if (timings) {
          const data = (await res.json()) as { audio?: string; words?: WordTiming[] }
          if (!data.audio) throw new Error('empty audio')
          const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))
          const words = (Array.isArray(data.words) ? data.words : [])
            .filter(
              (word) =>
                Number.isFinite(word.start) &&
                word.start >= 0 &&
                Number.isFinite(word.duration) &&
                word.duration >= 0 &&
                Number.isInteger(word.charIndex) &&
                word.charIndex >= 0 &&
                Number.isInteger(word.charLength) &&
                word.charLength > 0 &&
                word.charIndex + word.charLength <= text.length,
            )
            .sort((a, b) => a.start - b.start)
          return { url: URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })), words }
        }
        const blob = await res.blob()
        if (!blob.size) throw new Error('empty audio')
        return { url: URL.createObjectURL(blob), words: [] }
      })
      .catch((err) => {
        cache.delete(id)
        throw err
      })
    cache.set(id, pending)
    if (cache.size > 220) {
      const oldest = cache.keys().next().value!
      const clip = cache.get(oldest)!
      cache.delete(oldest)
      void clip
        .then(({ url }) => {
          if (audio?.src !== url) URL.revokeObjectURL(url)
        })
        .catch(() => {})
    }
  }
  return pending
}
export function prefetch(text: string, opts?: SpeakOpts) {
  const trimmed = text.trim()
  if (!enabled || !trimmed) return
  if (trimmed.length > 350) {
    prefetch(speechChunks(trimmed)[0].text, opts)
    return
  }
  const recorded = clipFor(trimmed)
  if (recorded) return warm(recorded.url)
  void load(trimmed, opts?.voice ?? defaultVoice, opts?.rate ?? DEFAULT_RATE, opts?.trackWords).catch(
    () => {},
  )
}
/** Pull a whole track into the browser cache once, so seeking into it is instant. */
function warm(url: string) {
  if (warmed.has(url) || typeof fetch === 'undefined') return
  warmed.add(url)
  void fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error('Audio prefetch failed')
      return res.blob()
    })
    .catch(() => {
      warmed.delete(url)
    })
}
/** Cancellation settles network waits; the cached download may finish. */
function cancellable<T>(work: Promise<T>, mine: number): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (mine !== seq) return resolve(undefined)
    const cancel = () => {
      cancellations.delete(cancel)
      resolve(undefined)
    }
    cancellations.add(cancel)
    work.then(
      (value) => {
        cancellations.delete(cancel)
        resolve(mine === seq ? value : undefined)
      },
      (err) => {
        cancellations.delete(cancel)
        if (mine === seq) reject(err)
        else resolve(undefined)
      },
    )
  })
}
/**
 * Maps TTS rate offsets to real playback tempo:
 * - normal (>= -18): 1.0x natural clarity
 * - gently slower (-30 .. -19): 0.78x
 * - unmistakably slow pelan (< -30): 0.58x (with preservesPitch = true)
 */
export function playbackSpeedForRate(rate: number): number {
  return rate >= -18 ? 1 : rate >= -30 ? 0.85 : 0.58
}

async function playNeural(
  text: string,
  voice: string,
  rate: number,
  tracked: boolean,
  mine: number,
  base: SpeechSnapshot,
): Promise<boolean> {
  // For genuine slow pelan (< -25), fetch clear native-contour audio (-8) and slow it via preservesPitch
  // so Mandarin tone pitch contours stay natural and undistorted while stretching duration to 0.58x.
  const playbackSpeed = playbackSpeedForRate(rate)
  const synthRate = rate < -25 ? -8 : rate
  const clip = await cancellable(load(text, voice, synthRate, tracked), mine)
  if (!clip || mine !== seq) return false
  const a = element()
  a.src = clip.url
  a.currentTime = 0
  a.defaultPlaybackRate = playbackSpeed
  a.playbackRate = playbackSpeed
  a.preservesPitch = true
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
        publish({
          ...base,
          status: 'playing',
          timing: 'words',
          charIndex: word.charIndex + (base.offset ?? 0),
          charLength: word.charLength,
        })
      }
      if (clip.words.length) frame = requestAnimationFrame(follow)
    }
    cancellations.add(cancel)
    a.addEventListener('ended', ended)
    a.addEventListener('error', failed)
    void a
      .play()
      .then(() => {
        if (finished || mine !== seq) return
        a.playbackRate = playbackSpeed
        a.preservesPitch = true
        publish({ ...base, status: 'playing', timing: clip.words.length ? 'words' : 'line' })
        follow()
      })
      .catch((err) => finish(false, err))
  })
}
/** The TTS speed scale maps to the recording's tempo: normal, a little slower, genuinely slow pelan. */
function recordedSpeed(rate: number) {
  return playbackSpeedForRate(rate)
}
function sameTrack(a: HTMLAudioElement, url: string) {
  return !!a.src && (a.src === url || a.src.endsWith(url))
}
/** Plays one stretch of a publisher track, then stops at the end of that line or word. */
function playRecorded(book:BookClip,rate:number,mine:number,base:SpeechSnapshot):Promise<boolean>{
  const a=element(),speed=recordedSpeed(rate)
  return new Promise((resolve,reject)=>{
    if(mine!==seq)return resolve(false)
    let frame=0,timer:ReturnType<typeof setTimeout>,finished=false,started=false,lastIndex:number|null=null
    function finish(completed:boolean,error?:Error){
      if(finished)return
      finished=true;cancelAnimationFrame(frame);clearTimeout(timer)
      a.removeEventListener('ended',ended);a.removeEventListener('error',failed)
      a.removeEventListener('loadedmetadata',seek);a.removeEventListener('seeked',startPlayback)
      cancellations.delete(cancel)
      if(mine===seq)a.pause()
      if(error)reject(error);else resolve(completed)
    }
    const cancel=()=>finish(false)
    const ended=()=>{const complete=mine===seq&&a.currentTime>=book.end-.12;finish(complete,complete?undefined:new Error('incomplete recording'))}
    const failed=()=>finish(false,new Error('recording could not load'))
    function follow(){
      if(finished||mine!==seq)return
      if(a.currentTime>=book.end)return finish(true)
      const word=timingAt(book.words,a.currentTime-book.start)
      if(word&&word.charIndex!==lastIndex){lastIndex=word.charIndex;publish({...base,status:'playing',timing:'words',charIndex:word.charIndex+(base.offset??0),charLength:word.charLength})}
      frame=requestAnimationFrame(follow)
    }
    function startPlayback(){
      if(finished||started||mine!==seq)return
      // Wait for the actual seek. A loading track must not play from second zero.
      if(typeof a.readyState==='number'&&(a.seeking||Math.abs(a.currentTime-book.start)>.15))return
      started=true
      void a.play().then(()=>{
        if(finished||mine!==seq)return
        clearTimeout(timer)
        publish({...base,status:'playing',timing:book.words.length?'words':'line'})
        timer=setTimeout(()=>{const complete=a.currentTime>=book.end-.12;finish(complete,complete?undefined:new Error('recording stalled'))},((book.end-book.start)/speed)*1000+600)
        follow()
      }).catch(error=>finish(false,error))
    }
    function seek(){
      if(finished||mine!==seq)return
      a.currentTime=book.start
      if(!a.seeking)startPlayback()
    }
    cancellations.add(cancel)
    a.addEventListener('ended',ended);a.addEventListener('error',failed)
    a.addEventListener('loadedmetadata',seek);a.addEventListener('seeked',startPlayback)
    if(!sameTrack(a,book.url))a.src=book.url
    a.defaultPlaybackRate=speed;a.playbackRate=speed;a.preservesPitch=true
    timer=setTimeout(()=>finish(false,new Error('recording timed out')),10000)
    if(typeof a.readyState!=='number'||a.readyState>=1)seek()
    else a.load()
  })
}
function playWebSpeech(text: string, rate: number, mine: number, base: SpeechSnapshot): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (mine !== seq) return resolve(false)
    if (typeof window === 'undefined' || !window.speechSynthesis)
      return reject(new Error('speech unavailable'))
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    const speed = playbackSpeedForRate(rate)
    utterance.rate = Math.max(0.5, speed < 1 ? speed : 1 + rate / 150)
    const voice = mandarinVoice(window.speechSynthesis.getVoices())
    if (voice) utterance.voice = voice
    const finish = (done: boolean) => {
      cancellations.delete(cancel)
      resolve(done)
    }
    const cancel = () => finish(false)
    cancellations.add(cancel)
    utterance.onstart = () => {
      if (mine === seq) publish({ ...base, status: 'playing' })
    }
    utterance.onboundary = (event) => {
      if (mine !== seq || event.name !== 'word') return
      publish({
        ...base,
        status: 'playing',
        timing: 'words',
        charIndex: event.charIndex + (base.offset ?? 0),
        charLength: event.charLength || 1,
      })
    }
    utterance.onend = () => finish(mine === seq)
    utterance.onerror = () => {
      cancellations.delete(cancel)
      if (mine === seq) reject(new Error('speech unavailable'))
      else resolve(false)
    }
    window.speechSynthesis.speak(utterance)
  })
}
async function playOne(
  text: string,
  opts: SpeakOpts | undefined,
  mine: number,
  original?: string,
  offset = 0,
): Promise<boolean> {
  if (text.length > 350) {
    for (const chunk of speechChunks(text)) {
      if (!(await playOne(chunk.text, opts, mine, text, chunk.offset))) return false
    }
    return true
  }
  const trimmed = text.trim()
  if (!enabled || !trimmed || mine !== seq) return false
  const voice = opts?.voice ?? defaultVoice
  const rate = opts?.rate ?? DEFAULT_RATE
  const base: SpeechSnapshot = {
    ...idle,
    key: opts?.key ?? cacheKey(trimmed, voice, rate),
    group: opts?.group ?? '',
    text: original ?? trimmed,
    offset: original ? offset + text.indexOf(trimmed) : 0,
    status: 'loading',
  }
  publish(base)
  const recorded = clipFor(trimmed)
  if (recorded) {
    try {
      return await playRecorded(recorded, rate, mine, { ...base, source: 'recording' })
    } catch {
      if (mine !== seq) return false
      recorded.fail()
    }
  }
  try {
    return await playNeural(trimmed, voice, rate, !!opts?.trackWords, mine, { ...base, source: 'neural' })
  } catch {
    if (mine !== seq) return false
    return playWebSpeech(trimmed, rate, mine, { ...base, source: 'device' })
  }
}
function run(work: (mine: number) => Promise<boolean>): Promise<boolean> {
  if (!enabled) {
    publish({ ...idle, error: t('Sound is off. Enable it to listen.') })
    return Promise.resolve(false)
  }
  const mine = begin()
  return work(mine)
    .then((completed) => {
      if (mine === seq) publish({ ...snapshot, status: 'idle', charIndex: null, charLength: 0 })
      return completed
    })
    .catch(() => {
      if (mine === seq)
        publish({
          ...snapshot,
          status: 'idle',
          error: t('Audio could not play. Check your connection and try again.'),
        })
      return false
    })
}
/** False means interrupted or unavailable, never a completed listening rep. */
export function speak(text: string, opts?: SpeakOpts): Promise<boolean> {
  return run((mine) => playOne(text, opts, mine))
}
export function speakLines(
  lines: Array<{ text: string; voice?: string; rate?: number }>,
  opts?: SpeakOpts,
): Promise<boolean> {
  const audible = lines.filter((line) => line.text.trim())
  return run(async (mine) => {
    const group = opts?.group ?? opts?.key ?? 'lines'
    for (let i = 0; i < audible.length; i++) {
      if (mine !== seq || !enabled) return false
      opts?.onLine?.(i)
      const line = audible[i]
      if (audible[i + 1]) prefetch(audible[i + 1].text, { ...opts, ...audible[i + 1] })
      if (
        !(await playOne(
          line.text,
          {
            ...opts,
            ...line,
            group,
            key: cacheKey(line.text.trim(), line.voice ?? defaultVoice, line.rate ?? DEFAULT_RATE),
          },
          mine,
        ))
      )
        return false
      if (i < audible.length - 1)
        await cancellable(new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 180)), mine)
    }
    return audible.length > 0 && mine === seq
  })
}
