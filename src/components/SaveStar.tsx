import { lessonOf } from '../lib/content'
import { useStore } from '../store/store'
import { StarIcon } from './Icons'

/**
 * One-tap save. Starring also seeds an SRS card (see store.toggleStar), so the
 * same control both bookmarks a word and drops it into the review deck.
 */
export function SaveStar({
  zh,
  lesson,
  size = 20,
  onRed = false,
}: {
  zh: string
  lesson?: number
  size?: number
  onRed?: boolean
}) {
  const store = useStore()
  const on = store.isStarred(zh)
  return (
    <button
      className="tap44"
      aria-label={on ? `Remove ${zh} from saved` : `Save ${zh} for drilling`}
      aria-pressed={on}
      onClick={(e) => {
        e.stopPropagation()
        store.toggleStar(zh, lesson ?? lessonOf(zh) ?? 0)
      }}
      style={{
        display: 'grid',
        placeItems: 'center',
        color: on ? '#FFB13C' : onRed ? 'var(--on-red-2)' : 'var(--muted-2)',
        transition: 'color .15s, transform .15s',
      }}
    >
      <StarIcon size={size} filled={on} />
    </button>
  )
}
