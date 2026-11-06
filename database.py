"""
database.py
Konfigurasi koneksi database menggunakan SQLAlchemy.

DATABASE_URL dibaca dari file .env di root proyek, sehingga tidak ada
kredensial yang di-hardcode di dalam kode (sesuai aturan proyek).
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Root proyek = folder tempat file ini berada
BASE_DIR = Path(__file__).resolve().parent

# Muat variabel dari .env (path eksplisit agar tidak bergantung pada cwd)
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL belum diset. Tambahkan baris berikut ke file .env:\n"
        'DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"'
    )

# Engine SQLAlchemy.
# - pool_pre_ping: cek koneksi masih hidup sebelum dipakai (penting untuk
#   database cloud seperti Aiven yang memutus koneksi idle).
# - pool_recycle: daur ulang koneksi setiap 5 menit.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)

# Factory session untuk operasi ORM/query
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

# Base class untuk model ORM (dipakai saat backend FastAPI dibuat nanti)
Base = declarative_base()


def get_db():
    """
    Dependency FastAPI: membuka session per request dan menutupnya
    secara otomatis setelah request selesai.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection() -> bool:
    """Uji koneksi ke database. Mengembalikan True jika berhasil."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001 - tampilkan error asli agar mudah didiagnosis
        print(f"[ERROR] Gagal terhubung ke database: {exc}")
        return False
