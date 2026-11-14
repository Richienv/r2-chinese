import { matchesWord } from '../lib/wordSearch'
import '../styles/usability.css'
import { useMemo, useState } from 'react'
import { useGloss } from '../components/ChineseText'
import { HearButton } from '../components/Hear'
import { ChevronLeft } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { vocabIndex } from '../lib/content'
import { t } from '../lib/i18n'
import type { Vocab } from '../lib/types'
import { VOICE, WORD_RATE } from '../lib/voices'

const TAGS: { key: string; label: string }[] = [
  { key: '', label: t('All') },
  { key: 'known-char', label: t('Known characters') },
  { key: 'proper', label: t('Proper nouns') },
  { key: 'supra', label: t('Beyond HSK 4') },
]

/** Searchable index of all 361 book words — the missing "look anything up" screen. */
export function VocabBrowser({ onClose }: { onClose: () => void }) {
  const { onWord, sheet } = useGloss()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [lesson, setLesson] = useState<number | 0>(0)

  const results = useMemo(() => {
    return vocabIndex.filter((v) => {
      if (tag && v.tag !== tag) return false
      if (lesson && v.lesson !== lesson) return false
      return matchesWord(v, q)
    })
  }, [q, tag, lesson])

  const lessonNums = useMemo(() => [...new Set(vocabIndex.map((v) => v.lesson))].sort((a, b) => a - b), [])

  return (
    <div className="overlay">
      <div className="overlay-head">
        <button className="icon-round tap44" onClick={onClose} aria-label={t('Back')}>
          <ChevronLeft />
        </button>
        <strong style={{ fontSize: 15, flex: 1 }}>{t('Vocabulary')}</strong>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{results.length}</span>
      </div>

      <div className="word-search-controls">
        <div className="word-search-row">
          <input className="word-search-input" value={q} onChange={event => setQ(event.target.value)} placeholder={t('Search hanzi, pinyin or meaning…')} aria-label={t('Search vocabulary')} />
          {(q || tag || lesson > 0) && <button className="word-search-reset" onClick={() => { setQ(''); setTag(''); setLesson(0) }}>{t('Reset')}</button>}
        </div>
        <details className="word-search-filters">
          <summary>{t('Filters')}{(tag || lesson > 0) && <span>{t('{n} active', { n: Number(!!tag) + Number(lesson > 0) })}</span>}</summary>
          <div className="word-search-selects">
            <label>{t('Word type')}<select value={tag} aria-label={t('Word type')} onChange={event => setTag(event.target.value)}>{TAGS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label>{t('Lesson')}<select value={lesson} aria-label={t('Vocabulary lesson')} onChange={event => setLesson(Number(event.target.value))}><option value={0}>{t('All lessons')}</option>{lessonNums.map(n => <option key={n} value={n}>L{n}</option>)}</select></label>
          </div>
        </details>
      </div>

      <div className="overlay-body" style={{ paddingTop: 8 }}>
        {results.length === 0 ? (
          <div className="word-search-empty"><h2 className="h2">{t('No matching words')}</h2><p className="sub">{t('Try another spelling or reset the filters.')}</p><button className="btn btn-ghost" onClick={() => { setQ(''); setTag(''); setLesson(0) }}>{t('Clear search and filters')}</button></div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {results.map((v) => {
              const vocab: Vocab = { zh: v.zh, pinyin: v.pinyin, pos: v.pos, en: v.en, note: '' }
              return (
                <div key={`${v.zh}-${v.lesson}`} className="card between" style={{ padding: 12, gap: 8 }}>
                  <button
                    style={{ textAlign: 'left', flex: 1, minWidth: 0 }}
                    onClick={() => onWord(vocab)}
                    aria-label={t('{word} details', { word: v.zh })}
                  >
                    <div className="zh" style={{ fontSize: 18, fontWeight: 700 }} lang="zh-CN">
                      {v.zh}
                      {v.tag === 'proper' && (
                        <span style={{ fontSize: 10, color: 'var(--muted-3)', fontWeight: 700, marginLeft: 6 }}>
                          {t('proper')}
                        </span>
                      )}
                      {v.tag === 'supra' && (
                        <span style={{ fontSize: 10, color: 'var(--warm)', fontWeight: 700, marginLeft: 6 }}>
                          {t('beyond HSK 4')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>
                      {v.pinyin} · L{v.lesson}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{v.en}</div>
                  </button>
                  <HearButton text={v.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label={t('Hear')} />
                  <SaveStar zh={v.zh} lesson={v.lesson} size={20} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {sheet}
    </div>
  )
}
