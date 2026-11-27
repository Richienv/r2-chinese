// HSK 6-Variable Gamification & 24-Stage Dual-Track Legendary Beast Evolution Engine.
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

export type BeastTrack = 'hsk4' | 'hsk1'

export type BeastId =
  | 'egg'
  | 'qilin'
  | 'koi'
  | 'crane'
  | 'rabbit'
  | 'fox'
  | 'deer'
  | 'pixiu'
  | 'monkey'
  | 'baihu'
  | 'baize'
  | 'jiaolong'
  | 'zhuque'
  | 'qingluan'
  | 'fireqilin'
  | 'xuanwu'
  | 'baxia'
  | 'xiezhi'
  | 'dapeng'
  | 'qinglong'
  | 'yinglong'
  | 'zhulong'
  | 'fenghuang'
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
  minPowerByTrack: Record<BeastTrack, number>
  imageSrc: string
  accentHex: string
  lore: string
  quotes: readonly string[]
}

const HSK4_THRESHOLDS = [
  0, 1800, 3200, 4800, 6600, 8600, 10800, 13200, 15800, 18600, 21600, 24800,
  28200, 31800, 35600, 39600, 43800, 48200, 52800, 57600, 62600, 67800, 73200, 79000,
] as const

const HSK1_THRESHOLDS = [
  0, 450, 950, 1500, 2100, 2750, 3450, 4200, 5000, 5850, 6750, 7700,
  8700, 9750, 10850, 12000, 13200, 14450, 15750, 17100, 18500, 19950, 21450, 23000,
] as const

type BeastSeed = Omit<LegendaryBeastTier, 'level' | 'minPower' | 'minPowerByTrack'>

