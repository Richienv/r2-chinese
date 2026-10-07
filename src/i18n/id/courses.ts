// Jiaocheng and Kerja courses: the path, the session screens and the labels their lib files build.
const entries: Record<string, string> = {
  // Empty states
  '{blurb}. Lessons appear when JSON lands under {part1} and {part2}.': '{blurb}. Pelajaran bakal muncul begitu JSON masuk ke {part1} dan {part2}.',
  'No lessons loaded yet — nothing fake to start.': 'Belum ada pelajaran yang dimuat — gak ada konten palsu buat dimulai.',
  '{blurb}. Chapters appear here automatically when unit JSON is added under {path}.': '{blurb}. Bab bakal muncul di sini otomatis begitu JSON unit ditambahkan ke {path}.',
  'No chapters loaded yet — nothing fake to start.': 'Belum ada bab yang dimuat — gak ada konten palsu buat dimulai.',

  // Book details (lib constants)
  'Yang Jizhou · parts 1 & 2 as one path': 'Yang Jizhou · bagian 1 & 2 jadi satu jalur',
  '1000 words': '1000 kata',
  'Field edition 2026': 'Edisi lapangan 2026',
  'Workplace Mandarin for HR and management': 'Mandarin dunia kerja untuk HR dan manajemen',

  // Path
  'pp. {pages}': 'hlm. {pages}',
  'Bab {n} · 1000 words': 'Bab {n} · 1000 kata',

  // Path step names (lib constants)
  'Words': 'Kata',
  'Words {n}': 'Kata {n}',
  'Dialogue': 'Dialog',
  'Notes': 'Catatan',
  'Extra': 'Tambahan',
  'Wrap-up': 'Rangkuman',

  // Session frame
  'Close session': 'Tutup sesi',
  'Close': 'Tutup',
  'Learning stage: {stage}': 'Tahap belajar: {stage}',
  'Encounter': 'Kenalan',
  'Understand': 'Pahami',
  'Retrieve': 'Ingat-ingat',
  'Produce': 'Praktik',
  'Revisit': 'Tinjau ulang',
  'Next': 'Lanjut',
  'Continue': 'Lanjut',

  // Reading and notes
  '{label} · Dialogue': '{label} · Dialog',
  '{label} · Passage': '{label} · Bacaan',
  'Note': 'Catatan',
  'Note · {n} of {of}': 'Catatan · {n} dari {of}',
  'Hear the line': 'Dengerin kalimatnya',
  'Hear it': 'Dengerin',

  // Checks
  'Check': 'Cek',
  'Check · {n} of {of}': 'Cek · {n} dari {of}',
  'Which word means “{meaning}”?': 'Kata mana yang artinya “{meaning}”?',
  'Hear choices': 'Dengerin pilihan',
  'Stop choices': 'Hentikan pilihan',
  'Playing': 'Diputar',
  'Nice!': 'Mantap!',
  'That’s it': 'Nah, itu dia',

  // History titles
  'Sentence practice · ungraded': 'Latihan kalimat · tanpa nilai',
  'Dialogue check': 'Cek dialog',

  // Done screen
  '{label} complete': '{label} selesai',
  'Your words are tracked automatically. Return on another day to prove recall without hints.': 'Kata-katamu dipantau otomatis. Balik lagi di hari lain buat buktiin kamu bisa ingat tanpa petunjuk.',
  '+{xp} XP / item': '+{xp} XP per item',
  '+{xp} node': '+{xp} bonus langkah',
  '{n} words': '{n} kata',

  // Locked
  'Locked': 'Terkunci',
  'Finish the earlier Jiaocheng nodes first.': 'Selesaikan dulu langkah Jiaocheng sebelumnya.',
  'Finish the earlier Kerja nodes first.': 'Selesaikan dulu langkah Kerja sebelumnya.',

  // Fallbacks written in code when the course data has no hook or note
  'Remember {word} when you need “{meaning}”.': 'Ingat {word} kalau kamu butuh “{meaning}”.',
  'Most Chinese speakers use {word} for “{meaning}”.': 'Kebanyakan penutur Mandarin pakai {word} untuk “{meaning}”.',
  'Most Chinese speakers use {word} in workplace talk for “{meaning}”.': 'Kebanyakan penutur Mandarin pakai {word} di obrolan kerja untuk “{meaning}”.',
  'this meaning': 'arti ini',
  'this': 'ini',
  'Lesson {n}': 'Pelajaran {n}',
  'Chapter {n}': 'Bab {n}',
  'Lesson wrap-up. More checks appear once words are in this unit.': 'Rangkuman pelajaran. Cek lainnya bakal muncul begitu ada kata di unit ini.',
  'Chapter wrap-up. More checks appear once words are in this unit.': 'Rangkuman bab. Cek lainnya bakal muncul begitu ada kata di unit ini.',
}
export default entries
