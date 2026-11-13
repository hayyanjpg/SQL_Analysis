"""
workspaces.py
Satu workspace per akun.

Metadata workspace disimpan di `public.workspaces`, sedangkan tabel milik user
ditempatkan di schema PostgreSQL tersendiri (mis. `ws_ab12...`). Dengan begitu
dua user boleh punya tabel bernama sama tanpa saling menimpa.

Modul ini sengaja tidak menyentuh data user; ia hanya menyiapkan dan
mengembalikan nama schema yang menjadi "ruang" akun tersebut.
"""

from __future__ import annotations

import logging
import re
import uuid

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import engine

logger = logging.getLogger("dynamic_sql")

WORKSPACE_SCHEMA_PREFIX = "ws_"
WORKSPACE_SCHEMA_HEX_LENGTH = 24
WORKSPACE_SCHEMA_PATTERN = re.compile(
    rf"^{WORKSPACE_SCHEMA_PREFIX}[0-9a-f]{{{WORKSPACE_SCHEMA_HEX_LENGTH}}}$"
)

# Dijalankan sekali per proses. Idempoten, jadi aman kalau instance serverless
# baru melakukan cold start dan menjalankannya lagi.
BOOTSTRAP_SQL = """
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL UNIQUE,
    schema_name text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON public.workspaces FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON public.workspaces FROM authenticated';
    END IF;
END
$$;
"""

_infrastructure_ready = False


class WorkspaceError(RuntimeError):
    """Kegagalan menyiapkan workspace, dengan pesan yang aman ditampilkan."""


def quote_identifier(name: str) -> str:
    """Quote nama schema/tabel agar aman dipakai pada SQL internal."""
    return '"' + str(name).replace('"', '""') + '"'


def is_workspace_schema(name: str) -> bool:
    """True hanya untuk schema yang dibuat aplikasi ini (ws_ + 24 hex)."""
    return bool(WORKSPACE_SCHEMA_PATTERN.match(str(name or "")))


def validate_workspace_schema(name: str) -> str:
    """
    Tolak nama schema yang tidak sesuai pola internal.

    Nama schema selalu berasal dari `public.workspaces`, tetapi validasi ini
    mencegah nilai tak terduga ikut masuk ke `search_path` atau DDL.
    """
    if not is_workspace_schema(name):
        raise WorkspaceError("Nama workspace tidak valid.")
    return name


def _normalize_owner_id(owner_id: str) -> str:
    try:
        return str(uuid.UUID(str(owner_id)))
    except (ValueError, AttributeError, TypeError) as exc:
        raise WorkspaceError("ID pengguna tidak valid.") from exc


def schema_name_for(owner_id: str) -> str:
    """
    Nama schema deterministik dari ID akun.

    Deterministik penting agar dua request bersamaan untuk akun baru tidak
    membuat dua schema berbeda.
    """
    compact = uuid.UUID(_normalize_owner_id(owner_id)).hex
    return f"{WORKSPACE_SCHEMA_PREFIX}{compact[:WORKSPACE_SCHEMA_HEX_LENGTH]}"


def ensure_workspace_infrastructure() -> None:
    """Buat tabel metadata workspace bila belum ada."""
    global _infrastructure_ready
    if _infrastructure_ready:
        return

    try:
        with engine.begin() as connection:
            connection.execute(text(BOOTSTRAP_SQL))
    except SQLAlchemyError as exc:
        logger.exception("Gagal menyiapkan infrastruktur workspace")
        raise WorkspaceError(
            "Workspace belum dapat disiapkan. Coba lagi sebentar lagi."
        ) from exc

    _infrastructure_ready = True


def get_or_create_workspace(owner_id: str) -> str:
    """
    Kembalikan nama schema milik akun, membuatnya bila belum ada.

    `owner_id` harus berasal dari token login yang sudah diverifikasi, bukan
    dari input client.
    """
    owner = _normalize_owner_id(owner_id)
    ensure_workspace_infrastructure()

    schema = schema_name_for(owner)

    try:
        with engine.begin() as connection:
            # Cegah dua request bersamaan membuat schema yang sama.
            connection.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:owner)::bigint)"),
                {"owner": owner},
            )

            existing = connection.execute(
                text(
                    "SELECT schema_name FROM public.workspaces "
                    "WHERE owner_id = :owner"
                ),
                {"owner": owner},
            ).scalar_one_or_none()

            if existing:
                # Kalau schema terhapus manual, buat ulang agar akun tetap bisa
                # dipakai. Metadata tidak perlu diubah.
                schema_exists = connection.execute(
                    text("SELECT 1 FROM pg_namespace WHERE nspname = :schema"),
                    {"schema": existing},
                ).scalar_one_or_none()
                if schema_exists:
                    return existing
                connection.execute(
                    text(f"CREATE SCHEMA IF NOT EXISTS {quote_identifier(existing)}")
                )
                return existing

            connection.execute(
                text(f"CREATE SCHEMA IF NOT EXISTS {quote_identifier(schema)}")
            )
            connection.execute(
                text(
                    "INSERT INTO public.workspaces (owner_id, schema_name) "
                    "VALUES (:owner, :schema) "
                    "ON CONFLICT (owner_id) DO NOTHING"
                ),
                {"owner": owner, "schema": schema},
            )

            resolved = connection.execute(
                text(
                    "SELECT schema_name FROM public.workspaces "
                    "WHERE owner_id = :owner"
                ),
                {"owner": owner},
            ).scalar_one()
            return resolved
    except SQLAlchemyError as exc:
        logger.exception("Gagal menyiapkan workspace untuk %s", owner)
        raise WorkspaceError(
            "Workspace belum dapat disiapkan. Coba lagi sebentar lagi."
        ) from exc


def drop_workspace(owner_id: str) -> None:
    """
    Hapus schema dan metadata milik akun.

    Dipakai saat akun dihapus. Tidak dipanggil otomatis oleh endpoint publik.
    """
    owner = _normalize_owner_id(owner_id)
    ensure_workspace_infrastructure()

    try:
        with engine.begin() as connection:
            schema = connection.execute(
                text(
                    "SELECT schema_name FROM public.workspaces "
                    "WHERE owner_id = :owner"
                ),
                {"owner": owner},
            ).scalar_one_or_none()

            if not schema:
                return

            connection.execute(
                text(f"DROP SCHEMA IF EXISTS {quote_identifier(schema)} CASCADE")
            )
            connection.execute(
                text("DELETE FROM public.workspaces WHERE owner_id = :owner"),
                {"owner": owner},
            )
    except SQLAlchemyError as exc:
        logger.exception("Gagal menghapus workspace untuk %s", owner)
        raise WorkspaceError("Workspace gagal dihapus.") from exc
