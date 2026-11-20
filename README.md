# SQL_Analysis

### SIFT — Text-to-SQL Desk

Platform analitik data berbasis bahasa natural: masuk dengan akun Google atau email, unggah dataset sendiri, ajukan pertanyaan dalam bahasa Indonesia/Inggris, lalu dapatkan tabel, grafik, dan SQL dari PostgreSQL. Setiap akun memiliki ruang data terpisah, dan akun baru mulai dari ruang kosong.

Perubahan data (`INSERT`, `UPDATE`, `DELETE`) tidak pernah dijalankan diam-diam — semuanya menunggu persetujuan eksplisit pengguna.

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Groq](https://img.shields.io/badge/Groq-API-F55036)](https://console.groq.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-cadangan-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%2B_Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Hobby-000000?logo=vercel&logoColor=white)](https://vercel.com/)

---

## Daftar isi

- [Ringkasan](#ringkasan)
- [Status produksi](#status-produksi)
- [Fitur utama](#fitur-utama)
- [Arsitektur](#arsitektur)
- [Tech stack](#tech-stack)
- [Model data dan isolasi akun](#model-data-dan-isolasi-akun)
- [Struktur proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi environment](#konfigurasi-environment)
- [Menjalankan aplikasi](#menjalankan-aplikasi)
- [Deploy publik](#deploy-publik)
- [Dokumentasi API](#dokumentasi-api)
- [Aturan keamanan](#aturan-keamanan)
- [Verifikasi](#verifikasi)
- [Batasan dan risiko](#batasan-dan-risiko)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Kontribusi](#kontribusi)
- [Lisensi](#lisensi)
- [Ucapan terima kasih](#ucapan-terima-kasih)

---

## Ringkasan

SIFT menjembatani pengguna bisnis dan database PostgreSQL tanpa memerlukan pengetahuan SQL. Alur intinya:

1. **Masuk dengan akun** — Google atau email + kata sandi. Situs publik hanya bisa dipakai setelah login; tidak ada kunci akses bersama.
2. **Unggah data** — CSV, Excel (`.xlsx`/`.xls`), atau skrip `.sql` langsung dari antarmuka. Tabel masuk ke schema PostgreSQL milik akun tersebut.
3. **Tanya dengan bahasa natural** — backend membaca skema workspace secara *real-time* dan menyuntikkannya ke prompt LLM. Groq menjadi penyedia utama, Gemini menjadi cadangan.
4. **SELECT langsung dijalankan** — hasil dikembalikan sebagai tabel dan otomatis divisualisasikan sebagai grafik batang atau garis bila bentuk datanya cocok.
5. **DML menunggu izin** — `INSERT`, `UPDATE`, dan `DELETE` dikembalikan sebagai usulan query. Pengguna membaca SQL-nya, lalu memilih **Izinkan Eksekusi** atau **Batalkan**.

Pengguna **tidak perlu** menyiapkan API key LLM sendiri. Kunci milik pemilik aplikasi dipakai lewat backend, lalu dibatasi dengan kuota harian per akun.

> Untuk produksi, baca [Batasan dan risiko](#batasan-dan-risiko) terlebih dahulu.

---

## Status produksi

| Komponen | Alamat / layanan |
|---|---|
| Frontend | <https://sql-analysis.vercel.app> |
| Backend API | <https://sql-analysis-el64.vercel.app> |
| Database & Auth | Supabase (PostgreSQL + Supabase Auth) |
| Akses | Login Google atau email + kata sandi; `API_ACCESS_KEY` tidak dipakai |
| LLM | Groq `openai/gpt-oss-120b` (utama), Gemini (cadangan) |
| Kuota | 15 pertanyaan per akun per hari (UTC), dapat diubah lewat `DAILY_QUESTION_LIMIT` |

Dokumen ini menggambarkan mode publik **login-only**. Panduan `DEPLOY.md` dan `render.yaml` adalah warisan deploy Render + Neon; untuk deployment yang sekarang dipakai, ikuti [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md).

---

## Screenshots

| Login Page | After Login (Dashboard) |
| --- | --- |
| ![Login](docs/screenshots/01-login.png) | ![Dashboard](docs/screenshots/02-dashboard.png) |

---

## Fitur utama

### 1. Bring Your Own Data (BYOD)

- Upload `.csv`, `.xlsx`, `.xls`, dan `.sql` melalui modal dropzone (klik atau drag & drop).
- Nama tabel dan kolom dinormalisasi otomatis: huruf kecil, spasi/karakter khusus menjadi `_`, aksen dihapus, nama yang berawalan angka diberi prefiks, dan identifier yang bentrok dengan kata kunci PostgreSQL diubah agar aman.
- Batas default lokal: **10 MB** untuk CSV/Excel dan **5 MB** untuk SQL, maksimal **200.000 baris** dan **300 kolom**.
- Di Vercel Functions, gunakan **4 MB** untuk keduanya karena badan request dibatasi 4.5 MB.
- Hanya **sheet pertama** Excel yang diimpor (`sheet_name=0`).
- File `.sql` dijalankan **atomik** dalam satu transaksi: sukses semua atau rollback semua.
- Mode `if_exists`: `fail` (default), `replace`, atau `append`.

### 2. Ruang data terpisah per akun

- Satu akun Supabase = satu schema PostgreSQL `ws_<24 hex>`.
- Tabel hasil upload akun disimpan di schema akun itu, bukan di `public`.
- Akun baru mulai dari schema kosong; data pemilik atau data contoh tidak terlihat oleh akun lain.
- Setiap transaksi diarahkan dengan `SET LOCAL search_path` ke schema akun.
- Backend menolak query yang menulis nama schema lain (`public.tabel`, `ws_akunlain.tabel`) dengan `403`.
- Metadata pemetaan akun → schema ada di `public.workspaces` dan tidak dapat dibaca/ditulis pengguna.

### 3. Text-to-SQL yang aman

- Output LLM dibersihkan dari markdown fence, prefiks `sql:`, backtick, dan titik koma sebelum divalidasi.
- Hanya **satu statement** yang diizinkan.
- Hanya `SELECT`/`WITH ... SELECT` dan `INSERT`/`UPDATE`/`DELETE`.
- Perintah DDL dan admin (`DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `GRANT`, `SET`, `COPY`, transaksi manual, dsb.) ditolak.
- `UPDATE` dan `DELETE` wajib memiliki klausa `WHERE` pada level teratas.
- `SELECT ... INTO` ditolak karena membuat tabel baru secara tersembunyi.
- Query SELECT dijalankan dalam transaksi **READ ONLY** dengan `statement_timeout = 60s`.
- DML dijalankan dalam transaksi yang di-commit hanya jika sukses, juga dengan timeout 60s.
- Nama tabel/kolom yang dipakai LLM dibatasi pada skema workspace dan tabel yang dipilih pengguna.

### 4. Human-in-the-loop untuk perubahan data

- Permintaan `INSERT`/`UPDATE`/`DELETE` mengembalikan `status: "require_confirmation"` dan **belum dieksekusi**.
- Frontend menampilkan SQL mentah, peringatan, dan tombol **Izinkan Eksekusi** / **Batalkan**.
- `/api/execute_confirmed` memvalidasi ulang seluruh aturan dari awal; client tidak dipercaya.
- `SELECT` ditolak di endpoint konfirmasi; `UPDATE`/`DELETE` tanpa `WHERE` selalu ditolak.
- File `.sql` yang berisi perintah destruktif mengembalikan `409` dan daftar peringatan sebelum dijalankan.

### 5. Visualisasi dan UX

- Tabel hasil query dengan format angka, mata uang, persentase, dan tanggal.
- Grafik otomatis:
  - **garis** untuk data waktu/tren;
  - **batang** untuk kategori;
  - hingga 12 kategori; bila kategorinya lebih banyak, ditampilkan 10 teratas + “Lainnya” (11 batang);
  - maksimal 60 titik untuk garis (data terbaru dipertahankan).
- SQL hasil dapat disalin dari panel jawaban.
- **Dasbor riwayat** menyimpan pertanyaan, SQL, jenis, cakupan tabel, dan jumlah baris di `localStorage` browser.
  - Kunci penyimpanan memuat user ID, sehingga akun berbeda di browser yang sama tidak saling melihat riwayat.
  - Maksimal 80 entri terbaru per akun; SQL dipotong pada 4.000 karakter.
  - Isi hasil query **tidak** disimpan.
- Badge kuota di header menampilkan sisa/batas pertanyaan hari ini.
- Tampilan responsif untuk mobile dan desktop.
- Font di-host sendiri (`frontend/public/fonts`) agar tidak bergantung pada Google Fonts.

### 6. Login dan pemulihan akun

- **Tautan email / OTP** — tautan masuk atau kode 6 digit dari Supabase.
- **Email + kata sandi** — pendaftaran, masuk, dan lupa kata sandi.
- **Google OAuth** — login dengan akun Google asli.
- Layar **Atur kata sandi baru** muncul otomatis saat pengguna datang dari tautan reset.
- Sesi diverifikasi ke Supabase Auth; hasil verifikasi token di-cache 5 menit untuk mengurangi panggilan HTTP.

---

## Arsitektur

```mermaid
flowchart LR
    U[Browser] -->|HTTPS| F[Frontend Vercel<br/>React + Vite]
    F -->|Login / refresh sesi| A[Supabase Auth]
    F -->|Bearer token + request API| B[Backend Vercel<br/>FastAPI]
    B -->|Verifikasi token| A
    B -->|SQLAlchemy + psycopg2| D[(Supabase PostgreSQL)]
    B -->|Prompt + skema live| G[Groq]
    B -.->|Fallback bila Groq gagal| M[Google Gemini]

    D --> P[public.workspaces<br/>public.usage_daily]
    D --> W[ws_24hex<br/>tabel milik akun]
```

Alur satu pertanyaan:

```text
Pertanyaan pengguna
  → verifikasi Bearer token
  → cek kuota harian akun
  → baca skema workspace real-time
  → prompt ke Groq (fallback Gemini)
  → bersihkan output LLM
  → validasi SQL + batas schema/tabel
  → SELECT: eksekusi read-only
  → DML: kembalikan usulan, tunggu konfirmasi
```

---

## Tech stack

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Backend | FastAPI + Uvicorn | API, validasi request, dependency auth |
| Validasi | Pydantic v2 | Skema request/response dan batas panjang |
| Database | PostgreSQL 13+ | Supabase Free untuk produksi |
| Akses DB | SQLAlchemy 2.x + `psycopg2-binary` | URL dinormalisasi ke `postgresql+psycopg2://` |
| Upload | pandas + openpyxl + xlrd | CSV, XLSX, XLS |
| LLM utama | Groq API (`openai/gpt-oss-120b`) | Dipanggil lewat HTTP `requests` |
| LLM cadangan | Google Gemini (`google-generativeai`) | Fallback otomatis |
| Auth | Supabase Auth | Google, email magic link/OTP, email + kata sandi |
| Frontend | React 18 + Vite 5 | SPA, code splitting dengan `lazy` |
| Styling | Tailwind CSS 3 | Desain “text → SQL desk” |
| Grafik | Recharts | Bar chart dan line chart |
| Ikon | lucide-react | Ikon antarmuka |
| Hosting | Vercel Hobby | Frontend dan backend sebagai dua project |
| Metadata situs | `robots.txt`, `sitemap.xml`, `llms.txt`, `ai-catalog.json` | Ada di `frontend/public` |

---

## Model data dan isolasi akun

Ada dua lapisan data yang perlu dibedakan.

### 1. Schema `public` — metadata aplikasi

Hanya berisi tabel infrastruktur, bukan tabel bisnis pengguna:

```sql
-- public.workspaces
id           uuid primary key default gen_random_uuid()
owner_id     uuid not null unique          -- ID akun Supabase
schema_name  text not null unique          -- mis. ws_9e480435c6e44fedb60de459
created_at   timestamptz not null default now()

-- public.usage_daily
user_id         uuid not null
day             date not null
question_count  integer not null default 0
updated_at      timestamptz not null default now()
primary key (user_id, day)
```

- RLS diaktifkan pada kedua tabel.
- Role `anon` dan `authenticated` tidak diberi akses ke tabel metadata ini.
- Backend terhubung sebagai pemilik tabel dan tetap bisa membaca/menulis.
- File migrasi tersedia di [`supabase/migrations/0001_workspaces.sql`](supabase/migrations/0001_workspaces.sql) dan [`0002_usage_daily.sql`](supabase/migrations/0002_usage_daily.sql). Backend juga menjalankan DDL yang sama secara otomatis saat pertama kali dibutuhkan.

### 2. Schema `ws_<24 hex>` — ruang data akun

- Nama schema deterministik dari UUID akun: `ws_` + 24 karakter hex pertama.
- Berisi tabel hasil upload CSV/Excel dan tabel yang dibuat oleh file `.sql`.
- Tidak ada tabel bisnis tetap di dalam workspace. Akun baru benar-benar kosong.
- `search_path` transaksi diarahkan ke schema akun + `pg_catalog`.
- Query yang menyebut schema lain akan ditolak, walaupun schema itu ada.

### 3. `schema.sql` dan `seed.py` — data demo lama

`schema.sql` dan `seed.py` membuat tabel contoh `customers`, `products`, dan `sales` di schema **`public`**. Data ini hanya terlihat dalam mode kunci akses lokal (`API_ACCESS_KEY` / `ALLOW_ANONYMOUS_LEGACY`), **bukan** di akun yang login.

Untuk multi-user, tidak perlu menjalankan `seed.py`. Cukup login; backend membuat workspace kosong untuk akun tersebut.

### 4. Alur pembuatan workspace

```text
Request dengan Bearer token
  → verifikasi token ke Supabase Auth
  → ambil user.id
  → schema_name_for(user.id) = ws_<24 hex>
  → SELECT pg_advisory_xact_lock(hashtext(owner_id))
  → buat schema jika belum ada
  → catat ke public.workspaces
  → SET LOCAL search_path TO ws_..., pg_catalog
```

`drop_workspace()` tersedia di `workspaces.py` untuk menghapus schema dan metadata akun, tetapi **belum diekspos sebagai endpoint publik**. Penghapusan akun saat ini harus dilakukan manual oleh pemilik aplikasi.

---

## Struktur proyek

```text
.
├── main.py                  # FastAPI app, endpoint, validasi SQL, upload, rate limit
├── auth.py                  # Verifikasi token Supabase + diagnostik login
├── database.py              # Engine SQLAlchemy, session, normalisasi DATABASE_URL
├── llm.py                   # Penyedia Groq dan urutan fallback
├── quota.py                 # Kuota harian per akun (public.usage_daily)
├── workspaces.py            # Provisioning schema ws_<24 hex>, drop_workspace
├── schema.sql               # Tabel demo lama (customers/products/sales)
├── seed.py                  # Seed data demo ke schema public
├── requirements.txt
├── .env.example
├── vercel.json              # Konfigurasi backend Vercel (maxDuration, region)
├── render.yaml              # Warisan deploy Render (legacy)
├── DEPLOY_VERCEL.md         # Panduan deploy utama: Vercel + Supabase
├── DEPLOY.md                # Panduan lama: Render + Neon (legacy)
├── IDEAS.md                 # Ide fitur pasca-peluncuran
├── supabase/
│   └── migrations/
│       ├── 0001_workspaces.sql
│       └── 0002_usage_daily.sql
└── frontend/
    ├── index.html           # Meta, preload font, favicon
    ├── vercel.json          # Rewrites, cache aset/font, header keamanan
    ├── vite.config.js       # Code splitting: charts/supabase/vendor
    ├── tailwind.config.js
    ├── public/
    │   ├── fonts/           # Font self-hosted (Manrope, Instrument Serif, IBM Plex Mono)
    │   ├── robots.txt
    │   ├── sitemap.xml
    │   ├── llms.txt
    │   ├── favicon.svg
    │   └── .well-known/ai-catalog.json
    └── src/
        ├── main.jsx
        ├── App.jsx          # Layout, state chat, upload, kuota, riwayat
        ├── api.js           # URL backend, Bearer token, batas file
        ├── supabase.js      # Klien Supabase + deteksi recovery link
        ├── index.css        # Tailwind + @font-face
        ├── components/
        │   ├── AccessKeyModal.jsx    # Hanya mode lokal tanpa Supabase
        │   ├── AssistantMessage.jsx  # Hasil SELECT + panel konfirmasi DML
        │   ├── DataTable.jsx         # Tabel hasil query
        │   ├── DatasetSelector.jsx   # Pemilih tabel dan muat ulang skema
        │   ├── HistoryDashboard.jsx  # Panel riwayat pertanyaan
        │   ├── LoginScreen.jsx       # Tautan email, kata sandi, Google
        │   ├── ResultChart.jsx       # Grafik batang/garis otomatis
        │   ├── SetPasswordScreen.jsx # Layar atur kata sandi baru
        │   ├── ToastStack.jsx        # Notifikasi sukses/gagal/info
        │   └── UploadDataset.jsx     # Modal upload + konfirmasi .sql destruktif
        └── utils/
            ├── chartConfig.js  # Logika pemilihan sumbu dan data grafik
            ├── columns.js      # Deteksi tipe kolom (uang, ID, waktu)
            ├── errors.js       # Ekstraksi pesan error FastAPI/Axios
            └── format.js       # Format angka, label kolom, tanggal
```

---

## Prasyarat

- **Python 3.11+** (produksi Vercel memakai Python 3.12 sesuai `.python-version`)
- **Node.js 18+** dan npm
- **PostgreSQL 13+** (lokal, Docker, atau Supabase)
- **Groq API key** dari [Groq Console](https://console.groq.com/keys) — gratis, tanpa kartu kredit
- **Google Gemini API key** (opsional, untuk cadangan)
- **Project Supabase** dengan Auth aktif (wajib untuk mode multi-user)
- Git

---

## Instalasi

### 1. Clone repositori

```bash
git clone https://github.com/hayyanjpg/SQL_Analysis.git
cd SQL_Analysis
```

### 2. Siapkan backend

**PowerShell (Windows):**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**Bash (Linux/macOS):**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Buat file `.env`

```powershell
# PowerShell
Copy-Item .env.example .env
```

```bash
# Bash
cp .env.example .env
```

Isi nilai sebenarnya di `.env` (lihat [Konfigurasi environment](#konfigurasi-environment)). File `.env` sudah dikecualikan oleh `.gitignore` dan **tidak boleh** di-commit.

### 4. Inisialisasi database

**Opsi A — Supabase / multi-user (disarankan):**

1. Buat project Supabase.
2. Jalankan migrasi `supabase/migrations/0001_workspaces.sql` dan `0002_usage_daily.sql` di Supabase SQL Editor, **atau** biarkan backend membuatnya otomatis pada permintaan pertama.
3. Login lewat aplikasi. Workspace `ws_...` dibuat otomatis untuk akun tersebut.
4. Tidak perlu `seed.py`; akun baru memang harus mulai kosong.

**Opsi B — lokal dengan data demo di schema `public`:**

```bash
python seed.py
```

Perintah ini membuat tabel `customers`, `products`, dan `sales` di schema `public` serta mengisi data contoh. Jika tabel sudah ada, seed dibatalkan agar data lama tidak tertimpa. Untuk menghapus dan mengisi ulang:

```bash
python seed.py --reset
```

> `--reset` menghapus tabel `sales`, `products`, dan `customers` di schema `public` beserta seluruh datanya.
>
> Data demo ini **tidak terlihat** oleh akun yang login. Untuk melihatnya, jalankan aplikasi dalam mode kunci akses lokal tanpa Supabase.

### 5. Siapkan frontend

```bash
cd frontend
npm install
```

Buat konfigurasi lokal:

```powershell
Copy-Item .env.example .env.local
```

Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` agar login multi-user aktif. Tanpa dua nilai itu, aplikasi berjalan dalam mode kunci akses bersama (hanya untuk pengembangan lokal).

---

## Konfigurasi environment

### Backend — `.env` di root proyek

| Variabel | Wajib | Contoh | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | Ya | `postgresql://user:pass@host:5432/dbname?sslmode=require` | DSN PostgreSQL. Untuk Supabase gunakan transaction pooler port `6543`. |
| `GROQ_API_KEY` | Ya* | `gsk_...` | API key Groq milik pemilik aplikasi. Dipakai semua pengguna lewat backend. Jangan pernah di-commit. |
| `GROQ_MODEL` | Tidak | `openai/gpt-oss-120b` | Default di kode: `openai/gpt-oss-120b`. |
| `GROQ_BASE_URL` | Tidak | `https://api.groq.com/openai/v1` | Opsional untuk endpoint kompatibel Groq. |
| `GROQ_TIMEOUT_SECONDS` | Tidak | `60` | Timeout panggilan Groq. |
| `GEMINI_API_KEY` | Ya* | `your-google-ai-studio-key` | API key Gemini sebagai cadangan bila Groq gagal/kena kuota. |
| `GEMINI_MODEL` | Tidak | `gemini-3.5-flash` | Default di kode: `gemini-3.5-flash`. |
| `LLM_PROVIDER` | Tidak | `auto` | `auto` = Groq lalu Gemini; `groq` = hanya Groq; `gemini` = hanya Gemini. |
| `DAILY_QUESTION_LIMIT` | Tidak | `15` | Kuota pertanyaan per akun per hari (UTC). `0` = tanpa batas. |
| `SUPABASE_URL` | Untuk login | `https://project.supabase.co` | Alamat project Supabase. Tanpa `/auth/v1`. |
| `SUPABASE_ANON_KEY` | Untuk login | `sb_publishable_...` | Publishable/anon key, bukan service role key. Alias `SUPABASE_PUBLISHABLE_KEY` juga diterima backend. |
| `CORS_ORIGINS` | Tidak | `https://sql-analysis.vercel.app` | Daftar origin dipisahkan koma, tanpa slash di akhir. |
| `API_ACCESS_KEY` | Hanya lokal | `kunci-acak-panjang` | Mode lama untuk schema `public` lewat header `X-API-Key`. **Jangan diisi di produksi.** |
| `ALLOW_ANONYMOUS_LEGACY` | Hanya lokal | `1` | Izinkan schema `public` tanpa kunci/login saat `API_ACCESS_KEY` kosong. Jangan dipakai di produksi. |
| `MAX_UPLOAD_MB` | Tidak | `10` | Batas CSV/Excel dalam MB. Di Vercel gunakan `4`. |
| `MAX_SQL_MB` | Tidak | `5` | Batas file `.sql` dalam MB. Di Vercel gunakan `4`. |
| `RATE_LIMIT_ASK_PER_MINUTE` | Tidak | `20` | Maksimal request `/api/ask` per IP per menit. |
| `RATE_LIMIT_TABLES_PER_MINUTE` | Tidak | `120` | Maksimal request `/api/tables` per IP per menit. |
| `RATE_LIMIT_AUTH_PER_MINUTE` | Tidak | `60` | Maksimal request `/api/auth/me` per IP per menit. |
| `RATE_LIMIT_UPLOAD_PER_10_MINUTES` | Tidak | `10` | Maksimal upload per IP per 10 menit. |
| `RATE_LIMIT_EXECUTE_PER_MINUTE` | Tidak | `10` | Maksimal eksekusi DML per IP per menit. |

\* Isi minimal salah satu penyedia; **Groq disarankan** karena kuota gratisnya lebih besar. Bila keduanya kosong, `/api/ask` mengembalikan `503`.

Contoh `.env` lokal:

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/sql_analysis?sslmode=require"
GROQ_API_KEY="gsk_xxx"
GROQ_MODEL="openai/gpt-oss-120b"
GEMINI_API_KEY="your-google-ai-studio-key"
GEMINI_MODEL="gemini-3.5-flash"
LLM_PROVIDER="auto"
DAILY_QUESTION_LIMIT="15"
SUPABASE_URL="https://PROJECT-ANDA.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_xxx"
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
MAX_UPLOAD_MB="10"
MAX_SQL_MB="5"
```

### Frontend — `frontend/.env.local`

| Variabel | Default | Keterangan |
|---|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` (lokal) / backend Vercel (publik) | Base URL backend tanpa `/api/...`. |
| `VITE_API_URL` | — | Kompatibilitas lama; boleh berisi URL lengkap `/api/ask`. |
| `VITE_SUPABASE_URL` | — | Alamat project Supabase. Wajib untuk login multi-user. |
| `VITE_SUPABASE_ANON_KEY` | — | Publishable/anon key Supabase. Wajib untuk login multi-user. |
| `VITE_MAX_UPLOAD_MB` | `4` | Batas CSV/Excel di frontend. Samakan dengan backend. |
| `VITE_MAX_SQL_MB` | `4` | Batas `.sql` di frontend. Samakan dengan backend. |

`frontend/src/api.js` memilih backend otomatis: `localhost`/`127.0.0.1` memakai `http://127.0.0.1:8000`, domain publik memakai backend Vercel. Env tetap disarankan agar URL mudah diganti.

> **Keamanan:** jangan menaruh API key LLM, password database, atau service role key di variabel `VITE_*`. Semua variabel Vite ikut ter-bundle ke browser dan dapat dibaca pengguna. `VITE_SUPABASE_ANON_KEY` memang publik; isolasi data ditegakkan backend.

---

## Menjalankan aplikasi

### Backend

Dari root proyek, dengan virtual environment aktif:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- API: <http://127.0.0.1:8000>
- Swagger UI: <http://127.0.0.1:8000/docs>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>
- Health check: <http://127.0.0.1:8000/api/health>

### Frontend

Di terminal terpisah:

```bash
cd frontend
npm run dev
```

Buka <http://localhost:5173>.

> Di PowerShell, jika `npm` diblokir kebijakan eksekusi, gunakan `npm.cmd run dev` dan `npm.cmd run build`.

### Build produksi

```bash
cd frontend
npm run build
npm run preview
```

Hasil build ada di `frontend/dist/`. Build memisahkan chunk `charts`, `supabase`, dan `vendor`; komponen besar seperti dasbor, dialog unggah, dan pesan asisten dimuat saat dibutuhkan.

---

## Deploy publik

Panduan lengkap ada di **[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)**. Ringkasnya:

| Komponen | Layanan | Konfigurasi |
|---|---|---|
| Frontend | Vercel Hobby | Root Directory `frontend`, env `VITE_*`, output `dist` |
| Backend | Vercel Functions (Python) | Project Vercel kedua, Root Directory repo root, `vercel.json` |
| Database | Supabase Free (PostgreSQL) | `DATABASE_URL` memakai transaction pooler port `6543` |
| Auth | Supabase Auth | Google + email; Site URL dan Redirect URLs wajib benar |
| LLM | Groq + Gemini Free Tier | `GROQ_API_KEY` utama, `GEMINI_API_KEY` cadangan |

### Environment backend produksi

```text
DATABASE_URL=postgresql://postgres.<project>:<password>@<host>:6543/postgres?sslmode=require
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
GROQ_API_KEY=<API key Groq>
GROQ_MODEL=openai/gpt-oss-120b
GEMINI_API_KEY=<API key Gemini>
GEMINI_MODEL=gemini-3.5-flash
LLM_PROVIDER=auto
DAILY_QUESTION_LIMIT=15
CORS_ORIGINS=https://sql-analysis.vercel.app
MAX_UPLOAD_MB=4
MAX_SQL_MB=4
```

**Jangan isi `API_ACCESS_KEY` di produksi.** Situs publik hanya memakai login akun. Kunci akses bersama adalah jalur lama untuk lokal dan akan membuka schema `public` bagi siapa pun yang tahu nilainya.

### Environment frontend produksi

```text
VITE_API_BASE_URL=https://sql-analysis-el64.vercel.app
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_MAX_UPLOAD_MB=4
VITE_MAX_SQL_MB=4
```

Environment Vite dibaca saat **build**, jadi setelah mengubah env frontend lakukan deployment baru. Perubahan env backend juga memerlukan deployment baru; tombol Redeploy kadang memakai snapshot env lama, jadi picu commit baru bila perlu.

### Health check

```bash
curl https://sql-analysis-el64.vercel.app/api/health
```

Contoh respons:

```json
{
  "status": "ok",
  "version": "2.0.0",
  "auth_required": true,
  "legacy_access_key_enabled": false,
  "anonymous_legacy_enabled": false,
  "database_configured": true,
  "supabase_configured": true,
  "groq_configured": true,
  "gemini_configured": true,
  "llm_providers": ["groq", "gemini"],
  "daily_question_limit": 15,
  "max_upload_mb": 4,
  "max_sql_mb": 4
}
```

Jika `legacy_access_key_enabled` bernilai `true`, `API_ACCESS_KEY` masih aktif dan harus dihapus dari environment produksi.

### Supabase Auth

- **Site URL:** `https://sql-analysis.vercel.app`
- **Redirect URLs:** `https://sql-analysis.vercel.app/**`, `http://localhost:5173/**`
- **Google provider:** aktifkan di Supabase, isi Client ID/Secret dari Google Cloud Console.
- **Authorized redirect URI Google:** `https://<project>.supabase.co/auth/v1/callback`
- **Email:** layanan email bawaan Supabase punya batas kirim per jam. Untuk produksi, pasang SMTP sendiri (Resend, Brevo, atau Gmail SMTP untuk uji).
- **Konfirmasi email:** biarkan aktif untuk produksi. Untuk pengujian cepat, bisa dimatikan sementara di Supabase.

### Catatan serverless

- Badan request Vercel Functions dibatasi **4.5 MB**; karena itu upload dibatasi 4 MB.
- Durasi fungsi maksimal **300 detik** di Hobby (diatur `maxDuration` di `vercel.json`).
- Region backend: `sin1` (Singapura).
- Rate limit disimpan di memori proses. Di serverless, penghitung bisa reset saat instance baru dibuat dan tidak dibagi antar-instance. Ini bukan pengganti WAF.
- `DEPLOY.md` dan `render.yaml` adalah panduan lama untuk Render + Neon. Jangan dipakai untuk deployment saat ini.

---

## Dokumentasi API

Base URL lokal: `http://127.0.0.1:8000`
Base URL produksi: `https://sql-analysis-el64.vercel.app`

### Autentikasi

Semua endpoint data memerlukan salah satu dari:

1. **Bearer token Supabase** (cara produksi):
   ```http
   Authorization: Bearer <access_token>
   ```
2. **Header `X-API-Key`** (hanya mode lokal dengan `API_ACCESS_KEY`):
   ```http
   X-API-Key: <kunci>
   ```

Jika keduanya tidak ada, backend merespons `401`. Token Bearer yang tidak valid **tidak** jatuh ke kunci bersama; sesi kedaluwarsa tidak akan diam-diam memakai schema `public`.

### Ringkasan endpoint

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| `GET` | `/api/health` | Tidak | Health check ringan, tanpa akses database |
| `GET` | `/api/auth/check` | `X-API-Key` | Verifikasi kunci akses mode lokal |
| `GET` | `/api/auth/me` | Bearer | Identitas akun dan nama workspace |
| `GET` | `/api/auth/diagnose` | `X-API-Key` | Diagnostik konfigurasi Supabase (tanpa membocorkan kunci) |
| `GET` | `/api/quota` | Bearer | Sisa kuota pertanyaan harian akun |
| `GET` | `/api/tables` | Bearer / `X-API-Key` | Daftar tabel, kolom, dan jumlah baris |
| `POST` | `/api/ask` | Bearer / `X-API-Key` | Terjemahkan pertanyaan menjadi SQL; jalankan SELECT atau kembalikan usulan DML |
| `POST` | `/api/execute_confirmed` | Bearer / `X-API-Key` | Eksekusi DML yang sudah disetujui pengguna |
| `POST` | `/api/upload` | Bearer / `X-API-Key` | Upload CSV/Excel menjadi tabel, atau jalankan file `.sql` |
| `GET` | `/docs` | Tidak | Swagger UI |
| `GET` | `/openapi.json` | Tidak | Spesifikasi OpenAPI |

> `/api/auth/check` dan `/api/auth/diagnose` memakai dependency `require_api_key`. Di produksi login-only, keduanya akan menolak request tanpa `X-API-Key`; gunakan `/api/health` untuk memeriksa konfigurasi umum.

### 1. `GET /api/auth/me`

**Request**

```bash
curl "http://127.0.0.1:8000/api/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

**Response `200`**

```json
{
  "user": {
    "id": "9e480435-c6e4-4fed-b60d-e45900000000",
    "email": "pengguna@example.com"
  },
  "workspace": "ws_9e480435c6e44fedb60de459"
}
```

Workspace dibuat otomatis pada panggilan pertama. Nama schema tidak pernah diambil dari input client.

### 2. `GET /api/quota`

**Response `200`**

```json
{
  "limit": 15,
  "used": 3,
  "remaining": 12,
  "unlimited": false,
  "day": "2026-11-16"
}
```

Kuota dihitung per akun dan direset setiap tengah malam UTC. Mode kunci akses lama (pemilik) tidak dibatasi kuota.

### 3. `GET /api/tables`

**Response `200`**

```json
[
  {
    "table": "penjualan_2026",
    "columns": [
      { "name": "nama_pelanggan", "type": "TEXT", "nullable": true, "primary_key": false },
      { "name": "total_harga", "type": "BIGINT", "nullable": true, "primary_key": false },
      { "name": "tanggal", "type": "TIMESTAMP", "nullable": true, "primary_key": false }
    ],
    "row_count": 120
  }
]
```

Hanya metadata yang dikirim; isi tabel tidak dikembalikan.

### 4. `POST /api/ask` — SELECT

**Request**

```bash
curl -X POST "http://127.0.0.1:8000/api/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"Berapa total penjualan per kategori?","tables":["penjualan_2026"]}'
```

`question` maksimal 2.000 karakter. `tables` opsional, maksimal 40 nama; kosong berarti semua tabel di workspace.

**Response `200`**

```json
{
  "question": "Berapa total penjualan per kategori?",
  "sql": "SELECT kategori, SUM(total_harga) AS total_penjualan FROM penjualan_2026 GROUP BY kategori ORDER BY total_penjualan DESC LIMIT 200",
  "columns": ["kategori", "total_penjualan"],
  "rows": [
    { "kategori": "Elektronik", "total_penjualan": 19947000 }
  ],
  "row_count": 1
}
```

Header respons yang berguna:

- `X-LLM-Provider: groq` atau `gemini`
- `X-Quota-Limit`, `X-Quota-Used`, `X-Quota-Remaining`, `X-Quota-Day`

Contoh di atas ilustratif; SQL dan nilai aktual bergantung pada skema workspace dan isi database.

### 5. `POST /api/ask` — DML (butuh konfirmasi)

**Request**

```bash
curl -X POST "http://127.0.0.1:8000/api/ask" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"Naikkan harga semua produk kategori Elektronik sebesar 10%"}'
```

**Response `200`** — query belum dieksekusi:

```json
{
  "status": "require_confirmation",
  "query": "UPDATE produk SET harga = harga * 1.10 WHERE kategori = 'Elektronik'",
  "message": "AI membutuhkan izin untuk memodifikasi data."
}
```

### 6. `POST /api/execute_confirmed`

**Request**

```bash
curl -X POST "http://127.0.0.1:8000/api/execute_confirmed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"UPDATE produk SET harga = harga * 1.10 WHERE kategori = '\''Elektronik'\''"}'
```

**Response `200`**

```json
{
  "status": "success",
  "message": "Perubahan data berhasil disimpan (4 baris terpengaruh).",
  "command": "UPDATE",
  "rowcount": 4,
  "columns": null,
  "rows": null
}
```

Jika query memakai `RETURNING`, `columns` dan `rows` berisi data yang dikembalikan.

**Aturan endpoint ini:**

- Hanya menerima `INSERT`, `UPDATE`, atau `DELETE`. `SELECT` ditolak (`400`).
- Query divalidasi ulang; `UPDATE`/`DELETE` tanpa `WHERE` ditolak.
- Dijalankan dalam transaksi yang di-commit hanya jika sukses.
- Panjang query maksimal 20.000 karakter.

### 7. `POST /api/upload` — CSV/Excel

**Request**

```bash
curl -X POST "http://127.0.0.1:8000/api/upload?if_exists=fail" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@penjualan_2026.csv"
```

**Response `200`**

```json
{
  "status": "success",
  "kind": "table",
  "message": "Tabel 'penjualan_2026' berhasil dibuat dari 'penjualan_2026.csv' (120 baris, 4 kolom).",
  "table_name": "penjualan_2026",
  "if_exists": "fail",
  "row_count": 120,
  "column_count": 4,
  "columns": {
    "nama_pelanggan": "TEXT",
    "total_harga": "BIGINT",
    "kota": "TEXT",
    "tanggal": "TIMESTAMP"
  },
  "statement_count": null
}
```

Contoh nama kolom `"Nama Pelanggan"` menjadi `nama_pelanggan`.

### 8. `POST /api/upload` — skrip SQL

```bash
curl -X POST "http://127.0.0.1:8000/api/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@migrasi.sql"
```

Jika file berisi perintah yang dapat menghapus atau menimpa data, endpoint mengembalikan `409` dan **belum mengeksekusi apa pun**:

```json
{
  "detail": {
    "code": "destructive_sql_requires_confirmation",
    "message": "File .sql berisi perintah yang dapat menghapus atau menimpa data. Periksa daftar berikut, lalu konfirmasi bila memang disengaja.",
    "total": 2,
    "warnings": [
      {
        "kind": "drop_table",
        "target": "penjualan",
        "message": "Tabel 'penjualan' akan dihapus beserta seluruh datanya."
      },
      {
        "kind": "truncate",
        "target": "stok",
        "message": "Seluruh baris pada tabel 'stok' akan dihapus."
      }
    ]
  }
}
```

Kirim ulang dengan `confirm_destructive=true` setelah pengguna menyetujui:

```bash
curl -X POST "http://127.0.0.1:8000/api/upload?confirm_destructive=true" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@migrasi.sql"
```

**Response `200`**

```json
{
  "status": "success",
  "kind": "sql_script",
  "message": "Skrip SQL berhasil dieksekusi (3 statement). Perubahan sudah di-commit.",
  "statement_count": 3,
  "table_name": null,
  "if_exists": null,
  "row_count": null,
  "column_count": null,
  "columns": null
}
```

### Ringkasan status HTTP

| Status | Arti |
|---|---|
| `200` | Berhasil |
| `400` | SQL tidak valid, file tidak terbaca, atau aturan keamanan dilanggar |
| `401` | Belum login, token tidak valid/kedaluwarsa, atau kunci akses salah/tidak aktif |
| `403` | Query mencoba mengakses schema di luar workspace akun |
| `409` | Nama tabel sudah ada dan `if_exists=fail`, atau file `.sql` destruktif belum dikonfirmasi |
| `413` | File/baris/kolom/statement melebihi batas |
| `415` | Ekstensi file tidak didukung |
| `422` | Body request gagal validasi Pydantic |
| `429` | Kuota harian akun habis, rate limit per IP, atau penyedia LLM sedang dibatasi |
| `502` | Penyedia AI gagal menghasilkan SQL |
| `503` | Database/login tidak dapat dihubungi, skema gagal dibaca, atau tidak ada penyedia AI aktif |
| `504` | Penyedia AI terlalu lama menjawab |

Sebagian besar error mengembalikan bentuk standar FastAPI:

```json
{
  "detail": "Pesan error yang dapat dibaca pengguna."
}
```

Error `.sql` destruktif memakai `detail` berbentuk objek agar frontend bisa menampilkan daftar peringatan.

---

## Aturan keamanan

### Sanitasi output LLM

`normalize_sql()` menghapus:

- blok markdown ` ```sql ... ``` ` dan backtick;
- prefiks `sql:`;
- spasi berlebih dan titik koma di akhir.

Setelah itu query melewati validator berbasis *state machine* (`sql_skeleton`) yang memahami komentar, string literal, quoted identifier, dan dollar-quoted block — sehingga kata terlarang tidak bisa disembunyikan di dalam komentar atau string.

### Validasi query

| Aturan | Implementasi |
|---|---|
| Satu statement | Titik koma di luar string ditolak |
| Perintah diizinkan | `SELECT`, `WITH ... SELECT`, `INSERT`, `UPDATE`, `DELETE` |
| DDL/admin | Ditolak di posisi mana pun pada level teratas |
| `UPDATE`/`DELETE` | Wajib `WHERE` top-level; operasi massal harus `WHERE TRUE` |
| `SELECT ... INTO` | Ditolak |
| Fungsi server berbahaya | `pg_read_file`, `pg_write_file`, `lo_import`, `set_config`, `pg_terminate_backend`, dsb. ditolak |
| Eksekusi SELECT | Transaksi `READ ONLY` + `statement_timeout = 60s` |
| Eksekusi DML | Transaksi commit, timeout 60s |
| Konfirmasi ulang | `/api/execute_confirmed` memvalidasi ulang seluruh aturan |
| Batas schema | Query dengan qualifier schema lain ditolak `403` |
| Batas tabel | Hanya tabel yang dipilih/diizinkan yang boleh dirujuk |

### Validasi file `.sql`

Sebelum dieksekusi, skrip diperiksa pada kerangka SQL **dan** isi string literal (untuk menangkap *dynamic SQL*). Pola yang diblokir antara lain:

- `CREATE`/`ALTER`/`DROP DATABASE`;
- `DROP SCHEMA`;
- operasi `TABLESPACE`;
- `CREATE`/`ALTER`/`DROP ROLE`/`USER`/`GROUP`;
- `ALTER`/`DROP OWNED`, `REASSIGN OWNED`;
- `ALTER SYSTEM`;
- `GRANT`/`REVOKE`;
- `SET ROLE`, `SET SESSION AUTHORIZATION`;
- fungsi server berbahaya (`pg_read_file`, `pg_write_file`, `lo_import`, `pg_terminate_backend`, dsb.);
- `COPY ... FROM PROGRAM`;
- kontrol transaksi manual (`BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, dsb.);
- `DO`, `EXECUTE`, `PREPARE`, `DEALLOCATE`, `COPY`, `SET`, dan perintah sejenis sebagai perintah awal.

Skrip dijalankan atomik dengan `statement_timeout = 120s` dan maksimal **2.000 statement**.

#### Perintah destruktif pada tabel pengguna

Blocklist di atas melindungi server, bukan data di dalam workspace akun. Karena itu, skrip yang dapat menghapus atau menimpa data **tidak langsung dijalankan**. Backend mendeteksi:

- `DROP TABLE` (termasuk `DROP TABLE IF EXISTS ... CASCADE`, lazim pada dump);
- `TRUNCATE`;
- `ALTER TABLE ... DROP COLUMN`;
- `DELETE` tanpa `WHERE`;
- `UPDATE` tanpa `WHERE`.

Bila terdeteksi, backend merespons `409` berisi daftar tabel/kolom yang terkena dan tidak mengeksekusi apa pun. Frontend menampilkan daftar tersebut, lalu pengguna harus mencentang persetujuan sebelum file dikirim ulang dengan `confirm_destructive=true`. String literal dan komentar diabaikan saat pendeteksian agar tidak memicu peringatan palsu.

### Isolasi workspace

- Token Bearer diverifikasi ke Supabase Auth; identitas pengguna tidak diambil dari input client.
- Nama schema dihitung deterministik dari UUID akun.
- `search_path` diarahkan ke schema akun + `pg_catalog` pada setiap transaksi.
- Query yang menulis `public.tabel` atau `ws_akunlain.tabel` ditolak.
- Metadata workspace dan kuota tidak dapat diakses role `anon`/`authenticated`.
- Isolasi ini ditegakkan oleh backend. Role database belum dipisah per akun; lihat [Batasan dan risiko](#batasan-dan-risiko).

### Manajemen rahasia

- Tidak ada kredensial yang di-hardcode di kode.
- `DATABASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, dan kunci Supabase dibaca dari environment.
- `.env`, `.venv`, `node_modules`, `dist`, dan artefak build sudah masuk `.gitignore`.
- Frontend hanya boleh memakai variabel `VITE_*` yang tidak bersifat rahasia.
- Kunci akses mode lokal disimpan di `localStorage` browser, bukan di bundle frontend.
- `API_ACCESS_KEY` tidak boleh diisi di produksi.

### Autentikasi dan rate limiting

- Login produksi memakai Supabase Auth: Google, tautan email/OTP, atau email + kata sandi.
- Backend memverifikasi token ke Supabase dan menyimpan cache singkat 5 menit.
- Rate limit per IP:
  - `/api/ask`: 20/menit;
  - `/api/tables`: 120/menit;
  - `/api/auth/me`: 60/menit;
  - `/api/upload`: 10/10 menit;
  - `/api/execute_confirmed`: 10/menit.
- Penghitung disimpan di memori proses. Di Vercel, penghitung bisa reset saat instance baru dibuat dan tidak dibagi antar-instance.
- Kuota harian per akun dibatasi `DAILY_QUESTION_LIMIT` (default 15). Satu pertanyaan dihitung satu pemakaian; jika penyedia LLM gagal, pemakaian dikembalikan.

### CORS

Origin diatur lewat `CORS_ORIGINS`. Secara default hanya mengizinkan:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:3000
http://127.0.0.1:3000
```

Tambahkan origin produksi secara eksplisit, mis. `https://sql-analysis.vercel.app`; hindari `*` untuk API yang dapat menulis data.

---

## Verifikasi

### Backend

```bash
python -m compileall main.py auth.py database.py llm.py quota.py workspaces.py seed.py
```

Cek endpoint:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/openapi.json
```

Cek proteksi login (produksi):

```bash
curl -i https://sql-analysis-el64.vercel.app/api/tables
```

Harus `401` tanpa Bearer token.

### Frontend

```bash
cd frontend
npm test
npm run build
```

`npm test` menjalankan test logika grafik dengan Node test runner. Build yang
sukses menghasilkan `dist/` dan memisahkan chunk `charts`, `supabase`, dan
`vendor`.

### Checklist manual

- [ ] Login dengan Google → masuk ke workspace `ws_...`.
- [ ] Login dengan email + kata sandi → masuk ke workspace yang sama untuk akun yang sama.
- [ ] Akun baru → sidebar kosong, belum ada tabel.
- [ ] Upload CSV baru → toast sukses, tabel muncul di sidebar.
- [ ] Tanya data dari tabel hasil upload → tabel/grafik tampil.
- [ ] Minta perubahan data → panel amber muncul dengan SQL mentah, **bukan** tabel kosong.
- [ ] Klik **Batalkan** → pesan “Eksekusi dibatalkan oleh pengguna.”, data tidak berubah.
- [ ] Klik **Izinkan Eksekusi** → pesan sukses, `rowcount` benar, data berubah di database.
- [ ] Upload file yang sama dengan `if_exists=fail` → toast error `409`.
- [ ] Upload `.sql` berisi `DROP TABLE` tanpa konfirmasi → `409` + daftar peringatan.
- [ ] Kirim ulang `.sql` dengan centang persetujuan → berhasil dan tabel baru muncul di sidebar.
- [ ] Buka akun B di jendela privat → daftar tabel akun A tidak terlihat.
- [ ] Buka dasbor riwayat → entri akun ini tampil; riwayat akun lain tidak tampil.
- [ ] Buka di lebar 390 px → tidak ada overflow horizontal.
- [ ] Cek `/api/health` → `legacy_access_key_enabled: false` dan `llm_providers` berisi `groq`.

> Suite pengujian otomatis saat ini terbatas pada logika grafik (`npm test`).
> Endpoint backend belum memiliki test otomatis; checklist manual di atas tetap
> dipakai untuk verifikasi alur end-to-end.

### Kualitas frontend

Diukur dengan Lighthouse 13.5.0 pada 16 November 2026:

| Kategori | Mobile | Desktop |
|---|---|---|
| Performance | 97 | 100 |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| Agentic Browsing | 4/4 | 4/4 |

Perbaikan utama: code splitting, font self-hosted, `robots.txt`/`sitemap.xml`/`llms.txt`/`ai-catalog.json`, landmark `<main>`, kontras warna, serta cache immutable untuk aset dan font.

---

## Batasan dan risiko

Bagian ini penting dibaca sebelum mengekspos aplikasi ke publik.

1. **Mode publik hanya login.** `API_ACCESS_KEY` adalah jalur lama untuk schema `public` dan tidak boleh aktif di produksi. Jika diisi, siapa pun yang tahu nilainya dapat mengunggah file dan menyetujui DML pada schema `public`.
2. **File `.sql` dapat menjalankan operasi destruktif setelah dikonfirmasi.** Blocklist memblokir operasi tingkat server (database, role, tablespace, grant, fungsi berbahaya). `DROP TABLE`, `TRUNCATE`, `ALTER TABLE ... DROP COLUMN`, `DELETE` tanpa `WHERE`, dan `UPDATE` tanpa `WHERE` tidak diblokir, tetapi memicu respons `409` dan baru dijalankan setelah pengguna menyetujui. Persetujuan tetap berarti data hilang permanen; tidak ada undo. Gunakan backup dan batasi hak akses role database.
3. **Role database belum dipisah.** Idealnya SELECT memakai role read-only, sedangkan DML memakai role terbatas. Saat ini keduanya memakai `DATABASE_URL` yang sama, dan isolasi workspace ditegakkan oleh backend (`search_path` + validasi schema), bukan RLS per tabel.
4. **Penghapusan akun belum self-service.** `drop_workspace()` tersedia, tetapi belum diekspos sebagai endpoint. Penghapusan schema dan metadata akun harus dilakukan manual.
5. **Hanya sheet pertama Excel yang diimpor.** `sheet_name=0` bersifat tetap.
6. **Prompt skema dibatasi.** Database dengan lebih dari 40 tabel, 80 kolom per tabel, atau 24.000 karakter skema akan dipotong; LLM mungkin tidak melihat tabel/kolom yang terlewat.
7. **Tidak ada pengaman keras jumlah baris SELECT.** Prompt meminta `LIMIT` maksimal 200, tetapi eksekusi tidak memaksa batas baris. Query yang mengembalikan sangat banyak baris dapat membebani memori dan respons.
8. **Rate limit bersifat in-memory.** Penghitung reset saat instance restart dan tidak dibagi antar-instance. Belum ada audit log atau pagination.
9. **Kuota penyimpanan Supabase Free terbatas.** Tidak ada pembersihan otomatis untuk tabel lama; upload besar berulang dapat menghabiskan kuota project.
10. **Email bawaan Supabase punya batas kirim.** Untuk pendaftaran dan reset kata sandi publik, pasang SMTP sendiri.
11. **Model LLM dapat berubah/dihentikan.** Sesuaikan `GROQ_MODEL`/`GEMINI_MODEL` dengan model yang tersedia di akun Anda.
12. **Riwayat hanya di browser.** Riwayat tidak tersinkron antar-perangkat dan hilang jika data situs dibersihkan.
13. **Data uji bersifat fiktif.** Jangan gunakan data pribadi/rahasia pada instance demo publik.

---

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `401 Login diperlukan untuk mengakses data ini` | Belum login atau token tidak terkirim | Masuk ulang; pastikan frontend mengirim `Authorization: Bearer` |
| `401 Sesi login tidak valid atau sudah kedaluwarsa` | Token Supabase kedaluwarsa | Keluar lalu masuk lagi |
| `401 Kunci akses tidak aktif di server` | Produksi login-only, tetapi request tidak memakai Bearer | Login dengan akun, bukan kunci akses |
| `503 Login belum dikonfigurasi di server` | `SUPABASE_URL`/`SUPABASE_ANON_KEY` kosong | Isi keduanya di backend, redeploy |
| `503 Konfigurasi login di server tidak valid` | `SUPABASE_URL` bukan host project Supabase | Perbaiki URL, tanpa `/auth/v1` |
| `provider is not enabled` saat login Google | Provider Google belum aktif | Aktifkan di Supabase → Authentication → Providers → Google |
| `redirect_uri_mismatch` saat login Google | Redirect URI Google Cloud tidak cocok | Samakan dengan `https://<project>.supabase.co/auth/v1/callback` |
| Tautan email mengarah ke `localhost` | Site URL/Redirect URLs Supabase masih lokal | Perbaiki URL Configuration, minta tautan baru |
| Email konfirmasi/reset tidak datang | Batas kirim Supabase atau SMTP belum diatur | Cek spam; pasang SMTP sendiri untuk produksi |
| `RuntimeError: DATABASE_URL belum diset` | `.env` tidak ada atau salah lokasi | Buat `.env` di root proyek dari `.env.example` |
| `503 Belum ada penyedia AI yang aktif` | `GROQ_API_KEY` dan `GEMINI_API_KEY` kosong | Isi salah satunya di `.env` (Groq disarankan) |
| `503 Database tidak dapat dihubungi` | Host/port/password salah, SSL, atau IP belum diizinkan | Cek DSN, tambahkan `sslmode=require`, gunakan pooler Supabase |
| `429 Kuota harian akun Anda ... habis` | Batas `DAILY_QUESTION_LIMIT` tercapai | Tunggu reset UTC atau naikkan batas |
| `429 Terlalu banyak permintaan` | Rate limit per IP | Tunggu sesuai `Retry-After` |
| `502 Gagal menghasilkan query dari ...` | Key tidak valid, kuota habis, model tidak tersedia, atau timeout | Cek key/kuota dan `GROQ_MODEL`/`GEMINI_MODEL` |
| `403 ... hanya boleh mengakses ruang data milik akun ini` | Query menyebut schema lain | Hapus qualifier schema; gunakan nama tabel saja |
| CORS error di browser | Origin frontend tidak terdaftar | Tambahkan origin ke `CORS_ORIGINS`, redeploy backend |
| `409 Tabel ... sudah ada` | Mode `if_exists=fail` dan nama tabel bentrok | Gunakan `if_exists=replace` atau `append`, atau ganti nama file |
| `409 destructive_sql_requires_confirmation` | File `.sql` berisi perintah destruktif | Periksa daftar peringatan; kirim ulang dengan `confirm_destructive=true` setelah setuju |
| `415 Format ... tidak didukung` | Ekstensi bukan CSV/XLSX/XLS/SQL | Konversi file atau gunakan ekstensi yang didukung |
| `413` saat upload | File/baris/kolom/statement melebihi batas | Pecah file atau naikkan batas secara sadar |
| `413` di Vercel | Badan request > 4.5 MB | Gunakan `MAX_UPLOAD_MB=4`, `MAX_SQL_MB=4`, dan `VITE_MAX_*` yang sama |
| `.xlsx`/`.xls` gagal dibaca | `openpyxl`/`xlrd` belum terpasang | `pip install -r requirements.txt` |
| Frontend tidak bisa menghubungi backend | Backend belum jalan atau URL salah | Jalankan uvicorn; set `VITE_API_BASE_URL` bila perlu |
| `npm` diblokir di PowerShell | Execution policy | Gunakan `npm.cmd run dev` / `npm.cmd run build` |
| `relation ... does not exist` | Tabel tidak ada di workspace akun | Upload dataset; data demo `seed.py` hanya ada di `public` mode lokal |
| Tabel baru tidak muncul setelah upload `.sql` | Daftar tabel belum dimuat ulang | Klik muat ulang di pemilih tabel atau unggah ulang; frontend biasanya otomatis memuat ulang |

---

## Roadmap

- [x] Autentikasi Supabase dan isolasi workspace per akun.
- [x] Kuota harian per akun + refund saat penyedia LLM gagal.
- [x] Groq sebagai penyedia utama + fallback Gemini.
- [x] Konfirmasi file `.sql` destruktif.
- [ ] Role database terpisah untuk operasi baca dan tulis.
- [ ] Endpoint penghapusan akun + pembersihan workspace.
- [ ] Audit log untuk setiap eksekusi DML yang disetujui.
- [ ] Pratinjau dampak query (`EXPLAIN`, estimasi baris) sebelum konfirmasi.
- [ ] Ekspor hasil CSV/Excel dan kartu KPI.
- [ ] Simpan hasil ke dasbor (pin), bukan dashboard otomatis penuh.
- [ ] Job asinkron untuk upload besar dan impor multi-sheet Excel.
- [ ] Pagination hasil query.
- [ ] Suite pengujian otomatis + CI (pytest, Playwright, lint).
- [ ] Docker Compose untuk PostgreSQL + backend + frontend.
- [ ] Dukungan multi-bahasa pada antarmuka.

Ide fitur yang lebih rinci ada di [`IDEAS.md`](IDEAS.md).

---

## Kontribusi

Kontribusi terbuka untuk perbaikan bug, dokumentasi, dan fitur baru.

1. Fork repositori.
2. Buat branch fitur: `git checkout -b feat/nama-fitur`.
3. Commit perubahan dengan pesan yang jelas.
4. Pastikan `python -m compileall` dan `npm run build` lolos.
5. Buka Pull Request dengan deskripsi perubahan dan langkah pengujian.

Untuk perubahan yang menyentuh validasi SQL, isolasi workspace, atau alur konfirmasi, sertakan skenario serangan/bypass yang sudah diuji.

---

## Lisensi

Belum ada file lisensi pada repositori ini. Tambahkan `LICENSE` (misalnya MIT) jika proyek akan didistribusikan secara terbuka.

---

## Ucapan terima kasih

- [FastAPI](https://fastapi.tiangolo.com/) dan [SQLAlchemy](https://www.sqlalchemy.org/) untuk fondasi backend.
- [Groq](https://console.groq.com/) untuk penerjemahan bahasa natural ke SQL sebagai penyedia utama.
- [Google Gemini](https://ai.google.dev/) untuk cadangan saat Groq gagal atau kena kuota.
- [Supabase](https://supabase.com/) untuk PostgreSQL dan autentikasi.
- [React](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), dan [Recharts](https://recharts.org/) untuk antarmuka.
- [lucide](https://lucide.dev/) untuk set ikon.
- [Vercel](https://vercel.com/) untuk hosting frontend dan backend.

---

<p align="center">
  Dibuat oleh <a href="https://github.com/hayyanjpg">hayyanjpg</a>
  <br />
  <sub>SQL_Analysis · SIFT Text-to-SQL Desk</sub>
</p>


