import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../lib/i18n'
import { CloseIcon } from './Icons'
import '../styles/dictionary.css'

/** Body portal: transformed teaching cards must never contain a fixed dialog. */
export function Sheet({ onClose, children, label = t('Word details') }: { onClose: () => void; children: ReactNode; label?: string }) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    close.current?.focus()
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // App listens for Escape on document too: close only this top dialog.
        event.preventDefault()
        event.stopImmediatePropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) { event.preventDefault(); dialog.current?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard, true)
    return () => {
      document.removeEventListener('keydown', keyboard, true)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className="backdrop dictionary-backdrop" onClick={(event) => {
      event.stopPropagation()
      if (event.target === event.currentTarget) onClose()
    }}>
      <div ref={dialog} className="sheet dictionary-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <button ref={close} type="button" className="dictionary-close icon-round tap44" aria-label={t('Close word details')} onClick={onClose}><CloseIcon size={20} /></button>
        <div className="dictionary-scroll">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
