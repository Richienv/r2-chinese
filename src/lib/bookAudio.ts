import manifest from '../data/hsk4a-audio.json'
import interviewManifest from '../data/jiayin-audio.json'
import { createClipResolver, trackUrl, type AudioManifest } from './bookAudioIndex'
import { setClipResolver } from './speech'

/**
 * Where the publisher recordings are served from: public/audio/hsk4a, or
 * VITE_BOOK_AUDIO_BASE. `node scripts/fetch-book-audio.mjs` re-fetches them.
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
  const publisher = createClipResolver(manifest as unknown as AudioManifest, BASE, () => installed)
  const interview = createClipResolver(interviewManifest as unknown as AudioManifest, '/audio/jiayin/')
  // Preserve the textbook recording whenever it matches. Interview clips cover
  // the supplied material even when neural TTS and browser voices are unavailable.
  setClipResolver(text => publisher(text) ?? interview(text))
  void recordingsInstalled().then((ok) => { installed = ok })
}
