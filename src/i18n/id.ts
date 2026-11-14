/** Indonesian (Gen Z) interface strings, keyed by the exact English source. One file per area. */
import overhaul from './id/overhaul.ts'
import shared from './id/shared.ts'
import shell from './id/shell.ts'
import learn from './id/learn.ts'
import practice from './id/practice.ts'
import review from './id/review.ts'
import courses from './id/courses.ts'
import reading from './id/reading.ts'
import engine from './id/engine.ts'

const id: Record<string, string> = {
  'Your practice, memory, and completed lessons.': 'Latihan, ingatan, dan materi yang sudah selesai.',
  'One session at a time.': 'Satu sesi, satu langkah.',
  '{n} practice steps. Daily goal complete.': '{n} langkah latihan. Target hari ini selesai.',
  '{n} of {goal} practice steps today.': '{n} dari {goal} langkah latihan hari ini.',
  'Start with a lesson you like.': 'Mulai dari materi pilihanmu.',
  'Listening': 'Dengarkan',
  'Playback options': 'Pengaturan pemutaran',
  'Active recall': 'Latihan ingatan',
  'Materials': 'Materi',
  'My words': 'Kata saya',
  'Sentence practice': 'Latihan kalimat',
  'Your Mandarin library': 'Perpustakaan Mandarinmu',
  'Choose a course. Continue at your own pace.': 'Pilih kursus. Lanjutkan sesuai ritmemu.',
  'YOUR DAILY PRACTICE': 'BELAJAR HARI INI',
  'A small step today.': 'Lanjut sedikit hari ini.',
  'Pick up where you left off.': 'Lanjut dari terakhir kamu belajar.',
  'Browse materials': 'Lihat semua materi',
  'Lessons and practice, in one place.': 'Materi dan latihan, dalam satu tempat.',
  'Show translation': 'Tampilkan terjemahan',
  'Start over': 'Mulai dari awal',
  'Ready for recall': 'Siap diulang',
  'All caught up': 'Belum ada yang perlu diulang',
  'Your next session': 'Sesi berikutnya',
  'Your words can rest. Continue with your lesson.': 'Kata yang sudah kuat bisa istirahat. Lanjutkan materimu.',
  'Memory details': 'Detail ingatan',
  'Review completed steps': 'Ulangi tahap yang selesai',

  ...shared,
  ...shell,
  ...learn,
  ...practice,
  ...review,
  ...courses,
  ...reading,
  ...engine,
  ...overhaul,
}
export default id
