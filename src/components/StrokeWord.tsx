import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import HanziWriter, { type CharacterJson, type RenderTargetInitFunction } from 'hanzi-writer'
import introStrokeData from '../data/strokes/intro.json'
import strokeLicenseUrl from '../data/strokes/ARPHICPL.TXT?url'
import { t } from '../lib/i18n'
import { PlayIcon, RefreshIcon } from './Icons'
import '../styles/stroke-word.css'

export interface StrokeWordProps {
  text: string
  autoPlay?: boolean
  className?: string
  showAttribution?: boolean
}

type Writer = ReturnType<typeof HanziWriter.create>
type Glyph = { character: string; state: 'loading' | 'ready' | 'fallback'; strokes: number }
type Progress = { character: number; stroke: number; total: number }
type Session = { play: () => void; stop: () => void }

const DATA_VERSION = '2.0.1'
const SIZE = 112
const SVG_NS = 'http://www.w3.org/2000/svg'
const dataCache = new Map<string, CharacterJson>()
const isHanzi = (character: string) => /\p{Script=Han}/u.test(character)

/** Display-only targets avoid Hanzi Writer's document-level quiz listeners. */
function displayTarget(element: string | HTMLElement | SVGElement, width?: string | number | null, height?: string | number | null) {
  const host = typeof element === 'string' ? document.getElementById(element) : element
  if (!host) throw new Error('The stroke drawing surface is unavailable.')
  const svg = document.createElementNS(SVG_NS, 'svg')
  const defs = document.createElementNS(SVG_NS, 'defs')
  svg.setAttribute('width', `${width ?? SIZE}`)
  svg.setAttribute('height', `${height ?? SIZE}`)
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`)
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.appendChild(defs)
  host.appendChild(svg)

  function target(node: SVGElement) {
    return {
      node, svg: node, defs,
      // Introductions have no handwriting input; the separate Writer owns quizzes.
      addPointerStartListener() {}, addPointerMoveListener() {}, addPointerEndListener() {},
      getBoundingClientRect: () => node.getBoundingClientRect(),
      updateDimensions: (nextWidth: string | number, nextHeight: string | number) => {
        node.setAttribute('width', `${nextWidth}`)
        node.setAttribute('height', `${nextHeight}`)
      },
      createSubRenderTarget: () => {
        const group = document.createElementNS(SVG_NS, 'g')
        node.appendChild(group)
        return target(group)
      },
    }
  }
  // The renderer's public custom-target API also types unused quiz event helpers.
  return target(svg) as unknown as ReturnType<RenderTargetInitFunction<SVGElement>>
}

function validData(value: unknown): value is CharacterJson {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<CharacterJson>
  return Array.isArray(data.strokes) && data.strokes.length > 0
    && data.strokes.every((stroke) => typeof stroke === 'string')
    && Array.isArray(data.medians) && data.medians.length === data.strokes.length
    && data.medians.every((median) => Array.isArray(median) && median.length > 0
      && median.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)))
}

async function loadData(character: string, signal: AbortSignal): Promise<CharacterJson> {
  const bundled = (introStrokeData as Record<string, CharacterJson>)[character]
  if (bundled) return bundled
  const cached = dataCache.get(character)
  if (cached) return cached
  const response = await fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@${DATA_VERSION}/${encodeURIComponent(character)}.json`, { signal })
  if (!response.ok) throw new Error('Stroke data could not load.')
  const data: unknown = await response.json()
  if (!validData(data)) throw new Error('This character has no usable stroke data.')
  dataCache.set(character, data)
  return data
}

