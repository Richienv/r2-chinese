/**
 * Curated Mandarin near-synonym and confusion clusters used both for upfront
 * disambiguation (without leaking target Hanzi/pinyin) and empathetic
 * near-synonym retry feedback across HSK 4A, 汉语教程, and Kerja.
 *
 * Pure data module (no non-relative imports) so Node test runners load it directly.
 */

export interface SynonymMember {
  zh: string
  pinyin: string
  /** Role / collocation distinction in Indonesian (must not contain this member's Hanzi or pinyin). */
  id: string
  /** Role / collocation distinction in English (must not contain this member's Hanzi or pinyin). */
  en: string
}

export interface SynonymCluster {
  id: string
  members: SynonymMember[]
}

export const SYNONYM_CLUSTERS: readonly SynonymCluster[] = [
  {
    id: 'pair-classifiers',
    members: [
      {
        zh: '对',
        pinyin: 'duì',
        id: 'kata bantu bilangan untuk pasangan yang serasi/saling melengkapi (suami-istri, anting, mata)',
        en: 'classifier for a matched or complementary couple/pair (spouses, earrings, eyes)',
      },
      {
        zh: '双',
        pinyin: 'shuāng',
        id: 'untuk dua benda simetris yang selalu dipakai bersama (sumpit, sepatu, kaus kaki) atau makna ganda',
        en: 'for symmetric pairs used together (chopsticks, shoes, socks) or "double"',
      },
      {
        zh: '副',
        pinyin: 'fù',
        id: 'kata bantu bilangan khusus untuk kacamata, sarung tangan, atau satu set alat',
        en: 'classifier specifically for glasses, gloves, or a matched set',
      },
    ],
  },
  {
    id: 'two-forms',
    members: [
      {
        zh: '俩',
        pinyin: 'liǎ',
        id: '1 karakter gabungan orang + dua, dipakai langsung setelah kata ganti (kalian/kita berdua) tanpa kata satuan',
        en: 'single-character fusion meaning "the two of…" right after a pronoun, never taking a classifier',
      },
      {
        zh: '两',
        pinyin: 'liǎng',
        id: 'dipakai sebelum kata bantu bilangan atau satuan jumlah (dua orang, dua ribu)',
        en: 'used before classifiers or counting units (two people, two thousand)',
      },
      {
        zh: '二',
        pinyin: 'èr',
        id: 'angka hitung murni, nomor urut, atau angka matematika',
        en: 'used for counting numbers, ordinals, and math',
      },
    ],
  },
  {
    id: 'just-time',
    members: [
      {
        zh: '刚',
        pinyin: 'gāng',
        id: 'kata keterangan 1 karakter yang ditaruh tepat sebelum kata kerja untuk aksi yang baru saja terjadi',
        en: '1-character adverb placed right before the verb for an action that happened just now',
      },
      {
        zh: '刚才',
        pinyin: 'gāngcái',
        id: 'kata benda waktu 2 karakter ("tadi / barusan") yang bisa berdiri di awal kalimat atau sebelum subjek',
        en: '2-character time noun ("just a moment ago") that can sit before the subject',
      },
    ],
  },
  {
    id: 'or-choice',
    members: [
      {
        zh: '还是',
        pinyin: 'háishi',
        id: 'dipakai dalam kalimat tanya pilihan ("A atau B?") atau bermakna "mending / tetap lebih suka"',
        en: 'used in choice questions ("A or B?") or to mean "had better / still prefer"',
      },
      {
        zh: '或者',
        pinyin: 'huòzhě',
        id: 'dipakai untuk "atau" dalam kalimat pernyataan atau tawaran rencana, bukan kalimat tanya pilihan',
        en: 'used for "or" in declarative statements and plans, not direct choice questions',
      },
    ],
  },
  {
    id: 'but-contrast',
    members: [
      {
        zh: '但是',
        pinyin: 'dànshì',
        id: 'kata hubung "tapi" yang paling umum dan netral di awal klausa kedua',
        en: 'the most general, neutral "but" at the start of the contrasting clause',
      },
      {
        zh: '可是',
        pinyin: 'kěshì',
        id: 'kata hubung "tapi" yang bernuansa lebih lisan dan halus daripada bentuk formal',
        en: 'conversational, softer "but / however" in spoken Mandarin',
      },
      {
        zh: '不过',
        pinyin: 'búguò',
        id: '"tapi / cuma saja" yang memperhalus atau memberi catatan tambahan setelah kalimat sebelumnya',
        en: '"but / only / it’s just that" — softens or adds a mild caveat',
      },
      {
        zh: '却',
        pinyin: 'què',
        id: 'kata keterangan 1 karakter ("tapi malah") yang wajib diletakkan setelah subjek, bukan di awal kalimat',
        en: '1-character adverb ("yet / however") placed after the subject, never before it',
      },
    ],
  },
  {
    id: 'although-concession',
    members: [
      {
        zh: '虽然',
        pinyin: 'suīrán',
        id: '"walaupun" yang paling netral, biasa dipasangkan dengan "tapi"',
        en: 'neutral "although", commonly paired with "but"',
      },
      {
        zh: '尽管',
        pinyin: 'jǐnguǎn',
        id: '"meskipun" yang menekankan fakta yang sudah nyata atau sedikit lebih formal',
        en: '"even though / despite", slightly stronger or more formal concession',
      },
    ],
  },
  {
    id: 'because-reason',
    members: [
      {
        zh: '因为',
        pinyin: 'yīnwèi',
        id: '"karena" yang paling umum dalam percakapan sehari-hari',
        en: 'everyday "because", commonly paired with "so"',
      },
      {
        zh: '由于',
        pinyin: 'yóuyú',
        id: '"disebabkan oleh / dikarenakan" yang lebih formal dan ditaruh sebelum klausa hasil',
        en: 'more formal "due to / owing to", placed at the start of the reason clause',
      },
    ],
  },
  {
    id: 'if-condition',
    members: [
      {
        zh: '如果',
        pinyin: 'rúguǒ',
        id: '"kalau / jika" standar yang cocok untuk situasi santai maupun kerja',
        en: 'standard neutral "if" for both casual and workplace sentences',
      },
      {
        zh: '要是',
        pinyin: 'yàoshi',
        id: '"kalau" yang terasa lebih santai dan sering dipakai dalam obrolan lisan',
        en: 'more colloquial, spoken "if / suppose"',
      },
    ],
  },
  {
    id: 'therefore-result',
    members: [
      {
        zh: '所以',
        pinyin: 'suǒyǐ',
        id: '"jadi / makanya" yang paling umum untuk menyatakan akibat',
        en: 'everyday "so / therefore" introducing a result',
      },
      {
        zh: '因此',
        pinyin: 'yīncǐ',
        id: '"oleh karena itu" yang lebih rapi dan formal untuk tulisan atau rapat',
        en: 'more formal "therefore / consequently" in writing or explanations',
      },
    ],
  },
  {
    id: 'only-if-condition',
    members: [
      {
        zh: '只有……才……',
        pinyin: 'zhǐyǒu…cái…',
        id: 'syarat mutlak ("hanya kalau … baru bisa …") — satu-satunya jalan',
        en: 'necessary condition ("only if … then …") — the sole requirement',
      },
      {
        zh: '只要……就……',
        pinyin: 'zhǐyào…jiù…',
        id: 'syarat cukup ("asal … langsung …") — cukup itu saja sudah terpenuhi',
        en: 'sufficient condition ("as long as … then …") — that alone is enough',
      },
      {
        zh: '只有',
        pinyin: 'zhǐyǒu',
        id: '"hanya kalau / cuma ada" — menandai satu-satunya syarat atau jumlah tunggal',
        en: '"only if / only have" — marks a sole requirement or single option',
      },
      {
        zh: '只要',
        pinyin: 'zhǐyào',
        id: '"asal saja" — menandai syarat yang sudah cukup',
        en: '"as long as" — marks a sufficient condition',
      },
    ],
  },
  {
    id: 'not-only-pattern',
    members: [
      {
        zh: '不仅',
        pinyin: 'bùjǐn',
        id: 'kata hubung 2 karakter ("tidak hanya") yang dipakai dalam klausa pertama lalu disambung "juga/bahkan"',
        en: '2-character conjunction ("not only") in the first clause, paired with "also / moreover"',
      },
      {
        zh: '不但……而且……',
        pinyin: 'búdàn…érqiě…',
        id: 'pola lengkap dua bagian ("tidak hanya … melainkan juga …")',
        en: 'two-part correlative frame ("not only … but also …")',
      },
    ],
  },
  {
    id: 'according-to',
    members: [
      {
        zh: '按照',
        pinyin: 'ànzhào',
        id: 'kata depan 2 karakter ("berdasarkan / mengikuti aturan atau jadwal tertentu")',
        en: '2-character preposition ("according to / following a rule or plan")',
      },
      {
        zh: '按',
        pinyin: 'àn',
        id: 'kata depan 1 karakter ("menurut / sesuai") yang lebih singkat',
        en: '1-character shorter preposition ("according to / by")',
      },
      {
        zh: '符合',
        pinyin: 'fúhé',
        id: 'kata kerja ("cocok / memenuhi syarat atau standar")',
        en: 'verb meaning "to match / to meet (criteria or standards)"',
      },
    ],
  },
  {
    id: 'on-time',
    members: [
      {
        zh: '按时',
        pinyin: 'ànshí',
        id: 'kata keterangan ("sesuai jadwal / tenggat waktu yang ditentukan")',
        en: 'adverb meaning "on schedule / by the deadline"',
      },
      {
        zh: '准时',
        pinyin: 'zhǔnshí',
        id: 'kata sifat ("tepat pada jam yang dijanjikan, tidak telat")',
        en: 'adjective meaning "punctual / right on the dot"',
      },
      {
        zh: '及时',
        pinyin: 'jíshí',
        id: 'kata keterangan ("sigap / tepat pada waktunya saat dibutuhkan sebelum terlambat")',
        en: 'adverb meaning "timely / right when needed before it is too late"',
      },
    ],
  },
  {
    id: 'immediately',
    members: [
      {
        zh: '马上',
        pinyin: 'mǎshàng',
        id: '"langsung / sebentar lagi" yang sangat umum di percakapan sehari-hari',
        en: 'everyday spoken "right away / in a moment"',
      },
      {
        zh: '立即',
        pinyin: 'lìjí',
        id: '"segera / detik itu juga" yang bernada lebih tegas atau formal',
        en: 'more formal or urgent "immediately / at once"',
      },
    ],
  },
  {
    id: 'approximately',
    members: [
      {
        zh: '大约',
        pinyin: 'dàyuē',
        id: 'kata keterangan sebelum angka atau waktu untuk perkiraan yang agak rapi',
        en: 'adverb placed before a number or time for an estimate',
      },
      {
        zh: '大概',
        pinyin: 'dàgài',
        id: 'kata keterangan untuk perkiraan ("kira-kira") atau tebakan situasi ("kayaknya")',
        en: 'adverb for rough quantity ("roughly") or probability ("probably")',
      },
      {
        zh: '左右',
        pinyin: 'zuǒyòu',
        id: 'ditaruh SETELAH angka atau waktu ("sekitar / kurang lebih")',
        en: 'placed AFTER a number or time expression ("around / more or less")',
      },
    ],
  },
  {
    id: 'must-have-to',
    members: [
      {
        zh: '必须',
        pinyin: 'bìxū',
        id: 'kata keterangan ("wajib / harus") untuk aturan atau keharusan kuat',
        en: 'strong obligation ("must / required to")',
      },
      {
        zh: '得',
        pinyin: 'děi',
        id: 'kata bantu 1 karakter bernada lisan ("mesti / harus")',
        en: 'spoken 1-character modal ("have to / gotta")',
      },
      {
        zh: '不得不',
        pinyin: 'bùdébù',
        id: 'ungkapan 3 karakter ("terpaksa / mau tidak mau karena situasi")',
        en: '3-character expression ("have no choice but to")',
      },
      {
        zh: '只好',
        pinyin: 'zhǐhǎo',
        id: 'kata keterangan 2 karakter ("terpaksa / ya sudahlah cuma bisa begitu")',
        en: '2-character adverb ("have to / the only option left is")',
      },
    ],
  },
  {
    id: 'should-need',
    members: [
      {
        zh: '应该',
        pinyin: 'yīnggāi',
        id: 'kata bantu 2 karakter ("seharusnya / kayaknya")',
        en: '2-character modal ("should / ought to")',
      },
      {
        zh: '该',
        pinyin: 'gāi',
        id: 'kata bantu 1 karakter yang lebih singkat ("sebaiknya / gilirannya")',
        en: 'shorter 1-character modal ("ought to / one’s turn to")',
      },
      {
        zh: '需要',
        pinyin: 'xūyào',
        id: '"membutuhkan / perlu" yang bisa diikuti kata benda maupun kata kerja',
        en: '"to need" — takes either a noun object or a verb',
      },
    ],
  },
  {
    id: 'can-modal',
    members: [
      {
        zh: '能',
        pinyin: 'néng',
        id: 'kemampuan atau kondisi objektif yang memungkinkan sesuatu dilakukan',
        en: 'ability or objective conditions allowing something',
      },
      {
        zh: '会',
        pinyin: 'huì',
        id: 'keterampilan yang dipelajari ("bisa / mahir") atau prediksi ("bakal")',
        en: 'learned skill ("know how to") or future likelihood ("will")',
      },
      {
        zh: '可以',
        pinyin: 'kěyǐ',
        id: 'izin ("boleh") atau usulan yang masuk akal ("bisa saja")',
        en: 'permission ("may / allowed") or reasonable option ("can")',
      },
    ],
  },
  {
    id: 'know-understand',
    members: [
      {
        zh: '了解',
        pinyin: 'liǎojiě',
        id: 'paham latar belakang/detail tentang orang, situasi, atau topik',
        en: 'to understand details/background of a person, situation, or topic',
      },
      {
        zh: '理解',
        pinyin: 'lǐjiě',
        id: 'memahami maksud, perasaan, atau konsep abstrak seseorang',
        en: 'to comprehend someone’s feelings, intent, or a concept',
      },
      {
        zh: '知道',
        pinyin: 'zhīdào',
        id: 'sekadar tahu fakta atau informasi',
        en: 'to know a fact or piece of information',
      },
      {
        zh: '认识',
        pinyin: 'rènshi',
        id: 'kenal dengan seseorang atau mengenali huruf/kata',
        en: 'to know / be acquainted with a person or recognize characters',
      },
    ],
  },
  {
    id: 'think-opinion',
    members: [
      {
        zh: '觉得',
        pinyin: 'juéde',
        id: 'merasa / berpendapat secara santai dan subjektif',
        en: 'casual, personal feeling or opinion ("feel / think")',
      },
      {
        zh: '认为',
        pinyin: 'rènwéi',
        id: 'berpendapat secara lebih serius, beralasan, atau formal',
        en: 'more reasoned or formal judgment ("consider / hold the view")',
      },
      {
        zh: '以为',
        pinyin: 'yǐwéi',
        id: 'mengira / menyangka (sering ternyata keliru dari kenyataan)',
        en: 'to assume / mistakenly think (often contrasted with reality)',
      },
    ],
  },
  {
    id: 'wear-put-on',
    members: [
      {
        zh: '穿',
        pinyin: 'chuān',
        id: 'memakai pakaian utama seperti baju, celana, atau sepatu',
        en: 'to wear main garments (clothes, pants, shoes)',
      },
      {
        zh: '戴',
        pinyin: 'dài',
        id: 'memakai aksesori seperti kacamata, topi, jam tangan, atau cincin',
        en: 'to wear accessories (glasses, hat, watch, ring)',
      },
    ],
  },
  {
    id: 'help-verbs',
    members: [
      {
        zh: '帮',
        pinyin: 'bāng',
        id: 'kata kerja 1 karakter ("membantu") yang langsung diikuti orang yang dibantu',
        en: '1-character verb ("help") followed directly by the person',
      },
      {
        zh: '帮忙',
        pinyin: 'bāngmáng',
        id: 'kata kerja-objek ("menolong") — tidak langsung diikuti objek di belakangnya',
        en: 'separable verb-object ("lend a hand") — cannot take an object directly after it',
      },
      {
        zh: '帮助',
        pinyin: 'bāngzhù',
        id: 'kata kerja/benda 2 karakter ("membantu / bantuan") yang bisa diikuti objek maupun berdiri sebagai kata benda',
        en: '2-character verb or noun ("help / assistance") that takes objects',
      },
    ],
  },
  {
    id: 'method-way',
    members: [
      {
        zh: '方法',
        pinyin: 'fāngfǎ',
        id: 'cara, metode, atau teknik sistematis untuk melakukan sesuatu',
        en: 'systematic method, technique, or approach',
      },
      {
        zh: '办法',
        pinyin: 'bànfǎ',
        id: 'cara atau jalan keluar praktis untuk menyelesaikan masalah',
        en: 'practical way or solution to handle a problem',
      },
    ],
  },
  {
    id: 'change-words',
    members: [
      {
        zh: '改变',
        pinyin: 'gǎibiàn',
        id: 'kata kerja ("mengubah" sesuatu atau kebiasaan/rencana)',
        en: 'verb meaning to alter/change something deliberately',
      },
      {
        zh: '变化',
        pinyin: 'biànhuà',
        id: 'kata benda/kerja ("perubahan" yang terlihat dari waktu ke waktu)',
        en: 'noun/verb for an observed shift or transformation over time',
      },
      {
        zh: '变',
        pinyin: 'biàn',
        id: 'kata kerja 1 karakter ("berubah menjadi …") sebelum pelengkap atau sifat',
        en: '1-character verb ("become / turn into") before a complement',
      },
    ],
  },
  {
    id: 'repair-words',
    members: [
      {
        zh: '修理',
        pinyin: 'xiūlǐ',
        id: 'memperbaiki barang yang rusak (sepeda, alat, perabot)',
        en: 'to repair/fix a broken item or device',
      },
      {
        zh: '维修',
        pinyin: 'wéixiū',
        id: 'servis dan pemeliharaan teknis (mesin, AC, kendaraan, sistem)',
        en: 'technical maintenance and servicing (equipment, systems)',
      },
      {
        zh: '修',
        pinyin: 'xiū',
        id: 'kata kerja 1 karakter yang ringkas untuk memperbaiki atau membangun',
        en: 'concise 1-character verb ("fix / mend")',
      },
    ],
  },
  {
    id: 'gift-words',
    members: [
      {
        zh: '礼物',
        pinyin: 'lǐwù',
        id: 'hadiah atau kado personal (ulang tahun, perayaan, teman)',
        en: 'personal gift or present (birthdays, friends)',
      },
      {
        zh: '礼品',
        pinyin: 'lǐpǐn',
        id: 'bingkisan, suvenir, atau hadiah resmi/toko',
        en: 'gift items, merchandise, or formal/corporate presents',
      },
    ],
  },
  {
    id: 'rule-words',
    members: [
      {
        zh: '规则',
        pinyin: 'guīzé',
        id: 'aturan tertulis atau ketentuan resmi (permainan, lalu lintas, sistem)',
        en: 'explicit rules or regulations (games, traffic, systems)',
      },
      {
        zh: '规矩',
        pinyin: 'guīju',
        id: 'aturan kebiasaan, tata krama, atau norma sosial/keluarga',
        en: 'established customs, etiquette, or social norms',
      },
    ],
  },
  {
    id: 'scenery-words',
    members: [
      {
        zh: '风景',
        pinyin: 'fēngjǐng',
        id: 'pemandangan alam/wisata yang umum ("scenery")',
        en: 'general scenic landscape or tourist scenery',
      },
      {
        zh: '景色',
        pinyin: 'jǐngsè',
        id: 'suasana pemandangan yang terlihat di satu tempat atau waktu tertentu',
        en: 'specific visual scene or view at a place/moment',
      },
      {
        zh: '风光',
        pinyin: 'fēngguāng',
        id: 'keindahan panorama khas suatu daerah/negeri',
        en: 'characteristic scenic beauty of a region',
      },
    ],
  },
  {
    id: 'happy-words',
    members: [
      {
        zh: '开心',
        pinyin: 'kāixīn',
        id: 'senang dan ceria di momen saat ini',
        en: 'cheerful and happy in the moment',
      },
      {
        zh: '高兴',
        pinyin: 'gāoxìng',
        id: 'gembira atau senang mendengar/mengalami sesuatu',
        en: 'glad / pleased about something',
      },
      {
        zh: '快乐',
        pinyin: 'kuàilè',
        id: 'riang dan bahagia (sering untuk ucapan selamat)',
        en: 'joyful / merry (common in holiday/birthday wishes)',
      },
      {
        zh: '愉快',
        pinyin: 'yúkuài',
        id: 'menyenangkan dan nyaman (untuk suasana, liburan, kerja sama)',
        en: 'pleasant and enjoyable (trip, mood, collaboration)',
      },
      {
        zh: '幸福',
        pinyin: 'xìngfú',
        id: 'bahagia lahir batin dalam kehidupan, keluarga, atau pernikahan',
        en: 'deep life contentment and blessing (family, marriage)',
      },
    ],
  },
  {
    id: 'excited-words',
    members: [
      {
        zh: '激动',
        pinyin: 'jīdòng',
        id: 'emosi tergugah, terharu, atau berdebar penuh perasaan',
        en: 'emotionally stirred, moved, or thrilled',
      },
      {
        zh: '兴奋',
        pinyin: 'xīngfèn',
        id: 'bersemangat tinggi atau antusias penuh energi',
        en: 'energized, hyped, or stimulated with excitement',
      },
    ],
  },
  {
    id: 'hold-event',
    members: [
      {
        zh: '举办',
        pinyin: 'jǔbàn',
        id: 'menyelenggarakan kegiatan, acara promosi, atau pameran',
        en: 'to organize/host an event, campaign, or exhibition',
      },
      {
        zh: '举行',
        pinyin: 'jǔxíng',
        id: 'melangsungkan rapat, upacara, atau pertandingan resmi',
        en: 'to hold a formal meeting, ceremony, or match',
      },
    ],
  },
  {
    id: 'around-location',
    members: [
      {
        zh: '周围',
        pinyin: 'zhōuwéi',
        id: 'area di sekeliling suatu titik atau lingkungan sekitar',
        en: 'surroundings right around something',
      },
      {
        zh: '附近',
        pinyin: 'fùjìn',
        id: 'di dekat sini / lingkungan berjarak dekat',
        en: 'nearby / in the vicinity',
      },
    ],
  },
  {
    id: 'originally',
    members: [
      {
        zh: '本来',
        pinyin: 'běnlái',
        id: '"sebenarnya / memang sejak awal" (sebelum berubah atau dibanding sekarang)',
        en: '"originally / supposed to" (before a change)',
      },
      {
        zh: '原来',
        pinyin: 'yuánlái',
        id: '"semula / yang asli" atau "ternyata baru tahu sekarang"',
        en: '"former / original", or "as it turns out!" upon realization',
      },
    ],
  },
  {
    id: 'again-adv',
    members: [
      {
        zh: '再',
        pinyin: 'zài',
        id: '"lagi" untuk aksi yang BELUM terjadi (rencana nanti / urutan berikutnya)',
        en: '"again" for an action not yet carried out (future or next step)',
      },
      {
        zh: '又',
        pinyin: 'yòu',
        id: '"lagi" untuk kejadian yang SUDAH berulang di masa lalu/sekarang',
        en: '"again" for a repetition that has already happened',
      },
    ],
  },
  {
    id: 'often-usually',
    members: [
      {
        zh: '经常',
        pinyin: 'jīngcháng',
        id: 'sering dilakukan secara rutin (berfrekuensi tinggi)',
        en: 'frequently / regularly',
      },
      {
        zh: '往往',
        pinyin: 'wǎngwǎng',
        id: 'biasanya cenderung begitu dalam situasi tertentu (pola berulang)',
        en: 'tends to happen under certain conditions',
      },
      {
        zh: '平时',
        pinyin: 'píngshí',
        id: 'kata waktu ("di hari biasa / sehari-hari", lawan dari hari libur/khusus)',
        en: 'time noun ("in normal times / ordinarily", vs special days)',
      },
    ],
  },
  {
    id: 'degree-adv',
    members: [
      {
        zh: '挺',
        pinyin: 'tǐng',
        id: '1 karakter bernada lisan ("lumayan / cukup"), sering berakhiran partikel penegas',
        en: 'colloquial 1-character "quite / rather"',
      },
      {
        zh: '比较',
        pinyin: 'bǐjiào',
        id: '2 karakter ("relatif / cukup" dibanding rata-rata atau opsi lain)',
        en: '2-character "relatively / fairly" in comparison',
      },
      {
        zh: '十分',
        pinyin: 'shífēn',
        id: '2 karakter ("sangat / amat sangat") untuk menekankan kadar tinggi',
        en: '2-character "very / extremely" (emphatic degree)',
      },
      {
        zh: '特别',
        pinyin: 'tèbié',
        id: '2 karakter ("sangat / terutama / khusus")',
        en: '2-character "especially / particularly / very"',
      },
    ],
  },
  {
    id: 'really-truly',
    members: [
      {
        zh: '实在',
        pinyin: 'shízài',
        id: 'kata keterangan ("sungguh / memang benar-benar") atau sifat ("tulus/nyata")',
        en: 'adverb ("genuinely / really") or adj ("honest/solid")',
      },
      {
        zh: '确实',
        pinyin: 'quèshí',
        id: 'kata keterangan ("memang benar / terbukti akurat")',
        en: 'adverb ("indeed / truly" confirming a fact)',
      },
      {
        zh: '真正',
        pinyin: 'zhēnzhèng',
        id: 'kata sifat/keterangan ("yang sejati / yang sebenarnya")',
        en: 'adjective ("true / genuine / authentic")',
      },
      {
        zh: '真',
        pinyin: 'zhēn',
        id: '1 karakter ("sungguh / asli") untuk seruan langsung atau lawan dari palsu',
        en: '1-character "really / true" (direct exclamation or opposite of fake)',
      },
    ],
  },
  {
    id: 'all-every',
    members: [
      {
        zh: '一切',
        pinyin: 'yíqiè',
        id: 'kata ganti ("segala sesuatu / semuanya" secara menyeluruh tanpa butuh kata benda)',
        en: 'pronoun ("everything / all things") standing alone or before broad nouns',
      },
      {
        zh: '所有',
        pinyin: 'suǒyǒu',
        id: 'kata sifat/penentu ("semua / seluruh") sebelum kata benda',
        en: 'determiner ("all / every") placed before nouns',
      },
    ],
  },
  {
    id: 'suitable',
    members: [
      {
        zh: '适合',
        pinyin: 'shìhé',
        id: 'kata kerja ("cocok / pas untuk seseorang atau tujuan tertentu") — bisa langsung diikuti objek',
        en: 'verb ("to suit / fit someone or a purpose") — takes an object directly',
      },
      {
        zh: '合适',
        pinyin: 'héshì',
        id: 'kata sifat ("cocok / pas / sesuai") — tidak langsung diikuti objek',
        en: 'adjective ("suitable / fitting") — does not take a direct object',
      },
    ],
  },
  {
    id: 'receive-accept',
    members: [
      {
        zh: '收到',
        pinyin: 'shōudào',
        id: 'menerima pesan, email, berkas, atau kiriman yang masuk',
        en: 'to receive a message, file, letter, or package',
      },
      {
        zh: '接受',
        pinyin: 'jiēshòu',
        id: 'menerima tawaran, saran, tantangan, atau kenyataan secara sadar',
        en: 'to accept an offer, advice, task, or reality',
      },
      {
        zh: '受到',
        pinyin: 'shòudào',
        id: 'mendapat perlakuan atau hal abstrak (pujian, pengaruh, sambutan)',
        en: 'to receive abstract treatment (praise, impact, welcome)',
      },
    ],
  },
  {
    id: 'impression-thought',
    members: [
      {
        zh: '印象',
        pinyin: 'yìnxiàng',
        id: 'kesan atau citra yang membekas di ingatan tentang orang/tempat',
        en: 'impression left in memory by a person or place',
      },
      {
        zh: '感想',
        pinyin: 'gǎnxiǎng',
        id: 'kesan dan buah pikiran setelah membaca, menonton, atau mengalami sesuatu',
        en: 'reflections and thoughts after an experience or event',
      },
    ],
  },
  {
    id: 'experience-words',
    members: [
      {
        zh: '经历',
        pinyin: 'jīnglì',
        id: 'mengalami langsung suatu peristiwa atau riwayat pengalaman hidup',
        en: 'to go through an event, or personal life experience',
      },
      {
        zh: '经验',
        pinyin: 'jīngyàn',
        id: 'pengalaman praktik kerja atau pelajaran yang terkumpul dari bertindak',
        en: 'practical know-how and lessons gained from doing',
      },
    ],
  },
  {
    id: 'life-words',
    members: [
      {
        zh: '生活',
        pinyin: 'shēnghuó',
        id: 'kehidupan sehari-hari, gaya hidup, atau menjalani hidup',
        en: 'daily life, livelihood, or to live one’s life',
      },
      {
        zh: '生命',
        pinyin: 'shēngmìng',
        id: 'nyawa atau kehidupan biologis/eksistensi',
        en: 'biological life or lifespan',
      },
    ],
  },
  {
    id: 'decision-words',
    members: [
      {
        zh: '决定',
        pinyin: 'juédìng',
        id: 'memutuskan / keputusan yang paling umum (pribadi maupun kerja)',
        en: 'general verb/noun "decide / decision"',
      },
      {
        zh: '决策',
        pinyin: 'juécè',
        id: 'keputusan strategis tingkat manajemen atau kebijakan',
        en: 'strategic or policy-level decision-making',
      },
    ],
  },
  {
    id: 'plan-words',
    members: [
      {
        zh: '计划',
        pinyin: 'jìhuà',
        id: 'rencana terstruktur atau jadwal langkah kerja',
        en: 'structured plan or schedule',
      },
      {
        zh: '打算',
        pinyin: 'dǎsuàn',
        id: 'berniat / berencana secara santai atau pribadi',
        en: 'personal intention or informal plan ("intend to")',
      },
      {
        zh: '方案',
        pinyin: 'fāng\'àn',
        id: 'proposal, rancangan opsi, atau skema kerja',
        en: 'proposal, scheme, or concrete option plan',
      },
    ],
  },
  {
    id: 'salary-words',
    members: [
      {
        zh: '工资',
        pinyin: 'gōngzī',
        id: 'gaji atau upah rutin (kata benda sehari-hari)',
        en: 'everyday noun for regular wages or salary',
      },
      {
        zh: '薪资',
        pinyin: 'xīnzī',
        id: 'kompensasi atau paket gaji dalam konteks HR dan rekrutmen',
        en: 'formal HR/recruitment term for compensation and pay',
      },
    ],
  },
  {
    id: 'strength-advantage',
    members: [
      {
        zh: '优点',
        pinyin: 'yōudiǎn',
        id: 'sisi baik atau kelebihan sifat/produk (lawan dari kekurangan)',
        en: 'merit or strong point of a person or thing',
      },
      {
        zh: '优势',
        pinyin: 'yōushì',
        id: 'keunggulan kompetitif dibanding pesaing atau pihak lain',
        en: 'competitive advantage or edge over others',
      },
    ],
  },
  {
    id: 'price-words',
    members: [
      {
        zh: '价格',
        pinyin: 'jiàgé',
        id: 'harga resmi atau istilah harga yang lebih umum/tertulis',
        en: 'standard or formal word for price',
      },
      {
        zh: '价钱',
        pinyin: 'jiàqián',
        id: 'harga barang dalam percakapan belanja sehari-hari',
        en: 'colloquial word for price when shopping',
      },
    ],
  },
  {
    id: 'discount-words',
    members: [
      {
        zh: '打折',
        pinyin: 'dǎ zhé',
        id: 'kata kerja 2 karakter ("memberi / sedang diskon")',
        en: '2-character verb ("to give a discount")',
      },
      {
        zh: '折',
        pinyin: 'zhé',
        id: '1 karakter setelah angka untuk menyebut besarnya diskon (mis. diskon 20% = delapan bagian)',
        en: '1-character noun after a number for the discount rate',
      },
    ],
  },
  {
    id: 'hotel-restaurant',
    members: [
      {
        zh: '饭店',
        pinyin: 'fàndiàn',
        id: 'hotel berbintang atau restoran besar',
        en: 'large restaurant or hotel',
      },
      {
        zh: '旅馆',
        pinyin: 'lǚguǎn',
        id: 'penginapan atau hotel tempat menginap saat bepergian',
        en: 'hotel or guesthouse specifically for lodging',
      },
      {
        zh: '饭馆(儿)',
        pinyin: 'fànguǎnr',
        id: 'rumah makan atau restoran santai khusus makan',
        en: 'casual eatery / restaurant (for dining only)',
      },
    ],
  },
  {
    id: 'okay-replies',
    members: [
      {
        zh: '好的',
        pinyin: 'hǎo de',
        id: 'jawaban sopan dan aman di kantor ("baik, siap dijalankan")',
        en: 'polite, neutral workplace acknowledgment ("okay / will do")',
      },
      {
        zh: '行',
        pinyin: 'xíng',
        id: '1 karakter bernada lisan dan santai antar teman/rekan ("oke, bisa")',
        en: '1-character casual spoken agreement among peers ("works / fine")',
      },
      {
        zh: '可以',
        pinyin: 'kěyǐ',
        id: '"boleh / bisa diatur" — memberi izin atau menyatakan rencana memungkinkan',
        en: '"allowed / workable" — grants permission or confirms feasibility',
      },
      {
        zh: '没问题',
        pinyin: 'méi wèntí',
        id: '3 karakter penuh percaya diri ("siap beres / tidak masalah")',
        en: '3-character confident acceptance ("no problem")',
      },
    ],
  },
  {
    id: 'passive-markers',
    members: [
      {
        zh: '被',
        pinyin: 'bèi',
        id: 'penanda pasif ("di- / oleh") yang paling standar dan bisa dipakai tanpa menyebut pelaku',
        en: 'standard passive marker, can omit the agent',
      },
      {
        zh: '让',
        pinyin: 'ràng',
        id: 'penanda pasif bernada lisan ("dibuat / di- oleh") yang wajib menyebut pelaku',
        en: 'spoken passive marker that must name the agent',
      },
      {
        zh: '叫',
        pinyin: 'jiào',
        id: 'penanda pasif lisan ("oleh") yang wajib menyebut pelaku',
        en: 'colloquial passive marker that requires naming the agent',
      },
    ],
  },
  {
    id: 'a-little',
    members: [
      {
        zh: '一点儿',
        pinyin: 'yìdiǎnr',
        id: 'diletakkan SETELAH kata sifat atau sebelum kata benda ("sedikit")',
        en: 'placed AFTER an adjective or before a noun ("a little bit")',
      },
      {
        zh: '有点儿',
        pinyin: 'yǒudiǎnr',
        id: 'diletakkan SEBELUM kata sifat, biasanya bernuansa keluhan ("agak terlalu…")',
        en: 'placed BEFORE an adjective, often mildly negative ("a bit too…")',
      },
    ],
  },
  {
    id: 'stop-words',
    members: [
      {
        zh: '停',
        pinyin: 'tíng',
        id: 'kata kerja 1 karakter yang ringan untuk berhenti bergerak atau parkir',
        en: '1-character verb to stop moving or park',
      },
      {
        zh: '停止',
        pinyin: 'tíngzhǐ',
        id: 'kata kerja 2 karakter yang lebih formal untuk menghentikan kegiatan/operasi',
        en: '2-character more formal verb ("to cease / halt operations")',
      },
    ],
  },
  {
    id: 'sound-words',
    members: [
      {
        zh: '声音',
        pinyin: 'shēngyīn',
        id: 'kata benda 2 karakter yang umum untuk suara orang maupun bunyi benda',
        en: 'general 2-character noun for voice or sound',
      },
      {
        zh: '声',
        pinyin: 'shēng',
        id: '1 karakter untuk kata satuan bunyi atau suara dalam gabungan kata',
        en: '1-character classifier for sounds or component in compounds',
      },
      {
        zh: '音',
        pinyin: 'yīn',
        id: '1 karakter untuk nada, bunyi ucap, atau suara musik',
        en: '1-character root for tone, pronunciation, or musical sound',
      },
    ],
  },
  {
    id: 'worry-anxious',
    members: [
      {
        zh: '担心',
        pinyin: 'dānxīn',
        id: 'kata kerja ("khawatir / cemas memikirkan seseorang atau hasil")',
        en: 'verb ("to worry about someone or an outcome")',
      },
      {
        zh: '着急',
        pinyin: 'zháo jí',
        id: 'kata sifat ("panik / terburu-buru / gelisah") saat menghadapi situasi mendesak',
        en: 'adjective ("anxious / in a hurry / flustered")',
      },
    ],
  },
  {
    id: 'regret-words',
    members: [
      {
        zh: '遗憾',
        pinyin: 'yíhàn',
        id: 'kata sifat ("disayangkan / merasa sayang sekali") tanpa selalu menyalahkan diri',
        en: 'adjective ("regretful / a pity")',
      },
      {
        zh: '后悔',
        pinyin: 'hòuhuǐ',
        id: 'kata kerja ("menyesali keputusan atau tindakan sendiri di masa lalu")',
        en: 'verb ("to regret a past decision one made")',
      },
    ],
  },
  {
    id: 'leave-words',
    members: [
      {
        zh: '离开',
        pinyin: 'líkāi',
        id: 'kata kerja 2 karakter ("pergi meninggalkan suatu tempat atau orang")',
        en: '2-character verb ("to depart from a place or person")',
      },
      {
        zh: '留',
        pinyin: 'liú',
        id: 'kata kerja 1 karakter ("menyisakan / meninggalkan pesan atau barang / tetap tinggal")',
        en: '1-character verb ("to leave behind / keep / stay")',
      },
    ],
  },
  {
    id: 'emerge-words',
    members: [
      {
        zh: '出现',
        pinyin: 'chūxiàn',
        id: 'muncul atau timbul (masalah, peluang, sosok yang tampak)',
        en: 'to appear or arise (issues, opportunities, figures)',
      },
      {
        zh: '出来',
        pinyin: 'chūlai',
        id: 'keluar dari dalam menuju arah pembicara atau muncul hasilnya',
        en: 'to come out toward the speaker or emerge',
      },
    ],
  },
  {
    id: 'close-shut',
    members: [
      {
        zh: '关',
        pinyin: 'guān',
        id: '1 karakter untuk menutup pintu/jendela atau mematikan lampu/alat',
        en: '1-character verb to close a door/window or switch off a device',
      },
      {
        zh: '合上',
        pinyin: 'héshàng',
        id: '2 karakter ("menutup rapat" benda berlembar/berlipat seperti buku)',
        en: '2-character verb ("to shut / close up" a book or hinged object)',
      },
      {
        zh: '闭',
        pinyin: 'bì',
        id: '1 karakter untuk memejamkan mata atau menutup mulut',
        en: '1-character verb for closing eyes or mouth',
      },
    ],
  },
  {
    id: 'put-place',
    members: [
      {
        zh: '放',
        pinyin: 'fàng',
        id: 'meletakkan atau menaruh secara umum',
        en: 'general verb "to put / place"',
      },
      {
        zh: '摆',
        pinyin: 'bǎi',
        id: 'menata, memajang, atau menyusun rapi di tempatnya',
        en: 'to arrange, display, or set out neatly',
      },
    ],
  },
  {
    id: 'choose-pick',
    members: [
      {
        zh: '挑',
        pinyin: 'tiāo',
        id: 'memilih-milih secara teliti atau agak pemilih (lisan)',
        en: 'spoken "to pick out carefully / be selective"',
      },
      {
        zh: '选',
        pinyin: 'xuǎn',
        id: 'memilih di antara beberapa opsi atau pemungutan suara',
        en: 'to choose among options or elect',
      },
    ],
  },
  {
    id: 'agree-words',
    members: [
      {
        zh: '答应',
        pinyin: 'dāying',
        id: 'menyanggupi permintaan, berjanji, atau mengiyakan ajakan',
        en: 'to agree to a request or make a promise',
      },
      {
        zh: '同意',
        pinyin: 'tóngyì',
        id: 'setuju atau sepakat terhadap pendapat maupun usulan',
        en: 'to agree with an opinion or proposal',
      },
    ],
  },
  {
    id: 'inform-tell',
    members: [
      {
        zh: '通知',
        pinyin: 'tōngzhī',
        id: 'memberi tahu secara resmi / pengumuman (rapat, jadwal, hasil)',
        en: 'to officially notify or announce (meeting, schedule, notice)',
      },
      {
        zh: '告诉',
        pinyin: 'gàosu',
        id: 'memberi tahu atau menceritakan sesuatu secara langsung ke lawan bicara',
        en: 'everyday "to tell / let someone know"',
      },
    ],
  },
  {
    id: 'frequency-classifiers',
    members: [
      {
        zh: '次',
        pinyin: 'cì',
        id: 'kata bantu bilangan frekuensi kejadian ("kali") secara umum',
        en: 'general classifier for occurrences / times an action happens',
      },
      {
        zh: '遍',
        pinyin: 'biàn',
        id: 'kata bantu bilangan "kali" dari awal sampai selesai tuntas (baca, ulang)',
        en: 'classifier for doing something all the way through from start to finish',
      },
    ],
  },
  {
    id: 'noun-classifiers',
    members: [
      {
        zh: '条',
        pinyin: 'tiáo',
        id: 'kata satuan benda panjang/berliku (sungai, celana, ikan, pesan, jalan)',
        en: 'classifier for long, narrow, or winding things (rivers, pants, fish, roads)',
      },
      {
        zh: '张',
        pinyin: 'zhāng',
        id: 'kata satuan benda datar/lembaran (kertas, meja, tiket, foto, wajah)',
        en: 'classifier for flat objects or sheets (paper, tables, tickets, photos)',
      },
      {
        zh: '件',
        pinyin: 'jiàn',
        id: 'kata satuan pakaian atas (kemeja/jaket), urusan/masalah, atau koper',
        en: 'classifier for upper garments, matters/affairs, or luggage',
      },
      {
        zh: '位',
        pinyin: 'wèi',
        id: 'kata satuan sopan untuk orang (dokter, tamu, kandidat, guru)',
        en: 'polite classifier for people (doctors, guests, candidates)',
      },
      {
        zh: '棵',
        pinyin: 'kē',
        id: 'kata satuan khusus untuk pohon atau tanaman',
        en: 'classifier specifically for trees and plants',
      },
    ],
  },
  {
    id: 'we-inclusive',
    members: [
      {
        zh: '咱们',
        pinyin: 'zánmen',
        id: '2 karakter ("kita" termasuk lawan bicara, hangat dalam obrolan)',
        en: '2-character inclusive "we" (including the listener)',
      },
      {
        zh: '咱',
        pinyin: 'zán',
        id: '1 karakter versi singkat logat utara untuk "kita / saya"',
        en: '1-character colloquial northern form for "we / I"',
      },
    ],
  },
  {
    id: 'also-in-addition',
    members: [
      {
        zh: '另外',
        pinyin: 'lìngwài',
        id: '"selain itu / tambahan lagi" untuk membuka topik atau poin baru',
        en: '"besides / in addition" introducing another point or item',
      },
      {
        zh: '再说',
        pinyin: 'zàishuō',
        id: '"lagipula / apalagi" untuk menambah alasan pendukung',
        en: '"moreover / besides" adding a further reason',
      },
      {
        zh: '而且',
        pinyin: 'érqiě',
        id: '"dan juga / bahkan" melanjutkan tingkat yang lebih kuat dalam satu kalimat',
        en: '"and also / furthermore" stepping up within a sentence',
      },
    ],
  },
  {
    id: 'question-problem',
    members: [
      {
        zh: '问题',
        pinyin: 'wèntí',
        id: 'pertanyaan yang ditanyakan atau kendala/problem yang perlu diselesaikan',
        en: 'question to ask or problem to solve',
      },
      {
        zh: '事情',
        pinyin: 'shìqing',
        id: 'urusan, hal, atau kejadian yang sedang ditangani',
        en: 'affair, matter, or thing to handle',
      },
    ],
  },
]

const byMember = new Map<string, { cluster: SynonymCluster; self: SynonymMember }[]>()
for (const cluster of SYNONYM_CLUSTERS) {
  for (const member of cluster.members) {
    const list = byMember.get(member.zh) ?? []
    list.push({ cluster, self: member })
    byMember.set(member.zh, list)
  }
}

export function synonymEntriesFor(zh: string): { cluster: SynonymCluster; self: SynonymMember }[] {
  return byMember.get(zh) ?? []
}
