import { useCoupleProfile } from '../lib/coupleProfile'

/** Crisp persistent identity pill so Richie (HSK 4 · Emerald) & Renita (HSK 1 · Sakura Pink) are unmistakable in <0.5s. */
export function MemberBadge({ compact = false }: { compact?: boolean }) {
  const { activeId, member } = useCoupleProfile()
  const isRenita = activeId === 'renita'
  return (
    <span
      className={`member-badge-pill${compact ? ' is-compact' : ''}`}
      data-member={activeId}
      aria-label={`${member.name} · ${member.badge}`}
    >
      <span aria-hidden="true">{isRenita ? '🌸' : '🐉'}</span>
      <strong>{member.name}</strong>
      <span>·</span>
      <span>{isRenita ? 'HSK 1' : 'HSK 4'}</span>
    </span>
  )
}
