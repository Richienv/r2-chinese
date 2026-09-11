import type { ReactNode } from 'react'

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet">{children}</div>
    </div>
  )
}
