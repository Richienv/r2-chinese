interface P {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const HomeIcon = ({ size = 21 }: P) => (
  <svg {...base(size)}>
    <path d="M3 10.2 12 3.5l9 6.7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
)

export const BookIcon = ({ size = 21 }: P) => (
  <svg {...base(size)}>
    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z" />
    <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3" />
  </svg>
)

export const BarsIcon = ({ size = 21 }: P) => (
  <svg {...base(size)}>
    <path d="M5 20V11M12 20V4M19 20v-6" />
  </svg>
)

export const UserIcon = ({ size = 21 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
)

export const PlayIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)

export const CheckIcon = ({ size = 20 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const LockIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.4" />
    <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
  </svg>
)

export const ChevronLeft = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M14.5 5 8 12l6.5 7" />
  </svg>
)

export const ChevronRight = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M9.5 5 16 12l-6.5 7" />
  </svg>
)

export const CloseIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const UndoIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M9 7 4.5 11.5 9 16" />
    <path d="M5 11.5h8.5a5.5 5.5 0 0 1 0 11H11" transform="translate(0 -4)" />
  </svg>
)

export const EraseIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M4.5 7.5h15M9.5 7.5V5h5v2.5M6.5 7.5l.8 11a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-11" />
  </svg>
)

export const RefreshIcon = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M20 12a8 8 0 1 1-2.5-5.8" />
    <path d="M20 4v4.5h-4.5" />
  </svg>
)

export const PencilIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M4 20h4L19.2 8.8a2.1 2.1 0 0 0-3-3L5 17z" />
  </svg>
)

export const TargetIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
  </svg>
)

export const ChatIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M20 15.5a2.5 2.5 0 0 1-2.5 2.5H9l-4.5 3v-3A2.5 2.5 0 0 1 4 15.5v-8A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5z" />
  </svg>
)

export const CardsIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <rect x="3.5" y="6.5" width="13" height="14" rx="2.4" />
    <path d="M7.5 3.5h11a2 2 0 0 1 2 2v11" />
  </svg>
)

export const StarIcon = ({ size = 20, filled = false }: P & { filled?: boolean }) => (
  <svg {...base(size)} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3.6 2.6 5.4 5.9.85-4.3 4.15 1.02 5.9L12 17.1l-5.22 2.8 1.02-5.9L3.5 9.85l5.9-.85z" />
  </svg>
)

export const BoltIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M13.2 2.5 4.8 13.2h5.6l-.6 8.3 8.4-10.7h-5.6z" />
  </svg>
)

export const HeartIcon = ({ size = 16, filled = true }: P & { filled?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 20s-7.2-4.35-9.2-8.4C1.3 8.8 2.7 5.6 6 5.2c1.9-.2 3.6.7 4.5 2.2C11.4 5.9 13.1 5 15 5.2c3.3.4 4.7 3.6 3.2 6.4C19.2 15.65 12 20 12 20z" />
  </svg>
)

export const FlameGlyph = ({ size = 16, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.6 2c.5 3-1.3 4.3-2.8 5.8C8.1 9.5 7 11 7 13.4A5.6 5.6 0 0 0 12.6 19a5.4 5.4 0 0 0 5.4-5.6c0-4-2.4-5.6-3.4-8.2-.4-1.1-1.4-2.4-2-3.2z" />
  </svg>
)

export const ChevronDown = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const TrendingUpIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </svg>
)

export const UsersIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <circle cx="16.5" cy="9.5" r="2.2" />
    <path d="M16.5 14a4 4 0 0 1 4 5" />
  </svg>
)

export const AwardIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="9" r="5" />
    <path d="M9 13.5 7.5 21l4.5-2.2L16.5 21 15 13.5" />
  </svg>
)

export const SparklesIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
    <path d="M19 4v3M20.5 5.5h-3M5 16v3M6.5 17.5h-3" />
  </svg>
)

export const CompassIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <polygon points="10 10 15.5 8.5 14 14 8.5 15.5" />
  </svg>
)

export const HeadphonesIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3" y="13" width="4" height="7" rx="1.6" />
    <rect x="17" y="13" width="4" height="7" rx="1.6" />
  </svg>
)

export const MessageCircleIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 20.5l1.6-4.7A8.5 8.5 0 1 1 21 11.5z" />
  </svg>
)

export const HelpCircleIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.6 2.6 0 0 1 4.9.9c0 1.7-2.5 2.2-2.5 3.8" />
    <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)
