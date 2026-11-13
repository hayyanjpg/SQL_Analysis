# Deploy Tanpa Kartu Kredit — Backend di Vercel Functions

Render meminta kartu kredit. Alternatif ini memakai **Vercel Hobby** untuk
frontend **dan** backend, tanpa kartu kredit.

| Komponen | Layanan | Catatan |
|---|---|---|
| Frontend | Vercel Hobby | sudah ada: `https://sql-analysis.vercel.app` |
| Backend | Vercel Functions (Python/FastAPI) | project Vercel **kedua** dari repo yang sama |
| Database | Supabase Free (PostgreSQL) | project `zffawpuvxcpntrhglnik`, region Singapura |
| Auth | Supabase Auth | email magic link/OTP, Google menyusul |
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
   DATABASE_URL=postgresql://postgres.zffawpuvxcpntrhglnik:<PASSWORD>@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
   SUPABASE_URL=https://zffawpuvxcpntrhglnik.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_...
   GEMINI_API_KEY=<API key Gemini Anda>
   GEMINI_MODEL=gemini-3.5-flash
   API_ACCESS_KEY=<kunci-akses-Anda>
   CORS_ORIGINS=https://sql-analysis.vercel.app
   MAX_UPLOAD_MB=4
   MAX_SQL_MB=4
   ```

   - `DATABASE_URL` memakai **transaction pooler** Supabase (port `6543`),
     bukan koneksi langsung port `5432`.
   - `SUPABASE_URL` hanya alamat project, diawali `https://`, tanpa `/auth/v1`
     dan tanpa password.
   - `SUPABASE_ANON_KEY` adalah publishable/anon key, **bukan** service role key.
   - `API_ACCESS_KEY` dipertahankan sementara sebagai mode lama. Pengguna yang
     login selalu memakai workspace sendiri; kunci hanya untuk akses pemilik.

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
{
  "status": "ok",
  "version": "2.0.0",
  "auth_required": true,
  "database_configured": true,
  "supabase_configured": true,
  "gemini_configured": true,
  "max_upload_mb": 4,
  "max_sql_mb": 4
}
```

Jika `supabase_configured` bernilai `false`, cek `SUPABASE_URL` dan
`SUPABASE_ANON_KEY`. Endpoint `/api/auth/diagnose` (dengan header `X-API-Key`)
menampilkan host dan status koneksi tanpa membocorkan kunci.

Jika `database_configured` atau `gemini_configured` bernilai `false`, environment
variable belum terbaca. Perbaiki di **Settings → Environment Variables**
(pastikan centang **Production**), lalu **Redeploy**.

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

## 2b. Jika muncul `500 FUNCTION_INVOCATION_FAILED`

1. Buka **project backend → Logs**, buka ulang URL `/api/health`, lalu lihat
   traceback terbaru.
2. Cek **Settings → Environment Variables**:
   - `DATABASE_URL` dan `GEMINI_API_KEY` ada dan tidak kosong;
   - nilainya **tanpa tanda kutip** (`"`), karena Vercel tidak memakai shell;
   - centang **Production** (bukan hanya Preview/Development).
3. Setelah mengubah env, klik **Deployments → deployment terbaru → Redeploy**.
4. Buka lagi `/api/health`. Respons sekarang menunjukkan
   `database_configured` dan `gemini_configured`.

Jika traceback berisi `ModuleNotFoundError: No module named 'psycopg'`, artinya
SQLAlchemy memilih driver psycopg v3. Kode sudah menormalkan URL ke
`postgresql+psycopg2://` dan `requirements.txt` sudah membatasi
`sqlalchemy<2.1`, jadi pastikan deployment memakai commit terbaru (bukan cache
lama). Hapus build cache bila masih muncul setelah redeploy.

Penyebab umum:

