import { useGloss } from '../components/ChineseText'
import { ChineseHear, HearButton } from '../components/Hear'
import { ChevronLeft } from '../components/Icons'
import { SaveStar } from '../components/SaveStar'
import { Writer } from '../components/Writer'
import { lessonOf, lookup, vocabIndex } from '../lib/content'
import type { Vocab } from '../lib/types'
import { VOICE, WORD_RATE } from '../lib/voices'

export function CharacterOverlay({ char, onClose }: { char: string; onClose: () => void }) {
  const words = vocabIndex.filter((v) => v.zh.includes(char)).slice(0, 12)
  const headword = lookup(char) ?? words[0]
  const lesson = lessonOf(char) ?? words[0]?.lesson
  const { onWord, sheet } = useGloss()

  return (
    <div className="overlay">
      <div className="overlay-head">
        <button className="icon-round tap44" onClick={onClose} aria-label="Back">
          <ChevronLeft />
        </button>
        <strong style={{ fontSize: 15, flex: 1, textAlign: 'center' }}>Character</strong>
        <SaveStar zh={char} lesson={lesson} />
      </div>

      <div className="overlay-body">
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="zh" style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }} lang="zh-CN">
            {char}
          </div>
          <div style={{ color: 'var(--warm-hot)', fontSize: 32, fontWeight: 800, marginTop: 8 }}>
            {headword?.pinyin ?? char}
          </div>
          <div className="sub" style={{ marginTop: 4 }}>
            {headword?.en ?? 'Character practice'}
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
            <ChineseHear text={char} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear the character" />
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <span className="pill-ink">HSK 4</span>
            {lesson && <span className="pill-ink">Lesson {lesson}</span>}
            <span className="pill-ink">{words.length} words</span>
          </div>
        </div>

        <Writer char={char} />

        <h3 className="kicker-ink" style={{ margin: '26px 0 12px' }}>
          Words with {char}
        </h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {words.map((w) => {
            const vocab: Vocab = { zh: w.zh, pinyin: w.pinyin, pos: w.pos, en: w.en, note: '' }
            return (
              <div key={w.zh} className="card between" style={{ padding: 14 }}>
                <button
                  style={{ padding: 0, width: '100%', textAlign: 'left', flex: 1, minWidth: 0 }}
                  onClick={() => onWord(vocab)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="zh" style={{ fontSize: 19, fontWeight: 700 }} lang="zh-CN">
                      {w.zh}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>
                      {w.pinyin}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{w.en}</div>
                  </div>
                </button>
                <HearButton text={w.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label="Hear" />
              </div>
            )
          })}
        </div>
      </div>

      {sheet}
    </div>
  )
}
