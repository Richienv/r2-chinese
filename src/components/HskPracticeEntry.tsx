import { lessons } from '../lib/content'
import { learnedHskWords, listeningScripts } from '../lib/hskPractice'
import { useStore } from '../store/store'
import '../styles/hsk-practice.css'

export function HskPracticeEntry({ onListen, onCompose }: { onListen: () => void; onCompose: () => void }) {
  const store = useStore()
  const pool = learnedHskWords(lessons, store.learningTrail, Object.keys(store.cards))
  return <section className="hsk-practice-entry" aria-label="Connect your HSK learning">
    <div className="hsk-practice-entry-head"><span>Bring it together</span><small>HSK 4</small></div>
    <div className="hsk-practice-entry-grid">
      <button type="button" onClick={onListen} className="hsk-practice-door hsk-practice-door-listen">
        <span className="hsk-door-art" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span><strong>Listening room</strong><small>Lessons 1–5 · {listeningScripts(lessons).length} scripts</small></span><b aria-hidden="true">→</b>
      </button>
      <button type="button" onClick={onCompose} className="hsk-practice-door hsk-practice-door-write">
        <span className="hsk-door-glyph" aria-hidden="true">写</span>
        <span><strong>Make it yours</strong><small>{pool.length ? `${pool.length} learned words · your own sentences` : 'Connect the words you learn'}</small></span><b aria-hidden="true">→</b>
      </button>
    </div>
  </section>
}
