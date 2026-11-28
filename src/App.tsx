import './lib/studyMusic'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { AudioStatus } from './components/AudioStatus'
import { BeastRevealOverlay, type BeastRevealPayload } from './components/BeastRevealOverlay'
import { GlobalMusicPill } from './components/StudyMusic'
import { CLOUD_HYDRATED_EVENT, LOCAL_PROGRESS_EVENT } from './lib/autoSync'
import { evaluateBeastProgress } from './lib/beastEngine'
import {
  BEAST_REVEAL_REQUEST_EVENT,
  readBeastPrefs,
  subscribeBeastPrefs,
  writeBeastPrefs,
  type GlobalRevealRequest,
} from './lib/beastPrefs'
import { BEAST_STAGES, getBeastStage, type BeastStageId } from './lib/beastStages'
import { postCoupleEvent } from './lib/coupleSync'
import { readHsk1Progress, subscribeHsk1Progress } from './lib/hsk1'
import { readHistory } from './lib/history'
import { stopSpeech } from './lib/speech'
import { t } from './lib/i18n'
const CharacterOverlay = lazy(() =>
  import('./screens/Character').then((m) => ({ default: m.CharacterOverlay })),
)
const DrillFlow = lazy(() =>
  Promise.all([import('./screens/Drill'), import('./lib/jiaocheng'), import('./lib/kerja')]).then(([m]) => ({
    default: m.DrillFlow,
  })),
)
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
const VocabBrowser = lazy(() =>
  Promise.all([import('./screens/VocabBrowser'), import('./lib/jiaocheng'), import('./lib/kerja')]).then(([m]) => ({
    default: m.VocabBrowser,
  })),
)
const KerjaSession = lazy(() => import('./screens/Kerja').then((m) => ({ default: m.KerjaSession })))
const JiaochengSession = lazy(() =>
  import('./screens/Jiaocheng').then((m) => ({ default: m.JiaochengSession })),
)
type ExamCourse = import('./lib/jiaochengMidterm').ExamCourse
type ExamMode = import('./lib/jiaochengMidterm').ExamMode

const JiaochengMidterm = lazy(() =>
  import('./screens/JiaochengMidterm').then((m) => ({ default: m.JiaochengMidterm })),
)
const InterviewSession = lazy(() =>
  import('./screens/Interview').then((m) => ({ default: m.InterviewSession })),
)
const MagangSession = lazy(() => import('./screens/Magang').then((m) => ({ default: m.MagangSession })))
const BooksSession = lazy(() => import('./screens/Books').then((m) => ({ default: m.BooksSession })))
import type { JiayinSessionMode } from './screens/Jiayin'
const JiayinSession = lazy(() => import('./screens/Jiayin').then((m) => ({ default: m.JiayinSession })))
const WordsSession = lazy(() =>
  Promise.all([import('./screens/WordsSession'), import('./lib/jiaocheng'), import('./lib/kerja')]).then(([m]) => ({
    default: m.WordsSession,
  })),
)
const HskListening = lazy(() => import('./screens/HskListening').then((m) => ({ default: m.HskListening })))
const HskComposition = lazy(() =>
  import('./screens/HskComposition').then((m) => ({ default: m.HskComposition })),
)
const Hsk1SessionOverlay = lazy(() =>
  import('./screens/Hsk1').then((m) => ({ default: m.Hsk1SessionOverlay })),
)
const Hsk1ToneLabOverlay = lazy(() =>
  import('./screens/Hsk1').then((m) => ({ default: m.Hsk1ToneLabOverlay })),
)
const Hsk1RecallOverlay = lazy(() =>
  import('./screens/Hsk1').then((m) => ({ default: m.Hsk1RecallOverlay })),
)
import type { Hsk1NodeId } from './lib/hsk1Srs'
import { CourseProvider } from './lib/course'
import { CoupleAuthGate } from './components/CoupleAuthGate'
import { OnboardingModal } from './components/OnboardingModal'
import { useCoupleGate } from './lib/coupleAuth'
import { useCoupleProfile } from './lib/coupleProfile'
import { isOnboardingDone, markOnboardingDone } from './lib/onboarding'
import { dayKey, load, normalize, useStore, StoreProvider, type Persisted, type PathNode } from './store/store'
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
  | { kind: 'jiaocheng-midterm'; course?: ExamCourse; mode?: ExamMode }
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
  | { kind: 'hsk1-unit'; unit: number; node?: Hsk1NodeId }
  | { kind: 'hsk1-tones'; track?: 'tones' | 'pinyin' | 'strokes' }
  | { kind: 'hsk1-recall' }
  | null

