// Pure zero-DOM Stroke Semantics & Radical Decomposition data for HSK 1 Dari Nol.
// Teaches each fundamental stroke's visual shape, direction, metaphor & meaning role,
// plus clickable radical building-block stories across all 150 HSK 1 words.
import type { Hsk1Word } from './hsk1.ts'

export interface BasicStrokeGuide {
  id: string
  zh: string
  pinyin: string
  nameId: string
  metaphorId: string
  meaningRoleId: string
  directionHint: string
  svgPath: string
  startDot: [number, number]
  arrowTip: [number, number]
  colorHex: string
  examples: Array<{ zh: string; pinyin: string; meaningId: string }>
}

export interface RadicalInfo {
  glyph: string
  pinyin: string
  meaningId: string
  emoji: string
  storyId: string
}

export interface StrokeQuizItem {
  id: string
  promptId: string
  strokeId: string
  targetZh: string
  options: Array<{ id: string; zh: string; nameId: string; hintId: string }>
  answerIndex: number
  explainId: string
}

export const HSK1_BASIC_STROKES: readonly BasicStrokeGuide[] = [
  {
    id: 'heng',
    zh: '一 / 横',
    pinyin: 'héng',
    nameId: 'Garis Datar',
    metaphorId: 'Jembatan tenang & horizon langit yang rata',
    meaningRoleId: 'Sering melambangkan batas langit, tanah, jembatan, atau angka satu.',
    directionHint: 'Tarik lurus dari KIRI ke KANAN lalu tahan ringan di ujung.',
    svgPath: 'M 18 50 L 82 50',
    startDot: [18, 50],
    arrowTip: [82, 50],
    colorHex: '#0f766e',
    examples: [
      { zh: '一', pinyin: 'yī', meaningId: 'satu' },
      { zh: '三', pinyin: 'sān', meaningId: 'tiga' },
      { zh: '大', pinyin: 'dà', meaningId: 'besar' },
    ],
  },
  {
    id: 'shu',
    zh: '丨 / 竖',
    pinyin: 'shù',
    nameId: 'Tiang Tegak',
    metaphorId: 'Batang pohon berdiri kokoh atau tulang punggung',
    meaningRoleId: 'Memberi struktur tengah, poros tegak, dan keseimbangan karakter.',
    directionHint: 'Tarik lurus tegak dari ATAS ke BAWAH secara mantap.',
    svgPath: 'M 50 16 L 50 84',
    startDot: [50, 16],
    arrowTip: [50, 84],
    colorHex: '#2563eb',
    examples: [
      { zh: '十', pinyin: 'shí', meaningId: 'sepuluh' },
      { zh: '中', pinyin: 'zhōng', meaningId: 'tengah' },
      { zh: '上', pinyin: 'shàng', meaningId: 'atas' },
    ],
  },
  {
    id: 'pie',
    zh: '丿 / 撇',
    pinyin: 'piě',
    nameId: 'Sapuan Kiri',
    metaphorId: 'Sehelai daun meluncur miring tertiup angin ke kiri',
    meaningRoleId: 'Membentuk atap miring, kaki kiri manusia, atau lekukan luwes.',
    directionHint: 'Mulai di atas kanan, sapu melengkung halus ke KIRI BAWAH hingga meruncing.',
    svgPath: 'M 68 18 Q 52 54 24 82',
    startDot: [68, 18],
    arrowTip: [24, 82],
    colorHex: '#7c3aed',
    examples: [
      { zh: '人', pinyin: 'rén', meaningId: 'orang' },
      { zh: '八', pinyin: 'bā', meaningId: 'delapan' },
      { zh: '月', pinyin: 'yuè', meaningId: 'bulan' },
    ],
  },
  {
    id: 'na',
    zh: '㇏ / 捺',
    pinyin: 'nà',
    nameId: 'Sapuan Kanan',
    metaphorId: 'Langkah kaki mantap menjejak bumi ke arah kanan',
    meaningRoleId: 'Menyeimbangkan sapuan kiri agar karakter terasa berdiri lebar.',
    directionHint: 'Turun melandai ke KANAN BAWAH sambil menekan perlahan lalu angkat ujung.',
    svgPath: 'M 28 22 Q 48 60 80 80',
    startDot: [28, 22],
    arrowTip: [80, 80],
    colorHex: '#d97706',
    examples: [
      { zh: '人', pinyin: 'rén', meaningId: 'orang' },
      { zh: '大', pinyin: 'dà', meaningId: 'besar' },
      { zh: '天', pinyin: 'tiān', meaningId: 'langit / hari' },
    ],
  },
  {
    id: 'dian',
    zh: '丶 / 点',
    pinyin: 'diǎn',
    nameId: 'Tetes Air',
    metaphorId: 'Setetes air hujan jatuh atau percikan tinta kecil',
    meaningRoleId: 'Menjadi mahkota atap (家), tetes air (氵), atau aksen ekspresi.',
    directionHint: 'Tekan sebentar lalu geser pendek miring ke BAWAH KANAN.',
    svgPath: 'M 42 36 Q 52 48 58 62',
    startDot: [42, 36],
    arrowTip: [58, 62],
    colorHex: '#0284c7',
    examples: [
      { zh: '六', pinyin: 'liù', meaningId: 'enam' },
      { zh: '太', pinyin: 'tài', meaningId: 'terlalu' },
      { zh: '家', pinyin: 'jiā', meaningId: 'rumah' },
    ],
  },
  {
    id: 'ti',
    zh: '㇀ / 提',
    pinyin: 'tí',
    nameId: 'Cungkil Naik',
    metaphorId: 'Ayunan tangan cepat menengadah ke kanan atas',
    meaningRoleId: 'Sering muncul di sisi kiri radikal tangan (扌), air (氵), dan es (冫).',
    directionHint: 'Mulai agak menekan di KIRI BAWAH lalu cungkil cepat ke KANAN ATAS.',
    svgPath: 'M 22 72 Q 52 54 80 30',
    startDot: [22, 72],
    arrowTip: [80, 30],
    colorHex: '#db2777',
    examples: [
      { zh: '我', pinyin: 'wǒ', meaningId: 'saya' },
      { zh: '打', pinyin: 'dǎ', meaningId: 'menelepon / memukul' },
      { zh: '习', pinyin: 'xí', meaningId: 'berlatih' },
    ],
  },
  {
    id: 'zhe',
    zh: '𠃍 / 折',
    pinyin: 'zhé',
    nameId: 'Belok Tajam',
    metaphorId: 'Sudut bingkai jendela atau tembok rumah dalam satu tarikan',
    meaningRoleId: 'Membentuk kotak mulut (口), matahari (日), atau batas ruang.',
    directionHint: 'Tarik ke kanan, berhenti sejenak di sudut, lalu BELOK TAJAM ke bawah tanpa lepas pena.',
    svgPath: 'M 24 26 L 74 26 L 74 78',
    startDot: [24, 26],
    arrowTip: [74, 78],
    colorHex: '#15803d',
    examples: [
      { zh: '口', pinyin: 'kǒu', meaningId: 'mulut' },
      { zh: '日', pinyin: 'rì', meaningId: 'hari / matahari' },
      { zh: '五', pinyin: 'wǔ', meaningId: 'lima' },
    ],
  },
  {
    id: 'gou',
    zh: '亅 / 钩',
    pinyin: 'gōu',
    nameId: 'Kail Pancing',
    metaphorId: 'Mata kail kecil yang mengait agar tenaga tidak lepas',
    meaningRoleId: 'Muncul di ujung batang tengah (小), anak (子), dan senjata (我).',
    directionHint: 'Tarik lurus ke bawah lalu sentak pendek mengait ke KIRI ATAS.',
    svgPath: 'M 54 18 L 54 80 L 36 66',
    startDot: [54, 18],
    arrowTip: [36, 66],
    colorHex: '#ea580c',
    examples: [
      { zh: '子', pinyin: 'zǐ', meaningId: 'anak' },
      { zh: '小', pinyin: 'xiǎo', meaningId: 'kecil' },
      { zh: '买', pinyin: 'mǎi', meaningId: 'membeli' },
    ],
  },
]

