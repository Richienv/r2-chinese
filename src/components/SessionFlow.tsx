import { t } from '../lib/i18n'
import { MasteryTracker } from './MasteryTracker'
import '../styles/compact-session.css'

/** Learn → Practise → Done, with the position inside the current stage. */
export function SessionProgress({ kind, n, of }: { kind: string; n?: number; of?: number }) {
  const stage = kind === 'complete' ? 2 : ['teach', 'read', 'note'].includes(kind) ? 0 : 1
  return <div className="session-stages" aria-label={t('Session steps')}>{[t('Learn'), t('Practise'), t('Done')].map((label, i) => <span key={label} aria-current={i === stage ? 'step' : undefined} data-active={i === stage} data-past={i < stage}>{label}{i === stage && i < 2 && n && of && of > 1 ? <b>{n}/{of}</b> : null}</span>)}</div>
}
export function SessionSummary({ title, words }: { title: string; words: string[] }) {
  return <section className="session-summary-simple"><span className="compact-eyebrow">{t('Session saved')}</span><h2>{t('A good place to stop.')}</h2><p className="compact-description">{title}</p><div className="session-word-trail" lang="zh-CN">{words.map(word => <span key={word}>{word}</span>)}</div><p className="compact-description">{t('Your words stay in your learning trail. Review returns when it is due.')}</p>{words.length > 0 && <details className="session-summary-details"><summary>{t('Word progress')}</summary><MasteryTracker words={words}/></details>}</section>
}
export function PracticeExit({ onFinish }: { onFinish: () => void }) {
  return <div className="practice-exit"><button onClick={onFinish}>{t('Finish practice')}</button></div>
}
