/** Target-independent Hanzi classification from pen geometry against a universal corpus. */
export type InkPoint = readonly [number, number]
export type InkStroke = InkPoint[]
export type InkDrawing = InkStroke[]
export interface HanziTemplate { character: string; strokes: Float32Array[] }
export interface HandwritingModel { templates: HanziTemplate[]; samples: number; notice: string }
export interface HandwritingCandidate { character: string; distance: number }
export interface HandwritingAssessment {
  status: 'correct' | 'incorrect' | 'uncertain'
  recognized: string | null
  distance: number | null
  margin: number | null
  reason: string
}
export interface HandwritingWordAssessment {
  status: 'correct' | 'incorrect' | 'uncertain'
  characters: HandwritingAssessment[]
  recognized: string | null
  reason: string
}
export const HANDWRITING_SAMPLES = 16

function length(stroke: InkStroke): number {
  let total = 0
  for (let i = 1; i < stroke.length; i++) total += Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1])
  return total
}

/** Equal arc-length samples preserve hooks and turns independently of pointer event rate. */
export function resampleStroke(stroke: InkStroke, samples = HANDWRITING_SAMPLES): InkStroke {
  if (!stroke.length) return []
  const total = length(stroke)
  if (total < 0.001) return Array.from({ length: samples }, () => [stroke[0][0], stroke[0][1]] as const)
  const result: InkStroke = [stroke[0]]
  let segment = 1
  let passed = 0
  for (let i = 1; i < samples; i++) {
    const target = total * i / (samples - 1)
    while (segment < stroke.length - 1) {
      const distance = Math.hypot(stroke[segment][0] - stroke[segment - 1][0], stroke[segment][1] - stroke[segment - 1][1])
      if (passed + distance >= target) break
      passed += distance
      segment++
    }
    const from = stroke[segment - 1]
    const to = stroke[segment]
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1])
    const ratio = distance > 0 ? Math.min(1, Math.max(0, (target - passed) / distance)) : 0
    result.push([from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio])
  }
  return result
}

/** Normalize the whole glyph, not each stroke: relative radical placement is essential. */
export function normalizeInk(drawing: InkDrawing, samples = HANDWRITING_SAMPLES): Float32Array[] {
  const strokes = drawing.filter((stroke) => stroke.length && stroke.every((point) => point.length === 2 && point.every(Number.isFinite)))
  if (!strokes.length) return []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const stroke of strokes) for (const [x, y] of stroke) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2
  return strokes.map((stroke) => {
    const points = resampleStroke(stroke, samples)
    const result = new Float32Array(samples * 2)
    points.forEach(([x, y], i) => { result[i * 2] = (x - centerX) / span + 0.5; result[i * 2 + 1] = (y - centerY) / span + 0.5 })
    return result
  })
}

/** Binary data contains an attribution notice followed by universal, quantized stroke templates. */
export function decodeHandwritingModel(buffer: ArrayBuffer): HandwritingModel {
  const data = new DataView(buffer)
  if (buffer.byteLength < 16 || new TextDecoder().decode(new Uint8Array(buffer, 0, 4)) !== 'YHWR' || data.getUint16(4, true) !== 1) throw new Error('Unsupported handwriting data')
  const samples = data.getUint16(6, true)
  const count = data.getUint32(8, true)
  const noticeLength = data.getUint32(12, true)
  if (samples !== HANDWRITING_SAMPLES || count < 1000 || count > 50000 || noticeLength > 8000 || 16 + noticeLength > buffer.byteLength) throw new Error('Invalid handwriting data')
  const notice = new TextDecoder().decode(new Uint8Array(buffer, 16, noticeLength))
  let offset = 16 + noticeLength
  const templates: HanziTemplate[] = []
  for (let entry = 0; entry < count; entry++) {
    if (offset + 5 > buffer.byteLength) throw new Error('Incomplete handwriting data')
    const codePoint = data.getUint32(offset, true)
    const strokeCount = data.getUint8(offset + 4)
    offset += 5
    if (codePoint > 0x10ffff || strokeCount < 1 || strokeCount > 64 || offset + strokeCount * samples * 2 > buffer.byteLength) throw new Error('Invalid handwriting template')
    const strokes: Float32Array[] = []
    for (let stroke = 0; stroke < strokeCount; stroke++) {
      const points = new Float32Array(samples * 2)
      for (let i = 0; i < points.length; i++) points[i] = data.getUint8(offset++) / 255
      strokes.push(points)
    }
    templates.push({ character: String.fromCodePoint(codePoint), strokes })
  }
  if (offset !== buffer.byteLength) throw new Error('Invalid handwriting data length')
  return { templates, samples, notice }
}

