# Panduan Deploy Publik — Render + Neon + Vercel

Panduan ini membuat SIFT dapat diakses publik **tanpa kartu kredit**:

| Komponen | Layanan | Biaya |
|---|---|---|
| Frontend React (Vite) | Vercel Hobby | Gratis |
| Backend FastAPI | Render Free Web Service | Gratis (sleep setelah 15 menit) |
| PostgreSQL | Neon Free | Gratis (permanen, tanpa kartu) |
| Text-to-SQL | Google Gemini API Free Tier | Gratis dengan kuota terbatas |

> **Penting:** jangan gunakan Render PostgreSQL Free. Databasenya kedaluwarsa
> setelah 30 hari. Gunakan Neon.

> **Render meminta kartu kredit?** Gunakan backend Vercel Functions yang juga
> gratis dan tanpa kartu: lihat **[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)**.

---

## 0. Prasyarat

- Repo GitHub: `https://github.com/hayyanjpg/SQL_Analysis`
- Akun [Neon](https://neon.tech), [Render](https://render.com),
  [Vercel](https://vercel.com), dan [Google AI Studio](https://aistudio.google.com).
- Python 3.11+ dan Node.js 18+ di komputer lokal (untuk seeding dan build).
- File konfigurasi yang sudah disiapkan di repo:
  - `render.yaml` — Blueprint backend Render.
  - `frontend/vercel.json` — konfigurasi frontend Vercel.

---

## 1. Buat database Neon

1. Masuk ke Neon Console → **New Project**.
2. Pilih region terdekat (mis. **Singapore**), beri nama `sift`.
3. Buka **Connection Details** → pilih **Direct connection** (bukan pooled).
4. Salin connection string. Bentuknya:

   ```text
   postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

5. Simpan string tersebut. Jangan commit ke Git.

### Seed data awal dari komputer lokal

Jalankan dari root proyek. Di PowerShell:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
python seed.py
Remove-Item Env:DATABASE_URL
```

`seed.py` membuat tabel `customers`, `products`, `sales` beserta data dummy.
Jangan jalankan dua kali tanpa `--reset`, karena tabel sudah ada.

---

## 2. Siapkan kunci akses

Buat kunci acak yang panjang:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Simpan hasilnya. Kunci ini dipakai untuk dua hal:

- environment `API_ACCESS_KEY` di Render;
- kunci yang dimasukkan pengguna lewat tombol **Kunci akses** di frontend.

Tanpa kunci ini, siapa pun bisa mengunggah file dan mengeksekusi SQL.

---

## 3. Deploy backend ke Render

1. Render Dashboard → **New +** → **Blueprint**.
2. Hubungkan GitHub dan pilih repo `SQL_Analysis`.
3. Render membaca `render.yaml`. Isi nilai yang diminta:

   | Variabel | Nilai |
   |---|---|
   | `DATABASE_URL` | connection string Neon dari langkah 1 |
   | `GEMINI_API_KEY` | API key dari Google AI Studio |
   | `API_ACCESS_KEY` | kunci acak dari langkah 2 |
   | `CORS_ORIGINS` | sementara isi `https://example.com` (diperbarui nanti) |

4. Klik **Apply**. Tunggu build selesai.
5. Catat URL backend, misalnya:

   ```text
   https://sift-api.onrender.com
   ```

6. Uji health check:

   ```powershell
   curl https://sift-api.onrender.com/api/health
   ```

   Respons yang benar:

   ```json
   { "status": "ok", "version": "2.0.0", "auth_required": true }
   ```

Jika `auth_required` bernilai `false`, `API_ACCESS_KEY` belum terpasang —
perbaiki di tab **Environment**, lalu redeploy.

### Jika Blueprint meminta kartu kredit

Beberapa akun diminta verifikasi kartu saat memakai Blueprint. Free **Web
Service** biasanya masih bisa dibuat manual tanpa kartu:

1. Render Dashboard → **New +** → **Web Service** (bukan Blueprint).
2. Pilih repo `SQL_Analysis`.
3. Isi:
   - **Name**: `sift-api`
   - **Region**: Singapore
   - **Branch**: `main`
   - **Root Directory**: kosongkan (backend ada di root repo)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/api/health`
   - **Instance Type**: Free
4. Di bagian **Environment**, isi variabel yang sama seperti tabel di atas
   (`DATABASE_URL`, `GEMINI_API_KEY`, `API_ACCESS_KEY`, `CORS_ORIGINS`).
5. Klik **Create Web Service**.

Jika langkah manual ini **masih** meminta kartu, gunakan
**[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)** — backend FastAPI tetap di Vercel,
tanpa kartu. Alternatif lain ada di bagian
[Alternatif tanpa kartu sama sekali](#alternatif-tanpa-kartu-sama-sekali).

---

## 4. Deploy frontend ke Vercel

1. Vercel Dashboard → **Add New → Project** → import repo `SQL_Analysis`.
2. Atur:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Tambahkan environment variable:

   | Nama | Nilai |
   |---|---|
   | `VITE_API_BASE_URL` | `https://sift-api.onrender.com` (tanpa `/api`) |

   Ganti `sift-api.onrender.com` dengan URL backend Anda yang sebenarnya.
   Jangan biarkan placeholder `https://<service>.onrender.com`, karena frontend
   akan menembak host yang tidak ada.

4. Klik **Deploy**, lalu catat URL frontend:

   ```text
   https://sift.vercel.app
   ```

---

## 5. Hubungkan CORS

Kembali ke Render → service backend → **Environment** → ubah:

```text
CORS_ORIGINS=https://sift.vercel.app
```

Simpan. Render akan redeploy otomatis. Tanpa langkah ini, browser akan
memblokir request dari Vercel dengan error CORS.

Jika memakai domain kustom, tambahkan juga domain tersebut, dipisahkan koma:

```text
CORS_ORIGINS=https://sift.vercel.app,https://domain-anda.com
```

---

## 6. Verifikasi publik

1. Buka URL Vercel.
2. Klik **Kunci akses**, masukkan `API_ACCESS_KEY`, lalu **Simpan kunci**.
3. Upload CSV kecil → cek toast sukses dan tabel muncul di sidebar.
4. Tanyakan: *“Berapa total penjualan per kategori produk?”* → tabel/grafik.
5. Minta perubahan, mis. *“Naikkan harga produk Laptop Asus VivoBook 14 sebesar 5%”*
   → panel amber muncul. Klik **Batalkan** untuk menguji pembatalan, lalu ulangi
   dan klik **Izinkan Eksekusi**.
6. Cek proteksi: buka URL backend `/api/health` (boleh), lalu coba
   `POST /api/ask` tanpa header `X-API-Key` → harus `401`.

---

## 7. Batasan free tier

- **Cold start:** backend tidur setelah 15 menit tanpa request. Request pertama
  bisa memakan 30–60 detik. Frontend sudah memakai timeout 120 detik.
- **RAM 512 MB / 0.1 CPU:** batas upload diturunkan ke **10 MB** untuk CSV/Excel.
  Untuk file lebih besar, naikkan `MAX_UPLOAD_MB` **dan** upgrade instance.
- **Rate limit in-memory:** hitungan reset saat Render restart. Cukup untuk
  pemakaian kecil, bukan pengganti firewall/WAF.
- **Log Render free** bersifat sementara.
- **Gemini free tier:** kuota harian terbatas dan data dapat dipakai Google
  untuk meningkatkan produk. Jangan gunakan data pribadi/rahasia.
- **Neon free:** 1 GB penyimpanan dan 100 CU-jam/bulan; database di-suspend
  otomatis saat idle dan bangun kembali saat ada koneksi.

---

## 8. Jika ada masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `401 Kunci akses tidak valid` | Kunci salah/berbeda | Samakan dengan `API_ACCESS_KEY` Render, lalu simpan ulang |
| Error CORS di browser | `CORS_ORIGINS` belum memuat domain Vercel | Perbarui env Render, tunggu redeploy |
| `502` saat bertanya | Model Gemini tidak tersedia/kuota habis | Cek `GEMINI_MODEL` dan kuota Google AI Studio |
| `500` saat upload | Koneksi database/Neon suspended | Buka Neon Console, cek connection string dan `sslmode=require` |
| Halaman blank di Vercel | Root Directory salah | Pastikan `frontend`, bukan root repo |
| Backend lambat sekali di awal | Render free cold start | Tunggu ±1 menit, lalu ulangi |

---

## 9. Keamanan yang perlu diketahui

- Kunci akses bersifat **bersama**: siapa pun yang memilikinya dapat mengunggah
  file dan menyetujui DML. Rotasi kunci jika bocor (ubah `API_ACCESS_KEY` di
  Render, lalu minta pengguna memasukkan kunci baru).
- File `.sql` masih dapat menjalankan `DROP TABLE`, `TRUNCATE`, atau `DELETE`
  pada tabel aplikasi. Untuk instance publik, gunakan database khusus, backup
  berkala, dan role PostgreSQL dengan hak minimum.
- Idealnya SELECT dan DML memakai role database berbeda. Versi ini masih memakai
  satu `DATABASE_URL`.
- Jangan mengunggah data pribadi, kredensial, atau data produksi ke instance demo.

---

## 10. Alternatif tanpa kartu sama sekali

### A. Cloudflare Tunnel (gratis, tanpa kartu)

Cocok sebagai solusi sementara. Backend berjalan di komputer Anda dan
diekspos lewat HTTPS; komputer harus tetap menyala dan tidak sleep.

```powershell
# Terminal 1 — backend lokal
uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2 — pasang cloudflared (sekali saja), lalu jalankan tunnel
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://127.0.0.1:8000
```

Salin URL `https://xxxx.trycloudflare.com` yang muncul, lalu:

1. Di Vercel, ubah `VITE_API_BASE_URL` menjadi URL tersebut dan redeploy.
2. Di `.env` backend, isi `CORS_ORIGINS` dengan URL Vercel dan
   `API_ACCESS_KEY` dengan kunci akses Anda.
3. Restart uvicorn.

Kekurangan: URL berubah setiap tunnel dijalankan ulang, dan website mati jika
komputer/tunnel berhenti. Untuk URL tetap, gunakan **named tunnel** Cloudflare
dengan domain sendiri (tetap gratis, tanpa kartu).

### B. Northflank Sandbox

Halaman pricing Northflank menyatakan **“No card needed”** dengan 2 service
selalu aktif. Namun dokumentasi billing mereka masih menyebut perlunya metode
pembayaran untuk verifikasi. Coba daftar; jika diminta kartu, kembali ke opsi A.

---

## 11. Update aplikasi

Setiap push ke branch `main`:

- Render otomatis redeploy backend (`autoDeploy: true`);
- Vercel otomatis redeploy frontend.

Jika skema berubah, seed ulang database dengan hati-hati:

```powershell
$env:DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
python seed.py --reset   # DATA LAMA HILANG
Remove-Item Env:DATABASE_URL
```