export const HSK1_RADICALS: Record<string, RadicalInfo> = {
  女: { glyph: '女', pinyin: 'nǚ', meaningId: 'perempuan / ibu', emoji: '👩', storyId: 'Sosok perempuan duduk anggun menyilang tangan' },
  子: { glyph: '子', pinyin: 'zǐ', meaningId: 'anak kecil', emoji: '👶', storyId: 'Bayi terbungkus selimut dengan kedua tangan terentang' },
  人: { glyph: '人', pinyin: 'rén', meaningId: 'orang / manusia', emoji: '🚶', storyId: 'Dua kaki melangkah seimbang (sapuan kiri + kanan)' },
  亻: { glyph: '亻', pinyin: 'rén', meaningId: 'orang (radikal kiri)', emoji: '🧑', storyId: 'Bentuk ramping "orang berdiri" di sisi kiri aksara' },
  口: { glyph: '口', pinyin: 'kǒu', meaningId: 'mulut / ucapan', emoji: '👄', storyId: 'Mulut terbuka — kata makan, tanya, dan suara pakai ini' },
  讠: { glyph: '讠', pinyin: 'yán', meaningId: 'kata / bicara', emoji: '💬', storyId: 'Versi ringkas "ucapan": muncul di aksara bicara, baca, terima kasih' },
  日: { glyph: '日', pinyin: 'rì', meaningId: 'matahari / hari', emoji: '☀️', storyId: 'Lingkaran matahari dengan inti bersinar di tengah' },
  月: { glyph: '月', pinyin: 'yuè', meaningId: 'bulan / tubuh', emoji: '🌙', storyId: 'Bulan sabit dengan garis cahaya — juga berarti waktu bulanan' },
  木: { glyph: '木', pinyin: 'mù', meaningId: 'pohon / kayu', emoji: '🌳', storyId: 'Batang tegak, dahan melebar, dan akar di bawah' },
  氵: { glyph: '氵', pinyin: 'shuǐ', meaningId: 'tetes air (radikal)', emoji: '💧', storyId: 'Tiga percikan air — muncul di minuman, bersih, dan cuaca cair' },
  水: { glyph: '水', pinyin: 'shuǐ', meaningId: 'air mengalir', emoji: '🌊', storyId: 'Aliran sungai tengah dengan percikan di kiri kanan' },
  火: { glyph: '火', pinyin: 'huǒ', meaningId: 'api / panas', emoji: '🔥', storyId: 'Nyala api dan percikan bara (empat titik 灬 di bawah)' },
  灬: { glyph: '灬', pinyin: 'huǒ', meaningId: 'bara api di bawah', emoji: '🔥', storyId: 'Empat titik bara panas di dasar karakter seperti 热 (panas)' },
  心: { glyph: '心', pinyin: 'xīn', meaningId: 'hati / pikiran', emoji: '❤️', storyId: 'Bilik hati dan detaknya — untuk rasa, rindu, dan cinta' },
  忄: { glyph: '忄', pinyin: 'xīn', meaningId: 'perasaan (radikal kiri)', emoji: '💓', storyId: 'Hati yang berdiri ramping di sisi kiri untuk emosi' },
  手: { glyph: '手', pinyin: 'shǒu', meaningId: 'tangan', emoji: '✋', storyId: 'Jari-jari tangan dan pergelangan' },
  扌: { glyph: '扌', pinyin: 'shǒu', meaningId: 'aksi tangan (radikal)', emoji: '🖐️', storyId: 'Tangan bergerak cepat — muncul di aksi memukul atau menelepon' },
  足: { glyph: '足', pinyin: 'zú', meaningId: 'kaki', emoji: '🦶', storyId: 'Lutut di atas dan telapak kaki melangkah di bawah' },
  辶: { glyph: '辶', pinyin: 'chuò', meaningId: 'jalan / bepergian', emoji: '🛤️', storyId: 'Jejak kaki di jalan — muncul di pulang, jauh, jalan ini' },
  宀: { glyph: '宀', pinyin: 'mián', meaningId: 'atap rumah', emoji: '🏠', storyId: 'Atap dengan cerobong kecil pelindung keluarga' },
  目: { glyph: '目', pinyin: 'mù', meaningId: 'mata', emoji: '👁️', storyId: 'Bingkai mata dengan dua garis kelopak di dalam' },
  门: { glyph: '门', pinyin: 'mén', meaningId: 'pintu / gerbang', emoji: '🚪', storyId: 'Dua daun pintu gerbang masuk' },
  车: { glyph: '车', pinyin: 'chē', meaningId: 'kendaraan / roda', emoji: '🚗', storyId: 'Rangka kendaraan dan as roda di tengah' },
  马: { glyph: '马', pinyin: 'mǎ', meaningId: 'kuda', emoji: '🐴', storyId: 'Surai, punggung, dan kaki kuda yang berlari' },
  力: { glyph: '力', pinyin: 'lì', meaningId: 'tenaga / otot', emoji: '💪', storyId: 'Lengan berotot membengkok penuh tenaga' },
  大: { glyph: '大', pinyin: 'dà', meaningId: 'besar / rentang', emoji: '🙌', storyId: 'Orang merentangkan kedua tangan selebar-lebarnya: besar!' },
  小: { glyph: '小', pinyin: 'xiǎo', meaningId: 'kecil', emoji: '🐣', storyId: 'Garis tengah tipis diapit dua titik mungil' },
  土: { glyph: '土', pinyin: 'tǔ', meaningId: 'tanah / bumi', emoji: '🌱', storyId: 'Tunas/tiang tumbuh di atas dua lapisan tanah' },
  山: { glyph: '山', pinyin: 'shān', meaningId: 'gunung', emoji: '⛰️', storyId: 'Tiga puncak gunung berdiri sejajar' },
  雨: { glyph: '雨', pinyin: 'yǔ', meaningId: 'hujan / langit berawan', emoji: '🌧️', storyId: 'Awan langit dengan empat tetes air jatuh di bawahnya' },
  饣: { glyph: '饣', pinyin: 'shí', meaningId: 'makanan', emoji: '🍚', storyId: 'Radikal pangan — muncul di nasi, restoran, lapar' },
  贝: { glyph: '贝', pinyin: 'bèi', meaningId: 'kerang / uang', emoji: '💰', storyId: 'Kulit kerang berharga yang dulu dipakai sebagai mata uang' },
  钅: { glyph: '钅', pinyin: 'jīn', meaningId: 'logam / uang logam', emoji: '🪙', storyId: 'Logam berkilau — muncul di uang (钱) dan jam (钟)' },
  竹: { glyph: '竹', pinyin: 'zhú', meaningId: 'bambu / bilah', emoji: '🎋', storyId: 'Dua batang daun bambu sejajar' },
  艹: { glyph: '艹', pinyin: 'cǎo', meaningId: 'rumput / tanaman', emoji: '🌿', storyId: 'Dua tunas daun di atas — muncul di teh (茶) dan sayur (菜)' },
  衣: { glyph: '衣', pinyin: 'yī', meaningId: 'pakaian / kain', emoji: '👕', storyId: 'Kerah baju dan lipatan kain panjang' },
  米: { glyph: '米', pinyin: 'mǐ', meaningId: 'butir beras', emoji: '🌾', storyId: 'Butiran beras terpencar di sekeliling silang penampi' },
  广: { glyph: '广', pinyin: 'guǎng', meaningId: 'bangunan / atap luas', emoji: '🏛️', storyId: 'Tenda/atap toko terbuka untuk klinik & toko' },
  田: { glyph: '田', pinyin: 'tián', meaningId: 'sawah / petak ladang', emoji: '🟫', storyId: 'Empat petak sawah berbatas pematang' },
  禾: { glyph: '禾', pinyin: 'hé', meaningId: 'padi / panen', emoji: '🌾', storyId: 'Pohon gandum dengan bulir padi merunduk di puncak' },
  又: { glyph: '又', pinyin: 'yòu', meaningId: 'tangan kanan / saling', emoji: '🤝', storyId: 'Tangan terbuka menggenggam atau bekerja sama' },
  八: { glyph: '八', pinyin: 'bā', meaningId: 'membagi dua / delapan', emoji: '✌️', storyId: 'Dua sapuan terpisah simetris ke kiri dan kanan' },
  十: { glyph: '十', pinyin: 'shí', meaningId: 'sepuluh / penuh', emoji: '➕', storyId: 'Silang lengkap atas-bawah dan kiri-kanan' },
  王: { glyph: '王', pinyin: 'wáng', meaningId: 'raja / permata', emoji: '👑', storyId: 'Tiga garis (langit, manusia, bumi) dihubungkan oleh poros raja' },
  言: { glyph: '言', pinyin: 'yán', meaningId: 'ucapan / bahasa', emoji: '🗣️', storyId: 'Gelombang suara keluar dari mulut di bawah' },
  士: { glyph: '士', pinyin: 'shì', meaningId: 'cendekia / ksatria', emoji: '🎓', storyId: 'Garis atas panjang lebar bagai bahu kokoh' },
  冫: { glyph: '冫', pinyin: 'bīng', meaningId: 'es dingin (2 titik)', emoji: '🧊', storyId: 'Dua kristal es membeku — langsung menandakan dingin!' },
}

