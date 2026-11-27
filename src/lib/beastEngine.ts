// HSK 6-Variable Gamification & 8-Stage Legendary Beast Evolution Engine.
// Pure zero-DOM module so Node tests and browser UI share exact calculations.
import {
  BEAST_STAGES,
  FREE_BEAST_STAGE_IDS,
  type BeastRarity,
  type BeastStageId,
} from './beastStages.ts'
import type { HistoryEvent } from './history.ts'
import type { LearnerGraphState } from './learnerGraph.ts'
import type { MasteryRecord } from './mastery.ts'
import type { Card } from './srs.ts'

export type BeastId =
  | 'egg'
  | 'qilin'
  | 'fox'
  | 'baihu'
  | 'zhuque'
  | 'xuanwu'
  | 'qinglong'
  | 'sovereign'

export interface LegendaryBeastTier {
  level: number
  id: BeastId
  zhName: string
  pinyin: string
  name: string
  title: string
  element: string
  rarity: BeastRarity
  minPower: number
  imageSrc: string
  accentHex: string
  lore: string
  quotes: readonly string[]
}

export const LEGENDARY_BEASTS: readonly LegendaryBeastTier[] = [
  {
    level: 1,
    id: 'egg',
    zhName: '灵蛋',
    pinyin: 'Língdàn',
    name: 'Spirit Jade Egg',
    title: 'Benih Naga Giok Awal',
    element: 'Jade Spirit',
    rarity: 'rare',
    minPower: 0,
    imageSrc: '/beasts/v1/beast-01-egg.webp',
    accentHex: '#0f766e',
    lore: 'Telur giok suci ini berdetak setiap kali kamu mengingat satu kata Mandarin tanpa melihat bantuan.',
    quotes: [
      '千里之行，始于足下！Mulai 1 sesi hari ini untuk membangunkan retakan giok pertamaku!',
      'Setiap kata ingatan murni adalah tetes embun giok yang meneteskan nyawa ke dalam cangkangku.',
      'Sentuh pelan & fokus: kita mulai ulang dari nol, tapi kali ini fondasi HSK-mu jauh lebih kokoh!',
    ],
  },
  {
    level: 2,
    id: 'qilin',
    zhName: '玉麒麟',
    pinyin: 'Yù Qílín',
    name: 'Baby Jade Qilin',
    title: 'Penjaga Kosakata Baru Tumbuh',
    element: 'Emerald Wind',
    rarity: 'rare',
    minPower: 150,
    imageSrc: '/beasts/v1/beast-02-qilin.webp',
    accentHex: '#059669',
    lore: 'Anak Qilin pembawa keberuntungan yang hanya muncul saat pelajar menumbuhkan hafalan murni pertama.',
    quotes: [
      '温故而知新！Mengulang kata lama di Active Recall membuatku tumbuh secepat angin pagi.',
      'Tanduk giokku menyala tiap kali kamu menuntaskan kartu harianmu tepat waktu!',
      'Jangan ragu menulis Hanzi atau menjawab tanpa pinyin — di situlah 灵力 sejatiku lahir.',
    ],
  },
  {
    level: 3,
    id: 'fox',
    zhName: '九尾灵狐',
    pinyin: 'Jiǔwěi Línghú',
    name: 'Nine-Tails Spirit Fox',
    title: 'Rubah Api Sembilan Ekor',
    element: 'Celestial Flame',
    rarity: 'epic',
    minPower: 450,
    imageSrc: '/beasts/v1/beast-03-fox.webp',
    accentHex: '#0284c7',
    lore: 'Roh rubah giok-perak dengan sembilan ekor cahaya yang lihai membedakan kata mirip Mandarin.',
    quotes: [
      '举一反三！Kuasai satu pola kalimat, pahami tiga konteksnya sekaligus.',
      'Ekor kesembilanku berkilau setiap kali kamu menaklukkan pasangan kata yang sering tertukar!',
      'Ingatan yang diuji besok dan lusa jauh lebih kuat daripada membaca sepuluh kali sekaligus.',
    ],
  },
  {
    level: 4,
    id: 'baihu',
    zhName: '星辉白虎',
    pinyin: 'Xīnghuī Báihǔ',
    name: 'Astral White Tiger',
    title: 'Harimau Putih Penjaga Barat',
    element: 'Thunder Steel',
    rarity: 'epic',
    minPower: 900,
    imageSrc: '/beasts/v1/beast-04-baihu.webp',
    accentHex: '#4f46e5',
    lore: 'Harimau putih lapis zirah astral dengan taring petir yang mengoyak lupa dalam ujian aktif.',
    quotes: [
      '百炼成钢！Ingatan sejati ditempa lewat recall tanpa bantuan dan latihan tata bahasa.',
      'Auman petirku menjaga streak belajarmu tetap menyala meski hari sibuk!',
      'Jangan takut salah di Try Out — setiap kesalahan langsung mencatat titik fokus barumu.',
    ],
  },
  {
    level: 5,
    id: 'zhuque',
    zhName: '烈焰朱雀',
    pinyin: 'Lièyàn Zhūquè',
    name: 'Vermilion Phoenix',
    title: 'Burung Api Kebangkitan Selatan',
    element: 'Solar Blaze',
    rarity: 'gold',
    minPower: 1600,
    imageSrc: '/beasts/v1/beast-05-zhuque.webp',
    accentHex: '#d97706',
    lore: 'Phoenix merah-emas yang terlahir kembali lebih megah setiap kali kamu menjaga retensi memori > 85%.',
    quotes: [
      '浴火重生！Kata yang sempat lupa, jika diingat kembali di waktu tepat, akan abadi selamanya.',
      'Sayap emasku membentang lebar saat kartu review-mu bersih dari tumpukan jatuh tempo.',
      'Terus jaga ritme! Sedikit lagi menuju kubah bintang utara Xuanwu.',
    ],
  },
  {
    level: 6,
    id: 'xuanwu',
    zhName: '玄武星龟',
    pinyin: 'Xuánwǔ Xīngguī',
    name: 'Starlight Xuanwu',
    title: 'Kura-Kura & Ular Bintang Utara',
    element: 'Astral Earth',
    rarity: 'gold',
    minPower: 2600,
    imageSrc: '/beasts/v1/beast-06-xuanwu.webp',
    accentHex: '#7c3aed',
    lore: 'Kura-kura bintang lapis baja obsidian & giok yang menopang kokohnya pemahaman HSK tingkat lanjut.',
    quotes: [
      '水滴石穿！Konsistensi harianmu telah menembus batu keras Mandarin!',
      'Perisai bintangku menjaga ratusan kosakata dan struktur gramatika tetap tajam.',
      'Siapkan dirimu: Naga Langit Biru Qinglong sudah mulai menatap dari balik awan.',
    ],
  },
  {
    level: 7,
    id: 'qinglong',
    zhName: '苍穹青龙',
    pinyin: 'Cāngqióng Qīnglóng',
    name: 'Azure Sky Dragon',
    title: 'Naga Giok Penguasa Timur',
    element: 'Storm Azure',
    rarity: 'legendary',
    minPower: 4000,
    imageSrc: '/beasts/v1/beast-07-qinglong.webp',
    accentHex: '#0ea5e9',
    lore: 'Naga langit zamrud-safir penguasa badai & petir bagi penakluk ratusan kata dan ujian HSK.',
    quotes: [
      '飞龙在天！Bahasa Mandarin kini bukan lagi hafalan — ia mengalir bersama napasmu!',
      'Setiap nada, guratan, dan partikel tata bahasa tunduk pada kendalimu.',
      'Satu langkah puncak lagi menuju takhta Tertinggi: 至尊金龙!',
    ],
  },
  {
    level: 8,
    id: 'sovereign',
    zhName: '至尊金龙',
    pinyin: 'Zhìzūn Jīnlóng',
    name: 'Sovereign Golden Dragon',
    title: 'Naga Emas Kekaisaran Abadi',
    element: 'Imperial Cosmos',
    rarity: 'legendary',
    minPower: 6000,
    imageSrc: '/beasts/v1/beast-08-sovereign.webp',
    accentHex: '#eab308',
    lore: 'Wujud paripurna legenda tertinggi Yulu HSK — mahkota emas kosmik dan bola mutiara naga abadi.',
    quotes: [
      '天道酬勤！Ketekunanmu telah mencapai puncak keemasan para master HSK!',
      'Kartu kolektor VMAX & Astral Emperor berdiri sebagai saksi perjalanan disiplinmu.',
      'Pertahankan Api Abadi dan terus pertajam kalimat alami setiap hari!',
    ],
  },
]

