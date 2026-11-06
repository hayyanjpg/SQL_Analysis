# SQL_Analysis

### SIFT — Text-to-SQL Desk & Dynamic Data Management

Platform analitik data berbasis bahasa natural: unggah dataset sendiri, ajukan pertanyaan dalam bahasa Indonesia/Inggris, lalu dapatkan tabel dan grafik dari PostgreSQL. Perubahan data (`INSERT`, `UPDATE`, `DELETE`) tidak pernah dijalankan diam-diam — semuanya menunggu persetujuan eksplisit pengguna.

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-API-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)

---

## Daftar isi

- [Ringkasan](#ringkasan)
- [Fitur utama](#fitur-utama)
- [Arsitektur](#arsitektur)
- [Tech stack](#tech-stack)
- [Skema database](#skema-database)
- [Struktur proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi environment](#konfigurasi-environment)
- [Menjalankan aplikasi](#menjalankan-aplikasi)
- [Dokumentasi API](#dokumentasi-api)
- [Aturan keamanan](#aturan-keamanan)
- [Verifikasi](#verifikasi)
- [Batasan dan risiko](#batasan-dan-risiko)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Kontribusi](#kontribusi)

---

## Ringkasan

SIFT menjembatani pengguna bisnis dan database PostgreSQL tanpa memerlukan pengetahuan SQL. Alur intinya:

1. **Unggah data** — CSV, Excel (`.xlsx`/`.xls`), atau skrip `.sql` langsung dari antarmuka.
2. **Tanya dengan bahasa natural** — backend membaca skema database secara *real-time* dan menyuntikkannya ke prompt Gemini.
3. **SELECT langsung dijalankan** — hasil dikembalikan sebagai tabel, dan otomatis divisualisasikan sebagai bar chart bila bentuk datanya cocok.
4. **DML menunggu izin** — `INSERT`, `UPDATE`, dan `DELETE` dikembalikan sebagai usulan query. Pengguna membaca SQL-nya, lalu memilih **Izinkan Eksekusi** atau **Batalkan**.

> Proyek ini cocok untuk eksplorasi data, demo analitik, dan pembelajaran text-to-SQL. Untuk produksi, baca bagian [Batasan dan risiko](#batasan-dan-risiko) terlebih dahulu.

---

## Fitur utama

### 1. Bring Your Own Data (BYOD)

- Upload `.csv`, `.xlsx`, `.xls`, dan `.sql` melalui modal dropzone (klik atau drag & drop).
- Nama kolom dinormalisasi otomatis: spasi dan karakter khusus menjadi `_`, huruf kecil, aksen dihapus, nama yang berawalan angka diberi prefiks.
- Nama tabel diambil dari nama file dan dibersihkan dengan aturan yang sama.
- Deteksi delimiter CSV dari baris header (`,` `;` tab `|`), dengan fallback encoding `utf-8-sig → utf-8 → cp1252 → latin-1`.
- Mode penanganan tabel yang sudah ada:

  | Mode | Query param | Perilaku |
  |---|---|---|
  | Tolak (default) | `if_exists=fail` | Upload dibatalkan dengan HTTP `409` |
  | Ganti | `if_exists=replace` | Tabel lama dihapus, dibuat ulang dari file |
  | Tambah | `if_exists=append` | Baris baru ditambahkan ke tabel yang ada |

- Batas upload: **25 MB** untuk CSV/Excel, **5 MB** untuk SQL, maksimal **200.000 baris** dan **300 kolom**.
- File `.sql` dijalankan **atomik** dalam satu transaksi: sukses semua atau rollback semua.

### 2. Skema dinamis (schema awareness)

Setiap `/api/ask`, backend memanggil `sqlalchemy.inspect(engine)` untuk membaca tabel, kolom, primary key, dan foreign key terbaru dari PostgreSQL. Hasilnya dimasukkan ke *system prompt* Gemini, sehingga tabel yang baru diunggah langsung dapat ditanyakan tanpa restart server.

### 3. Text-to-SQL yang aman

- Output LLM dibersihkan dari markdown fence, prefiks `sql:`, backtick, dan titik koma sebelum divalidasi.
- Hanya **satu statement** yang diizinkan.
- Hanya `SELECT`/`WITH ... SELECT` dan `INSERT`/`UPDATE`/`DELETE`.
- Perintah DDL dan admin (`DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `GRANT`, `SET`, `COPY`, transaksi manual, dsb.) ditolak.
- `UPDATE` dan `DELETE` wajib memiliki klausa `WHERE` pada level teratas.
- `SELECT ... INTO` ditolak karena membuat tabel baru secara tersembunyi.
- `SELECT` dieksekusi dalam transaksi **READ ONLY** dengan `statement_timeout = 60s`.

### 4. Human-in-the-loop untuk perubahan data

Respons `/api/ask` untuk DML:

```json
{
  "status": "require_confirmation",
  "query": "UPDATE products SET price = price * 1.10 WHERE category = 'Elektronik'",
  "message": "AI membutuhkan izin untuk memodifikasi data."
}
```

Frontend menampilkan panel amber berisi SQL mentah dan dua tombol. Query **tidak** dieksekusi sampai pengguna menekan **Izinkan Eksekusi**, yang memanggil `/api/execute_confirmed`. Backend memvalidasi ulang query dari awal — input client tidak dipercaya.

### 5. Visualisasi dan UX

- Tabel hasil query dengan header sticky, format angka, dan scroll horizontal.
- Bar chart otomatis bila hasil memiliki minimal satu kolom teks dan satu kolom numerik.
- Toast notifikasi untuk sukses/gagal upload.
- Sidebar menampilkan tabel hasil upload (disimpan di `localStorage` agar bertahan setelah reload).
- Tema *editorial* konsisten: paper/ink/vermilion, border keras, tipografi serif + mono.
- Layout responsif hingga lebar 390 px.

---

## Arsitektur

```mermaid
flowchart LR
    U[Pengguna] --> F[React + Vite]
    F -->|POST /api/ask| B[FastAPI]
    B -->|system prompt + skema live| G[Google Gemini]
    G -->|SQL| B
    B -->|SELECT read-only| P[(PostgreSQL)]
    B -->|status require_confirmation| F
    F -->|POST /api/execute_confirmed| B
    B -->|INSERT / UPDATE / DELETE| P
    F -->|POST /api/upload| B
    B -->|pandas to_sql / skrip SQL| P
    B -->|JSON: kolom + baris| F
```

**Alur permintaan baca:**

```text
Pertanyaan → Gemini → normalisasi SQL → validasi keamanan
           → SELECT (READ ONLY, 60s timeout) → JSON → tabel + grafik
```

**Alur permintaan tulis:**

```text
Pertanyaan → Gemini → normalisasi SQL → validasi keamanan
           → require_confirmation → pengguna membaca SQL
           → Izinkan? → validasi ulang → DML (commit) → pesan sukses
           → Batalkan? → tidak ada perubahan di database
```

---

## Tech stack

| Lapisan | Teknologi | Keterangan |
|---|---|---|
| Frontend | React 18, Vite 5 | SPA, state lokal tanpa state manager eksternal |
| Styling | Tailwind CSS 3 | Token warna dan animasi kustom |
| Grafik | Recharts 2 | Bar chart otomatis |
| Ikon | lucide-react | Ikon konsisten di seluruh UI |
| HTTP client | Axios | Upload multipart + progress |
| Backend | Python 3.11+, FastAPI | REST API, Pydantic v2 |
| ORM / DB toolkit | SQLAlchemy 2 | Engine, inspector, transaksi |
| Database | PostgreSQL 13+ | Termasuk layanan cloud dengan SSL |
| LLM | Google Gemini (`google-generativeai`) | Temperatur `0.0` untuk SQL deterministik |
| Data parsing | pandas, openpyxl, xlrd | CSV dan Excel |
| Auth DB | python-dotenv | Rahasia dibaca dari `.env` |

---

## Skema database

Skema inti didefinisikan di [`schema.sql`](schema.sql) dan diisi data contoh oleh [`seed.py`](seed.py).

```mermaid
erDiagram
    customers ||--o{ sales : "customer_id"
    products  ||--o{ sales : "product_id"

    customers {
        serial customer_id PK
        varchar name
        varchar email UK
        varchar city
        date join_date
    }

    products {
        serial product_id PK
        varchar product_name
        varchar category
        decimal price
        int stock_quantity
    }

    sales {
        serial sale_id PK
        int customer_id FK
        int product_id FK
        timestamp sale_date
        int quantity
        decimal total_amount
    }
```

| Tabel | Kolom utama | Catatan |
|---|---|---|
| `customers` | `customer_id`, `name`, `email`, `city`, `join_date` | `email` unik |
| `products` | `product_id`, `product_name`, `category`, `price`, `stock_quantity` | Harga `DECIMAL(10,2)` |
| `sales` | `sale_id`, `customer_id`, `product_id`, `sale_date`, `quantity`, `total_amount` | Foreign key ke `customers` dan `products` |

Data contoh: **10 customers**, **10 products**, dan **20 sales** sepanjang tahun 2026. Total nilai transaksi dihitung dari `harga produk × quantity`, bukan angka acak.

Tabel hasil upload ditambahkan ke schema `public` dan langsung ikut terbaca oleh prompt Gemini. Tabel sistem seperti `spatial_ref_sys`, `geography_columns`, dan `geometry_columns` dilewati. Prompt dibatasi agar tetap efisien: maksimal 40 tabel, 80 kolom per tabel, dan 24.000 karakter.

---

## Struktur proyek

```text
SQL_Analysis/
├── main.py                     # FastAPI app: /api/ask, /api/execute_confirmed, /api/upload
│                               # + validator SQL, prompt builder, parser upload
├── database.py                 # Engine SQLAlchemy, SessionLocal, get_db(), test_connection()
├── seed.py                     # Membuat tabel dari schema.sql + data dummy (mendukung --reset)
├── schema.sql                  # Definisi tabel inti PostgreSQL
├── requirements.txt            # Dependensi backend
├── .env.example                # Template konfigurasi backend (tanpa rahasia)
├── .gitignore
├── README.md
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env.example            # Template konfigurasi frontend
    └── src/
        ├── main.jsx
        ├── App.jsx             # Layout, state chat, upload, toast, sidebar
        ├── api.js              # Satu sumber URL endpoint backend
        ├── index.css           # Base Tailwind + utilitas kustom
        ├── components/
        │   ├── AssistantMessage.jsx  # Hasil SELECT + panel konfirmasi DML
        │   ├── AutoBarChart.jsx      # Deteksi & render bar chart otomatis
        │   ├── DataTable.jsx         # Tabel hasil query
        │   ├── ToastStack.jsx        # Notifikasi sukses/gagal/info
        │   └── UploadDataset.jsx     # Modal upload + validasi + progress
        └── utils/
            ├── errors.js       # Ekstraksi pesan error FastAPI/Axios
            └── format.js       # Format angka, label kolom, deteksi numerik
```

---

## Prasyarat

- **Python 3.11+**
- **Node.js 18+** dan npm
- **PostgreSQL 13+** (lokal, Docker, atau cloud seperti Aiven/Neon/Supabase)
- **Google Gemini API key** dari [Google AI Studio](https://aistudio.google.com/apikey)
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

```bash
python seed.py
```

Perintah ini membuat tabel dari `schema.sql` dan mengisi data contoh. Jika tabel sudah ada, seed dibatalkan agar data lama tidak tertimpa. Untuk menghapus dan mengisi ulang:

```bash
python seed.py --reset
```

> `--reset` menghapus tabel `sales`, `products`, dan `customers` beserta seluruh datanya.

### 5. Siapkan frontend

```bash
cd frontend
npm install
```

Opsional, buat konfigurasi lokal:

```powershell
Copy-Item .env.example .env.local
```

---

## Konfigurasi environment

### Backend — `.env` di root proyek

| Variabel | Wajib | Contoh | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | Ya | `postgresql://user:pass@host:5432/dbname?sslmode=require` | DSN PostgreSQL. Untuk cloud biasanya perlu `sslmode=require`. |
| `GEMINI_API_KEY` | Ya | `your-google-ai-studio-key` | API key Gemini. Jangan pernah di-commit. |
| `GEMINI_MODEL` | Tidak | `gemini-3.5-flash` | Default di kode: `gemini-3.5-flash`. Sesuaikan dengan model yang tersedia di akun Anda. |
| `CORS_ORIGINS` | Tidak | `http://localhost:5173,http://127.0.0.1:5173` | Daftar origin dipisahkan koma. Default mencakup port 5173 dan 3000. |

Contoh `.env`:

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/sql_analysis?sslmode=require"
GEMINI_API_KEY="your-google-ai-studio-key"
GEMINI_MODEL="gemini-3.5-flash"
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

### Frontend — `frontend/.env.local` (opsional)

| Variabel | Default | Keterangan |
|---|---|---|
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | Base URL backend tanpa `/api/...` |
| `VITE_API_URL` | — | Kompatibilitas lama; boleh berisi `http://127.0.0.1:8000/api/ask` |

Jika tidak diisi, frontend otomatis memakai `http://127.0.0.1:8000`.

> **Keamanan:** jangan menaruh API key, password database, atau token apa pun di variabel `VITE_*`. Semua variabel Vite ikut ter-bundle ke browser dan dapat dibaca pengguna.

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

Hasil build ada di `frontend/dist/`. Sajikan dengan static web server apa pun, lalu arahkan `VITE_API_BASE_URL` ke backend yang sudah dideploy.

---

## Dokumentasi API

Base URL lokal: `http://127.0.0.1:8000`

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/ask` | Terjemahkan pertanyaan menjadi SQL; jalankan SELECT atau kembalikan usulan DML |
| `POST` | `/api/execute_confirmed` | Eksekusi DML yang sudah disetujui pengguna |
| `POST` | `/api/upload` | Upload CSV/Excel menjadi tabel, atau jalankan file `.sql` |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | Spesifikasi OpenAPI |

### 1. `POST /api/ask` — SELECT

**Request**

```bash
curl -X POST "http://127.0.0.1:8000/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"question":"Berapa total penjualan per kategori produk?"}'
```

**Response `200`**

```json
{
  "question": "Berapa total penjualan per kategori produk?",
  "sql": "SELECT p.category, SUM(s.total_amount) AS total_penjualan FROM sales s JOIN products p ON p.product_id = s.product_id GROUP BY p.category ORDER BY total_penjualan DESC LIMIT 200",
  "columns": ["category", "total_penjualan"],
  "rows": [
    { "category": "Elektronik", "total_penjualan": 19947000.0 }
  ],
  "row_count": 1
}
```

> Contoh di atas diringkas; jumlah baris dan nilai aktual bergantung pada isi database.

### 2. `POST /api/ask` — DML (butuh konfirmasi)

**Request**

```bash
curl -X POST "http://127.0.0.1:8000/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"question":"Naikkan harga semua produk kategori Elektronik sebesar 10%"}'
```

**Response `200`** — query belum dieksekusi:

```json
{
  "status": "require_confirmation",
  "query": "UPDATE products SET price = price * 1.10 WHERE category = 'Elektronik'",
  "message": "AI membutuhkan izin untuk memodifikasi data."
}
```

### 3. `POST /api/execute_confirmed`

**Request**

```bash
curl -X POST "http://127.0.0.1:8000/api/execute_confirmed" \
  -H "Content-Type: application/json" \
  -d '{"query":"UPDATE products SET price = price * 1.10 WHERE category = '\''Elektronik'\''"}'
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

### 4. `POST /api/upload` — CSV/Excel

**Request**

```bash
curl -X POST "http://127.0.0.1:8000/api/upload?if_exists=fail" \
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

### 5. `POST /api/upload` — skrip SQL

```bash
curl -X POST "http://127.0.0.1:8000/api/upload" \
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
| `409` | Nama tabel sudah ada dan `if_exists=fail` |
| `413` | File/baris/kolom melebihi batas |
| `415` | Ekstensi file tidak didukung |
| `422` | Body request gagal validasi Pydantic |
| `502` | Gemini gagal menghasilkan SQL |
| `503` | Database tidak dapat dihubungi atau skema gagal dibaca |

Semua error mengembalikan bentuk standar FastAPI:

```json
{
  "detail": "Pesan error yang dapat dibaca pengguna."
}
```

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
| Eksekusi SELECT | Transaksi `READ ONLY` + `statement_timeout = 60s` |
| Eksekusi DML | Transaksi commit, timeout 60s |
| Konfirmasi ulang | `/api/execute_confirmed` memvalidasi ulang seluruh aturan |

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
- kontrol transaksi manual (`BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, dsb.).

Skrip dijalankan atomik dengan `statement_timeout = 120s` dan maksimal **2.000 statement**.

### Manajemen rahasia

- Tidak ada kredensial yang di-hardcode di kode.
- `DATABASE_URL` dan `GEMINI_API_KEY` dibaca dari `.env` melalui `python-dotenv`.
- `.env`, `.venv`, `node_modules`, `dist`, dan artefak build sudah masuk `.gitignore`.
- Frontend hanya boleh memakai variabel `VITE_*` yang tidak bersifat rahasia.

### CORS

Origin diatur lewat `CORS_ORIGINS`. Secara default hanya mengizinkan:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:3000
http://127.0.0.1:3000
```

Tambahkan origin produksi secara eksplisit; hindari `*` untuk API yang dapat menulis data.

---

## Verifikasi

### Backend

```bash
python -m compileall main.py database.py seed.py
python seed.py
```

Cek endpoint:

```bash
curl http://127.0.0.1:8000/openapi.json
```

### Frontend

```bash
cd frontend
npm run build
```

Build yang sukses menghasilkan `dist/` dan biasanya menampilkan peringatan ukuran chunk dari Recharts (>500 kB). Peringatan tersebut bukan error.

### Checklist manual

- [ ] Upload CSV baru → toast sukses, tabel muncul di sidebar.
- [ ] Tanya data dari tabel hasil upload → tabel/grafik tampil.
- [ ] Minta perubahan data → panel amber muncul dengan SQL mentah, **bukan** tabel kosong.
- [ ] Klik **Batalkan** → pesan “Eksekusi dibatalkan oleh pengguna.”, data tidak berubah.
- [ ] Klik **Izinkan Eksekusi** → pesan sukses, `rowcount` benar, data berubah di database.
- [ ] Upload file yang sama dengan `if_exists=fail` → toast error `409`.
- [ ] Buka di lebar 390 px → tidak ada overflow horizontal.

> Repositori ini belum menyertakan suite pengujian otomatis. Verifikasi di atas adalah alur yang dipakai saat pengembangan.

---

## Batasan dan risiko

Bagian ini penting dibaca sebelum mengekspos aplikasi ke publik.

1. **`/api/execute_confirmed` belum memiliki autentikasi.** Siapa pun yang dapat menjangkau endpoint ini dan mengetahui sebuah query DML dapat mengeksekusinya. Tempatkan di belakang autentikasi/reverse proxy, atau tambahkan lapisan otorisasi sebelum deploy.
2. **File `.sql` masih dapat menjalankan operasi destruktif pada tabel aplikasi.** Blocklist berfokus pada operasi tingkat server (database, role, tablespace, grant, fungsi berbahaya). `DROP TABLE`, `TRUNCATE`, atau `DELETE` tanpa `WHERE` pada tabel pengguna masih mungkin terjadi. Gunakan database khusus, backup, dan batasi hak akses role database.
3. **Role database sebaiknya dipisah.** Idealnya SELECT memakai role read-only, sedangkan DML memakai role terbatas. Saat ini keduanya memakai `DATABASE_URL` yang sama.
4. **Hanya sheet pertama Excel yang diimpor.** `sheet_name=0` bersifat tetap.
5. **Prompt skema dibatasi.** Database dengan lebih dari 40 tabel atau 24.000 karakter skema akan dipotong; LLM mungkin tidak melihat tabel yang terlewat.
6. **Upload `.sql` tidak mengembalikan daftar tabel baru.** Sidebar hanya dapat menampilkan tabel dari upload CSV/Excel, bukan dari skrip SQL.
7. **Daftar tabel di sidebar bersifat kosmetik.** Sumber kebenaran tetap database; daftar disimpan di `localStorage` browser.
8. **Belum ada rate limiting, audit log, atau pagination.** Hasil SELECT besar dibatasi lewat prompt (`LIMIT` maksimal 200), tetapi tidak ada pengaman keras di level eksekusi.
9. **Model Gemini dapat berubah/dihentikan.** Sesuaikan `GEMINI_MODEL` dengan model yang tersedia di akun Anda.
10. **Data uji bersifat fiktif.** Jangan gunakan data pribadi/rahasia pada instance demo publik.

---

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `RuntimeError: DATABASE_URL belum diset` | `.env` tidak ada atau salah lokasi | Buat `.env` di root proyek dari `.env.example` |
| `RuntimeError: GEMINI_API_KEY belum diset` | Key belum diisi | Isi `GEMINI_API_KEY` di `.env` |
| `503 Database tidak dapat dihubungi` | Host/port/password salah, SSL, atau IP belum diizinkan | Cek DSN, tambahkan `sslmode=require`, izinkan IP di panel cloud |
| `502 Gagal menghasilkan query dari Gemini` | Key tidak valid, kuota habis, model tidak tersedia, atau timeout | Cek key/kuota dan `GEMINI_MODEL` |
| CORS error di browser | Origin frontend tidak terdaftar | Tambahkan origin ke `CORS_ORIGINS`, restart backend |
| `409 Tabel ... sudah ada` | Mode `if_exists=fail` dan nama tabel bentrok | Gunakan `if_exists=replace` atau `append`, atau ganti nama file |
| `415 Format ... tidak didukung` | Ekstensi bukan CSV/XLSX/XLS/SQL | Konversi file atau gunakan ekstensi yang didukung |
| `413` saat upload | File/baris/kolom melebihi batas | Pecah file atau naikkan batas di `main.py` secara sadar |
| `.xlsx`/`.xls` gagal dibaca | `openpyxl`/`xlrd` belum terpasang | `pip install -r requirements.txt` |
| Frontend tidak bisa menghubungi backend | Backend belum jalan atau URL salah | Jalankan uvicorn; set `VITE_API_BASE_URL` bila perlu |
| `npm` diblokir di PowerShell | Execution policy | Gunakan `npm.cmd run dev` / `npm.cmd run build` |
| Build warning chunk >500 kB | Bundle Recharts | Bukan error; opsional lakukan code-splitting |
| `relation ... does not exist` | Tabel belum dibuat | Jalankan `python seed.py` atau upload dataset |

---

## Roadmap

- [ ] Autentikasi dan otorisasi (JWT/session) untuk endpoint tulis.
- [ ] Role database terpisah untuk operasi baca dan tulis.
- [ ] Audit log untuk setiap eksekusi DML yang disetujui.
- [ ] Pratinjau dampak query (`EXPLAIN`, estimasi baris) sebelum konfirmasi.
- [ ] Job asinkron untuk upload besar dan impor multi-sheet Excel.
- [ ] Pagination dan ekspor hasil (CSV/Excel).
- [ ] Suite pengujian otomatis + CI (pytest, Playwright, lint).
- [ ] Docker Compose untuk PostgreSQL + backend + frontend.
- [ ] Dukungan multi-bahasa pada antarmuka.

---

## Kontribusi

Kontribusi terbuka untuk perbaikan bug, dokumentasi, dan fitur baru.

1. Fork repositori.
2. Buat branch fitur: `git checkout -b feat/nama-fitur`.
3. Commit perubahan dengan pesan yang jelas.
4. Pastikan `python -m compileall` dan `npm run build` lolos.
5. Buka Pull Request dengan deskripsi perubahan dan langkah pengujian.

Untuk perubahan yang menyentuh validasi SQL atau alur konfirmasi, sertakan skenario serangan/ bypass yang sudah diuji.

---

## Lisensi

Belum ada file lisensi pada repositori ini. Tambahkan `LICENSE` (misalnya MIT) jika proyek akan didistribusikan secara terbuka.

---

## Ucapan terima kasih

- [FastAPI](https://fastapi.tiangolo.com/) dan [SQLAlchemy](https://www.sqlalchemy.org/) untuk fondasi backend.
- [Google Gemini](https://ai.google.dev/) untuk penerjemahan bahasa natural ke SQL.
- [React](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), dan [Recharts](https://recharts.org/) untuk antarmuka.
- [lucide](https://lucide.dev/) untuk set ikon.

---

<p align="center">
  Dibuat oleh <a href="https://github.com/hayyanjpg">hayyanjpg</a>
  <br />
  <sub>SQL_Analysis · SIFT Text-to-SQL Desk</sub>
</p>
