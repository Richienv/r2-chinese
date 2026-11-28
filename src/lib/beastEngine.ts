// HSK 6-Variable Gamification & 24-Level (8 Species × 3 Stages: Bayi -> Matang -> Dewa)
// Dual-Track Evolution Engine for Trainer Richie (HSK 4) & Trainer Renita (HSK 1 Dari Nol).
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
import { HSK1_WORD_SET } from './renitaIsolation.ts'
import type { Card } from './srs.ts'

export type BeastTrack = 'hsk4' | 'hsk1'
export type EvolutionStage = 'bayi' | 'matang' | 'dewa'

export type BeastId =
  | 'qilin_bayi'
  | 'qilin_matang'
  | 'qilin_dewa'
  | 'fox_bayi'
  | 'fox_matang'
  | 'fox_dewa'
  | 'baihu_bayi'
  | 'baihu_matang'
  | 'baihu_dewa'
  | 'phoenix_bayi'
  | 'phoenix_matang'
  | 'phoenix_dewa'
  | 'koi_bayi'
  | 'koi_matang'
  | 'koi_dewa'
  | 'xuanwu_bayi'
  | 'xuanwu_matang'
  | 'xuanwu_dewa'
  | 'qinglong_bayi'
  | 'qinglong_matang'
  | 'qinglong_dewa'
  | 'sovereign_bayi'
  | 'sovereign_matang'
  | 'sovereign_dewa'

