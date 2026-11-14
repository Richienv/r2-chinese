import './lib/studyMusic'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { AudioStatus } from './components/AudioStatus'
import { stopSpeech } from './lib/speech'
import { t } from './lib/i18n'
const CharacterOverlay = lazy(() =>
  import('./screens/Character').then((m) => ({ default: m.CharacterOverlay })),
)
const DrillFlow = lazy(() => import('./screens/Drill').then((m) => ({ default: m.DrillFlow })))
const Home = lazy(() => import('./screens/Home').then((m) => ({ default: m.Home })))
const Learn = lazy(() => import('./screens/Learn').then((m) => ({ default: m.Learn })))
const LessonFlow = lazy(() => import('./screens/Lesson').then((m) => ({ default: m.LessonFlow })))
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })))
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))
const ReviewFlow = lazy(() =>
  Promise.all([import('./screens/Review'), import('./lib/jiaocheng'), import('./lib/kerja')]).then(([m]) => ({
    default: m.ReviewFlow,
  })),
)
const SavedWords = lazy(() =>
  Promise.all([import('./screens/SavedWords'), import('./lib/jiaocheng'), import('./lib/kerja')]).then(
    ([m]) => ({ default: m.SavedWords }),
  ),
)
const VocabBrowser = lazy(() => import('./screens/VocabBrowser').then((m) => ({ default: m.VocabBrowser })))
const KerjaSession = lazy(() => import('./screens/Kerja').then((m) => ({ default: m.KerjaSession })))
const JiaochengSession = lazy(() =>
  import('./screens/Jiaocheng').then((m) => ({ default: m.JiaochengSession })),
)
const InterviewSession = lazy(() =>
  import('./screens/Interview').then((m) => ({ default: m.InterviewSession })),
)
const MagangSession = lazy(() => import('./screens/Magang').then((m) => ({ default: m.MagangSession })))
const BooksSession = lazy(() => import('./screens/Books').then((m) => ({ default: m.BooksSession })))
import type { JiayinSessionMode } from './screens/Jiayin'
const JiayinSession = lazy(() => import('./screens/Jiayin').then((m) => ({ default: m.JiayinSession })))
const WordsSession = lazy(() => import('./screens/WordsSession').then((m) => ({ default: m.WordsSession })))
const HskListening = lazy(() => import('./screens/HskListening').then((m) => ({ default: m.HskListening })))
const HskComposition = lazy(() =>
  import('./screens/HskComposition').then((m) => ({ default: m.HskComposition })),
)
import { CourseProvider } from './lib/course'
import { load, normalize, useStore, StoreProvider, type Persisted, type PathNode } from './store/store'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { AuthScreen } from './auth/AuthScreen'
import { isAuthEnabled } from './lib/supabase'
import { fetchProgress } from './lib/sync'
import { mergeProgress, progressKey } from './lib/progressStorage'
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
  | { kind: 'jiayin'; unit: number; stage: JiayinSessionMode }
  | { kind: 'review'; words?: string[]; title?: string; placement?: boolean }
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
  const [tab, setTabState] = useState<Tab>(() =>
    TAB_KEYS.includes(store.lastTab as Tab) ? (store.lastTab as Tab) : 'home',
  )
  const [overlay, setOverlay] = useState<Overlay>(null)
  const mainRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const open = overlay !== null
  const [closing, setClosing] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout>>()
  const closeOverlay = useCallback(() => {
    if (exitTimer.current) return
    stopSpeech()
    setClosing(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    exitTimer.current = setTimeout(
      () => {
        setOverlay(null)
        setClosing(false)
        exitTimer.current = undefined
      },
      reduced ? 0 : 180,
    )
  }, [])
  useEffect(() => () => clearTimeout(exitTimer.current), [])
  useEffect(() => {
    stopSpeech()
  }, [overlay?.kind])

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
    const trigger = document.activeElement as HTMLElement | null
    let focused = false
    const focusOverlay = () => {
      if (focused) return
      const first = document.querySelector<HTMLElement>('.app>.overlay button:not([disabled])')
      if (first) {
        first.focus({ preventScroll: true })
        focused = true
      }
    }
    const observer = new MutationObserver(focusOverlay)
    observer.observe(document.querySelector('.app')!, { childList: true, subtree: true })
    focusOverlay()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay()
      if (e.key === 'Tab') {
        const panel = document.querySelector('.app>.overlay')
        const nodes = Array.from(
          panel?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),textarea,a[href],summary,[tabindex="0"]',
          ) ?? [],
        ).filter((n) => n.offsetParent !== null)
        const first = nodes[0],
          last = nodes[nodes.length - 1]
        if (first && last) {
          if (e.shiftKey && (!panel?.contains(document.activeElement) || document.activeElement === first)) {
            e.preventDefault()
            last.focus()
          }
          if (!e.shiftKey && (!panel?.contains(document.activeElement) || document.activeElement === last)) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      observer.disconnect()
      if (main) main.inert = false
      if (nav) nav.inert = false
      trigger?.focus({ preventScroll: true })
    }
  }, [open, closeOverlay])

  return (
    <div className="app" data-closing={closing}>
      <div className="safe-top" />
      <main className="scroll" ref={mainRef}>
        <Suspense
          fallback={
            <div className="route-loading" role="status">
              {t('Opening your learning space…')}
            </div>
          }
        >
          {tab === 'home' && (
            <Home
              onSession={(lesson, node) => setOverlay({ kind: 'path', lesson, node })}
              onLesson={(lesson) => setOverlay({ kind: 'lesson', lesson })}
              onBrowse={() => setTab('learn')}
              onPlacement={() => setOverlay({ kind: 'review', placement: true })}
              onReview={() => setOverlay({ kind: 'review' })}
              onTrail={() => setOverlay({ kind: 'saved' })}
              onKerjaSession={(chapter, node) => setOverlay({ kind: 'kerja', chapter, node })}
              onJiaochengSession={(lesson, node) => setOverlay({ kind: 'jiaocheng', lesson, node })}
              onMagangSession={(chapter, node) => setOverlay({ kind: 'magang', chapter, node })}
              onInterviewSession={(chapter, node) => setOverlay({ kind: 'interview', chapter, node })}
              onBooksSession={(part, index) => setOverlay({ kind: 'books', part, index, node: 'lesson' })}
              onJiayinSession={(unit, stage) => setOverlay({ kind: 'jiayin', unit, stage })}
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
              onJiayinPlay={(unit, stage) => setOverlay({ kind: 'jiayin', unit, stage })}
              isNodeDone={(lesson, node) => store.isNodeDone(lesson, node)}
            />
          )}
          {tab === 'stats' && (
            <Progress
              onLearn={() => setTab('learn')}
              onReview={(words, title) => setOverlay({ kind: 'review', words, title })}
            />
          )}
          {tab === 'profile' && <Profile />}
        </Suspense>
      </main>

      <BottomNav ref={navRef} tab={tab} onTabChange={setTab} />
      <AudioStatus />
      <Suspense
        fallback={
          <div className="overlay route-loading" role="status">
            {t('Opening your learning space…')}
          </div>
        }
      >
        {overlay?.kind === 'lesson' && (
          <LessonFlow
            lesson={overlay.lesson}
            startStep={overlay.startStep}
            onWords={(words, title) => setOverlay({ kind: 'review', words, title })}
            onClose={closeOverlay}
          />
        )}
        {(overlay?.kind === 'path' || overlay?.kind === 'words') && (
          <WordsSession
            lesson={overlay.lesson}
            node={overlay.kind === 'path' ? overlay.node : (overlay.node ?? 't1')}
            onClose={closeOverlay}
          />
        )}
        {overlay?.kind === 'kerja' && (
          <KerjaSession chapter={overlay.chapter} node={overlay.node} onClose={closeOverlay} />
        )}
        {overlay?.kind === 'jiaocheng' && (
          <JiaochengSession lesson={overlay.lesson} node={overlay.node} onClose={closeOverlay} />
        )}
        {overlay?.kind === 'magang' && (
          <MagangSession chapter={overlay.chapter} node={overlay.node} onClose={closeOverlay} />
        )}
        {overlay?.kind === 'interview' && (
          <InterviewSession chapter={overlay.chapter} node={overlay.node} onClose={closeOverlay} />
        )}
        {overlay?.kind === 'books' && (
          <BooksSession
            part={overlay.part}
            index={overlay.index}
            node={overlay.node}
            onClose={closeOverlay}
          />
        )}
        {overlay?.kind === 'jiayin' && (
          <JiayinSession
            key={`${overlay.unit}:${overlay.stage}`}
            unit={overlay.unit}
            stage={overlay.stage}
            onClose={closeOverlay}
            onPlay={(unit, stage) => setOverlay({ kind: 'jiayin', unit, stage })}
          />
        )}
        {overlay?.kind === 'review' && (
          <ReviewFlow
            placement={overlay.placement}
            words={overlay.words}
            title={overlay.title}
            onClose={closeOverlay}
          />
        )}
        {overlay?.kind === 'character' && <CharacterOverlay char={overlay.char} onClose={closeOverlay} />}
        {overlay?.kind === 'drill' && (
          <DrillFlow words={overlay.words} title={overlay.title} onClose={closeOverlay} />
        )}
        {overlay?.kind === 'saved' && (
          <SavedWords
            onPlacement={(words) => setOverlay({ kind: 'review', words, placement: true })}
            onDrill={(words, title) => setOverlay({ kind: 'drill', words, title })}
            onClose={closeOverlay}
          />
        )}
        {overlay?.kind === 'vocab' && <VocabBrowser onClose={closeOverlay} />}
        {overlay?.kind === 'listening' && <HskListening onClose={closeOverlay} />}
        {overlay?.kind === 'composition' && <HskComposition onClose={closeOverlay} />}
      </Suspense>
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
      // Merge account-local evidence with the server; never replace newer offline work.
      if (server) {
        try {
          const key = progressKey(userId) + '.server-before-v2'
          if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(server))
        } catch {
          /* The store blocks new writes if storage cannot preserve a backup. */
        }
      }
      setInitial(server ? mergeProgress(load(userId), normalize(server as Partial<Persisted>)) : load(userId))
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
