// Zero-foundation HSK 1 Mandarin curriculum tailored for absolute beginners (Indonesian-first).
// Pure data module — zero DOM dependencies.

export interface Hsk1ToneGuide {
  tone: 1 | 2 | 3 | 4 | 0
  mark: string
  contour: string
  zhName: string
  label: string
  sampleSyllable: string
  sampleZh: string
  sampleMeaning: string
  howTo: string
  colorHex: string
}

export interface Hsk1ToneDrill {
  id: string
  promptAudio: string
  promptHint: string
  targetTone: 1 | 2 | 3 | 4 | 0
  targetPinyin: string
  targetMeaning: string
  options: Array<{ zh: string; pinyin: string; meaning: string; tone: 1 | 2 | 3 | 4 | 0 }>
  answerIndex: number
  explainId: string
}

export interface Hsk1PinyinGroup {
  id: string
  title: string
  category: 'initials' | 'finals' | 'combo'
  symbols: string
  tipId: string
  examples: Array<{ pinyin: string; zh: string; meaning: string }>
}

export interface Hsk1PinyinDrill {
  id: string
  promptAudio: string
  questionId: string
  options: Array<{ pinyin: string; zh: string; meaning: string }>
  answerIndex: number
  explainId: string
}

export interface Hsk1Word {
  zh: string
  pinyin: string
  tones: number[]
  meaningId: string
  literalTip: string
  exampleZh: string
  examplePinyin: string
  exampleId: string
}

export interface Hsk1GrammarQuizItem {
  id: string
  promptId: string
  sentence: string
  options: string[]
  answer: string
  explainId: string
}

export interface Hsk1Unit {
  unit: number
  phase: 1 | 2 | 3 | 4 | 5
  phaseTitle: string
  titleZh: string
  titleId: string
  focusTip: string
  grammar: {
    pattern: string
    titleId: string
    explainId: string
    examples: Array<{ zh: string; pinyin: string; id: string }>
  }
  dialogue: Array<{ speaker: string; zh: string; pinyin: string; id: string }>
  words: Hsk1Word[]
  grammarQuiz: Hsk1GrammarQuizItem[]
}

export const HSK1_TONES: readonly Hsk1ToneGuide[] = [
  {
    tone: 1,
    mark: 'ˉ',
    contour: '55 · Datar Tinggi',
    zhName: '第一声 (平调)',
    label: 'Nada 1 · Datar & Tinggi',
    sampleSyllable: 'mā',
    sampleZh: '妈',
    sampleMeaning: 'ibu',
    howTo: 'Tahan nada suaramu tinggi dan stabil seperti senandung "aaa" yang tidak turun sama sekali.',
    colorHex: '#0f766e',
  },
  {
    tone: 2,
    mark: 'ˊ',
    contour: '35 · Naik Bertanya',
    zhName: '第二声 (升调)',
    label: 'Nada 2 · Naik Tajam',
    sampleSyllable: 'má',
    sampleZh: '麻',
    sampleMeaning: 'rami / kebas',
    howTo: 'Naik cepat dari tengah ke tinggi, persis seperti orang Indonesia kaget bilang "Hah?!" atau "Apa?!"',
    colorHex: '#d97706',
  },
  {
    tone: 3,
    mark: 'ˇ',
    contour: '214 · Rendah Lalu Memantul',
    zhName: '第三声 (曲折调)',
    label: 'Nada 3 · Rendah Menukik',
    sampleSyllable: 'mǎ',
    sampleZh: '马',
    sampleMeaning: 'kuda',
    howTo: 'Turunkan suara serendah mungkin di tenggorokan lalu sedikit memantul. Jika dua Nada 3 bertemu (你好), nada pertama otomatis berubah menjadi Nada 2 (ní hǎo)!',
    colorHex: '#15803d',
  },
  {
    tone: 4,
    mark: 'ˋ',
    contour: '51 · Turun Tegas',
    zhName: '第四声 (去调)',
    label: 'Nada 4 · Jatuh Tegas',
    sampleSyllable: 'mà',
    sampleZh: '骂',
    sampleMeaning: 'memarahi',
    howTo: 'Jatuhkan nada dari paling tinggi ke bawah dengan cepat dan tegas seperti memberi perintah singkat: "Hentikan!"',
    colorHex: '#1d4ed8',
  },
  {
    tone: 0,
    mark: '·',
    contour: 'Ringan & Singkat',
    zhName: '轻声',
    label: 'Nada Netral · Ringan',
    sampleSyllable: 'ma',
    sampleZh: '吗',
    sampleMeaning: 'partikel tanya "kah?"',
    howTo: 'Ucapkan pendek, ringan, tanpa penekanan (seperti suku kata kedua pada 妈妈 māma atau 谢谢 xièxie).',
    colorHex: '#64748b',
  },
]

const STANDARD_TONE_CHOICES: Array<{ zh: string; pinyin: string; meaning: string; tone: 1 | 2 | 3 | 4 }> = [
  { zh: 'Nada 1', pinyin: 'ˉ', meaning: '55', tone: 1 },
  { zh: 'Nada 2', pinyin: 'ˊ', meaning: '35', tone: 2 },
  { zh: 'Nada 3', pinyin: 'ˇ', meaning: '214', tone: 3 },
  { zh: 'Nada 4', pinyin: 'ˋ', meaning: '51', tone: 4 },
]

const NEUTRAL_TONE_CHOICES: Array<{ zh: string; pinyin: string; meaning: string; tone: 1 | 2 | 4 | 0 }> = [
  { zh: 'Nada 1', pinyin: 'ˉ', meaning: '55', tone: 1 },
  { zh: 'Nada 2', pinyin: 'ˊ', meaning: '35', tone: 2 },
  { zh: 'Nada 4', pinyin: 'ˋ', meaning: '51', tone: 4 },
  { zh: 'Nada Netral', pinyin: '·', meaning: 'Ringan', tone: 0 },
]

export const HSK1_TONE_DRILLS: readonly Hsk1ToneDrill[] = [
  {
    id: 'td-1',
    promptAudio: '妈',
    promptHint: 'Dengarkan audio baik-baik. Nada berapa yang kamu dengar?',
    targetTone: 1,
    targetPinyin: 'mā',
    targetMeaning: 'ibu',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 0,
    explainId: '妈 (mā, ibu) memakai Nada 1 (55) yang bertahan datar dan tinggi tanpa goyang.',
  },
  {
    id: 'td-2',
    promptAudio: '麻',
    promptHint: 'Fokus pada ayunan suara audio ini. Nada manakah ini?',
    targetTone: 2,
    targetPinyin: 'má',
    targetMeaning: 'kebas / rami',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 1,
    explainId: '麻 (má, rami/kebas) meluncur naik cepat dari tengah ke atas — Nada 2 (35).',
  },
  {
    id: 'td-3',
    promptAudio: '马',
    promptHint: 'Dengarkan kontur audio berikut. Pilih nada yang sesuai:',
    targetTone: 3,
    targetPinyin: 'mǎ',
    targetMeaning: 'kuda',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 2,
    explainId: '马 (mǎ, kuda) turun ke titik paling rendah di tenggorokan lalu memantul — Nada 3 (214).',
  },
  {
    id: 'td-4',
    promptAudio: '骂',
    promptHint: 'Dengar kata berikut. Pola nada mana yang tepat?',
    targetTone: 4,
    targetPinyin: 'mà',
    targetMeaning: 'memarahi',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 3,
    explainId: '骂 (mà, memarahi) jatuh tajam dari atas ke bawah dengan tegas — Nada 4 (51).',
  },
  {
    id: 'td-5',
    promptAudio: '八',
    promptHint: 'Dengarkan audio dengan saksama. Nada berapa yang diucapkan?',
    targetTone: 1,
    targetPinyin: 'bā',
    targetMeaning: 'delapan',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 0,
    explainId: '八 (bā, delapan) berada di Nada 1 tinggi rata, berbeda dari 爸 (bà, ayah) yang jatuh di Nada 4.',
  },
  {
    id: 'td-6',
    promptAudio: '茶',
    promptHint: 'Simak melodi audio ini dengan teliti. Nada keberapa yang terdengar?',
    targetTone: 2,
    targetPinyin: 'chá',
    targetMeaning: 'teh',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 1,
    explainId: '茶 (chá, teh) naik mantap seperti bertanya "Hah?" — khas Nada 2 (35).',
  },
  {
    id: 'td-7',
    promptAudio: '水',
    promptHint: 'Dengarkan audio ini tanpa melihat teks. Nada manakah ini?',
    targetTone: 3,
    targetPinyin: 'shuǐ',
    targetMeaning: 'air',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 2,
    explainId: '水 (shuǐ, air) berbelok rendah di Nada 3 (214); jangan tertukar dengan 睡 (shuì, tidur) di Nada 4.',
  },
  {
    id: 'td-8',
    promptAudio: '爱',
    promptHint: 'Perhatikan arah suara dari awal ke akhir. Nada apakah ini?',
    targetTone: 4,
    targetPinyin: 'ài',
    targetMeaning: 'cinta / sayang',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 3,
    explainId: '爱 (ài, cinta) turun singkat dan mantap dari puncak ke dasar — Nada 4 (51).',
  },
  {
    id: 'td-9',
    promptAudio: '书',
    promptHint: 'Dengarkan kata berikut dengan teliti. Nada berapa yang kamu dengar?',
    targetTone: 1,
    targetPinyin: 'shū',
    targetMeaning: 'buku',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 0,
    explainId: '书 (shū, buku) meluncur rata di register tinggi — Nada 1 (55).',
  },
  {
    id: 'td-10',
    promptAudio: '十',
    promptHint: 'Amati ujung nada pada kata singkat ini. Nada apakah ini?',
    targetTone: 2,
    targetPinyin: 'shí',
    targetMeaning: 'sepuluh',
    options: STANDARD_TONE_CHOICES,
    answerIndex: 1,
    explainId: '十 (shí, sepuluh) naik tajam di Nada 2 (35), kontras dengan 四 (sì, empat) di Nada 4.',
  },
  {
    id: 'td-11',
    promptAudio: '妈妈',
    promptHint: 'Fokus ke suku kata KEDUA pada audio ini. Nada berapa suku kata terakhirnya?',
    targetTone: 0,
    targetPinyin: 'māma',
    targetMeaning: 'ibu / mama',
    options: NEUTRAL_TONE_CHOICES,
    answerIndex: 3,
    explainId: 'Pada 妈妈 (māma), suku pertama Nada 1 tinggi, lalu suku kedua diucapkan pendek tanpa penekanan (Nada Netral).',
  },
  {
    id: 'td-12',
    promptAudio: '谢谢',
    promptHint: 'Dengar suku kata TERAKHIR audio ini. Pola nada apa yang dipakai?',
    targetTone: 0,
    targetPinyin: 'xièxie',
    targetMeaning: 'terima kasih',
    options: NEUTRAL_TONE_CHOICES,
    answerIndex: 3,
    explainId: '谢谢 (xièxie) turun tegas di suku pertama (xiè) lalu melepas ringan pada suku kedua (xie · Nada Netral).',
  },
]

export const HSK1_PINYIN_GROUPS: readonly Hsk1PinyinGroup[] = [
  {
    id: 'py-aspirated',
    title: 'Hembusan Napas: b/p · d/t · g/k',
    category: 'initials',
    symbols: 'b vs p · d vs t · g vs k',
    tipId: 'Huruf b, d, g di Pinyin TIDAK bergetar keras seperti Indonesia, tetapi TANPA hembusan angin kuat. Sebaliknya, p, t, k harus menghembuskan angin kencang di depan mulut!',
    examples: [
      { pinyin: 'bàba', zh: '爸爸', meaning: 'ayah (b lembut tanpa hembusan)' },
      { pinyin: 'péngyou', zh: '朋友', meaning: 'teman (p dengan hembusan angin)' },
      { pinyin: 'dà / tā', zh: '大 / 他', meaning: 'besar / dia laki-laki' },
    ],
  },
  {
    id: 'py-jqx',
    title: 'Mulut Tersenyum: j · q · x',
    category: 'initials',
    symbols: 'j (ci) · q (chi berangin) · x (si lembut)',
    tipId: 'Posisi lidah di bawah gigi depan dengan bibir agak ditarik seperti tersenyum. Bunyinya jauh lebih halus daripada bahasa Inggris "j/ch/sh".',
    examples: [
      { pinyin: 'jiā', zh: '家', meaning: 'rumah (mendekati "cya")' },
      { pinyin: 'qī', zh: '七', meaning: 'tujuh ("chi" berangin kuat)' },
      { pinyin: 'xiǎo', zh: '小', meaning: 'kecil ("syau" lembut)' },
    ],
  },
  {
    id: 'py-zhchshr',
    title: 'Lidah Digulung ke Atas: zh · ch · sh · r',
    category: 'initials',
    symbols: 'zh · ch · sh · r',
    tipId: 'Tekuk sedikit ujung lidah menyentuh langit-langit atas! Huruf "r" bukan bergetar seperti bahasa Indonesia, melainkan lembut mirip gabungan r dan j di "measure".',
    examples: [
      { pinyin: 'Zhōngguó', zh: '中国', meaning: 'Tiongkok' },
      { pinyin: 'chī', zh: '吃', meaning: 'makan' },
      { pinyin: 'rènshi', zh: '认识', meaning: 'kenal / mengenal' },
    ],
  },
  {
    id: 'py-zcs',
    title: 'Lidah Datar Tajam: z · c · s',
    category: 'initials',
    symbols: 'z ("dz") · c ("ts" berangin) · s ("s")',
    tipId: 'Ujung lidah rata menyentuh belakang gigi depan atas. "c" dibaca "ts" berhembus keras seperti pada "cài (菜)", bukan seperti "c" di kata "cinta"!',
    examples: [
      { pinyin: 'zài', zh: '在', meaning: 'berada di' },
      { pinyin: 'cài', zh: '菜', meaning: 'masakan / sayur ("tsai")' },
      { pinyin: 'sān', zh: '三', meaning: 'tiga' },
    ],
  },
  {
    id: 'py-yu',
    title: 'Vokal Spesial ü (yu)',
    category: 'finals',
    symbols: 'ü · nǚ · lǜ · j/q/x + u (= ü)',
    tipId: 'Ucapkan bunyi "i" dengan mulut membulat seperti mengucapkan "u"! Setelah huruf j, q, x, titik dua di atas u dihilangkan tulisannya (qù 依然 dibaca qǜ).',
    examples: [
      { pinyin: 'nǚ’ér', zh: '女儿', meaning: 'anak perempuan' },
      { pinyin: 'qù', zh: '去', meaning: 'pergi (dibaca chǜ)' },
      { pinyin: 'xuéxí', zh: '学习', meaning: 'belajar (u dibaca ü)' },
    ],
  },
]

