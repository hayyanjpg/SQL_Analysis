-- 0001_workspaces.sql
-- Fondasi multi-user: satu workspace (schema PostgreSQL) per akun Supabase.
--
-- File ini idempoten. Backend juga menjalankan DDL yang sama secara otomatis
-- pada panggilan /api/auth/me pertama, tetapi file ini bisa dijalankan manual
-- lewat Supabase SQL Editor untuk audit atau pemulihan.

create table if not exists public.workspaces (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null unique,
    schema_name text not null unique,
    created_at timestamptz not null default now()
);

comment on table public.workspaces is
    'Metadata workspace: satu baris per akun Supabase. Tabel user berada di schema_name.';
comment on column public.workspaces.owner_id is
    'ID akun dari auth.users. Diisi backend dari token yang sudah diverifikasi.';
comment on column public.workspaces.schema_name is
    'Schema PostgreSQL milik akun, mis. ws_ab12cd34...';

-- Backend terhubung sebagai pemilik tabel (postgres), sehingga tetap bisa
-- membaca. Role anon/authenticated tidak boleh menyentuh metadata ini.
alter table public.workspaces enable row level security;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on public.workspaces from anon';
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute 'revoke all on public.workspaces from authenticated';
    end if;
end
$$;
