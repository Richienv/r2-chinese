-- Optional append-only event history (separate from user_progress blob).
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.
-- Safe to skip; the app works without it (history sync is best-effort).

create table if not exists public.user_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  event      jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists user_history_user_id_created_at_idx
  on public.user_history (user_id, created_at desc);

alter table public.user_history enable row level security;

drop policy if exists "own history - select" on public.user_history;
drop policy if exists "own history - insert" on public.user_history;

create policy "own history - select"
  on public.user_history for select
  using (auth.uid() = user_id);

create policy "own history - insert"
  on public.user_history for insert
  with check (auth.uid() = user_id);