const BEAST_SEEDS: readonly BeastSeed[] = [
  {
    id: 'egg',
    zhName: '灵蛋',
    pinyin: 'Língdàn',
    name: 'Spirit Jade Egg',
    title: 'Benih Naga Giok Awal',
    element: 'Jade Spirit',
    rarity: 'rare',
    imageSrc: '/beasts/v1/beast-01-egg.webp',
    accentHex: '#0f766e',
    lore: 'Telur giok suci yang berdetak saat kosakata dan tata bahasa mulai dikuasai secara nyata.',
    quotes: [
      '千里之行，始于足下！Selesaikan nada dasar atau kuasai kata pertamamu hari ini!',
      'Bukan sekadar melihat sekilas — membuktikan ingatan lewat ujian membuat cangkangku bercahaya.',
      'Pelan tapi pasti setiap hari, dari telur giok kecil kita akan menetas jadi legenda!',
    ],
  },
  {
    id: 'qilin',
    zhName: '玉麒麟',
    pinyin: 'Yù Qílín',
    name: 'Baby Jade Qilin',
    title: 'Penjaga Fondasi Mandarin',
    element: 'Emerald Wind',
    rarity: 'rare',
    imageSrc: '/beasts/v1/beast-02-qilin.webp',
    accentHex: '#059669',
    lore: 'Anak Qilin pembawa berkah yang bangkit saat fondasi nada, kosakata inti, dan kalimat awal teruji.',
    quotes: [
      '温故而知新！Mengulang kata lama di Active Recall membuatku tumbuh paling cepat!',
      'Tanduk giokku menyala tiap kali kamu lolos kuis tanpa menebak atau pakai hint.',
      'Ayo terus kumpulkan penguasaan kata nyata — 22 wujud mitologi berikutnya menantimu!',
    ],
  },
  {
    id: 'koi',
    zhName: '锦鲤灵',
    pinyin: 'Jǐnlǐ Líng',
    name: 'Celestial Jade Koi',
    title: 'Ikan Keberuntungan Giok',
    element: 'Lotus Water',
    rarity: 'rare',
    imageSrc: '/beasts/v1/beast-03-koi.webp',
    accentHex: '#0d9488',
    lore: 'Ikan koi giok bermahkota emas yang melompati gerbang arus bahasa Mandarin dengan lincah.',
    quotes: [
      '鲤鱼跃龙门！Setiap lompatan dari ragu ke yakin mengantarkanmu lebih dekat ke gerbang naga.',
      'Dengarkan intonasi nada secara jernih sebelum memilih — telinga tajam menghemat separuh usaha!',
    ],
  },
  {
    id: 'crane',
    zhName: '仙鹤雏',
    pinyin: 'Xiānhè Chú',
    name: 'Cloud Crane Spirit',
    title: 'Bangau Awan Pengirim Kabar',
    element: 'Sky Feather',
    rarity: 'rare',
    imageSrc: '/beasts/v1/beast-04-crane.webp',
    accentHex: '#0284c7',
    lore: 'Bangau awan bermahkota merah yang membawa kejernihan nada dan ketenangan saat membaca Hanzi.',
    quotes: [
      '鹤立鸡群！Disiplin kecil berdua setiap hari membuat progres kalian tak tertandingi.',
      'Sayapku membentang saat kalimat sederhanamu mulai mengalir natural tanpa terjemahan!',
    ],
  },
  {
    id: 'rabbit',
    zhName: '灵兔月',
    pinyin: 'Língtù Yuè',
    name: 'Moon Jade Rabbit',
    title: 'Kelinci Rembulan Penjaga Kata',
    element: 'Lunar Pearl',
    rarity: 'rare',
    imageSrc: '/beasts/v1/beast-05-rabbit.webp',
    accentHex: '#d97706',
    lore: 'Kelinci putih giok peracik ramuan ingatan di bawah sinar rembulan yang menjaga daya ingat tetap segar.',
    quotes: [
      '月满则亮！Jangan biarkan kartu review menumpuk terlalu lama supaya aura retensimu tetap +15%!',
      'Kirim semangat ke pasanganmu — belajar berdua jauh lebih ringan dan seru!',
    ],
  },
  {
    id: 'fox',
    zhName: '九尾灵狐',
    pinyin: 'Jiǔwěi Línghú',
    name: 'Nine-Tails Spirit Fox',
    title: 'Rubah Api Sembilan Ekor',
    element: 'Celestial Flame',
    rarity: 'epic',
    imageSrc: '/beasts/v1/beast-03-fox.webp',
    accentHex: '#0284c7',
    lore: 'Roh rubah giok-perak cerdas yang piawai membedakan kata-kata mirip dan nuansa konteks kalimat.',
    quotes: [
      '举一反三！Kuasai satu pola tata bahasa, pahami sepuluh kalimat baru sekaligus.',
      'Ekor sembilanku menyala saat kamu menaklukkan pasangan kata yang dulunya sering tertukar!',
    ],
  },
  {
    id: 'deer',
    zhName: '祥云瑞鹿',
    pinyin: 'Xiángyún Ruìlù',
    name: 'Auspicious Cloud Deer',
    title: 'Rusa Sembilan Warna Giok',
    element: 'Prism Silk',
    rarity: 'epic',
    imageSrc: '/beasts/v1/beast-07-deer.webp',
    accentHex: '#7c3aed',
    lore: 'Rusa suci sembilan warna pembawa harmoni yang muncul saat grammar dan kosakata berpadu rapi.',
    quotes: [
      '步步生莲！Setiap unit dan bab yang tuntas menambah cahaya baru pada tandukku.',
      'Susunan kata S + Waktu + Tempat + V adalah kunci keindahan kalimat Mandarin.',
    ],
  },
  {
    id: 'pixiu',
    zhName: '辟邪貔貅',
    pinyin: 'Bìxié Píxiū',
    name: 'Golden Pixiu Guardian',
    title: 'Singa Naga Penarik Harta Ilmu',
    element: 'Imperial Gold',
    rarity: 'epic',
    imageSrc: '/beasts/v1/beast-08-pixiu.webp',
    accentHex: '#b45309',
    lore: 'Penjaga emas kekaisaran yang menelan pengetahuan Mandarin tanpa pernah melepaskannya lagi.',
    quotes: [
      '日进斗金！Setiap kata yang lulus tes aktif menjadi koin emas abadi di ingatanmu.',
      'Tidak apa mengulang kata sulit 3 kali — justru di situlah penguasaan sejati terbentuk!',
    ],
  },
  {
    id: 'monkey',
    zhName: '雷电灵猴',
    pinyin: 'Léidiàn Línghóu',
    name: 'Thunder Spirit Monkey',
    title: 'Kera Petir Penguasa Aksi',
    element: 'Thunder Staff',
    rarity: 'epic',
    imageSrc: '/beasts/v1/beast-09-monkey.webp',
    accentHex: '#eab308',
    lore: 'Kera awan berlapis zirah emas dengan tongkat giok petir yang cekatan menjawab kuis cepat.',
    quotes: [
      '齐天大圣！Kecepatan mengingat lahir dari pemahaman makna dan bunyi sekaligus!',
      'Ayo kalahkan target harian 12 kartu hari ini sebelum malam berakhir!',
    ],
  },
  {
    id: 'baihu',
    zhName: '星辉白虎',
    pinyin: 'Xīnghuī Báihǔ',
    name: 'Astral White Tiger',
    title: 'Harimau Putih Penjaga Barat',
    element: 'Thunder Steel',
    rarity: 'epic',
    imageSrc: '/beasts/v1/beast-04-baihu.webp',
    accentHex: '#4f46e5',
    lore: 'Penguasa barat bermahkota taring petir yang mengoyak lupa dalam sesi recall murni.',
    quotes: [
      '百炼成钢！Ingatan tajam ditempa lewat uji tulis, ucap, dan dengar tanpa bantuan hint.',
      'Streak belajarmu sudah jadi kebiasaan kuat — jaga api ini tetap menyala!',
    ],
  },
  {
    id: 'baize',
    zhName: '霜雪白泽',
    pinyin: 'Shuāngxuě Báizé',
    name: 'Frost Sage Baize',
    title: 'Resi Salju Bermata Tiga',
    element: 'Ice Wisdom',
    rarity: 'gold',
    imageSrc: '/beasts/v1/beast-11-baize.webp',
    accentHex: '#0ea5e9',
    lore: 'Makhluk bijak bermata safir yang mengetahui rahasia 10.000 aksara dan nuansa gramatika halus.',
    quotes: [
      '博学笃志！Mata ketigaku melihat jelas pola pikir Mandarin yang kini mulai alami bagimu.',
      'Bandingkan progresmu bersama pasangan — saling dukung membawa keduanya jauh lebih tinggi!',
    ],
  },
  {
    id: 'jiaolong',
    zhName: '沧海蛟龙',
    pinyin: 'Cānghǎi Jiāolóng',
    name: 'Ocean Flood Dragon',
    title: 'Naga Samudra Penjaga Mutiara',
    element: 'Abyssal Tide',
    rarity: 'gold',
    imageSrc: '/beasts/v1/beast-12-jiaolong.webp',
    accentHex: '#0369a1',
    lore: 'Naga laut giok-safir yang mengumpulkan mutiara dialog alami dan ketepatan bacaan.',
    quotes: [
      '乘风破浪！Kalimat panjang pun kini sanggup kamu baca dengan tenang dan percaya diri.',
      'Terus asah kalimat lisan dan tulisan — mutiara naga sejati lahir dari praktik aktif!',
    ],
  },
  {
    id: 'zhuque',
    zhName: '烈焰朱雀',
    pinyin: 'Lièyàn Zhūquè',
    name: 'Vermilion Phoenix',
    title: 'Burung Api Kebangkitan Selatan',
    element: 'Solar Blaze',
    rarity: 'gold',
    imageSrc: '/beasts/v1/beast-05-zhuque.webp',
    accentHex: '#dc2626',
    lore: 'Phoenix api emas yang terlahir kembali lebih megah setiap kali retensi kata jatuh tempo bersih.',
    quotes: [
      '浴火重生！Kata yang sempat lupa lalu berhasil kamu ingat kembali kini tertanam dua kali lebih kuat!',
      'Kebangkitanmu luar biasa — separuh jalan menuju takhta tertinggi sudah terlewati!',
    ],
  },
  {
    id: 'qingluan',
    zhName: '翠羽青鸾',
    pinyin: 'Cuìyǔ Qīngluán',
    name: 'Emerald Luan Bird',
    title: 'Burung Suci Bulu Zamrud',
    element: 'Jade Plume',
    rarity: 'gold',
    imageSrc: '/beasts/v1/beast-14-qingluan.webp',
    accentHex: '#10b981',
    lore: 'Burung suci kembar keharmonisan melodi bahasa yang hanya menampakkan diri pada pembelajar tekun.',
    quotes: [
      '凤凰于飞！Nada bicara Mandarinmu terdengar makin harmonis dan berirama!',
      'Jangan ragu membaca keras dialog setiap bab untuk melatih otot lidah dan telinga.',
    ],
  },
  {
    id: 'fireqilin',
    zhName: '熔岩火麒',
    pinyin: 'Róngyán Huǒqí',
    name: 'Magma Flame Qilin',
    title: 'Qilin Api Zirah Vulkanik',
    element: 'Molten Gold',
    rarity: 'gold',
    imageSrc: '/beasts/v1/beast-15-fireqilin.webp',
    accentHex: '#ea580c',
    lore: 'Qilin perang berzirah obsidian retakan magma emas, simbol kegigihan menembus ribuan karakter.',
    quotes: [
      '真金不怕火炼！Ujian tata bahasa seberat apa pun tak lagi membuatmu goyah!',
      'Energi tempur HSK-mu membara — sebentar lagi memasuki jajaran empat penjuru tertinggi!',
    ],
  },
  {
    id: 'xuanwu',
    zhName: '玄武星龟',
    pinyin: 'Xuánwǔ Xīngguī',
    name: 'Starlight Xuanwu',
    title: 'Penjaga Bintang Utara Abadi',
    element: 'Astral Earth',
    rarity: 'gold',
    imageSrc: '/beasts/v1/beast-06-xuanwu.webp',
    accentHex: '#6d28d9',
    lore: 'Kura-kura bintang & ular kosmik penjaga utara yang menopang benteng kokoh perbendaharaan HSK.',
    quotes: [
      '水滴石穿！Konsistensi harianmu telah menembus batu keras Mandarin yang dulu terasa mustahil!',
      'Perisai bintangku menjaga ratusan kosakata dan struktur tata bahasa di memorimu.',
    ],
  },
  {
    id: 'baxia',
    zhName: '镇山霸下',
    pinyin: 'Zhènshān Bàxià',
    name: 'Mountain Titan Baxia',
    title: 'Putra Naga Pemikul Prasasti',
    element: 'Titan Jade',
    rarity: 'gold',
    imageSrc: '/beasts/v1/beast-17-baxia.webp',
    accentHex: '#047857',
    lore: 'Putra naga pemikul prasasti aksara kuno yang menjaga rekam jejak panjang setiap bab pelajaran.',
    quotes: [
      '稳如泰山！Fondasi belajarmu sekokoh gunung suci — siap menampung level HSK berikutnya.',
      'Prasasti giok ini mencatat setiap kata yang berhasil kamu taklukkan tanpa hint.',
    ],
  },
  {
    id: 'xiezhi',
    zhName: '紫微獬豸',
    pinyin: 'Zǐwēi Xièzhì',
    name: 'Astral Justice Xiezhi',
    title: 'Tanduk Kebenaran Bintang Ungu',
    element: 'Nebula Horn',
    rarity: 'legendary',
    imageSrc: '/beasts/v1/beast-18-xiezhi.webp',
    accentHex: '#7c3aed',
    lore: 'Makhluk mitologi penegak kebenaran kalimat yang langsung mendeteksi kalimat keliru dalam tryout.',
    quotes: [
      '明察秋毫！Sekilas melihat soal 病句 (kalimat salah), intuisimu langsung menangkap letak kesalahannya!',
      'Bintang ungu bersinar terang saat akurasi ujianmu melampaui 75%!',
    ],
  },
  {
    id: 'dapeng',
    zhName: '九天金鹏',
    pinyin: 'Jiǔtiān Jīnpéng',
    name: 'Golden Roc Dapeng',
    title: 'Rajawali Emas Sembilan Langit',
    element: 'Solar Wing',
    rarity: 'legendary',
    imageSrc: '/beasts/v1/beast-19-dapeng.webp',
    accentHex: '#d97706',
    lore: 'Burung garuda raksasa sayap emas penjelajah cakrawala yang melampaui batas ribuan mil dalam sekali kepak.',
    quotes: [
      '鹏程万里！Masa depan bahasa Mandarinmu terbuka seluas sembilan langit!',
      'Kepakkan sayap bersama pasanganmu dan jadilah inspirasi konsistensi berdua!',
    ],
  },
  {
    id: 'qinglong',
    zhName: '苍穹青龙',
    pinyin: 'Cāngqióng Qīnglóng',
    name: 'Azure Sky Dragon',
    title: 'Naga Giok Penguasa Timur',
    element: 'Storm Azure',
    rarity: 'legendary',
    imageSrc: '/beasts/v1/beast-07-qinglong.webp',
    accentHex: '#0ea5e9',
    lore: 'Naga suci penguasa timur pembawa hujan rahmat kefasihan bacaan, dengar, dan tulis.',
    quotes: [
      '飞龙在天！Bahasa Mandarin kini mengalir alami bersama cara berpikirmu!',
      'Empat langkah tersisa menuju puncak kedaulatan para dewa naga!',
    ],
  },
  {
    id: 'yinglong',
    zhName: '应龙雷尊',
    pinyin: 'Yìnglóng Léizūn',
    name: 'Winged Storm Yinglong',
    title: 'Naga Bersayap Pengendali Badai',
    element: 'Lightning Wing',
    rarity: 'legendary',
    imageSrc: '/beasts/v1/beast-21-yinglong.webp',
    accentHex: '#2563eb',
    lore: 'Naga leluhur bersayap biru kosmik pengendali guntur dan awan hujan.',
    quotes: [
      '风云际会！Kefasihan HSK-mu memanggil badai petir dan awan kejayaan!',
      'Setiap review hari ini menajamkan kendalimu atas kalimat kompleks.',
    ],
  },
  {
    id: 'zhulong',
    zhName: '烛龙星曜',
    pinyin: 'Zhúlóng Xīngyào',
    name: 'Cosmic Torch Zhulong',
    title: 'Naga Obor Matahari & Malam',
    element: 'Solar Starlight',
    rarity: 'legendary',
    imageSrc: '/beasts/v1/beast-22-zhulong.webp',
    accentHex: '#e11d48',
    lore: 'Naga pembawa cahaya bintang dari Gunung Zhong — matanya membuka siang, terpejam menghadirkan malam.',
    quotes: [
      '光照万物！Ketekunanmu menerangi setiap karakter Mandarin yang dulu tampak gelap!',
      'Tinggal dua anak tangga lagi menuju puncak nirwana Phoenix & Naga Kaisar!',
    ],
  },
  {
    id: 'fenghuang',
    zhName: '凤凰涅槃',
    pinyin: 'Fènghuáng Nièpán',
    name: 'Nirvana Solar Fenghuang',
    title: 'Maharani Phoenix Cahaya Surgawi',
    element: 'Rainbow Crown',
    rarity: 'legendary',
    imageSrc: '/beasts/v1/beast-23-fenghuang.webp',
    accentHex: '#db2777',
    lore: 'Maharani segala unggas bercahaya pelangi emas-giok — pertanda sempurnanya harmoni bahasa.',
    quotes: [
      '百鸟朝凤！Keindahan bunyi, aksara, dan tata bahasa menyatu sempurna di tanganmu!',
      'Satu langkah puncak lagi: 至尊金龙 telah menyalakan takhta abadi untukmu!',
    ],
  },
  {
    id: 'sovereign',
    zhName: '至尊金龙',
    pinyin: 'Zhìzūn Jīnlóng',
    name: 'Sovereign Golden Dragon',
    title: 'Naga Emas Kekaisaran Abadi',
    element: 'Imperial Cosmos',
    rarity: 'legendary',
    imageSrc: '/beasts/v1/beast-08-sovereign.webp',
    accentHex: '#eab308',
    lore: 'Wujud paripurna ke-24 — Kaisar Naga Emas kosmik pemegang mutiara penguasaan paripurna.',
    quotes: [
      '天道酬勤！Selamat menaklukkan puncak level 24 — penguasaan penuh dari nol hingga mahir!',
      'Pertahankan Api Abadi dan terus jaga koneksi belajar berdua yang luar biasa ini!',
    ],
  },
]

