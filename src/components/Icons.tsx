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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.6 2c.5 3-1.3 4.3-2.8 5.8C8.1 9.5 7 11 7 13.4A5.6 5.6 0 0 0 12.6 19a5.4 5.4 0 0 0 5.4-5.6c0-4-2.4-5.6-3.4-8.2-.4-1.1-1.4-2.4-2-3.2z" />
  </svg>
)
