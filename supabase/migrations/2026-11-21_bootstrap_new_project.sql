-- ==========================================================
-- BOOTSTRAP SUPABASE BARU (project kosong)
-- Jalankan SELURUH isi file ini di Supabase SQL Editor untuk setup dari nol.
-- Gabungan lengkap: skema inti + profiles/media + accounts/fx + KYC + kolega
-- + storage + Sosial + roles terkini + semua GRANT database.
---- ==========================================================

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
  role text check (role in ('admin', 'user')) not null default 'user',
  created_at timestamptz default now() not null,
  avatar_url text,
  banner_url text,
  primary_currency text not null default 'IDR'
);

-- Role sekarang dua saja: admin / user. Value lama dari metadata signup
-- jangan diterima supaya tak ada user yang dapat viewer/member buntu.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, client_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'client_name', 'Personal'),
    case
      when new.raw_user_meta_data->>'role' in ('admin', 'user')
        then new.raw_user_meta_data->>'role'
      else 'user'
    end
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
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select using (public.get_my_role() = 'admin');

-- Tanpa policy ini, pengguna biasa tidak bisa meng-update profilnya sendiri
-- (hanya admin lewat service role yang bisa).
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- RLS membatasi baris, bukan kolom. Batasi kolom yang bisa diubah oleh
-- role authenticated agar role/id/created_at tidak bisa dimodifikasi.
revoke update on public.profiles from authenticated;
grant update (email, client_name, bio, avatar_url, banner_url, primary_currency)
  on public.profiles to authenticated;

-- Transactions Policies (Client-isolated + RBAC)
drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Members and Admins can insert own transactions" on public.transactions;
create policy "Members and Admins can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

drop policy if exists "Members and Admins can update own transactions" on public.transactions;
create policy "Members and Admins can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

drop policy if exists "Members and Admins can delete own transactions" on public.transactions;
create policy "Members and Admins can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

-- Debts Policies (Client-isolated + RBAC)
drop policy if exists "Users can view own debts" on public.debts;
create policy "Users can view own debts"
  on public.debts for select
  using (auth.uid() = user_id);

drop policy if exists "Members and Admins can insert own debts" on public.debts;
create policy "Members and Admins can insert own debts"
  on public.debts for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

drop policy if exists "Members and Admins can update own debts" on public.debts;
create policy "Members and Admins can update own debts"
  on public.debts for update
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

drop policy if exists "Members and Admins can delete own debts" on public.debts;
create policy "Members and Admins can delete own debts"
  on public.debts for delete
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

-- Budgets Policies (Client-isolated + RBAC)
drop policy if exists "Users can view own budgets" on public.budgets;
create policy "Users can view own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

drop policy if exists "Members and Admins can insert own budgets" on public.budgets;
create policy "Members and Admins can insert own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

drop policy if exists "Members and Admins can update own budgets" on public.budgets;
create policy "Members and Admins can update own budgets"
  on public.budgets for update
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

drop policy if exists "Members and Admins can delete own budgets" on public.budgets;
create policy "Members and Admins can delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

-- 6. Indexes
create index if not exists idx_transactions_user_date on public.transactions(user_id, transaction_date desc);
create index if not exists idx_debts_user_status on public.debts(user_id, status);
create index if not exists idx_budgets_user on public.budgets(user_id);

-- 7. Budget per kategori - kolom bio dipakai halaman profil
alter table public.profiles add column if not exists bio text;


-- ==========================================================
-- BAGIAN 2: domain baru (aset, kurs manual, KYC, kolega, storage)
-- ==========================================================

-- Migrasi 2026-11-21 - skema terpisah per domain (poin 5 rancangan DB rapih)
--
-- Jalankan file ini di Supabase SQL Editor. Aman diulang (idempotent):
-- tidak akan merusak data yang sudah ada.
--
-- Domain baru:
--   1. profiles     : + avatar_url, banner_url, primary_currency (ubah profil hidup)
--   2. accounts     : dompet/aset terpisah (bank spesifik, kas, e-wallet, crypto) + mata uang
--   3. fx_rates     : kurs MANUAL per user (1 unit mata uang = rate x mata uang utama)
--   4. kyc_profiles : data KYC terpisah dari profiles
--   5. finance_groups + members : kolega - kolaborasi penuh (ruang keuangan bersama)
--   6. transactions & debts : + group_id (ruang bersama), account_id (aset sumber), currency
--   7. storage buckets : avatars & banners (publik baca)

-- ------------------------------------------------------------------
-- 1. profiles: kolom profil hidup
-- ------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists primary_currency text not null default 'IDR';

