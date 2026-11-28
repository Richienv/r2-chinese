import { getSpeechSnapshot, subscribeSpeech } from './speech'
import { createStudyMusicPlayer, type MusicTrack } from './studyMusicEngine'
import { STUDY_TRACKS } from './studyTracks'
import {
  getSyncPlayableAudioUrl,
  initStudyMusicCache,
  prioritizeMusicTrackCache,
  resolvePlayableAudioUrl,
} from './studyMusicCache'
export { STUDY_TRACKS } from './studyTracks'

let player: ReturnType<typeof createStudyMusicPlayer> | undefined
let persistentRootAudio: HTMLAudioElement | undefined
let mediaHandlersRegistered = false

function getPersistentRootAudio(): HTMLAudioElement {
  if (persistentRootAudio) return persistentRootAudio
  const existing = typeof document !== 'undefined' ? document.getElementById('yulu-study-music') : null
  if (existing && existing instanceof HTMLAudioElement) {
    persistentRootAudio = existing
    return existing
  }
  const el = new Audio()
  el.id = 'yulu-study-music'
  el.setAttribute('playsinline', '')
  el.setAttribute('webkit-playsinline', '')
  el.preload = 'auto'
  el.style.display = 'none'
  if (typeof document !== 'undefined' && document.body) {
    document.body.appendChild(el)
  }
  persistentRootAudio = el
  return el
}

function updateMediaSession({
  track,
  playing,
  position,
  duration,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onSeek,
}: {
  track: MusicTrack
  playing: boolean
  position?: number
  duration?: number
  onPlay: () => void
  onPause: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (time: number) => void
}) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  try {
    if (typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({
        title: track.title || 'Study Music',
        artist: track.artist || 'Yulu Focus',
        album: 'Yulu · Study Music',
        artwork: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      })
    }
    ms.playbackState = playing ? 'playing' : 'paused'
    if (
      typeof ms.setPositionState === 'function' &&
      typeof duration === 'number' &&
      Number.isFinite(duration) &&
      duration > 0
    ) {
      const clampedPos = Math.max(0, Math.min(duration, position ?? 0))
      ms.setPositionState({ duration, playbackRate: 1, position: clampedPos })
    }
    if (!mediaHandlersRegistered) {
      mediaHandlersRegistered = true
      ms.setActionHandler('play', onPlay)
      ms.setActionHandler('pause', onPause)
      ms.setActionHandler('stop', onPause)
      ms.setActionHandler('previoustrack', onPrev)
      ms.setActionHandler('nexttrack', onNext)
      ms.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') onSeek(details.seekTime)
      })
    }
  } catch {
    /* Older browsers may reject specific MediaSession properties cleanly. */
  }
}

export function studyMusicPlayer() {
  if (!player) {
    let storage: Storage | undefined
    try {
      storage = localStorage
    } catch {
      /* Preference persistence is optional. */
    }
    // Use pure persistent HTML5 <audio> without trapping through AudioContext
    // so iOS Safari, Android Chrome, and PWA background/lock-screen playback stay alive.
    player = createStudyMusicPlayer(STUDY_TRACKS, {
      audio: getPersistentRootAudio,
      storage,
      resolveSrcSync: (track) => getSyncPlayableAudioUrl(track.id),
      resolveSrc: (track) => resolvePlayableAudioUrl(track),
      onTrackActivate: (track) => prioritizeMusicTrackCache(track.id),
      syncMediaSession: updateMediaSession,
    })
    const duckSpeech = () => player!.duckSource('speech', getSpeechSnapshot().status === 'playing')
    subscribeSpeech(duckSpeech)
    duckSpeech()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => player!.checkSleep())
    }
    initStudyMusicCache(player.snapshot().trackId)
  }
  return player
}