export interface LegendaryBeastTier {
  level: number
  id: BeastId
  speciesIndex: number
  speciesId: string
  speciesName: string
  speciesZh: string
  stage: EvolutionStage
  stageLabel: 'Bayi' | 'Matang' | 'Dewa'
  zhName: string
  pinyin: string
  name: string
  title: string
  trainerTitle: string
  trainerOutfit: string
  trainerAccessory: string
  element: string
  rarity: BeastRarity
  minPower: number
  minPowerByTrack: Record<BeastTrack, number>
  imageSrc: string
  imageByMember: Record<'richie' | 'renita', string>
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

interface CycleDefinition {
  speciesIndex: number
  speciesId: string
  speciesZh: string
  pinyin: string
  speciesName: string
  element: string
  accentHex: string
  lore: string
  stages: {
    bayi: {
      zhName: string
      name: string
      title: string
      trainerTitle: string
      trainerOutfit: string
      trainerAccessory: string
      quotes: readonly string[]
    }
    matang: {
      zhName: string
      name: string
      title: string
      trainerTitle: string
      trainerOutfit: string
      trainerAccessory: string
      quotes: readonly string[]
    }
    dewa: {
      zhName: string
      name: string
      title: string
      trainerTitle: string
      trainerOutfit: string
      trainerAccessory: string
      quotes: readonly string[]
    }
  }
}

const CYCLES: readonly CycleDefinition[] = [
  {
    speciesIndex: 1,
    speciesId: 'qilin',
    speciesZh: '玉麒麟',
    pinyin: 'Yù Qílín',
    speciesName: 'Jade Qilin',
    element: 'Jade Spirit',
    accentHex: '#0f766e',
    lore: 'Siklus 1 · Roh Qilin Giok pembawa langkah awal penguasaan nyata.',
    stages: {
      bayi: {
        zhName: '玉麟幼仔',
        name: 'Baby Jade Qilin',
        title: 'Wujud Bayi · Siklus 1',
        trainerTitle: 'Rookie Scholar',
        trainerOutfit: 'Jaket Kasual Giok',
        trainerAccessory: 'Anting Giok & Kacamata Bulat',
        quotes: [
          '千里之行，始于足下！Mulai kuasai kata pertamamu lewat recall aktif hari ini!',
          'Aku masih wujud bayi — capai target master nyata untuk membangkitkan wujud Matang!',
        ],
      },
      matang: {
        zhName: '战甲玉麒',
        name: 'Armored Jade Qilin',
        title: 'Wujud Matang · Siklus 1',
        trainerTitle: 'Jade Adept Trainer',
        trainerOutfit: 'Mantel Giok Berlapis',
        trainerAccessory: 'Charm Kacamata + Gelang Giok',
        quotes: [
          '温故而知新！Ingatan aktifmu sudah jauh lebih tajam dari sekadar membaca!',
          'Sedikit lagi menuju wujud Dewa Siklus 1 sebelum berganti pasangan baru!',
        ],
      },
      dewa: {
        zhName: '天尊玉麟',
        name: 'Celestial Jade Qilin',
        title: 'Wujud Dewa · Siklus 1',
        trainerTitle: 'Jade Envoy',
        trainerOutfit: 'Jubah Sarjana Giok Bersinar',
        trainerAccessory: 'Mahkota Halo Giok & Ujung Rambut Zamrud',
        quotes: [
          'Puncak Wujud Dewa Siklus 1 tercapai! Setelah ini petualangan membuka sahabat Siklus 2!',
          'Tanduk kristal giokku bersinar terang sebagai bukti fondasi Mandarinmu!',
        ],
      },
    },
  },
  {
    speciesIndex: 2,
    speciesId: 'fox',
    speciesZh: '九尾灵狐',
    pinyin: 'Jiǔwěi Línghú',
    speciesName: 'Astral Nine-Tail Fox',
    element: 'Astral Illusion',
    accentHex: '#6366f1',
    lore: 'Siklus 2 · Rubah bintang sembilan ekor penajam beda kata mirip.',
    stages: {
      bayi: {
        zhName: '星狐宝宝',
        name: 'Baby Spirit Fox',
        title: 'Wujud Bayi · Siklus 2',
        trainerTitle: 'Starlit Traveller',
        trainerOutfit: 'Capelet Berlapis Indigo-Sakura',
        trainerAccessory: 'Topi Baret Bintang & Ear-Cuff Perak',
        quotes: [
          'Rubah baru lahir di sisimu! Mari taklukkan lebih banyak kuis tanpa bantuan hint.',
          'Desain baret dan ear-cuff baruku siap menemani siklus kedua ini!',
        ],
      },
      matang: {
        zhName: '五尾星狐',
        name: 'Astral 5-Tail Fox',
        title: 'Wujud Matang · Siklus 2',
        trainerTitle: 'Astral Tactician',
        trainerOutfit: 'Mantel Bintang Pita Perak',
        trainerAccessory: 'Baret Kristal + Highlight Rambut Lavender',
        quotes: [
          '举一反三！Lima ekorku sudah tumbuh seiring bertambahnya kosakata murnimu!',
          'Ayo jaga streak harian agar wujud Dewa 9-Ekor segera turun ke arena!',
        ],
      },
      dewa: {
        zhName: '九尾星神',
        name: '9-Tail Celestial Fox',
        title: 'Wujud Dewa · Siklus 2',
        trainerTitle: 'Arch-Astrologer',
        trainerOutfit: 'Kimono-Trench Pita Kosmik',
        trainerAccessory: 'Topi Kompas Bintang & Mata Ungu Bercahaya',
        quotes: [
          'Kesembilan ekor astral terbuka penuh! Kamu sudah melewati dua siklus evolusi penuh!',
          'Berikutnya: kebangkitan Macan Petir Putih Baihu di Siklus 3!',
        ],
      },
    },
  },
  {
    speciesIndex: 3,
    speciesId: 'baihu',
    speciesZh: '星辉白虎',
    pinyin: 'Xīnghuī Báihǔ',
    speciesName: 'Thunder White Tiger',
    element: 'Thunder Steel',
    accentHex: '#eab308',
    lore: 'Siklus 3 · Harimau petir barat penempa kecepatan recall aktif.',
    stages: {
      bayi: {
        zhName: '雷虎幼崽',
        name: 'Spark Tiger Cub',
        title: 'Wujud Bayi · Siklus 3',
        trainerTitle: 'Volt Striker',
        trainerOutfit: 'Windbreaker Taktis Kobalt-Emas',
        trainerAccessory: 'Visor Kuning & Anting Rumbai Petir',
        quotes: [
          'Anak macan petir siap berlari! Latih kecepatan mengingat kata kerja dan benda.',
          'Visor petir ini aktif tiap kali kamu menuntaskan sesi tanpa menyerah!',
        ],
      },
      matang: {
        zhName: '雷铠白虎',
        name: 'Storm-Armored Tiger',
        title: 'Wujud Matang · Siklus 3',
        trainerTitle: 'Storm Marshal',
        trainerOutfit: 'Trench Coat Zirah Bahu Emas',
        trainerAccessory: 'Half-Visor Menyala & Ujung Rambut Emas',
        quotes: [
          'Zirah petir terkunci! Jawabanmu di Active Recall makin jarang ragu.',
          'Tinggal satu lompatan menuju Dewa Harimau Petir!',
        ],
      },
      dewa: {
        zhName: '雷皇白虎',
        name: 'Thunder Emperor Baihu',
        title: 'Wujud Dewa · Siklus 3',
        trainerTitle: 'Electro Archon',
        trainerOutfit: 'Jubah Perang Listrik Berkilat',
        trainerAccessory: 'Pupil Amber Menyala & Lingkar Petir',
        quotes: [
          'Auman Kaisar Petir menggema! Tujuh besar siklus berikutnya menunggu di depan!',
          'Jangan lupa kirim semangat ke pasanganmu supaya ikut naik level!',
        ],
      },
    },
  },
  {
    speciesIndex: 4,
    speciesId: 'phoenix',
    speciesZh: '烈焰朱雀',
    pinyin: 'Lièyàn Zhūquè',
    speciesName: 'Vermilion Phoenix',
    element: 'Solar Blaze',
    accentHex: '#e11d48',
    lore: 'Siklus 4 · Phoenix matahari simbol kebangkitan retensi ingatan.',
    stages: {
      bayi: {
        zhName: '火雀雏鸟',
        name: 'Ember Phoenix Chick',
        title: 'Wujud Bayi · Siklus 4',
        trainerTitle: 'Flame Apprentice',
        trainerOutfit: 'Haori Merah-Gading Modern',
        trainerAccessory: 'Jepit Bulu Phoenix & Anting Rubi',
        quotes: [
          'Cicit api kecil menyala! Kata yang dulu lupa kini hidup kembali lewat FSRS.',
          'Jaga kartu review jatuh tempo tetap bersih supaya retensi tetap hijau!',
        ],
      },
      matang: {
        zhName: '炽翼朱雀',
        name: 'Blazing Sunbird',
        title: 'Wujud Matang · Siklus 4',
        trainerTitle: 'Vermilion Duelist',
        trainerOutfit: 'Mantel Brokat Merah-Emas',
        trainerAccessory: 'Pin Api Emas & Rambut Gradasi Senja',
        quotes: [
          'Sayap api mengembang! Kemampuan menyusun kalimat alamimu terasa jauh lebih luwes.',
          'Bersiaplah menyaksikan kebangkitan Nirvana Phoenix!',
        ],
      },
      dewa: {
        zhName: '涅槃凤皇',
        name: 'Nirvana Solar Fenghuang',
        title: 'Wujud Dewa · Siklus 4',
        trainerTitle: 'Solar Demi-God',
        trainerOutfit: 'Busana Dewa Api Pita Sutra',
        trainerAccessory: 'Circlet Matahari & Mata Rubi Menyala',
        quotes: [
          '浴火重生！Kebangkitan Maharani Phoenix menandai separuh puncak perjalananmu!',
          'Kostum semi-dewa ini hanya terbuka bagi pelajar berdisiplin tinggi!',
        ],
      },
    },
  },
  {
    speciesIndex: 5,
    speciesId: 'koi',
    speciesZh: '沧海蛟龙',
    pinyin: 'Cānghǎi Jiāolóng',
    speciesName: 'Abyssal Dragon-Koi',
    element: 'Hydro Tide',
    accentHex: '#0284c7',
    lore: 'Siklus 5 · Naga koi samudra penjaga kelancaran bacaan & dialog.',
    stages: {
      bayi: {
        zhName: '碧海锦鲤',
        name: 'Baby Hydro Koi',
        title: 'Wujud Bayi · Siklus 5',
        trainerTitle: 'Tide Navigator',
        trainerOutfit: 'Jas Laksamana Safir-Aqua',
        trainerAccessory: 'Monokel Kristal & Anting Mutiara',
        quotes: [
          'Koi giok berenang lincah! Mulailah membiasakan membaca dialog panjang.',
          'Monokel safir siap mengintai kesalahan partikel dan nada!',
        ],
      },
      matang: {
        zhName: '澜涛蛟龙',
        name: 'Ocean Tide Jiaolong',
        title: 'Wujud Matang · Siklus 5',
        trainerTitle: 'Hydro Commander',
        trainerOutfit: 'Jubah Panjang Gelombang Sutra',
        trainerAccessory: 'Topi Laksamana Safir & Rambut Biru Es',
        quotes: [
          'Arus samudra mengikuti kalimatmu! Dialog Mandarin terasa makin mengalir.',
          'Terus tambah kosakata terkuasai penuh menuju Naga Samudra!',
        ],
      },
      dewa: {
        zhName: '沧渊龙尊',
        name: 'Abyssal Dragon Sovereign',
        title: 'Wujud Dewa · Siklus 5',
        trainerTitle: 'Hydro Archon',
        trainerOutfit: 'Vestmen Dewa Air Pita Ombak',
        trainerAccessory: 'Pupil Aqua Bercahaya & Rambut Perak-Biru',
        quotes: [
          'Penguasa Samudra hadir! Lima siklus evolusi penuh sudah di dalam genggamanmu!',
          'Berikutnya kita memasuki konstelasi bintang bersama Xuanwu!',
        ],
      },
    },
  },
  {
    speciesIndex: 6,
    speciesId: 'xuanwu',
    speciesZh: '玄武星龟',
    pinyin: 'Xuánwǔ Xīngguī',
    speciesName: 'Nebula Xuanwu',
    element: 'Astral Earth',
    accentHex: '#7c3aed',
    lore: 'Siklus 6 · Perisai bintang utara penopang ratusan struktur HSK.',
    stages: {
      bayi: {
        zhName: '星壳幼玄',
        name: 'Baby Starlight Xuanwu',
        title: 'Wujud Bayi · Siklus 6',
        trainerTitle: 'Star Seeker',
        trainerOutfit: 'Velvet Coat Astronom Ungu',
        trainerAccessory: 'Topi Penyihir Lebar & Anting Bulan Sabit',
        quotes: [
          'Kura-kura bintang kecil membawa perisai memori barumu!',
          'Cek grafik jenis kata di halaman Progress untuk melihat bagian mana yang perlu dipoles.',
        ],
      },
      matang: {
        zhName: '星阵玄武',
        name: 'Constellation Xuanwu',
        title: 'Wujud Matang · Siklus 6',
        trainerTitle: 'Astral Warden',
        trainerOutfit: 'Mantel Peta Bintang & Cincin Astrolab',
        trainerAccessory: 'Topi Bintang Kristal & Ujung Rambut Nebula',
        quotes: [
          'Peta rasi bintang terbuka! Ketahanan ingatan jangka panjangmu sudah luar biasa.',
          'Selangkah lagi menuju Pelindung Galaksi Xuanwu!',
        ],
      },
      dewa: {
        zhName: '银河玄尊',
        name: 'Galaxy Guardian Xuanwu',
        title: 'Wujud Dewa · Siklus 6',
        trainerTitle: 'Cosmic Oracle',
        trainerOutfit: 'Jubah Peramal Kosmik Semi-Dewa',
        trainerAccessory: 'Topi Kerudung Nebula & Halo Rasi Bintang',
        quotes: [
          'Kubah galaksi berpendar! Tinggal dua siklus legenda naga tertinggi tersisa!',
          'Ketekunan kalian berdua di Yulu benar-benar mengagumkan.',
        ],
      },
    },
  },
  {
    speciesIndex: 7,
    speciesId: 'qinglong',
    speciesZh: '苍穹青龙',
    pinyin: 'Cāngqióng Qīnglóng',
    speciesName: 'Storm Sky Dragon',
    element: 'Sky Azure',
    accentHex: '#0ea5e9',
    lore: 'Siklus 7 · Naga biru penguasa angin timur dan kefasihan alami.',
    stages: {
      bayi: {
        zhName: '青云小龙',
        name: 'Baby Sky Dragonling',
        title: 'Wujud Bayi · Siklus 7',
        trainerTitle: 'Skyborne Adept',
        trainerOutfit: 'Zirah Angin Putih-Sian Semi-Dewa',
        trainerAccessory: 'Anting Kristal Langit & Rambut Sian Panjang',
        quotes: [
          'Naga langit kecil melingkar di bahumu! Kefasihanmu sudah memasuki tingkat elit.',
          'Rambut dan aura trainermu kini resmi bertransformasi menuju semi-dewa!',
        ],
      },
      matang: {
        zhName: '御风青龙',
        name: 'Winged Cloud Qinglong',
        title: 'Wujud Matang · Siklus 7',
        trainerTitle: 'Cloud Templar',
        trainerOutfit: 'Mantel Templar Awan Filigri Perak',
        trainerAccessory: 'Halo Giok Mengambang & Rambut Putih-Teal',
        quotes: [
          'Naga sayap awan melesat cepat! Soal tata bahasa kompleks kini terasa natural.',
          'Satu langkah menuju Naga Penguasa Sembilan Langit!',
        ],
      },
      dewa: {
        zhName: '九天青帝',
        name: 'Nine-Heavens Dragon',
        title: 'Wujud Dewa · Siklus 7',
        trainerTitle: 'Sky Demi-God',
        trainerOutfit: 'Busana Perang Dewa Langit Bersayap Sutra',
        trainerAccessory: 'Mahkota Circlet Giok-Emas & Mata Sian Menyala',
        quotes: [
          '飞龙在天！Naga langit sembilan penjuru tunduk bersama kefasihanmu!',
          'SIKLUS TERAKHIR (Lv 22–24): Naga Kaisar Kosmik sudah menunggu!',
        ],
      },
    },
  },
  {
    speciesIndex: 8,
    speciesId: 'sovereign',
    speciesZh: '至尊金龙',
    pinyin: 'Zhìzūn Jīnlóng',
    speciesName: 'Imperial Sovereign Dragon',
    element: 'Imperial Cosmos',
    accentHex: '#f59e0b',
    lore: 'Siklus 8 · Puncak paripurna Naga Emas Kekaisaran & Ascended Archon.',
    stages: {
      bayi: {
        zhName: '金辰幼龙',
        name: 'Imperial Hatchling',
        title: 'Wujud Bayi · Siklus 8',
        trainerTitle: 'Celestial Heir',
        trainerOutfit: 'Tunik Kekaisaran Putih-Emas',
        trainerAccessory: 'Klip Mahkota Emas & Anting Berlian',
        quotes: [
          'Telur terakhir telah retak menjadi Kaisar Naga Kecil! Puncak tinggal di depan mata!',
          'Tak banyak yang sanggup menembus siklus ke-8 — pertahankan ritmemu!',
        ],
      },
      matang: {
        zhName: '星耀金龙',
        name: 'Star-Forged Imperial Dragon',
        title: 'Wujud Matang · Siklus 8',
        trainerTitle: 'Celestial Sovereign',
        trainerOutfit: 'Regalia Putih-Emas Bersayap Transparan',
        trainerAccessory: 'Mahkota Tiga Permata & Mata Emas Menyala',
        quotes: [
          'Zirah bintang emas menyelimuti naga & trainer! Tinggal satu tahap terakhir ke Lv 24!',
          'Bersiaplah membuka wujud puncak Agung Sepanjang Masa!',
        ],
      },
      dewa: {
        zhName: '太古金皇龙',
        name: 'Supreme Sovereign Dragon',
        title: 'Wujud Dewa Paripurna · Lv 24',
        trainerTitle: 'Ascended Archon Deity',
        trainerOutfit: 'Zirah Agung Dewa Putih-Emas Prismatik & Sayap Cahaya',
        trainerAccessory: 'Mahkota Kaisar Kosmik, Roda Matahari & Rambut Putih-Emas Mengalir',
        quotes: [
          '天道酬勤！SELAMAT MENAKLUKKAN PUNCAK LEVEL 24 — MASTER SEJATI MANDARIN!',
          'Trainer & Naga telah mencapai wujud Dewa Tertinggi bersama pasangan tercinta!',
        ],
      },
    },
  },
]

const STAGE_ORDER: readonly EvolutionStage[] = ['bayi', 'matang', 'dewa']
const STAGE_LABELS: Record<EvolutionStage, 'Bayi' | 'Matang' | 'Dewa'> = {
  bayi: 'Bayi',
  matang: 'Matang',
  dewa: 'Dewa',
}
const STAGE_RARITY: Record<EvolutionStage, Record<number, BeastRarity>> = {
  bayi: { 1: 'rare', 2: 'rare', 3: 'epic', 4: 'epic', 5: 'gold', 6: 'gold', 7: 'legendary', 8: 'legendary' },
  matang: { 1: 'rare', 2: 'epic', 3: 'epic', 4: 'gold', 5: 'gold', 6: 'legendary', 7: 'legendary', 8: 'legendary' },
  dewa: { 1: 'epic', 2: 'epic', 3: 'gold', 4: 'gold', 5: 'legendary', 6: 'legendary', 7: 'legendary', 8: 'legendary' },
}

const RENITA_TIER_OVERRIDES: Partial<
  Record<
    number,
    Partial<
      Pick<
        LegendaryBeastTier,
        | 'zhName'
        | 'pinyin'
        | 'name'
        | 'title'
        | 'trainerTitle'
        | 'trainerOutfit'
        | 'trainerAccessory'
        | 'element'
        | 'lore'
        | 'quotes'
        | 'accentHex'
        | 'imageSrc'
      >
    >
  >
> = {
  5: {
    zhName: '月辉云兔',
    pinyin: 'Yuèhuī Yúntù',
    name: 'Crescent Cloud Hare',
    title: 'Wujud Matang · Kelinci Awan Bulan',
    trainerTitle: 'Moonlit Blossom Weaver',
    trainerOutfit: 'Jaket Chinoiserie Sakura-Krim & Rok Kelopak Mawar',
    trainerAccessory: 'Kipas Lentera Bulan, Kepang Kembar Sakura & Anting Mutiara',
    element: 'Lunar Blossom',
    accentHex: '#ec4899',
    lore: 'Siklus 2 (Wujud Matang) · Roh Kelinci Awan Bulan penajam ingatan nada & arti HSK 1.',
    quotes: [
      '月满花开！Lentera bulan dan kelinci awan giok menerangi langkahmu di Siklus 2!',
      'Terus kumpulkan XP murni — wujud Dewi Rembulan di Level 6 menunggumu!',
    ],
  },
  6: {
    zhName: '广寒月神兔',
    pinyin: 'Guǎnghán Yuèshén',
    name: 'Celestial Moon Goddess Hare',
    title: 'Wujud Dewa · Dewi Kelinci Rembulan',
    trainerTitle: 'Celestial Moon Empress',
    trainerOutfit: 'Hanfu Dewi Bulan Sakura-Emas & Pita Sutra Melayang',
    trainerAccessory: 'Mahkota Sabit Emas, Ear-Cuff Mutiara & Rambut Ombré Lavender',
    element: 'Celestial Moonlight',
    accentHex: '#db2777',
    lore: 'Siklus 2 (Puncak Dewa) · Dewi Kelinci Rembulan berlingkar sabit emas penguasa penuh Siklus 2.',
    quotes: [
      '明月入怀！Cahaya Dewi Rembulan bersinar penuh — dua siklus evolusi telah terbuka gemilang!',
      'Berikutnya di Level 7: kebangkitan Macan Petir Putih Baihu di Siklus 3!',
    ],
  },
}

const RENITA_ASSET_OVERRIDES: Record<number, string> = {
  5: '/trainers/renita/lv-05-moon.webp',
  6: '/trainers/renita/lv-06-moon.webp',
}

export const LEGENDARY_BEASTS: readonly LegendaryBeastTier[] = CYCLES.flatMap((cyc) =>
  STAGE_ORDER.map((stage, stageOffset) => {
    const level = (cyc.speciesIndex - 1) * 3 + stageOffset + 1
    const lvPad = String(level).padStart(2, '0')
    const st = cyc.stages[stage]
    const renitaImg = RENITA_ASSET_OVERRIDES[level] ?? `/trainers/renita/lv-${lvPad}.webp`
    return {
      level,
      id: `${cyc.speciesId}_${stage}` as BeastId,
      speciesIndex: cyc.speciesIndex,
      speciesId: cyc.speciesId,
      speciesName: cyc.speciesName,
      speciesZh: cyc.speciesZh,
      stage,
      stageLabel: STAGE_LABELS[stage],
      zhName: st.zhName,
      pinyin: cyc.pinyin,
      name: st.name,
      title: st.title,
      trainerTitle: st.trainerTitle,
      trainerOutfit: st.trainerOutfit,
      trainerAccessory: st.trainerAccessory,
      element: cyc.element,
      rarity: STAGE_RARITY[stage][cyc.speciesIndex],
      minPower: HSK4_THRESHOLDS[level - 1],
      minPowerByTrack: {
        hsk4: HSK4_THRESHOLDS[level - 1],
        hsk1: HSK1_THRESHOLDS[level - 1],
      },
      imageSrc: `/trainers/richie/lv-${lvPad}.webp`,
      imageByMember: {
        richie: `/trainers/richie/lv-${lvPad}.webp`,
        renita: renitaImg,
      },
      accentHex: cyc.accentHex,
      lore: cyc.lore,
      quotes: st.quotes,
    }
  }),
)

export function getBeastForMember(
  beast: LegendaryBeastTier,
  memberId: 'richie' | 'renita' = 'richie',
): LegendaryBeastTier {
  if (memberId !== 'renita') return beast
  const ov = RENITA_TIER_OVERRIDES[beast.level]
  if (!ov) return beast
  return { ...beast, ...ov }
}

export function getTrainerAssetSrc(
  beast: LegendaryBeastTier,
  memberId: 'richie' | 'renita' = 'richie',
): string {
  return beast.imageByMember[memberId] ?? beast.imageSrc
}

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
  strokesPassed?: number
  unitsDone: number[]
  provenWords: string[]
  grammarPassed: number
  nodeDone?: Record<string, string[]>
  srsCards?: Record<string, Card>
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
  const hsk1 = input.hsk1Progress ?? {
    tonesPassed: 0,
    pinyinPassed: 0,
    strokesPassed: 0,
    unitsDone: [],
    provenWords: [],
    grammarPassed: 0,
    nodeDone: {},
    srsCards: {},
  }
  const masteryList = Object.entries(input.mastery ?? {})
    .filter(([zh]) => (track === 'hsk1' ? HSK1_WORD_SET.has(zh) : true))
    .map(([, rec]) => rec)
  const cardsList =
    track === 'hsk1'
      ? Object.values({
          ...Object.fromEntries(
            Object.entries(input.cards ?? {}).filter(([zh]) => HSK1_WORD_SET.has(zh)),
          ),
          ...(hsk1.srsCards ?? {}),
        })
      : Object.values(input.cards ?? {})
  const lessonsDone =
    track === 'hsk1' ? [] : Array.isArray(input.lessonsDone) ? input.lessonsDone : []
  const pathEntries =
    track === 'hsk1'
      ? Object.entries(hsk1.nodeDone ?? {})
      : Object.entries(input.pathDone ?? {})
  const rawHistory = Array.isArray(input.history) ? input.history : []
  const history =
    track === 'hsk1' ? rawHistory.filter((ev) => ev && ev.course === 'hsk1') : rawHistory
  const streak = Math.max(0, Math.floor(input.streak || 0))

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