export const HSK1_CHAR_BREAKDOWN: Record<
  string,
  { parts: string[]; storyId: string; strokes: string[] }
> = {
  好: { parts: ['女', '子'], storyId: 'Ibu/perempuan (女) bersama anak (子) = Harmoni yang baik!', strokes: ['pie', 'dian', 'heng', 'zhe', 'gou'] },
  妈: { parts: ['女', '马'], storyId: 'Perempuan (女) + kuda "mǎ" (马) sebagai petunjuk bunyi "mā" = Ibu.', strokes: ['pie', 'heng', 'zhe'] },
  爸: { parts: ['八', '巴'], storyId: 'Pemimpin keluarga dengan kumis wibawa ("bà") = Ayah.', strokes: ['pie', 'dian', 'zhe', 'heng'] },
  家: { parts: ['宀', '豕'], storyId: 'Ada atap pelindung (宀) menaungi penghuni di bawah = Rumah & Keluarga.', strokes: ['dian', 'zhe', 'pie', 'na'] },
  明: { parts: ['日', '月'], storyId: 'Matahari (日) + Bulan (月) bersinar bersama = Terang / Besok.', strokes: ['shu', 'zhe', 'heng', 'pie'] },
  休: { parts: ['亻', '木'], storyId: 'Orang (亻) bersandar di pohon (木) = Istirahat sejenak.', strokes: ['pie', 'shu', 'heng', 'na'] },
  听: { parts: ['口', '斤'], storyId: 'Membuka mulut/perhatian (口) dekat sumber suara = Mendengarkan.', strokes: ['shu', 'zhe', 'pie', 'heng'] },
  说: { parts: ['讠', '兑'], storyId: 'Ucapan (讠) mengalir lega dari bibir = Berbicara.', strokes: ['dian', 'zhe', 'pie', 'na'] },
  读: { parts: ['讠', '卖'], storyId: 'Ucapan kata-kata (讠) dari tulisan terbuka = Membaca nyaring.', strokes: ['dian', 'zhe', 'heng', 'na'] },
  写: { parts: ['冖', '与'], storyId: 'Menorehkan kalimat rapi di bawah tudung meja = Menulis.', strokes: ['dian', 'zhe', 'heng', 'gou'] },
  吃: { parts: ['口', '乞'], storyId: 'Menggunakan mulut (口) untuk mengunyah = Makan.', strokes: ['shu', 'zhe', 'pie', 'heng'] },
  喝: { parts: ['口', '曷'], storyId: 'Mulut (口) meneguk di hari terik matahari = Minum.', strokes: ['shu', 'zhe', 'heng', 'pie'] },
  看: { parts: ['手', '目'], storyId: 'Tangan (手) meneduhi mata (目) memandang ke kejauhan = Melihat.', strokes: ['pie', 'heng', 'shu', 'zhe'] },
  买: { parts: ['乛', '头'], storyId: 'Menukar koin dan membawanya pulang = Membeli.', strokes: ['zhe', 'dian', 'heng', 'na'] },
  卖: { parts: ['十', '买'], storyId: 'Menambah stok (十) di atas barang beli = Menjual.', strokes: ['heng', 'shu', 'zhe', 'na'] },
  学: { parts: ['小', '子'], storyId: 'Percikan ilmu (ツ) + atap + anak (子) tekun menuntut ilmu = Belajar.', strokes: ['dian', 'zhe', 'heng', 'gou'] },
  校: { parts: ['木', '交'], storyId: 'Bangunan kayu (木) tempat murid bertemu (交) = Sekolah.', strokes: ['heng', 'shu', 'pie', 'na'] },
  朋: { parts: ['月', '月'], storyId: 'Dua bulan/untaian kerang berharga berdampingan = Teman akrab.', strokes: ['pie', 'zhe', 'heng'] },
  友: { parts: ['𠂇', '又'], storyId: 'Dua tangan (又) saling menggenggam = Sahabat.', strokes: ['heng', 'pie', 'zhe', 'na'] },
  爱: { parts: ['爫', '友'], storyId: 'Tangan memeluk hati dengan penuh kasih = Cinta / Suka.', strokes: ['pie', 'dian', 'heng', 'na'] },
  想: { parts: ['木', '目', '心'], storyId: 'Bayangan pohon (木) & mata (目) disimpan dalam hati (心) = Rindu / Ingin.', strokes: ['heng', 'shu', 'zhe', 'dian'] },
  请: { parts: ['讠', '青'], storyId: 'Ucapan (讠) yang jernih sopan = Silakan / Mengundang.', strokes: ['dian', 'zhe', 'heng', 'shu'] },
  谢: { parts: ['讠', '射'], storyId: 'Kata-kata tulus (讠) menghormati sesama = Terima kasih.', strokes: ['dian', 'zhe', 'pie', 'gou'] },
  坐: { parts: ['人', '人', '土'], storyId: 'Dua orang (人人) bersantai di atas tanah (土) = Duduk.', strokes: ['pie', 'dian', 'heng', 'shu'] },
  住: { parts: ['亻', '主'], storyId: 'Orang (亻) menjadi tuan (主) rumah tetapnya = Tinggal.', strokes: ['pie', 'shu', 'dian', 'heng'] },
  去: { parts: ['土', '厶'], storyId: 'Melangkah meninggalkan pijakan tanah (土) = Pergi.', strokes: ['heng', 'shu', 'zhe', 'dian'] },
  来: { parts: ['木', '米'], storyId: 'Biji gandum berlimpah datang saat panen = Datang.', strokes: ['heng', 'dian', 'pie', 'na'] },
  回: { parts: ['口', '口'], storyId: 'Jalan berputar masuk ke lingkar dalam = Kembali / Pulang.', strokes: ['shu', 'zhe', 'heng'] },
  开: { parts: ['一', '廾'], storyId: 'Dua tangan mendorong palang gerbang terbuka = Membuka / Menyetir.', strokes: ['heng', 'pie', 'shu'] },
  车: { parts: ['一', '车'], storyId: 'Rangka roda dengan garis poros di tengah = Mobil / Kendaraan.', strokes: ['heng', 'zhe', 'shu'] },
  钱: { parts: ['钅', '戋'], storyId: 'Logam mulia (钅) bernilai tukar = Uang.', strokes: ['pie', 'heng', 'ti', 'na'] },
  水: { parts: ['水'], storyId: 'Sungai di tengah dengan percikan ombak kiri-kanan = Air.', strokes: ['gou', 'pie', 'na'] },
  茶: { parts: ['艹', '人', '木'], storyId: 'Daun (艹) dipetik orang (人) dari pohon (木) = Teh!', strokes: ['heng', 'shu', 'pie', 'na'] },
  饭: { parts: ['饣', '反'], storyId: 'Sajian pangan (饣) pokok yang hangat = Nasi / Makanan.', strokes: ['pie', 'zhe', 'na'] },
  菜: { parts: ['艹', '采'], storyId: 'Tanaman hijau (艹) yang dipetik (采) segar = Sayur / Lauk.', strokes: ['heng', 'shu', 'pie', 'na'] },
  天: { parts: ['一', '大'], storyId: 'Satu batas tertinggi (一) di atas orang besar (大) = Langit / Hari.', strokes: ['heng', 'pie', 'na'] },
  雨: { parts: ['雨'], storyId: 'Awan langit dengan empat tetes air jatuh (丶) = Hujan.', strokes: ['heng', 'shu', 'zhe', 'dian'] },
  冷: { parts: ['冫', '令'], storyId: 'Dua kristal es membeku (冫) di samping bunyi "lìng" = Dingin.', strokes: ['dian', 'ti', 'pie', 'na'] },
  热: { parts: ['扌', '灬'], storyId: 'Bara empat titik api (灬) memanaskan di bawah = Panas.', strokes: ['heng', 'ti', 'dian'] },
  大: { parts: ['大'], storyId: 'Manusia merentangkan dua tangan selebar mungkin = Besar.', strokes: ['heng', 'pie', 'na'] },
  小: { parts: ['小'], storyId: 'Satu batang kecil dengan dua butir mungil di sisi = Kecil.', strokes: ['gou', 'pie', 'dian'] },
  多: { parts: ['夕', '夕'], storyId: 'Dua bulan sabit bertumpuk satu di atas lain = Banyak!', strokes: ['pie', 'zhe', 'dian'] },
  少: { parts: ['小', '丿'], storyId: 'Mengambil sedikit dari bagian yang sudah kecil = Sedikit.', strokes: ['gou', 'pie', 'dian'] },
  上: { parts: ['上'], storyId: 'Titik tanda berdiri di ATAS garis dasar = Atas / Masuk.', strokes: ['shu', 'heng'] },
  下: { parts: ['下'], storyId: 'Garis penunjuk turun ke BAWAH atap dasar = Bawah / Turun.', strokes: ['heng', 'shu', 'dian'] },
  中: { parts: ['口', '丨'], storyId: 'Tiang tegak (丨) menembus tepat di TENGAH sasaran = Tengah.', strokes: ['shu', 'zhe', 'heng'] },
  国: { parts: ['口', '王', '丶'], storyId: 'Batu permata berharga (玉) dijaga tembok batas (囗) = Negara.', strokes: ['shu', 'zhe', 'heng', 'dian'] },
  人: { parts: ['人'], storyId: 'Dua kaki saling menopang melangkah = Manusia / Orang.', strokes: ['pie', 'na'] },
  我: { parts: ['手', '戈'], storyId: 'Tangan menjaga diri sendiri = Saya / Aku.', strokes: ['pie', 'heng', 'gou', 'ti', 'na', 'dian'] },
  你: { parts: ['亻', '尔'], storyId: 'Orang (亻) tepat di hadapanmu = Kamu.', strokes: ['pie', 'shu', 'gou', 'dian'] },
  他: { parts: ['亻', '也'], storyId: 'Orang (亻) di sebelah sana = Dia (laki-laki).', strokes: ['pie', 'shu', 'zhe', 'gou'] },
  她: { parts: ['女', '也'], storyId: 'Perempuan (女) di sebelah sana = Dia (perempuan).', strokes: ['pie', 'dian', 'zhe', 'gou'] },
  们: { parts: ['亻', '门'], storyId: 'Banyak orang (亻) berkumpul di satu gerbang (门) = Jamak (kami/kalian).', strokes: ['pie', 'shu', 'dian', 'gou'] },
  是: { parts: ['日', '正'], storyId: 'Tegak lurus di bawah sinar terang matahari (日) = Adalah / Ya.', strokes: ['shu', 'zhe', 'heng', 'na'] },
  有: { parts: ['𠂇', '月'], storyId: 'Tangan memegang daging/bulan berharga = Punya / Ada.', strokes: ['heng', 'pie', 'shu', 'zhe'] },
  在: { parts: ['土'], storyId: 'Berpijak mantap di atas tanah (土) = Berada di / Sedang.', strokes: ['heng', 'pie', 'shu'] },
  和: { parts: ['禾', '口'], storyId: 'Panen padi (禾) & mulut kenyang (口) = Damai / Dan.', strokes: ['pie', 'heng', 'shu', 'zhe'] },
  很: { parts: ['彳', '艮'], storyId: 'Langkah kaki mantap melaju jauh = Sangat.', strokes: ['pie', 'shu', 'zhe', 'na'] },
  太: { parts: ['大', '丶'], storyId: 'Sudah Besar (大) ditambah ekstra titik (丶) = Terlalu / Sangat.', strokes: ['heng', 'pie', 'na', 'dian'] },
  不: { parts: ['一', '小'], storyId: 'Burung menolak hinggap & terbang ke atas = Tidak.', strokes: ['heng', 'pie', 'shu', 'dian'] },
  吗: { parts: ['口', '马'], storyId: 'Mulut bertanya (口) meminjam bunyi kuda "mǎ" (马) = Partikel tanya "kah?".', strokes: ['shu', 'zhe', 'heng'] },
  呢: { parts: ['口', '尼'], storyId: 'Mulut (口) bertanya balik santai = "...bagaimana?".', strokes: ['shu', 'zhe', 'heng', 'pie'] },
  哪: { parts: ['口', '那'], storyId: 'Mulut menanyakan arah "nà" (那) = Yang mana / Di mana.', strokes: ['shu', 'zhe', 'heng', 'pie'] },
  谁: { parts: ['讠', '隹'], storyId: 'Menanyakan dengan kata (讠) identitas seseorang = Siapa?', strokes: ['dian', 'zhe', 'pie', 'shu'] },
  什: { parts: ['亻', '十'], storyId: 'Orang (亻) menghadapi sepuluh pilihan = Apa (dalam 什么).', strokes: ['pie', 'shu', 'heng'] },
  么: { parts: ['丿', '厶'], storyId: 'Ekor kecil melengkapi kata tanya 什么 / 怎么.', strokes: ['pie', 'zhe', 'dian'] },
  一: { parts: ['一'], storyId: 'Satu garis datar tunggal (héng) = Angka 1.', strokes: ['heng'] },
  二: { parts: ['一', '一'], storyId: 'Dua garis datar sejajar = Angka 2.', strokes: ['heng'] },
  三: { parts: ['一', '一', '一'], storyId: 'Tiga garis datar melambangkan langit, manusia, bumi = Angka 3.', strokes: ['heng'] },
  四: { parts: ['口', '八'], storyId: 'Bingkai tertutup berisi dua tirai terpisah = Angka 4.', strokes: ['shu', 'zhe', 'pie', 'heng'] },
  五: { parts: ['一', '丨', '𠃍'], storyId: 'Dua dunia terhubung persilangan = Angka 5.', strokes: ['heng', 'shu', 'zhe'] },
  六: { parts: ['丶', '一', '八'], storyId: 'Tetes mahkota di atas bahu simetris = Angka 6.', strokes: ['dian', 'heng', 'pie'] },
  七: { parts: ['一', '乚'], storyId: 'Potongan lurus membelok lembut = Angka 7.', strokes: ['heng', 'zhe'] },
  八: { parts: ['八'], storyId: 'Dua sapuan miring terbelah rapi = Angka 8.', strokes: ['pie', 'na'] },
  九: { parts: ['丿', '乙'], storyId: 'Lengkungan lentur menuju puncak = Angka 9.', strokes: ['pie', 'zhe', 'gou'] },
  十: { parts: ['十'], storyId: 'Satu garis datar + satu tiang tegak bertemu lengkap = Angka 10.', strokes: ['heng', 'shu'] },
  点: { parts: ['卜', '灬'], storyId: 'Empat titik percikan bara/detik (灬) = Jam / Titik / Memesan.', strokes: ['shu', 'heng', 'zhe', 'dian'] },
  分: { parts: ['八', '刀'], storyId: 'Pisau (刀) membagi menjadi delapan bagian (八) = Menit / Membagi.', strokes: ['pie', 'na', 'zhe'] },
  年: { parts: ['禾', '十'], storyId: 'Satu siklus penuh panen gandum = Tahun.', strokes: ['pie', 'heng', 'shu'] },
  月: { parts: ['月'], storyId: 'Bulan sabit berputar mengitari kalender = Bulan.', strokes: ['pie', 'zhe', 'heng'] },
  日: { parts: ['日'], storyId: 'Matahari terbit di pagi hari = Hari / Matahari.', strokes: ['shu', 'zhe', 'heng'] },
  今: { parts: ['人', '一'], storyId: 'Atap waktu yang menaungi momen saat ini = Hari ini / Sekarang.', strokes: ['pie', 'na', 'dian', 'zhe'] },
  昨: { parts: ['日', '乍'], storyId: 'Hari/matahari (日) yang baru saja berlalu = Kemarin.', strokes: ['shu', 'zhe', 'pie', 'heng'] },
  气: { parts: ['气'], storyId: 'Hembusan uap/awan melayang ke atas = Udara / Cuaca.', strokes: ['pie', 'heng', 'zhe'] },
  高: { parts: ['丶', '口'], storyId: 'Menara bertingkat menjulang hingga awan = Tinggi.', strokes: ['dian', 'heng', 'shu', 'zhe'] },
  兴: { parts: ['八'], storyId: 'Semua mengangkat tangan gembira merayakan = Senang / Gembira.', strokes: ['dian', 'pie', 'heng'] },
  漂: { parts: ['氵', '票'], storyId: 'Air berkilau (氵) memantulkan cahaya indah = Cantik!', strokes: ['dian', 'ti', 'heng', 'shu'] },
  亮: { parts: ['丶', '儿'], storyId: 'Lentera tinggi bersinar terang benderang = Cerah / Cantik.', strokes: ['dian', 'heng', 'shu', 'zhe'] },
  忙: { parts: ['忄', '亡'], storyId: 'Hati/perasaan (忄) merasa waktu hilang = Sibuk!', strokes: ['dian', 'shu', 'heng', 'zhe'] },
  慢: { parts: ['忄', '曼'], storyId: 'Hati (忄) bergerak santai tanpa tergesa = Pelan / Lambat.', strokes: ['dian', 'shu', 'na'] },
  狗: { parts: ['犭', '句'], storyId: 'Radikal hewan berkaki empat (犭) menggonggong di pagar = Anjing.', strokes: ['pie', 'zhe', 'shu'] },
  猫: { parts: ['犭', '艹', '田'], storyId: 'Hewan lucu (犭) bersembunyi di ladang rumput (艹田) = Kucing!', strokes: ['pie', 'heng', 'shu', 'zhe'] },
  书: { parts: ['书'], storyId: 'Tumpukan lembar bambu berikat pena = Buku.', strokes: ['zhe', 'shu', 'dian'] },
  字: { parts: ['宀', '子'], storyId: 'Anak-anak kata (子) tumbuh di bawah atap (宀) rumah budaya = Aksara / Huruf.', strokes: ['dian', 'zhe', 'gou'] },
  话: { parts: ['讠', '舌'], storyId: 'Ucapan (讠) yang keluar lewat lidah (舌) = Kalimat / Pembicaraan.', strokes: ['dian', 'zhe', 'pie', 'shu'] },
  影: { parts: ['日', '彡'], storyId: 'Cahaya matahari (日) menimbulkan tiga garis bayangan (彡) = Bayangan / Film.', strokes: ['shu', 'zhe', 'pie'] },
  视: { parts: ['礻', '见'], storyId: 'Memusatkan pandangan mata (见) = Menonton / Televisi.', strokes: ['dian', 'zhe', 'pie'] },
  脑: { parts: ['月', '凶'], storyId: 'Organ tubuh (月) berpikir kompleks = Otak / Komputer.', strokes: ['pie', 'zhe', 'dian'] },
  医: { parts: ['匚', '矢'], storyId: 'Kotak perlengkapan tabib penyembuh = Dokter / Medis.', strokes: ['heng', 'pie', 'na', 'zhe'] },
  院: { parts: ['阝', '宀', '元'], storyId: 'Halaman berpagar dengan bangunan beratap (宀) = Rumah Sakit / Institut.', strokes: ['zhe', 'dian', 'heng'] },
  店: { parts: ['广', '占'], storyId: 'Bangunan beratap luas (广) tempat menjajakan barang = Toko.', strokes: ['dian', 'heng', 'pie', 'shu', 'zhe'] },
  站: { parts: ['立', '占'], storyId: 'Berdiri tegak (立) menunggu kereta/bus = Stasiun / Berdiri.', strokes: ['dian', 'heng', 'shu', 'zhe'] },
}

