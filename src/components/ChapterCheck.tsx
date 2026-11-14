import { useEffect, useRef, useState } from 'react'
import { Glossed, useGloss } from './ChineseText'
import { HearButton, hasHanzi, useAutoSpeak, useAutoSpeakLines, useSpeechActive } from './Hear'
import { t } from '../lib/i18n'
import { narrowChoices } from '../lib/choiceSupport'
import { speakLines, stopSpeech, unlockSpeech } from '../lib/speech'
import { LINE_RATE, VOICE, WORD_RATE } from '../lib/voices'
import '../styles/chapter-check.css'

type CheckQuestion = { prompt: string; context?: { zh: string; pinyin: string; en: string }; options: { zh: string; label: string }[]; answer: string; explanation?: string }
export function ChapterCheck({ question, n, of, state, assisted = false, onAssistance, onPick }: {
  question: CheckQuestion; n: number; of: number
  state?: { wrong: string[]; solved: boolean; missed: boolean }
  assisted?: boolean; onAssistance: () => void
  onPick: (picked: string, answer: string, helped: boolean) => void
}) {
  const wrong = state?.wrong ?? []
  const solved = state?.solved ?? false
  const [narrow, setNarrow] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [meaning, setMeaning] = useState(false)
  const [helped, setHelped] = useState(false)
  const feedback = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (solved || revealed) feedback.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [solved, revealed])
  const { onWord, sheet } = useGloss()
  const contextZh = question.context?.zh?.trim() ?? ''
  const chineseChoices = question.options.map(o => o.label).filter(label => hasHanzi(label) && !/[A-Za-z]{3,}/.test(label))
  const choiceKey = chineseChoices.join('\u0001')
  const choicesPlaying = useSpeechActive(`lines|${choiceKey}`)
  useAutoSpeak(contextZh, VOICE.xiaoxiao, LINE_RATE)
  useAutoSpeakLines(contextZh ? [] : chineseChoices, VOICE.xiaoxiao, WORD_RATE)
  const supported = assisted || helped || !!state?.missed
  const shown = solved ? question.options.filter(option => option.zh === question.answer) : narrow ? narrowChoices(question.options, question.answer, wrong) : question.options
  const answerLabel = question.options.find(option => option.zh === question.answer)?.label ?? question.answer
  function help() { setHelped(true); onAssistance() }
  return <section className="chapter-check" aria-label={t('Chapter check')}>
    <header className="chapter-check-head">
      <div className="chapter-check-meta"><span>{t('Quick check')}</span><span>{n} / {of}</span></div>
      <div className="chapter-check-progress" aria-hidden="true"><i style={{ width: `${(n - (solved ? 0 : 1)) / Math.max(1, of) * 100}%` }}/></div>
      <h2>{question.prompt}</h2>
      <p>{t('Choose one answer. Help is here if you need it.')}</p>
    </header>
    {question.context && <div className="chapter-check-context">
      <p className="zh" lang="zh-CN"><Glossed text={question.context.zh} onWord={word => { help(); onWord(word) }}/></p>
      {(meaning || solved || revealed) && question.context.en && <p className="chapter-check-meaning">{question.context.en}</p>}
      <div className="chapter-check-context-actions"><HearButton text={question.context.zh} voice={VOICE.xiaoxiao} rate={LINE_RATE} label={t('Hear the line')}/>
        {!solved && !revealed && !meaning && question.context.en && <button onClick={() => { help(); setMeaning(true) }}>{t('Show meaning')}</button>}
      </div>
    </div>}
    {!question.context && chineseChoices.length > 0 && <button className="hear hear-ink" aria-pressed={choicesPlaying} onPointerDown={() => unlockSpeech()} onClick={() => {
      if (choicesPlaying) { stopSpeech(); return }
      void speakLines(chineseChoices.map(text => ({ text, voice: VOICE.xiaoxiao, rate: WORD_RATE })), { group: `lines|${choiceKey}`, key: `lines|${choiceKey}` })
    }}>{choicesPlaying ? t('Stop choices') : t('Hear choices')}</button>}
    <div className="session-options chapter-check-choices" role="group" aria-label={t('Choices')}>
      {shown.map(option => {
        const correct = solved && option.zh === question.answer
        const miss = wrong.includes(option.zh)
        return <button type="button" key={option.zh} className="option" data-state={correct ? 'correct' : miss ? 'wrong' : undefined} disabled={solved || miss} onPointerDown={() => unlockSpeech()} onClick={() => { if (option.zh !== question.answer) help(); onPick(option.zh, question.answer, supported) }}>
          <span className="choice-letter" aria-hidden="true">{String.fromCharCode(65 + question.options.indexOf(option))}</span>
          <span className={hasHanzi(option.label) ? 'zh' : undefined} lang={hasHanzi(option.label) ? 'zh-CN' : undefined}>{option.label}</span>
          {correct && <span className="choice-mark" aria-label={t('Correct')}>✓</span>}
          {miss && <span className="choice-mark">{t('Try another')}</span>}
        </button>
      })}
    </div>
    {!solved && wrong.length > 0 && <p className="chapter-check-retry" role="status">{t('That choice is out. Try another, or see the explanation.')}</p>}
    {!solved && !revealed && <div className="chapter-check-help">
      {!narrow && shown.length > 2 && <button onClick={() => { help(); setNarrow(true) }}>{t('Narrow to two')}</button>}
      <button onClick={() => { help(); setRevealed(true) }}>{t('Show answer & why')}</button>
    </div>}
    {(solved || revealed) && <div ref={feedback} className="chapter-check-feedback" role="status">
      <span>{solved ? supported ? t('Understood with help') : t('You got it') : t('Worked answer')}</span>
      <strong className={hasHanzi(answerLabel) ? 'zh' : undefined}>{answerLabel}</strong>
      {question.explanation && <p>{question.explanation}</p>}
      {!solved && <p>{t('Read the explanation, then choose the answer above to continue.')}</p>}
    </div>}
    {supported && <p className="chapter-check-support-note">{t('Help counts as practice. Independent recall is checked separately.')}</p>}
    {sheet}
  </section>
}