export const LEGENDARY_BEASTS: readonly LegendaryBeastTier[] = BEAST_SEEDS.map((seed, idx) => ({
  ...seed,
  level: idx + 1,
  minPower: HSK4_THRESHOLDS[idx],
  minPowerByTrack: {
    hsk4: HSK4_THRESHOLDS[idx],
    hsk1: HSK1_THRESHOLDS[idx],
  },
}))

export function getBeastMinPower(beast: LegendaryBeastTier, track: BeastTrack = 'hsk4'): number {
  return beast.minPowerByTrack[track]
}

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

export interface Hsk1ProgressInput {
  tonesPassed: number
  pinyinPassed: number
  unitsDone: number[]
  provenWords: string[]
  grammarPassed: number
}

export interface BeastEvaluation {
  track: BeastTrack
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
  benchmarkHint: string
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
    hsk1ProvenCount: number
    hsk1UnitsDoneCount: number
  }
}

export interface BeastEvaluationInput {
  track?: BeastTrack
  mastery: Record<string, MasteryRecord>
  cards: Record<string, Card>
  lessonsDone: number[]
  pathDone: Record<string, string[]>
  streak: number
  xp: number
  log: Record<string, { lessons: number; cards: number }>
  history: HistoryEvent[]
  learnerGraph: LearnerGraphState
  hsk1Progress?: Hsk1ProgressInput
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
  const track: BeastTrack = input.track === 'hsk1' ? 'hsk1' : 'hsk4'
  const masteryList = Object.values(input.mastery ?? {})
  const cardsList = Object.values(input.cards ?? {})
  const lessonsDone = Array.isArray(input.lessonsDone) ? input.lessonsDone : []
  const pathEntries = Object.entries(input.pathDone ?? {})
  const history = Array.isArray(input.history) ? input.history : []
  const streak = Math.max(0, Math.floor(input.streak || 0))
  const hsk1 = input.hsk1Progress ?? {
    tonesPassed: 0,
    pinyinPassed: 0,
    unitsDone: [],
    provenWords: [],
    grammarPassed: 0,
  }

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