export const HSK1_PINYIN_DRILLS: readonly Hsk1PinyinDrill[] = [
  {
    id: 'pd-1',
    promptAudio: '爸',
    questionId: 'Dengarkan konsonan awalnya baik-baik. Pinyin mana yang diucapkan?',
    options: [
      { pinyin: 'pà', zh: '怕', meaning: 'takut (p berangin)' },
      { pinyin: 'bà', zh: '爸', meaning: 'ayah (b lembut tanpa angin)' },
      { pinyin: 'mà', zh: '骂', meaning: 'memarahi (m sengau)' },
    ],
    answerIndex: 1,
    explainId: '爸 (bà) memakai konsonan "b" tanpa hembusan udara kuat, kontras dengan 怕 (pà) yang berhembus.',
  },
  {
    id: 'pd-2',
    promptAudio: '他',
    questionId: 'Simak apakah ada hembusan udara di awal bunyi. Suku kata manakah ini?',
    options: [
      { pinyin: 'dā', zh: '搭', meaning: 'naik (d tanpa angin)' },
      { pinyin: 'bā', zh: '八', meaning: 'delapan (b bibir rapat)' },
      { pinyin: 'tā', zh: '他', meaning: 'dia (t berhembus kuat)' },
    ],
    answerIndex: 2,
    explainId: '他 (tā) melepas udara kuat saat ujung lidah menyentuh belakang gigi atas.',
  },
  {
    id: 'pd-3',
    promptAudio: '七',
    questionId: 'Dengarkan audio dengan teliti. Pinyin mana yang kamu dengar?',
    options: [
      { pinyin: 'jī', zh: '机', meaning: 'mesin (j lembut)' },
      { pinyin: 'qī', zh: '七', meaning: 'tujuh (q berangin)' },
      { pinyin: 'xī', zh: '西', meaning: 'barat (x desis halus)' },
    ],
    answerIndex: 1,
    explainId: '七 (qī) menghembuskan angin kuat dengan bibir tersenyum — bukan "jī" atau "xī".',
  },
  {
    id: 'pd-4',
    promptAudio: '小',
    questionId: 'Fokus pada bunyi awal dengan bibir tersenyum. Pilih Pinyin yang tepat:',
    options: [
      { pinyin: 'xiǎo', zh: '小', meaning: 'kecil (x halus)' },
      { pinyin: 'jiǎo', zh: '角', meaning: 'sudut (j tertutup)' },
      { pinyin: 'qiǎo', zh: '巧', meaning: 'kebetulan (q berangin)' },
    ],
    answerIndex: 0,
    explainId: '小 (xiǎo) mengalir halus seperti "syau" lembut tanpa letupan keras.',
  },
  {
    id: 'pd-5',
    promptAudio: '吃',
    questionId: 'Bedakan konsonan lidah tergulung berikut lewat audio. Pinyin manakah ini?',
    options: [
      { pinyin: 'zhī', zh: '只', meaning: 'ekor · satuan (zh tanpa angin)' },
      { pinyin: 'shī', zh: '师', meaning: 'guru (sh desis panjang)' },
      { pinyin: 'chī', zh: '吃', meaning: 'makan (ch berhembus)' },
    ],
    answerIndex: 2,
    explainId: '吃 (chī) menggulung ujung lidah ke langit-langit atas lalu meletupkan hembusan angin.',
  },
  {
    id: 'pd-6',
    promptAudio: '热',
    questionId: 'Dengarkan konsonan awal audio ini baik-baik. Manakah penulisan Pinyin yang tepat?',
    options: [
      { pinyin: 'zhè', zh: '这', meaning: 'ini (zh tergulung)' },
      { pinyin: 'rè', zh: '热', meaning: 'panas (r halus tanpa getar)' },
      { pinyin: 'lè', zh: '乐', meaning: 'gembira (l ringan)' },
    ],
    answerIndex: 1,
    explainId: '热 (rè) mengangkat ujung lidah dekat langit-langit tanpa getar keras seperti "r" Indonesia.',
  },
  {
    id: 'pd-7',
    promptAudio: '菜',
    questionId: 'Fokus pada ketajaman konsonan awal saat lidah datar. Pinyin mana yang diucapkan?',
    options: [
      { pinyin: 'zài', zh: '在', meaning: 'di / sedang (z tanpa angin)' },
      { pinyin: 'cài', zh: '菜', meaning: 'masakan / sayur (c "ts" berangin)' },
      { pinyin: 'sài', zh: '赛', meaning: 'lomba (s desis bersih)' },
    ],
    answerIndex: 1,
    explainId: '菜 (cài) selalu meletupkan bunyi "ts" yang berhembus udara di depan gigi.',
  },
  {
    id: 'pd-8',
    promptAudio: '四',
    questionId: 'Dengar seksama suara konsonan depannya. Pilih Pinyin yang tepat:',
    options: [
      { pinyin: 'zì', zh: '字', meaning: 'aksara (z letupan halus)' },
      { pinyin: 'cì', zh: '次', meaning: 'kali (c berangin)' },
      { pinyin: 'sì', zh: '四', meaning: 'empat (s desis datar)' },
    ],
    answerIndex: 2,
    explainId: '四 (sì) berupa desis "s" murni dengan lidah datar di belakang gigi seri.',
  },
  {
    id: 'pd-9',
    promptAudio: '女',
    questionId: 'Perhatikan bentuk vokal dan konsonan awal dari audio. Pinyin manakah ini?',
    options: [
      { pinyin: 'nǚ', zh: '女', meaning: 'perempuan (n + vokal bulat ü)' },
      { pinyin: 'lǚ', zh: '旅', meaning: 'wisata (l + ü)' },
      { pinyin: 'nǔ', zh: '努', meaning: 'berusaha keras (n + u)' },
    ],
    answerIndex: 0,
    explainId: '女 (nǚ) memadukan nasal "n" dan vokal bulat "ü" (mulut membulat "u", bunyi mengarah "i").',
  },
  {
    id: 'pd-10',
    promptAudio: '钱',
    questionId: 'Dengarkan kombinasi bunyi awal dan akhiran berikut. Pinyin mana yang kamu dengar?',
    options: [
      { pinyin: 'xián', zh: '闲', meaning: 'santai (x halus)' },
      { pinyin: 'qián', zh: '钱', meaning: 'uang (q berangin + -ian)' },
      { pinyin: 'nián', zh: '年', meaning: 'tahun (n nasal)' },
    ],
    answerIndex: 1,
    explainId: '钱 (qián) meluncur sebagai "chyen" naik di Nada 2 dengan hembusan napas dari "q".',
  },
]