const STROKE_MAP = new Map(HSK1_BASIC_STROKES.map((s) => [s.id, s]))

export interface CharDecomposition {
  char: string
  parts: Array<{ glyph: string; meaningId: string; emoji: string }>
  storyId: string
  strokeGuides: BasicStrokeGuide[]
}

export interface WordDecomposition {
  word: Hsk1Word
  characters: CharDecomposition[]
}

const DEFAULT_STROKE_IDS = ['heng', 'shu', 'pie']

export function decomposeHsk1Word(word: Hsk1Word): WordDecomposition {
  const chars = Array.from(word.zh).filter((ch) => /\p{Script=Han}/u.test(ch))
  const characters: CharDecomposition[] = chars.map((ch) => {
    const manual = HSK1_CHAR_BREAKDOWN[ch]
    if (manual) {
      const parts = manual.parts
        .map((g) => HSK1_RADICALS[g])
        .filter(Boolean)
        .map((r) => ({ glyph: r.glyph, meaningId: r.meaningId, emoji: r.emoji }))
      const strokeGuides = manual.strokes
        .map((sid) => STROKE_MAP.get(sid))
        .filter((s): s is BasicStrokeGuide => Boolean(s))
      return {
        char: ch,
        parts: parts.length > 0 ? parts : [{ glyph: ch, meaningId: word.meaningId, emoji: '🔤' }],
        storyId: manual.storyId,
        strokeGuides:
          strokeGuides.length > 0
            ? strokeGuides
            : DEFAULT_STROKE_IDS.map((id) => STROKE_MAP.get(id)!).filter(Boolean),
      }
    }

    const ownRadical = HSK1_RADICALS[ch]
    const strokeGuides = DEFAULT_STROKE_IDS.map((id) => STROKE_MAP.get(id)!).filter(Boolean)
    return {
      char: ch,
      parts: ownRadical
        ? [{ glyph: ownRadical.glyph, meaningId: ownRadical.meaningId, emoji: ownRadical.emoji }]
        : [{ glyph: ch, meaningId: word.meaningId, emoji: '✨' }],
      storyId: ownRadical ? ownRadical.storyId : word.literalTip,
      strokeGuides,
    }
  })

  return { word, characters }
}