  const hsk1ProvenCount = Array.isArray(hsk1.provenWords) ? new Set(hsk1.provenWords).size : 0
  const hsk1UnitsDoneCount = Array.isArray(hsk1.unitsDone) ? new Set(hsk1.unitsDone).size : 0
  const unaidedTotalWords =
    track === 'hsk1'
      ? Math.max(masteredWords + activeUnaidedWords, hsk1ProvenCount)
      : masteredWords + activeUnaidedWords

  // 1) Unaided mastery (passive exposure yields ZERO Spirit Power)
  const var1Power =
    track === 'hsk1'
      ? masteredWords * 55 + hsk1ProvenCount * 25 + activeUnaidedWords * 12
      : masteredWords * 40 + activeUnaidedWords * 8

  // 2) Production, Tones/Pinyin (HSK 1) & Writing Hanzi (HSK 4)
  const var2Power =
    track === 'hsk1'
      ? (Math.min(12, hsk1.tonesPassed) + Math.min(10, hsk1.pinyinPassed)) * 65 +
        productionWords * 18 +
        writingWords * 14
      : productionWords * 16 + writingWords * 14

  // 3) Lesson Nodes & Unit/Chapter Wraps
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
  const wrapsCount = wrappedLessons.size + (track === 'hsk1' ? hsk1UnitsDoneCount : 0)
  const var3Power =
    track === 'hsk1'
      ? hsk1UnitsDoneCount * 140 + wrappedLessons.size * 120 + nodesCount * 15
      : wrappedLessons.size * 120 + nodesCount * 16

