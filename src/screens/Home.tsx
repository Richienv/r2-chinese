import { useAuth } from '../auth/AuthProvider'
import { Flame, ProgressRing } from '../components/Flame'
import {
  BoltIcon,
  CardsIcon,
  ChatIcon,
  ChevronRight,
  PencilIcon,
  PlayIcon,
} from '../components/Icons'
import { StreakCalendar } from '../components/StreakCalendar'
import { book, focusChar, lessons, lookup } from '../lib/content'
import { dueCards } from '../lib/srs'
import { DAILY_GOAL, useStore } from '../store/store'

export function Home({
  onLesson,
  onReview,
  onChar,
  onSaved,
}: {
  onLesson: (n: number, startStep?: number) => void
  onReview: () => void
  onChar: (c: string) => void
  onSaved: () => void
}) {
  const s = useStore()
  const { user } = useAuth()
  const name = user?.email ? user.email.split('@')[0] : 'Learner'
  const current = lessons.find((l) => !s.lessonsDone.includes(l.lesson)) ?? lessons[lessons.length - 1]
  const resume = s.inProgress && s.inProgress.lesson === current.lesson ? s.inProgress.step : undefined
  const due = dueCards(s.cardList).length
  const goalPct = Math.min(1, s.today.cards / DAILY_GOAL)
  const remaining = Math.max(0, DAILY_GOAL - s.today.cards)
  const char = focusChar(current)
  const charWord = lookup(current.extras.same_char[0]?.words[0] ?? '')
  const coursePct = s.lessonsDone.length / lessons.length

  const hour = new Date().getHours()
  const greeting = hour < 11 ? '早上好 👋' : hour < 18 ? '下午好 👋' : '晚上好 👋'

  return (
    <>
      <header className="row" style={{ padding: '18px 0 16px' }}>
        <div className="avatar">语</div>
        <div>
          <div className="zh" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
            {greeting}
          </div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: '-0.2px',
              textTransform: 'capitalize',
            }}
          >
            {name}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span className="pill-ink">
            <BoltIcon size={14} /> {s.xp.toLocaleString()}
          </span>
          <span className="pill-ink">
            <Flame size={15} /> {s.streak}
          </span>
        </div>
      </header>

      {/* continue learning */}
      <section className="metal hero">
        <div className="kicker">{resume !== undefined ? 'Resume learning' : 'Continue learning'}</div>
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="hero-title on-red">{current.title.zh}</h2>
            <div style={{ fontSize: 13, color: 'var(--on-red-2)', fontWeight: 600 }}>
              HSK 4A · Lesson {current.lesson}
              {resume !== undefined ? ` · step ${resume + 1}` : ` · ${current.title.en}`}
            </div>
          </div>
          <button
            className="play-round"
            onClick={() => onLesson(current.lesson, resume)}
            aria-label={resume !== undefined ? 'Resume lesson' : 'Start lesson'}
          >
            <PlayIcon size={20} />
          </button>
        </div>
        <div className="bar" style={{ marginTop: 16 }}>
          <i style={{ width: `${coursePct * 100}%` }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--on-red-3)', marginTop: 8, fontWeight: 600 }}>
          {s.lessonsDone.length} of {lessons.length} lessons · {Math.round(coursePct * 100)}%
        </div>
      </section>

      {/* daily goal + streak */}
      <section className="metal metal-sm" style={{ marginTop: 14, padding: 18, borderRadius: 22 }}>
        <div className="between">
          <div>
            <div className="kicker">Daily goal</div>
            <div className="on-red" style={{ fontSize: 21, fontWeight: 800, margin: '6px 0 4px' }}>
              {Math.min(s.today.cards, DAILY_GOAL)} of {DAILY_GOAL} cards
            </div>
            <div style={{ fontSize: 13, color: 'var(--on-red-2)', fontWeight: 500 }}>
              {remaining > 0 ? `${remaining} more to reach today's goal ✨` : 'Goal reached today 🎉'}
            </div>
            <div className="pill" style={{ marginTop: 12 }}>
              <Flame size={16} />
              {s.streak} day streak
            </div>
          </div>
          <ProgressRing value={goalPct}>
            <Flame size={22} />
            <div className="on-red" style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
              {s.streak}
            </div>
            <div style={{ fontSize: 9, color: 'var(--on-red-3)', fontWeight: 700 }}>DAYS</div>
          </ProgressRing>
        </div>
      </section>

      <StreakCalendar days={s.practiceDays} />

      {/* review CTA */}
      <button
        className="card between"
        style={{ width: '100%', marginTop: 14, textAlign: 'left' }}
        onClick={onReview}
      >
        <div className="row">
          <div
            className="lesson-badge metal metal-sm"
            style={{ borderRadius: 14, width: 42, height: 42 }}
          >
            <CardsIcon />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {due > 0 ? `${due} cards due for review` : 'Nothing due — review anyway'}
            </div>
            <div className="sub" style={{ fontSize: 13 }}>
              {due > 0 ? `~${Math.max(1, Math.round(due * 0.2))} min` : 'Keeps the streak alive'}
            </div>
          </div>
        </div>
        <ChevronRight />
      </button>

      {/* today's focus */}
      <h3 className="h2" style={{ fontSize: 19, margin: '24px 0 12px' }}>
        Today's focus
      </h3>
      <div className="grid2">
        <Tile
          icon={<BoltIcon />}
          label={s.starred.length ? `Saved · ${s.starred.length}` : 'Saved words'}
          onClick={onSaved}
        />
        <Tile icon={<CardsIcon />} label="Review" onClick={onReview} />
        <Tile icon={<ChatIcon />} label="Reading" onClick={() => onLesson(current.lesson)} />
        <Tile icon={<PencilIcon />} label="Handwriting" onClick={() => onChar(char)} />
      </div>

      {/* character of the day */}
      <h3 className="h2" style={{ fontSize: 19, margin: '24px 0 12px' }}>
        Character of the day
      </h3>
      <button className="card row" style={{ width: '100%', textAlign: 'left' }} onClick={() => onChar(char)}>
        <div
          style={{
            fontFamily: 'var(--serif-sc)',
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--red-deep)',
          }}
        >
          {char}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {charWord ? (
              <>
                <span className="zh">{charWord.zh}</span>{' '}
                <span style={{ color: 'var(--warm-hot)' }}>{charWord.pinyin}</span>
              </>
            ) : (
              `From lesson ${current.lesson}`
            )}
          </div>
          <div className="sub" style={{ fontSize: 13 }}>
            {charWord?.en ?? current.title.en}
          </div>
          <div style={{ fontSize: 12, color: 'var(--link)', fontWeight: 700, marginTop: 6 }}>
            Practice handwriting →
          </div>
        </div>
      </button>

      <p style={{ fontSize: 11, color: 'var(--muted-3)', marginTop: 22, lineHeight: 1.5 }}>
        Content from {book.title_zh} · {book.title_en}, {book.publisher}.
      </p>
    </>
  )
}

function Tile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button className="metal metal-sm focus-tile" onClick={onClick}>
      <span className="glass" style={{ borderRadius: 12, padding: 8, display: 'grid' }}>
        {icon}
      </span>
      <span className="on-red">{label}</span>
    </button>
  )
}