export const HSK1_STROKE_QUIZ: readonly StrokeQuizItem[] = [
  {
    id: 'sq-1',
    promptId: 'Amati sorotan warna pada aksara 大 berikut. Apa nama goresan Tionghoa tersebut?',
    strokeId: 'heng',
    targetZh: '大',
    options: [
      { id: 'heng', zh: '横 (héng)', nameId: 'Garis Datar', hintId: 'kiri → kanan' },
      { id: 'shu', zh: '竖 (shù)', nameId: 'Tiang Tegak', hintId: 'atas → bawah' },
      { id: 'pie', zh: '撇 (piě)', nameId: 'Sapuan Kiri', hintId: 'kanan atas → kiri bawah' },
    ],
    answerIndex: 0,
    explainId: '横 (héng) ditarik datar dari kiri ke kanan, membentuk dasar aksara 一 (yī) dan 大 (dà).',
  },
  {
    id: 'sq-2',
    promptId: 'Perhatikan poros tengah aksara 中 ini. Goresan apakah yang disorot?',
    strokeId: 'shu',
    targetZh: '中',
    options: [
      { id: 'dian', zh: '点 (diǎn)', nameId: 'Percikan Pendek', hintId: 'tekan singkat' },
      { id: 'shu', zh: '竖 (shù)', nameId: 'Tiang Tegak', hintId: 'atas → bawah' },
      { id: 'ti', zh: '提 (tí)', nameId: 'Cungkil Naik', hintId: 'bawah → kanan atas' },
    ],
    answerIndex: 1,
    explainId: '竖 (shù) adalah tiang punggung vertikal dari atas ke bawah — poros tengah pada 十 dan 中.',
  },
  {
    id: 'sq-3',
    promptId: 'Lihat gerakan pada sisi kiri aksara 人 ini. Apa nama goresannya?',
    strokeId: 'pie',
    targetZh: '人',
    options: [
      { id: 'pie', zh: '撇 (piě)', nameId: 'Sapuan Kiri', hintId: 'miring ke kiri bawah' },
      { id: 'na', zh: '捺 (nà)', nameId: 'Sapuan Kanan', hintId: 'menjejak ke kanan' },
      { id: 'gou', zh: '钩 (gōu)', nameId: 'Kail Pancing', hintId: 'sentak kail bawah' },
    ],
    answerIndex: 0,
    explainId: '撇 (piě) selalu ditulis lebih dulu untuk sisi kiri 人, lalu ditopang 捺 (nà) ke kanan.',
  },
  {
    id: 'sq-4',
    promptId: 'Goresan penyeimbang pada aksara 大 seperti gambar animasi di atas disebut...',
    strokeId: 'na',
    targetZh: '大',
    options: [
      { id: 'zhe', zh: '折 (zhé)', nameId: 'Belok Tajam', hintId: 'sudut kotak' },
      { id: 'dian', zh: '点 (diǎn)', nameId: 'Percikan Pendek', hintId: 'tekan singkat' },
      { id: 'na', zh: '捺 (nà)', nameId: 'Sapuan Kanan', hintId: 'langkah ke kanan bawah' },
    ],
    answerIndex: 2,
    explainId: '捺 (nà) adalah sapuan penyeimbang kanan bawah agar aksara besar terasa kokoh.',
  },
  {
    id: 'sq-5',
    promptId: 'Amati goresan mungil di puncak aksara 家 dan 六 ini. Apa namanya?',
    strokeId: 'dian',
    targetZh: '家',
    options: [
      { id: 'dian', zh: '点 (diǎn)', nameId: 'Tetes Air', hintId: 'titik mahkota / percikan' },
      { id: 'heng', zh: '横 (héng)', nameId: 'Garis Datar', hintId: 'kiri → kanan' },
      { id: 'shu', zh: '竖 (shù)', nameId: 'Tiang Tegak', hintId: 'atas → bawah' },
    ],
    answerIndex: 0,
    explainId: '点 (diǎn) berarti tetes air atau percikan kecil — tiga di antaranya membentuk radikal air 氵.',
  },
  {
    id: 'sq-6',
    promptId: 'Amati tarikan menyatu membentuk sudut jendela pada aksara 口. Apa namanya?',
    strokeId: 'zhe',
    targetZh: '口',
    options: [
      { id: 'pie', zh: '撇 (piě)', nameId: 'Sapuan Kiri', hintId: 'miring ke kiri' },
      { id: 'zhe', zh: '折 (zhé)', nameId: 'Belok Tajam', hintId: 'satu tarikan berbelok 90°' },
      { id: 'ti', zh: '提 (tí)', nameId: 'Cungkil Naik', hintId: 'bawah → kanan atas' },
    ],
    answerIndex: 1,
    explainId: '折 (zhé) menyatukan dinding atas & kanan dalam satu tarikan patah sudut 90 derajat tanpa putus.',
  },
  {
    id: 'sq-7',
    promptId: 'Perhatikan bagian ujung bawah pada aksara 小 dan 子. Goresan apakah ini?',
    strokeId: 'gou',
    targetZh: '小',
    options: [
      { id: 'gou', zh: '钩 (gōu)', nameId: 'Kail Pancing', hintId: 'sentak kail kecil di ujung' },
      { id: 'heng', zh: '横 (héng)', nameId: 'Garis Datar', hintId: 'kiri → kanan' },
      { id: 'na', zh: '捺 (nà)', nameId: 'Sapuan Kanan', hintId: 'kiri → kanan bawah' },
    ],
    answerIndex: 0,
    explainId: '钩 (gōu) adalah mata kail di ujung batang vertikal/miring yang mengikat keseimbangan aksara.',
  },
  {
    id: 'sq-8',
    promptId: 'Lihat gerakan pada sisi kiri aksara 我 berikut ini. Apa nama goresannya?',
    strokeId: 'ti',
    targetZh: '我',
    options: [
      { id: 'shu', zh: '竖 (shù)', nameId: 'Tiang Tegak', hintId: 'atas → bawah' },
      { id: 'zhe', zh: '折 (zhé)', nameId: 'Belok Tajam', hintId: 'sudut kotak' },
      { id: 'ti', zh: '提 (tí)', nameId: 'Cungkil Naik', hintId: 'kiri bawah → kanan atas' },
    ],
    answerIndex: 2,
    explainId: '提 (tí) ditarik miring naik dari kiri bawah ke kanan atas agar radikal kiri (扌 & 氵) menyambung rapi.',
  },
]