  // 4) Consistency Flame Streak
  const activeDaysCount = Object.values(input.log ?? {}).filter(
    (entry) => entry && (entry.cards > 0 || entry.lessons > 0),
  ).length
  const flame = resolveFlameMeta(streak)
  const var4Power = streak * 45 + activeDaysCount * 12

  // 5) Grammar & Exam Proof
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
  const examPassUnlocked =
    passedExams >= 1 ||
    (grammarTotal >= 8 && grammarRatio >= 0.75) ||
    (track === 'hsk1' && hsk1.grammarPassed >= 10 && hsk1UnitsDoneCount >= 2)
  const var5Power =
    track === 'hsk1'
      ? hsk1.grammarPassed * 35 + cleanGrammarPoints * 30 + passedExams * 180 + quizEvents.length * 25
      : passedExams * 250 + quizEvents.length * 35 + cleanGrammarPoints * 30

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

  const rawPower = var1Power + var2Power + var3Power + var4Power + var5Power
  const spiritPower = Math.round(rawPower * retentionMultiplier)
  const retentionBonusPower = Math.max(0, spiritPower - rawPower)

  // Evolve current & next Legendary Beast across all 24 levels using track-specific scaling
  let currentBeast = LEGENDARY_BEASTS[0]
  for (const tier of LEGENDARY_BEASTS) {
    if (spiritPower >= getBeastMinPower(tier, track)) currentBeast = tier
  }
  const nextBeast =
    currentBeast.level < LEGENDARY_BEASTS.length ? LEGENDARY_BEASTS[currentBeast.level] : null
  const currentThreshold = getBeastMinPower(currentBeast, track)
  const nextThreshold = nextBeast ? getBeastMinPower(nextBeast, track) : currentThreshold
  const powerToNext = nextBeast ? Math.max(0, nextThreshold - spiritPower) : 0
  let progressPct = 100
  if (nextBeast) {
    const span = Math.max(1, nextThreshold - currentThreshold)
    progressPct = Math.max(0, Math.min(100, Math.round(((spiritPower - currentThreshold) / span) * 100)))
  }