export type FlameTier = 'cold' | 'spark' | 'ember' | 'blue' | 'lightning' | 'sovereign'

export interface FlameMeta {
  tier: FlameTier
  label: string
  badge: string
  days: number
}

export interface GamificationVariable {
  key: 'unaided' | 'production' | 'lessons' | 'streak' | 'exam' | 'retention'
  label: string
  zhLabel: string
  valueText: string
  subText: string
  power: number
  ratio: number
}

export interface DailyQuest {
  id: 'daily_cards' | 'daily_unaided' | 'daily_session'
  title: string
  progress: number
  target: number
  done: boolean
  rewardText: string
  action: 'review' | 'learn' | 'exam'
}

export interface BeastEvaluation {
  spiritPower: number
  rawPower: number
  beast: LegendaryBeastTier
  nextBeast: LegendaryBeastTier | null
  level: number
  progressPct: number
  powerToNext: number
  flame: FlameMeta
  retentionPct: number
  retentionMultiplier: number
  retentionLabel: string
  variables: GamificationVariable[]
  quests: DailyQuest[]
  questsDoneCount: number
  unlockedAchievementKeys: string[]
  unlockedStageIds: BeastStageId[]
  metrics: {
    masteredWords: number
    unaidedTotalWords: number
    productionWords: number
    writingWords: number
    wrapsCount: number
    nodesCount: number
    passedExams: number
    cleanGrammarPoints: number
    reviewedCards: number
    overdueCards: number
  }
}

