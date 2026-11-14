import { getSpeechSnapshot, subscribeSpeech } from './speech'

/** Local study track. Not committed — see .gitignore. */
export const STUDY_TRACK = '/study-lofi.m4a'
const KEY = 'yulu.study-music.v1'
const DUCK = 0.18

type Saved = { on: boolean; volume: number }

let audio: HTMLAudioElement | null = null
let volume = 0.35
let on = false
let speechOn = false
const listeners = new Set<() => void>()

function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { on: false, volume: 0.35 }
    const parsed = JSON.parse(raw) as Partial<Saved>
    const nextVolume = typeof parsed.volume === 'number' ? parsed.volume : 0.35
    return { on: parsed.on === true, volume: Math.min(1, Math.max(0, nextVolume)) }
  } catch {
    return { on: false, volume: 0.35 }
  }
}

function writeSaved() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ on, volume }))
  } catch {
    /* the choice just will not persist */
  }
}

function emit() {
  for (const fn of listeners) fn()
}

function element(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(STUDY_TRACK)
    audio.loop = true
    audio.preload = 'auto'
    audio.id = 'yulu-study-music'
    const saved = readSaved()
    volume = saved.volume
    on = saved.on
  }
  return audio
}

function applyVolume() {
  const node = element()
  node.volume = speechOn ? volume * DUCK : volume
}

function watchSpeech() {
  subscribeSpeech(() => {
    const speaking = getSpeechSnapshot().status === 'playing'
    if (speaking === speechOn) return
    speechOn = speaking
    applyVolume()
    emit()
  })
}

let watched = false

export function studyMusicState() {
  return { on, volume, ducked: speechOn }
}

export function subscribeStudyMusic(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export async function setStudyMusic(next: boolean): Promise<void> {
  if (!watched) {
    watched = true
    watchSpeech()
  }
  const node = element()
  on = next
  speechOn = getSpeechSnapshot().status === 'playing'
  applyVolume()
  writeSaved()
  if (next) {
    try {
      await node.play()
    } catch {
      on = false
      writeSaved()
    }
  } else {
    node.pause()
  }
  emit()
}

export function setStudyVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  applyVolume()
  writeSaved()
  emit()
}
