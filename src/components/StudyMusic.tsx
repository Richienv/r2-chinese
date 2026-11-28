import { useEffect, useState } from 'react'
import { ChevronDown } from './Icons'
import { t } from '../lib/i18n'
import { STUDY_TRACKS, studyMusicPlayer } from '../lib/studyMusic'
import { getMusicCacheSnapshot, subscribeMusicCache } from '../lib/studyMusicCache'
import { Sheet } from './Sheet'
import '../styles/study-music.css'

function MusicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18V5l12-2v13M9 9l12-2" />
      <ellipse cx="6" cy="18" rx="3" ry="2.5" />
      <ellipse cx="18" cy="16" rx="3" ry="2.5" />
    </svg>
  )
}

function PlaybackIcon({ pause, size = 20 }: { pause: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {pause ? (
        <>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </>
      ) : (
        <path d="M8 4.8a1 1 0 0 1 1.5-.86l11 7a1.2 1.2 0 0 1 0 2l-11 7A1 1 0 0 1 8 19z" />
      )}
    </svg>
  )
}

function EqualizerBars() {
  return (
    <span className="music-eq" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function StudyMusicSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const player = studyMusicPlayer()
  const [state, setState] = useState(player.snapshot)
  const [cache, setCache] = useState(getMusicCacheSnapshot)

  useEffect(() => player.subscribe(() => setState(player.snapshot())), [player])
  useEffect(() => subscribeMusicCache(() => setCache(getMusicCacheSnapshot())), [])

  if (!open) return null

  const track = STUDY_TRACKS.find((item) => item.id === state.trackId) ?? STUDY_TRACKS[0]
  const active = state.on || state.loading
  const allCached = cache.cachedCount >= cache.totalCount

  return (
    <Sheet onClose={onClose} label={t('Study music')} closeLabel={t('Close music')}>
      <div className="music-panel">
        <div className="music-cache-head">
          <div className="kicker-ink">{t('YOUR FOCUS SPACE')}</div>
          <span className={`music-cache-badge${allCached ? ' is-ready' : ''}`}>
            <i className="music-cache-dot" aria-hidden="true" />
            {allCached
              ? `Siap offline · ${cache.cachedCount}/${cache.totalCount} lagu`
              : cache.downloadingId
                ? `Menyimpan offline · ${cache.cachedCount}/${cache.totalCount}`
                : `Cache offline · ${cache.cachedCount}/${cache.totalCount}`}
          </span>
        </div>

        <h2>{t('Settle into studying.')}</h2>
        <p className="music-note">{t('Music softens automatically when a lesson speaks.')}</p>

        <div className="music-now">
          <span className="music-cover">
            {state.on ? <EqualizerBars /> : <MusicIcon size={20} />}
          </span>
          <div>
            <strong>{track.title}</strong>
            <span>
              {track.artist || (track.category === 'mix' ? t('Long mix') : t('From your library'))} ·{' '}
              {duration(track.seconds)}
            </span>
          </div>
        </div>

        <div className="music-transport">
          <button type="button" onClick={() => player.next(-1)} aria-label={t('Previous track')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 5h2v14H6zm12 0v14L9 12z" />
            </svg>
          </button>
          <button
            type="button"
            className="music-play"
            onClick={() => void player.play(!active)}
            aria-label={active ? t('Pause music') : t('Play music')}
          >
            <PlaybackIcon pause={active} size={22} />
          </button>
          <button type="button" onClick={() => player.next(1)} aria-label={t('Next track')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M16 5h2v14h-2zM6 5l9 7-9 7z" />
            </svg>
          </button>
        </div>

        <div className="music-status" role="status">
          {state.error
            ? t('Music could not play. Tap play to try again.')
            : state.loading
              ? t('Loading music…')
              : state.on
                ? state.ducked
                  ? t('Softened for lesson audio')
                  : t('Playing')
                : t('Paused')}
        </div>

        <div className="music-tone" role="group" aria-label={t('Music sound')}>
          <button type="button" aria-pressed={!state.muffled} onClick={() => player.muffle(false)}>
            {t('Natural')}
          </button>
          <button type="button" aria-pressed={state.muffled} onClick={() => player.muffle(true)}>
            {t('Muffled')}
          </button>
        </div>

        <label className="music-volume">
          <span>
            {t('Music volume')}
            <output>{Math.round(state.volume * 100)}%</output>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state.volume}
            onChange={(event) => player.volume(Number(event.target.value))}
          />
        </label>

        <div className="music-options">
          <button type="button" aria-pressed={state.repeat} onClick={() => player.repeat(!state.repeat)}>
            {state.repeat ? t('Repeat this track') : t('Play through library')}
          </button>
          <button type="button" onClick={() => player.shuffle()}>
            {t('Surprise me')}
          </button>
        </div>

        <label className="music-timer">
          <span>{t('Stop music after')}</span>
          <select
            aria-label={t('Stop music after')}
            value={state.sleepAt ? 'active' : '0'}
            onChange={(event) => player.sleep(Number(event.target.value))}
          >
            {state.sleepAt && (
              <option value="active">
                {t('Until {time}', {
                  time: new Date(state.sleepAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                })}
              </option>
            )}
            <option value="0">{t('No timer')}</option>
            {[15, 30, 60].map((minutes) => (
              <option key={minutes} value={minutes}>
                {t('{n} minutes', { n: minutes })}
              </option>
            ))}
          </select>
        </label>

        <div className="music-library-head">
          <h3>{t('Your music')}</h3>
          <span>{STUDY_TRACKS.length}</span>
        </div>

        <div className="music-library" role="group" aria-label={t('Choose music')}>
          {cache.tracks.map((item, index) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={item.id === state.trackId}
              onClick={() => player.choose(item.id)}
            >
              <span className="music-track-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="music-track-name">
                {item.title}
                <small>
                  {item.artist ? `${item.artist} · ` : ''}
                  {item.cached ? 'Tersimpan offline' : cache.downloadingId === item.id ? 'Mengunduh…' : 'Siap putar'}
                </small>
              </span>
              <span className="music-duration">{duration(item.seconds)}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

export function GlobalMusicPill({ hidden = false }: { hidden?: boolean }) {
  const player = studyMusicPlayer()
  const [state, setState] = useState(player.snapshot)
  const [open, setOpen] = useState(false)

  useEffect(() => player.subscribe(() => setState(player.snapshot())), [player])

  if (hidden && !open) return null

  const track = STUDY_TRACKS.find((item) => item.id === state.trackId) ?? STUDY_TRACKS[0]
  const active = state.on || state.loading

  return (
    <>
      <div className={`global-music-pill${state.on ? ' is-playing' : ''}`} role="region" aria-label={t('Study music')}>
        <button
          type="button"
          className="global-music-play"
          onClick={() => void player.play(!active)}
          aria-label={active ? t('Pause music') : t('Play music')}
          title={active ? `Jeda: ${track.title}` : `Putar: ${track.title}`}
        >
          {state.on ? <EqualizerBars /> : <PlaybackIcon pause={false} size={14} />}
          <span className="global-music-title">{state.on ? track.title : 'Musik'}</span>
        </button>
        <span className="global-music-sep" aria-hidden="true" />
        <button
          type="button"
          className="global-music-drawer-btn"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label="Pilih lagu & atur Study Music"
          title="Pilih dari 14 lagu & pengaturan"
        >
          <ChevronDown size={15} />
        </button>
      </div>
      <StudyMusicSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function StudyMusic({ compact = false }: { compact?: boolean }) {
  const player = studyMusicPlayer()
  const [state, setState] = useState(player.snapshot)
  const [open, setOpen] = useState(false)

  useEffect(() => player.subscribe(() => setState(player.snapshot())), [player])

  const track = STUDY_TRACKS.find((item) => item.id === state.trackId) ?? STUDY_TRACKS[0]
  const active = state.on || state.loading

  return (
    <>
      {compact ? (
        <button
          className="music-launch icon-round tap44"
          type="button"
          data-on={state.on}
          aria-label={t('Study music')}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <MusicIcon size={18} />
          {state.on && <i aria-hidden="true" />}
        </button>
      ) : (
        <section className="music-card" aria-label={t('Study music')}>
          <button type="button" className="music-card-open" onClick={() => setOpen(true)} aria-haspopup="dialog">
            <span className="music-cover">{state.on ? <EqualizerBars /> : <MusicIcon size={20} />}</span>
            <span>
              <strong>{t('Study music')}</strong>
              <small>
                {state.on ? track.title : t('{n} tracks · your focus space', { n: STUDY_TRACKS.length })}
              </small>
            </span>
          </button>
          <button
            type="button"
            className="music-play"
            onClick={() => void player.play(!active)}
            aria-label={active ? t('Pause music') : t('Play music')}
          >
            <PlaybackIcon pause={active} size={22} />
          </button>
        </section>
      )}
      <StudyMusicSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
