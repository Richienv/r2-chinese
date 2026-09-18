import { SaveStar } from '../components/SaveStar'
import type { Example } from '../lib/content'
import { splitHanzi, splitOnWord, TEACH_KICKER, TEACH_TITLE, type TeachPhase, type WordHook } from '../lib/teach'
import type { Vocab } from '../lib/types'

function StepHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="session-step-head">
      <div className="kicker-ink">{kicker}</div>
      <h2 className="session-step-title">{title}</h2>
    </header>
  )
}

export function TeachView({
  phase,
  word,
  example,
  hook,
  lesson,
  n,
  of,
}: {
  phase: TeachPhase
  word: Vocab
  example: Example | null
  hook: WordHook
  lesson: number
  n: number
  of: number
}) {
  const kicker = `Word · ${n} of ${of} · ${TEACH_KICKER[phase]}`
  return (
    <div className="teach-stage" data-phase={phase}>
      <StepHead kicker={kicker} title={TEACH_TITLE[phase]} />
      {phase === 'meet' && <MeetBeat word={word} lesson={lesson} />}
      {phase === 'hook' && <HookBeat word={word} hook={hook} />}
      {phase === 'example' && <ExampleBeat word={word} example={example} />}
      {phase === 'seal' && <SealBeat word={word} />}
    </div>
  )
}

function MeetBeat({ word, lesson }: { word: Vocab; lesson: number }) {
  const glyphs = splitHanzi(word.zh)
  return (
    <div className="teach-meet metal">
      <div className="teach-glyphs" lang="zh-CN" aria-label={word.zh}>
        {glyphs.map((g, i) => (
          <span key={`${g}-${i}`} className="teach-glyph" style={{ animationDelay: `${80 + i * 110}ms` }}>
            {g}
          </span>
        ))}
      </div>
      <p className="teach-meet-py" style={{ animationDelay: `${80 + glyphs.length * 110 + 80}ms` }}>
        {word.pinyin}
      </p>
      {word.pos ? (
        <span className="teach-meet-pos" style={{ animationDelay: `${80 + glyphs.length * 110 + 180}ms` }}>
          {word.pos}
        </span>
      ) : null}
      <p className="teach-meet-en" style={{ animationDelay: `${80 + glyphs.length * 110 + 260}ms` }}>
        {word.en}
      </p>
      <div className="teach-meet-save" style={{ animationDelay: `${80 + glyphs.length * 110 + 340}ms` }}>
        <span>Save to drill</span>
        <SaveStar zh={word.zh} lesson={lesson} size={22} onRed />
      </div>
    </div>
  )
}

function HookBeat({ word, hook }: { word: Vocab; hook: WordHook }) {
  return (
    <div className="teach-hook">
      <div className="teach-ghost zh" lang="zh-CN" aria-hidden>
        {word.zh}
      </div>
      <p className="teach-hook-when">
        {hook.when.split(word.zh).map((chunk, i, all) => (
          <span key={i}>
            {chunk}
            {i < all.length - 1 && (
              <em className="teach-hit" lang="zh-CN">
                {word.zh}
              </em>
            )}
          </span>
        ))}
      </p>
      <div className="teach-hook-card">
        <div className="kicker-ink">How people use it</div>
        <p>{hook.usage}</p>
      </div>
    </div>
  )
}

function ExampleBeat({ word, example }: { word: Vocab; example: Example | null }) {
  if (!example) {
    return (
      <div className="teach-example-stage">
        <p className="sub" style={{ textWrap: 'pretty' }}>
          You’ll meet {word.zh} in this 课文. Listen for it when you read.
        </p>
      </div>
    )
  }

  const bits = splitOnWord(example.zh, word.zh)
  return (
    <div className="teach-example-stage">
      <p className="teach-example-line zh" lang="zh-CN">
        {bits.map((b, i) => (
          <span
            key={`${b.text}-${i}`}
            className={b.hit ? 'teach-tok teach-hit' : 'teach-tok'}
            style={{ animationDelay: `${90 + i * 95}ms` }}
          >
            {b.text}
          </span>
        ))}
      </p>
      {example.pinyin && (
        <p className="teach-example-pyin" style={{ animationDelay: `${90 + bits.length * 95 + 80}ms` }}>
          {example.pinyin}
        </p>
      )}
      {example.en && (
        <p className="teach-example-yes" style={{ animationDelay: `${90 + bits.length * 95 + 200}ms` }}>
          {example.en}
        </p>
      )}
    </div>
  )
}

function SealBeat({ word }: { word: Vocab }) {
  const glyphs = splitHanzi(word.zh)
  return (
    <div className="teach-seal">
      <div className="teach-glyphs" lang="zh-CN" aria-label={word.zh}>
        {glyphs.map((g, i) => (
          <span key={`${g}-${i}`} className="teach-glyph" style={{ animationDelay: `${40 + i * 90}ms` }}>
            {g}
          </span>
        ))}
      </div>
      <p className="teach-seal-py" style={{ animationDelay: '420ms' }}>
        {word.pinyin}
      </p>
      <p className="teach-seal-en" style={{ animationDelay: '640ms' }}>
        {word.en}
      </p>
    </div>
  )
}
