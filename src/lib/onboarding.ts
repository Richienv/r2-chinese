import type { CoupleMemberId } from './coupleProfile.ts'

export const ONBOARDING_KEY_PREFIX = 'yulu.onboarding.v1.'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): StorageLike | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

export function onboardingKey(memberId: CoupleMemberId): string {
  return `${ONBOARDING_KEY_PREFIX}${memberId}`
}

export function isOnboardingDone(
  memberId: CoupleMemberId,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return true
  try {
    return storage.getItem(onboardingKey(memberId)) === 'done'
  } catch {
    return true
  }
}

export function markOnboardingDone(
  memberId: CoupleMemberId,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(onboardingKey(memberId), 'done')
  } catch {
    /* ignore storage quota issues */
  }
}

export function resetOnboarding(
  memberId: CoupleMemberId,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.removeItem(onboardingKey(memberId))
  } catch {
    /* ignore storage issues */
  }
}

export interface OnboardingSlide {
  id: string
  icon: string
  kicker: string
  title: string
  body: string
  highlights: readonly string[]
}

export function getOnboardingSlides(
  memberId: CoupleMemberId,
  memberName: string,
): OnboardingSlide[] {
  const safeName = memberName.trim() || (memberId === 'renita' ? 'Renita' : 'Richie')
  if (memberId === 'renita') {
    return [
      {
        id: 'track',
        icon: '🎵',
        kicker: `SELAMAT DATANG, ${safeName.toUpperCase()}`,
        title: 'HSK 1 Dari Nol · Pelan & Ramah',
        body: 'Kamu mulai dari Pondasi Bayi dulu sebelum menyentuh kalimat panjang—satu kartu kecil setiap langkah agar tidak kewalahan.',
        highlights: [
          '🎵 4 Nada + 🗣️ Bunyi Mulut Pinyin + ✍️ 8 Goresan Dasar',
          '🗺️ 15 Unit HSK 1 Resmi (150 kosakata inti sehari-hari)',
          '🧩 Belajar akar pembentuk aksara & rakit kalimat pakai balok',
        ],
      },
      {
        id: 'memory',
        icon: '🧠',
        kicker: 'ANTI-LUPA & ANTI-BOCOR',
        title: 'Active Recall FSRS-6 Tanpa Contekan',
        body: 'Setiap kata baru diuji balik di waktu paling pas sebelum lupa. Petunjuk bertingkat membantu ingatanmu tanpa pernah membocorkan jawabannya.',
        highlights: [
          '⏱️ Jadwal otomatis: 10 menit → Besok → 7 hari → 1 bulan+',
          '💡 Petunjuk 1 (Akar Kata) & Petunjuk 2 (Audio) tetap aman',
          '🔁 Kata yang masih ragu otomatis diulang di ronde perbaikan',
        ],
      },
      {
        id: 'evolution',
        icon: '🐉',
        kicker: 'EVOLUSI 24 LEVEL & RUANG BERDUA',
        title: 'Naikkan Level & Saling Semangati',
        body: 'Progres belajar nyata mengisi 灵力 untuk membuka 8 Siklus × 3 Tahap (Bayi → Matang → Dewa). Semua wujud di atas levelmu tetap rahasia!',
        highlights: [
          '🔒 Evolusi terkunci tampil sebagai siluet rahasia — bebas spoiler',
          '🔥 Jaga streak mingguan agar api berubah warna jadi biru, petir & emas',
          '💕 Cek tombol Berdua untuk lihat progres Richie & kirim cheer!',
        ],
      },
    ]
  }

  return [
    {
      id: 'track',
      icon: '🎯',
      kicker: `SIAP LANJUT, ${safeName.toUpperCase()}`,
      title: 'HSK 4 + Simulator + Active Recall',
      body: 'Jalur fokus untuk memperdalam penguasaan HSK 4, mendengar dialog alami, serta menguji daya ingat aktif tanpa hafalan pasif.',
      highlights: [
        '📖 Teks pelajaran lengkap + kosa kata inti & catatan grammar',
        '📝 Simulator ujian HSK 4 & latihan menyusun kalimat sendiri',
        '✍️ Bisa diketik atau tulis tangan langsung di kanvas karakter',
      ],
    },
    {
      id: 'memory',
      icon: '🧠',
      kicker: 'INGATAN TAJAM FSRS-6',
      title: 'Retensi Tinggi Tanpa Bocoran',
      body: 'Ulasan ingatan menghitung probabilitas ingat setiap kata. Jawab murni tanpa petunjuk memberi dorongan interval tercepat.',
      highlights: [
        '📊 Pantau persentase retensi & tahap memori (Baru → 1 Bulan)',
        '💡 Petunjuk bertingkat: Pinyin → Karakter Pertama tanpa spoiler',
        '🎯 Kata yang mirip nuansanya langsung dikoreksi perbedaannya',
      ],
    },
    {
      id: 'evolution',
      icon: '⚡',
      kicker: '24 EVOLUSI & PROGRESS BERDUA',
      title: 'Bangkitkan Shenshou Hingga Wujud Dewa',
      body: 'Hanya kata yang lolos tes aktif & grammar yang dihitung menuju evolusi 24 level. Wujud berikutnya tetap tertutup siluet rahasia!',
      highlights: [
        '🔒 Wujud yang belum terbuka terkunci rapat tanpa bocoran gambar/nama',
        '📅 Bandingkan langkah hari ini vs kemarin & 6 kategori kata di Stats',
        '💕 Pantau kemajuan Renita di HSK 1 lewat tombol Berdua kapan saja',
      ],
    },
  ]
}
