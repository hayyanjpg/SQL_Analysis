# Deploy Tanpa Kartu Kredit — Backend di Vercel Functions

Render meminta kartu kredit. Alternatif ini memakai **Vercel Hobby** untuk
frontend **dan** backend, tanpa kartu kredit.

| Komponen | Layanan | Catatan |
|---|---|---|
| Frontend | Vercel Hobby | sudah ada: `https://sql-analysis.vercel.app` |
| Backend | Vercel Functions (Python/FastAPI) | project Vercel **kedua** dari repo yang sama |
| Database | Neon Free | sudah di-seed |
| LLM | Gemini API | sama seperti sebelumnya |

## Batasan penting

Vercel Functions membatasi **badan request 4.5 MB**. Karena itu:

- upload CSV/Excel dibatasi **4 MB** (`MAX_UPLOAD_MB=4`);
- upload `.sql` dibatasi **4 MB** (`MAX_SQL_MB=4`);
- frontend juga di-set `VITE_MAX_UPLOAD_MB=4` dan `VITE_MAX_SQL_MB=4`.

Durasi fungsi maksimal **300 detik** di Hobby, cukup untuk Gemini + query.
Python yang dipakai Vercel adalah **3.12** (diatur lewat `.python-version`).

---

## 1. Buat project backend di Vercel

1. Vercel Dashboard → **Add New → Project**.
2. Import repo `SQL_Analysis` **lagi** (project kedua).
3. Isi konfigurasi:

   | Bagian | Nilai |
   |---|---|
   | Project Name | `sift-api` (atau nama lain yang tersedia) |
   | Framework Preset | **Other** (biarkan deteksi otomatis jika muncul FastAPI) |
   | Root Directory | **kosong / repo root** — bukan `frontend` |
   | Build Command | biarkan default |
   | Output Directory | biarkan default |

   > Jangan arahkan Root Directory ke `frontend`. Backend ada di root repo
   > (`main.py`, `database.py`, `requirements.txt`).

4. Buka **Environment Variables**, isi:

   ```text
   DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require&channel_binding=require
   GEMINI_API_KEY=<API key Gemini Anda>
   GEMINI_MODEL=gemini-3.5-flash
   API_ACCESS_KEY=<kunci-akses-Anda>
   CORS_ORIGINS=https://sql-analysis.vercel.app
   MAX_UPLOAD_MB=4
   MAX_SQL_MB=4
   ```

   Jangan menambahkan `VITE_*` di project backend.

5. Klik **Deploy** dan tunggu build selesai.
6. Catat domain backend, misalnya:

   ```text
   https://sift-api.vercel.app
   ```

   Jika nama sudah dipakai, Vercel menambahkan sufiks; pakai URL yang muncul
   di dashboard.

---

## 2. Verifikasi backend

Buka:

```text
https://sift-api.vercel.app/api/health
```

Respons yang benar:

```json
{ "status": "ok", "version": "2.0.0", "auth_required": true }
```

Jika muncul halaman frontend atau 404, Root Directory project salah — harus
repo root, bukan `frontend`.

Uji proteksi:

```powershell
curl -X POST "https://sift-api.vercel.app/api/ask" `
  -H "Content-Type: application/json" `
  -d '{\"question\":\"Berapa jumlah pelanggan?\"}'
```

Harus `401`. Dengan header `X-API-Key` yang benar harus `200`.

---

## 3. Perbarui environment frontend

Di project frontend Vercel (`sql-analysis`):

**Settings → Environment Variables**:

```text
VITE_API_BASE_URL=https://sift-api.vercel.app
VITE_MAX_UPLOAD_MB=4
VITE_MAX_SQL_MB=4
```

Lalu **Redeploy** project frontend. Environment Vite hanya terbaca saat build,
jadi redeploy wajib.

---

## 4. Pastikan CORS

Di project backend Vercel, `CORS_ORIGINS` harus berisi origin frontend **tanpa
slash di akhir**:

```text
CORS_ORIGINS=https://sql-analysis.vercel.app
```

Jika ada domain kustom atau `www`, tambahkan dipisahkan koma:

```text
CORS_ORIGINS=https://sql-analysis.vercel.app,https://www.domain-anda.com
```

Setelah mengubah environment backend, lakukan **Redeploy** project backend.

---

## 5. Tes website

1. Buka <https://sql-analysis.vercel.app>.
2. Klik **Kunci akses**, masukkan kunci yang Anda set di `API_ACCESS_KEY`.
3. Upload CSV **di bawah 4 MB** → cek toast sukses.
4. Tanya: *“Berapa total penjualan per kategori produk?”*
5. Minta perubahan data → panel amber → **Batalkan**, lalu ulangi dan
   **Izinkan Eksekusi**.

---

## 6. Jika gagal

| Gejala | Penyebab | Solusi |
|---|---|---|
| Build error / tidak ada Python | Root Directory salah | Set ke repo root |
| `404 NOT_FOUND` di `/api/health` | Framework tidak terdeteksi | Pastikan `main.py`, `requirements.txt`, `.python-version`, `vercel.json` ada di root project |
| `413 FUNCTION_PAYLOAD_TOO_LARGE` | File > 4.5 MB | Gunakan file < 4 MB |
| `401` | Kunci salah | Samakan dengan `API_ACCESS_KEY` |
| CORS error | Origin tidak cocok | Isi `CORS_ORIGINS` dengan URL frontend persis |
| `500` koneksi database | `DATABASE_URL` salah | Salin ulang connection string Neon |
| `FUNCTION_INVOCATION_TIMEOUT` | Query/Gemini terlalu lama | Ulangi; maksimal 300 detik |
| Frontend masih menembak `onrender.com` | Env frontend belum diubah | Ganti `VITE_API_BASE_URL`, lalu redeploy |

---

## 7. Catatan serverless

- Function dibuat ulang saat idle; **tidak ada sleep 15 menit** seperti Render,
  tetapi request pertama setelah lama idle bisa lebih lambat beberapa detik.
- Rate limit in-memory hanya berlaku per instance function. Proteksi utama
  tetap `API_ACCESS_KEY`.
- Vercel Hobby hanya untuk penggunaan **non-komersial/personal**.
- Log function tersedia di tab **Logs** project backend.
- Neon tetap database eksternal; koneksi dibuat per invocation.
