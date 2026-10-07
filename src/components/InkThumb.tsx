import type { InkDrawing } from '../lib/handwriting'

/** The learner's own ink, redrawn small. It shows what was drawn, never a cleaned-up version. */
export function InkThumb({ drawing, label, className = '' }: { drawing: InkDrawing; label: string; className?: string }) {
  return (
    <svg className={`ink-thumb ${className}`.trim()} viewBox="0 0 320 320" role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} focusable="false">
      <path className="ink-thumb-guide" d="M12 160h296M160 12v296" />
      {drawing.map((stroke, index) => stroke.length > 1
        ? <polyline key={index} className="ink-thumb-stroke" points={stroke.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} />
        : stroke.length === 1 ? <circle key={index} className="ink-thumb-dot" cx={stroke[0][0]} cy={stroke[0][1]} r={5} /> : null)}
    </svg>
  )
}