interface StrokeGeometry { x: number; y: number; width: number; height: number; minX: number; maxX: number; minY: number; maxY: number }
const geometries = new WeakMap<Float32Array, StrokeGeometry>()
function geometry(stroke: Float32Array): StrokeGeometry {
  const cached = geometries.get(stroke)
  if (cached) return cached
  let x = 0, y = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < stroke.length; i += 2) {
    x += stroke[i]; y += stroke[i + 1]
    minX = Math.min(minX, stroke[i]); maxX = Math.max(maxX, stroke[i])
    minY = Math.min(minY, stroke[i + 1]); maxY = Math.max(maxY, stroke[i + 1])
  }
  const result = { x: x / (stroke.length / 2), y: y / (stroke.length / 2), width: maxX - minX, height: maxY - minY, minX, maxX, minY, maxY }
  geometries.set(stroke, result)
  return result
}

/** Local shape tolerates bounded handwriting proportions; global position still matters. */
function strokeDistance(a: Float32Array, b: Float32Array): number {
  const ag = geometry(a), bg = geometry(b)
  const scaleX = ag.width > 0.06 && bg.width > 0.06 ? Math.max(0.7, Math.min(1.4, bg.width / ag.width)) : 1
  const scaleY = ag.height > 0.06 && bg.height > 0.06 ? Math.max(0.7, Math.min(1.4, bg.height / ag.height)) : 1
  const scalingPenalty = (Math.abs(Math.log(scaleX)) + Math.abs(Math.log(scaleY))) * 0.012
  let forward = 0, reverse = 0, adjusted = 0, adjustedReverse = 0
  const points = a.length / 2
  for (let i = 0; i < a.length; i += 2) {
    const ax = a[i] - ag.x, ay = a[i + 1] - ag.y
    const bx = b[i] - bg.x, by = b[i + 1] - bg.y
    const reversed = b.length - 2 - i
    const rx = b[reversed] - bg.x, ry = b[reversed + 1] - bg.y
    forward += Math.hypot(ax - bx, ay - by)
    reverse += Math.hypot(ax - rx, ay - ry)
    adjusted += Math.hypot(ax * scaleX - bx, ay * scaleY - by)
    adjustedReverse += Math.hypot(ax * scaleX - rx, ay * scaleY - ry)
  }
  const shape = Math.min(forward / points, reverse / points + 0.045, adjusted / points + scalingPenalty, adjustedReverse / points + scalingPenalty + 0.045)
  return shape + Math.hypot(ag.x - bg.x, ag.y - bg.y) * 0.2 + (Math.abs(ag.width - bg.width) + Math.abs(ag.height - bg.height)) * 0.08
}

/** Minimum-cost stroke assignment makes pen order independent, while preserving spatial layout. */
interface StrokeMatch { distance: number; maxStrokeDistance: number; complete: boolean }
function assignmentDistance(input: Float32Array[], template: Float32Array[], compare: (a: Float32Array, b: Float32Array) => number): StrokeMatch {
  const n = Math.max(input.length, template.length)
  const costs = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i < input.length && j < template.length ? compare(input[i], template[j]) : 0.55))
  const u = new Float64Array(n + 1), v = new Float64Array(n + 1)
  const p = new Uint16Array(n + 1), way = new Uint16Array(n + 1)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minimum = new Float64Array(n + 1).fill(Infinity)
    const used = new Uint8Array(n + 1)
    do {
      used[j0] = 1
      const i0 = p[j0]
      let delta = Infinity, j1 = 0
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue
        const current = costs[i0 - 1][j - 1] - u[i0] - v[j]
        if (current < minimum[j]) { minimum[j] = current; way[j] = j0 }
        if (minimum[j] < delta) { delta = minimum[j]; j1 = j }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta }
        else minimum[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while (j0)
  }
  let maxStrokeDistance = 0
  for (let j = 1; j <= n; j++) maxStrokeDistance = Math.max(maxStrokeDistance, costs[p[j] - 1][j - 1])
  return { distance: -v[0] / n, maxStrokeDistance, complete: input.length === template.length }
}

