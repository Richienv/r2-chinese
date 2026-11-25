import { lessons } from '../lib/content'
import { t } from '../lib/i18n'
import { learnedHskWords, listeningScripts } from '../lib/hskPractice'
import { useStore } from '../store/store'
import '../styles/hsk-practice.css'

export function HskPracticeEntry({
  onListen,
  onCompose,
  onExam,
}: {
  onListen: () => void
  onCompose: () => void
  onExam?: (course?: 'hsk4a' | 'mixed', mode?: 'mock' | 'grammar') => void
}) {
  const store = useStore()
  const pool = learnedHskWords(lessons, store.learningTrail, Object.keys(store.cards))
  return <section className="hsk-practice-entry" aria-label={t('Connect your HSK learning')}>
    <div className="hsk-practice-entry-head"><span>{t('Practice')}</span><small>HSK 4</small></div>
    <div className="hsk-practice-entry-grid">
      <button type="button" onClick={onListen} className="hsk-practice-door hsk-practice-door-listen">
        <span className="hsk-door-art" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span><strong>{t('Listening')}</strong><small>{t('Lessons 1–5 · {n} scripts', { n: listeningScripts(lessons).length })}</small></span><b aria-hidden="true">→</b>
      </button>
      <button type="button" onClick={onCompose} className="hsk-practice-door hsk-practice-door-write">
        <span className="hsk-door-glyph" aria-hidden="true">写</span>
        <span><strong>{t('Sentence practice')}</strong><small>{pool.length ? t('{n} learned words · your own sentences', { n: pool.length }) : t('Connect the words you learn')}</small></span><b aria-hidden="true">→</b>
      </button>
    </div>
    {onExam && (
      <div className="hsk-practice-entry-grid hsk-practice-exam-grid">
        <button type="button" onClick={() => onExam('hsk4a', 'mock')} className="hsk-practice-door hsk-practice-door-exam">
          <span className="hsk-door-glyph" aria-hidden="true">考</span>
          <span>
            <strong>{t('HSK 4 Mock & Final')}</strong>
            <small>{t('Blanks, word order, error spotting & reading')}</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>
        <button type="button" onClick={() => onExam('mixed', 'grammar')} className="hsk-practice-door hsk-practice-door-grammar">
          <span className="hsk-door-glyph" aria-hidden="true">法</span>
          <span>
            <strong>{t('Grammar drill')}</strong>
            <small>{t('Mixed Jiaocheng + HSK 4 grammar breakdowns')}</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>
      </div>
    )}
  </section>
}
