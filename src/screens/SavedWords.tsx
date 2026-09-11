import { ChevronLeft, BoltIcon, SpeakerIcon } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { lookup } from '../lib/content'
import { speak } from '../lib/speech'
import { useStore } from '../store/store'

/**
 * The learner's saved words — one screen collecting every starred word, with a
 * one-tap "Drill all" and a per-word drill. This is the fast lane back into
 * practice: everything you flagged while reading, in one place.
 */
export function SavedWords({
  onDrill,
  onClose,
}: {
  onDrill: (words: string[], title: string) => void
  onClose: () => void
}) {
  const store = useStore()
  const words = store.starred

  return (
    <div className="overlay">
      <div className="overlay-head">
        <button className="icon-round tap44" onClick={onClose} aria-label="Back">
          <ChevronLeft />
        </button>
        <strong style={{ fontSize: 15, flex: 1 }}>Saved words</strong>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{words.length}</span>
      </div>

      {words.length === 0 ? (
        <>
          <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 280 }}>
              <div className="medal" style={{ marginBottom: 18 }}>
                <BoltIcon size={34} />
              </div>
              <p style={{ fontSize: 17, fontWeight: 700 }}>No saved words yet</p>
              <p className="sub" style={{ marginTop: 6 }}>
                Tap the star on any word — in a dialogue, a flashcard or the character screen — to
                save it here for rapid drilling.
              </p>
            </div>
          </div>
          <div className="overlay-foot">
            <button className="btn" onClick={onClose}>
              Back
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="overlay-body">
            <div style={{ display: 'grid', gap: 10 }}>
              {words.map((zh) => {
                const w = lookup(zh)
                return (
                  <div
                    key={zh}
                    className="card between"
                    role="button"
                    tabIndex={0}
                    aria-label={`Drill ${zh}`}
                    style={{ padding: 14, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => onDrill([zh], `Drill ${zh}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onDrill([zh], `Drill ${zh}`)
                      }
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="zh" style={{ fontSize: 20, fontWeight: 700 }} lang="zh-CN">
                        {zh}
                      </div>
                      {w && (
                        <>
                          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>
                            {w.pinyin}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                            {w.en}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <span
                        className="icon-round tap44"
                        role="button"
                        aria-label={`Say ${zh}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          speak(zh)
                        }}
                      >
                        <SpeakerIcon size={16} />
                      </span>
                      <SaveStar zh={zh} size={20} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="overlay-foot">
            <button className="btn" onClick={() => onDrill(words, `Drill ${words.length} saved`)}>
              <BoltIcon size={18} /> Drill all {words.length}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
