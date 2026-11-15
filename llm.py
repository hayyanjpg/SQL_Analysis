"""
llm.py
Penyedia LLM untuk text-to-SQL.

Groq dipakai sebagai penyedia utama karena kuota gratisnya jauh lebih besar
daripada Gemini (30 request/menit, 1.000 request/hari). Gemini tetap tersedia
sebagai cadangan ketika Groq kena batas kuota atau gangguan sementara.

Modul ini hanya mengurus panggilan HTTP ke Groq. Gemini tetap ditangani
`main.py` lewat SDK `google-generativeai`, dan `main.py` yang memutuskan urutan
fallback. Dengan begitu modul ini tidak bergantung pada SDK Gemini dan mudah
diuji.

Semua kunci dibaca dari environment; tidak ada secret yang ditulis di kode.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import requests

logger = logging.getLogger("dynamic_sql")

DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_TIMEOUT_SECONDS = 60.0
MAX_RESPONSE_TOKENS = 1024

VALID_PROVIDERS = {"auto", "groq", "gemini"}


class ProviderError(RuntimeError):
    """Kegagalan satu penyedia LLM, lengkap dengan saran status HTTP."""

    def __init__(
        self,
        message: str,
        *,
        provider: str,
        status_code: int = 502,
        quota_exhausted: bool = False,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code
        self.quota_exhausted = quota_exhausted


@dataclass(frozen=True)
class GroqSettings:
    api_key: str
    model: str
    base_url: str
    timeout: float


def _positive_float(raw: str | None, fallback: float) -> float:
    try:
        value = float(str(raw).strip())
    except (TypeError, ValueError):
        return fallback
    return value if value > 0 else fallback


def groq_settings() -> GroqSettings | None:
    """Konfigurasi Groq, atau None bila GROQ_API_KEY belum diisi."""
    api_key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not api_key:
        return None

    return GroqSettings(
        api_key=api_key,
        model=(os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip(),
        base_url=(
            os.getenv("GROQ_BASE_URL") or DEFAULT_GROQ_BASE_URL
        ).strip().rstrip("/"),
        timeout=_positive_float(
            os.getenv("GROQ_TIMEOUT_SECONDS"), DEFAULT_TIMEOUT_SECONDS
        ),
    )


def groq_configured() -> bool:
    return groq_settings() is not None


def provider_order(gemini_available: bool) -> list[str]:
    """
    Urutan penyedia yang dicoba untuk satu pertanyaan.

    - LLM_PROVIDER=auto (default): Groq dulu, lalu Gemini.
    - LLM_PROVIDER=groq: hanya Groq.
    - LLM_PROVIDER=gemini: hanya Gemini.
    """
    provider = (os.getenv("LLM_PROVIDER") or "auto").strip().lower()
    if provider not in VALID_PROVIDERS:
        logger.warning(
            "LLM_PROVIDER=%s tidak dikenal; memakai mode auto.", provider
        )
        provider = "auto"

    if provider == "groq":
        return ["groq"] if groq_configured() else []
    if provider == "gemini":
        return ["gemini"] if gemini_available else []

    order: list[str] = []
    if groq_configured():
        order.append("groq")
    if gemini_available:
        order.append("gemini")
    return order


def _short_body(response: requests.Response, limit: int = 200) -> str:
    """Potongan body untuk log; tidak pernah dikirim ke pengguna."""
    text = " ".join((response.text or "").split())
    return text[:limit]


def _error_from_response(response: requests.Response) -> ProviderError:
    status = response.status_code
    body = _short_body(response)

    if status == 429:
        return ProviderError(
            "Kuota Groq sedang habis. Coba lagi beberapa saat lagi.",
            provider="groq",
            status_code=429,
            quota_exhausted=True,
        )
    if status in {401, 403}:
        logger.error("Kunci Groq ditolak (HTTP %s): %s", status, body)
        return ProviderError(
            "Kunci Groq ditolak server. Pemilik aplikasi perlu memeriksa "
            "GROQ_API_KEY.",
            provider="groq",
            status_code=502,
        )
    if status in {400, 404, 422}:
        logger.error("Permintaan Groq tidak valid (HTTP %s): %s", status, body)
        return ProviderError(
            "Model Groq tidak dapat dipakai. Pemilik aplikasi perlu memeriksa "
            "GROQ_MODEL.",
            provider="groq",
            status_code=502,
        )
    if status == 504:
        return ProviderError(
            "Groq terlalu lama menjawab. Coba lagi sebentar lagi.",
            provider="groq",
            status_code=504,
        )

    logger.error("Groq mengembalikan HTTP %s: %s", status, body)
    return ProviderError(
        "Groq sedang bermasalah. Coba lagi sebentar lagi.",
        provider="groq",
        status_code=502,
    )


def generate_groq(system_prompt: str, question: str) -> str:
    """
    Kirim prompt ke Groq dan kembalikan teks jawaban mentah.

    Teks masih bisa mengandung markdown; pembersihan dilakukan `normalize_sql`
    di `main.py`.
    """
    settings = groq_settings()
    if settings is None:
        raise ProviderError(
            "GROQ_API_KEY belum diset di server.",
            provider="groq",
            status_code=503,
        )

    payload = {
        "model": settings.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        "temperature": 0,
        "top_p": 0.1,
        "max_tokens": MAX_RESPONSE_TOKENS,
        "stream": False,
    }

    # Model gpt-oss adalah model penalaran. Menurunkan effort menghemat token
    # agar tetap di bawah batas TPM paket gratis Groq.
    if "gpt-oss" in settings.model.lower():
        payload["reasoning_effort"] = "low"

    try:
        response = requests.post(
            f"{settings.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=(10, settings.timeout),
        )
    except requests.Timeout as exc:
        raise ProviderError(
            "Groq terlalu lama menjawab. Coba lagi sebentar lagi.",
            provider="groq",
            status_code=504,
        ) from exc
    except requests.RequestException as exc:
        logger.exception("Gagal menghubungi Groq")
        raise ProviderError(
            "Tidak dapat menghubungi Groq. Coba lagi sebentar lagi.",
            provider="groq",
            status_code=502,
        ) from exc

    if response.status_code >= 400:
        raise _error_from_response(response)

    try:
        body = response.json()
    except ValueError as exc:
        logger.error("Respons Groq bukan JSON: %s", _short_body(response))
        raise ProviderError(
            "Groq mengembalikan respons yang tidak dapat dibaca.",
            provider="groq",
            status_code=502,
        ) from exc

    choices = body.get("choices") or []
    message = (choices[0] or {}).get("message") if choices else None
    content = (message or {}).get("content") or ""

    if not str(content).strip():
        logger.warning("Groq tidak mengembalikan teks: %s", _short_body(response))
        raise ProviderError(
            "Groq tidak mengembalikan query SQL.",
            provider="groq",
            status_code=502,
        )

    return str(content)
