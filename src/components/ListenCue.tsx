import { useAutoSpeak, useSpeechActive } from './Hear'
import { speak, stopSpeech, unlockSpeech } from '../lib/speech'
import { VOICE, WORD_RATE } from '../lib/voices'

const SLOW_RATE = -38

/**
 * The cue for a listening round. The word plays on its own when the round opens
 * (the book's native-speaker recording when it has one), and the rings move only
 * while sound is really playing.
 */
export function ListenCue({ text }: { text: string }) {
  useAutoSpeak(text, VOICE.xiaoxiao, WORD_RATE)
  const normalKey = `${VOICE.xiaoxiao}|${WORD_RATE}|${text}`
  const slowKey = `${VOICE.xiaoxiao}|${SLOW_RATE}|${text}`
  const normal = useSpeechActive(normalKey)
  const slow = useSpeechActive(slowKey)
  const playing = normal || slow

  function play(rate: number, key: string, active: boolean) {
    if (active) stopSpeech()
    else void speak(text, { voice: VOICE.xiaoxiao, rate, key, trackWords: true })
  }

  return (
    <div className="listen-cue" data-playing={playing}>
      <button
        type="button"
        className="listen-cue-button"
        aria-label={normal ? 'Stop the word' : 'Hear the word'}
        aria-pressed={normal}
        onPointerDown={() => unlockSpeech()}
        onClick={() => play(WORD_RATE, normalKey, normal)}
      >
        <span className="listen-cue-rings" aria-hidden="true"><i /><i /><i /></span>
        <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
          {normal
            ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            : <path d="M5 9.5v5h3.4L13 19V5L8.4 9.5H5zm11.2-1.7a5.2 5.2 0 0 1 0 8.4l-1.1-1.5a3.3 3.3 0 0 0 0-5.4l1.1-1.5zm2.4-3a8.6 8.6 0 0 1 0 14.4l-1.1-1.5a6.7 6.7 0 0 0 0-11.4l1.1-1.5z" />}
        </svg>
      </button>
      <button
        type="button"
        className="listen-cue-slow"
        aria-pressed={slow}
        onPointerDown={() => unlockSpeech()}
        onClick={() => play(SLOW_RATE, slowKey, slow)}
      >
        {slow ? 'Playing slowly' : 'Slower'}
      </button>
    </div>
  )
}
