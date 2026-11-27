// Pure analytics helpers for daily comparison (yesterday vs today + 7-day trend)
// and lexical category understanding breakdown (Verb, Noun, Adj, Tempat/Arah, Waktu/Angka, Partikel).
import type { MasteryRecord } from './mastery.ts'

export interface DailySeriesPoint {
  key: string
  label: string
  cards: number
  lessons: number
  isToday: boolean
}

export interface DailyComparisonResult {
  todayCards: number
  yesterdayCards: number
  deltaCards: number
  todayLessons: number
  yesterdayLessons: number
  series7Days: DailySeriesPoint[]
}

export type LexicalCategoryId = 'verb' | 'noun' | 'adj' | 'place' | 'time' | 'particle'

export interface CategoryBreakdownItem {
  category: LexicalCategoryId
  label: string
  mastered: number
  learning: number
  total: number
  pct: number
  accentHex: string
}

function formatLocalDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function parseDayKeyDate(todayKey: string, nowMs: number): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayKey)
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
    if (!Number.isNaN(dt.getTime())) return dt
  }
  return new Date(nowMs)
}

const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const

export function computeDailyComparison(
  log: Record<string, { lessons?: number; cards?: number }>,
  todayKey: string,
  nowMs = Date.now(),
): DailyComparisonResult {
  const anchor = parseDayKeyDate(todayKey, nowMs)
  const series7Days: DailySeriesPoint[] = []

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(anchor)
    d.setDate(anchor.getDate() - offset)
    const k = formatLocalDayKey(d)
    const entry = log?.[k]
    series7Days.push({
      key: k,
      label: offset === 0 ? 'Hari ini' : WEEKDAY_SHORT[d.getDay()],
      cards: Math.max(0, Number(entry?.cards ?? 0)),
      lessons: Math.max(0, Number(entry?.lessons ?? 0)),
      isToday: offset === 0,
    })
  }

  const todayPoint = series7Days[6]
  const yesterdayPoint = series7Days[5]

  return {
    todayCards: todayPoint.cards,
    yesterdayCards: yesterdayPoint.cards,
    deltaCards: todayPoint.cards - yesterdayPoint.cards,
    todayLessons: todayPoint.lessons,
    yesterdayLessons: yesterdayPoint.lessons,
    series7Days,
  }
}

const PLACE_WORDS = new Set([
  '中国', '北京', '家', '学校', '饭店', '商店', '医院', '火车站', '上', '下',
  '前面', '后面', '里', '哪儿', '在', '办公室', '超市', '图书馆', '公园', '机场',
  '车站', '教室', '房间', '宿舍', '食堂', '银行', '邮局', '宾馆', '地方', '附近',
  '对面', '旁边', '中间', '东', '西', '南', '北',
])

const TIME_NUMBER_WORDS = new Set([
  '零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万',
  '年', '月', '日', '号', '星期', '今天', '昨天', '明天', '现在', '上午', '中午',
  '下午', '晚上', '点', '分钟', '小时', '时候', '岁', '几', '多少', '刚才', '以前',
  '以后', '早', '晚', '时间', '总是', '经常',
])

const PARTICLE_GRAMMAR_WORDS = new Set([
  '我', '你', '他', '她', '我们', '你们', '他们', '的', '得', '地', '了', '着', '过',
  '吗', '呢', '吧', '啊', '不', '没', '很', '太', '都', '也', '就', '才', '又', '再',
  '和', '跟', '比', '把', '被', '因为', '所以', '虽然', '但是', '如果', '然后',
  '个', '本', '位', '张', '件', '条', '次', '遍', '这', '那', '谁', '什么', '哪', '怎么', '怎么样',
])

const HSK1_VERBS = new Set([
  '好', '谢谢', '不客气', '对不起', '没关系', '再见', '请', '喂', '想', '是', '叫',
  '认识', '吃', '喝', '买', '学习', '工作', '看', '听', '说', '读', '写', '爱',
  '下雨', '住', '睡觉', '去', '来', '回', '坐', '开', '会', '能', '看见', '喜欢',
  '有', '打电话', '做',
])

const HSK1_ADJS = new Set([
  '大', '小', '多', '少', '高兴', '漂亮', '冷', '热', '忙', '慢',
])

export function classifyLexicalCategory(zh: string, rawPos?: string): LexicalCategoryId {
  const cleanZh = zh.trim()
  const pos = (rawPos ?? '').trim().toLowerCase()

  if (PLACE_WORDS.has(cleanZh) || /loc\.|f\.|方位|处所/.test(pos)) return 'place'
  if (TIME_NUMBER_WORDS.has(cleanZh) || /num\.|time/.test(pos)) return 'time'
  if (
    PARTICLE_GRAMMAR_WORDS.has(cleanZh) ||
    /^(adv|conj|prep|pron|part|m\.|mod|int|num\.-m)/.test(pos)
  ) {
    return 'particle'
  }
  if (HSK1_ADJS.has(cleanZh) || /^adj/.test(pos)) return 'adj'
  if (HSK1_VERBS.has(cleanZh) || /^v\.|^v\//.test(pos)) return 'verb'
  return 'noun'
}

const CATEGORY_META: Array<{ id: LexicalCategoryId; label: string; accentHex: string }> = [
  { id: 'verb', label: 'Kata Kerja (Verb)', accentHex: '#0f766e' },
  { id: 'noun', label: 'Kata Benda (Noun)', accentHex: '#2563eb' },
  { id: 'adj', label: 'Kata Sifat (Adj)', accentHex: '#d97706' },
  { id: 'place', label: 'Tempat & Arah', accentHex: '#059669' },
  { id: 'time', label: 'Waktu & Angka', accentHex: '#7c3aed' },
  { id: 'particle', label: 'Partikel & Grammar', accentHex: '#db2777' },
]

export function computeCategoryBreakdown(
  mastery: Record<string, MasteryRecord>,
  hsk1ProvenWords: readonly string[],
  posLookup: (zh: string) => string | undefined,
): CategoryBreakdownItem[] {
  const buckets = new Map<LexicalCategoryId, { mastered: number; learning: number }>()
  for (const meta of CATEGORY_META) {
    buckets.set(meta.id, { mastered: 0, learning: 0 })
  }

  const seenZh = new Set<string>()
  for (const rec of Object.values(mastery ?? {})) {
    if (!rec?.zh) continue
    seenZh.add(rec.zh)
    const cat = classifyLexicalCategory(rec.zh, posLookup(rec.zh))
    const entry = buckets.get(cat)!
    if (rec.state === 'mastered') entry.mastered += 1
    else if (rec.unaidedSuccesses >= 1 || rec.attempts > 0) entry.learning += 1
  }

  for (const zh of hsk1ProvenWords ?? []) {
    if (!zh || seenZh.has(zh)) continue
    seenZh.add(zh)
    const cat = classifyLexicalCategory(zh, posLookup(zh))
    const entry = buckets.get(cat)!
    entry.mastered += 1
  }

  return CATEGORY_META.map((meta) => {
    const counts = buckets.get(meta.id)!
    const total = counts.mastered + counts.learning
    const pct = total > 0 ? Math.round((counts.mastered / total) * 100) : 0
    return {
      category: meta.id,
      label: meta.label,
      mastered: counts.mastered,
      learning: counts.learning,
      total,
      pct,
      accentHex: meta.accentHex,
    }
  })
}