- `DATABASE_URL` belum diisi → sebelumnya aplikasi gagal saat import;
- `GEMINI_API_KEY` belum diisi → `/api/ask` mengembalikan `503`;
- nilai env disalin lengkap dengan tanda kutip;
- environment hanya diset untuk Preview, bukan Production.

---

## 3. Perbarui environment frontend

Di project frontend Vercel (`sql-analysis`):

**Settings → Environment Variables**:

```text
VITE_API_BASE_URL=https://sql-analysis-el64.vercel.app
VITE_SUPABASE_URL=https://zffawpuvxcpntrhglnik.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_MAX_UPLOAD_MB=4
VITE_MAX_SQL_MB=4
```

Lalu **Redeploy** project frontend. Environment Vite hanya terbaca saat build,
jadi redeploy wajib. Tanpa `VITE_SUPABASE_*`, aplikasi kembali ke mode kunci
akses bersama (tanpa login).

Catatan: `frontend/src/api.js` punya fallback otomatis — saat dibuka dari
localhost memakai `http://127.0.0.1:8000`, saat dibuka dari domain publik
memakai `https://sql-analysis-el64.vercel.app`. Jadi situs tetap berfungsi
walau env di atas belum diisi. Env tetap disarankan agar URL backend mudah
diganti tanpa mengubah kode. `VITE_MAX_UPLOAD_MB` dan `VITE_MAX_SQL_MB`
default-nya sudah 4 MB, jadi tetap aman meski env belum diisi.

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

## 4b. Login dan isolasi data per akun

Model penyimpanan:

- satu akun Supabase = satu schema PostgreSQL `ws_<24 hex>`;
- tabel hasil upload akun disimpan di schema akun itu, bukan di `public`;
- schema `public` hanya untuk mode kunci akses lama/pemilik;
- setiap transaksi diarahkan dengan `SET LOCAL search_path`, dan backend
  menolak query yang menulis nama schema lain (`public.tabel`,
  `ws_akunlain.tabel`).

Metadata pemetaan akun → schema ada di `public.workspaces` dan tidak pernah
dibaca/ditulis oleh pengguna.

### Atur URL redirect Supabase

Supabase Dashboard → **Authentication → URL Configuration**:

| Field | Nilai |
|---|---|
| Site URL | `https://sql-analysis.vercel.app` |
| Redirect URLs | `https://sql-analysis.vercel.app`, `http://localhost:5173` |

Tanpa ini, tautan masuk dari email bisa diarahkan ke alamat yang salah.

### Email magic link / OTP

Pastikan **Authentication → Providers → Email** aktif. Layanan email bawaan
Supabase punya batas kirim per jam; untuk menguji beberapa akun, gunakan Google
atau SMTP sendiri.

### Google (opsional)

**Authentication → Providers → Google** → isi Client ID dan Client Secret dari
Google Cloud Console. Redirect URI yang didaftarkan di Google:

```text
https://zffawpuvxcpntrhglnik.supabase.co/auth/v1/callback
```

Tombol Google di halaman masuk sudah tersedia; jika provider belum aktif,
tombol menampilkan pesan error dan login email tetap bisa dipakai.

### Uji isolasi dua akun

1. Masuk dengan akun A, unggah CSV, catat nama tabelnya.
2. Buka jendela privat, masuk dengan akun B. Daftar tabel harus **kosong**.
3. Unggah tabel dengan nama yang sama di akun B.
4. Kembali ke akun A: data A harus tetap utuh dan tidak berubah.

Untuk memastikan dari sisi database, buka **Supabase → SQL Editor**:

```sql
-- Satu baris per akun yang pernah login.
select owner_id, schema_name, created_at
from public.workspaces
order by created_at;

-- Tabel milik tiap akun (schema ws_...) beserta pemiliknya.
select w.owner_id, t.table_schema, t.table_name
from information_schema.tables t
join public.workspaces w on w.schema_name = t.table_schema
where t.table_schema like 'ws\_%'
order by t.table_schema, t.table_name;
```