export interface BeastEvaluationInput {
  mastery: Record<string, MasteryRecord>
  cards: Record<string, Card>
  lessonsDone: number[]
  pathDone: Record<string, string[]>
  streak: number
  xp: number
  log: Record<string, { lessons: number; cards: number }>
  history: HistoryEvent[]
  learnerGraph: LearnerGraphState
  todayKey: string
  nowMs: number
}

export function resolveFlameMeta(streak: number): FlameMeta {
  const days = Math.max(0, Math.floor(streak))
  if (days >= 30) {
    return { tier: 'sovereign', label: 'Mahkota Naga Abadi', badge: '👑 30H+', days }
  }
  if (days >= 14) {
    return { tier: 'lightning', label: 'Petir Sembilan Langit', badge: '⚡ 14H+', days }
  }
  if (days >= 7) {
    return { tier: 'blue', label: 'Api Biru Dewa', badge: '💠 7H+', days }
  }
  if (days >= 3) {
    return { tier: 'ember', label: 'Kobaran Disiplin', badge: '🔥 3H+', days }
  }
  if (days >= 1) {
    return { tier: 'spark', label: 'Api Giok Kecil', badge: '✨ 1H+', days }
  }
  return { tier: 'cold', label: 'Mulai Hari 1', badge: '🌱 0H', days: 0 }
}

