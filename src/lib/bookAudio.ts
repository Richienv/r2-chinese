import manifest from '../data/hsk4a-audio.json'
import interviewManifest from '../data/jiayin-audio.json'
import { createClipResolver, type AudioManifest } from './bookAudioIndex'
import { setClipResolver } from './speech'

/**
 * Where the publisher recordings are served from: public/audio/hsk4a, or
 * VITE_BOOK_AUDIO_BASE. `node scripts/fetch-book-audio.mjs` re-fetches them.
 */
const BASE = (import.meta.env.VITE_BOOK_AUDIO_BASE as string | undefined) || '/audio/hsk4a/'

// Try the packaged recording directly. A failed connectivity probe must not
// disable every recording for the whole session; each track has its own cooldown.
export function initBookAudio() {
  const publisher = createClipResolver(manifest as unknown as AudioManifest, BASE)
  const interview = createClipResolver(interviewManifest as unknown as AudioManifest, '/audio/jiayin/')
  // Preserve the textbook recording whenever it matches. Interview clips cover
  // the supplied material even when neural TTS and browser voices are unavailable.
  setClipResolver((text) => publisher(text) ?? interview(text))
}
