# Persiapan Global MT Jiayin: English dahulu

Per 14 Oktober 2026, Home dan Learn membuka persiapan interview English dengan penjelasan Indonesia. Mandarin menjadi pilihan: materi HSK lama, 73 pelajaran, audio, worksheets dan progresnya tetap tersedia.

Jalur utama berisi 12 pertanyaan prioritas, ditambah pertanyaan CV dan kasus hingga 26 item. Lima fokusnya adalah stakeholder Indonesia/BD, project management, koordinasi China–Indonesia, business/data thinking dan pengalaman founder. Peta CV menjelaskan Karunia, CV Kid Gemilang, Kambyan, Integra, WeUseAI dan pendidikan. Contoh English disusun dari sumber pribadi dan masukan pengguna; bukan pertanyaan pasti atau pengalaman baru yang dibuat.

Satu sesi menampilkan satu pertanyaan English. Pengguna menjawab lisan atau menulis ringkasan, membuka contoh bila perlu, lalu mengevaluasi kriteria isi dalam Indonesia. Cerita stakeholder, ERP, data, founder, failure, conflict dan pengukuran harus dilengkapi dari pengalaman asli. Pemeriksaan ini adalah penilaian diri; tidak mengklaim grammar, pelafalan atau fakta terverifikasi otomatis.

Progres English memakai `yulu.jiayin.english.v1`, terpisah dari `yulu.jiayin.v1` dan kursus lainnya. Draf dan status bantuan bertahan ketika sesi ditutup atau dimuat ulang. Contoh English, jawaban Mandarin atau catatan lama yang dibuka membuat percobaan berbantuan. Tombol siap mandiri memerlukan jawaban, seluruh kriteria isi, bukti pribadi untuk item yang relevan, dan tidak ada bantuan. Ulangi dengan percobaan baru tanpa contoh. Simulasi mencakup 12 pertanyaan utama dan tiga kasus; review mencakup jawaban lemah/dibantu serta draf yang belum selesai.

PDF cetak yang sama dengan materi utama tersedia di `/preparation/Jiayin_MT_English_First_Prep_EN_ID.pdf`: 10 halaman, English/Indonesia pada halaman 1–9, Mandarin opsional pada halaman 10. Versi sumber dan PDF Mandarin lama tidak diganti. Versi CV yang dibaca memiliki perbedaan tanggal akhir Taylor’s/Kambyan serta angka Taylor’s; peta CV meminta pengguna mencocokkan dokumen yang benar-benar dikirim. Entitas, rotasi, mentor, training, izin dan jalur jabatan tetap harus dikonfirmasi.

Validasi: 230 tes lulus dan production build berhasil dalam salinan Git sementara dengan aset handwriting dari HEAD. Penghapusan lokal `medians.bin` yang sudah ada tetap dipertahankan. Browser mobile memeriksa default tanpa Hanzi, draf setelah tutup/buka, status bantuan, pembatasan siap mandiri, penyimpanan percobaan, akses kembali ke Mandarin dan unduhan PDF dengan checksum yang sama.

## Kurikulum Mandarin opsional

Buka **Wawancara Jiayin**, buku pertama di perpustakaan. Kursus tersedia di Home dan Learn, dengan kemajuan terpisah di Progress.

Sumbernya adalah `Richie_Jiayin_Interview_CN_ID_2026-10-15.pdf`. Materi mencakup seluruh 48 pertanyaan bernomor, enam studi kasus hipotetis, tiga versi perkenalan/penutup, delapan frasa klarifikasi, delapan pertanyaan balik, 25 kosakata tercetak, tujuh bagian konteks perusahaan/posisi, dan sembilan aturan konsistensi fakta. Pertanyaan dan jawaban Mandarin dipertahankan dari PDF. Arti Indonesia untuk 217 kalimat, maksud pertanyaan, dan latihan lanjutan merupakan tambahan pengajaran. Bank kata juga memuat 127 kata/frasa tambahan yang diambil dari jawaban sumber; tambahan ini memiliki halaman dan penanda asal, dan tidak disebut sebagai daftar kosakata tercetak PDF. Kontak pribadi perekrut dan ID pertemuan tidak disalin.

## Alur utama seperti pelajaran HSK