  // 1) Unaided mastery (passive browsing yields ZERO Spirit Power)
  const var1Power =
    track === 'hsk1'
      ? masteredWords * 55 + hsk1ProvenCount * 25 + activeUnaidedWords * 12
      : masteredWords * 40 + activeUnaidedWords * 8

  // 2) Production, Tones/Pinyin/Strokes (HSK 1) & Writing Hanzi (HSK 4)
  const strokesPassed = Math.max(0, hsk1.strokesPassed ?? 0)
  const var2Power =
    track === 'hsk1'
      ? (Math.min(12, hsk1.tonesPassed) + Math.min(10, hsk1.pinyinPassed)) * 65 +
        Math.min(10, strokesPassed) * 55 +
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
    if (track === 'hsk4' && Number.isFinite(lessonNum) && nodes.includes('wrap')) {
      wrappedLessons.add(lessonNum)
    }
  }
  const wrapsCount = wrappedLessons.size + (track === 'hsk1' ? hsk1UnitsDoneCount : 0)
  const var3Power =
    track === 'hsk1'
      ? hsk1UnitsDoneCount * 140 + nodesCount * 20
      : wrappedLessons.size * 120 + nodesCount * 16

  // 4) Consistency Flame Streak
  const hasHsk1Signal =
    track !== 'hsk1' ||
    hsk1UnitsDoneCount > 0 ||
    hsk1ProvenCount > 0 ||
    hsk1.tonesPassed > 0 ||
    hsk1.pinyinPassed > 0 ||
    strokesPassed > 0 ||
    hsk1.grammarPassed > 0 ||
    nodesCount > 0 ||
    cardsList.length > 0 ||
    history.length > 0
  const activeDaysCount = hasHsk1Signal
    ? Object.values(input.log ?? {}).filter((entry) => entry && (entry.cards > 0 || entry.lessons > 0)).length
    : 0
  const effectiveStreak = hasHsk1Signal ? streak : 0
  const flame = resolveFlameMeta(effectiveStreak)
  const var4Power = effectiveStreak * 45 + activeDaysCount * 12

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
    if (track === 'hsk1' && !String(node.id).startsWith('hsk1')) continue
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

  // Evolve current & next across all 24 levels (8 species × 3 stages)
  const memberId: 'richie' | 'renita' = track === 'hsk1' ? 'renita' : 'richie'
  let currentBeastRaw = LEGENDARY_BEASTS[0]
  for (const tier of LEGENDARY_BEASTS) {
    if (spiritPower >= getBeastMinPower(tier, track)) currentBeastRaw = tier
  }
  const nextBeastRaw =
    currentBeastRaw.level < LEGENDARY_BEASTS.length ? LEGENDARY_BEASTS[currentBeastRaw.level] : null
  const currentBeast = getBeastForMember(currentBeastRaw, memberId)
  const nextBeast = nextBeastRaw ? getBeastForMember(nextBeastRaw, memberId) : null
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
            rewardText: '+140 XP Unit',
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
            rewardText: '+XP Murni',
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
      ? 'HSK 1 · Lulus 4 Nada + 6–10 kata → Evolusi Matang'
      : 'HSK 4 · ~50 kata dikuasai + grammar → Evolusi Matang'

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