export const HSK1_UNITS: readonly Hsk1Unit[] = [
  {
    unit: 1,
    phase: 1,
    phaseTitle: 'Fase 1 · Nada & Sapaan Dasar',
    titleZh: '问候与礼貌',
    titleId: 'Salam & Sopan Santun Pertama',
    focusTip: 'Fokus mendengarkan naik-turun nada sapaan sehari-hari.',
    grammar: {
      pattern: 'Subjek + 好 / 谢谢 + (Subjek)',
      titleId: 'Menyapa & Mengucapkan Terima Kasih',
      explainId: 'Untuk menyapa seseorang secara sopan, gunakan 您好 (nín hǎo) kepada yang lebih tua atau 你好 (nǐ hǎo) kepada teman.',
      examples: [
        { zh: '你好！', pinyin: 'Nǐ hǎo!', id: 'Halo!' },
        { zh: '谢谢你！', pinyin: 'Xièxie nǐ!', id: 'Terima kasih!' },
        { zh: '没关系。', pinyin: 'Méi guānxi.', id: 'Tidak apa-apa.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '您好！请坐。', pinyin: 'Nín hǎo! Qǐng zuò.', id: 'Halo (sopan)! Silakan duduk.' },
      { speaker: 'B', zh: '谢谢！再见！', pinyin: 'Xièxie! Zàijiàn!', id: 'Terima kasih! Sampai jumpa!' },
    ],
    words: [
      { zh: '好', pinyin: 'hǎo', tones: [3], meaningId: 'baik / bagus / halo', literalTip: 'Aksara perempuan (女) + anak (子) = Harmoni yang baik', exampleZh: '你好！', examplePinyin: 'Nǐ hǎo!', exampleId: 'Halo!' },
      { zh: '谢谢', pinyin: 'xièxie', tones: [4, 0], meaningId: 'terima kasih', literalTip: 'Diucapkan tegas lalu ringan: xiè-xie', exampleZh: '谢谢你！', examplePinyin: 'Xièxie nǐ!', exampleId: 'Terima kasih banyak!' },
      { zh: '不客气', pinyin: 'bú kèqi', tones: [2, 4, 0], meaningId: 'sama-sama / tidak perlu sungkan', literalTip: '不 menjadi Nada 2 (bú) sebelum Nada 4', exampleZh: '谢谢！—不客气！', examplePinyin: 'Xièxie! — Bú kèqi!', exampleId: 'Terima kasih! — Sama-sama!' },
      { zh: '对不起', pinyin: 'duìbuqǐ', tones: [4, 0, 3], meaningId: 'maaf', literalTip: 'Ungkapan resmi & hangat saat meminta maaf', exampleZh: '对不起，我来晚了。', examplePinyin: 'Duìbuqǐ, wǒ lái wǎn le.', exampleId: 'Maaf, saya datang terlambat.' },
      { zh: '没关系', pinyin: 'méi guānxi', tones: [2, 1, 0], meaningId: 'tidak apa-apa', literalTip: 'Pasangan jawaban langsung untuk 对不起', exampleZh: '对不起！—没关系。', examplePinyin: 'Duìbuqǐ! — Méi guānxi.', exampleId: 'Maaf! — Tidak apa-apa.' },
      { zh: '再见', pinyin: 'zàijiàn', tones: [4, 4], meaningId: 'sampai jumpa', literalTip: '再 (lagi) + 见 (bertemu) = bertemu lagi', exampleZh: '明天见，再见！', examplePinyin: 'Míngtiān jiàn, zàijiàn!', exampleId: 'Sampai ketemu besok, dadah!' },
      { zh: '请', pinyin: 'qǐng', tones: [3], meaningId: 'silakan / tolong / mengundang', literalTip: 'Taruh di awal kalimat agar terdengar sopan', exampleZh: '请喝茶。', examplePinyin: 'Qǐng hē chá.', exampleId: 'Silakan minum teh.' },
      { zh: '喂', pinyin: 'wèi', tones: [4], meaningId: 'halo (di telepon) / hei', literalTip: 'Kata pertama saat mengangkat telepon di Tiongkok', exampleZh: '喂，请问你是谁？', examplePinyin: 'Wèi, qǐngwèn nǐ shì shéi?', exampleId: 'Halo, maaf ini dengan siapa ya?' },
      { zh: '您', pinyin: 'nín', tones: [2], meaningId: 'Anda (bentuk sopan)', literalTip: '你 (kamu) ditaruh di atas 心 (hati) = menghormati dalam hati', exampleZh: '您好，老师！', examplePinyin: 'Nín hǎo, lǎoshī!', exampleId: 'Halo, Guru!' },
      { zh: '想', pinyin: 'xiǎng', tones: [3], meaningId: 'ingin / berpikir / merindukan', literalTip: 'Memiliki elemen 心 (hati) di bawah', exampleZh: '我想喝茶。', examplePinyin: 'Wǒ xiǎng hē chá.', exampleId: 'Saya ingin minum teh.' },
    ],
    grammarQuiz: [
      { id: 'u1q1', promptId: 'Bagaimana menjawab sopan saat temanmu bilang "谢谢" (terima kasih)?', sentence: 'A: 谢谢！  B: _____', options: ['不客气', '没关系', '再见'], answer: '不客气', explainId: '不客气 (bú kèqi) berarti sama-sama, sedangkan 没关系 menjawab permintaan maaf.' },
      { id: 'u1q2', promptId: 'Sapaan sopan paling pas kepada guru atau orang yang lebih tua adalah:', sentence: '老师，_____！', options: ['你好吗', '您好', '喂'], answer: '您好', explainId: '您 (nín) adalah versi halus/sopan dari 你 (nǐ).' },
    ],
  },
  {
    unit: 2,
    phase: 1,
    phaseTitle: 'Fase 1 · Nada & Sapaan Dasar',
    titleZh: '认识与自我介绍',
    titleId: 'Perkenalan & Identitas Diri',
    focusTip: 'Kata kerja Mandarin TIDAK berubah bentuk untuk I / you / he / we!',
    grammar: {
      pattern: 'Subjek + 是 / 叫 + Objek',
      titleId: 'Pola Kalimat Inti S + V + O',
      explainId: 'Pola paling penting di Mandarin: Subjek + 是 (adalah) + Identitas, atau Subjek + 叫 (bernama) + Nama.',
      examples: [
        { zh: '我叫Renita。', pinyin: 'Wǒ jiào Renita.', id: 'Nama saya Renita.' },
        { zh: '他不是老师。', pinyin: 'Tā bú shì lǎoshī.', id: 'Dia bukan guru.' },
        { zh: '我们认识他。', pinyin: 'Wǒmen rènshi tā.', id: 'Kami kenal dia.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你好，你叫什么名字？', pinyin: 'Nǐ hǎo, nǐ jiào shénme míngzi?', id: 'Halo, siapa namamu?' },
      { speaker: 'B', zh: '我叫小月，很高兴认识你！', pinyin: 'Wǒ jiào Xiǎoyuè, hěn gāoxìng rènshi nǐ!', id: 'Namaku Xiaoyue, senang berkenalan denganmu!' },
    ],
    words: [
      { zh: '我', pinyin: 'wǒ', tones: [3], meaningId: 'saya / aku', literalTip: 'Kata ganti orang pertama', exampleZh: '我是学生。', examplePinyin: 'Wǒ shì xuésheng.', exampleId: 'Saya adalah murid.' },
      { zh: '你', pinyin: 'nǐ', tones: [3], meaningId: 'kamu', literalTip: 'Orang di kiri (亻) berbicara langsung ke kamu', exampleZh: '你好！', examplePinyin: 'Nǐ hǎo!', exampleId: 'Halo!' },
      { zh: '他', pinyin: 'tā', tones: [1], meaningId: 'dia (laki-laki)', literalTip: 'Radikal manusia (亻), bunyinya sama dengan 她', exampleZh: '他是我朋友。', examplePinyin: 'Tā shì wǒ péngyou.', exampleId: 'Dia teman saya.' },
      { zh: '她', pinyin: 'tā', tones: [1], meaningId: 'dia (perempuan)', literalTip: 'Radikal perempuan (女) di kiri; bunyinya juga tā!', exampleZh: '她叫小丽。', examplePinyin: 'Tā jiào Xiǎolì.', exampleId: 'Dia bernama Xiaoli.' },
      { zh: '我们', pinyin: 'wǒmen', tones: [3, 0], meaningId: 'kami / kita', literalTip: 'Tambahkan 们 setelah kata ganti untuk membuatnya jamak', exampleZh: '我们都是好朋友。', examplePinyin: 'Wǒmen dōu shì hǎo péngyou.', exampleId: 'Kita semua berteman baik.' },
      { zh: '是', pinyin: 'shì', tones: [4], meaningId: 'adalah / iya', literalTip: 'Digunakan untuk identitas kata benda (JANGAN dipakai sebelum kata sifat seperti "cantik")', exampleZh: '我是中国人。', examplePinyin: 'Wǒ shì Zhōngguórén.', exampleId: 'Saya orang Tiongkok.' },
      { zh: '叫', pinyin: 'jiào', tones: [4], meaningId: 'bernama / memanggil', literalTip: 'Ada radikal mulut (口) di kiri karena diucapkan lantang', exampleZh: '你叫什么名字？', examplePinyin: 'Nǐ jiào shénme míngzi?', exampleId: 'Siapa namamu?' },
      { zh: '什么', pinyin: 'shénme', tones: [2, 0], meaningId: 'apa', literalTip: 'Tetap diletakkan di posisi jawaban dalam kalimat tanya', exampleZh: '这是什么？', examplePinyin: 'Zhè shì shénme?', exampleId: 'Ini apa?' },
      { zh: '名字', pinyin: 'míngzi', tones: [2, 0], meaningId: 'nama', literalTip: 'Selalu dipakai bersama 叫: 叫什么名字', exampleZh: '他的名字很好听。', examplePinyin: 'Tā de míngzi hěn hǎotīng.', exampleId: 'Namanya enak didengar.' },
      { zh: '认识', pinyin: 'rènshi', tones: [4, 0], meaningId: 'kenal / mengenal', literalTip: 'Keduanya punya radikal kata-kata (讠)', exampleZh: '很高兴认识你！', examplePinyin: 'Hěn gāoxìng rènshi nǐ!', exampleId: 'Senang berkenalan denganmu!' },
    ],
    grammarQuiz: [
      { id: 'u2q1', promptId: 'Lengkapi kalimat tanya "Siapa namamu?":', sentence: '你叫_____名字？', options: ['什么', '谁', '是'], answer: '什么', explainId: 'Di Mandarin bertanya nama secara literal adalah "Kamu dipanggil apa-nama?" (你叫什么名字？).' },
      { id: 'u2q2', promptId: 'Pilih kata kerja penghubung untuk kalimat identitas "Dia adalah dokter":', sentence: '他_____医生。', options: ['叫', '是', '很'], answer: '是', explainId: '是 menghubungkan subjek dengan kata benda seperti profesi atau kewarganegaraan.' },
    ],
  },
  {
    unit: 3,
    phase: 2,
    phaseTitle: 'Fase 2 · Keluarga, Angka & Kepemilikan',
    titleZh: '家庭与职业',
    titleId: 'Keluarga & Profesi',
    focusTip: 'Panggilan keluarga di Mandarin diulang dua kali agar hangat (bàba, māma).',
    grammar: {
      pattern: 'Negara / Peran + 人',
      titleId: 'Menyatakan Asal & Peran Seseorang',
      explainId: 'Cukup tempelkan 人 (orang) di belakang nama negara, misalnya 中国人 (orang Tiongkok).',
      examples: [
        { zh: '我爸爸是医生。', pinyin: 'Wǒ bàba shì yīshēng.', id: 'Ayahku seorang dokter.' },
        { zh: '她是我女儿。', pinyin: 'Tā shì wǒ nǚ’ér.', id: 'Dia putri saya.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '李先生，他是您的儿子吗？', pinyin: 'Lǐ xiānsheng, tā shì nín de érzi ma?', id: 'Tuan Li, apakah dia putra Anda?' },
      { speaker: 'B', zh: '是的，他是大学生。', pinyin: 'Shì de, tā shì dàxuésheng.', id: 'Benar, dia mahasiswa.' },
    ],
    words: [
      { zh: '人', pinyin: 'rén', tones: [2], meaningId: 'orang / manusia', literalTip: 'Bentuknya mirip dua kaki orang melangkah', exampleZh: '这里有很多人。', examplePinyin: 'Zhèlǐ yǒu hěn duō rén.', exampleId: 'Di sini ada banyak orang.' },
      { zh: '爸爸', pinyin: 'bàba', tones: [4, 0], meaningId: 'ayah / papa', literalTip: 'Nada 4 jatuh diikuti nada netral', exampleZh: '我爸爸在家。', examplePinyin: 'Wǒ bàba zài jiā.', exampleId: 'Ayahku ada di rumah.' },
      { zh: '妈妈', pinyin: 'māma', tones: [1, 0], meaningId: 'ibu / mama', literalTip: 'Nada 1 datar tinggi + netral', exampleZh: '妈妈很爱我。', examplePinyin: 'Māma hěn ài wǒ.', exampleId: 'Ibu sangat menyayangiku.' },
      { zh: '儿子', pinyin: 'érzi', tones: [2, 0], meaningId: 'anak laki-laki / putra', literalTip: '儿 menandakan anak, 子 akhiran benda ringan', exampleZh: '他儿子十岁了。', examplePinyin: 'Tā érzi shí suì le.', exampleId: 'Anak laki-lakinya berusia 10 tahun.' },
      { zh: '女儿', pinyin: 'nǚ’ér', tones: [3, 2], meaningId: 'anak perempuan / putri', literalTip: 'Pakai vokal bulat ü (nǚ)!', exampleZh: '我女儿是学生。', examplePinyin: 'Wǒ nǚ’ér shì xuésheng.', exampleId: 'Putriku seorang pelajar.' },
      { zh: '先生', pinyin: 'xiānsheng', tones: [1, 0], meaningId: 'Tuan / Bapak / suami', literalTip: 'Taruh setelah marga, mis. 王先生 (Pak Wang)', exampleZh: '王先生你好！', examplePinyin: 'Wáng xiānsheng nǐ hǎo!', exampleId: 'Halo Pak Wang!' },
      { zh: '小姐', pinyin: 'xiǎojiě', tones: [3, 3], meaningId: 'Nona / saudari muda', literalTip: 'Sapaan formal untuk perempuan muda: 李小姐', exampleZh: '李小姐在学校吗？', examplePinyin: 'Lǐ xiǎojiě zài xuéxiào ma?', exampleId: 'Apakah Nona Li ada di sekolah?' },
      { zh: '老师', pinyin: 'lǎoshī', tones: [3, 1], meaningId: 'guru / dosen', literalTip: '老 bermakna dihormati dalam profesi mengajar', exampleZh: '她是我们汉语老师。', examplePinyin: 'Tā shì wǒmen Hànyǔ lǎoshī.', exampleId: 'Beliau guru bahasa Mandarin kami.' },
      { zh: '学生', pinyin: 'xuésheng', tones: [2, 0], meaningId: 'murid / mahasiswa', literalTip: '学 (belajar) + 生 (murid/lahir)', exampleZh: '我不是学生了。', examplePinyin: 'Wǒ bú shì xuésheng le.', exampleId: 'Saya sudah bukan pelajar lagi.' },
      { zh: '医生', pinyin: 'yīshēng', tones: [1, 1], meaningId: 'dokter', literalTip: '医 (obat/medis) + 生 (profesional)', exampleZh: '我想做医生。', examplePinyin: 'Wǒ xiǎng zuò yīshēng.', exampleId: 'Saya ingin menjadi dokter.' },
    ],
    grammarQuiz: [
      { id: 'u3q1', promptId: 'Sapaan resmi setelah marga untuk Bapak Li adalah:', sentence: '李_____，早上好！', options: ['小姐', '先生', '儿子'], answer: '先生', explainId: 'Marga + 先生 berarti Pak/Tuan.' },
      { id: 'u3q2', promptId: 'Pilih pasangan kata yang berarti "anak perempuan":', sentence: '她是我_____。', options: ['女儿', '妈妈', '老师'], answer: '女儿', explainId: '女儿 (nǚ’ér) = anak perempuan; 儿子 (érzi) = anak laki-laki.' },
    ],
  },
  {
    unit: 4,
    phase: 2,
    phaseTitle: 'Fase 2 · Keluarga, Angka & Kepemilikan',
    titleZh: '数字零到九',
    titleId: 'Angka Dasar 0 sampai 9',
    focusTip: 'Angka 1–3 mirip garis horizontal! Hafalkan melodi angkanya untuk harga & jam.',
    grammar: {
      pattern: 'Angka + Kata Benda / Pengukur',
      titleId: 'Membaca Deretan Angka',
      explainId: 'Nomor kamar, tahun, dan nomor telepon diucapkan angka demi angka (contoh: 2026 = èr líng èr liù).',
      examples: [
        { zh: '一、二、三、四、五。', pinyin: 'Yī, èr, sān, sì, wǔ.', id: 'Satu, dua, tiga, empat, lima.' },
        { zh: '我有八本书。', pinyin: 'Wǒ yǒu bā běn shū.', id: 'Saya punya delapan buku.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你有几个苹果？', pinyin: 'Nǐ yǒu jǐ ge píngguǒ?', id: 'Kamu punya berapa apel?' },
      { speaker: 'B', zh: '我有五个苹果。', pinyin: 'Wǒ yǒu wǔ ge píngguǒ.', id: 'Saya punya lima apel.' },
    ],
    words: [
      { zh: '零', pinyin: 'líng', tones: [2], meaningId: 'nol (0)', literalTip: 'Diucapkan naik di Nada 2 saat membaca nomor', exampleZh: '零点五', examplePinyin: 'líng diǎn wǔ', exampleId: 'nol koma lima (0,5)' },
      { zh: '一', pinyin: 'yī', tones: [1], meaningId: 'satu (1)', literalTip: 'Satu garis lurus mendatar!', exampleZh: '一个朋友', examplePinyin: 'yí ge péngyou', exampleId: 'satu orang teman' },
      { zh: '二', pinyin: 'èr', tones: [4], meaningId: 'dua (2)', literalTip: 'Dua garis datar! Dipakai berhitung murni & urutan', exampleZh: '二月', examplePinyin: 'Èryuè', exampleId: 'Bulan Februari (bulan ke-2)' },
      { zh: '三', pinyin: 'sān', tones: [1], meaningId: 'tiga (3)', literalTip: 'Tiga garis sejajar bertingkat!', exampleZh: '三点', examplePinyin: 'sān diǎn', exampleId: 'jam tiga' },
      { zh: '四', pinyin: 'sì', tones: [4], meaningId: 'empat (4)', literalTip: 'Hati-hati lidah datar "s", nada turun tajam', exampleZh: '四本书', examplePinyin: 'sì běn shū', exampleId: 'empat jilid buku' },
      { zh: '五', pinyin: 'wǔ', tones: [3], meaningId: 'lima (5)', literalTip: 'Turun rendah di Nada 3', exampleZh: '五个人', examplePinyin: 'wǔ ge rén', exampleId: 'lima orang' },
      { zh: '六', pinyin: 'liù', tones: [4], meaningId: 'enam (6)', literalTip: 'Angka keberuntungan kelancaran dalam budaya Tiongkok', exampleZh: '六月', examplePinyin: 'Liùyuè', exampleId: 'Bulan Juni' },
      { zh: '七', pinyin: 'qī', tones: [1], meaningId: 'tujuh (7)', literalTip: 'Ingat hembusan angin "q" di awal!', exampleZh: '七点见', examplePinyin: 'qī diǎn jiàn', exampleId: 'ketemu jam tujuh' },
      { zh: '八', pinyin: 'bā', tones: [1], meaningId: 'delapan (8)', literalTip: 'Terbuka ke bawah — angka hoki kemakmuran', exampleZh: '八块', examplePinyin: 'bā kuài', exampleId: 'delapan yuan' },
      { zh: '九', pinyin: 'jiǔ', tones: [3], meaningId: 'sembilan (9)', literalTip: 'Bunyi panjang berarti abadi', exampleZh: '九个杯子', examplePinyin: 'jiǔ ge bēizi', exampleId: 'sembilan gelas' },
    ],
    grammarQuiz: [
      { id: 'u4q1', promptId: 'Angka yang bentuk aksaranya persis tiga garis sejajar adalah:', sentence: '我买了_____本书。 (3 buku)', options: ['三', '四', '五'], answer: '三', explainId: '一 (1), 二 (2), 三 (3) dihitung langsung dari jumlah garisnya!' },
      { id: 'u4q2', promptId: 'Bulan Juli (bulan ke-7) diucapkan:', sentence: '_____月', options: ['六', '七', '九'], answer: '七', explainId: 'Juli adalah bulan ketujuh -> 七月 (Qīyuè).' },
    ],
  },
  {
    unit: 5,
    phase: 2,
    phaseTitle: 'Fase 2 · Keluarga, Angka & Kepemilikan',
    titleZh: '年龄、归属与指代',
    titleId: 'Usia, Milik (的) & Kata Tanya',
    focusTip: 'Kata tanya bahasa Mandarin TIDAK pindah ke depan kalimat; biarkan di tempat jawaban!',
    grammar: {
      pattern: 'Pemilik + 的 + Benda · Subjek + 几/多 + 岁',
      titleId: 'Kepemilikan dengan 的 & Bertanya Usia',
      explainId: '的 bekerja seperti tanda kepunyaan ("nya" / "\'s"): 我的书 (bukuku). 几 dipakai untuk menanyakan angka perkiraan kecil (<10), 多少 untuk jumlah besar/harga.',
      examples: [
        { zh: '这是我的茶。', pinyin: 'Zhè shì wǒ de chá.', id: 'Ini teh milikku.' },
        { zh: '他今年几岁了？', pinyin: 'Tā jīnnián jǐ suì le?', id: 'Tahun ini usianya berapa (untuk anak)?' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '这是谁的书？', pinyin: 'Zhè shì shéi de shū?', id: 'Ini buku milik siapa?' },
      { speaker: 'B', zh: '那不是我的书，那是老师的。', pinyin: 'Nà bú shì wǒ de shū, nà shì lǎoshī de.', id: 'Itu bukan bukuku, itu milik guru.' },
    ],
    words: [
      { zh: '十', pinyin: 'shí', tones: [2], meaningId: 'sepuluh (10)', literalTip: 'Bentuk salib; gabungan 二十 = 20, 十二 = 12', exampleZh: '十岁', examplePinyin: 'shí suì', exampleId: 'umur sepuluh tahun' },
      { zh: '岁', pinyin: 'suì', tones: [4], meaningId: 'tahun (satuan usia)', literalTip: 'Tidak perlu kata 是 sebelum angka umur: 我二十岁', exampleZh: '她今年八岁。', examplePinyin: 'Tā jīnnián bā suì.', exampleId: 'Dia tahun ini berumur 8 tahun.' },
      { zh: '几', pinyin: 'jǐ', tones: [3], meaningId: 'berapa (perkiraan <10) / beberapa', literalTip: 'Juga dipakai menanyakan jam: 几点？', exampleZh: '你几岁了？', examplePinyin: 'Nǐ jǐ suì le?', exampleId: 'Umurmu berapa?' },
      { zh: '多少', pinyin: 'duōshao', tones: [1, 0], meaningId: 'berapa banyak / berapa harga', literalTip: '多 (banyak) + 少 (sedikit)', exampleZh: '这个多少钱？', examplePinyin: 'Zhège duōshao qián?', exampleId: 'Ini harganya berapa?' },
      { zh: '的', pinyin: 'de', tones: [0], meaningId: 'milik / kepunyaan (partikel)', literalTip: 'Kata paling sering muncul dalam seluruh bahasa Mandarin!', exampleZh: '我的朋友', examplePinyin: 'wǒ de péngyou', exampleId: 'temanku' },
      { zh: '这', pinyin: 'zhè', tones: [4], meaningId: 'ini', literalTip: 'Menunjuk benda dekat', exampleZh: '这是我妈妈。', examplePinyin: 'Zhè shì wǒ māma.', exampleId: 'Ini ibuku.' },
      { zh: '那', pinyin: 'nà', tones: [4], meaningId: 'itu', literalTip: 'Menunjuk benda jauh', exampleZh: '那是什么？', examplePinyin: 'Nà shì shénme?', exampleId: 'Itu apa?' },
      { zh: '谁', pinyin: 'shéi', tones: [2], meaningId: 'siapa', literalTip: 'Dibaca naik shéi (sering juga shúi)', exampleZh: '他是谁？', examplePinyin: 'Tā shì shéi?', exampleId: 'Dia siapa?' },
      { zh: '哪', pinyin: 'nǎ', tones: [3], meaningId: 'yang mana', literalTip: 'Ada radikal mulut (口) di kiri karena bertanya!', exampleZh: '你是哪国人？', examplePinyin: 'Nǐ shì nǎ guó rén?', exampleId: 'Kamu warga negara mana?' },
      { zh: '哪儿', pinyin: 'nǎr', tones: [3], meaningId: 'di mana', literalTip: '哪 + 儿 (lidah gulung di akhir)', exampleZh: '你在哪儿？', examplePinyin: 'Nǐ zài nǎr?', exampleId: 'Kamu di mana?' },
    ],
    grammarQuiz: [
      { id: 'u5q1', promptId: 'Pilih partikel penghubung untuk "teman milik saya":', sentence: '他是我_____朋友。', options: ['的', '吗', '了'], answer: '的', explainId: '的 menyatakan kepemilikan/relasi di antara pemilik dan kata benda.' },
      { id: 'u5q2', promptId: 'Kalimat yang tepat untuk bertanya "Buku itu milik siapa?" adalah:', sentence: '那是_____的书？', options: ['哪儿', '谁', '多少'], answer: '谁', explainId: '谁 (shéi) artinya siapa.' },
    ],
  },
  {
    unit: 6,
    phase: 3,
    phaseTitle: 'Fase 3 · Waktu, Lokasi & Belanja',
    titleZh: '时间与日期',
    titleId: 'Tanggal, Hari & Jam',
    focusTip: 'Urutan waktu Mandarin selalu DARI BESAR KE KECIL: Tahun → Bulan → Tanggal → Jam.',
    grammar: {
      pattern: 'Subjek + Waktu + Kata Kerja (ATAU Waktu + Subjek + Kata Kerja)',
      titleId: 'Penempatan Kata Waktu',
      explainId: 'Waktu di Mandarin tidak pernah ditaruh di ujung belakang seperti bahasa Inggris. Taruhlah sebelum kata kerja!',
      examples: [
        { zh: '我明天去北京。', pinyin: 'Wǒ míngtiān qù Běijīng.', id: 'Besok saya pergi ke Beijing.' },
        { zh: '今天是十一月二十七号。', pinyin: 'Jīntiān shì shíyīyuè èrshíqī hào.', id: 'Hari ini tanggal 27 November.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '今天星期几？', pinyin: 'Jīntiān xīngqījǐ?', id: 'Hari ini hari apa?' },
      { speaker: 'B', zh: '今天星期五，现在三点十分。', pinyin: 'Jīntiān xīngqīwǔ, xiànzài sāndiǎn shífēn.', id: 'Hari ini Jumat, sekarang jam 3 lewat 10 menit.' },
    ],
    words: [
      { zh: '年', pinyin: 'nián', tones: [2], meaningId: 'tahun', literalTip: '2026年 dibaca èr-líng-èr-liù nián', exampleZh: '我明年去中国。', examplePinyin: 'Wǒ míngnián qù Zhōngguó.', exampleId: 'Tahun depan saya ke Tiongkok.' },
      { zh: '月', pinyin: 'yuè', tones: [4], meaningId: 'bulan (kalender) / bulan di langit', literalTip: 'Angka 1–12 + 月 langsung jadi nama bulan!', exampleZh: '一月很冷。', examplePinyin: 'Yīyuè hěn lěng.', exampleId: 'Bulan Januari dingin.' },
      { zh: '号', pinyin: 'hào', tones: [4], meaningId: 'tanggal / nomor (lisan)', literalTip: 'Dipakai dalam percakapan sehari-hari; 8号 = tanggal 8', exampleZh: '今天几号？', examplePinyin: 'Jīntiān jǐ hào?', exampleId: 'Hari ini tanggal berapa?' },
      { zh: '星期', pinyin: 'xīngqī', tones: [1, 1], meaningId: 'minggu / hari dalam seminggu', literalTip: '星期 + angka 1–6 = Senin s/d Sabtu; 星期天 = Minggu', exampleZh: '星期六我不工作。', examplePinyin: 'Xīngqīliù wǒ bù gōngzuò.', exampleId: 'Hari Sabtu saya tidak bekerja.' },
      { zh: '今天', pinyin: 'jīntiān', tones: [1, 1], meaningId: 'hari ini', literalTip: '今 (sekarang) + 天 (hari/langit)', exampleZh: '今天天气很好。', examplePinyin: 'Jīntiān tiānqì hěn hǎo.', exampleId: 'Hari ini cuacanya bagus sekali.' },
      { zh: '昨天', pinyin: 'zuótiān', tones: [2, 1], meaningId: 'kemarin', literalTip: 'Tidak mengubah bentuk kata kerja! Cukup tambahkan 昨天', exampleZh: '昨天我学习汉语。', examplePinyin: 'Zuótiān wǒ xuéxí Hànyǔ.', exampleId: 'Kemarin saya belajar bahasa Mandarin.' },
      { zh: '明天', pinyin: 'míngtiān', tones: [2, 1], meaningId: 'besok', literalTip: '明 menggabungkan matahari (日) dan bulan (月) = hari esok yang cerah', exampleZh: '明天见！', examplePinyin: 'Míngtiān jiàn!', exampleId: 'Sampai jumpa besok!' },
      { zh: '点', pinyin: 'diǎn', tones: [3], meaningId: 'pukul / jam (waktu)', literalTip: 'Angka + 点: 五点 = jam 5 tepat', exampleZh: '现在九点。', examplePinyin: 'Xiànzài jiǔ diǎn.', exampleId: 'Sekarang pukul sembilan.' },
      { zh: '分钟', pinyin: 'fēnzhōng', tones: [1, 1], meaningId: 'menit (durasi)', literalTip: 'Digunakan untuk durasi: 五分钟 (lima menit)', exampleZh: '等我五分钟。', examplePinyin: 'Děng wǒ wǔ fēnzhōng.', exampleId: 'Tunggu aku lima menit.' },
      { zh: '时候', pinyin: 'shíhou', tones: [2, 0], meaningId: 'saat / ketika / waktu', literalTip: '什么时候 = kapan?', exampleZh: '你什么时候来？', examplePinyin: 'Nǐ shénme shíhou lái?', exampleId: 'Kapan kamu datang?' },
    ],
    grammarQuiz: [
      { id: 'u6q1', promptId: 'Susunan waktu yang benar untuk "Besok jam 8 aku pergi ke sekolah":', sentence: '我_____去学校。', options: ['明天八点', '八点明天', '点八明天'], answer: '明天八点', explainId: 'Urutan Mandarin selalu dari satuan waktu besar (明天) ke kecil (八点).' },
      { id: 'u6q2', promptId: 'Jika 星期一 adalah Senin, maka Kamis adalah:', sentence: '今天是_____。', options: ['星期二', '星期四', '星期六'], answer: '星期四', explainId: 'Senin=1, Selasa=2, Rabu=3, Kamis=4 (星期四).' },
    ],
  },
  {
    unit: 7,
    phase: 3,
    phaseTitle: 'Fase 3 · Waktu, Lokasi & Belanja',
    titleZh: '时段与方位',
    titleId: 'Pagi-Sore & Posisi (在)',
    focusTip: 'Kata 在 bisa berarti "berada di (lokasi)" sekaligus penanda posisi sebelum kata kerja!',
    grammar: {
      pattern: 'Subjek + 在 + Tempat (+ Kata Kerja)',
      titleId: 'Lokasi dengan 在 (zài)',
      explainId: 'Selalu sebutkan DI MANA aktivitas terjadi SEBELUM kata kerjanya: 我在家喝茶 (Di rumah minum teh), bukan "喝茶在家"!',
      examples: [
        { zh: '猫在椅子下面。', pinyin: 'Māo zài yǐzi xiàmiàn.', id: 'Kucing ada di bawah kursi.' },
        { zh: '我下午在家学习。', pinyin: 'Wǒ xiàwǔ zài jiā xuéxí.', id: 'Sore nanti aku belajar di rumah.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '我的手机在哪儿？', pinyin: 'Wǒ de shǒujī zài nǎr?', id: 'Ponselku ada di mana?' },
      { speaker: 'B', zh: '在桌子上面。', pinyin: 'Zài zhuōzi shàngmiàn.', id: 'Ada di atas meja.' },
    ],
    words: [
      { zh: '现在', pinyin: 'xiànzài', tones: [4, 4], meaningId: 'sekarang', literalTip: 'Taruh di awal kalimat atau sebelum kata kerja', exampleZh: '现在几点？', examplePinyin: 'Xiànzài jǐ diǎn?', exampleId: 'Sekarang jam berapa?' },
      { zh: '上午', pinyin: 'shàngwǔ', tones: [4, 3], meaningId: 'pagi menjelang siang', literalTip: 'Sekitar 08:00–11:59 sebelum tengah hari (午)', exampleZh: '上午我去医院。', examplePinyin: 'Shàngwǔ wǒ qù yīyuàn.', exampleId: 'Pagi ini saya ke rumah sakit.' },
      { zh: '中午', pinyin: 'zhōngwǔ', tones: [1, 3], meaningId: 'siang / tengah hari', literalTip: '中 (tengah) + 午 (siang) = sekitar jam 12', exampleZh: '中午我们吃米饭。', examplePinyin: 'Zhōngwǔ wǒmen chī mǐfàn.', exampleId: 'Siang kita makan nasi.' },
      { zh: '下午', pinyin: 'xiàwǔ', tones: [4, 3], meaningId: 'sore / siang menjelang sore', literalTip: 'Sekitar 13:00–17:59', exampleZh: '下午我在家看书。', examplePinyin: 'Xiàwǔ wǒ zài jiā kàn shū.', exampleId: 'Sore hari saya baca buku di rumah.' },
      { zh: '上', pinyin: 'shàng', tones: [4], meaningId: 'atas / naik / masuk kelas', literalTip: 'Anak panah ke atas; 上课 = masuk kelas, 桌子上 = di atas meja', exampleZh: '书在桌子上。', examplePinyin: 'Shū zài zhuōzi shàng.', exampleId: 'Buku ada di atas meja.' },
      { zh: '下', pinyin: 'xià', tones: [4], meaningId: 'bawah / turun / berikutnya', literalTip: 'Kebalikan 上; 下雨 = turun hujan, 下个月 = bulan depan', exampleZh: '请坐下。', examplePinyin: 'Qǐng zuòxia.', exampleId: 'Silakan duduk.' },
      { zh: '前面', pinyin: 'qiánmiàn', tones: [2, 0], meaningId: 'di depan', literalTip: 'Benda + 前面 = di depan benda tersebut', exampleZh: '学校在医院前面。', examplePinyin: 'Xuéxiào zài yīyuàn qiánmiàn.', exampleId: 'Sekolah ada di depan rumah sakit.' },
      { zh: '后面', pinyin: 'hòumiàn', tones: [4, 0], meaningId: 'di belakang', literalTip: 'Lawan kata 前面', exampleZh: '他在我后面。', examplePinyin: 'Tā zài wǒ hòumiàn.', exampleId: 'Dia di belakangku.' },
      { zh: '里', pinyin: 'lǐ', tones: [3], meaningId: 'di dalam', literalTip: 'Tempat + 里: 医院里 (di dalam RS), 家里 (di dalam rumah)', exampleZh: '杯子里有水。', examplePinyin: 'Bēizi lǐ yǒu shuǐ.', exampleId: 'Di dalam gelas ada air.' },
      { zh: '在', pinyin: 'zài', tones: [4], meaningId: 'di / berada di / sedang', literalTip: 'Bila tidak ada tempat, 在 + V artinya "sedang": 我在学习', exampleZh: '我在家。', examplePinyin: 'Wǒ zài jiā.', exampleId: 'Saya di rumah.' },
    ],
    grammarQuiz: [
      { id: 'u7q1', promptId: 'Urutan yang benar untuk "Saya makan siang di restoran":', sentence: '我_____吃饭。', options: ['在饭店', '去在饭店', '饭店里坐'], answer: '在饭店', explainId: 'Di Mandarin, 在 + Lokasi selalu mendahului kata kerja.' },
      { id: 'u7q2', promptId: 'Pilih kata arah untuk "di dalam sekolah":', sentence: '学生在学校_____学习。', options: ['上', '里', '年'], answer: '里', explainId: '学校里 = di dalam area sekolah.' },
    ],
  },
  {
    unit: 8,
    phase: 3,
    phaseTitle: 'Fase 3 · Waktu, Lokasi & Belanja',
    titleZh: '城市与场所',
    titleId: 'Kota, Tempat Umum & Teman',
    focusTip: 'Gabungkan kata tempat dengan 去 (pergi) dan 在 (di) dalam satu nafas.',
    grammar: {
      pattern: '去 + Tempat + Melakukan Sesuatu',
      titleId: 'Menuju Tempat untuk Suatu Tujuan',
      explainId: 'Setelah 去 + Tempat, kamu bisa langsung menyebutkan tujuannya: 我去商店买苹果.',
      examples: [
        { zh: '我去商店买水。', pinyin: 'Wǒ qù shāngdiàn mǎi shuǐ.', id: 'Aku ke toko beli air.' },
        { zh: '我的同学都去了北京。', pinyin: 'Wǒ de tóngxué dōu qùle Běijīng.', id: 'Teman-teman kelasku pergi ke Beijing.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你朋友在哪里工作？', pinyin: 'Nǐ péngyou zài nǎlǐ gōngzuò?', id: 'Temanmu bekerja di mana?' },
      { speaker: 'B', zh: '他在北京的一家医院工作。', pinyin: 'Tā zài Běijīng de yì jiā yīyuàn gōngzuò.', id: 'Dia bekerja di sebuah rumah sakit di Beijing.' },
    ],
    words: [
      { zh: '中国', pinyin: 'Zhōngguó', tones: [1, 2], meaningId: 'Tiongkok', literalTip: 'Kerajaan Tengah (中 + 国)', exampleZh: '我喜欢中国菜。', examplePinyin: 'Wǒ xǐhuan Zhōngguó cài.', exampleId: 'Saya suka masakan Tiongkok.' },
      { zh: '北京', pinyin: 'Běijīng', tones: [3, 1], meaningId: 'Beijing', literalTip: '北 (utara) + 京 (ibu kota)', exampleZh: '北京很大。', examplePinyin: 'Běijīng hěn dà.', exampleId: 'Beijing sangat besar.' },
      { zh: '家', pinyin: 'jiā', tones: [1], meaningId: 'rumah / keluarga', literalTip: '回家 = pulang ke rumah', exampleZh: '我六点回家。', examplePinyin: 'Wǒ liù diǎn huí jiā.', exampleId: 'Saya pulang jam enam.' },
      { zh: '学校', pinyin: 'xuéxiào', tones: [2, 4], meaningId: 'sekolah / kampus', literalTip: '学 (belajar) + 校 (kampus)', exampleZh: '我们的学校很漂亮。', examplePinyin: 'Wǒmen de xuéxiào hěn piàoliang.', exampleId: 'Sekolah kami sangat indah.' },
      { zh: '饭店', pinyin: 'fàndiàn', tones: [4, 4], meaningId: 'restoran / hotel', literalTip: '饭 (nasi/makan) + 店 (toko/tempat)', exampleZh: '这家饭店很大。', examplePinyin: 'Zhè jiā fàndiàn hěn dà.', exampleId: 'Restoran ini sangat besar.' },
      { zh: '商店', pinyin: 'shāngdiàn', tones: [1, 4], meaningId: 'toko / kedai', literalTip: '商 (dagang) + 店 (toko)', exampleZh: '我去商店买衣服。', examplePinyin: 'Wǒ qù shāngdiàn mǎi yīfu.', exampleId: 'Saya ke toko membeli baju.' },
      { zh: '医院', pinyin: 'yīyuàn', tones: [1, 4], meaningId: 'rumah sakit', literalTip: 'Tempat kerja 医生 (dokter)', exampleZh: '他在医院工作。', examplePinyin: 'Tā zài yīyuàn gōngzuò.', exampleId: 'Dia bekerja di rumah sakit.' },
      { zh: '火车站', pinyin: 'huǒchēzhàn', tones: [3, 1, 4], meaningId: 'stasiun kereta api', literalTip: '火 (api) + 车 (kendaraan) + 站 (stasiun)', exampleZh: '我坐出租车去火车站。', examplePinyin: 'Wǒ zuò chūzūchē qù huǒchēzhàn.', exampleId: 'Saya naik taksi ke stasiun kereta.' },
      { zh: '朋友', pinyin: 'péngyou', tones: [2, 0], meaningId: 'teman / sahabat', literalTip: '好朋友 = sahabat baik', exampleZh: '我有很多朋友。', examplePinyin: 'Wǒ yǒu hěn duō péngyou.', exampleId: 'Saya punya banyak teman.' },
      { zh: '同学', pinyin: 'tóngxué', tones: [2, 2], meaningId: 'teman sekelas', literalTip: '同 (bersama) + 学 (belajar)', exampleZh: '他是我汉语同学。', examplePinyin: 'Tā shì wǒ Hànyǔ tóngxué.', exampleId: 'Dia teman kelas Mandarin saya.' },
    ],
    grammarQuiz: [
      { id: 'u8q1', promptId: 'Tempat yang dituju untuk membeli pakaian adalah:', sentence: '妈妈去_____买衣服。', options: ['医院', '商店', '火车站'], answer: '商店', explainId: '商店 (shāngdiàn) adalah toko.' },
      { id: 'u8q2', promptId: 'Pilih kata untuk teman yang belajar di kelas yang sama:', sentence: '李明是我的_____。', options: ['同学', '饭店', '中国'], answer: '同学', explainId: '同学 = teman sekelas.' },
    ],
  },
  {
    unit: 9,
    phase: 3,
    phaseTitle: 'Fase 3 · Waktu, Lokasi & Belanja',
    titleZh: '饮食与购物',
    titleId: 'Makan, Minum & Belanja',
    focusTip: 'Kata kerja "吃" (makan) dan "喝" (minum) keduanya diawali kotak mulut 口!',
    grammar: {
      pattern: '想 + 吃/喝/买 + Benda',
      titleId: 'Memesan Makanan & Membeli Barang',
      explainId: 'Gunakan 想 di depan kata kerja untuk menyatakan keinginan sopan saat memesan atau berbelanja.',
      examples: [
        { zh: '我想喝茶，不想喝水。', pinyin: 'Wǒ xiǎng hē chá, bù xiǎng hē shuǐ.', id: 'Aku ingin minum teh, tidak ingin minum air.' },
        { zh: '苹果五块钱一个。', pinyin: 'Píngguǒ wǔ kuài qián yí ge.', id: 'Apel harganya 5 yuan per buah.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你好，你想吃什么菜？', pinyin: 'Nǐ hǎo, nǐ xiǎng chī shénme cài?', id: 'Halo, kamu mau makan lauk apa?' },
      { speaker: 'B', zh: '我要吃米饭和中国菜，再来一杯水。', pinyin: 'Wǒ yào chī mǐfàn hé Zhōngguó cài, zài lái yì bēi shuǐ.', id: 'Saya mau makan nasi dan masakan Tiongkok, tambah segelas air.' },
    ],
    words: [
      { zh: '吃', pinyin: 'chī', tones: [1], meaningId: 'makan', literalTip: 'Ada radikal mulut 口; tidak berubah untuk lampau maupun depan', exampleZh: '你喜欢吃什么？', examplePinyin: 'Nǐ xǐhuan chī shénme?', exampleId: 'Kamu suka makan apa?' },
      { zh: '喝', pinyin: 'hē', tones: [1], meaningId: 'minum', literalTip: 'Juga berawal radikal mulut 口 di sebelah kiri', exampleZh: '请喝水！', examplePinyin: 'Qǐng hē shuǐ!', exampleId: 'Silakan minum air!' },
      { zh: '菜', pinyin: 'cài', tones: [4], meaningId: 'masakan / hidangan / sayur', literalTip: 'Bisa berarti sayur maupun hidangan lauk secara umum', exampleZh: '中国菜很好吃。', examplePinyin: 'Zhōngguó cài hěn hǎochī.', exampleId: 'Masakan Tiongkok sangat enak.' },
      { zh: '米饭', pinyin: 'mǐfàn', tones: [3, 4], meaningId: 'nasi putih matang', literalTip: '米 (beras) + 饭 (nasi)', exampleZh: '中午我吃米饭。', examplePinyin: 'Zhōngwǔ wǒ chī mǐfàn.', exampleId: 'Siang ini aku makan nasi.' },
      { zh: '苹果', pinyin: 'píngguǒ', tones: [2, 3], meaningId: 'apel', literalTip: 'Píng = tenang/sehat — apel simbol keselamatan', exampleZh: '我想买三个苹果。', examplePinyin: 'Wǒ xiǎng mǎi sān ge píngguǒ.', exampleId: 'Saya mau beli tiga buah apel.' },
      { zh: '水果', pinyin: 'shuǐguǒ', tones: [3, 3], meaningId: 'buah-buahan', literalTip: '水 (berair) + 果 (buah)', exampleZh: '妈妈喜欢吃水果。', examplePinyin: 'Māma xǐhuan chī shuǐguǒ.', exampleId: 'Ibu suka makan buah.' },
      { zh: '茶', pinyin: 'chá', tones: [2], meaningId: 'teh', literalTip: 'Dari bunyi "cha" ini kata Indonesia "teh/cai" berasal!', exampleZh: '爸爸每天喝茶。', examplePinyin: 'Bàba měitiān hē chá.', exampleId: 'Ayah minum teh setiap hari.' },
      { zh: '杯子', pinyin: 'bēizi', tones: [1, 0], meaningId: 'gelas / cangkir', literalTip: 'Radikal kayu 木 di kiri (gelas zaman dulu dari kayu/bambu)', exampleZh: '这个杯子很漂亮。', examplePinyin: 'Zhège bēizi hěn piàoliang.', exampleId: 'Gelas ini sangat cantik.' },
      { zh: '水', pinyin: 'shuǐ', tones: [3], meaningId: 'air', literalTip: 'Bentuk gambar aliran air yang jatuh', exampleZh: '天气很热，多喝水。', examplePinyin: 'Tiānqì hěn rè, duō hē shuǐ.', exampleId: 'Cuaca sangat panas, banyaklah minum air.' },
      { zh: '买', pinyin: 'mǎi', tones: [3], meaningId: 'membeli', literalTip: 'Nada 3 rendah; lawan katanya 卖 (mài = menjual, Nada 4)', exampleZh: '我去买一点儿菜。', examplePinyin: 'Wǒ qù mǎi yìdiǎnr cài.', exampleId: 'Aku pergi beli sedikit sayur.' },
    ],
    grammarQuiz: [
      { id: 'u9q1', promptId: 'Pilih kata kerja yang cocok dengan minuman 茶 (teh):', sentence: '他每天上午_____茶。', options: ['吃', '喝', '坐'], answer: '喝', explainId: 'Minum menggunakan 喝 (hē); makan menggunakan 吃 (chī).' },
      { id: 'u9q2', promptId: 'Kata benda yang tepat untuk memuji cangkir yang cantik:', sentence: '桌子上有一个漂亮的_____。', options: ['杯子', '米饭', '苹果'], answer: '杯子', explainId: '杯子 (bēizi) = cangkir/gelas.' },
    ],
  },
  {
    unit: 10,
    phase: 4,
    phaseTitle: 'Fase 4 · Belajar, Deskripsi & Cuaca',
    titleZh: '学习与工作',
    titleId: 'Belajar, Kerja & Aksara',
    focusTip: 'Jangan campurkan kata kerja 说 (berbicara isi bahasa) dengan 说话 (melakukan aksi bicara)!',
    grammar: {
      pattern: 'Subjek + 会/在 + 写/读/学习 + 汉语/汉字',
      titleId: 'Aktivitas Belajar Bahasa Mandarin',
      explainId: '会 artinya bisa karena sudah belajar/melatih keterampilan: 我会说汉语 (Aku bisa bicara bahasa Mandarin).',
      examples: [
        { zh: '我会写汉字。', pinyin: 'Wǒ huì xiě Hànzì.', id: 'Saya bisa menulis aksara Mandarin.' },
        { zh: '请看书、听老师说话。', pinyin: 'Qǐng kàn shū, tīng lǎoshī shuōhuà.', id: 'Silakan lihat buku dan dengarkan guru berbicara.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你会说汉语吗？', pinyin: 'Nǐ huì shuō Hànyǔ ma?', id: 'Apakah kamu bisa berbicara bahasa Mandarin?' },
      { speaker: 'B', zh: '我会说一点儿，现在在认真学习。', pinyin: 'Wǒ huì shuō yìdiǎnr, xiànzài zài rènzhēn xuéxí.', id: 'Saya bisa sedikit, sekarang sedang rajin belajar.' },
    ],
    words: [
      { zh: '学习', pinyin: 'xuéxí', tones: [2, 2], meaningId: 'belajar / mempelajari', literalTip: 'Keduanya di Nada 2 naik!', exampleZh: '我每天学习汉语。', examplePinyin: 'Wǒ měitiān xuéxí Hànyǔ.', exampleId: 'Saya belajar Mandarin setiap hari.' },
      { zh: '工作', pinyin: 'gōngzuò', tones: [1, 4], meaningId: 'bekerja / pekerjaan', literalTip: 'Bisa jadi kata kerja maupun kata benda', exampleZh: '我的工作很忙。', examplePinyin: 'Wǒ de gōngzuò hěn máng.', exampleId: 'Pekerjaanku sangat sibuk.' },
      { zh: '汉语', pinyin: 'Hànyǔ', tones: [4, 3], meaningId: 'bahasa Mandarin', literalTip: '语 memakai radikal kata-kata 讠', exampleZh: '汉语很有意思。', examplePinyin: 'Hànyǔ hěn yǒu yìsi.', exampleId: 'Bahasa Mandarin sangat menarik.' },
      { zh: '字', pinyin: 'zì', tones: [4], meaningId: 'aksara / huruf Hanzi', literalTip: 'Anak (子) di bawah atap (宀) belajar aksara!', exampleZh: '这个字怎么写？', examplePinyin: 'Zhège zì zěnme xiě?', exampleId: 'Bagaimana cara menulis karakter ini?' },
      { zh: '书', pinyin: 'shū', tones: [1], meaningId: 'buku', literalTip: 'Satuan buku selalu pakai 本: 一本书', exampleZh: '我想买汉语书。', examplePinyin: 'Wǒ xiǎng mǎi Hànyǔ shū.', exampleId: 'Aku mau beli buku bahasa Mandarin.' },
      { zh: '看', pinyin: 'kàn', tones: [4], meaningId: 'melihat / membaca dalam hati / menonton', literalTip: 'Tangan (手) di atas mata (目) melihat jauh', exampleZh: '我在看电影。', examplePinyin: 'Wǒ zài kàn diànyǐng.', exampleId: 'Aku sedang menonton film.' },
      { zh: '听', pinyin: 'tīng', tones: [1], meaningId: 'mendengarkan', literalTip: '口 + 斤: mendengarkan kata yang diucapkan', exampleZh: '我喜欢听音乐。', examplePinyin: 'Wǒ xǐhuan tīng yīnyuè.', exampleId: 'Aku suka mendengarkan musik.' },
      { zh: '说', pinyin: 'shuō', tones: [1], meaningId: 'berbicara / berkata', literalTip: 'Dipakai saat menyebut isi atau bahasa: 说汉语', exampleZh: '请你说慢一点儿。', examplePinyin: 'Qǐng nǐ shuō màn yìdiǎnr.', exampleId: 'Tolong bicara sedikit lebih pelan.' },
      { zh: '读', pinyin: 'dú', tones: [2], meaningId: 'membaca bersuara / menempuh pendidikan', literalTip: 'Lihat perbedaan dengan 看 (baca diam-diam)', exampleZh: '请跟我读这个字。', examplePinyin: 'Qǐng gēn wǒ dú zhège zì.', exampleId: 'Silakan ikuti aku membaca nyaring aksara ini.' },
      { zh: '写', pinyin: 'xiě', tones: [3], meaningId: 'menulis', literalTip: '写字 = menulis karakter', exampleZh: '我会写我的名字。', examplePinyin: 'Wǒ huì xiě wǒ de míngzi.', exampleId: 'Saya bisa menulis nama saya.' },
    ],
    grammarQuiz: [
      { id: 'u10q1', promptId: 'Pilih kata kerja tepat untuk kalimat "menonton film":', sentence: '明天下午我想_____电影。', options: ['看', '听', '写'], answer: '看', explainId: '看 dipakai untuk menonton TV/film maupun membaca buku dalam hati.' },
      { id: 'u10q2', promptId: 'Kalimat "Bagaimana cara membaca nyaring karakter ini?" memakai:', sentence: '这个字怎么_____？', options: ['喝', '读', '坐'], answer: '读', explainId: '读 (dú) adalah membaca dengan suara terdengar.' },
    ],
  },
  {
    unit: 11,
    phase: 4,
    phaseTitle: 'Fase 4 · Belajar, Deskripsi & Cuaca',
    titleZh: '形容与程度',
    titleId: 'Kata Sifat, 很 & 太…了',
    focusTip: 'JANGAN pernah tulis "她是漂亮"! Pakai kata jembatan 很: "她很漂亮" (Dia cantik).',
    grammar: {
      pattern: 'Subjek + 很 + Kata Sifat · 太 + Kata Sifat + 了',
      titleId: 'Kata Sifat Menggantikan 是',
      explainId: 'Dalam kalimat positif sederhana, kata sifat selalu ditemani 很 (yang artinya melembut menjadi sekadar jembatan netral) atau 太…了 untuk ekspresi kagum/keluhan!',
      examples: [
        { zh: '这个苹果很大。', pinyin: 'Zhège píngguǒ hěn dà.', id: 'Apel ini besar.' },
        { zh: '今天太高兴了！', pinyin: 'Jīntiān tài gāoxìng le!', id: 'Hari ini senang sekali!' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你的新衣服太漂亮了！', pinyin: 'Nǐ de xīn yīfu tài piàoliang le!', id: 'Baju barumu cantik sekali!' },
      { speaker: 'B', zh: '谢谢，我们今天都很高兴！', pinyin: 'Xièxie, wǒmen jīntiān dōu hěn gāoxìng!', id: 'Terima kasih, kita hari ini sama-sama senang!' },
    ],
    words: [
      { zh: '很', pinyin: 'hěn', tones: [3], meaningId: 'sangat / penghubung kata sifat', literalTip: 'Penyelamat kata sifat — wajib ada di antara subjek dan sifat positif!', exampleZh: '她很高兴。', examplePinyin: 'Tā hěn gāoxìng.', exampleId: 'Dia senang.' },
      { zh: '太', pinyin: 'tài', tones: [4], meaningId: 'terlalu / amat sangat', literalTip: 'Sering berpasangan dengan 了 di akhir: 太好了！(Hebat sekali!)', exampleZh: '太好了！', examplePinyin: 'Tài hǎo le!', exampleId: 'Bagus sekali!' },
      { zh: '都', pinyin: 'dōu', tones: [1], meaningId: 'semuanya / sama-sama', literalTip: 'SELALU ditaruh tepat sebelum kata kerja/sifat, bukan di depan subjek!', exampleZh: '我们都是学生。', examplePinyin: 'Wǒmen dōu shì xuésheng.', exampleId: 'Kami semua adalah murid.' },
      { zh: '大', pinyin: 'dà', tones: [4], meaningId: 'besar / tua (usia)', literalTip: 'Gambar orang merentangkan tangan lebar-lebar', exampleZh: '我们的家很大。', examplePinyin: 'Wǒmen de jiā hěn dà.', exampleId: 'Rumah kami besar.' },
      { zh: '小', pinyin: 'xiǎo', tones: [3], meaningId: 'kecil / muda', literalTip: 'Bisa dipakai di depan nama panggilan akrab: 小猫', exampleZh: '这只小猫很可爱。', examplePinyin: 'Zhè zhī xiǎomāo hěn kě’ài.', exampleId: 'Anak kucing ini imut sekali.' },
      { zh: '多', pinyin: 'duō', tones: [1], meaningId: 'banyak', literalTip: 'Bisa berarti "lebih" atau bertanyakan jumlah: 多大 (berapa besar/usia)?', exampleZh: '中国菜很多。', examplePinyin: 'Zhōngguó cài hěn duō.', exampleId: 'Masakan Tiongkok banyak ragamnya.' },
      { zh: '少', pinyin: 'shǎo', tones: [3], meaningId: 'sedikit / jarang', literalTip: 'Lawan kata langsung dari 多', exampleZh: '桌子上书很少。', examplePinyin: 'Zhuōzi shàng shū hěn shǎo.', exampleId: 'Di atas meja bukunya sedikit.' },
      { zh: '高兴', pinyin: 'gāoxìng', tones: [1, 4], meaningId: 'senang / gembira', literalTip: 'Selalu dipakai di: 很高兴认识你！', exampleZh: '今天我很高兴。', examplePinyin: 'Jīntiān wǒ hěn gāoxìng.', exampleId: 'Hari ini aku gembira.' },
      { zh: '漂亮', pinyin: 'piàoliang', tones: [4, 0], meaningId: 'cantik / indah / tampan', literalTip: 'Untuk orang, baju, bangunan, pemandangan', exampleZh: '你今天真漂亮！', examplePinyin: 'Nǐ jīntiān zhēn piàoliang!', exampleId: 'Kamu hari ini cantik sekali!' },
      { zh: '爱', pinyin: 'ài', tones: [4], meaningId: 'cinta / sangat suka', literalTip: 'Bisa untuk sayang keluarga, pasangan, atau hobi', exampleZh: '我爱我的家人。', examplePinyin: 'Wǒ ài wǒ de jiārén.', exampleId: 'Aku mencintai keluargaku.' },
    ],
    grammarQuiz: [
      { id: 'u11q1', promptId: 'Pilih cara alami mengatakan "Kucing kecil itu cantik" dalam Mandarin:', sentence: '这只小猫_____漂亮。', options: ['是', '很', '了'], answer: '很', explainId: 'Di Mandarin jangan pakai 是 di depan kata sifat! Gunakan 很.' },
      { id: 'u11q2', promptId: 'Posisi yang benar untuk kata 都 (semuanya):', sentence: '我们_____喜欢学汉语。', options: ['都', '是', '有'], answer: '都', explainId: '都 selalu diletakkan di belakang subjek jamak (我们/他们), tepat sebelum kata kerja.' },
    ],
  },
  {
    unit: 12,
    phase: 4,
    phaseTitle: 'Fase 4 · Belajar, Deskripsi & Cuaca',
    titleZh: '天气与生活',
    titleId: 'Cuaca, Suhu & Kebiasaan',
    focusTip: 'Bedakan bertanya kondisi "怎么样" (Bagaimana?) dan bertanya cara/alasan "怎么" (Bagaimana caranya/kenapa?)!',
    grammar: {
      pattern: '怎么 + Kata Kerja · Benda + 怎么样？',
      titleId: 'Bertanya Kondisi & Cara Melakukan',
      explainId: '怎么样 selalu ditaruh di AKHIR untuk meminta pendapat ("Gimana nih?"), sedangkan 怎么 ditaruh SEBELUM kata kerja untuk menanyakan cara ("Gimana caranya?").',
      examples: [
        { zh: '今天天气怎么样？', pinyin: 'Jīntiān tiānqì zěnmeyàng?', id: 'Bagaimana cuaca hari ini?' },
        { zh: '明天可能会下雨。', pinyin: 'Míngtiān kěnéng huì xià yǔ.', id: 'Besok kemungkinan akan turun hujan.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '北京现在冷不冷？', pinyin: 'Běijīng xiànzài lěng bu lěng?', id: 'Apakah Beijing sekarang dingin?' },
      { speaker: 'B', zh: '有点儿冷，而且昨天也下雨了。', pinyin: 'Yǒudiǎnr lěng, érqiě zuótiān yě xiàyǔ le.', id: 'Agak dingin, dan kemarin juga turun hujan.' },
    ],
    words: [
      { zh: '天气', pinyin: 'tiānqì', tones: [1, 4], meaningId: 'cuaca', literalTip: '天 (langit) + 气 (udara)', exampleZh: '今天天气太热了！', examplePinyin: 'Jīntiān tiānqì tài rè le!', exampleId: 'Cuaca hari ini panas sekali!' },
      { zh: '冷', pinyin: 'lěng', tones: [3], meaningId: 'dingin', literalTip: 'Ada 2 titik es 冫 di sebelah kiri!', exampleZh: '我不喜欢冷天气。', examplePinyin: 'Wǒ bù xǐhuan lěng tiānqì.', exampleId: 'Saya tidak suka cuaca dingin.' },
      { zh: '热', pinyin: 'rè', tones: [4], meaningId: 'panas', literalTip: 'Ada 4 titik api 灬 di bagian bawah!', exampleZh: '请喝一杯热茶。', examplePinyin: 'Qǐng hē yì bēi rè chá.', exampleId: 'Silakan minum secangkir teh panas.' },
      { zh: '下雨', pinyin: 'xià yǔ', tones: [4, 3], meaningId: 'turun hujan', literalTip: '下雨 adalah kata kerja + objek (turun + hujan)', exampleZh: '外面下雨了。', examplePinyin: 'Wàimiàn xià yǔ le.', exampleId: 'Di luar mulai turun hujan.' },
      { zh: '怎么', pinyin: 'zěnme', tones: [3], meaningId: 'bagaimana (cara) / kenapa', literalTip: 'Taruh tepat sebelum kata kerja: 怎么去？', exampleZh: '你怎么去学校？', examplePinyin: 'Nǐ zěnme qù xuéxiào?', exampleId: 'Bagaimana kamu pergi ke sekolah?' },
      { zh: '怎么样', pinyin: 'zěnmeyàng', tones: [3, 0, 4], meaningId: 'bagaimana keadaannya / bagaimana menurutmu?', literalTip: 'Taruh di ujung belakang kalimat untuk minta opini/kabar', exampleZh: '这个菜怎么样？', examplePinyin: 'Zhège cài zěnmeyàng?', exampleId: 'Bagaimana rasa masakan ini?' },
      { zh: '忙', pinyin: 'máng', tones: [2], meaningId: 'sibuk', literalTip: '心 (hati) di kiri + 亡 (hilang) = sibuk!', exampleZh: '你最近忙不忙？', examplePinyin: 'Nǐ zuìjìn máng bu máng?', exampleId: 'Belakangan ini apakah kamu sibuk?' },
      { zh: '慢', pinyin: 'màn', tones: [4], meaningId: 'lambat / pelan', literalTip: 'Lawan kata cepat; 慢慢来 = pelan-pelan saja', exampleZh: '请慢点儿走。', examplePinyin: 'Qǐng màndiǎnr zǒu.', exampleId: 'Silakan jalan pelan-pelan.' },
      { zh: '住', pinyin: 'zhù', tones: [4], meaningId: 'tinggal / menetap', literalTip: '你住在哪儿？', exampleZh: '我住在北京。', examplePinyin: 'Wǒ zhù zài Běijīng.', exampleId: 'Saya tinggal di Beijing.' },
      { zh: '睡觉', pinyin: 'shuìjiào', tones: [4, 4], meaningId: 'tidur', literalTip: '眼/目 di kiri 睡 (mata terpejam)!', exampleZh: '晚上十点我睡觉。', examplePinyin: 'Wǎnshang shí diǎn wǒ shuìjiào.', exampleId: 'Jam 10 malam saya tidur.' },
    ],
    grammarQuiz: [
      { id: 'u12q1', promptId: 'Untuk menanyakan "Bagaimana cuaca hari ini?", kata yang ditaruh di belakang adalah:', sentence: '今天天气_____？', options: ['怎么', '怎么样', '多少'], answer: '怎么样', explainId: '怎么样 menanyakan kondisi atau penilaian di posisi predikat/belakang kalimat.' },
      { id: 'u12q2', promptId: 'Untuk menanyakan "Bagaimana cara menulis kata ini?", letakkan ____ di depan kata kerja 写:', sentence: '这个字_____写？', options: ['怎么样', '怎么', '哪儿'], answer: '怎么', explainId: '怎么 + kata kerja selalu menanyakan cara.' },
    ],
  },
  {
    unit: 13,
    phase: 5,
    phaseTitle: 'Fase 5 · Transportasi & Kalimat Utuh',
    titleZh: '出行与能力',
    titleId: 'Transportasi & Kemampuan (会/能)',
    focusTip: 'Naik kendaraan duduk (pesawat/taksi) selalu memakai 坐 (duduk/naik)!',
    grammar: {
      pattern: '坐 + Kendaraan + 去 + Tempat · 会 / 能 + V',
      titleId: 'Naik Transportasi & Menyatakan Bisa',
      explainId: '会 dipakai untuk "bisa karena belajar" (bisa menyetir, bisa Mandarin) atau "akan". 能 dipakai untuk "mampu secara situasi/izin".',
      examples: [
        { zh: '我坐飞机回北京。', pinyin: 'Wǒ zuò fēijī huí Běijīng.', id: 'Saya naik pesawat kembali ke Beijing.' },
        { zh: '她会开出租车。', pinyin: 'Tā huì kāi chūzūchē.', id: 'Dia bisa menyetir taksi.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你怎么去火车站？', pinyin: 'Nǐ zěnme qù huǒchēzhàn?', id: 'Kamu ke stasiun kereta naik apa?' },
      { speaker: 'B', zh: '我坐出租车去，今天我能准时到！', pinyin: 'Wǒ zuò chūzūchē qù, jīntiān wǒ néng zhǔnshí dào!', id: 'Saya naik taksi, hari ini saya bisa datang tepat waktu!' },
    ],
    words: [
      { zh: '去', pinyin: 'qù', tones: [4], meaningId: 'pergi (menjauh dari pembicara)', literalTip: 'Vokal "u" dibaca bulat ü: chǜ', exampleZh: '我们去中国！', examplePinyin: 'Wǒmen qù Zhōngguó!', exampleId: 'Ayo kita pergi ke Tiongkok!' },
      { zh: '来', pinyin: 'lái', tones: [2], meaningId: 'datang (mendekat ke pembicara)', literalTip: 'Kebalikan langsung dari 去', exampleZh: '欢迎来我家！', examplePinyin: 'Huānyíng lái wǒ jiā!', exampleId: 'Selamat datang ke rumahku!' },
      { zh: '回', pinyin: 'huí', tones: [2], meaningId: 'kembali / pulang', literalTip: 'Kotak di dalam kotak = kembali ke rumah/asal', exampleZh: '你几点回家？', examplePinyin: 'Nǐ jǐ diǎn huí jiā?', exampleId: 'Jam berapa kamu pulang ke rumah?' },
      { zh: '坐', pinyin: 'zuò', tones: [4], meaningId: 'duduk / naik (kendaraan)', literalTip: 'Dua orang 从 duduk di atas tanah 土', exampleZh: '我坐飞机去北京。', examplePinyin: 'Wǒ zuò fēijī qù Běijīng.', exampleId: 'Aku naik pesawat ke Beijing.' },
      { zh: '飞机', pinyin: 'fēijī', tones: [1, 1], meaningId: 'pesawat terbang', literalTip: '飞 (terbang) + 机 (mesin)', exampleZh: '他不想坐飞机。', examplePinyin: 'Tā bù xiǎng zuò fēijī.', exampleId: 'Dia tidak ingin naik pesawat.' },
      { zh: '出租车', pinyin: 'chūzūchē', tones: [1, 1, 1], meaningId: 'taksi', literalTip: 'Ketiganya Nada 1 tinggi rata!', exampleZh: '我们坐出租车回酒店。', examplePinyin: 'Wǒmen zuò chūzūchē huí jiǔdiàn.', exampleId: 'Kita naik taksi pulang ke hotel.' },
      { zh: '开', pinyin: 'kāi', tones: [1], meaningId: 'menyetir / membuka / menyalakan', literalTip: '开车 = menyetir mobil; 开电脑 = menyalakan komputer', exampleZh: '我爸爸会开车。', examplePinyin: 'Wǒ bàba huì kāichē.', exampleId: 'Ayahku bisa menyetir mobil.' },
      { zh: '会', pinyin: 'huì', tones: [4], meaningId: 'bisa (keterampilan) / akan', literalTip: 'Dipakai untuk kemampuan hasil belajar atau prediksi masa depan', exampleZh: '你会说汉语吗？', examplePinyin: 'Nǐ huì shuō Hànyǔ ma?', exampleId: 'Apakah kamu bisa berbicara bahasa Mandarin?' },
      { zh: '能', pinyin: 'néng', tones: [2], meaningId: 'bisa / sanggup / boleh', literalTip: 'Saya bisa karena kondisi atau waktu memungkinkan', exampleZh: '明天你能来吗？', examplePinyin: 'Míngtiān nǐ néng lái ma?', exampleId: 'Apakah besok kamu bisa datang?' },
      { zh: '看见', pinyin: 'kànjiàn', tones: [4, 4], meaningId: 'terlihat / tertangkap mata', literalTip: '看 (usaha melihat) + 见 (berhasil melihat objek)', exampleZh: '我看见他了！', examplePinyin: 'Wǒ kànjiàn tā le!', exampleId: 'Aku sudah melihatnya!' },
    ],
    grammarQuiz: [
      { id: 'u13q1', promptId: 'Pilih kata yang tepat untuk "naik pesawat":', sentence: '他今天_____飞机去北京。', options: ['坐', '看', '写'], answer: '坐', explainId: 'Untuk naik pesawat, kereta, atau taksi gunakan 坐 (zuò).' },
      { id: 'u13q2', promptId: 'Kalimat "Dia bisa berbicara bahasa Mandarin" (hasil belajar):', sentence: '她_____说汉语。', options: ['会', '去', '回'], answer: '会', explainId: '会 menyatakan keterampilan yang dipelajari seperti bahasa atau menyetir.' },
    ],
  },
  {
    unit: 14,
    phase: 5,
    phaseTitle: 'Fase 5 · Transportasi & Kalimat Utuh',
    titleZh: '兴趣与物品',
    titleId: 'Hobi, Hewan & Benda Rumah',
    focusTip: 'Kata "喜欢" bisa diikuti kata benda (猫) maupun aktivitas (看电影)!',
    grammar: {
      pattern: 'Subjek + 喜欢 + (Kata Kerja) + Objek',
      titleId: 'Mengungkapkan Kesukaan & Kebiasaan',
      explainId: 'Dalam Mandarin, setelah 喜欢 atau 想 kamu langsung taruh kata kerja berikutnya tanpa kata "untuk/to".',
      examples: [
        { zh: '我喜欢看中国电影。', pinyin: 'Wǒ xǐhuan kàn Zhōngguó diànyǐng.', id: 'Saya suka menonton film Tiongkok.' },
        { zh: '椅子上有一只猫。', pinyin: 'Yǐzi shàng yǒu yì zhī māo.', id: 'Di atas kursi ada seekor kucing.' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你喜欢小猫还是小狗？', pinyin: 'Nǐ xǐhuan xiǎomāo háishi xiǎogǒu?', id: 'Kamu suka kucing atau anjing kecil?' },
      { speaker: 'B', zh: '我都喜欢！我家有一只猫和一只狗。', pinyin: 'Wǒ dōu xǐhuan! Wǒ jiā yǒu yì zhī māo hé yì zhī gǒu.', id: 'Keduanya suka! Di rumahku ada seekor kucing dan seekor anjing.' },
    ],
    words: [
      { zh: '喜欢', pinyin: 'xǐhuan', tones: [3, 0], meaningId: 'suka / menyukai', literalTip: 'Lebih ringan dari 爱; cocok untuk hobi & benda sehari-hari', exampleZh: '你喜欢喝茶吗？', examplePinyin: 'Nǐ xǐhuan hē chá ma?', exampleId: 'Apakah kamu suka minum teh?' },
      { zh: '电视', pinyin: 'diànshì', tones: [4, 4], meaningId: 'televisi / TV', literalTip: '电 (listrik) + 视 (melihat)', exampleZh: '晚上我看电视。', examplePinyin: 'Wǎnshang wǒ kàn diànshì.', exampleId: 'Malam hari aku menonton TV.' },
      { zh: '电脑', pinyin: 'diànnǎo', tones: [4, 3], meaningId: 'komputer / laptop', literalTip: '电 (listrik) + 脑 (otak) = otak listrik!', exampleZh: '我用电脑学习。', examplePinyin: 'Wǒ yòng diànnǎo xuéxí.', exampleId: 'Saya memakai komputer untuk belajar.' },
      { zh: '电影', pinyin: 'diànyǐng', tones: [4, 3], meaningId: 'film', literalTip: '电 (listrik) + 影 (bayangan)', exampleZh: '明天我们去看电影。', examplePinyin: 'Míngtiān wǒmen qù kàn diànyǐng.', exampleId: 'Besok kita pergi menonton film.' },
      { zh: '猫', pinyin: 'māo', tones: [1], meaningId: 'kucing', literalTip: 'Suaranya mirip "meong" pada Nada 1 datar!', exampleZh: '小猫在睡觉。', examplePinyin: 'Xiǎomāo zài shuìjiào.', exampleId: 'Kucing kecil sedang tidur.' },
      { zh: '狗', pinyin: 'gǒu', tones: [3], meaningId: 'anjing', literalTip: 'Radikal hewan 犭 sama seperti 猫', exampleZh: '我有一只小狗。', examplePinyin: 'Wǒ yǒu yì zhī xiǎogǒu.', exampleId: 'Saya punya seekor anjing kecil.' },
      { zh: '桌子', pinyin: 'zhuōzi', tones: [1, 0], meaningId: 'meja', literalTip: 'Punya unsur kayu 木 di bagian bawah', exampleZh: '桌子上有一本书。', examplePinyin: 'Zhuōzi shàng yǒu yì běn shū.', exampleId: 'Di atas meja ada sebuah buku.' },
      { zh: '椅子', pinyin: 'yǐzi', tones: [3, 0], meaningId: 'kursi', literalTip: 'Juga berunsur kayu 木 di sebelah kiri', exampleZh: '请坐这把椅子。', examplePinyin: 'Qǐng zuò zhè bǎ yǐzi.', exampleId: 'Silakan duduk di kursi ini.' },
      { zh: '衣服', pinyin: 'yīfu', tones: [1, 0], meaningId: 'baju / pakaian', literalTip: 'Sering berpasangan dengan 买 (beli) atau 穿 (pakai)', exampleZh: '她买了很多新衣服。', examplePinyin: 'Tā mǎile hěn duō xīn yīfu.', exampleId: 'Dia membeli banyak baju baru.' },
      { zh: '东西', pinyin: 'dōngxi', tones: [1, 0], meaningId: 'barang / benda / sesuatu', literalTip: '东 (timur) + 西 (barat) bersama bermakna barang!', exampleZh: '我在商店买东西。', examplePinyin: 'Wǒ zài shāngdiàn mǎi dōngxi.', exampleId: 'Saya berbelanja barang di toko.' },
    ],
    grammarQuiz: [
      { id: 'u14q1', promptId: 'Kata Mandarin untuk komputer ("otak listrik") adalah:', sentence: '他在用_____工作。', options: ['电视', '电脑', '电影'], answer: '电脑', explainId: '电 (listrik) + 脑 (otak) = 电脑 (komputer/laptop).' },
      { id: 'u14q2', promptId: 'Benda pasangan untuk meletakkan buku adalah:', sentence: '书在_____上。', options: ['桌子', '猫', '医院'], answer: '桌子', explainId: '桌子 (zhuōzi) berarti meja.' },
    ],
  },
  {
    unit: 15,
    phase: 5,
    phaseTitle: 'Fase 5 · Transportasi & Kalimat Utuh',
    titleZh: '句式与量词总结',
    titleId: 'Partikel, Negasi & Kalimat Utuh',
    focusTip: 'Ingat aturan emas: 有 (punya) SELALU dinegasikan pakai 没 (没有), JANGAN pernah 不有!',
    grammar: {
      pattern: '没(有) · [Kalimat] + 吗？ · [Subjek] + 呢？ · Perubahan 了',
      titleId: 'Penguasaan Inti Struktur HSK 1',
      explainId: '1) 没 menyangkal 有 & kejadian lampau. 2) 吗 menanya Ya/Tidak. 3) 呢 menanya balik ("Kalau kamu bagaimana?"). 4) 了 menandakan aksi selesai atau keadaan baru.',
      examples: [
        { zh: '我没有钱。', pinyin: 'Wǒ méi yǒu qián.', id: 'Aku tidak punya uang (ingat: pakai 没, bukan 不!).' },
        { zh: '我买了两本书，你呢？', pinyin: 'Wǒ mǎile liǎng běn shū, nǐ ne?', id: 'Aku beli 2 buku, kalau kamu?' },
      ],
    },
    dialogue: [
      { speaker: 'A', zh: '你买苹果了吗？', pinyin: 'Nǐ mǎi píngguǒ le ma?', id: 'Apakah kamu sudah membeli apel?' },
      { speaker: 'B', zh: '买了，我买了十块钱的苹果，很好吃！', pinyin: 'Mǎi le, wǒ mǎile shí kuài qián de píngguǒ, hěn hǎochī!', id: 'Sudah, aku beli apel sepuluh yuan, enak banget!' },
    ],
    words: [
      { zh: '不', pinyin: 'bù', tones: [4], meaningId: 'tidak / bukan (masa kini/kebiasaan)', literalTip: 'Berubah jadi Nada 2 (bú) sebelum Nada 4 seperti 不是', exampleZh: '我不喝茶。', examplePinyin: 'Wǒ bù hē chá.', exampleId: 'Saya tidak minum teh.' },
      { zh: '没', pinyin: 'méi', tones: [2], meaningId: 'tidak punya / belum terjadi', literalTip: 'Satu-satunya negasi yang sah untuk kata 有 (没有)!', exampleZh: '昨天我没去学校。', examplePinyin: 'Zuótiān wǒ méi qù xuéxiào.', exampleId: 'Kemarin saya tidak pergi ke sekolah.' },
      { zh: '有', pinyin: 'yǒu', tones: [3], meaningId: 'memiliki / ada', literalTip: 'Bisa berarti kepunyaan atau "ada di suatu tempat"', exampleZh: '我有一个姐姐。', examplePinyin: 'Wǒ yǒu yí ge jiějie.', exampleId: 'Saya punya satu kakak perempuan.' },
      { zh: '吗', pinyin: 'ma', tones: [0], meaningId: 'apakah...? (tanya Ya/Tidak)', literalTip: 'Tempel di ujung kalimat pernyataan untuk mengubahnya jadi pertanyaan', exampleZh: '你是老师吗？', examplePinyin: 'Nǐ shì lǎoshī ma?', exampleId: 'Apakah Anda seorang guru?' },
      { zh: '呢', pinyin: 'ne', tones: [0], meaningId: 'bagaimana dengan...? / di mana...?', literalTip: 'Memantulkan pertanyaan kembali ke lawan bicara: 我很好，你呢？', exampleZh: '我很好，你呢？', examplePinyin: 'Wǒ hěn hǎo, nǐ ne?', exampleId: 'Aku baik-baik saja, kalau kamu?' },
      { zh: '了', pinyin: 'le', tones: [0], meaningId: 'sudah / penanda perubahan keadaan', literalTip: '下雨了 (Sudah turun hujan!); 我买了一本书', exampleZh: '我已经吃饭了。', examplePinyin: 'Wǒ yǐjīng chīfàn le.', exampleId: 'Saya sudah makan.' },
      { zh: '和', pinyin: 'hé', tones: [2], meaningId: 'dan / bersama (khusus kata benda)', literalTip: 'Menghubungkan 2 kata benda/orang, JANGAN dipakai menyambung dua kalimat lengkap!', exampleZh: '我和朋友去饭店。', examplePinyin: 'Wǒ hé péngyou qù fàndiàn.', exampleId: 'Saya dan teman pergi ke restoran.' },
      { zh: '个', pinyin: 'gè', tones: [4], meaningId: 'buah / orang (pengukur paling umum)', literalTip: 'Pengukur serbaguna kalau lupa satuan spesifik!', exampleZh: '三个学生', examplePinyin: 'sān ge xuésheng', exampleId: 'tiga orang murid' },
      { zh: '本', pinyin: 'běn', tones: [3], meaningId: 'jilid / eksemplar (buku & majalah)', literalTip: 'Selalu pakai 本 antara angka dan kata 书 (buku)', exampleZh: '我要买两本书。', examplePinyin: 'Wǒ yào mǎi liǎng běn shū.', exampleId: 'Aku mau beli dua buku.' },
      { zh: '钱', pinyin: 'qián', tones: [2], meaningId: 'uang', literalTip: 'Radikal logam 钅 di kiri — dulunya uang dibuat dari logam!', exampleZh: '这个多少钱？', examplePinyin: 'Zhège duōshao qián?', exampleId: 'Ini berapa harganya?' },
    ],
    grammarQuiz: [
      { id: 'u15q1', promptId: 'Pilih kata negasi yang benar untuk "Saya tidak punya buku":', sentence: '我_____有书。', options: ['不', '没', '了'], answer: '没', explainId: '有 SELALU dinegasikan dengan 没 (没有), tidak pernah dengan 不.' },
      { id: 'u15q2', promptId: 'Pengukur khusus antara angka dan buku (书) adalah:', sentence: '我有四_____汉语书。', options: ['本', '个', '岁'], answer: '本', explainId: 'Untuk buku cetak selalu gunakan satuan 本 (běn).' },
    ],
  },
]

export const ALL_HSK1_WORDS: readonly Hsk1Word[] = HSK1_UNITS.flatMap((u) => u.words)