  const todayLog = input.log?.[input.todayKey]
  const todayCards = todayLog?.cards ?? 0
  const todayHistorySessions = history.filter(
    (ev) => ev.t >= todayStartMs && (ev.kind === 'node' || ev.kind === 'quiz'),
  ).length
  const todaySessions = (todayLog?.lessons ?? 0) + todayHistorySessions

  const quests: DailyQuest[] =
    track === 'hsk1'
      ? [
          {
            id: 'daily_session',
            title: 'Buka Lab 4 Nada atau 1 Unit HSK 1',
            progress: Math.min(1, todaySessions + (hsk1.tonesPassed > 0 && todayCards > 0 ? 1 : 0)),
            target: 1,
            done: todaySessions >= 1,
            rewardText: '+140 灵力 Unit',
            action: 'learn',
          },
          {
            id: 'daily_unaided',
            title: 'Buktikan 5 kata HSK 1 tanpa bantuan hint',
            progress: Math.min(5, todayUnaidedWords),
            target: 5,
            done: todayUnaidedWords >= 5,
            rewardText: '+Ingatan Murni',
            action: 'review',
          },
          {
            id: 'daily_cards',
            title: 'Tuntaskan 10 kartu latihan hari ini',
            progress: Math.min(10, todayCards),
            target: 10,
            done: todayCards >= 10,
            rewardText: '+Streak Berdua',
            action: 'review',
          },
        ]
      : [
          {
            id: 'daily_cards',
            title: 'Tuntaskan 12 kartu aktif hari ini',
            progress: Math.min(12, todayCards),
            target: 12,
            done: todayCards >= 12,
            rewardText: '+Api Streak',
            action: 'review',
          },
          {
            id: 'daily_unaided',
            title: 'Kuasai / ingat 5 kata tanpa bantuan hint',
            progress: Math.min(5, todayUnaidedWords),
            target: 5,
            done: todayUnaidedWords >= 5,
            rewardText: '+Spirit Power Murni',
            action: 'review',
          },
          {
            id: 'daily_session',
            title: 'Selesaikan 1 simpul bab atau simulasi tryout',
            progress: Math.min(1, todaySessions),
            target: 1,
            done: todaySessions >= 1,
            rewardText: '+Kemajuan Bab',
            action: 'learn',
          },
        ]