Jika `public.workspaces` belum ada, artinya belum ada login dengan token valid
yang sampai ke backend (bootstrap berjalan pada `/api/auth/me` pertama).

> Tips menguji dua akun dengan satu kotak masuk: Gmail menganggap
> `nama+uji1@gmail.com` dan `nama+uji2@gmail.com` sebagai alamat berbeda tetapi
> mengirim keduanya ke kotak masuk yang sama.

---

## 5. Tes website

1. Buka <https://sql-analysis.vercel.app>.
2. Masuk dengan email (tautan/kode dari Supabase) atau Google.
3. Setelah masuk, header menampilkan email dan sidebar menampilkan nama schema
   ruang data (`ws_...`).
4. Upload CSV **di bawah 4 MB** → cek toast sukses.
5. Tanya: *“Berapa total penjualan per kategori produk?”*
6. Minta perubahan data → panel amber → **Batalkan**, lalu ulangi dan
   **Izinkan Eksekusi**.

---

## 6. Jika gagal

| Gejala | Penyebab | Solusi |
|---|---|---|
| `500 FUNCTION_INVOCATION_FAILED` | Env belum terbaca / nilai mengandung tanda kutip | Buka `/api/health`; jika tetap 500, buka **Logs** dan cek traceback. Hapus tanda kutip dari nilai env, centang Production, lalu redeploy |
| Build error / tidak ada Python | Root Directory salah | Set ke repo root |
| `404 NOT_FOUND` di `/api/health` | Framework tidak terdeteksi | Pastikan `main.py`, `requirements.txt`, `.python-version`, `vercel.json` ada di root project |
| `413 FUNCTION_PAYLOAD_TOO_LARGE` | File > 4.5 MB | Gunakan file < 4 MB |
| `401` | Kunci salah atau sesi login kedaluwarsa | Masukkan ulang kunci, atau keluar lalu masuk lagi |
| `503` pada login | `SUPABASE_URL` salah / berisi connection string database | Isi hanya `https://<project>.supabase.co`, lalu redeploy |
| Tautan email masuk ke alamat salah | Site URL / Redirect URLs belum diatur | Atur di Supabase → Authentication → URL Configuration |
| Email login tidak terkirim | Batas layanan email bawaan Supabase | Tunggu, gunakan Google, atau pasang SMTP sendiri |
| Akun baru melihat data akun lain | Deploy lama / bukan schema workspace | Pastikan `/api/auth/me` mengembalikan `ws_...` dan commit isolasi sudah terpasang |
| CORS error | Origin tidak cocok | Isi `CORS_ORIGINS` dengan URL frontend persis |
| `500` koneksi database | `DATABASE_URL` salah | Salin ulang connection string **transaction pooler** Supabase (port 6543) |
| `FUNCTION_INVOCATION_TIMEOUT` | Query/Gemini terlalu lama | Ulangi; maksimal 300 detik |
| Frontend masih menembak `onrender.com` atau `127.0.0.1` | Env frontend belum diubah / build lama | Set `VITE_API_BASE_URL`, lalu redeploy frontend |
| `ModuleNotFoundError: No module named 'psycopg'` | SQLAlchemy 2.1 memilih driver psycopg v3 | Pastikan commit `65152df`+ terpasang; kode memaksa `postgresql+psycopg2` dan `sqlalchemy<2.1` |

---

## 7. Catatan serverless

- Function dibuat ulang saat idle; **tidak ada sleep 15 menit** seperti Render,
  tetapi request pertama setelah lama idle bisa lebih lambat beberapa detik.
- Rate limit in-memory hanya berlaku per instance function. Proteksi utama
  tetap `API_ACCESS_KEY`.
- Vercel Hobby hanya untuk penggunaan **non-komersial/personal**.
- Log function tersedia di tab **Logs** project backend.
- Supabase tetap database eksternal; koneksi dibuat per invocation lewat
  transaction pooler. Jangan memakai koneksi langsung port 5432 di serverless.
