import manifest from '../data/hsk4a-audio.json'
import { createClipResolver, trackUrl, type AudioManifest } from './bookAudioIndex'
import { setClipResolver } from './speech'

/**
 * Where the publisher recordings are served from. They are not in git: run
 * `node scripts/fetch-book-audio.mjs` to install them into public/audio/hsk4a.
 */
const BASE = (import.meta.env.VITE_BOOK_AUDIO_BASE as string | undefined) || '/audio/hsk4a/'

let installed = false

/** Recordings are optional. Without them every line keeps the neural voice. */
async function recordingsInstalled(): Promise<boolean> {
  try {
    const res = await fetch(trackUrl(BASE, 'L01-1'), { method: 'HEAD' })
    // A static host that rewrites unknown paths to index.html answers 200 with HTML.
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('audio/')
  } catch { return false }
}

export function initBookAudio() {
  setClipResolver(createClipResolver(manifest as unknown as AudioManifest, BASE, () => installed))
  void recordingsInstalled().then((ok) => { installed = ok })
}
