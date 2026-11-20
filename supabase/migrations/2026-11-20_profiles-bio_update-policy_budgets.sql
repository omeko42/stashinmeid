-- Migrasi 2026-11-20 - untuk instalasi yang SUDAH jalan
--
-- Jalankan file ini di Supabase SQL Editor.
-- Aman diulang (idempotent): tidak akan merusak data yang sudah ada.
--
-- Yang ditambahkan:
-- 1. Kolom bio di tabel profiles
-- 2. Policy UPDATE untuk profiles (sebelumnya hanya ada policy SELECT)
-- 3. Tabel budgets + RLS + index

-- 1. Kolom bio
alter table public.profiles add column if not exists bio text;

-- 2. Policy UPDATE untuk profiles.
-- RLS membatasi baris, bukan kolom. Grant di bawah hanya membuka email,
-- client_name, dan bio; kolom id/role/created_at tetap tidak bisa diubah.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (email, client_name, bio) on public.profiles to authenticated;

-- 3. Tabel budgets
create table if not exists public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  amount numeric(15, 2) not null check (amount > 0),
  period text not null default 'monthly' check (period in ('monthly', 'weekly', 'yearly')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, category, period)
);

alter table public.budgets enable row level security;

drop policy if exists "Users can view own budgets" on public.budgets;
create policy "Users can view own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

drop policy if exists "Members and Admins can insert own budgets" on public.budgets;
create policy "Members and Admins can insert own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

drop policy if exists "Members and Admins can update own budgets" on public.budgets;
create policy "Members and Admins can update own budgets"
  on public.budgets for update
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

drop policy if exists "Members and Admins can delete own budgets" on public.budgets;
create policy "Members and Admins can delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

create index if not exists idx_budgets_user on public.budgets(user_id);
