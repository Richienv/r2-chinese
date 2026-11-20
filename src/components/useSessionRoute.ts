import { useRef, useState } from 'react'
import { resumeSessionIndex, isPracticeStep, MAX_REPEATS, practiceBlock, practiceRound, requeue, resumePracticeIds, type RoutableStep } from '../lib/sessionRoute'
import type { LearningCheckpoint } from '../lib/resume'
import { playStart } from '../lib/sfx'

/**
 * Practice opens straight into the round for the current wave. A wave is one
 * contiguous run of practice steps, so a sitting can teach eight words, recall
 * those eight, then teach the next eight. A step can come back later in its own
 * wave (`next(true)`).
 */
export function useSessionRoute<T extends RoutableStep>(steps: T[], checkpoint?: LearningCheckpoint) {
  const [start] = useState(() => {
    const index = resumeSessionIndex(steps, checkpoint?.stepId)
    const block = practiceBlock(steps, index)
    const round = block ? practiceRound(block.steps) : []
    const saved = resumePracticeIds(steps, checkpoint?.stepId, checkpoint?.practiceIds)
    if (saved || !block || !round.length) {
      return { index, queue: saved, pos: saved ? Math.max(0, saved.indexOf(steps[index]?.id ?? '')) : 0, blockEnd: block?.end ?? null }
    }
    return { index: steps.findIndex(entry => entry.id === round[0]), queue: round, pos: 0, blockEnd: block.end }
  })
  // Planned practice per wave, so the bar keeps growing across waves instead of restarting.
  const [plan] = useState(() => {
    const rounds: { end: number; size: number }[] = []
    for (let index = 0; index < steps.length; index++) {
      const block = practiceBlock(steps, index)
      if (!block) continue
      rounds.push({ end: block.end, size: practiceRound(block.steps).length })
      index = block.end
    }
    return rounds
  })
  const [finished, setFinished] = useState(() => plan.filter(round => round.end < start.index).reduce((n, round) => n + round.size, 0))
  const [extra, setExtra] = useState(0)
  const [i, setI] = useState(start.index)
  const [queue, setQueue] = useState<string[] | null>(start.queue)
  const [pos, setPos] = useState(start.pos)
  const [blockEnd, setBlockEnd] = useState<number | null>(start.blockEnd)
  const repeats = useRef(new Map<string, number>())
  const raw = steps[Math.min(i, steps.length - 1)]
  const inPractice = isPracticeStep(raw) && !!queue
  const pass = inPractice && queue ? queue.slice(0, pos).filter(id => id === raw.id).length : 0
  const step = inPractice && queue ? { ...raw, n: pos + 1, of: queue.length } : raw
  const knowledgeCount = steps.filter(entry => !isPracticeStep(entry) && entry.kind !== 'complete').length
  const practiceCount = plan.reduce((n, round) => n + round.size, 0) + extra
  const doneKnowledge = steps.slice(0, i).filter(entry => !isPracticeStep(entry) && entry.kind !== 'complete').length
  const progress = raw.kind === 'complete' ? 100 : Math.min(98, ((doneKnowledge + finished + (inPractice ? pos : 0)) / Math.max(1, knowledgeCount + practiceCount)) * 100)

  function enter(nextQueue: string[], nextPos: number, end: number | null) {
    setBlockEnd(end)
    setQueue(nextQueue)
    setPos(nextPos)
    setI(steps.findIndex(entry => entry.id === nextQueue[nextPos]))
  }

  return {
    i,
    step,
    inPractice,
    progress,
    selected: queue,
    pass,
    key: `${raw.id ?? raw.kind}@${inPractice ? pos : i}`,
    canRepeat: inPractice && !!raw.id && (repeats.current.get(raw.id) ?? 0) < MAX_REPEATS,
    next(repeat = false) {
      if (inPractice && queue) {
        let nextQueue = queue
        const id = raw.id
        if (repeat && id && (repeats.current.get(id) ?? 0) < MAX_REPEATS) {
          repeats.current.set(id, (repeats.current.get(id) ?? 0) + 1)
          nextQueue = requeue(queue, pos, id)
          setQueue(nextQueue)
          setExtra(n => n + 1)
        }
        if (pos + 1 < nextQueue.length) {
          enter(nextQueue, pos + 1, blockEnd)
          return
        }
        setFinished(n => n + nextQueue.length)
        setQueue(null)
        setPos(0)
        setI(Math.min((blockEnd ?? i) + 1, steps.length - 1))
        return
      }
      const ahead = Math.min(i + 1, steps.length - 1)
      const block = practiceBlock(steps, ahead)
      if (block) {
        const round = practiceRound(block.steps)
        if (round.length) {
          playStart()
          enter(round, 0, block.end)
          return
        }
      }
      setI(ahead)
    },
    /** "Finish practice" ends the sitting; only offered once every word, the reading and the notes are behind. */
    canFinish: inPractice && !steps.slice(i + 1).some(entry => entry.kind === 'teach' || entry.kind === 'read' || entry.kind === 'note'),
    finish: () => setI(steps.length - 1),
  }
}