  // Achievement-Unlocked Card Stages
  const unlockedAchievementKeys: string[] = []
  if (unaidedTotalWords >= (track === 'hsk1' ? 8 : 15)) unlockedAchievementKeys.push('unaided_15')
  if (streak >= 3) unlockedAchievementKeys.push('streak_3')
  if (wrapsCount >= (track === 'hsk1' ? 2 : 3)) unlockedAchievementKeys.push('wraps_3')
  if (unaidedTotalWords >= (track === 'hsk1' ? 35 : 50)) unlockedAchievementKeys.push('unaided_50')
  if (examPassUnlocked) unlockedAchievementKeys.push('exam_pass')
  if (streak >= 7 && unaidedTotalWords >= (track === 'hsk1' ? 75 : 100)) {
    unlockedAchievementKeys.push('master_100')
  }

  const unlockedSet = new Set<BeastStageId>(FREE_BEAST_STAGE_IDS)
  for (const stage of BEAST_STAGES) {
    if (!stage.achievementKey || unlockedAchievementKeys.includes(stage.achievementKey)) {
      unlockedSet.add(stage.id)
    }
  }

  const variables: GamificationVariable[] =
    track === 'hsk1'
      ? [
          {
            key: 'unaided',
            label: 'Kata Terbukti',
            zhLabel: '纯记基础',
            valueText: `${hsk1ProvenCount} unit HSK 1 · ${masteredWords} kuasai penuh`,
            subText: 'Terbukti lewat dengar & recall aktif',
            power: var1Power,
            ratio: Math.min(1, unaidedTotalWords / 150),
          },
          {
            key: 'production',
            label: '4 Nada & Pinyin',
            zhLabel: '声调拼音',
            valueText: `${hsk1.tonesPassed}/12 nada · ${hsk1.pinyinPassed}/10 pinyin`,
            subText: 'Latihan intonasi & bunyi awal Mandarin',
            power: var2Power,
            ratio: Math.min(1, (hsk1.tonesPassed + hsk1.pinyinPassed) / 22),
          },
          {
            key: 'lessons',
            label: 'Unit HSK 1',
            zhLabel: '零基础单元',
            valueText: `${hsk1UnitsDoneCount}/15 unit · ${nodesCount} simpul`,
            subText: 'Kurikulum 150 kata dasar berurutan',
            power: var3Power,
            ratio: Math.min(1, hsk1UnitsDoneCount / 15),
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
            label: 'Grammar Dasar',
            zhLabel: '基础语法',
            valueText: `${hsk1.grammarPassed} pola lulus · ${cleanGrammarPoints} grafik`,
            subText: 'Kuis tata bahasa 是 / 吗 / 在 / 了',
            power: var5Power,
            ratio: Math.min(1, (hsk1.grammarPassed + cleanGrammarPoints) / 30),
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
      : [
          {
            key: 'unaided',
            label: 'Ingatan Murni (Master)',
            zhLabel: '纯记忆词',
            valueText: `${masteredWords} kuasai penuh · ${activeUnaidedWords} aktif`,
            subText: 'Hanya dihitung dari recall sukses tanpa hint',
            power: var1Power,
            ratio: Math.min(1, masteredWords / 150),
          },
          {
            key: 'production',
            label: 'Produksi & Tulis',
            zhLabel: '手写拼读',
            valueText: `${productionWords} aktif · ${writingWords} Hanzi`,
            subText: 'Recall aktif, bicara & menulis Hanzi',
            power: var2Power,
            ratio: Math.min(1, productionWords / 150),
          },
          {
            key: 'lessons',
            label: 'Simpul & Bab',
            zhLabel: '课程关卡',
            valueText: `${wrappedLessons.size} bab · ${nodesCount} simpul`,
            subText: 'Tuntas jalur 课文 & ringkasan bab',
            power: var3Power,
            ratio: Math.min(1, wrappedLessons.size / 20),
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
            ratio: Math.min(1, (passedExams * 3 + cleanGrammarPoints) / 30),
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

  const benchmarkHint =
    track === 'hsk1'
      ? 'Track HSK 1 Dari Nol · Lulus 4 Nada/Pinyin + 6–10 kata terbukti → Lv 2'
      : 'Track HSK 4 · Kuasai penuh ~50 kata di ujian/recall + grammar → Lv 2'

  return {
    track,
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
    benchmarkHint,
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
      hsk1ProvenCount,
      hsk1UnitsDoneCount,
    },
  }
}
