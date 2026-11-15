"""
quota.py
Kuota pertanyaan harian per akun.

Tujuan: kunci API milik pemilik dipakai bersama oleh semua pengguna, sehingga
satu akun tidak boleh menghabiskan jatah seluruh pengguna. Setiap akun mendapat
jatah harian yang sama; jatah direset setiap tengah malam UTC (mengikuti siklus
kuota Groq).

Data disimpan di `public.usage_daily` (satu baris per akun per hari). Tabel ini
tidak pernah dibaca langsung oleh frontend; hanya backend yang menyentuhnya.

Catatan: penghitung memakai `INSERT ... ON CONFLICT ... WHERE` agar aman
terhadap dua request bersamaan (tidak bisa melewati batas).
"""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import engine

logger = logging.getLogger("dynamic_sql")

DEFAULT_DAILY_LIMIT = 15

BOOTSTRAP_SQL = """
CREATE TABLE IF NOT EXISTS public.usage_daily (
    user_id uuid NOT NULL,
    day date NOT NULL,
    question_count integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
);

ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON public.usage_daily FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON public.usage_daily FROM authenticated';
    END IF;
END
$$;
"""

_infrastructure_ready = False


class QuotaError(RuntimeError):
    """Kegagalan memeriksa kuota, dengan pesan yang aman ditampilkan."""


@dataclass(frozen=True)
class QuotaStatus:
    """Kondisi kuota satu akun pada satu hari."""

    limit: int
    used: int
    day: date

    @property
    def unlimited(self) -> bool:
        return self.limit <= 0

    @property
    def remaining(self) -> int | None:
        """Sisa pertanyaan; None berarti tanpa batas."""
        if self.unlimited:
            return None
        return max(0, self.limit - self.used)


def daily_limit() -> int:
    """
    Batas pertanyaan per akun per hari.

    DAILY_QUESTION_LIMIT=0 berarti tanpa batas (tidak disarankan untuk publik).
    Nilai kosong atau tidak valid memakai default 15.
    """
    raw = (os.getenv("DAILY_QUESTION_LIMIT") or "").strip()
    if not raw:
        return DEFAULT_DAILY_LIMIT

    try:
        value = int(raw)
    except ValueError:
        logger.warning(
            "DAILY_QUESTION_LIMIT=%s bukan angka; memakai %d.",
            raw,
            DEFAULT_DAILY_LIMIT,
        )
        return DEFAULT_DAILY_LIMIT

    return max(0, value)


def _normalize_user_id(user_id: str) -> str:
    try:
        return str(uuid.UUID(str(user_id)))
    except (ValueError, AttributeError, TypeError) as exc:
        raise QuotaError("ID pengguna tidak valid.") from exc


def _today() -> date:
    return datetime.now(timezone.utc).date()


def reset_hint() -> str:
    """Waktu reset berikutnya dalam UTC, untuk pesan ke pengguna."""
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return tomorrow.strftime("%Y-%m-%d %H:%M UTC")


def ensure_quota_infrastructure() -> None:
    """Buat tabel kuota bila belum ada. Idempoten dan aman untuk cold start."""
    global _infrastructure_ready
    if _infrastructure_ready:
        return

    try:
        with engine.begin() as connection:
            connection.execute(text(BOOTSTRAP_SQL))
    except SQLAlchemyError as exc:
        logger.exception("Gagal menyiapkan tabel kuota")
        raise QuotaError(
            "Kuota harian belum dapat diperiksa. Coba lagi sebentar lagi."
        ) from exc

    _infrastructure_ready = True


def snapshot(user_id: str, limit: int | None = None) -> QuotaStatus:
    """Baca pemakaian hari ini tanpa menambah penghitung."""
    owner = _normalize_user_id(user_id)
    effective_limit = daily_limit() if limit is None else limit
    day = _today()

    try:
        ensure_quota_infrastructure()
        with engine.connect() as connection:
            used = connection.execute(
                text(
                    "SELECT question_count FROM public.usage_daily "
                    "WHERE user_id = :user AND day = :day"
                ),
                {"user": owner, "day": day},
            ).scalar_one_or_none()
    except SQLAlchemyError as exc:
        logger.exception("Gagal membaca kuota %s", owner)
        raise QuotaError(
            "Kuota harian belum dapat diperiksa. Coba lagi sebentar lagi."
        ) from exc

    return QuotaStatus(limit=effective_limit, used=int(used or 0), day=day)


def try_consume(user_id: str, limit: int | None = None) -> QuotaStatus | None:
    """
    Tambah satu pemakaian bila masih ada sisa.

    Mengembalikan status terbaru, atau None bila kuota hari ini habis.
    Operasi atomik: dua request bersamaan tidak dapat melewati batas.
    """
    owner = _normalize_user_id(user_id)
    effective_limit = daily_limit() if limit is None else limit
    day = _today()

    try:
        ensure_quota_infrastructure()
        with engine.begin() as connection:
            if effective_limit <= 0:
                used = connection.execute(
                    text(
                        "INSERT INTO public.usage_daily "
                        "(user_id, day, question_count) "
                        "VALUES (:user, :day, 1) "
                        "ON CONFLICT (user_id, day) DO UPDATE "
                        "SET question_count = public.usage_daily.question_count + 1, "
                        "    updated_at = now() "
                        "RETURNING question_count"
                    ),
                    {"user": owner, "day": day},
                ).scalar_one()
                return QuotaStatus(limit=effective_limit, used=int(used), day=day)

            used = connection.execute(
                text(
                    "INSERT INTO public.usage_daily "
                    "(user_id, day, question_count) "
                    "VALUES (:user, :day, 1) "
                    "ON CONFLICT (user_id, day) DO UPDATE "
                    "SET question_count = public.usage_daily.question_count + 1, "
                    "    updated_at = now() "
                    "WHERE public.usage_daily.question_count < :limit "
                    "RETURNING question_count"
                ),
                {"user": owner, "day": day, "limit": effective_limit},
            ).scalar_one_or_none()
    except SQLAlchemyError as exc:
        logger.exception("Gagal mencatat kuota %s", owner)
        raise QuotaError(
            "Kuota harian belum dapat dicatat. Coba lagi sebentar lagi."
        ) from exc

    if used is None:
        return None
    return QuotaStatus(limit=effective_limit, used=int(used), day=day)


def refund(user_id: str) -> None:
    """
    Kembalikan satu pemakaian saat penyedia LLM gagal.

    Kegagalan refund tidak boleh menggagalkan request pengguna, jadi hanya
    dicatat di log.
    """
    try:
        owner = _normalize_user_id(user_id)
        with engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE public.usage_daily "
                    "SET question_count = GREATEST(question_count - 1, 0), "
                    "    updated_at = now() "
                    "WHERE user_id = :user AND day = :day"
                ),
                {"user": owner, "day": _today()},
            )
    except (QuotaError, SQLAlchemyError):
        logger.exception("Gagal mengembalikan kuota untuk %s", user_id)