interface StrokeGraph { components: number[]; degrees: number[]; edges: number }
const strokeGraphs = new WeakMap<Float32Array[], StrokeGraph>()
// Font medians stop inside stroke outlines. A small, glyph-relative gap must
// count as a connection; otherwise a normal person glyph becomes a cross.
const GRAPH_TOLERANCE = 0.045

function pointSegmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const denominator = dx * dx + dy * dy
  const t = denominator ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / denominator)) : 0
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}

function touches(a: Float32Array, b: Float32Array): boolean {
  const ag = geometry(a), bg = geometry(b), tolerance = GRAPH_TOLERANCE
  if (ag.maxX + tolerance < bg.minX || bg.maxX + tolerance < ag.minX || ag.maxY + tolerance < bg.minY || bg.maxY + tolerance < ag.minY) return false
  for (let i = 2; i < a.length; i += 2) for (let j = 2; j < b.length; j += 2) {
    const ax = a[i - 2], ay = a[i - 1], bx = a[i], by = a[i + 1]
    const cx = b[j - 2], cy = b[j - 1], dx = b[j], dy = b[j + 1]
    const crossA = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    const crossB = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax)
    const crossC = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)
    const crossD = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx)
    if (crossA * crossB < 0 && crossC * crossD < 0) return true
    if (Math.min(pointSegmentDistance(ax, ay, cx, cy, dx, dy), pointSegmentDistance(bx, by, cx, cy, dx, dy), pointSegmentDistance(cx, cy, ax, ay, bx, by), pointSegmentDistance(dx, dy, ax, ay, bx, by)) <= tolerance) return true
  }
  return false
}

/** Crossings and disconnected radicals disambiguate similarly shaped strokes. */
function strokeGraph(strokes: Float32Array[]): StrokeGraph {
  const cached = strokeGraphs.get(strokes)
  if (cached) return cached
  const parent = strokes.map((_, i) => i), degree = new Uint16Array(strokes.length)
  const root = (i: number): number => { while (parent[i] !== i) i = parent[i]; return i }
  let edges = 0
  for (let i = 0; i < strokes.length; i++) for (let j = i + 1; j < strokes.length; j++) if (touches(strokes[i], strokes[j])) {
    parent[root(i)] = root(j)
    degree[i]++; degree[j]++; edges++
  }
  const sizes = new Map<number, number>()
  strokes.forEach((_, i) => sizes.set(root(i), (sizes.get(root(i)) ?? 0) + 1))
  const degrees = Array.from({ length: strokes.length }, () => 0)
  degree.forEach((value) => degrees[value]++)
  const result = { components: [...sizes.values()].sort((a, b) => b - a).map((size) => size / strokes.length), degrees: degrees.map((count) => count / strokes.length), edges: edges / strokes.length }
  strokeGraphs.set(strokes, result)
  return result
}

function graphDistance(a: Float32Array[], b: Float32Array[]): number {
  const ag = strokeGraph(a), bg = strokeGraph(b)
  const difference = (left: number[], right: number[]) => Array.from({ length: Math.max(left.length, right.length) }, (_, i) => Math.abs((left[i] ?? 0) - (right[i] ?? 0))).reduce((sum, value) => sum + value, 0)
  return difference(ag.components, bg.components) * 0.55 + difference(ag.degrees, bg.degrees) * 0.35 + Math.abs(ag.edges - bg.edges) * 0.25
}

