import { useState } from 'react'
import { t } from '../lib/i18n'
import type { PracticeChoice } from '../lib/sessionRoute'
import { MasteryTracker } from './MasteryTracker'
import '../styles/compact-session.css'

export function SessionProgress({ kind }: { kind: string }) {
  const stage = kind === 'complete' ? 2 : ['teach', 'read', 'note'].includes(kind) ? 0 : 1
  return <div className="session-stages" aria-label={t('Session steps')}>{[t('Learn'), t('Practise'), t('Done')].map((label, i) => <span key={label} aria-current={i === stage ? 'step' : undefined} data-active={i === stage}>{label}</span>)}</div>
}
export function PracticeChoiceScreen({ choices, onChoose, onFinish }: { choices: PracticeChoice[]; onChoose: (ids: string[]) => void; onFinish: () => void }) {
  const [mode, setMode] = useState(choices[0]?.mode)
  const selected = choices.find(choice => choice.mode === mode) ?? choices[0]
  return <section className="practice-choice-screen">
    <p className="compact-eyebrow">{t('A little practice')}</p><h2>{t('What would help now?')}</h2>
    <p className="compact-description">{t('Pick one short round, or finish here.')}</p>
    <div className="practice-choices" role="group" aria-label={t('Choose a short practice')}>
      {choices.map(choice => <button key={choice.mode} aria-pressed={mode === choice.mode} onClick={() => setMode(choice.mode)}><strong>{choice.mode === 'words' ? t('Remember words') : choice.mode === 'meaning' ? t('Check the meaning') : t('Use a sentence')}</strong><span>{choice.mode === 'sentence' ? t('One useful reply · help available') : t('{n} short questions', { n: choice.ids.length })}</span><i aria-hidden="true">{choice.mode === mode ? '●' : '○'}</i></button>)}
    </div>
    {selected && <button className="btn" onClick={() => onChoose(selected.ids)}>{t('Start this round')}</button>}
    <button className="session-text-action" onClick={onFinish}>{t('Finish for now')}</button>
  </section>
}
export function SessionSummary({ title, words }: { title: string; words: string[] }) {
  return <section className="session-summary-simple"><span className="compact-eyebrow">{t('Session saved')}</span><h2>{t('A good place to stop.')}</h2><p className="compact-description">{title}</p><div className="session-word-trail" lang="zh-CN">{words.map(word => <span key={word}>{word}</span>)}</div><p className="compact-description">{t('Your words stay in your learning trail. Review returns when it is due.')}</p>{words.length > 0 && <details className="session-summary-details"><summary>{t('Word progress')}</summary><MasteryTracker words={words}/></details>}</section>
}
export function PracticeExit({ onSkip, onFinish }: { onSkip: () => void; onFinish: () => void }) {
  return <div className="practice-exit"><button onClick={onSkip}>{t('Skip for now')}</button><button onClick={onFinish}>{t('Finish practice')}</button></div>
}
