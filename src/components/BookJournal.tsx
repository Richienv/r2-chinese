import { useId, useState } from 'react'
import { getBooksChapter, type BooksChapter } from '../lib/books'
import { bookJournalActions, bookReviewDate, hasMeaningfulBookReflection, useBookJournal, useBookJournalEntries } from '../lib/bookJournal'
import { isIndonesian, t } from '../lib/i18n'
import '../styles/book-journal.css'

type Panel = 'words' | 'belief' | 'action'

/** A saved notebook, with no automatic evaluation of the learner's reflection. */
export function BookJournal({ chapter, teachBackPrompt, actionPrompt, reviewPrompt }: {
  chapter: BooksChapter
  teachBackPrompt: string
  actionPrompt: string
  reviewPrompt: string
}) {
  const id = useId()
  const [panel, setPanel] = useState<Panel>('words')
  const { entry, update, markTried, markRevisit, saveStatus } = useBookJournal(chapter.part, chapter.index)
  const ready = hasMeaningfulBookReflection(entry)
  const kept = !!entry.actionSavedAt
  const panels = [{ id: 'words', label: t('Own words') }, { id: 'belief', label: t('Belief shift') }, { id: 'action', label: t('Try it') }] as const
  const saveLabel = saveStatus === 'session-only' ? t('Kept in this session · device saving unavailable') : entry.updatedAt ? t('Saved on this device') : t('Your draft saves as you write')

  return <section className="book-journal" aria-label={t('Chapter notebook')}>
    <header className="book-journal-heading"><div><span className="book-journal-kicker">{t('Your notebook')}</span><h2>{t('Make the idea yours')}</h2></div><span className="book-journal-save" role="status">{saveLabel}</span></header>
    <nav className="book-journal-panels" aria-label={t('Notebook sections')}>{panels.map((item) => <button type="button" key={item.id} aria-current={panel === item.id ? 'step' : undefined} aria-controls={`${id}-${item.id}`} onClick={() => setPanel(item.id)}>{item.label}</button>)}</nav>
    <div key={panel} id={`${id}-${panel}`} className="book-journal-page">
      {panel === 'words' && <>
        <p className="book-journal-prompt">{teachBackPrompt}</p>
        <label htmlFor={`${id}-teach-back`}>{t('Explain it in your own words')}</label>
        <textarea id={`${id}-teach-back`} rows={5} value={entry.teachBack} onChange={(event) => update({ teachBack: event.target.value })} placeholder={t('Explain the idea as if you’re telling a colleague.')} />
        <p className="book-journal-note">{t('Saved for you to revisit. No automatic grading.')}</p>
        <button type="button" className="book-journal-next" onClick={() => setPanel('belief')}>{t('Consider your perspective')}</button>
      </>}
      {panel === 'belief' && <>
        <p className="book-journal-prompt">{t('What changed in your thinking?')}</p>
        <label htmlFor={`${id}-old-belief`}>{t('Before, I assumed…')} <span>{t('Optional')}</span></label>
        <textarea id={`${id}-old-belief`} rows={3} value={entry.oldBelief} onChange={(event) => update({ oldBelief: event.target.value })} placeholder={t('An assumption you brought to this chapter.')} />
        <label htmlFor={`${id}-new-belief`}>{t('Now, I see…')} <span>{t('Optional')}</span></label>
        <textarea id={`${id}-new-belief`} rows={3} value={entry.newBelief} onChange={(event) => update({ newBelief: event.target.value })} placeholder={t('What you would keep, change, or question.')} />
        <button type="button" className="book-journal-next" onClick={() => setPanel('action')}>{t('Choose one thing to try')}</button>
      </>}
      {panel === 'action' && <>
        <p className="book-journal-prompt">{actionPrompt}</p>
        <label htmlFor={`${id}-next-action`}>{t('One specific next action')}</label>
        <textarea id={`${id}-next-action`} rows={3} value={entry.nextAction} onChange={(event) => update({ nextAction: event.target.value })} placeholder={t('What will you do differently in a real situation?')} />
        <label htmlFor={`${id}-when`}>{t('When or where will you try it?')}</label>
        <input id={`${id}-when`} type="text" value={entry.when} onChange={(event) => update({ when: event.target.value })} placeholder={t('A time, meeting, or situation.')} />
        <div className="book-journal-review-date"><span>{t('Return to this plan')}</span><div role="group" aria-label={t('Review date')}>{[{ days: 1, label: t('Tomorrow') }, { days: 3, label: t('In 3 days') }, { days: 7, label: t('In 7 days') }].map(({ days, label }) => <button key={days} type="button" aria-pressed={entry.reviewDate === bookReviewDate(days)} onClick={() => update({ reviewDate: bookReviewDate(days) })}>{label}</button>)}</div>{entry.reviewDate && <small>{t('Review on {date}', { date: new Date(`${entry.reviewDate}T12:00:00`).toLocaleDateString(isIndonesian() ? 'id-ID' : undefined, { month: 'short', day: 'numeric' }) })}</small>}</div>
        {!kept && (ready ? <div className="book-journal-ready"><span>{t('Draft ready to keep')}</span><button type="button" className="book-journal-next" onClick={() => update({ actionSavedAt: Date.now(), reviewDate: entry.reviewDate || bookReviewDate(1), completionMode: 'reflection-drafted' })}>{t('Keep this action')}</button></div> : <p className="book-journal-note">{t('Add your explanation and one specific action to keep a review plan.')}</p>)}
        {kept && <div className="book-journal-action-state"><span className="book-journal-state" data-state={entry.actionStatus}>{entry.actionStatus === 'tried' ? t('Tried · self-reported') : entry.actionStatus === 'revisit' ? t('Revisit planned') : t('Action planned')}</span><div>{entry.actionStatus !== 'tried' && <button type="button" onClick={markTried}>{t('I tried it')}</button>}{entry.actionStatus !== 'revisit' && <button type="button" onClick={markRevisit}>{t('Revisit this plan')}</button>}</div></div>}
        <label htmlFor={`${id}-evidence`}>{t('What happened when you tried it?')} <span>{t('Optional')}</span></label>
        <textarea id={`${id}-evidence`} rows={3} value={entry.evidence} onChange={(event) => update({ evidence: event.target.value })} placeholder={t('What you observed, including what didn’t work.')} />
        <p className="book-journal-prompt book-journal-review-prompt">{reviewPrompt}</p>
        <p className="book-journal-note">{t('Your plan and outcome are self-reported.')}</p>
      </>}
    </div>
  </section>
}