const connectedVariants = new WeakMap<Float32Array[], Float32Array[][]>()
function connectedStrokes(strokes: Float32Array[]): Float32Array[][] {
  const cached = connectedVariants.get(strokes)
  if (cached) return cached
  const variants: Float32Array[][] = []
  for (let i = 0; i < strokes.length - 1; i++) {
    const a = strokes[i], b = strokes[i + 1]
    if (Math.hypot(a[a.length - 2] - b[0], a[a.length - 1] - b[1]) > 0.2) continue
    const joined: InkStroke = []
    for (const stroke of [a, b]) for (let j = 0; j < stroke.length; j += 2) joined.push([stroke[j], stroke[j + 1]])
    const merged = Float32Array.from(resampleStroke(joined).flat())
    variants.push([...strokes.slice(0, i), merged, ...strokes.slice(i + 2)])
  }
  connectedVariants.set(strokes, variants)
  return variants
}

interface GlyphMatch extends StrokeMatch { structureDistance: number }
function glyphDistance(input: Float32Array[], template: Float32Array[], structural = false): GlyphMatch {
  // Connected variants retain most original strokes. Reuse those comparisons
  // instead of recalculating their curves for every possible join.
  const compared = new Map<Float32Array, Map<Float32Array, number>>()
  const compare = (a: Float32Array, b: Float32Array) => {
    let row = compared.get(a)
    if (!row) { row = new Map(); compared.set(a, row) }
    const cached = row.get(b)
    if (cached !== undefined) return cached
    const result = strokeDistance(a, b)
    row.set(b, result)
    return result
  }
  const match = (left: Float32Array[], right: Float32Array[], penalty: number): GlyphMatch => {
    const strokes = assignmentDistance(left, right, compare)
    const structureDistance = structural ? graphDistance(left, right) : 0
    return { ...strokes, structureDistance, distance: strokes.distance + penalty + structureDistance * 0.06 }
  }
  let best = match(input, template, Math.abs(input.length - template.length) * 0.03)
  const consider = (candidate: GlyphMatch) => { if (candidate.distance < best.distance) best = candidate }
  if (template.length === input.length + 1) {
    for (const connected of connectedStrokes(template)) consider(match(input, connected, 0.006))
  } else if (input.length === template.length + 1) {
    for (const connected of connectedStrokes(input)) consider(match(connected, template, 0.006))
  }
  return best
}

interface RankedGlyph extends HandwritingCandidate, GlyphMatch { template: HanziTemplate }
function rankHandwriting(drawing: InkDrawing, model: HandwritingModel, limit: number): RankedGlyph[] {
  if (!drawing.length || drawing.length > 64 || !Number.isInteger(limit) || limit < 1) return []
  const input = normalizeInk(drawing, model.samples)
  if (!input.length) return []
  // Evaluate stroke geometry over the full corpus, then compare the richer
  // connectivity features on a broad shortlist. The expected answer is absent.
  const coarse: { template: HanziTemplate; distance: number }[] = []
  for (const template of model.templates) {
    if (Math.abs(input.length - template.strokes.length) > 2) continue
    const { distance } = glyphDistance(input, template.strokes)
    if (!Number.isFinite(distance)) continue
    coarse.push({ template, distance })
  }
  coarse.sort((a, b) => a.distance - b.distance)
  const ranked: RankedGlyph[] = []
  for (let i = 0; i < coarse.length; i++) {
    // Geometry is a lower bound on the score after connectivity penalties.
    // Expand beyond the initial shortlist whenever an unseen glyph could
    // still beat the last result, so confidence never uses an omitted rival.
    if (i >= Math.max(48, limit) && ranked.length >= limit && coarse[i].distance > ranked[limit - 1].distance) break
    const { template } = coarse[i]
    const candidate = { character: template.character, template, ...glyphDistance(input, template.strokes, true) }
    let index = ranked.findIndex((current) => current.distance > candidate.distance)
    if (index < 0) index = ranked.length
    if (index < limit) { ranked.splice(index, 0, candidate); if (ranked.length > limit) ranked.pop() }
  }
  return ranked
}

/** No target character, vocabulary list, or English clue enters this function. */
export function recognizeHandwriting(drawing: InkDrawing, model: HandwritingModel, limit = 12): HandwritingCandidate[] {
  return rankHandwriting(drawing, model, limit).map(({ character, distance }) => ({ character, distance }))
}

