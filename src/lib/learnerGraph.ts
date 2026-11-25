/**
 * Real-time in-app Learner Knowledge & Confusion Graph.
 *
 * Pure and relative-import only so Node test runners load it directly without Vite.
 * Persists to `localStorage` (`yulu.learner-graph.v1`) and merges cleanly with
 * cloud sync and progress backups.
 */
import { SYNONYM_CLUSTERS } from './synonymClusters.ts'

export type CourseKey = 'hsk4a' | 'jiaocheng' | 'kerja' | 'mixed'
export type GraphNodeKind = 'word' | 'grammar_point' | 'lesson' | 'skipped_skill' | 'confusion_pair'
export type GraphEdgeRel =
  | 'STRUGGLED_WITH'
  | 'CONFUSED_WITH'
  | 'SKIPPED_NEEDS_RECALL'
  | 'RECALLED_CLEANLY'
  | 'GRAMMAR_ERROR_ON'

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  label: string
  course?: CourseKey
  lesson?: number
  struggleScore: number
  cleanCount: number
  struggleCount: number
  skippedPending: boolean
  updatedAt: number
  meta?: Record<string, string | number | boolean>
}

export interface GraphEdge {
  id: string
  src: string
  rel: GraphEdgeRel
  dst: string
  weight: number
  count: number
  note?: string
  updatedAt: number
}

export interface LearnerGraphState {
  version: 1
  updatedAt: number
  nodes: Record<string, GraphNode>
  edges: Record<string, GraphEdge>
}

export const LEARNER_GRAPH_STORAGE_KEY = 'yulu.learner-graph.v1'
export const LEARNER_NODE_ID = 'learner'

/** High-frequency Mandarin confusion pairs seeded as canonical pair labels. */
export const CANONICAL_CONFUSION_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['对', '双'],
  ['对', '副'],
  ['双', '副'],
  ['再', '又'],
  ['就', '才'],
  ['不', '没有'],
  ['了', '过'],
  ['了', '着'],
  ['着', '过'],
  ['刚', '刚才'],
  ['还是', '或者'],
  ['俩', '两'],
  ['两', '二'],
  ['把', '被'],
  ['虽然', '尽管'],
  ['只有', '只要'],
]

const round2 = (n: number) => Math.round(n * 100) / 100

export function wordNodeId(zh: string): string {
  return `word:${zh.trim()}`
}

export function grammarNodeId(point: string): string {
  return `grammar_point:${point.trim()}`
}

export function lessonNodeId(course: CourseKey, lesson: number): string {
  return `lesson:${course}:${lesson}`
}

export function skippedSkillNodeId(course: CourseKey, lesson: number, zh: string): string {
  return `skipped_skill:${course}:${lesson}:${zh.trim()}`
}

export function canonicalPair(a: string, b: string): [string, string] {
  const x = a.trim()
  const y = b.trim()
  const known = CANONICAL_CONFUSION_PAIRS.find(
    ([p, q]) => (p === x && q === y) || (p === y && q === x),
  )
  if (known) return [known[0], known[1]]
  return x.localeCompare(y) <= 0 ? [x, y] : [y, x]
}

export function confusionPairLabel(a: string, b: string): string {
  const [first, second] = canonicalPair(a, b)
  return `${first}↔${second}`
}

export function confusionPairNodeId(a: string, b: string): string {
  return `confusion_pair:${confusionPairLabel(a, b)}`
}

export function edgeKey(src: string, rel: GraphEdgeRel, dst: string): string {
  return `${src}|${rel}|${dst}`
}

