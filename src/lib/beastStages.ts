// Collector trading-card & UNITE holographic stage backgrounds for Yulu's Legendary Beasts.
// Pure module — zero DOM dependencies so Node tests share it cleanly.

export type BeastRarity = 'rare' | 'epic' | 'gold' | 'legendary'
export type BeastFoilStyle = 'unite' | 'gold' | 'holo' | 'prism'

export type BeastStageId =
  | 'unite-jade'
  | 'sakura-unite'
  | 'gold-imperial'
  | 'vmax-celestial'
  | 'ink-scroll'
  | 'thunder-dojo'
  | 'crimson-lantern'
  | 'jade-palace'
  | 'exam-colosseum'
  | 'astral-emperor'

export type BeastStageMeta = {
  id: BeastStageId
  name: string
  tagline: string
  achievementKey: string | null
  previewGradient: string
  foilGradient: string
  accent: string
  cardCode: string
  rarity: BeastRarity
  foilStyle: BeastFoilStyle
  badgeLabel: string
}

export const BEAST_STORAGE_KEY = 'yulu.beast.v1'
export const DEFAULT_BEAST_STAGE_ID: BeastStageId = 'unite-jade'

export function defaultBeastStageForMember(memberId?: string | null): BeastStageId {
  return memberId === 'renita' ? 'sakura-unite' : 'unite-jade'
}

export const FREE_BEAST_STAGE_IDS: readonly BeastStageId[] = [
  'unite-jade',
  'sakura-unite',
  'gold-imperial',
  'vmax-celestial',
]

export const RARITY_TAG: Record<BeastRarity, string> = {
  rare: 'RARE',
  epic: 'EPIC',
  gold: 'GOLD',
  legendary: 'VMAX',
}

