import { getSpeechSnapshot, subscribeSpeech } from './speech'
import { createStudyMusicPlayer } from './studyMusicEngine'
import { STUDY_TRACKS } from './studyTracks'
export { STUDY_TRACKS } from './studyTracks'

let player: ReturnType<typeof createStudyMusicPlayer> | undefined
export function studyMusicPlayer() {
  if (!player) {
    let storage: Storage | undefined
    try { storage = localStorage } catch { /* Preference persistence is optional. */ }
    player = createStudyMusicPlayer(STUDY_TRACKS, {
      audio: () => new Audio(),
      context: () => new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(),
      storage,
    })
    const duck = () => player!.duck(getSpeechSnapshot().status === 'playing')
    subscribeSpeech(duck)
    duck()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => player!.checkSleep())
  }
  return player
}
