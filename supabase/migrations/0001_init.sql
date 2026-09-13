-- Saved client cases for the Estate Distribution Calculator.
--
-- One table, owned rows, row-level security on from the start. An advisor sees
-- their own cases and nobody else's — the anon key in config.js is public, so
-- these policies are the only thing standing between one advisor's client data
-- and another's. Run this whole file in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.cases (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 200),
  client_name text,
  state       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cases_owner_updated_idx
  on public.cases (owner, updated_at desc);

-- RLS first, policies second. Never the other way round.
alter table public.cases enable row level security;

drop policy if exists "read own cases"   on public.cases;
drop policy if exists "insert own cases" on public.cases;
drop policy if exists "update own cases" on public.cases;
drop policy if exists "delete own cases" on public.cases;

create policy "read own cases"   on public.cases for select using (auth.uid() = owner);
create policy "insert own cases" on public.cases for insert with check (auth.uid() = owner);
create policy "update own cases" on public.cases for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "delete own cases" on public.cases for delete using (auth.uid() = owner);

-- Keep updated_at honest so the "most recent first" ordering means something.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists cases_touch_updated_at on public.cases;
create trigger cases_touch_updated_at
  before update on public.cases
  for each row execute function public.touch_updated_at();
