// FSRS-6 Spaced Repetition, Micro-Wave Chunking & Sentence Tile Builder for Renita's HSK 1 Dari Nol.
// Pure zero-DOM module reusing ./srs.ts (FSRS-6) so laptop & iPhone sync identically.
import type { Hsk1Word } from '../data/hsk1.ts'
import { HSK1_CHAR_BREAKDOWN, HSK1_RADICALS } from '../data/hsk1Strokes.ts'
import { DAY, dueCards, newCard, recallChance, schedule, type Card, type Rating } from './srs.ts'

export const HSK1_NODE_ORDER = ['kenali', 'goresan', 'dengar', 'kalimat', 'bos'] as const
export type Hsk1NodeId = (typeof HSK1_NODE_ORDER)[number]

export const HSK1_NODE_META: Record<Hsk1NodeId, { label: string; shortZh: string; emoji: string }> = {
  kenali: { label: 'Kenali & Akar', shortZh: '认字', emoji: '✨' },
  goresan: { label: 'Arti Goresan', shortZh: '笔画', emoji: '✍️' },
  dengar: { label: 'Telinga & Pasang', shortZh: '听力', emoji: '🎧' },
  kalimat: { label: 'Rakit Kalimat', shortZh: '造句', emoji: '🧩' },
  bos: { label: 'Bos Recall', shortZh: '挑战', emoji: '🏆' },
}

export function formatHsk1Interval(due: number, now = Date.now()): string {
  const minutes = Math.max(1, Math.round((due - now) / 60_000))
  if (minutes < 60) return `${minutes} menit lagi`
  const nowDay = new Date(now)
  nowDay.setHours(0, 0, 0, 0)
  const dueDay = new Date(due)
  dueDay.setHours(0, 0, 0, 0)
  const days = Math.round((dueDay.getTime() - nowDay.getTime()) / DAY)
  if (days <= 0) return `${Math.max(1, Math.round(minutes / 60))} jam lagi`
  if (days === 1) return 'Besok'
  if (days === 2) return 'Lusa'
  if (days < 45) return `${days} hari lagi`
  return `${Math.max(1, Math.round(days / 30))} bulan lagi`
}

export function reviewHsk1Card(
  srsCards: Record<string, Card>,
  zh: string,
  unit: number,
  rating: Rating,
  nowMs = Date.now(),
): { nextCards: Record<string, Card>; updated: Card; nextLabel: string } {
  const existing = srsCards[zh] ?? newCard(zh, 900 + unit, nowMs)
  // Pass placement=false and allow fresh cards (reps === 0) or due cards to advance,
  // while if a card is re-reviewed early inside a drill we still update on 'again' or when due.
  const baseCard: Card =
    existing.lastReview !== undefined && nowMs < existing.due && rating !== 'again'
      ? { ...existing, due: nowMs }
      : existing
  const updated = schedule(baseCard, rating, nowMs, false)
  return {
    nextCards: {
      ...srsCards,
      [zh]: updated,
    },
    updated,
    nextLabel: formatHsk1Interval(updated.due, nowMs),
  }
}

export interface Hsk1MemorySummary {
  totalTracked: number
  dueWords: string[]
  dueCount: number
  strongCount: number
  avgRetentionPct: number
}

export function getHsk1MemorySummary(
  srsCards: Record<string, Card>,
  provenWords: readonly string[],
  nowMs = Date.now(),
): Hsk1MemorySummary {
  const map = srsCards ?? {}
  const list = Object.values(map)
  const due = dueCards(list, nowMs)
  const reviewed = list.filter((c) => c.lastReview !== undefined)

  let sumRetention = 0
  let countRetention = 0
  let strongCount = 0

  for (const c of reviewed) {
    const chance = recallChance(c, nowMs)
    if (chance !== null) {
      sumRetention += chance
      countRetention += 1
    }
    if (c.interval >= 6 || c.reps >= 3) strongCount += 1
  }

  const provenSet = new Set(provenWords ?? [])
  const trackedSet = new Set([...Object.keys(map), ...provenSet])

  return {
    totalTracked: trackedSet.size,
    dueWords: due.map((c) => c.zh),
    dueCount: due.length,
    strongCount: Math.max(strongCount, Math.floor(provenSet.size * 0.4)),
    avgRetentionPct:
      countRetention > 0
        ? Math.max(10, Math.min(100, Math.round((sumRetention / countRetention) * 100)))
        : provenSet.size > 0
          ? 92
          : 100,
  }
}

export function selectHsk1RecallQueue(
  srsCards: Record<string, Card>,
  provenWords: readonly string[],
  allWords: readonly Hsk1Word[],
  nowMs = Date.now(),
  limit = 10,
): Hsk1Word[] {
  const byZh = new Map(allWords.map((w) => [w.zh, w]))
  const picked: Hsk1Word[] = []
  const seen = new Set<string>()

  const pushWord = (zh: string) => {
    if (seen.has(zh)) return
    const word = byZh.get(zh)
    if (!word) return
    seen.add(zh)
    picked.push(word)
  }

  // 1. Overdue / due FSRS cards ranked by lowest retrievability first
  const dueScored = Object.values(srsCards ?? {})
    .filter((c) => Number.isFinite(c.due) && c.due <= nowMs)
    .map((c) => ({ card: c, chance: recallChance(c, nowMs) ?? 0 }))
    .sort((a, b) => a.chance - b.chance || a.card.due - b.card.due)

  for (const item of dueScored) {
    if (picked.length >= limit) break
    pushWord(item.card.zh)
  }

  // 2. Weak / lowest-retention reviewed FSRS cards
  const weakScored = Object.values(srsCards ?? {})
    .filter((c) => !seen.has(c.zh))
    .map((c) => ({ card: c, chance: recallChance(c, nowMs) ?? 0.5 }))
    .sort((a, b) => a.chance - b.chance)

  for (const item of weakScored) {
    if (picked.length >= limit) break
    pushWord(item.card.zh)
  }

  // 3. Proven words not yet in FSRS map
  for (const zh of provenWords ?? []) {
    if (picked.length >= limit) break
    pushWord(zh)
  }

  // 4. Starter fallback if user is brand new
  for (const word of allWords) {
    if (picked.length >= limit) break
    pushWord(word.zh)
  }

  return picked.slice(0, limit)
}

