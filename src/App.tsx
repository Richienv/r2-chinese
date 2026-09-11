import { useEffect, useRef, useState } from 'react'
import { BarsIcon, BookIcon, HomeIcon, UserIcon } from './components/Icons'
import { CharacterOverlay } from './screens/Character'
import { DrillFlow } from './screens/Drill'
import { Home } from './screens/Home'
import { Learn } from './screens/Learn'
import { LessonFlow } from './screens/Lesson'
import { Profile } from './screens/Profile'
import { Progress } from './screens/Progress'
import { ReviewFlow } from './screens/Review'
import { SavedWords } from './screens/SavedWords'
import { VocabBrowser } from './screens/VocabBrowser'
import { load, normalize, useStore, StoreProvider, type Persisted } from './store/store'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { AuthScreen } from './auth/AuthScreen'
import { isAuthEnabled } from './lib/supabase'
import { fetchProgress } from './lib/sync'

type Tab = 'home' | 'learn' | 'stats' | 'profile'
type Overlay =
  | { kind: 'lesson'; lesson: number; startStep?: number }
  | { kind: 'review'; words?: string[]; title?: string }
  | { kind: 'character'; char: string }
  | { kind: 'drill'; words: string[]; title: string }
  | { kind: 'saved' }
  | { kind: 'vocab' }
  | null

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Home', icon: <HomeIcon /> },
  { key: 'learn', label: 'Learn', icon: <BookIcon /> },
  { key: 'stats', label: 'Progress', icon: <BarsIcon /> },
  { key: 'profile', label: 'Profile', icon: <UserIcon /> },
]

const TAB_KEYS: Tab[] = ['home', 'learn', 'stats', 'profile']

function Shell() {
  const store = useStore()
  const [tab, setTabState] = useState<Tab>(
    () => (TAB_KEYS.includes(store.lastTab as Tab) ? (store.lastTab as Tab) : 'home'),
  )
  const [overlay, setOverlay] = useState<Overlay>(null)
  const mainRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const open = overlay !== null

  function setTab(next: Tab) {
    setTabState(next)
    store.setLastTab(next)
  }

  // A tab switch should always land at the top of the new screen.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [tab])

  // While an overlay is up, take the app shell out of the focus + a11y tree and
  // let Escape close the top overlay.
  useEffect(() => {
    const main = mainRef.current
    const nav = navRef.current
    if (main) main.inert = open
    if (nav) nav.inert = open
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverlay(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="app">
      <div className="safe-top" />
      <main className="scroll" ref={mainRef}>
        {tab === 'home' && (
          <Home
            onLesson={(lesson, startStep) => setOverlay({ kind: 'lesson', lesson, startStep })}
            onReview={() => setOverlay({ kind: 'review' })}
            onChar={(char) => setOverlay({ kind: 'character', char })}
            onSaved={() => setOverlay({ kind: 'saved' })}
          />
        )}
        {tab === 'learn' && (
          <Learn
            onLesson={(lesson) => setOverlay({ kind: 'lesson', lesson })}
            onVocab={() => setOverlay({ kind: 'vocab' })}
          />
        )}
        {tab === 'stats' && <Progress />}
        {tab === 'profile' && <Profile />}
      </main>

      <nav className="tabbar" ref={navRef}>
        {TABS.map((t) => (
          <button key={t.key} data-on={tab === t.key} onClick={() => setTab(t.key)}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      {overlay?.kind === 'lesson' && (
        <LessonFlow
          lesson={overlay.lesson}
          startStep={overlay.startStep}
          onWords={(words, title) => setOverlay({ kind: 'review', words, title })}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'review' && (
        <ReviewFlow words={overlay.words} title={overlay.title} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'character' && (
        <CharacterOverlay char={overlay.char} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'drill' && (
        <DrillFlow words={overlay.words} title={overlay.title} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'saved' && (
        <SavedWords
          onDrill={(words, title) => setOverlay({ kind: 'drill', words, title })}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'vocab' && <VocabBrowser onClose={() => setOverlay(null)} />}
    </div>
  )
}

/** Loads the signed-in user's progress before mounting the store, so the app
 *  starts from their server state rather than flashing a blank/local one. */
function AuthedStore({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [initial, setInitial] = useState<Persisted | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchProgress(userId).then((server) => {
      if (cancelled) return
      // Server row wins; otherwise fall back to any local cache for this account.
      setInitial(server ? normalize(server as Partial<Persisted>) : load(userId))
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!initial) return <Splash />
  return (
    <StoreProvider key={userId} userId={userId} initial={initial}>
      {children}
    </StoreProvider>
  )
}

function Splash() {
  return (
    <div className="app">
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <div className="avatar" style={{ width: 84, height: 84, borderRadius: 28, fontSize: 34 }}>
          语
        </div>
      </div>
    </div>
  )
}

function Root() {
  const { ready, session } = useAuth()
  // No Supabase configured → original local-only app, unchanged.
  if (!isAuthEnabled) {
    return (
      <StoreProvider>
        <Shell />
      </StoreProvider>
    )
  }
  if (!ready) return <Splash />
  if (!session) return <AuthScreen />
  return (
    <AuthedStore userId={session.user.id}>
      <Shell />
    </AuthedStore>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
