"""
auth.py
Verifikasi access token Supabase untuk endpoint yang membutuhkan login.

Frontend memakai supabase-js untuk login (Google atau email OTP), lalu
mengirim `Authorization: Bearer <access_token>` ke backend. Backend tidak
mempercayai klaim apa pun dari client: token diperiksa ke Supabase Auth.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import threading
import time
from dataclasses import dataclass

import requests
from fastapi import HTTPException, Request

logger = logging.getLogger("dynamic_sql")

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
SUPABASE_ANON_KEY = (
    os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or ""
).strip()

SUPABASE_CONFIGURED = bool(SUPABASE_URL and SUPABASE_ANON_KEY)

# Token yang sama dipakai berkali-kali (setiap request dari tab yang sama).
# Cache singkat menghemat satu panggilan HTTP per request.
CACHE_TTL_SECONDS = 300
CACHE_MAX_ENTRIES = 500


@dataclass(frozen=True)
class SupabaseUser:
    id: str
    email: str | None = None
    role: str | None = None


_cache: dict[str, tuple[float, SupabaseUser]] = {}
_cache_lock = threading.Lock()


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        token = header[7:].strip()
        return token or None
    return None


def _token_expiry_epoch(token: str) -> float | None:
    """
    Baca klaim `exp` tanpa memverifikasi tanda tangan.

    Aman dipakai hanya untuk menentukan lama cache; validitas token tetap
    ditentukan oleh Supabase. Kalau gagal dibaca, kembalikan None.
    """
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        exp = data.get("exp")
        return float(exp) if exp is not None else None
    except (IndexError, ValueError, TypeError, json.JSONDecodeError):
        return None


def _cache_get(token: str) -> SupabaseUser | None:
    now = time.monotonic()
    with _cache_lock:
        entry = _cache.get(token)
        if entry is None:
            return None
        expires_at, user = entry
        if expires_at <= now:
            _cache.pop(token, None)
            return None
        return user


def _cache_put(token: str, user: SupabaseUser) -> None:
    now = time.monotonic()
    ttl = CACHE_TTL_SECONDS

    expiry = _token_expiry_epoch(token)
    if expiry is not None:
        remaining = expiry - time.time() - 30  # jangan pakai token yang hampir habis
        if remaining <= 0:
            return
        ttl = min(ttl, remaining)

    with _cache_lock:
        if len(_cache) >= CACHE_MAX_ENTRIES:
            _cache.clear()
        _cache[token] = (now + ttl, user)


def verify_access_token(token: str) -> SupabaseUser:
    """Verifikasi token ke Supabase Auth dan kembalikan identitas pemiliknya."""
    if not SUPABASE_CONFIGURED:
        raise HTTPException(
            status_code=503,
            detail=(
                "Login belum dikonfigurasi di server. Hubungi pemilik aplikasi."
            ),
        )

    cached = _cache_get(token)
    if cached is not None:
        return cached

    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        logger.warning("Gagal menghubungi Supabase Auth: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Layanan login sedang tidak dapat dihubungi. Coba lagi.",
        ) from exc

    if response.status_code in (401, 403):
        raise HTTPException(
            status_code=401,
            detail="Sesi login tidak valid atau sudah kedaluwarsa.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if response.status_code >= 400:
        logger.warning(
            "Supabase Auth menolak token dengan status %s", response.status_code
        )
        raise HTTPException(
            status_code=503,
            detail="Layanan login sedang bermasalah. Coba lagi.",
        )

    try:
        payload = response.json() or {}
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail="Respons layanan login tidak dapat dibaca.",
        ) from exc

    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Token login tidak memuat identitas pengguna.",
        )

    user = SupabaseUser(
        id=str(user_id),
        email=payload.get("email"),
        role=payload.get("role"),
    )
    _cache_put(token, user)
    return user


def require_user(request: Request) -> SupabaseUser:
    """Dependency FastAPI: wajib login dengan token Supabase yang valid."""
    token = _bearer_token(request)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Login diperlukan untuk mengakses data ini.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_access_token(token)