-- ------------------------------------------------------------------
-- 2. accounts: dompet/aset
-- ------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  kind text not null default 'bank'
    check (kind in ('bank', 'cash', 'ewallet', 'crypto', 'other')),
  institution text,
  currency text not null default 'IDR',
  balance numeric(18, 2) not null default 0,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.accounts enable row level security;

drop policy if exists "Users can view own accounts" on public.accounts;
create policy "Users can view own accounts"
  on public.accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));

drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts"
  on public.accounts for delete
  using (auth.uid() = user_id);

create index if not exists idx_accounts_user on public.accounts(user_id);

-- ------------------------------------------------------------------
-- 3. fx_rates: kurs manual per user ke mata uang utama
--    rate = 1 unit <currency> nilainya <rate> x mata_uang_utama
-- ------------------------------------------------------------------
create table if not exists public.fx_rates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  currency text not null,
  rate numeric(18, 8) not null check (rate > 0),
  updated_at timestamptz default now() not null,
  unique (user_id, currency)
);

alter table public.fx_rates enable row level security;

drop policy if exists "Users can view own fx rates" on public.fx_rates;
create policy "Users can view own fx rates"
  on public.fx_rates for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own fx rates" on public.fx_rates;
create policy "Users can insert own fx rates"
  on public.fx_rates for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own fx rates" on public.fx_rates;
create policy "Users can update own fx rates"
  on public.fx_rates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own fx rates" on public.fx_rates;
create policy "Users can delete own fx rates"
  on public.fx_rates for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- 4. kyc_profiles: data KYC terpisah
-- ------------------------------------------------------------------
create table if not exists public.kyc_profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  id_number text,
  birth_date date,
  address text,
  phone text,
  occupation text,
  status text not null default 'unverified'
    check (status in ('unverified', 'pending', 'verified')),
  updated_at timestamptz default now() not null
);

alter table public.kyc_profiles enable row level security;

drop policy if exists "Users can view own kyc" on public.kyc_profiles;
create policy "Users can view own kyc"
  on public.kyc_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own kyc" on public.kyc_profiles;
create policy "Users can manage own kyc"
  on public.kyc_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own kyc" on public.kyc_profiles;
create policy "Users can update own kyc"
  on public.kyc_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- 5. kolega: grup keuangan bersama (kolaborasi penuh)
-- ------------------------------------------------------------------
create table if not exists public.finance_groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

create table if not exists public.finance_group_members (
  group_id uuid references public.finance_groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited')),
  created_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

alter table public.finance_groups enable row level security;
alter table public.finance_group_members enable row level security;

-- Helper:Security definer supaya RLS bisa membaca member lintas user.
create or replace function public.is_group_member(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.finance_group_members
    where group_id = g
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_group_editor(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.finance_group_members
    where group_id = g
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'editor')
  );
$$;

-- groups: terlihat oleh pemilik & anggota; kelola = pemilik.
drop policy if exists "Owner and members can view groups" on public.finance_groups;
create policy "Owner and members can view groups"
  on public.finance_groups for select
  using (auth.uid() = owner_id or public.is_group_member(id));

drop policy if exists "Users can create own groups" on public.finance_groups;
create policy "Users can create own groups"
  on public.finance_groups for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Owner can update groups" on public.finance_groups;
create policy "Owner can update groups"
  on public.finance_groups for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Owner can delete groups" on public.finance_groups;
create policy "Owner can delete groups"
  on public.finance_groups for delete
  using (auth.uid() = owner_id);

-- members: anggota grup saling melihat; owner grup mengelola.
drop policy if exists "Members can view group members" on public.finance_group_members;
create policy "Members can view group members"
  on public.finance_group_members for select
  using (auth.uid() = user_id or public.is_group_member(group_id));

drop policy if exists "Owner can add members" on public.finance_group_members;
create policy "Owner can add members"
  on public.finance_group_members for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.finance_groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
  );