function startOfDayTimestamp(todayKey: string, nowMs: number): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayKey)
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
    if (!Number.isNaN(dt.getTime())) return dt.getTime()
  }
  const d = new Date(nowMs)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function evaluateBeastProgress(input: BeastEvaluationInput): BeastEvaluation {
  const masteryList = Object.values(input.mastery ?? {})
  const cardsList = Object.values(input.cards ?? {})
  const lessonsDone = Array.isArray(input.lessonsDone) ? input.lessonsDone : []
  const pathEntries = Object.entries(input.pathDone ?? {})
  const history = Array.isArray(input.history) ? input.history : []
  const streak = Math.max(0, Math.floor(input.streak || 0))
  const xp = Math.max(0, Math.floor(input.xp || 0))

  // 1) Unaided vocab recall (true HSK mastery — separated from passive tapping)
  let masteredWords = 0
  let activeUnaidedWords = 0
  let productionWords = 0
  let writingWords = 0
  const todayStartMs = startOfDayTimestamp(input.todayKey, input.nowMs)
  let todayUnaidedWords = 0

  for (const rec of masteryList) {
    if (!rec) continue
    if (rec.state === 'mastered') {
      masteredWords += 1
    } else if (rec.unaidedSuccesses >= 1) {
      activeUnaidedWords += 1
    }
    const recallSucc = rec.modes?.recall?.successes ?? 0
    const writeSucc = rec.modes?.writing?.successes ?? 0
    const speakSucc = rec.modes?.speaking?.successes ?? 0
    if (recallSucc + writeSucc + speakSucc > 0 || rec.unaidedSuccesses >= 2) {
      productionWords += 1
    }
    if (writeSucc > 0) {
      writingWords += 1
    }
    if ((rec.lastPractice ?? 0) >= todayStartMs && rec.unaidedSuccesses >= 1) {
      todayUnaidedWords += 1
    }
  }
  const unaidedTotalWords = masteredWords + activeUnaidedWords
  const var1Power = masteredWords * 30 + activeUnaidedWords * 10

  // 2) Production & Writing Hanzi Recall
  const var2Power = productionWords * 14 + writingWords * 10

  // 3) Lesson Nodes & Chapter Wraps (dedupe lesson wraps cleanly)
  const wrappedLessons = new Set<number>(lessonsDone)
  let nodesCount = 0
  for (const [lessonStr, nodes] of pathEntries) {
    if (!Array.isArray(nodes)) continue
    nodesCount += nodes.length
    const lessonNum = Number(lessonStr)
    if (Number.isFinite(lessonNum) && nodes.includes('wrap')) {
      wrappedLessons.add(lessonNum)
    }
  }
  const wrapsCount = wrappedLessons.size
  const var3Power = wrapsCount * 75 + nodesCount * 12

  // 4) Consistency Flame Streak
  const activeDaysCount = Object.values(input.log ?? {}).filter(
    (entry) => entry && (entry.cards > 0 || entry.lessons > 0),
  ).length
  const flame = resolveFlameMeta(streak)
  const var4Power = streak * 45 + activeDaysCount * 10

  // 5) HSK Mock Exam & Grammar Graph Mastery
  const quizEvents = history.filter((ev) => ev.kind === 'quiz')
  const passedExams = quizEvents.filter(
    (ev) => ev.correct === true || (typeof ev.xp === 'number' && ev.xp >= 75),
  ).length
  const graphNodes = Object.values(input.learnerGraph?.nodes ?? {})
  let cleanGrammarPoints = 0
  let totalGrammarClean = 0
  let totalGrammarStruggle = 0
  for (const node of graphNodes) {
    if (!node || node.kind !== 'grammar_point') continue
    totalGrammarClean += node.cleanCount || 0
    totalGrammarStruggle += node.struggleCount || 0
    if ((node.cleanCount || 0) > (node.struggleCount || 0)) {
      cleanGrammarPoints += 1
    }
  }
  const grammarTotal = totalGrammarClean + totalGrammarStruggle
  const grammarRatio = grammarTotal > 0 ? totalGrammarClean / grammarTotal : 0
  const examPassUnlocked = passedExams >= 1 || (grammarTotal >= 8 && grammarRatio >= 0.75)
  const var5Power = passedExams * 120 + quizEvents.length * 25 + cleanGrammarPoints * 20

  // 6) Memory Retention Health Aura (FSRS due discipline multiplier)
  const reviewedCardsList = cardsList.filter((c) => c && (c.reps > 0 || c.lastReview !== undefined))
  const reviewedCards = reviewedCardsList.length
  const overdueCards = reviewedCardsList.filter((c) => c.due < input.nowMs).length
  let retentionPct = 100
  let retentionMultiplier = 1.0
  let retentionLabel = 'Siap Memulai'
  if (reviewedCards > 0) {
    retentionPct = Math.max(0, Math.min(100, Math.round(((reviewedCards - overdueCards) / reviewedCards) * 100)))
    if (retentionPct >= 85) {
      retentionMultiplier = 1.15
      retentionLabel = 'Aura Giok Murni +15%'
    } else if (retentionPct >= 65) {
      retentionMultiplier = 1.08
      retentionLabel = 'Aura Stabil +8%'
    } else {
      retentionMultiplier = 1.0
      retentionLabel = 'Waktunya Ulasan'
    }
  }

  const rawPower = var1Power + var2Power + var3Power + var4Power + var5Power + Math.floor(xp * 0.25)
  const spiritPower = Math.round(rawPower * retentionMultiplier)
  const retentionBonusPower = Math.max(0, spiritPower - rawPower)

  // Evolve current & next Legendary Beast
  let currentBeast = LEGENDARY_BEASTS[0]
  for (const tier of LEGENDARY_BEASTS) {
    if (spiritPower >= tier.minPower) currentBeast = tier
  }
  const nextBeast =
    currentBeast.level < LEGENDARY_BEASTS.length ? LEGENDARY_BEASTS[currentBeast.level] : null
  const powerToNext = nextBeast ? Math.max(0, nextBeast.minPower - spiritPower) : 0
  let progressPct = 100
  if (nextBeast) {
    const span = Math.max(1, nextBeast.minPower - currentBeast.minPower)
    progressPct = Math.max(0, Math.min(100, Math.round(((spiritPower - currentBeast.minPower) / span) * 100)))
  }

  // Daily Quests
  const todayLog = input.log?.[input.todayKey]
  const todayCards = todayLog?.cards ?? 0
  const todayHistorySessions = history.filter(
    (ev) => ev.t >= todayStartMs && (ev.kind === 'node' || ev.kind === 'quiz'),
  ).length
  const todaySessions = (todayLog?.lessons ?? 0) + todayHistorySessions

  const quests: DailyQuest[] = [
    {
      id: 'daily_cards',
      title: 'Tuntaskan 12 kartu aktif hari ini',
      progress: Math.min(12, todayCards),
      target: 12,
      done: todayCards >= 12,
      rewardText: '+XP & Api Streak',
      action: 'review',
    },
    {
      id: 'daily_unaided',
      title: 'Ingat 5 kata tanpa bantuan hint',
      progress: Math.min(5, todayUnaidedWords),
      target: 5,
      done: todayUnaidedWords >= 5,
      rewardText: '+Spirit Power Murni',
      action: 'review',
    },
    {
      id: 'daily_session',
      title: 'Selesaikan 1 simpul bab / kuis HSK',
      progress: Math.min(1, todaySessions),
      target: 1,
      done: todaySessions >= 1,
      rewardText: '+Kemajuan Bab',
      action: 'learn',
    },
  ]

  // 6 Achievement-Unlocked Card Stages
  const unlockedAchievementKeys: string[] = []
  if (unaidedTotalWords >= 15) unlockedAchievementKeys.push('unaided_15')
  if (streak >= 3) unlockedAchievementKeys.push('streak_3')
  if (wrapsCount >= 3) unlockedAchievementKeys.push('wraps_3')
  if (unaidedTotalWords >= 50) unlockedAchievementKeys.push('unaided_50')
  if (examPassUnlocked) unlockedAchievementKeys.push('exam_pass')
  if (streak >= 7 && unaidedTotalWords >= 100) unlockedAchievementKeys.push('master_100')

  const unlockedSet = new Set<BeastStageId>(FREE_BEAST_STAGE_IDS)
  for (const stage of BEAST_STAGES) {
    if (!stage.achievementKey || unlockedAchievementKeys.includes(stage.achievementKey)) {
      unlockedSet.add(stage.id)
    }
  }

  const variables: GamificationVariable[] = [
    {
      key: 'unaided',
      label: 'Ingatan Murni',
      zhLabel: '纯记忆词',
      valueText: `${masteredWords} kuasai · ${activeUnaidedWords} tumbuh`,
      subText: 'Kata berhasil diingat tanpa hint',
      power: var1Power,
      ratio: Math.min(1, unaidedTotalWords / 150),
    },
    {
      key: 'production',
      label: 'Produksi & Tulis',
      zhLabel: '手写拼读',
      valueText: `${productionWords} aktif · ${writingWords} Hanzi`,
      subText: 'Recall aktif, bicara & menulis',
      power: var2Power,
      ratio: Math.min(1, productionWords / 120),
    },
    {
      key: 'lessons',
      label: 'Simpul & Bab',
      zhLabel: '课程关卡',
      valueText: `${wrapsCount} bab · ${nodesCount} simpul`,
      subText: 'Tuntas jalur 课文 & ringkasan bab',
      power: var3Power,
      ratio: Math.min(1, wrapsCount / 15),
    },
    {
      key: 'streak',
      label: 'Api Konsistensi',
      zhLabel: '连续火焰',
      valueText: `${streak} hari · ${flame.label}`,
      subText: `${activeDaysCount} total hari belajar aktif`,
      power: var4Power,
      ratio: Math.min(1, streak / 30),
    },
    {
      key: 'exam',
      label: 'Ujian & Gramatika',
      zhLabel: '模拟语法',
      valueText: `${passedExams} lulus · ${cleanGrammarPoints} pola`,
      subText: 'Skor tryout ≥ 75% & pola kalimat bersih',
      power: var5Power,
      ratio: Math.min(1, (passedExams * 3 + cleanGrammarPoints) / 20),
    },
    {
      key: 'retention',
      label: 'Kesehatan Retensi',
      zhLabel: '记忆护盾',
      valueText: `${retentionPct}% (${retentionMultiplier.toFixed(2)}×)`,
      subText: reviewedCards > 0 ? `${overdueCards} jatuh tempo / ${reviewedCards} kartu` : 'Mulai kartu FSRS pertamamu',
      power: retentionBonusPower,
      ratio: retentionPct / 100,
    },
  ]

  return {
    spiritPower,
    rawPower,
    beast: currentBeast,
    nextBeast,
    level: currentBeast.level,
    progressPct,
    powerToNext,
    flame,
    retentionPct,
    retentionMultiplier,
    retentionLabel,
    variables,
    quests,
    questsDoneCount: quests.filter((q) => q.done).length,
    unlockedAchievementKeys,
    unlockedStageIds: BEAST_STAGES.filter((s) => unlockedSet.has(s.id)).map((s) => s.id),
    metrics: {
      masteredWords,
      unaidedTotalWords,
      productionWords,
      writingWords,
      wrapsCount,
      nodesCount,
      passedExams,
      cleanGrammarPoints,
      reviewedCards,
      overdueCards,
    },
  }
}
