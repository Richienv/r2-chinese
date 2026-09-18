import { useMemo, useState } from 'react'
import { useGloss } from '../components/ChineseText'
import { ChevronLeft } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { vocabIndex } from '../lib/content'
import type { Vocab } from '../lib/types'

const TAGS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'known-char', label: 'Known-char' },
  { key: 'proper', label: 'Proper nouns' },
  { key: 'supra', label: 'Beyond HSK 4' },
]

/** Searchable index of all 361 book words — the missing "look anything up" screen. */
export function VocabBrowser({ onClose }: { onClose: () => void }) {
  const { onWord, sheet } = useGloss()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [lesson, setLesson] = useState<number | 0>(0)

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return vocabIndex.filter((v) => {
      if (tag && v.tag !== tag) return false
      if (lesson && v.lesson !== lesson) return false
      if (!needle) return true
      return (
        v.zh.includes(needle) ||
        v.pinyin.toLowerCase().includes(needle) ||
        v.en.toLowerCase().includes(needle)
      )
    })
  }, [q, tag, lesson])

  const lessonNums = useMemo(() => [...new Set(vocabIndex.map((v) => v.lesson))].sort((a, b) => a - b), [])

  return (
    <div className="overlay">
      <div className="overlay-head">
        <button className="icon-round tap44" onClick={onClose} aria-label="Back">
          <ChevronLeft />
        </button>
        <strong style={{ fontSize: 15, flex: 1 }}>Vocabulary</strong>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{results.length}</span>
      </div>

      <div style={{ padding: '4px 22px 8px', flex: 'none' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search hanzi, pinyin or meaning…"
          aria-label="Search vocabulary"
          style={{
            width: '100%',
            height: 48,
            borderRadius: 14,
            border: '1px solid var(--line-2)',
            background: 'var(--surface)',
            padding: '0 16px',
            fontSize: 16,
            color: 'var(--ink)',
            fontFamily: 'var(--ui)',
          }}
        />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, paddingBottom: 2 }}>
          {TAGS.map((t) => (
            <button
              key={t.key}
              className="pill-ink"
              onClick={() => setTag(t.key)}
              style={
                tag === t.key
                  ? { color: '#fff', backgroundImage: 'var(--metal-sheen), var(--metal-base)', borderColor: 'transparent', flex: 'none' }
                  : { flex: 'none' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 8, paddingBottom: 2 }}>
          <button
            className="pill-ink"
            onClick={() => setLesson(0)}
            style={lesson === 0 ? { color: 'var(--link-hover)', borderColor: '#f3d6c4', flex: 'none' } : { flex: 'none' }}
          >
            All lessons
          </button>
          {lessonNums.map((n) => (
            <button
              key={n}
              className="pill-ink"
              onClick={() => setLesson(n)}
              style={lesson === n ? { color: 'var(--link-hover)', borderColor: '#f3d6c4', flex: 'none' } : { flex: 'none' }}
            >
              L{n}
            </button>
          ))}
        </div>
      </div>

      <div className="overlay-body" style={{ paddingTop: 8 }}>
        {results.length === 0 ? (
          <p className="sub" style={{ textAlign: 'center', marginTop: 40 }}>
            No words match “{q}”.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {results.map((v) => {
              const vocab: Vocab = { zh: v.zh, pinyin: v.pinyin, pos: v.pos, en: v.en, note: '' }
              return (
                <div key={`${v.zh}-${v.lesson}`} className="card between" style={{ padding: 12 }}>
                  <button
                    style={{ textAlign: 'left', flex: 1, minWidth: 0 }}
                    onClick={() => onWord(vocab)}
                    aria-label={`${v.zh} details`}
                  >
                    <div className="zh" style={{ fontSize: 18, fontWeight: 700 }} lang="zh-CN">
                      {v.zh}
                      {v.tag === 'proper' && (
                        <span style={{ fontSize: 10, color: 'var(--muted-3)', fontWeight: 700, marginLeft: 6 }}>
                          proper
                        </span>
                      )}
                      {v.tag === 'supra' && (
                        <span style={{ fontSize: 10, color: 'var(--warm)', fontWeight: 700, marginLeft: 6 }}>
                          beyond HSK 4
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>
                      {v.pinyin} · L{v.lesson}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{v.en}</div>
                  </button>
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
