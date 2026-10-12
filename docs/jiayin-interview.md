# Kurikulum wawancara Jiayin

Buka **Wawancara Jiayin**, buku pertama di perpustakaan. Kursus tersedia di Home dan Learn, dengan kemajuan terpisah di Progress.

Sumbernya adalah `Richie_Jiayin_Interview_CN_ID_2026-10-15.pdf`. Materi mencakup seluruh 48 pertanyaan bernomor, enam studi kasus hipotetis, tiga versi perkenalan/penutup, delapan frasa klarifikasi, delapan pertanyaan balik, 25 kosakata, tujuh bagian konteks perusahaan/posisi, dan sembilan aturan konsistensi fakta. Pertanyaan dan jawaban Mandarin dipertahankan dari PDF. Arti Indonesia untuk 217 kalimat, maksud pertanyaan, dan latihan lanjutan merupakan tambahan pengajaran. Kontak pribadi perekrut dan ID pertemuan tidak disalin.

Enam belas unit memiliki enam tahap atau 96 tahap seluruhnya:

1. **Pahami situasi:** tujuan, hal yang dinilai, alur argumen, kesalahan yang perlu dihindari, dan tugas persiapan.
2. **Kosakata:** ingat arti sebelum membuka bantuan, lalu pelajari makna, cara mengingat, audio, dan penggunaan Mandarin–Indonesia dari sumber.
3. **Kalimat dan pola:** buka satu kalimat setiap kali, dengan pinyin, arti Indonesia langsung di bawahnya, audio per kalimat, penjelasan pola, dan pertanyaan lanjutan.
4. **Susun jawaban:** susun potongan Mandarin menjadi alur referensi. Semua 73 jawaban tersedia. Setiap potongan berasal dari sumber; penilaian menguji urutan contoh, bukan menyatakan hanya satu jawaban bebas yang benar.
5. **Jawab mandiri:** jawab tanpa skrip, gunakan kriteria isi yang spesifik, dan isi bukti asli untuk pertanyaan yang memerlukannya. Tahap selesai setelah semua jawaban unit tercatat mandiri.
6. **Uji pemahaman:** arti kata, pemahaman seluruh pertanyaan/frasa, serta penilaian bisnis berbasis sumber. Susun jawaban dan uji pemahaman membutuhkan minimal 80% benar pada percobaan pertama.

Latihan bernilai dimulai kembali saat dibuka ulang; menutup sesi tidak menghapus kesalahan dari suatu nilai yang dapat dilanjutkan. Mengulang atau membuka susunan referensi pada kartu tidak mengubah percobaan pertama yang salah menjadi benar. Tahap baru tidak menghapus tahap lama yang sudah selesai.

Jawaban bebas menerima teks Mandarin atau transkripsi suara browser. Waktu dimulai oleh pengguna. Isi dan kelancaran dinilai sendiri, bukan dinilai otomatis dari kecocokan skrip atau sebagai skor pelafalan. Membuka referensi atau catatan pribadi sebelum menilai tercatat sebagai bantuan, termasuk setelah sesi dibuka kembali. Percobaan berbantuan tidak dihitung sebagai mandiri. Catatan pertanyaan lanjutan tersedia setelah jawaban dinilai; catatan itu tidak menambah skor.

Pengulangan mengutamakan jawaban lemah, lalu jawaban yang jatuh tempo dan materi belum dicoba. Keberhasilan mandiri kembali setelah satu hari; keberhasilan berturut-turut pada dua hari berbeda memperpanjang interval menjadi dua hari, lalu empat hari setelah tiga hari berbeda. Pengulangan berkali-kali pada hari yang sama tidak menaikkan interval. Percobaan lemah atau berbantuan mengembalikan interval. Simulasi berisi 12 pertanyaan dan tiga kasus, dipilih berdasarkan kelemahan atau materi yang belum dicoba.

Lembar pengalaman asli tersedia untuk ERP, data, koordinasi bisnis, kegagalan, konflik, dan dasar pengukuran 75%. Isian lembar otomatis tersedia untuk pertanyaan terkait agar tidak perlu disalin ulang. Catatan tetap harus dinilai berdasarkan bukti dan pengalaman asli; tersedianya teks tidak memvalidasi fakta. Cerita kegagalan, konflik, serta rincian pengukuran tidak dibuat. Rencana 12–15 Oktober tetap mengikuti PDF. Konteks perusahaan dan regulasi adalah isi sumber bertanggal, belum diverifikasi ulang; ketidakpastian zona waktu dipertahankan.

Kemajuan dan catatan menggunakan `yulu.jiayin.v1` pada perangkat ini, terpisah dari kursus lain. Aktivitas memakai catatan riwayat yang ada. Data ini belum disinkronkan ke Supabase.

Validasi meliputi pemeriksaan TypeScript, tes cakupan dan logika kurikulum, pencocokan seluruh Mandarin dengan teks PDF, serta pemeriksaan browser pada layar ponsel. Penghapusan `src/assets/handwriting/medians.bin` yang sudah ada sebelum pekerjaan ini menghalangi build normal dan tes handwriting. Build lengkap diperiksa memakai aset dari commit melalui alias dalam konfigurasi sementara di `/tmp/jiayin-preview`; penghapusan pada direktori kerja dipertahankan.