/** A missing constituent must not masquerade as a continuous joined stroke. */
function coversOriginalStrokes(input: Float32Array[], template: Float32Array[]): boolean {
  const means: number[] = []
  let maximumGap = 0
  for (const expectedStroke of template) {
    let total = 0
    for (let i = 0; i < expectedStroke.length; i += 2) {
      let nearest = Infinity
      for (const written of input) for (let j = 2; j < written.length; j += 2) {
        nearest = Math.min(nearest, pointSegmentDistance(expectedStroke[i], expectedStroke[i + 1], written[j - 2], written[j - 1], written[j], written[j + 1]))
      }
      total += nearest
      maximumGap = Math.max(maximumGap, nearest)
    }
    means.push(total / (expectedStroke.length / 2))
  }
  means.sort((a, b) => a - b)
  const middle = Math.floor(means.length / 2)
  const typicalGap = means.length % 2 ? means[middle] : (means[middle - 1] + means[middle]) / 2
  // Ordinary loose proportions shift several strokes together. A single
  // absent stroke produces a large isolated residual against otherwise close
  // ink. Bound both that outlier and the maximum absolute gap.
  return maximumGap <= 0.22 && maximumGap <= 0.07 + typicalGap * 3 && means[means.length - 1] <= 0.035 + typicalGap * 3
}

/** Blind corpus recognition happens first; expected text never changes the ranking. */
export function assessHandwriting(drawing: InkDrawing, model: HandwritingModel, expectedCharacter: string): HandwritingAssessment {
  const candidates = rankHandwriting(drawing, model, 2)
  const best = candidates[0], second = candidates[1]
  const margin = best && second ? second.distance - best.distance : null
  const knownTarget = Array.from(expectedCharacter).length === 1 && model.templates.some((template) => template.character === expectedCharacter)
  const strict = best && second && margin !== null && best.distance <= 0.075 && margin >= 0.015 && best.distance <= second.distance * 0.85 && best.maxStrokeDistance <= 0.2
  const loose = best && second && margin !== null && best.distance <= 0.12 && margin >= 0.025 && best.distance <= second.distance * 0.83 && best.structureDistance <= 0.03 && best.maxStrokeDistance <= 0.16
  const covered = best && best.complete && coversOriginalStrokes(normalizeInk(drawing, model.samples), best.template.strokes)
  if (!best || !second || !knownTarget || !covered || (!strict && !loose)) {
    return { status: 'uncertain', recognized: null, distance: best?.distance ?? null, margin, reason: 'The drawing is too ambiguous to assess reliably. Redraw it or use typed input.' }
  }
  return { status: best.character === expectedCharacter ? 'correct' : 'incorrect', recognized: best.character, distance: best.distance, margin, reason: best.character === expectedCharacter ? 'The drawing reliably matches the requested character.' : 'The drawing reliably matches a different character.' }
}

export function assessHandwritingWord(drawings: InkDrawing[], model: HandwritingModel, expectedWord: string): HandwritingWordAssessment {
  const expected = Array.from(expectedWord.trim())
  if (!expected.length || drawings.length !== expected.length) {
    return { status: 'uncertain', characters: [], recognized: null, reason: 'Complete one drawing for each character before checking.' }
  }
  const characters = drawings.map((drawing, index) => assessHandwriting(drawing, model, expected[index]))
  const status = characters.some((character) => character.status === 'uncertain') ? 'uncertain' : characters.every((character) => character.status === 'correct') ? 'correct' : 'incorrect'
  return { status, characters, recognized: characters.every((character) => character.recognized) ? characters.map((character) => character.recognized).join('') : null, reason: status === 'correct' ? 'Every character was recognized and matches the requested word.' : status === 'incorrect' ? 'At least one confidently recognized character differs from the requested word.' : 'At least one drawing is ambiguous. Redraw that character or use typed input.' }
}

let pendingModel: Promise<HandwritingModel> | null = null
export function loadHandwritingModel(url: string): Promise<HandwritingModel> {
  if (!pendingModel) {
    pendingModel = fetch(url, { cache: 'force-cache' }).then(async (response) => {
      if (!response.ok) throw new Error('The local handwriting dictionary could not load.')
      return decodeHandwritingModel(await response.arrayBuffer())
    }).catch((error) => { pendingModel = null; throw error })
  }
  return pendingModel
}
