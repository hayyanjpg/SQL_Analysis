-- 0002_usage_daily.sql
-- Kuota pertanyaan harian per akun.
--
-- Satu baris per (akun, tanggal UTC). Backend menaikkan question_count secara
-- atomik sebelum memanggil penyedia LLM, lalu mengembalikannya bila penyedia
-- gagal. Tabel ini hanya diakses backend (service role), tidak oleh frontend.
--
-- File ini idempoten. Backend juga menjalankan DDL yang sama otomatis pada
-- panggilan /api/quota atau /api/ask pertama, tetapi file ini bisa dijalankan
-- manual lewat Supabase SQL Editor untuk audit atau pemulihan.

create table if not exists public.usage_daily (
    user_id uuid not null,
    day date not null,
    question_count integer not null default 0,
    updated_at timestamptz not null default now(),
    primary key (user_id, day)
);

comment on table public.usage_daily is
    'Kuota pertanyaan harian per akun. Direset setiap tengah malam UTC.';
comment on column public.usage_daily.user_id is
    'ID akun dari auth.users, diisi backend dari token yang sudah diverifikasi.';
comment on column public.usage_daily.question_count is
    'Jumlah pertanyaan yang sudah dipakai pada tanggal tersebut.';

create index if not exists usage_daily_day_idx
    on public.usage_daily (day);

alter table public.usage_daily enable row level security;

do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on public.usage_daily from anon';
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute 'revoke all on public.usage_daily from authenticated';
    end if;
end
$$;
