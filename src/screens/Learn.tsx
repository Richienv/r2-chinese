import { BookIcon, CheckIcon, ChevronRight, PlayIcon } from '../components/Icons'
import { book, lessons, totalVocab } from '../lib/content'
import { useStore } from '../store/store'

export function Learn({
  onLesson,
  onVocab,
}: {
  onLesson: (n: number) => void
  onVocab: () => void
}) {
  const s = useStore()
  const current = lessons.find((l) => !s.lessonsDone.includes(l.lesson)) ?? lessons[lessons.length - 1]
  const pct = s.lessonsDone.length / lessons.length

  return (
    <>
      <header style={{ padding: '18px 0 14px' }}>
        <h1 className="h2">HSK 4A Course</h1>
        <div className="sub" style={{ marginTop: 4 }}>
          {book.title_zh} · {lessons.length} lessons
        </div>
      </header>

      <div className="bar-ink">
        <i style={{ width: `${pct * 100}%` }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, margin: '8px 0 18px' }}>
        {Math.round(pct * 100)}% complete
      </div>

      <section className="metal hero">
        <div className="kicker">Up next</div>
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="hero-title on-red">{current.title.zh}</h2>
            <div style={{ fontSize: 13, color: 'var(--on-red-2)', fontWeight: 600 }}>
              Lesson {current.lesson} · {current.vocab.length} new words · {current.grammar.length}{' '}
              grammar points
            </div>
          </div>
          <button className="play-round" onClick={() => onLesson(current.lesson)} aria-label="Start lesson">
            <PlayIcon size={20} />
          </button>
        </div>
      </section>

      {/* browse all vocabulary */}
      <button
        className="card between"
        style={{ width: '100%', marginTop: 14, textAlign: 'left' }}
        onClick={onVocab}
      >
        <div className="row">
          <div className="lesson-badge metal metal-sm" style={{ borderRadius: 14, width: 42, height: 42 }}>
            <BookIcon size={19} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Browse vocabulary</div>
            <div className="sub" style={{ fontSize: 13 }}>
              Search all {totalVocab} words in the course
            </div>
          </div>
        </div>
        <ChevronRight />
      </button>

      <h3 className="kicker-ink" style={{ margin: '24px 0 12px' }}>
        Unit 1 · 标准教程 HSK 4上
      </h3>

      <div style={{ display: 'grid', gap: 10 }}>
        {lessons.map((l) => {
          const done = s.lessonsDone.includes(l.lesson)
          const isCurrent = l.lesson === current.lesson
          return (
            <button
              key={l.lesson}
              className="metal metal-sm lesson-row"
              style={isCurrent ? { boxShadow: 'var(--metal-emboss), 0 0 0 2px rgba(255,255,255,.5)' } : undefined}
              onClick={() => onLesson(l.lesson)}
            >
              <span
                className={`lesson-badge ${done ? 'glass' : ''}`}
                style={done ? undefined : { background: '#fff', color: 'var(--red-mid)' }}
              >
                {done ? <CheckIcon /> : <PlayIcon size={16} />}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="zh on-red" style={{ display: 'block', fontSize: 17, fontWeight: 700 }} lang="zh-CN">
                  {l.title.zh}
                </span>
                <span
                  style={{ display: 'block', fontSize: 12, color: 'var(--on-red-3)', fontWeight: 600, marginTop: 2 }}
                >
                  Lesson {l.lesson} · {l.title.en}
                </span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--on-red-2)' }}>
                {done ? 'Done' : isCurrent ? 'Start' : 'Open'}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}