drop policy if exists "Owner can update members" on public.finance_group_members;
create policy "Owner can update members"
  on public.finance_group_members for update
  using (
    exists (
      select 1 from public.finance_groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
    or (auth.uid() = user_id and status = 'invited') -- kolega bisa terima undangan
  );

drop policy if exists "Owner can remove members" on public.finance_group_members;
create policy "Owner can remove members"
  on public.finance_group_members for delete
  using (
    exists (
      select 1 from public.finance_groups g
      where g.id = group_id and g.owner_id = auth.uid()
    )
    or auth.uid() = user_id -- kolega bisa keluar sendiri
  );

create index if not exists idx_fgm_user on public.finance_group_members(user_id);

-- ------------------------------------------------------------------
-- 6. transactions & debts: dukungan ruang bersama + aset sumber
--    Policy baru DITAMBAHKAN (gabungan OR dengan policy lama),
--    jadi data pribadi lama tidak terganggu.
-- ------------------------------------------------------------------
alter table public.transactions
  add column if not exists group_id uuid references public.finance_groups(id) on delete set null,
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists currency text;

alter table public.debts
  add column if not exists group_id uuid references public.finance_groups(id) on delete set null;

-- transactions: anggota grup aktif bisa lihat, editor bisa tulis/ubah/hapus.
drop policy if exists "Group members can view shared transactions" on public.transactions;
create policy "Group members can view shared transactions"
  on public.transactions for select
  using (group_id is not null and public.is_group_member(group_id));

drop policy if exists "Group editors can insert shared transactions" on public.transactions;
create policy "Group editors can insert shared transactions"
  on public.transactions for insert
  with check (group_id is not null and public.is_group_editor(group_id));

drop policy if exists "Group editors can update shared transactions" on public.transactions;
create policy "Group editors can update shared transactions"
  on public.transactions for update
  using (group_id is not null and public.is_group_editor(group_id))
  with check (group_id is null or public.is_group_member(group_id) or public.is_group_editor(group_id));

drop policy if exists "Group editors can delete shared transactions" on public.transactions;
create policy "Group editors can delete shared transactions"
  on public.transactions for delete
  using (group_id is not null and public.is_group_editor(group_id));

-- debts: pola sama, hanya di ruang bersama.
drop policy if exists "Group members can view shared debts" on public.debts;
create policy "Group members can view shared debts"
  on public.debts for select
  using (group_id is not null and public.is_group_member(group_id));

drop policy if exists "Group editors can insert shared debts" on public.debts;
create policy "Group editors can insert shared debts"
  on public.debts for insert
  with check (group_id is not null and public.is_group_editor(group_id));

drop policy if exists "Group editors can update shared debts" on public.debts;
create policy "Group editors can update shared debts"
  on public.debts for update
  using (group_id is not null and public.is_group_editor(group_id));

drop policy if exists "Group editors can delete shared debts" on public.debts;
create policy "Group editors can delete shared debts"
  on public.debts for delete
  using (group_id is not null and public.is_group_editor(group_id));

create index if not exists idx_transactions_group on public.transactions(group_id);
create index if not exists idx_debts_group on public.debts(group_id);

-- ------------------------------------------------------------------
-- 7. storage buckets: avatars & banners (baca publik, tulis milik sendiri)
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('banners', 'banners', true)
on conflict (id) do nothing;

drop policy if exists "Own folder insert avatars" on storage.objects;
create policy "Own folder insert avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own folder update avatars" on storage.objects;
create policy "Own folder update avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own folder delete avatars" on storage.objects;
create policy "Own folder delete avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own folder insert banners" on storage.objects;
create policy "Own folder insert banners"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own folder update banners" on storage.objects;
create policy "Own folder update banners"
  on storage.objects for update to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Own folder delete banners" on storage.objects;
create policy "Own folder delete banners"
  on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public read avatars and banners" on storage.objects;
create policy "Public read avatars and banners"
  on storage.objects for select
  using (bucket_id in ('avatars', 'banners'));

-- ==========================================================
-- BAGIAN 3: Sosial (feed + pesan 1-on-1)
-- ==========================================================

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.social_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists social_posts_created_at_idx
  on public.social_posts (created_at desc);
create index if not exists social_posts_author_idx
  on public.social_posts (author_id);
create index if not exists social_messages_sender_created_idx
  on public.social_messages (sender_id, created_at desc);
create index if not exists social_messages_recipient_created_idx
  on public.social_messages (recipient_id, created_at desc);

alter table public.social_posts enable row level security;
alter table public.social_messages enable row level security;

drop policy if exists "posts read authenticated" on public.social_posts;
create policy "posts read authenticated" on public.social_posts
  for select to authenticated using (true);
drop policy if exists "posts insert own" on public.social_posts;
create policy "posts insert own" on public.social_posts
  for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "posts delete own" on public.social_posts;
create policy "posts delete own" on public.social_posts
  for delete to authenticated using (author_id = auth.uid());

drop policy if exists "messages read participants" on public.social_messages;
create policy "messages read participants" on public.social_messages
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "messages insert sender" on public.social_messages;
create policy "messages insert sender" on public.social_messages
  for insert to authenticated with check (sender_id = auth.uid());

-- ==========================================================
-- BAGIAN 3B: Kolega 2-arah, notifikasi, pita pengumuman, audit hapus
-- ==========================================================
-- Dua konsep yang sebelumnya tercampur:
--   - KOLEGA       : pertemanan 2-arah, murni sosial.
--   - GRUP KEUANGAN: pooling transaksi (finance_groups di atas).
--
-- finance_groups tidak diubah - fitur lama tetap jalan sebagai "grup
-- keuangan", sekarang berdiri sendiri dari daftar kolega.

create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  type text not null check (
    type in (
      'connection_requested',
      'connection_accepted',
      'group_member_joined',
      'feed_post',
      'chat_message'
    )
  ),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in (
      'connection_requested',
      'connection_accepted',
      'group_member_joined',
      'feed_post',
      'chat_message'
    )
  ),
  enabled boolean not null default true,
  primary key (user_id, type)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 500),
  created_by uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit penghapusan akun. Sengaja tanpa FK ke auth.users supaya bukti
