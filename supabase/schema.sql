-- Stashinme Personal Finance Schema (Multi-Client + RBAC) for Supabase
-- Run this in your Supabase SQL Editor
--
-- PERINGATAN: file ini aman dipublikasikan - tidak berisi secret.
-- Nilai service_role / anon key TIDAK boleh ditulis di sini.

-- 1. Profiles Table (Multi-Client Isolation & RBAC)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  client_name text not null default 'Personal',
  bio text,
  role text check (role in ('admin', 'member', 'viewer')) not null default 'member',
  created_at timestamptz default now() not null
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, client_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'client_name', 'Personal'),
    coalesce(new.raw_user_meta_data->>'role', 'member')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Transactions Table (Real Inflow & Outflow)
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text check (type in ('inflow', 'outflow')) not null,
  amount numeric(15, 2) not null check (amount > 0),
  category text not null,
  description text,
  transaction_date date not null default current_date,
  source text default 'manual', -- 'manual' | 'ai_scan' | 'debt_payment' | 'import'
  created_at timestamptz default now() not null
);

-- 3. Debts Table (Pinjaman, PayLater, Cicilan)
create table if not exists public.debts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text not null,
  contract_no text,
  total_tenor integer,
  remaining_tenor integer,
  due_day integer check (due_day between 1 and 31),
  remaining_balance numeric(15, 2) not null default 0,
  monthly_installment numeric(15, 2) not null default 0,
  status text check (status in ('active', 'paid_off')) default 'active' not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. Budgets Table (Pagu bulanan per kategori)
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

-- 5. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.debts enable row level security;
alter table public.budgets enable row level security;

-- Helper function to check user role
create or replace function public.get_my_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Profiles Policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles"
  on public.profiles for select using (public.get_my_role() = 'admin');

-- Tanpa policy ini, pengguna biasa tidak bisa meng-update profilnya sendiri
-- (hanya admin lewat service role yang bisa).
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- RLS membatasi baris, bukan kolom. Batasi kolom yang bisa diubah oleh
-- role authenticated agar role/id/created_at tidak bisa dimodifikasi.
revoke update on public.profiles from authenticated;
grant update (email, client_name, bio) on public.profiles to authenticated;

-- Transactions Policies (Client-isolated + RBAC)
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Members and Admins can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

create policy "Members and Admins can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

create policy "Members and Admins can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

-- Debts Policies (Client-isolated + RBAC)
create policy "Users can view own debts"
  on public.debts for select
  using (auth.uid() = user_id);

create policy "Members and Admins can insert own debts"
  on public.debts for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

create policy "Members and Admins can update own debts"
  on public.debts for update
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

create policy "Members and Admins can delete own debts"
  on public.debts for delete
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

-- Budgets Policies (Client-isolated + RBAC)
create policy "Users can view own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Members and Admins can insert own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

create policy "Members and Admins can update own budgets"
  on public.budgets for update
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

create policy "Members and Admins can delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'member'));

-- 6. Indexes
create index if not exists idx_transactions_user_date on public.transactions(user_id, transaction_date desc);
create index if not exists idx_debts_user_status on public.debts(user_id, status);
create index if not exists idx_budgets_user on public.budgets(user_id);

-- 7. Budget per kategori - kolom bio dipakai halaman profil
alter table public.profiles add column if not exists bio text;