export function createEmptyGraph(now = Date.now()): LearnerGraphState {
  return { version: 1, updatedAt: now, nodes: {}, edges: {} }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function nonNeg(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

const VALID_KINDS = new Set<GraphNodeKind>([
  'word',
  'grammar_point',
  'lesson',
  'skipped_skill',
  'confusion_pair',
])
const VALID_RELS = new Set<GraphEdgeRel>([
  'STRUGGLED_WITH',
  'CONFUSED_WITH',
  'SKIPPED_NEEDS_RECALL',
  'RECALLED_CLEANLY',
  'GRAMMAR_ERROR_ON',
])
const VALID_COURSES = new Set<CourseKey>(['hsk4a', 'jiaocheng', 'kerja', 'mixed'])

export function normalizeLearnerGraph(raw: unknown): LearnerGraphState {
  if (!isObject(raw)) return createEmptyGraph(0)
  const nodes: Record<string, GraphNode> = {}
  const edges: Record<string, GraphEdge> = {}
  if (isObject(raw.nodes)) {
    for (const [id, entry] of Object.entries(raw.nodes)) {
      if (!isObject(entry) || typeof entry.label !== 'string') continue
      const kind = VALID_KINDS.has(entry.kind as GraphNodeKind)
        ? (entry.kind as GraphNodeKind)
        : 'word'
      const course = VALID_COURSES.has(entry.course as CourseKey)
        ? (entry.course as CourseKey)
        : undefined
      nodes[id] = {
        id,
        kind,
        label: entry.label,
        ...(course ? { course } : {}),
        ...(typeof entry.lesson === 'number' && Number.isFinite(entry.lesson) ? { lesson: entry.lesson } : {}),
        struggleScore: round2(nonNeg(entry.struggleScore)),
        cleanCount: Math.floor(nonNeg(entry.cleanCount)),
        struggleCount: Math.floor(nonNeg(entry.struggleCount)),
        skippedPending: Boolean(entry.skippedPending),
        updatedAt: nonNeg(entry.updatedAt),
        ...(isObject(entry.meta)
          ? {
              meta: Object.fromEntries(
                Object.entries(entry.meta).filter(
                  (pair): pair is [string, string | number | boolean] => {
                    const v = pair[1]
                    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                  },
                ),
              ),
            }
          : {}),
      }
    }
  }
  if (isObject(raw.edges)) {
    for (const [id, entry] of Object.entries(raw.edges)) {
      if (!isObject(entry) || typeof entry.src !== 'string' || typeof entry.dst !== 'string') continue
      if (!VALID_RELS.has(entry.rel as GraphEdgeRel)) continue
      const key = edgeKey(entry.src, entry.rel as GraphEdgeRel, entry.dst)
      edges[key] = {
        id: id || key,
        src: entry.src,
        rel: entry.rel as GraphEdgeRel,
        dst: entry.dst,
        weight: round2(nonNeg(entry.weight)),
        count: Math.max(1, Math.floor(nonNeg(entry.count))),
        ...(typeof entry.note === 'string' && entry.note ? { note: entry.note } : {}),
        updatedAt: nonNeg(entry.updatedAt),
      }
    }
  }
  return {
    version: 1,
    updatedAt: nonNeg(raw.updatedAt),
    nodes,
    edges,
  }
}

export function mergeLearnerGraphs(leftRaw: unknown, rightRaw: unknown): LearnerGraphState {
  const left = normalizeLearnerGraph(leftRaw)
  const right = normalizeLearnerGraph(rightRaw)
  const nodes: Record<string, GraphNode> = { ...left.nodes }
  for (const [id, rNode] of Object.entries(right.nodes)) {
    const lNode = nodes[id]
    if (!lNode) {
      nodes[id] = rNode
      continue
    }
    const newer = rNode.updatedAt >= lNode.updatedAt ? rNode : lNode
    nodes[id] = {
      ...newer,
      cleanCount: Math.max(lNode.cleanCount, rNode.cleanCount),
      struggleCount: Math.max(lNode.struggleCount, rNode.struggleCount),
      struggleScore: newer.struggleScore,
      skippedPending: rNode.updatedAt === lNode.updatedAt
        ? lNode.skippedPending && rNode.skippedPending
        : newer.skippedPending,
      updatedAt: Math.max(lNode.updatedAt, rNode.updatedAt),
    }
  }

  const edges: Record<string, GraphEdge> = { ...left.edges }
  for (const [id, rEdge] of Object.entries(right.edges)) {
    const lEdge = edges[id]
    if (!lEdge) {
      edges[id] = rEdge
      continue
    }
    const newer = rEdge.updatedAt >= lEdge.updatedAt ? rEdge : lEdge
    edges[id] = {
      ...newer,
      count: Math.max(lEdge.count, rEdge.count),
      weight:
        rEdge.rel === 'SKIPPED_NEEDS_RECALL' || rEdge.rel === 'STRUGGLED_WITH'
          ? newer.weight
          : Math.max(lEdge.weight, rEdge.weight),
      updatedAt: Math.max(lEdge.updatedAt, rEdge.updatedAt),
    }
  }

  return {
    version: 1,
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    nodes,
    edges,
  }
}

function upsertNode(
  nodes: Record<string, GraphNode>,
  id: string,
  kind: GraphNodeKind,
  label: string,
  patch: (prev?: GraphNode) => Partial<GraphNode>,
  now: number,
) {
  const prev = nodes[id]
  const base: GraphNode = prev ?? {
    id,
    kind,
    label,
    struggleScore: 0,
    cleanCount: 0,
    struggleCount: 0,
    skippedPending: false,
    updatedAt: now,
  }
  nodes[id] = {
    ...base,
    ...patch(prev),
    id,
    kind,
    label: label || base.label,
    updatedAt: now,
  }
}

function upsertEdge(
  edges: Record<string, GraphEdge>,
  src: string,
  rel: GraphEdgeRel,
  dst: string,
  deltaWeight: number,
  now: number,
  note?: string,
  mode: 'add' | 'decay' | 'set' = 'add',
) {
  const id = edgeKey(src, rel, dst)
  const prev = edges[id]
  const prevWeight = prev?.weight ?? 0
  const weight =
    mode === 'set'
      ? Math.max(0, round2(deltaWeight))
      : mode === 'decay'
        ? Math.max(0, round2(prevWeight * deltaWeight))
        : Math.max(0, round2(prevWeight + deltaWeight))
  edges[id] = {
    id,
    src,
    rel,
    dst,
    weight,
    count: (prev?.count ?? 0) + (mode === 'add' ? 1 : 0),
    ...(note ? { note } : prev?.note ? { note: prev.note } : {}),
    updatedAt: now,
  }
}

function isKnownConfusionCluster(a: string, b: string): boolean {
  if (CANONICAL_CONFUSION_PAIRS.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) return true
  return SYNONYM_CLUSTERS.some((cluster) => {
    const members = cluster.members.map((m) => m.zh)
    return members.includes(a) && members.includes(b)
  })
}

function linkConfusion(
  nodes: Record<string, GraphNode>,
  edges: Record<string, GraphEdge>,
  a: string,
  b: string,
  weightDelta: number,
  now: number,
  course?: CourseKey,
  lesson?: number,
  note?: string,
) {
  const first = a.trim()
  const second = b.trim()
  if (!first || !second || first === second) return
  const [p, q] = canonicalPair(first, second)
  const pairLabel = `${p}↔${q}`
  const pairId = confusionPairNodeId(p, q)
  upsertNode(nodes, wordNodeId(p), 'word', p, () => ({ ...(course ? { course } : {}), ...(lesson ? { lesson } : {}) }), now)
  upsertNode(nodes, wordNodeId(q), 'word', q, () => ({ ...(course ? { course } : {}), ...(lesson ? { lesson } : {}) }), now)
  upsertNode(
    nodes,
    pairId,
    'confusion_pair',
    pairLabel,
    (prev) => ({
      struggleScore: round2((prev?.struggleScore ?? 0) + weightDelta),
      struggleCount: (prev?.struggleCount ?? 0) + 1,
      meta: { first: p, second: q },
    }),
    now,
  )
  upsertEdge(edges, wordNodeId(first), 'CONFUSED_WITH', wordNodeId(second), weightDelta, now, note ?? pairLabel)
  upsertEdge(edges, LEARNER_NODE_ID, 'STRUGGLED_WITH', pairId, weightDelta, now, note ?? pairLabel)
}

export interface RecallOutcomeInput {
  zh: string
  correct: boolean
  assisted?: boolean
  mode?: string
  course?: CourseKey
  lesson?: number
  confusedWith?: string
  grammarPoint?: string
  at?: number
}

/** Update graph weights immediately after an Active Recall or Review attempt. */
export function recordRecallOutcome(state: LearnerGraphState, input: RecallOutcomeInput): LearnerGraphState {
  const zh = input.zh.trim()
  if (!zh) return state
  const now = input.at ?? Date.now()
  const nodes = { ...state.nodes }
  const edges = { ...state.edges }
  const wId = wordNodeId(zh)
  const clean = input.correct && !input.assisted

  if (clean) {
    upsertNode(
      nodes,
      wId,
      'word',
      zh,
      (prev) => ({
        ...(input.course ? { course: input.course } : {}),
        ...(input.lesson ? { lesson: input.lesson } : {}),
        cleanCount: (prev?.cleanCount ?? 0) + 1,
        struggleScore: Math.max(0, round2((prev?.struggleScore ?? 0) * 0.55 - 0.8)),
        skippedPending: false,
      }),
      now,
    )
    upsertEdge(edges, LEARNER_NODE_ID, 'RECALLED_CLEANLY', wId, 1.0, now, input.mode)

    // Cool down prior struggle & skip-carryover pressure on this word
    const struggleId = edgeKey(LEARNER_NODE_ID, 'STRUGGLED_WITH', wId)
    if (edges[struggleId]) upsertEdge(edges, LEARNER_NODE_ID, 'STRUGGLED_WITH', wId, 0.55, now, undefined, 'decay')

    const skipWordId = edgeKey(LEARNER_NODE_ID, 'SKIPPED_NEEDS_RECALL', wId)
    if (edges[skipWordId]) upsertEdge(edges, LEARNER_NODE_ID, 'SKIPPED_NEEDS_RECALL', wId, 0, now, 'recalled cleanly', 'set')

    // Resolve any skipped_skill nodes for this word across courses
    for (const [nid, node] of Object.entries(nodes)) {
      if (node.kind === 'skipped_skill' && node.label === zh && node.skippedPending) {
        nodes[nid] = { ...node, skippedPending: false, struggleScore: 0, cleanCount: node.cleanCount + 1, updatedAt: now }
      }
    }
    for (const [eid, edge] of Object.entries(edges)) {
      if (edge.rel === 'SKIPPED_NEEDS_RECALL' && edge.dst.endsWith(`:${zh}`) && edge.weight > 0) {
        edges[eid] = { ...edge, weight: 0, note: 'recalled cleanly', updatedAt: now }
      }
      if (edge.rel === 'CONFUSED_WITH' && (edge.src === wId || edge.dst === wId) && edge.weight > 0) {
        edges[eid] = { ...edge, weight: round2(edge.weight * 0.7), updatedAt: now }
      }
    }
  } else {
    const delta = !input.correct ? 2.5 : 1.15
    upsertNode(
      nodes,
      wId,
      'word',
      zh,
      (prev) => ({
        ...(input.course ? { course: input.course } : {}),
        ...(input.lesson ? { lesson: input.lesson } : {}),
        struggleCount: (prev?.struggleCount ?? 0) + 1,
        struggleScore: round2((prev?.struggleScore ?? 0) + delta),
      }),
      now,
    )
    upsertEdge(edges, LEARNER_NODE_ID, 'STRUGGLED_WITH', wId, delta, now, input.mode)

    if (input.confusedWith?.trim()) {
      linkConfusion(nodes, edges, zh, input.confusedWith, 2.2, now, input.course, input.lesson, input.mode)
    }
    if (input.grammarPoint?.trim()) {
      const gp = input.grammarPoint.trim()
      const gId = grammarNodeId(gp)
      upsertNode(
        nodes,
        gId,
        'grammar_point',
        gp,
        (prev) => ({
          ...(input.course ? { course: input.course } : {}),
          ...(input.lesson ? { lesson: input.lesson } : {}),
          struggleCount: (prev?.struggleCount ?? 0) + 1,
          struggleScore: round2((prev?.struggleScore ?? 0) + delta * 0.75),
        }),
        now,
      )
      upsertEdge(edges, LEARNER_NODE_ID, 'GRAMMAR_ERROR_ON', gId, round2(delta * 0.75), now, zh)
    }
  }

  return { version: 1, updatedAt: now, nodes, edges }
}

export interface ExamOutcomeInput {
  questionId: string
  course: CourseKey
  lesson?: number
  grammarPoint: string
  focusWords?: readonly string[]
  confusedPairs?: ReadonlyArray<readonly [string, string]>
  correct: boolean
  picked?: string
  answer?: string
  at?: number
}

/** Update graph weights immediately after a Midterm / Final mock or Grammar Drill answer. */
export function recordExamOutcome(state: LearnerGraphState, input: ExamOutcomeInput): LearnerGraphState {
  const now = input.at ?? Date.now()
  const nodes = { ...state.nodes }
  const edges = { ...state.edges }
  const gp = input.grammarPoint.trim()
  if (gp) {
    const gId = grammarNodeId(gp)
    if (input.correct) {
      upsertNode(
        nodes,
        gId,
        'grammar_point',
        gp,
        (prev) => ({
          course: input.course,
          ...(input.lesson ? { lesson: input.lesson } : {}),
          cleanCount: (prev?.cleanCount ?? 0) + 1,
          struggleScore: Math.max(0, round2((prev?.struggleScore ?? 0) * 0.6 - 0.5)),
        }),
        now,
      )
      upsertEdge(edges, LEARNER_NODE_ID, 'RECALLED_CLEANLY', gId, 0.9, now, input.questionId)
      const errId = edgeKey(LEARNER_NODE_ID, 'GRAMMAR_ERROR_ON', gId)
      if (edges[errId]) upsertEdge(edges, LEARNER_NODE_ID, 'GRAMMAR_ERROR_ON', gId, 0.6, now, undefined, 'decay')
    } else {
      upsertNode(
        nodes,
        gId,
        'grammar_point',
        gp,
        (prev) => ({
          course: input.course,
          ...(input.lesson ? { lesson: input.lesson } : {}),
          struggleCount: (prev?.struggleCount ?? 0) + 1,
          struggleScore: round2((prev?.struggleScore ?? 0) + 2.6),
        }),
        now,
      )
      upsertEdge(edges, LEARNER_NODE_ID, 'GRAMMAR_ERROR_ON', gId, 2.6, now, input.questionId)
    }
  }

  for (const rawZh of input.focusWords ?? []) {
    const zh = rawZh.trim()
    if (!zh) continue
    const wId = wordNodeId(zh)
    if (input.correct) {
      upsertNode(
        nodes,
        wId,
        'word',
        zh,
        (prev) => ({
          course: prev?.course ?? input.course,
          ...(input.lesson && !prev?.lesson ? { lesson: input.lesson } : {}),
          cleanCount: (prev?.cleanCount ?? 0) + 1,
          struggleScore: Math.max(0, round2((prev?.struggleScore ?? 0) * 0.7 - 0.4)),
        }),
        now,
      )
      upsertEdge(edges, LEARNER_NODE_ID, 'RECALLED_CLEANLY', wId, 0.7, now, `exam:${input.questionId}`)
    } else {
      upsertNode(
        nodes,
        wId,
        'word',
        zh,
        (prev) => ({
          course: prev?.course ?? input.course,
          ...(input.lesson && !prev?.lesson ? { lesson: input.lesson } : {}),
          struggleCount: (prev?.struggleCount ?? 0) + 1,
          struggleScore: round2((prev?.struggleScore ?? 0) + 2.0),
        }),
        now,
      )
      upsertEdge(edges, LEARNER_NODE_ID, 'STRUGGLED_WITH', wId, 2.0, now, `exam:${gp || input.questionId}`)
    }
  }

  if (!input.correct) {
    for (const [a, b] of input.confusedPairs ?? []) {
      linkConfusion(nodes, edges, a, b, 2.4, now, input.course, input.lesson, `exam:${input.questionId}`)
    }
    const picked = input.picked?.trim() ?? ''
    const answer = input.answer?.trim() ?? ''
    if (
      picked &&
      answer &&
      picked !== answer &&
      Array.from(picked).length <= 4 &&
      Array.from(answer).length <= 4 &&
      /^[\p{Script=Han}]+$/u.test(picked) &&
      /^[\p{Script=Han}]+$/u.test(answer) &&
      (isKnownConfusionCluster(picked, answer) || !(input.confusedPairs && input.confusedPairs.length > 0))
    ) {
      linkConfusion(nodes, edges, answer, picked, 2.0, now, input.course, input.lesson, `exam:${input.questionId}`)
    }
  }

  return { version: 1, updatedAt: now, nodes, edges }
}

export interface SkippedLessonSpec {
  lesson: number
  title?: string
  words: ReadonlyArray<string | { zh: string }>
  grammarPoints?: readonly string[]
}

/**
 * Record skipped lessons as mandatory Active Recall carryover (`SKIPPED_NEEDS_RECALL`).
 * Never increments cleanCount or clears struggle — words stay pending until proved via recall.
 */
export function recordSkippedLessons(
  state: LearnerGraphState,
  input: { course: CourseKey; lessons: readonly SkippedLessonSpec[]; at?: number },
): LearnerGraphState {
  const now = input.at ?? Date.now()
  const nodes = { ...state.nodes }
  const edges = { ...state.edges }

  for (const spec of input.lessons) {
    const lId = lessonNodeId(input.course, spec.lesson)
    upsertNode(
      nodes,
      lId,
      'lesson',
      spec.title || `Lesson ${spec.lesson}`,
      () => ({
        course: input.course,
        lesson: spec.lesson,
        skippedPending: true,
      }),
      now,
    )

    const wordStrings = new Set(
      spec.words
        .map((w) => (typeof w === 'string' ? w : w?.zh ?? ''))
        .map((s) => s.trim())
        .filter(Boolean),
    )
    for (const zh of wordStrings) {
      const wId = wordNodeId(zh)
      const skId = skippedSkillNodeId(input.course, spec.lesson, zh)
      upsertNode(
        nodes,
        wId,
        'word',
        zh,
        (prev) => ({
          course: input.course,
          lesson: prev?.lesson ?? spec.lesson,
          skippedPending: true,
          struggleScore: round2(Math.max(prev?.struggleScore ?? 0, 1.4)),
        }),
        now,
      )
      upsertNode(
        nodes,
        skId,
        'skipped_skill',
        zh,
        () => ({
          course: input.course,
          lesson: spec.lesson,
          skippedPending: true,
          struggleScore: 1.8,
          meta: { word: zh },
        }),
        now,
      )
      upsertEdge(edges, lId, 'SKIPPED_NEEDS_RECALL', skId, 1.8, now, `skipped L${spec.lesson}`, 'set')
      upsertEdge(edges, LEARNER_NODE_ID, 'SKIPPED_NEEDS_RECALL', wId, 2.0, now, `${input.course}:L${spec.lesson}`, 'set')
    }

    for (const rawGp of new Set(spec.grammarPoints ?? [])) {
      const gp = rawGp.trim()
      if (!gp) continue
      const gId = grammarNodeId(gp)
      upsertNode(
        nodes,
        gId,
        'grammar_point',
        gp,
        (prev) => ({
          course: input.course,
          lesson: prev?.lesson ?? spec.lesson,
          skippedPending: true,
          struggleScore: round2(Math.max(prev?.struggleScore ?? 0, 1.4)),
        }),
        now,
      )
      upsertEdge(edges, lId, 'SKIPPED_NEEDS_RECALL', gId, 1.6, now, `skipped L${spec.lesson}`, 'set')
    }
  }

  return { version: 1, updatedAt: now, nodes, edges }
}

export function unskipLessonInGraph(
  state: LearnerGraphState,
  input: { course: CourseKey; lesson: number; at?: number },
): LearnerGraphState {
  const now = input.at ?? Date.now()
  const nodes = { ...state.nodes }
  const edges = { ...state.edges }
  const lId = lessonNodeId(input.course, input.lesson)
  if (nodes[lId]) {
    nodes[lId] = { ...nodes[lId], skippedPending: false, updatedAt: now }
  }
  const prefix = `skipped_skill:${input.course}:${input.lesson}:`
  const affectedWords = new Set<string>()
  for (const [id, node] of Object.entries(nodes)) {
    if (id.startsWith(prefix)) {
      affectedWords.add(node.label)
      nodes[id] = { ...node, skippedPending: false, struggleScore: 0, updatedAt: now }
    }
  }
  for (const [eid, edge] of Object.entries(edges)) {
    if (edge.rel === 'SKIPPED_NEEDS_RECALL' && edge.src === lId) {
      edges[eid] = { ...edge, weight: 0, note: 'unskipped', updatedAt: now }
    }
  }
  for (const zh of affectedWords) {
    const stillSkippedElsewhere = Object.values(nodes).some(
      (n) => n.kind === 'skipped_skill' && n.label === zh && n.skippedPending,
    )
    const wId = wordNodeId(zh)
    if (!stillSkippedElsewhere && nodes[wId]) {
      nodes[wId] = { ...nodes[wId], skippedPending: false, updatedAt: now }
      const skEdge = edgeKey(LEARNER_NODE_ID, 'SKIPPED_NEEDS_RECALL', wId)
      if (edges[skEdge]) edges[skEdge] = { ...edges[skEdge], weight: 0, note: 'unskipped', updatedAt: now }
    }
  }
  return { version: 1, updatedAt: now, nodes, edges }
}

/** Priority weight for surfacing a word in Active Recall / Review / Mixed Practice. */
export function priorityScore(state: LearnerGraphState, zh: string): number {
  const wId = wordNodeId(zh)
  const node = state.nodes[wId]
  let score = node ? node.struggleScore : 0
  if (node?.skippedPending) score += 2.2

  const skipEdge = state.edges[edgeKey(LEARNER_NODE_ID, 'SKIPPED_NEEDS_RECALL', wId)]
  if (skipEdge && skipEdge.weight > 0) score += skipEdge.weight * 1.4

  const struggleEdge = state.edges[edgeKey(LEARNER_NODE_ID, 'STRUGGLED_WITH', wId)]
  if (struggleEdge && struggleEdge.weight > 0) score += struggleEdge.weight * 1.6

  for (const edge of Object.values(state.edges)) {
    if (edge.rel === 'CONFUSED_WITH' && (edge.src === wId || edge.dst === wId) && edge.weight > 0) {
      score += edge.weight * 1.1
    }
  }

  if (node && !node.skippedPending && node.cleanCount > 0) {
    score -= Math.min(2.5, node.cleanCount * 0.45)
  }
  return round2(Math.max(0, score))
}

export function prioritizeWords(state: LearnerGraphState, words: readonly string[]): string[] {
  return [...new Set(words.filter((w) => w.trim()))].sort((a, b) => {
    const diff = priorityScore(state, b) - priorityScore(state, a)
    if (Math.abs(diff) > 0.001) return diff
    return 0
  })
}

export function skippedWordsForRecall(state: LearnerGraphState, course?: CourseKey): string[] {
  const out = new Set<string>()
  for (const node of Object.values(state.nodes)) {
    if (node.kind === 'skipped_skill' && node.skippedPending && (!course || node.course === course)) {
      out.add(node.label)
    } else if (!course && node.kind === 'word' && node.skippedPending) {
      out.add(node.label)
    } else if (course && node.kind === 'word' && node.skippedPending && node.course === course) {
      out.add(node.label)
    }
  }
  return prioritizeWords(state, [...out])
}

export function weakGrammarPoints(
  state: LearnerGraphState,
  limit = 12,
): Array<{ point: string; weight: number; struggleCount: number; skippedPending: boolean; course?: CourseKey; lesson?: number }> {
  return Object.values(state.nodes)
    .filter((n) => n.kind === 'grammar_point' && (n.struggleScore > 0 || n.skippedPending))
    .map((n) => {
      const errWeight = state.edges[edgeKey(LEARNER_NODE_ID, 'GRAMMAR_ERROR_ON', n.id)]?.weight ?? 0
      return {
        point: n.label,
        weight: round2(n.struggleScore + errWeight + (n.skippedPending ? 1.5 : 0)),
        struggleCount: n.struggleCount,
        skippedPending: n.skippedPending,
        course: n.course,
        lesson: n.lesson,
      }
    })
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight || b.struggleCount - a.struggleCount)
    .slice(0, limit)
}

export function activeConfusionPairs(
  state: LearnerGraphState,
  limit = 10,
): Array<{ id: string; label: string; words: [string, string]; weight: number }> {
  return Object.values(state.nodes)
    .filter((n) => n.kind === 'confusion_pair' && n.struggleScore > 0)
    .map((n) => {
      const [first, second] = n.label.split('↔')
      return {
        id: n.id,
        label: n.label,
        words: [first ?? '', second ?? ''] as [string, string],
        weight: round2(n.struggleScore),
      }
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
}

export function graphSummary(state: LearnerGraphState) {
  const skipped = skippedWordsForRecall(state)
  const weakGrammar = weakGrammarPoints(state, 5)
  const confusions = activeConfusionPairs(state, 5)
  const weakWords = Object.values(state.nodes)
    .filter((n) => n.kind === 'word' && priorityScore(state, n.label) > 0.5)
    .map((n) => ({ zh: n.label, score: priorityScore(state, n.label), skippedPending: n.skippedPending }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
  return {
    nodesTotal: Object.keys(state.nodes).length,
    edgesTotal: Object.keys(state.edges).length,
    skippedPendingCount: skipped.length,
    weakGrammarCount: weakGrammar.length,
    confusionPairCount: confusions.length,
    skippedWords: skipped,
    weakWords,
    weakGrammar,
    confusions,
  }
}

// --- Persistent reactive store for the browser app ---

function loadStoredGraph(): LearnerGraphState {
  try {
    if (typeof localStorage === 'undefined') return createEmptyGraph(0)
    const raw = localStorage.getItem(LEARNER_GRAPH_STORAGE_KEY)
    if (!raw) return createEmptyGraph(0)
    return normalizeLearnerGraph(JSON.parse(raw))
  } catch {
    return createEmptyGraph(0)
  }
}

let graphCache: LearnerGraphState = loadStoredGraph()
const graphListeners = new Set<() => void>()

function emitGraph() {
  for (const listener of graphListeners) listener()
}

function writeGraph(next: LearnerGraphState) {
  graphCache = next
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LEARNER_GRAPH_STORAGE_KEY, JSON.stringify(next))
    }
  } catch {
    /* keep in-memory state if storage quota is temporarily tight */
  }
  emitGraph()
}

export function getLearnerGraphSnapshot(): LearnerGraphState {
  return graphCache
}

export function subscribeLearnerGraph(listener: () => void): () => void {
  graphListeners.add(listener)
  return () => graphListeners.delete(listener)
}

export function updateLearnerGraph(updater: (prev: LearnerGraphState) => LearnerGraphState): LearnerGraphState {
  const next = updater(graphCache)
  if (next !== graphCache) writeGraph(next)
  return next
}

export function replaceLearnerGraph(next: LearnerGraphState): void {
  const normalized = normalizeLearnerGraph(next)
  writeGraph(normalized)
}
