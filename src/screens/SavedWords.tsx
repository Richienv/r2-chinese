import { useState } from 'react'
import { HearButton } from '../components/Hear'
import { ChevronLeft, BoltIcon } from '../components/Icons'
import { MasteryTracker } from '../components/MasteryTracker'
import { SaveStar } from '../components/SaveStar'
import { lookup } from '../lib/content'
import { mixWithSaved } from '../lib/drill'
import { t } from '../lib/i18n'
import { masteryLabel, type MasteryState } from '../lib/mastery'
import { VOICE, WORD_RATE } from '../lib/voices'
import { useStore } from '../store/store'

type TrailFilter = 'all' | MasteryState | 'favorites'
const FILTERS: { value: TrailFilter; label: string }[] = [
  { value: 'all', label: t('All words') },
  { value: 'hard', label: masteryLabel.hard },
  { value: 'learning', label: masteryLabel.learning },
  { value: 'mastered', label: masteryLabel.mastered },
  { value: 'favorites', label: t('Starred') },
]

/** How much unaided retrieval a word has: counts and days each need their own singular. */
function unaidedSummary(recalls: number, days: number): string {
  const vars = { n: recalls, days }
  if (recalls === 1) return days === 1 ? t('{n} unaided recall across {days} day', vars) : t('{n} unaided recall across {days} days', vars)
  return days === 1 ? t('{n} unaided recalls across {days} day', vars) : t('{n} unaided recalls across {days} days', vars)
}

/** Every word encountered lands here automatically; stars remain intentional favourites. */
export function SavedWords({ onDrill, onClose }: {
  onDrill: (words: string[], title: string) => void
  onClose: () => void
}) {
  const store = useStore()
  const [filter, setFilter] = useState<TrailFilter>('all')
  const words = filter === 'favorites' ? store.starred : store.learningTrail.filter((zh) => filter === 'all' || store.mastery[zh]?.state === filter)
  const emptyTitle = filter === 'all' ? t('Your learning trail starts here')
    : filter === 'favorites' ? t('No starred words yet')
      : filter === 'mastered' ? t('Mastery grows across days')
        : filter === 'hard' ? t('No words need repair yet') : t('No words in this stage yet')
  const emptyCopy = filter === 'all' ? t('Words save themselves as you meet them in lessons and drills. You can always return to what needs practice.')
    : filter === 'favorites' ? t('Star a word to keep a deliberate favourite. Your automatic learning trail is in All words.')
      : filter === 'mastered' ? t('Recall a word correctly without hints at least 3 times across 2 days. Recognising a choice alone does not prove mastery.')
        : filter === 'hard' ? t('Missed or assisted answers appear here automatically, so your next session targets the right words.')
          : t('Start a lesson or a recall drill. Your progress updates with each answer.')
  const filterLabel = FILTERS.find((item) => item.value === filter)?.label ?? ''
  const count = filter === 'all'
    ? words.length === 1 ? t('{n} word in your trail', { n: words.length }) : t('{n} words in your trail', { n: words.length })
    : words.length === 1 ? t('{n} word · {filter}', { n: words.length, filter: filterLabel }) : t('{n} words · {filter}', { n: words.length, filter: filterLabel })

  return (
    <div className="overlay">
      <div className="overlay-head">
        <button className="icon-round tap44" onClick={onClose} aria-label={t('Back')}><ChevronLeft /></button>
        <strong style={{ fontSize: 15, flex: 1 }}>{t('Learning trail')}</strong>
        <MasteryTracker words={store.learningTrail} compact />
      </div>
      <div className="trail-intro" style={{ padding: '0 22px 18px' }}>
        <p className="sub">{t('Saved automatically. Prioritise recall that still needs work.')}</p>
        <div className="trail-tabs" role="group" aria-label={t('Filter learning trail')}>
          {FILTERS.map(({ value, label }) => <button type="button" key={value} className="pill-ink" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <p className="sub" aria-live="polite" style={{ fontSize: 12, marginTop: 12 }}>{count}</p>
      </div>
      {words.length === 0 ? <>
        <div className="overlay-body" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 300 }}>
            <div className="medal" style={{ marginBottom: 18 }}><BoltIcon size={34} /></div>
            <p style={{ fontSize: 17, fontWeight: 700 }}>{emptyTitle}</p>
            <p className="sub" style={{ marginTop: 8 }}>{emptyCopy}</p>
          </div>
        </div>
        <div className="overlay-foot"><button className="btn" onClick={onClose}>{t('Back to learning')}</button></div>
      </> : <>
        <div className="overlay-body">
          <div style={{ display: 'grid', gap: 10 }}>
            {words.map((zh) => {
              const word = lookup(zh)
              const record = store.mastery[zh]
              const state = record?.state ?? 'new'
              return <div key={zh} className="card between" style={{ padding: 14, width: '100%', gap: 8 }}>
                <button type="button" aria-label={t('Practise recalling {word}', { word: zh })} style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: 0 }} onClick={() => {
                  const mixed = mixWithSaved(zh, words)
                  onDrill(mixed, mixed.length > 1 ? t('Recall {n} words', { n: mixed.length }) : t('Recall {word}', { word: zh }))
                }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="zh" style={{ fontSize: 20, fontWeight: 700 }} lang="zh-CN">{zh}</span><span className="trail-state mastery-state" data-state={state}>{masteryLabel[state]}</span></div>
                  {word && <><div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>{word.pinyin}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{word.en}</div></>}
                  <div className="sub" style={{ fontSize: 11, marginTop: 6 }}>{record?.attempts ? unaidedSummary(record.unaidedSuccesses, record.successDays.length) : t('Met · ready for first recall')}</div>
                </button>
                <HearButton text={zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label={t('Hear')} />
                <SaveStar zh={zh} size={20} />
              </div>
            })}
          </div>
        </div>
        <div className="overlay-foot"><button className="btn" onClick={() => onDrill(words, t('Recall {n} words', { n: words.length }))}><BoltIcon size={18} /> {words.length === 1 ? t('Recall {n} word', { n: words.length }) : t('Recall {n} words', { n: words.length })}</button></div>
      </>}
    </div>
  )
}