export const BEAST_STAGES: readonly BeastStageMeta[] = [
  {
    id: 'unite-jade',
    name: 'Unite Jade',
    tagline: 'Kartu arena zamrud-kobalt bergaya Pokemon UNITE dengan pola halftone tajam',
    achievementKey: null,
    previewGradient: 'linear-gradient(135deg, #047857 0%, #0d9488 38%, #0284c7 76%, #bae6fd 100%)',
    foilGradient: 'linear-gradient(135deg, #065f46 0%, #10b981 45%, #38bdf8 100%)',
    accent: '#0f766e',
    cardCode: '#01',
    rarity: 'rare',
    foilStyle: 'unite',
    badgeLabel: 'UNITE JADE',
  },
  {
    id: 'sakura-unite',
    name: 'Unite Sakura',
    tagline: 'Kartu arena sakura-merah muda khusus Trainer Renita dengan pola halftone tajam',
    achievementKey: null,
    previewGradient: 'linear-gradient(135deg, #9d174d 0%, #db2777 40%, #f472b6 76%, #fce7f3 100%)',
    foilGradient: 'linear-gradient(135deg, #831843 0%, #ec4899 48%, #fbcfe8 100%)',
    accent: '#be185d',
    cardCode: '#02',
    rarity: 'rare',
    foilStyle: 'unite',
    badgeLabel: 'UNITE SAKURA',
  },
  {
    id: 'gold-imperial',
    name: 'Imperial Gold',
    tagline: 'Kartu logam emas kekaisaran dengan kilau metalik & percikan petir emas',
    achievementKey: null,
    previewGradient: 'linear-gradient(135deg, #92400e 0%, #d97706 38%, #fde047 72%, #fef9c3 100%)',
    foilGradient: 'linear-gradient(135deg, #78350f 0%, #f59e0b 45%, #fef08a 100%)',
    accent: '#b45309',
    cardCode: '#03',
    rarity: 'gold',
    foilStyle: 'gold',
    badgeLabel: 'IMPERIAL GOLD',
  },
  {
    id: 'vmax-celestial',
    name: 'VMAX Celestial',
    tagline: 'Foil pelangi VMAX holografik spektrum penuh bercahaya kosmik',
    achievementKey: null,
    previewGradient:
      'linear-gradient(135deg, #ec4899 0%, #f59e0b 26%, #10b981 52%, #3b82f6 76%, #8b5cf6 100%)',
    foilGradient: 'linear-gradient(135deg, #db2777 0%, #eab308 32%, #06b6d4 66%, #7c3aed 100%)',
    accent: '#6d28d9',
    cardCode: '#04',
    rarity: 'legendary',
    foilStyle: 'prism',
    badgeLabel: 'VMAX CELESTIAL',
  },
  {
    id: 'ink-scroll',
    name: 'Ink Scroll Holo',
    tagline: 'Gulungan tinta giok-safir penakluk 15 kata ingatan murni tanpa bantuan',
    achievementKey: 'unaided_15',
    previewGradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 48%, #7dd3fc 100%)',
    foilGradient: 'linear-gradient(135deg, #1e40af 0%, #38bdf8 55%, #e0f2fe 100%)',
    accent: '#1d4ed8',
    cardCode: '#05',
    rarity: 'rare',
    foilStyle: 'holo',
    badgeLabel: 'INK SCROLL',
  },
  {
    id: 'thunder-dojo',
    name: 'Thunder Dojo',
    tagline: 'Aura dojo petir emas hasil konsistensi streak belajar 3 hari berturut-turut',
    achievementKey: 'streak_3',
    previewGradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 46%, #fde047 100%)',
    foilGradient: 'linear-gradient(135deg, #9a3412 0%, #fb923c 50%, #fef08a 100%)',
    accent: '#c2410c',
    cardCode: '#06',
    rarity: 'epic',
    foilStyle: 'gold',
    badgeLabel: 'THUNDER DOJO',
  },
  {
    id: 'crimson-lantern',
    name: 'Crimson Lantern',
    tagline: 'Lentera merah merona penanda tuntasnya 3 bab pelajaran penuh',
    achievementKey: 'wraps_3',
    previewGradient: 'linear-gradient(135deg, #881337 0%, #e11d48 50%, #fda4af 100%)',
    foilGradient: 'linear-gradient(135deg, #9f1239 0%, #f43f5e 52%, #fecdd3 100%)',
    accent: '#be123c',
    cardCode: '#07',
    rarity: 'epic',
    foilStyle: 'unite',
    badgeLabel: 'CRIMSON LANTERN',
  },
  {
    id: 'jade-palace',
    name: 'Jade Palace',
    tagline: 'Istana giok berkilau penjaga 50 kosakata Mandarin ingatan murni',
    achievementKey: 'unaided_50',
    previewGradient: 'linear-gradient(135deg, #064e3b 0%, #059669 45%, #5eead4 100%)',
    foilGradient: 'linear-gradient(135deg, #065f46 0%, #10b981 50%, #99f6e4 100%)',
    accent: '#047857',
    cardCode: '#08',
    rarity: 'gold',
    foilStyle: 'holo',
    badgeLabel: 'JADE PALACE',
  },
  {
    id: 'exam-colosseum',
    name: 'Exam Colosseum',
    tagline: 'Kartu kejayaan emas bagi penakluk Simulasi Ujian HSK dengan skor ≥ 75%',
    achievementKey: 'exam_pass',
    previewGradient: 'linear-gradient(135deg, #713f12 0%, #eab308 48%, #fef08a 100%)',
    foilGradient: 'linear-gradient(135deg, #854d0e 0%, #facc15 50%, #fef9c3 100%)',
    accent: '#a16207',
    cardCode: '#09',
    rarity: 'gold',
    foilStyle: 'gold',
    badgeLabel: 'EXAM COLOSSEUM',
  },
  {
    id: 'astral-emperor',
    name: 'Astral Emperor',
    tagline: 'Foil Kaisar Bintang tertinggi: 7 hari streak beruntun & 100 kata dikuasai',
    achievementKey: 'master_100',
    previewGradient: 'linear-gradient(135deg, #312e81 0%, #7c3aed 45%, #f472b6 78%, #fde047 100%)',
    foilGradient: 'linear-gradient(135deg, #4338ca 0%, #a855f7 45%, #f59e0b 100%)',
    accent: '#5b21b6',
    cardCode: '#10',
    rarity: 'legendary',
    foilStyle: 'prism',
    badgeLabel: 'ASTRAL EMPEROR',
  },
]

const BY_ID = new Map(BEAST_STAGES.map((s) => [s.id, s]))

export function isBeastStageId(v: unknown): v is BeastStageId {
  return typeof v === 'string' && BY_ID.has(v as BeastStageId)
}

export function getBeastStage(id: unknown): BeastStageMeta {
  return (isBeastStageId(id) ? BY_ID.get(id) : undefined) ?? BEAST_STAGES[0]
}