/** Deliberately kept plans only. Unfinished drafts remain inside their chapter notebook. */
export function BookJournalReview({ onOpen }: { onOpen: (part: number, index: number) => void }) {
  const entries = useBookJournalEntries()
  const [expanded, setExpanded] = useState(false)
  const today = bookReviewDate(0)
  const saved = bookJournalActions(entries, today)
  if (!saved.length) return null
  const visible = expanded ? saved : saved.slice(0, 3)
  return <section className="book-journal-review" aria-label={t('Saved book actions')}>
    <header><div><span className="book-journal-kicker">{t('Your actions')}</span><h3>{t('Bring a plan back')}</h3></div><span>{t('{n} kept', { n: saved.length })}</span></header>
    <p>{t('Saved plans and outcomes · self-reported')}</p>
    <div className="book-journal-action-list">{visible.map((entry) => {
      const chapter = getBooksChapter(entry.part, entry.index)
      const due = !!entry.reviewDate && entry.reviewDate <= today
      return <button type="button" key={`${entry.part}:${entry.index}`} className="book-journal-action" onClick={() => onOpen(entry.part, entry.index)}><span className="book-journal-action-meta"><span>{t('{book} · Chapter {n}', { book: chapter?.partTitleEn || t('Book {n}', { n: entry.part }), n: entry.index })}</span><span className="book-journal-state" data-state={due ? 'due' : entry.actionStatus}>{due ? t('Review due') : entry.actionStatus === 'tried' ? t('Tried') : entry.actionStatus === 'revisit' ? t('Revisit') : t('Planned')}</span></span><strong>{chapter?.titleEn || t('Your chapter plan')}</strong><span className="book-journal-action-preview">{entry.nextAction}</span>{entry.actionStatus === 'tried' && due && <small>{t('Tried · self-reported')}</small>}</button>
    })}</div>
    {saved.length > 3 && <button type="button" className="book-journal-show-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? t('Show fewer plans') : t('Show all {n} plans', { n: saved.length })}</button>}
  </section>
}