export interface WaveMicroCheck {
  id: string
  kind: 'meaning' | 'audio' | 'radical'
  target: Hsk1Word
  promptId: string
  options: Hsk1Word[]
}

export interface VocabWave {
  waveIndex: number
  totalWaves: number
  introWords: Hsk1Word[]
  microChecks: WaveMicroCheck[]
}

export function buildVocabWaves(words: readonly Hsk1Word[], waveSize = 3): VocabWave[] {
  const safeSize = Math.max(2, waveSize)
  const chunks: Hsk1Word[][] = []
  for (let i = 0; i < words.length; i += safeSize) {
    const slice = words.slice(i, i + safeSize)
    // Merge tiny trailing 1-word slice into the previous wave so every wave has 2-4 words
    if (slice.length === 1 && chunks.length > 0) {
      chunks[chunks.length - 1] = [...chunks[chunks.length - 1], slice[0]]
    } else {
      chunks.push([...slice])
    }
  }

  const pickDistractors = (target: Hsk1Word, count = 2): Hsk1Word[] => {
    const pool = words.filter((w) => w.zh !== target.zh)
    const idx = words.findIndex((w) => w.zh === target.zh)
    const chosen: Hsk1Word[] = []
    for (let step = 1; step <= pool.length && chosen.length < count; step++) {
      const candidate = pool[(Math.max(0, idx) + step * 2) % pool.length]
      if (candidate && !chosen.some((c) => c.zh === candidate.zh)) chosen.push(candidate)
    }
    return [target, ...chosen].sort((a, b) => a.zh.localeCompare(b.zh))
  }

  const getRadicalClue = (word: Hsk1Word): string => {
    for (const ch of Array.from(word.zh)) {
      const info = HSK1_CHAR_BREAKDOWN[ch]
      if (info && info.parts.length > 0) {
        const partLabels = info.parts
          .map((p) => HSK1_RADICALS[p])
          .filter(Boolean)
          .map((r) => `${r.emoji} ${r.glyph} (${r.meaningId})`)
        if (partLabels.length > 0) {
          return `Petunjuk komponen ${partLabels.join(' + ')} → "${word.literalTip}"`
        }
        return info.storyId
      }
    }
    return word.literalTip
  }

  return chunks.map((introWords, wi) => {
    const microChecks: WaveMicroCheck[] = introWords.map((target, idx) => {
      const kinds: Array<'meaning' | 'audio' | 'radical'> = ['meaning', 'audio', 'radical']
      const kind = kinds[idx % kinds.length]
      const promptId =
        kind === 'audio'
          ? 'Dengar pelafalannya, lalu pilih karakter yang tepat:'
          : kind === 'radical'
            ? getRadicalClue(target)
            : `Kata Mandarin mana yang berarti "${target.meaningId}"?`
      return {
        id: `w${wi + 1}-c${idx + 1}-${target.zh}`,
        kind,
        target,
        promptId,
        options: pickDistractors(target, 3),
      }
    })
    return {
      waveIndex: wi + 1,
      totalWaves: chunks.length,
      introWords,
      microChecks,
    }
  })
}

const COMMON_GLUE_TOKENS = [
  '我们', '你们', '他们', '什么', '怎么', '多少', '高兴', '再见', '谢谢', '认识',
  '我', '你', '他', '她', '是', '不', '没', '很', '太', '也', '都',
  '在', '有', '了', '的', '吗', '呢', '几', '谁', '哪', '好', '看', '吃', '喝', '去', '来',
]

function hashOrder(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function buildSentenceTiles(
  sentenceZh: string,
  unitWords: readonly Hsk1Word[],
): { answerTokens: string[]; bankTokens: string[]; cleanSentence: string } {
  const cleanSentence = sentenceZh.replace(/[。？！，、：；“”"'.?!,\s]+/g, '')
  const dict = new Set<string>([
    ...unitWords.map((w) => w.zh),
    ...COMMON_GLUE_TOKENS,
  ])
  const sortedDict = [...dict].filter((w) => w.length > 0).sort((a, b) => b.length - a.length)

  const answerTokens: string[] = []
  let pos = 0
  while (pos < cleanSentence.length) {
    const rest = cleanSentence.slice(pos)
    const hit = sortedDict.find((w) => rest.startsWith(w))
    if (hit) {
      answerTokens.push(hit)
      pos += hit.length
    } else {
      answerTokens.push(cleanSentence[pos])
      pos += 1
    }
  }

  const answerSet = new Set(answerTokens)
  const distractors: string[] = []
  for (const w of unitWords) {
    if (!answerSet.has(w.zh) && !distractors.includes(w.zh)) {
      distractors.push(w.zh)
      if (distractors.length >= 2) break
    }
  }
  for (const g of ['吗', '不', '很', '是']) {
    if (distractors.length >= 2) break
    if (!answerSet.has(g) && !distractors.includes(g)) distractors.push(g)
  }

  const bankTokens = [...answerTokens, ...distractors]
    .map((tok, idx) => ({ tok, sortKey: hashOrder(`${sentenceZh}:${tok}:${idx}`) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((x) => x.tok)

  return { answerTokens, bankTokens, cleanSentence }
}
