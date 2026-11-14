import { useState } from 'react'
import { HearButton } from '../components/Hear'
import { ChevronLeft } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { lookup } from '../lib/content'
import { recommendedWords } from '../lib/learningEngine'
import { drillSelection } from '../lib/practiceExperience'
import { matchesWord } from '../lib/wordSearch'
import { t } from '../lib/i18n'
import { masteryLabel, type MasteryState } from '../lib/mastery'
import { VOICE, WORD_RATE } from '../lib/voices'
import { useStore } from '../store/store'
import '../styles/usability.css'

type TrailFilter = 'all' | MasteryState | 'favorites'
const FILTERS: { value: TrailFilter; label: string }[] = [
  { value: 'all', label: t('All words') },
  { value: 'hard', label: masteryLabel.hard },
  { value: 'learning', label: masteryLabel.learning },
  { value: 'mastered', label: masteryLabel.mastered },
  { value: 'favorites', label: t('Starred') },
]

/** Search, revisit a specific word, or start a bounded round of the words that need work. */
export function SavedWords({ onDrill, onClose, onPlacement }: {
  onDrill: (words: string[], title: string) => void
  onPlacement: (words: string[]) => void
  onClose: () => void
}) {
  const store = useStore()
  const [filter, setFilter] = useState<TrailFilter>('all')
  const [query, setQuery] = useState('')
  const candidates = filter === 'favorites'
    ? store.starred
    : store.learningTrail.filter(zh => filter === 'all' || store.mastery[zh]?.state === filter)
  const words = candidates.filter(zh => matchesWord(lookup(zh) ?? { zh }, query))
  const recommended = drillSelection(recommendedWords(store, words))
  const filtering = !!query.trim() || filter !== 'all'
  function reset() { setQuery(''); setFilter('all') }

  return <div className="overlay">
    <div className="overlay-head">
      <button className="icon-round tap44" onClick={onClose} aria-label={t('Back')}><ChevronLeft /></button>
      <strong style={{ fontSize: 15, flex: 1 }}>{t('My words')}</strong>
      <span className="compact-eyebrow" aria-live="polite">{words.length}</span>
    </div>
    <div className="word-search-controls">
      <div className="word-search-row">
        <input className="word-search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search hanzi, pinyin or meaning…')} aria-label={t('Search my words')} />
        {filtering && <button className="word-search-reset" onClick={reset}>{t('Reset')}</button>}
      </div>
      <div className="word-search-selects trail-filter">
        <label>{t('Show words')}<select aria-label={t('Filter learning trail')} value={filter} onChange={event => setFilter(event.target.value as TrailFilter)}>{FILTERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
    </div>
    <div className="overlay-body">
      {!words.length ? <div className="word-search-empty">
        <h2 className="h2">{filtering ? t('No matching words') : t('Your learning trail starts here')}</h2>
        <p className="sub">{filtering ? t('Try another spelling or reset the filters.') : t('Words from your lessons appear here automatically.')}</p>
        {filtering && <button className="btn btn-ghost" onClick={reset}>{t('Clear search and filters')}</button>}
      </div> : <div style={{ display: 'grid', gap: 10 }}>
        {words.map(zh => {
          const word = lookup(zh)
          const record = store.mastery[zh]
          const state = record?.state ?? 'new'
          return <article key={zh} className="card trail-word-card">
            <div className="trail-word-main">
              <button type="button" aria-label={t('Practise recalling {word}', { word: zh })} onClick={() => onDrill([zh], t('Recall {n} words', { n: 1 }))}>
                <span className="zh" style={{ fontSize: 22 }} lang="zh-CN">{zh}</span>
                {word && <><div className="trail-word-pinyin">{word.pinyin}</div><div className="trail-word-meaning">{word.en}</div></>}
              </button>
              <HearButton text={zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label={t('Hear')} />
              <SaveStar zh={zh} size={20} />
            </div>
            <details className="trail-word-details">
              <summary><span className="trail-state mastery-state" data-state={state}>{masteryLabel[state]}</span><span>{t('Word details')}</span></summary>
              <p className="sub">{record?.attempts ? t('{n} independent recalls on {days} days', { n: record.unaidedSuccesses, days: record.successDays.length }) : t('Met · ready for first recall')}</p>
              <button className="focus-link" onClick={() => onPlacement([zh])}>{t('Already know it')}</button>
            </details>
          </article>
        })}
      </div>}
    </div>
    <div className="overlay-foot">
      {recommended.length ? <button className="btn" onClick={() => onDrill(recommended, t('Recall {n} words', { n: recommended.length }))}>{t('Practise {n} words', { n: recommended.length })}</button> : <button className="btn" onClick={onClose}>{t('Back to learning')}</button>}
      {words.length > 0 && !recommended.length && <p className="sub trail-resting-note">{t('Strong words are resting. You can still choose a word above.')}</p>}
    </div>
  </div>
}