/** Actual stroke order, introduced one character at a time, with an honest offline fallback. */
export function StrokeWord({ text, autoPlay = true, className = '', showAttribution = true }: StrokeWordProps) {
  const characters = useMemo(() => Array.from(text).filter((character) => character.trim()), [text])
  const root = useRef<HTMLDivElement>(null)
  const hosts = useRef<Array<HTMLDivElement | null>>([])
  const session = useRef<Session | null>(null)
  const [reload, setReload] = useState(0)
  const [glyphs, setGlyphs] = useState<Glyph[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [status, setStatus] = useState(() => t('Loading stroke order…'))

  useEffect(() => {
    let disposed = false
    let generation = 0
    let animationRunning = false
    const writers: Array<Writer | null> = characters.map(() => null)
    const mounts: Array<HTMLDivElement | null> = characters.map(() => null)
    const loaded: Glyph[] = characters.map((character) => ({ character, state: isHanzi(character) ? 'loading' : 'fallback', strokes: 0 }))
    const requests = new Set<AbortController>()
    const pauses = new Map<ReturnType<typeof setTimeout>, () => void>()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    setGlyphs([...loaded])
    setLoading(true)
    setPlaying(false)
    setProgress(null)
    setStatus(t('Loading stroke order…'))
    for (const host of hosts.current) host?.replaceChildren()

    function show(writer: Writer) {
      try { void writer.showCharacter({ duration: 0 }).catch(() => {}) } catch { /* A failed loader has no animation to cancel. */ }
    }

    function pause(milliseconds: number) {
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => { pauses.delete(timer); resolve() }, milliseconds)
        pauses.set(timer, resolve)
      })
    }

    function stop() {
      generation++
      animationRunning = false
      for (const [timer, resolve] of pauses) { clearTimeout(timer); resolve() }
      pauses.clear()
      // Showing the completed glyph cancels its running stroke mutation.
      for (const writer of writers) if (writer) show(writer)
      if (!disposed) {
        setPlaying(false)
        setProgress(null)
        setStatus(t('Stroke order paused. Replay when you’re ready.'))
      }
    }

    async function animate() {
      if (disposed || animationRunning || !writers.some(Boolean)) return
      animationRunning = true
      const run = ++generation
      setPlaying(true)
      setProgress(null)
      setStatus(t('Watch each stroke follow its natural direction.'))
      const current = () => !disposed && run === generation
      try {
        await Promise.all(writers.map((writer) => writer?.hideCharacter({ duration: 0 })))
        if (!current()) return
        await pause(220)
        for (let index = 0; index < writers.length; index++) {
          const writer = writers[index]
          if (!writer || !current()) continue
          for (let stroke = 0; stroke < loaded[index].strokes; stroke++) {
            if (!current()) return
            setProgress({ character: index, stroke: stroke + 1, total: loaded[index].strokes })
            const result = await writer.animateStroke(stroke)
            if (!current() || result?.canceled) return
            await pause(90)
          }
          if (!current()) return
          await pause(260)
        }
        if (current()) {
          setProgress(null)
          setStatus(loaded.some((glyph) => glyph.state === 'fallback')
            ? t('Stroke order complete. Some characters are shown as text.')
            : t('Stroke order complete. Bring the shape to mind.'))
        }
      } catch {
        if (current()) {
          for (const writer of writers) if (writer) show(writer)
          setProgress(null)
          setStatus(t('Animation stopped. The characters remain visible; try replaying.'))
        }
      } finally {
        if (current()) {
          animationRunning = false
          setPlaying(false)
        }
      }
    }

    session.current = { play: () => { void animate() }, stop }
    const onMotionChange = () => { if (motion.matches && animationRunning) stop() }
    motion.addEventListener('change', onMotionChange)

    async function prepare() {
      await Promise.all(characters.map(async (character, index) => {
        if (!isHanzi(character)) return
        const controller = new AbortController()
        requests.add(controller)
        const timeout = setTimeout(() => controller.abort(), 8000)
        try {
          const data = await loadData(character, controller.signal)
          const host = hosts.current[index]
          if (disposed || !host || controller.signal.aborted) return
          const styles = root.current ? getComputedStyle(root.current) : null
          const ink = styles?.getPropertyValue('--stroke-ink').trim() || '#322b27'
          const outline = styles?.getPropertyValue('--stroke-outline').trim() || '#e6dcd3'
          const radical = styles?.getPropertyValue('--stroke-radical').trim() || '#c3442e'
          const mount = document.createElement('div')
          host.appendChild(mount)
          mounts[index] = mount
          const writer = HanziWriter.create(mount, character, {
            width: SIZE, height: SIZE, padding: 7,
            showCharacter: true, showOutline: true,
            strokeColor: ink, outlineColor: outline, radicalColor: radical,
            strokeAnimationSpeed: 2.2, strokeFadeDuration: 0,
            rendererOverride: { createRenderTarget: displayTarget },
            charDataLoader: () => controller.signal.aborted ? Promise.reject(new Error('Cancelled')) : data,
          })
          writers[index] = writer
          await writer.getCharacterData()
          if (disposed) { mount.remove(); return }
          loaded[index] = { character, state: 'ready', strokes: data.strokes.length }
        } catch {
          if (!disposed) {
            writers[index] = null
            mounts[index]?.remove()
            loaded[index] = { character, state: 'fallback', strokes: 0 }
          }
        } finally {
          clearTimeout(timeout)
          requests.delete(controller)
          if (!disposed) setGlyphs([...loaded])
        }
      }))
      if (disposed) return
      setLoading(false)
      const ready = writers.some(Boolean)
      setStatus(!ready ? t('Stroke data unavailable. The word is still shown below.')
        : loaded.some((glyph) => glyph.state === 'fallback') ? t('Some stroke data is unavailable. Those characters remain visible.')
          : motion.matches || !autoPlay ? t('Follow the stroke order whenever you’re ready.') : t('Watch the word take shape.'))
      if (ready && autoPlay && !motion.matches) void animate()
    }
    void prepare()

    return () => {
      disposed = true
      stop()
      motion.removeEventListener('change', onMotionChange)
      for (const controller of requests) controller.abort()
      requests.clear()
      session.current = null
      for (const mount of mounts) mount?.remove()
    }
  }, [characters, autoPlay, reload])

  const unavailable = !loading && glyphs.some((glyph) => glyph.state === 'fallback' && isHanzi(glyph.character))
  const ready = !loading && glyphs.some((glyph) => glyph.state === 'ready')
  const columnCount = Math.min(4, Math.max(1, characters.length))
  const style = { '--stroke-columns': columnCount, '--stroke-max-width': `${columnCount * SIZE + (columnCount - 1) * 8}px` } as CSSProperties

  return (
    <div ref={root} className={`stroke-word ${className}`.trim()} data-playing={playing} style={style}>
      <div className="stroke-word-glyphs" role="img" aria-label={text} lang="zh-CN">
        {characters.map((character, index) => {
          const glyph = glyphs[index]
          const available = glyph?.character === character && glyph.state === 'ready'
          return (
            <div key={`${character}:${index}`} className="stroke-word-cell" data-active={progress?.character === index} data-ready={available} aria-hidden="true">
              <div className="stroke-word-grid" />
              <span className="stroke-word-static zh">{character}</span>
              <div className="stroke-word-drawing" ref={(element) => { hosts.current[index] = element }} />
              <span className="stroke-word-index">{index + 1}</span>
              {glyph?.strokes ? <span className="stroke-word-count">{progress?.character === index ? `${progress.stroke}/${glyph.strokes}` : `${glyph.strokes} 笔`}</span> : null}
            </div>
          )
        })}
      </div>
      <div className="stroke-word-controls">
        {loading ? <span className="stroke-word-loading" aria-hidden="true" /> : ready ? (
          <button type="button" className="stroke-word-replay" onClick={() => playing ? session.current?.stop() : session.current?.play()} aria-label={playing ? t('Stop stroke animation for {text}', { text }) : t('Replay stroke order for {text}', { text })}>
            {playing ? <span className="stroke-word-stop" aria-hidden="true" /> : <PlayIcon size={13} />}
            {playing ? t('Stop') : t('Replay')}
          </button>
        ) : (
          <button type="button" className="stroke-word-replay" onClick={() => setReload((value) => value + 1)}><RefreshIcon size={13} />{t('Retry strokes')}</button>
        )}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{status}</span>
      {unavailable && <p className="stroke-word-fallback">{t('Some stroke data couldn’t load. You can still learn the word.')}</p>}
      {showAttribution && <StrokeDataAttribution />}
    </div>
  )
}

/** Keep the data credit available without interrupting the lesson itself. */
export function StrokeDataAttribution() {
  return <div className="stroke-data-footer"><a className="stroke-word-attribution" href={strokeLicenseUrl} target="_blank" rel="noreferrer" title={t('Stroke data © Arphic / Make Me a Hanzi · Arphic Public License')}>{t('Stroke data · credits & license')}</a></div>
}
