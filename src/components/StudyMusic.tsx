import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { STUDY_TRACK, setStudyMusic, setStudyVolume, studyMusicState, subscribeStudyMusic } from '../lib/studyMusic'
import '../styles/study-music.css'

export function StudyMusic({ lifted }: { lifted: boolean }) {
  const [state, setState] = useState(studyMusicState)
  const [available, setAvailable] = useState(false)

  useEffect(() => subscribeStudyMusic(() => setState(studyMusicState())), [])
  useEffect(() => {
    // This optional track lives only on devices where it was supplied.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    void fetch(STUDY_TRACK, { method: 'HEAD', signal: controller.signal })
      .then(response => {
        if (!controller.signal.aborted)
          setAvailable(response.ok && /^audio\//i.test(response.headers.get('content-type') ?? ''))
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout))
    return () => { clearTimeout(timeout); controller.abort() }
  }, [])

  if (!available) return null

  return (
    <div className="study-music" data-lifted={lifted ? 'true' : 'false'} data-ducked={state.ducked ? 'true' : 'false'}>
      <button
        type="button"
        className="study-music-play"
        aria-pressed={state.on}
        onClick={() => void setStudyMusic(!state.on)}
      >
        {state.on ? t('Pause lofi') : t('Play lofi')}
      </button>
      <label className="study-music-volume">
        <span>{t('Music')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={state.volume}
          aria-label={t('Music volume')}
          onChange={(event) => setStudyVolume(Number(event.target.value))}
        />
      </label>
    </div>
  )
}