export interface BeastUnlockDisplay {
  isLocked: boolean
  isMaxLevel: boolean
  isPeekingPast: boolean
  targetLevel: number
  currentXp: number
  targetXp: number
  remainingXp: number
  progressPct: number
  counterLabel: string
  statusTag: string
  headlineSentence: string
  howToEarnTips: ReadonlyArray<{ label: string; reward: string }>
}

/**
 * Single-State Truth formatter for whatever evolution level (`shownBeast`) is on screen.
 * Prevents contradictory copy such as showing "-450 -> Lv 2" beneath a locked Lv 14 preview.
 */
export function describeBeastUnlockState(
  evalRes: BeastEvaluation,
  shownBeast: LegendaryBeastTier,
): BeastUnlockDisplay {
  const fmt = (n: number) => n.toLocaleString('id-ID')
  const currentXp = evalRes.spiritPower
  const avgSessionXp = evalRes.track === 'hsk1' ? 140 : 150

  const howToEarnTips: ReadonlyArray<{ label: string; reward: string }> =
    evalRes.track === 'hsk1'
      ? [
          { label: 'Selesaikan 1 Unit HSK 1', reward: '+140 XP' },
          { label: 'Recall aktif kata tanpa petunjuk', reward: '+25–55 XP / kata' },
          { label: 'Lulus latihan 4 Nada & Pinyin', reward: '+65 XP / soal' },
          { label: 'Jaga streak belajar harian', reward: '+45 XP / hari' },
        ]
      : [
          { label: 'Selesaikan 1 pelajaran HSK 4', reward: '+150 XP' },
          { label: 'Kuasai kosakata lewat Recall murni', reward: '+40 XP / kata' },
          { label: 'Lulus simulasi tryout (>= 75%)', reward: '+250 XP' },
          { label: 'Jaga streak belajar harian', reward: '+45 XP / hari' },
        ]

  // Case 1: Previewing a locked future evolution — always bind bar & text to `shownBeast`.
  if (shownBeast.level > evalRes.level) {
    const targetXp = getBeastMinPower(shownBeast, evalRes.track)
    const remainingXp = Math.max(0, targetXp - currentXp)
    const progressPct = Math.max(0, Math.min(100, Math.round((currentXp / Math.max(1, targetXp)) * 100)))
    return {
      isLocked: true,
      isMaxLevel: false,
      isPeekingPast: false,
      targetLevel: shownBeast.level,
      currentXp,
      targetXp,
      remainingXp,
      progressPct,
      counterLabel: `${fmt(currentXp)} / ${fmt(targetXp)} XP`,
      statusTag: `Terkunci · Lv ${shownBeast.level}`,
      headlineSentence: `Terkunci · Lv ${shownBeast.level} — Butuh ${fmt(remainingXp)} XP lagi (Kamu saat ini Lv ${evalRes.level} · ${fmt(currentXp)} XP)`,
      howToEarnTips,
    }
  }

  // Case 2: All 24 evolutions unlocked.
  if (!evalRes.nextBeast) {
    return {
      isLocked: false,
      isMaxLevel: true,
      isPeekingPast: shownBeast.level < evalRes.level,
      targetLevel: LEGENDARY_BEASTS.length,
      currentXp,
      targetXp: currentXp,
      remainingXp: 0,
      progressPct: 100,
      counterLabel: `${fmt(currentXp)} XP · Puncak Lv 24`,
      statusTag: 'Semua Evolusi Terbuka',
      headlineSentence: 'Seluruh 24 evolusi telah terbuka penuh!',
      howToEarnTips,
    }
  }

  // Case 3: Viewing current unlocked stage (or earlier unlocked stage) while progressing to `nextBeast`.
  const targetLevel = evalRes.nextBeast.level
  const prevThreshold = getBeastMinPower(evalRes.beast, evalRes.track)
  const targetXp = getBeastMinPower(evalRes.nextBeast, evalRes.track)
  const remainingXp = Math.max(0, targetXp - currentXp)
  const span = Math.max(1, targetXp - prevThreshold)
  const progressPct = Math.max(0, Math.min(100, Math.round(((currentXp - prevThreshold) / span) * 100)))
  const estSessions = Math.max(1, Math.ceil(remainingXp / avgSessionXp))
  const isPeekingPast = shownBeast.level < evalRes.level

  return {
    isLocked: false,
    isMaxLevel: false,
    isPeekingPast,
    targetLevel,
    currentXp,
    targetXp,
    remainingXp,
    progressPct,
    counterLabel: `${fmt(currentXp)} / ${fmt(targetXp)} XP`,
    statusTag: isPeekingPast ? `Terbuka · Wujud Lv ${shownBeast.level}` : `Menuju Lv ${targetLevel}`,
    headlineSentence: isPeekingPast
      ? `Wujud Lv ${shownBeast.level} sudah terbuka · Kamu saat ini Lv ${evalRes.level} (${fmt(currentXp)} / ${fmt(targetXp)} XP menuju Lv ${targetLevel})`
      : `Butuh ${fmt(remainingXp)} XP lagi (~${estSessions} sesi belajar) untuk membuka Wujud Lv ${targetLevel}`,
    howToEarnTips,
  }
}
