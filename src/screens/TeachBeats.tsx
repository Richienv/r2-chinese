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
import '../styles/compact-session.css'

export function TeachView({ word, example, hook, lesson, n, of }: {
  phase: TeachPhase; word: Vocab; example: Example | null; hook: WordHook; lesson: number; n: number; of: number
}) {
  const { prefs } = useStore()
  const { onWord, sheet } = useGloss()
  const [strokes, setStrokes] = useState(false)
  const tips = memoryTips(word, example)
  const tip = tips.find(item => ['Keep a useful pair', 'Catch the common mistake', 'Keep the sentence frame', 'Learn the whole bridge', 'Connect two meanings'].includes(item.key))
  useAutoSpeak(word.zh, VOICE.xiaoxiao, WORD_RATE)
  return <article className="word-lesson-card">
    <header><span className="compact-eyebrow">{t('Word {n} of {of}', { n, of })}</span><SaveStar zh={word.zh} lesson={lesson} size={20}/></header>
    <div className="word-lesson-title"><h2 lang="zh-CN">{word.zh}</h2><HearButton text={word.zh} voice={VOICE.xiaoxiao} rate={WORD_RATE} label={t('Hear the word')}/></div>
    {prefs.showPinyin && <p className="word-lesson-pinyin">{word.pinyin}</p>}
    {prefs.showEnglish && <p className="word-lesson-meaning">{word.en}</p>}
    {example && <section className="word-lesson-example"><p lang="zh-CN"><Glossed text={example.zh} onWord={onWord} learnedWords={[word.zh]}/></p>{prefs.showEnglish && <p className="word-lesson-translation">{example.en}</p>}<HearButton text={example.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label={t('Hear the line')}/></section>}
    {prefs.showEnglish && <aside className="word-lesson-cue"><span>{t('One useful cue')}</span><p>{tip?.cue || hook.when}</p></aside>}
    <details className="word-lesson-tools"><summary>{t('Writing & display')}</summary><button className="session-text-action" onClick={() => setStrokes(!strokes)}>{strokes ? t('Hide stroke order') : t('Show stroke order')}</button>{strokes && <StrokeWord text={word.zh}/>}{prefs.showPinyin && example?.pinyin && <p className="word-lesson-pinyin"><strong>{t('Example pinyin')}</strong><br/>{example.pinyin}</p>}<StudyDisplayControls/></details>
    {sheet}
  </article>
}
