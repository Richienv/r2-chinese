import { useCallback, useEffect, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
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
import { KerjaSession } from './screens/Kerja'
import { JiaochengSession } from './screens/Jiaocheng'
import { InterviewSession } from './screens/Interview'
import { MagangSession } from './screens/Magang'
import { BooksSession } from './screens/Books'
import { WordsSession } from './screens/WordsSession'
import { HskListening } from './screens/HskListening'
import { HskComposition } from './screens/HskComposition'
import { CourseProvider } from './lib/course'
import { load, normalize, useStore, StoreProvider, type Persisted, type PathNode } from './store/store'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { AuthScreen } from './auth/AuthScreen'
import { isAuthEnabled } from './lib/supabase'
import { fetchProgress } from './lib/sync'
import { useEdgeSwipeClose, useOverlayLock, useVisualViewportInset } from './lib/phone'

type Tab = 'home' | 'learn' | 'stats' | 'profile'
type Overlay =
  | { kind: 'lesson'; lesson: number; startStep?: number }
  | { kind: 'words'; lesson: number; node?: PathNode }
  | { kind: 'path'; lesson: number; node: PathNode }
  | { kind: 'kerja'; chapter: number; node: PathNode }
  | { kind: 'jiaocheng'; lesson: number; node: PathNode }
  | { kind: 'magang'; chapter: number; node: string }
  | { kind: 'interview'; chapter: number; node: string }
  | { kind: 'books'; part: number; index: number; node: string }
  | { kind: 'review'; words?: string[]; title?: string }
  | { kind: 'character'; char: string }
  | { kind: 'drill'; words: string[]; title: string }
  | { kind: 'saved' }
  | { kind: 'vocab' }
  | { kind: 'listening' }
  | { kind: 'composition' }
  | null

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
  const closeOverlay = useCallback(() => setOverlay(null), [])

  useVisualViewportInset()
  useOverlayLock(open)
  useEdgeSwipeClose(open, closeOverlay)

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
            onSession={(lesson, node) => setOverlay({ kind: 'path', lesson, node })}
            onLesson={(lesson) => setOverlay({ kind: 'lesson', lesson })}
            onReview={() => setOverlay({ kind: 'review' })}
            onTrail={() => setOverlay({ kind: 'saved' })}
            onListening={() => setOverlay({ kind: 'listening' })}
            onCompose={() => setOverlay({ kind: 'composition' })}
            onKerjaSession={(chapter, node) => setOverlay({ kind: 'kerja', chapter, node })}
            onJiaochengSession={(lesson, node) => setOverlay({ kind: 'jiaocheng', lesson, node })}
            onMagangSession={(chapter, node) => setOverlay({ kind: 'magang', chapter, node })}
            onInterviewSession={(chapter, node) => setOverlay({ kind: 'interview', chapter, node })}
            onBooksSession={(part, index) => setOverlay({ kind: 'books', part, index, node: 'lesson' })}
          />
        )}
        {tab === 'learn' && (
          <Learn
            onLesson={(lesson) => setOverlay({ kind: 'lesson', lesson })}
            onVocab={() => setOverlay({ kind: 'vocab' })}
            onListening={() => setOverlay({ kind: 'listening' })}
            onCompose={() => setOverlay({ kind: 'composition' })}
            onPlay={(lesson, node) => setOverlay({ kind: 'path', lesson, node })}
            onKerjaPlay={(chapter, node) => setOverlay({ kind: 'kerja', chapter, node })}
            onJiaochengPlay={(lesson, node) => setOverlay({ kind: 'jiaocheng', lesson, node })}
            onMagangPlay={(chapter, node) => setOverlay({ kind: 'magang', chapter, node })}
            onInterviewPlay={(chapter, node) => setOverlay({ kind: 'interview', chapter, node })}
            onBooksPlay={(part, index) => setOverlay({ kind: 'books', part, index, node: 'lesson' })}
            isNodeDone={(lesson, node) => store.isNodeDone(lesson, node)}
          />
        )}
        {tab === 'stats' && (
          <Progress
            onLearn={() => setTab('learn')}
            onReview={(words, title) => setOverlay({ kind: 'review', words, title })}
          />
        )}
        {tab === 'profile' && (
          <Profile
            onLearn={() => setTab('learn')}
            onProgress={() => setTab('stats')}
            onReview={() => setOverlay({ kind: 'review' })}
          />
        )}
      </main>

      <BottomNav ref={navRef} tab={tab} onTabChange={setTab} />

      {overlay?.kind === 'lesson' && (
        <LessonFlow
          lesson={overlay.lesson}
          startStep={overlay.startStep}
          onWords={(words, title) => setOverlay({ kind: 'review', words, title })}
          onClose={() => setOverlay(null)}
        />
      )}
      {(overlay?.kind === 'path' || overlay?.kind === 'words') && (
        <WordsSession
          lesson={overlay.lesson}
          node={overlay.kind === 'path' ? overlay.node : overlay.node ?? 't1'}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'kerja' && (
        <KerjaSession chapter={overlay.chapter} node={overlay.node} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'jiaocheng' && (
        <JiaochengSession lesson={overlay.lesson} node={overlay.node} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'magang' && (
        <MagangSession chapter={overlay.chapter} node={overlay.node} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'interview' && (
        <InterviewSession chapter={overlay.chapter} node={overlay.node} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'books' && (
        <BooksSession
          part={overlay.part}
          index={overlay.index}
          node={overlay.node}
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
      {overlay?.kind === 'listening' && <HskListening onClose={closeOverlay} />}
      {overlay?.kind === 'composition' && <HskComposition onClose={closeOverlay} />}
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
      <CourseProvider>
        <Root />
      </CourseProvider>
    </AuthProvider>
  )
}