-- tetap ada setelah user dihapus.
create table if not exists public.account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  client_name text,
  actor_type text not null default 'self' check (actor_type in ('self', 'admin')),
  actor_id uuid,
  scope text not null default 'all' check (scope in ('all', 'profile', 'finance')),
  deleted_counts jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_connections_requester
  on public.user_connections (requester_id, status);
create index if not exists idx_connections_addressee
  on public.user_connections (addressee_id, status);
create index if not exists idx_notifications_recipient
  on public.notifications (recipient_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications (recipient_id) where read_at is null;
create index if not exists idx_announcements_active
  on public.announcements (active, created_at desc);
create index if not exists idx_deletion_audit_user
  on public.account_deletion_audit (user_id, created_at desc);
create index if not exists idx_deletion_audit_created
  on public.account_deletion_audit (created_at desc);

alter table public.user_connections enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.announcements enable row level security;
alter table public.account_deletion_audit enable row level security;

drop policy if exists "Users can view own connections" on public.user_connections;
create policy "Users can view own connections" on public.user_connections
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "Users can create connections" on public.user_connections;
create policy "Users can create connections" on public.user_connections
  for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "Users can update own connections" on public.user_connections;
create policy "Users can update own connections" on public.user_connections
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "Users can delete own connections" on public.user_connections;
create policy "Users can delete own connections" on public.user_connections
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications" on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());

drop policy if exists "Users can view own notification preferences" on public.notification_preferences;
create policy "Users can view own notification preferences" on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences" on public.notification_preferences
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences" on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users can delete own notification preferences" on public.notification_preferences;
create policy "Users can delete own notification preferences" on public.notification_preferences
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Authenticated can view active announcements" on public.announcements;
create policy "Authenticated can view active announcements" on public.announcements
  for select to authenticated using (active = true);

drop policy if exists "Users can view own deletion audit" on public.account_deletion_audit;
create policy "Users can view own deletion audit" on public.account_deletion_audit
  for select to authenticated using (user_id = auth.uid());

-- ==========================================================
-- BAGIAN 4: Privileges (GRANT) — WAJIB agar UI dapat baca/tulis
-- ==========================================================
-- Project Supabase ini tidak otomatis memberi GRANT ke tabel yang dibuat
-- lewat SQL Editor. RLS saja tidak cukup: perlu GRANT + policy.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
  on public.profiles,
     public.transactions,
     public.debts,
     public.budgets,
     public.accounts,
     public.fx_rates,
     public.kyc_profiles,
     public.finance_groups,
     public.finance_group_members
  to authenticated, service_role;

grant select, insert, update, delete
  on public.social_posts, public.social_messages
  to authenticated, service_role;

grant select, insert, update, delete
  on public.user_connections,
     public.notifications,
     public.notification_preferences,
     public.announcements,
     public.account_deletion_audit
  to authenticated, service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;

-- Profiles: batasi update hanya ke kolom profil yang boleh diedit user.
-- Jangan grant UPDATE seluruh tabel karena kolom `role` adalah privilege boundary.
revoke update on public.profiles from authenticated;
grant update (email, client_name, bio, avatar_url, banner_url, primary_currency)
  on public.profiles to authenticated;

-- Helper: buat notifikasi sambil menghormati preferensi user.
create or replace function public.create_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_enabled boolean;
begin
  if p_recipient_id = p_actor_id then
    return null;
  end if;

  select enabled into v_enabled
  from public.notification_preferences
  where user_id = p_recipient_id and type = p_type;

  if coalesce(v_enabled, true) = false then
    return null;
  end if;

  insert into public.notifications
    (recipient_id, actor_id, type, title, body, link)
  values
    (p_recipient_id, p_actor_id, p_type, p_title, p_body, p_link)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_notification(uuid, uuid, text, text, text, text) from public;
grant execute on function public.create_notification(uuid, uuid, text, text, text, text)
  to authenticated, service_role;

