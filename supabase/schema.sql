-- Yǔlù — per-user progress storage.
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.
--
-- One JSONB blob per account holds the whole progress object the app already
-- serializes (streak, XP, SRS cards, saved words, prefs, …). Row-level security
-- guarantees each signed-in user can only ever read or write their own row.

create table if not exists public.user_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

drop policy if exists "own progress - select" on public.user_progress;
drop policy if exists "own progress - insert" on public.user_progress;
drop policy if exists "own progress - update" on public.user_progress;

create policy "own progress - select"
  on public.user_progress for select
  using (auth.uid() = user_id);

create policy "own progress - insert"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create policy "own progress - update"
  on public.user_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
