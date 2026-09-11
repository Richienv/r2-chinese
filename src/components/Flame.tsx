export function Flame({ size = 26 }: { size?: number }) {
  return (
    <div className="flame" style={{ width: size, height: size }}>
      <span className="glow" />
      <svg className="f1" width={size} height={size} viewBox="0 0 24 24" fill="#FFB13C">
        <path d="M12.6 2c.5 3-1.3 4.3-2.8 5.8C8.1 9.5 7 11 7 13.4A5.6 5.6 0 0 0 12.6 19a5.4 5.4 0 0 0 5.4-5.6c0-4-2.4-5.6-3.4-8.2-.4-1.1-1.4-2.4-2-3.2z" />
      </svg>
      <svg
        className="f2"
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 24 24"
        fill="#FFF0C4"
        style={{ marginTop: size * 0.16 }}
      >
        <path d="M12.4 7c.3 1.8-.8 2.6-1.7 3.5-.9 1-1.6 1.9-1.6 3.3A3.4 3.4 0 0 0 12.4 17a3.2 3.2 0 0 0 3.2-3.4c0-2.4-1.4-3.4-2-5-.3-.6-.8-1.4-1.2-1.6z" />
      </svg>
    </div>
  )
}

export function ProgressRing({
  value,
  size = 104,
  children,
}: {
  value: number
  size?: number
  children?: React.ReactNode
}) {
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,.22)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringfill)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.4,.15,.2,1)' }}
        />
        <defs>
          <linearGradient id="ringfill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE0B0" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}