function Shell() {
  const store = useStore()
  const { activeId, member, names } = useCoupleProfile()
  // Every launch starts on Home: the day's ring and the next session are the first thing seen.
  const [tab, setTabState] = useState<Tab>('home')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [beastPrefs, setBeastPrefs] = useState(readBeastPrefs)
  const [hsk1Progress, setHsk1Progress] = useState(readHsk1Progress)
  const [evolutionTick, setEvolutionTick] = useState(0)
  const [revealPayload, setRevealPayload] = useState<BeastRevealPayload | null>(null)
  const revealOpenRef = useRef(false)
  revealOpenRef.current = revealPayload !== null
  const mainRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const open = overlay !== null

  useEffect(() => {
    if (!isOnboardingDone(activeId)) {
      setOnboardingOpen(true)
    } else {
      setOnboardingOpen(false)
    }
    setRevealPayload(null)
    setBeastPrefs(readBeastPrefs())
    setHsk1Progress(readHsk1Progress())
  }, [activeId])

  useEffect(() => {
    const bump = () => setEvolutionTick((n) => n + 1)
    const onRevealRequest = (ev: Event) => {
      const detail = (ev as CustomEvent<GlobalRevealRequest>).detail
      if (!detail?.beast || !detail?.stage) return
      stopSpeech()
      setRevealPayload(detail)
    }
    window.addEventListener(LOCAL_PROGRESS_EVENT, bump)
    window.addEventListener(CLOUD_HYDRATED_EVENT, bump)
    window.addEventListener(BEAST_REVEAL_REQUEST_EVENT, onRevealRequest)
    const unsubPrefs = subscribeBeastPrefs(setBeastPrefs)
    const unsubHsk1 = subscribeHsk1Progress(setHsk1Progress)
    return () => {
      window.removeEventListener(LOCAL_PROGRESS_EVENT, bump)
      window.removeEventListener(CLOUD_HYDRATED_EVENT, bump)
      window.removeEventListener(BEAST_REVEAL_REQUEST_EVENT, onRevealRequest)
      unsubPrefs()
      unsubHsk1()
    }
  }, [])

  // Sudden Pokémon-style reveal mid-study whenever earned XP crosses a new level threshold
  useEffect(() => {
    if (onboardingOpen) return
    const evalRes = evaluateBeastProgress({
      track: member.track,
      mastery: store.mastery,
      cards: store.cards,
      lessonsDone: store.lessonsDone,
      pathDone: store.pathDone,
      streak: store.streak,
      xp: store.xp,
      log: store.log,
      history: readHistory(),
      learnerGraph: store.learnerGraph,
      hsk1Progress: readHsk1Progress(),
      todayKey: dayKey(),
      nowMs: Date.now(),
    })

    const currentPrefs = readBeastPrefs()
    const activeStageId: BeastStageId = evalRes.unlockedStageIds.includes(currentPrefs.stageId)
      ? currentPrefs.stageId
      : BEAST_STAGES[0].id
    const activeStage = getBeastStage(activeStageId)

    const shouldRevealEvolution =
      evalRes.level > 1 &&
      (evalRes.level > currentPrefs.lastSeenLevel || !currentPrefs.revealedLevels.includes(evalRes.level))
    const newAchievement = evalRes.unlockedAchievementKeys.find(
      (k) => !currentPrefs.earnedAchievementKeys.includes(k),
    )

    if (shouldRevealEvolution) {
      stopSpeech()
      writeBeastPrefs({
        lastSeenLevel: evalRes.level,
        revealedLevels: [...new Set([...currentPrefs.revealedLevels, evalRes.level])],
        earnedAchievementKeys: evalRes.unlockedAchievementKeys,
      })
      void postCoupleEvent({
        from: activeId,
        kind: 'evolution',
        text: `Naik Lv ${evalRes.level}/24 (${evalRes.beast.stageLabel}): ${evalRes.beast.zhName}!`,
        beastLevel: evalRes.level,
        names,
      })
      setRevealPayload({
        beast: evalRes.beast,
        stage: activeStage,
        reason: 'evolution',
        headline: `✨ SELAMAT! WUJUD BARU LV ${evalRes.level}/24 TERBUKA!`,
        spiritPower: evalRes.spiritPower,
        nextTargetXp: evalRes.nextBeast ? evalRes.powerToNext : 0,
      })
      return
    }

    if (newAchievement) {
      const unlockedStage = BEAST_STAGES.find((st) => st.achievementKey === newAchievement) ?? activeStage
      writeBeastPrefs({
        earnedAchievementKeys: evalRes.unlockedAchievementKeys,
        stageId: unlockedStage.id,
      })
      stopSpeech()
      setRevealPayload({
        beast: evalRes.beast,
        stage: unlockedStage,
        reason: 'card',
        headline: `✨ KARTU BARU TERBUKA: ${unlockedStage.name}`,
        spiritPower: evalRes.spiritPower,
        nextTargetXp: evalRes.nextBeast ? evalRes.powerToNext : 0,
      })
    }
  }, [
    onboardingOpen,
    activeId,
    names,
    member.track,
    store.mastery,
    store.cards,
    store.lessonsDone,
    store.pathDone,
    store.streak,
    store.xp,
    store.log,
    store.learnerGraph,
    hsk1Progress,
    evolutionTick,
  ])
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const action = new URLSearchParams(window.location.search).get('action')
    if (action === 'review') {
      setOverlay(member.track === 'hsk1' ? { kind: 'hsk1-recall' } : { kind: 'review' })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (action === 'exam') {
      setOverlay(member.track === 'hsk1' ? { kind: 'hsk1-tones', track: 'tones' } : { kind: 'jiaocheng-midterm' })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [member.track])

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
    let observer: MutationObserver | null = null
    const focusOverlay = () => {
      if (focused) return
      const first = document.querySelector<HTMLElement>('.app>.overlay button:not([disabled])')
      if (first) {
        first.focus({ preventScroll: true })
        focused = true
        observer?.disconnect()
        observer = null
      }
    }
    focusOverlay()
    if (!focused) {
      const appEl = document.querySelector('.app')
      if (appEl) {
        observer = new MutationObserver(focusOverlay)
        observer.observe(appEl, { childList: true, subtree: true })
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (revealOpenRef.current) return
        closeOverlay()
      }
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
      observer?.disconnect()
      if (main) main.inert = false
      if (nav) nav.inert = false
      trigger?.focus({ preventScroll: true })
    }
  }, [open, closeOverlay])

  return (
    <div className="app" data-member={activeId} data-closing={closing}>
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
              onJiaochengMidterm={(course, mode) => setOverlay({ kind: 'jiaocheng-midterm', course, mode })}
              onMagangSession={(chapter, node) => setOverlay({ kind: 'magang', chapter, node })}
              onInterviewSession={(chapter, node) => setOverlay({ kind: 'interview', chapter, node })}
              onBooksSession={(part, index) => setOverlay({ kind: 'books', part, index, node: 'lesson' })}
              onJiayinSession={(unit, stage) => setOverlay({ kind: 'jiayin', unit, stage })}
              onHsk1Unit={(unit, node) => setOverlay({ kind: 'hsk1-unit', unit, node })}
              onHsk1Tones={(track) => setOverlay({ kind: 'hsk1-tones', track })}
              onHsk1Recall={() => setOverlay({ kind: 'hsk1-recall' })}
              onProgress={() => setTab('stats')}
              onOpenOnboarding={() => setOnboardingOpen(true)}
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
              onJiaochengMidterm={(course, mode) => setOverlay({ kind: 'jiaocheng-midterm', course, mode })}
              onMagangPlay={(chapter, node) => setOverlay({ kind: 'magang', chapter, node })}
              onInterviewPlay={(chapter, node) => setOverlay({ kind: 'interview', chapter, node })}
              onBooksPlay={(part, index) => setOverlay({ kind: 'books', part, index, node: 'lesson' })}
              onJiayinPlay={(unit, stage) => setOverlay({ kind: 'jiayin', unit, stage })}
              onHsk1Unit={(unit, node) => setOverlay({ kind: 'hsk1-unit', unit, node })}
              onHsk1Tones={(track) => setOverlay({ kind: 'hsk1-tones', track })}
              onHsk1Recall={() => setOverlay({ kind: 'hsk1-recall' })}
              isNodeDone={(lesson, node) => store.isNodeDone(lesson, node)}
            />
          )}
          {tab === 'stats' && (
            <Progress
              onLearn={() => setTab('learn')}
              onReview={(words, title) => setOverlay({ kind: 'review', words, title })}
              onHsk1Recall={() => setOverlay({ kind: 'hsk1-recall' })}
            />
          )}
          {tab === 'profile' && <Profile onOpenOnboarding={() => setOnboardingOpen(true)} />}
        </Suspense>
      </main>

      <BottomNav
        ref={navRef}
        tab={tab}
        onTabChange={setTab}
        syncStatus={store.syncStatus}
        onSyncNow={() => {
          void store.syncNow()
        }}
      />
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
        {overlay?.kind === 'jiaocheng-midterm' && (
          <JiaochengMidterm
            initialCourse={overlay.course}
            initialMode={overlay.mode}
            onOpenRecall={(words, title) => setOverlay({ kind: 'review', words, title })}
            onClose={closeOverlay}
          />
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
        {overlay?.kind === 'hsk1-unit' && (
          <Hsk1SessionOverlay
            key={`h1u-${overlay.unit}-${overlay.node ?? 'kenali'}`}
            unitNumber={overlay.unit}
            initialNode={overlay.node}
            onClose={closeOverlay}
          />
        )}
        {overlay?.kind === 'hsk1-tones' && (
          <Hsk1ToneLabOverlay
            key={`h1t-${overlay.track ?? 'tones'}`}
            initialTrack={overlay.track}
            onClose={closeOverlay}
          />
        )}
        {overlay?.kind === 'hsk1-recall' && <Hsk1RecallOverlay onClose={closeOverlay} />}
      </Suspense>
      <OnboardingModal
        open={onboardingOpen && !open}
        onClose={() => {
          markOnboardingDone(activeId)
          setOnboardingOpen(false)
        }}
      />
      <GlobalMusicPill hidden={revealPayload !== null} />
      <BeastRevealOverlay
        payload={revealPayload}
        muted={beastPrefs.revealMuted}
        onToggleMute={() => writeBeastPrefs({ revealMuted: !beastPrefs.revealMuted })}
        onClose={() => setRevealPayload(null)}
      />
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

function Root({ cloudProfile }: { cloudProfile: string }) {
  const { ready, session } = useAuth()
  // No Supabase configured → original local-only app with couple cloud-sync profile.
  if (!isAuthEnabled) {
    return (
      <StoreProvider cloudProfile={cloudProfile}>
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
  const { activeId, member } = useCoupleProfile()
  const gateUnlocked = useCoupleGate()
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.member = activeId
    document.body.dataset.member = activeId
  }, [activeId])
  if (!isAuthEnabled && !gateUnlocked) {
    return <CoupleAuthGate />
  }
  return (
    <AuthProvider>
      <CourseProvider key={`course-${activeId}`}>
        <Root key={`root-${activeId}`} cloudProfile={member.cloudProfile} />
      </CourseProvider>
    </AuthProvider>
  )
}
