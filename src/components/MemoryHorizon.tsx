import { useStore } from '../store/store'
import { dueCards, memoryTier } from '../lib/srs'
import { t } from '../lib/i18n'

export function MemoryHorizon({ onReview, onPlacement }: { onReview: () => void; onPlacement: () => void }) {
  const store = useStore()
  const due = dueCards(store.cardList).length
  const resting = store.cardList.filter((c) => c.due > Date.now() && c.interval >= 14)
  const longTerm = resting.filter((c) => ['strong', 'maintained'].includes(memoryTier(c))).length
  return (
    <section className="memory-horizon" data-due={due > 0} aria-label={t('Your memory, over time')}>
      <div className="memory-horizon-top"><span>{due ? t('Active recall') : t('All caught up')}</span><span>{due ? t('{n} due', { n: due }) : '温故知新'}</span></div>
      {due > 0 && <h2>{t('Ready for recall')}</h2>}
      <p>{due ? t('{n} words ready. One focused session.', { n: Math.min(due, 12) }) : t('Your words can rest. Continue with your lesson.')}</p>
      {due > 0 && <button className="memory-start" onClick={onReview}>{t('Start focused recall')} <span aria-hidden>→</span></button>}
      <details className="memory-details">
        <summary>{t('Memory details')}</summary>
        <div className="memory-horizon-stats">
          <span><strong>{resting.length}</strong>{t('resting for 2+ weeks')}</span>
          <span><strong>{longTerm}</strong>{t('strong for 2+ months')}</span>
        </div>
        <div className="memory-horizon-actions">
          {!due && <button onClick={onReview}>{t('View recall')}</button>}
          <button onClick={onPlacement}>{t('I already know some words')}</button>
        </div>
      </details>
    </section>
  )
}
