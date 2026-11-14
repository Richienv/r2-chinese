import { useSpeechSnapshot } from './Hear'
import { speak, stopSpeech } from '../lib/speech'
import { t } from '../lib/i18n'
export function AudioStatus() {
  const snapshot = useSpeechSnapshot()
  if (!snapshot.error) return null
  return (
    <aside className="audio-status" role="status">
      <span>{snapshot.error}</span>
      {snapshot.text && <button onClick={() => void speak(snapshot.text)}>{t('Retry audio')}</button>}
      <button onClick={stopSpeech} aria-label={t('Dismiss')}>
        ×
      </button>
    </aside>
  )
}
