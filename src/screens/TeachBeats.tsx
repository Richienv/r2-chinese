import { useState } from 'react'
import { Glossed, useGloss } from '../components/ChineseText'
import { HearButton, useAutoSpeak } from '../components/Hear'
import { SaveStar } from '../components/SaveStar'
import { StrokeWord } from '../components/StrokeWord'
import { StudyDisplayControls } from '../components/StudyDisplayControls'
import type { Example } from '../lib/content'
import { t } from '../lib/i18n'
import { memoryTips } from '../lib/memoryTips'
import type { TeachPhase, WordHook } from '../lib/teach'
import type { Vocab } from '../lib/types'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'
import { useStore } from '../store/store'
import { RefreshIcon } from '../components/Icons'
import { useStagedReveal } from '../components/useStagedReveal'
import { speak } from '../lib/speech'
import '../styles/compact-session.css'

/** Hanzi, pinyin, meaning, example, then the memory cue. */
const TEACH_STAGES = [0, 650, 1250, 1950, 2650] as const

export function TeachView({ word, example, hook, lesson, n, of }: {
  phase: TeachPhase; word: Vocab; example: Example | null; hook: WordHook; lesson: number; n: number; of: number
}) {
  const { prefs } = useStore()
  const { onWord, sheet } = useGloss()
  const [strokes, setStrokes] = useState(false)
  const tips = memoryTips(word, example)
  const tip = tips.find(item => ['Keep a useful pair', 'Catch the common mistake', 'Keep the sentence frame', 'Learn the whole bridge', 'Connect two meanings'].includes(item.key))
  useAutoSpeak(word.zh, VOICE.xiaoxiao, WORD_RATE)
  const reveal = useStagedReveal(TEACH_STAGES, word.zh)
  function learnAgain() {
    reveal.replay()
    void speak(word.zh, { voice: VOICE.xiaoxiao, rate: WORD_RATE, trackWords: true })
  }
  return <article className="word-lesson-card" onClick={() => { if (!reveal.done) reveal.showAll() }}>
    <header><span className="compact-eyebrow">{t('Word {n} of {of}', { n, of })}</span><span className="word-lesson-actions"><button type="button" className="replay-sequence" onClick={(event) => { event.stopPropagation(); learnAgain() }}><RefreshIcon size={14}/>{t('Learn again')}</button><SaveStar zh={word.zh} lesson={lesson} size={20}/></span></header>
    <div className="word-lesson-title" data-reveal={reveal.at(0)} data-reveal-kind="hanzi"><h2 lang="zh-CN">{word.zh}</h2><HearButton text={word.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label={t('Hear the word')}/></div>
    {prefs.showPinyin && <p className="word-lesson-pinyin" data-reveal={reveal.at(1)}>{word.pinyin}</p>}
    {prefs.showEnglish && <p className="word-lesson-meaning" data-reveal={reveal.at(2)}>{word.en}</p>}
    {example && <section className="word-lesson-example" data-reveal={reveal.at(3)}><p lang="zh-CN"><Glossed text={example.zh} onWord={onWord} learnedWords={[word.zh]}/></p>{prefs.showEnglish && <p className="word-lesson-translation">{example.en}</p>}<HearButton text={example.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label={t('Hear the line')}/></section>}
    {prefs.showEnglish && <aside className="word-lesson-cue" data-reveal={reveal.at(4)}><span>{t('One useful cue')}</span><p>{tip?.cue || hook.when}</p></aside>}
    <details className="word-lesson-tools" data-reveal={reveal.at(4)}><summary>{t('Writing & display')}</summary><button className="session-text-action" onClick={() => setStrokes(!strokes)}>{strokes ? t('Hide stroke order') : t('Show stroke order')}</button>{strokes && <StrokeWord text={word.zh}/>}{prefs.showPinyin && example?.pinyin && <p className="word-lesson-pinyin"><strong>{t('Example pinyin')}</strong><br/>{example.pinyin}</p>}<StudyDisplayControls/></details>
    {sheet}
  </article>
}
