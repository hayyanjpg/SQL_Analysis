# Ide pengembangan SIFT

Daftar ide output/fitur yang dibahas setelah peluncuran awal. **Belum ada yang
dikerjakan.** Urutan di bawah adalah saran prioritas, bukan komitmen.

Keadaan saat catatan ini dibuat: text-to-SQL, upload CSV/Excel/SQL, tabel hasil,
grafik otomatis batang/garis, salin SQL, riwayat per akun, login Google/email,
workspace per akun, Groq + fallback Gemini, dan kuota 15 pertanyaan/akun/hari.

---

## Prioritas 1 — cepat dan langsung terasa

| Fitur | Nilai | Effort |
|---|---|---|
| **Ekspor CSV/Excel** | Pengguna non-IT hampir selalu ingin membawa hasil ke Excel. | Rendah |
| **Kartu KPI** | Hasil 1 baris/1 angka ditampilkan sebagai angka besar, bukan tabel kosong. | Rendah |
| **Ringkasan angka otomatis** | Tanpa AI: total, nilai tertinggi/terendah, rata-rata. Gratis dan instan. | Rendah |
| **Keadaan hasil kosong** | Pesan “tidak ada baris yang cocok” + saran melonggarkan filter. | Rendah |

## Prioritas 2 — versi realistis “dashboard otomatis”

| Fitur | Nilai | Effort |
|---|---|---|
| **Simpan ke Dasbor (Pin)** | Hasil yang benar disimpan sebagai kartu; dasbor menjalankan ulang query saat dibuka. Tidak memakai AI saat melihat. | Sedang |
| **Profil data setelah upload** | Jumlah baris/kolom, nilai kosong, duplikat, rentang tanggal, contoh pertanyaan. | Sedang |
| **Saran pertanyaan lanjutan** | Chip seperti “Bandingkan per bulan”, “5 teratas”, “Filter tahun ini”. Bisa heuristik. | Sedang |
| **Penjelasan query** | “Query ini menghitung … lalu mengurutkan …” untuk membangun kepercayaan. | Sedang |

## Prioritas 3 — setelah ada pengguna nyata

- Percakapan lanjutan yang mengingat hasil sebelumnya (“kecualikan kategori X”).
- Bagikan dasbor lewat tautan kedaluwarsa.
- Ringkasan berkala ke email/WhatsApp.
- Mode gelap, PWA, dan polish mobile.

---

## Catatan desain

- **Jangan** mengubah satu pertanyaan langsung menjadi dashboard penuh secara
  otomatis. Pemilihan grafik sering salah dan sulit dipercaya.
- Lebih baik: pengguna **memilih (pin)** hasil yang sudah benar, lalu menyusunnya
  menjadi dasbor.
- Fitur yang memanggil LLM (mis. narasi hasil) harus **opsional** dan sadar kuota,
  karena setiap panggilan mengurangi jatah harian akun.
- Ringkasan angka sederhana sebaiknya dihitung di klien/backend tanpa LLM agar
  gratis dan deterministik.

## Jika nanti dikerjakan

Mulai dari **Paket output cepat** (ekspor + KPI + ringkasan angka), lalu
**Simpan ke Dasbor**, lalu **Profil data + saran pertanyaan**.
