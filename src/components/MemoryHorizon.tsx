import { useStore } from '../store/store'
import { dueCards, memoryTier } from '../lib/srs'
import { t } from '../lib/i18n'
export function MemoryHorizon({ onReview, onPlacement }: { onReview: () => void; onPlacement: () => void }) {
  const store = useStore(),
    due = dueCards(store.cardList).length
  const resting = store.cardList.filter((c) => c.due > Date.now() && c.interval >= 14)
  const longTerm = resting.filter((c) => ['strong', 'maintained'].includes(memoryTier(c))).length
  return (
    <section className="memory-horizon" aria-label={t('Your memory, over time')}>
      <div className="memory-horizon-top">
        <span>{t('Your memory, over time')}</span>
        <span lang="zh-CN">温故知新</span>
      </div>
      <h2>{due ? t('A little recall. A longer memory.') : t('Give strong words some space.')}</h2>
      <p>
        {due
          ? t('{n} words ready. One focused session.', { n: Math.min(due, 12) })
          : t('No overdue words. Learn something new, or check what you already know.')}
      </p>
      <div className="memory-horizon-stats">
        <span>
          <strong>{resting.length}</strong>
          {t('resting for 2+ weeks')}
        </span>
        <span>
          <strong>{longTerm}</strong>
          {t('strong for 2+ months')}
        </span>
      </div>
      <div className="memory-horizon-actions">
        <button onClick={onReview}>{due ? t('Start focused recall') : t('View recall')}</button>
        <button onClick={onPlacement}>{t('I already know some words')}</button>
      </div>
    </section>
  )
}