Enam belas bab berisi 73 pelajaran, satu pertanyaan atau frasa sumber per pelajaran. Perkenalan singkat menjadi pelajaran pertama. Tombol utama membuka pelajaran berikutnya yang belum selesai; setiap pelajaran juga dapat dipilih langsung dari peta. Alur menggunakan peta `LearningPath`, latihan Hanzi `WordRecall`, dan latihan produksi Mandarin `ResponsePractice` yang dipakai kursus HSK.

1. **Kenali:** lihat tujuan pertanyaan dan tugas konkret, lalu pelajari satu sampai empat kata yang benar-benar muncul dalam jawabannya, dengan Hanzi, pinyin, arti Indonesia, audio, dan goresan opsional.
2. **Pahami:** pelajari cara mengingat kata dan contoh penggunaannya. Baca setiap kalimat sumber satu per satu dengan pinyin dan arti Indonesia; Mandarin dapat ditutup untuk latihan lisan. Pola bahasa hanya tampil bila contohnya benar-benar terdapat dalam jawaban tersebut.
3. **Ingat:** ketik atau gambar Hanzi dari arti Indonesia, tanpa pilihan jawaban. Sistem memeriksa jawaban dan mencatat bantuan atau kesalahan.
4. **Jawab sendiri:** hasilkan setiap kalimat Mandarin dari arti Indonesia, lalu jawab pertanyaan lengkap dengan mengetik atau transkripsi suara browser. Referensi tersembunyi sebelum pemeriksaan. Kriteria isi pertanyaan dan lembar bukti asli membantu persiapan pengalaman yang relevan.
5. **Ulangi:** uji pemahaman pertanyaan dan batas klaim bisnis. Latihan salah, berbantuan, atau belum terverifikasi masuk antrean pengulangan pada akhir pelajaran. Tombol pengulangan berikutnya memprioritaskan latihan lemah; latihan mandiri yang benar kembali setelah 24 jam. Materi yang belum pernah dicoba tidak memenuhi antrean ini.

Seluruh 217 kalimat sumber memiliki langkah membaca dan langkah produksi mandiri. Pemeriksaan jawaban bebas dapat memakai pemeriksa bahasa yang tersedia pada aplikasi. Tanpa pemeriksa, kecocokan referensi dapat diperiksa lokal; susunan alternatif yang belum dapat diverifikasi diberi status latihan, bukan kelulusan bahasa. Pemeriksaan tidak membuktikan pengalaman pribadi atau menilai pelafalan.

Audio kata, kalimat, dan jawaban lengkap wawancara disertakan sebagai MP3 dalam `public/audio/jiayin`, dengan pemetaan teks di `src/data/jiayin-audio.json`. Suara Mandarin ini dibuat untuk latihan dan bukan rekaman asli dari PDF atau perusahaan. Playback tidak memerlukan layanan TTS atau suara Mandarin yang terpasang pada browser. Permintaan media dimulai langsung pada event tap, sebelum menunggu unduhan TTS; tes regresi memodelkan pembatasan user gesture pada Safari iPhone. Rekaman penerbit HSK tetap mendapat prioritas untuk teks HSK yang cocok; teks lain tetap memakai jalur TTS yang sudah ada. Preferensi audio dimatikan, penghentian playback, dan kecepatan rekaman tetap mengikuti pengaturan aplikasi. Skrip `scripts/generate-interview-audio.py` dapat membentuk ulang berkas dari teks sumber; model dan dependensi generator tidak ikut aplikasi.

Hasil pemeriksaan disimpan saat diperiksa, sebelum tombol Lanjut ditekan. Membuka bantuan, referensi, atau catatan saat menjawab tetap tercatat bila sesi ditutup lalu dibuka lagi. Kesalahan dan bantuan tidak dihapus dengan melanjutkan. Ringkasan membedakan pelajaran selesai dari latihan terakhir yang benar tanpa bantuan; penilaian diri pada alur lama tidak diubah menjadi penguasaan bahasa baru. Kemajuan pelajaran masuk ke Progress, sementara checkpoint menyimpan posisi dan antrean pengulangan sesi.

## Latihan bagian dan simulasi

Alur lama tetap tersedia dalam **Latih satu bagian saja**, bersama riwayat sebelumnya. Simulasi wawancara memakai penilaian diri dan ditandai demikian. Enam belas unit pada alur ini memiliki enam tahap atau 96 tahap seluruhnya:

1. **Pahami situasi:** tujuan, hal yang dinilai, alur argumen, kesalahan yang perlu dihindari, dan tugas persiapan.
2. **Kosakata:** ingat arti sebelum membuka bantuan, lalu pelajari makna, cara mengingat, audio, dan penggunaan Mandarin–Indonesia dari sumber.
3. **Kalimat dan pola:** buka satu kalimat setiap kali, dengan pinyin, arti Indonesia langsung di bawahnya, audio per kalimat, penjelasan pola, dan pertanyaan lanjutan.
4. **Susun jawaban:** susun potongan Mandarin menjadi alur referensi. Semua 73 jawaban tersedia. Setiap potongan berasal dari sumber; penilaian menguji urutan contoh, bukan menyatakan hanya satu jawaban bebas yang benar.
5. **Jawab mandiri:** jawab tanpa skrip, gunakan kriteria isi yang spesifik, dan isi bukti asli untuk pertanyaan yang memerlukannya. Tahap selesai setelah semua jawaban unit tercatat mandiri.
6. **Uji pemahaman:** arti kata, pemahaman seluruh pertanyaan/frasa, serta penilaian bisnis berbasis sumber. Susun jawaban dan uji pemahaman membutuhkan minimal 80% benar pada percobaan pertama.

Latihan bernilai dimulai kembali saat dibuka ulang; menutup sesi tidak menghapus kesalahan dari suatu nilai yang dapat dilanjutkan. Mengulang atau membuka susunan referensi pada kartu tidak mengubah percobaan pertama yang salah menjadi benar. Tahap baru tidak menghapus tahap lama yang sudah selesai.

Jawaban bebas pada latihan bagian dan simulasi menerima teks Mandarin atau transkripsi suara browser. Waktu dimulai oleh pengguna. Isi dan kelancaran dinilai sendiri, bukan sebagai skor pelafalan. Membuka referensi atau catatan pribadi sebelum menilai tercatat sebagai bantuan, termasuk setelah sesi dibuka kembali. Percobaan berbantuan tidak dihitung sebagai mandiri. Catatan pertanyaan lanjutan tersedia setelah jawaban dinilai; catatan itu tidak menambah skor.

Pengulangan pada alur lama mengutamakan jawaban lemah, lalu jawaban yang jatuh tempo dan materi belum dicoba. Keberhasilan mandiri kembali setelah satu hari; keberhasilan berturut-turut pada dua hari berbeda memperpanjang interval menjadi dua hari, lalu empat hari setelah tiga hari berbeda. Pengulangan berkali-kali pada hari yang sama tidak menaikkan interval. Percobaan lemah atau berbantuan mengembalikan interval. Simulasi berisi 12 pertanyaan dan tiga kasus, dipilih berdasarkan kelemahan atau materi yang belum dicoba.

Lembar pengalaman asli tersedia untuk ERP, data, koordinasi bisnis, kegagalan, konflik, dan dasar pengukuran 75%. Isian lembar otomatis tersedia untuk pertanyaan terkait agar tidak perlu disalin ulang. Catatan tetap harus dinilai berdasarkan bukti dan pengalaman asli; tersedianya teks tidak memvalidasi fakta. Cerita kegagalan, konflik, serta rincian pengukuran tidak dibuat. Rencana 12–15 Oktober tetap mengikuti PDF. Konteks perusahaan dan regulasi adalah isi sumber bertanggal, belum diverifikasi ulang; ketidakpastian zona waktu dipertahankan.

Kemajuan dan catatan menggunakan `yulu.jiayin.v1` pada perangkat ini, terpisah dari kursus lain. Aktivitas memakai catatan riwayat yang ada. Data ini belum disinkronkan ke Supabase.

Tes kurikulum memeriksa cakupan 73 item dan 217 kalimat, asal kata, urutan recall, antrean pengulangan, pemisahan bantuan dari jawaban mandiri, serta kompatibilitas simpanan lama. Tes pemeriksaan bahasa juga memastikan judul program dan nama perusahaan Latin dalam referensi Mandarin tidak ditolak hanya karena panjangnya. Penghapusan lokal `src/assets/handwriting/medians.bin` yang sudah ada sebelum pekerjaan ini dipertahankan dan tidak masuk commit; validasi build dan seluruh tes dilakukan pada salinan sementara yang memakai aset dari commit.
