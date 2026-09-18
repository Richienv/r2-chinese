import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react'
import { CheckIcon, LockIcon, PlayIcon } from '../components/Icons'
import { lessons } from '../lib/content'
import { NODE_LABEL, PATH_NODES, isLessonReached, isNodePlayable, nextPlayable, nodeCaption } from '../lib/wordsSession'
import { useStore, type PathNode } from '../store/store'

const W = 396
const CX = [118, 278, 108, 288, 116, 270]
const CURRENT = 70
const REST = 58
const GAP = 8

function nodeClassName(state: 'done' | 'on' | 'lock') {
  if (state === 'done') return 'path-node path-node-done'
  if (state === 'on') return 'path-node path-node-on'
  return 'path-node path-node-lock'
}

function unitLayout(currentIndex: number, fillHeight?: number) {
  const sizes = PATH_NODES.map((_, i) => (i === currentIndex ? CURRENT : REST))
  const topPad = currentIndex === 0 ? 44 : 10
  const bottom = 10
  const compact =
    topPad + sizes.reduce((sum, size, i) => sum + (i === 0 ? size : GAP + size), 0) + bottom
  const gaps = PATH_NODES.length - 1
  let gap = GAP
  if (fillHeight && fillHeight > compact && gaps > 0) {
    gap = Math.min(52, GAP + (fillHeight - compact) / gaps)
  }

  const xs: number[] = []
  const ys: number[] = []
  let y = topPad + sizes[0] / 2
  for (let i = 0; i < PATH_NODES.length; i++) {
    xs.push(CX[i])
    ys.push(y)
    if (i < PATH_NODES.length - 1) y += sizes[i] / 2 + gap + sizes[i + 1] / 2
  }
  const last = PATH_NODES.length - 1
  return { xs, ys, sizes, height: ys[last] + sizes[last] / 2 + bottom }
}

function railPath(xs: number[], ys: number[]) {
  let d = `M${xs[0]} ${ys[0]}`
  for (let i = 1; i < xs.length; i++) {
    const mid = (ys[i - 1] + ys[i]) / 2
    d += ` C${xs[i - 1]} ${mid} ${xs[i]} ${mid} ${xs[i]} ${ys[i]}`
  }
  return d
}

export function LessonPath({
  lesson,
  current,
  nodeDone,
  onLesson,
  onPlay,
  fill,
}: {
  lesson: (typeof lessons)[number]
  current: { lesson: number; node: PathNode }
  nodeDone: (lesson: number, node: PathNode) => boolean
  onLesson?: (lesson: number) => void
  onPlay?: (lesson: number, node: PathNode) => void
  fill?: boolean
}) {
  const slotRef = useRef<HTMLDivElement>(null)
  const [fillHeight, setFillHeight] = useState(0)

  useLayoutEffect(() => {
    if (!fill) return
    const el = slotRef.current
    if (!el) return
    const sync = () => setFillHeight(el.clientHeight)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fill])

  const currentIndex = PATH_NODES.findIndex((n) => current.lesson === lesson.lesson && current.node === n)
  const { xs, ys, sizes, height } = unitLayout(currentIndex, fill ? fillHeight || undefined : undefined)
  const litTo = PATH_NODES.reduce((acc, n, i) => (nodeDone(lesson.lesson, n) ? i + 1 : acc), 0)
  const litEnd = current.lesson === lesson.lesson ? Math.max(litTo, currentIndex) : litTo
  const showLit = current.lesson === lesson.lesson || litTo > 0
  const litXs = showLit ? xs.slice(0, Math.max(1, litEnd + 1)) : []
  const litYs = ys.slice(0, litXs.length)
  const lessonOpen = isLessonReached(lesson.lesson, nodeDone)

  return (
    <section className={fill ? 'path-lesson path-lesson-fill' : 'path-lesson'}>
      <button
        type="button"
        className={`path-banner metal tap44${lessonOpen ? '' : ' path-banner-lock'}`}
        disabled={!lessonOpen}
        onClick={() => {
          if (!lessonOpen) return
          onLesson?.(lesson.lesson)
        }}
        aria-label={lessonOpen ? undefined : `${lesson.title.zh}, locked`}
      >
        <div className="path-banner-copy">
          <div className="kicker">第 {lesson.lesson} 课</div>
          <h2 className="zh path-banner-zh" lang="zh-CN">
            {lesson.title.zh}
          </h2>
          <div className="path-banner-en">{lesson.title.en}</div>
        </div>
        <span className="path-banner-read">课文</span>
      </button>

      <div className="path-unit-slot" ref={slotRef}>
      <div className="path-unit" style={{ height }}>
        <svg className="path-rail" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden>
          <path className="path-rail-track" d={railPath(xs, ys)} />
          {litXs.length > 0 && <path className="path-rail-lit" d={railPath(litXs, litYs)} />}
        </svg>

        {PATH_NODES.map((node, i) => {
          const done = nodeDone(lesson.lesson, node)
          const on = current.lesson === lesson.lesson && current.node === node
          const playable = isNodePlayable(lesson.lesson, node, nodeDone)
          const state = done ? 'done' : on ? 'on' : 'lock'
          const r = sizes[i] / 2
          const caption = nodeCaption(lesson.lesson, node)
          const label = NODE_LABEL[node]
          const side = xs[i] < W / 2 ? 'left' : 'right'
          return (
            <button
              key={node}
              type="button"
              className={`${nodeClassName(state)} tap44`}
              data-state={state}
              data-node={node}
              data-side={side}
              disabled={!playable}
              style={
                {
                  '--path-d': `${sizes[i]}px`,
                  left: `${(xs[i] / W) * 100}%`,
                  top: ys[i] - r,
                  marginLeft: -r,
                } as CSSProperties
              }
              onClick={() => {
                if (!playable) return
                onPlay?.(lesson.lesson, node)
              }}
              aria-label={`${label.zh}${caption.hint ? ` ${caption.hint}` : ''}${done ? ', done' : on ? ', start' : ', locked'}`}
            >
              {on && <span className="path-start">START</span>}
              <span className="path-glyph" aria-hidden>
                {done ? <CheckIcon size={22} /> : on ? <PlayIcon size={22} /> : <LockIcon size={16} />}
              </span>
              <span className="path-meta">
                <span className="path-en zh" lang="zh-CN">
                  {caption.zh}
                </span>
                <span className="path-zh zh" lang="zh-CN">
                  {caption.hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      </div>
    </section>
  )
}

export function Learn({
  onLesson,
  onPlay,
  isNodeDone,
}: {
  onLesson: (lesson: number) => void
  onVocab?: () => void
  onPlay?: (lesson: number, node: PathNode) => void
  isNodeDone?: (lesson: number, node: PathNode) => boolean
}) {
  const store = useStore()
  const nodeDone = isNodeDone ?? store.isNodeDone
  const current = nextPlayable(nodeDone)

  return (
    <div className="path-page">
      {lessons.map((lesson) => (
        <LessonPath
          key={lesson.lesson}
          lesson={lesson}
          current={current}
          nodeDone={nodeDone}
          onLesson={onLesson}
          onPlay={onPlay}
        />
      ))}
    </div>
  )
}
