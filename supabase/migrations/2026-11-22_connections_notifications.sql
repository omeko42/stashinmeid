-- ==========================================================
-- Migrasi 2026-11-22 - kolega 2-arah, notifikasi, audit
-- ==========================================================
--
-- Jalankan di Supabase SQL Editor. Aman diulang (idempotent).
--
-- Konteks
-- --------
-- Sebelumnya "kolega" = anggota finance_group, dan anggota grup otomatis
-- bisa melihat transaksi bersama. Itu membuat user yang hanya ingin
-- bersosialisasi ikut terlihat datanya.
--
-- Sekarang dua konsep dipisah:
--   - KOLEGA      : pertemanan 2-arah, murni sosial. Tidak ada akses ke
--                   data keuangan satu sama lain.
--   - GRUP KEUANGAN: pooling transaksi, seperti sebelumnya (finance_groups).
--
-- Tabel finance_groups / finance_group_members TIDAK diubah - fitur lama
-- tetap jalan, sekarang berdiri sendiri sebagai "grup keuangan".
--
-- CARA PAKAI
-- ---------
-- 1. Supabase > SQL Editor > New query
-- 2. Paste seluruh isi file ini
-- 3. Klik Run
-- 4. Jalankan juga supabase/migrations/2026-11-23_fix_missing_grants.sql
--    supaya tabel baru punya hak akses untuk role `authenticated`.
-- ==========================================================


-- ------------------------------------------------------------------
-- 1. Kolega (pertemanan 2-arah)
--
-- `requester_id` = yang mengirim permintaan, `addressee_id` = yang menerima.
-- Keduanya user yang saling terhubung setelah status = 'accepted'.
--
-- Status:
--   pending   - permintaan dikirim, belum dijawab
--   accepted  - sudah saling berteman
--   blocked   - ditolak atau diblokir (disembunyikan dari daftar)
-- ------------------------------------------------------------------
create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,

  -- Dua orang tidak bisa punya dua baris untuk pasangan yang sama.
  unique (requester_id, addressee_id),
  -- Seseorang tidak bisa mengundiri dirinya sendiri.
  check (requester_id <> addressee_id)
);

-- Pencarian koneksi satu user cepat dari dua arah (yang saya cari, dan
-- yang mengundiri saya).
create index if not exists idx_connections_requester
  on public.user_connections (requester_id, status);
create index if not exists idx_connections_addressee
  on public.user_connections (addressee_id, status);

-- ------------------------------------------------------------------
-- 2. Notifikasi
--
-- Satu baris per peristiwa. `recipient_id` = yang menerima notifikasi.
-- `actor_id` = yang memicu (bisa null kalau peristiwa sistem).
--
-- Tipe yang dipakai:
--   connection_requested  - A mengirim permintaan kolega ke B
--   connection_accepted   - B menerima permintaan A
--   group_member_joined   - ada anggota baru di grup keuangan
--   feed_post             - ada orang yang posting di feed
--   chat_message          - ada pesan baru
-- ------------------------------------------------------------------
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
  -- Isi singkat yang sudah diformat, supaya UI tidak perlu tahu
  -- struktur data per tipe.
  title text not null,
  body text,
  -- Link tujuan (mis. ke tab sosial atau ke halaman tertentu).
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient
  on public.notifications (recipient_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications (recipient_id) where read_at is null;

-- ------------------------------------------------------------------
-- 3. Preferensi notifikasi per user
--
-- Satu baris per user per tipe notifikasi. Kalau baris tidak ada, pakai
-- default (true = aktif).
-- ------------------------------------------------------------------
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

-- ------------------------------------------------------------------
-- 4. Pita pengumuman (announcement)
--
-- Dikelola superadmin lewat pengaturan. Baris aktif ditampilkan di
-- pita berjalan di atas dashboard.
-- ------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 500),
  -- Superadmin yang membuat, nullable kalau admin dihapus.
  created_by uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_active
  on public.announcements (active, created_at desc);

-- ------------------------------------------------------------------
-- 5. Audit penghapusan akun
--
-- Dicatat saat user menghapus akunnya sendiri (atau admin menghapusnya).
-- Tujuannya: kalau nanti ada klaim "data saya dihapus sistem", ada bukti
-- kapan, oleh siapa, dan apa yang dihapus.
--
-- Baris ini SENGAJA tidak punya foreign key ke auth.users - kalau user
-- dihapus, audit-nya harus tetap ada.
-- ------------------------------------------------------------------
create table if not exists public.account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  -- Id user yang dihapus (disimpan sebagai teks supaya tidak hilang
  -- kalau user di-hard-delete).
  user_id uuid not null,
  email text,
  client_name text,
  -- 'self' = user menghapus sendiri, 'admin' = superadmin menghapus.
  actor_type text not null default 'self' check (actor_type in ('self', 'admin')),
  actor_id uuid,
  -- 'all' = semua data ikut terhapus, 'profile' = profil disimpan.
  scope text not null default 'all' check (scope in ('all', 'profile', 'finance')),
  -- Ringkasan jumlah baris yang dihapus per tabel.
  deleted_counts jsonb not null default '{}'::jsonb,
  -- Alasan dari user (opsional).
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deletion_audit_user
  on public.account_deletion_audit (user_id, created_at desc);
create index if not exists idx_deletion_audit_created
  on public.account_deletion_audit (created_at desc);


-- ------------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------------

alter table public.user_connections enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.announcements enable row level security;
alter table public.account_deletion_audit enable row level security;

-- user_connections: hanya yang terlibat boleh melihat.
drop policy if exists "Users can view own connections" on public.user_connections;
create policy "Users can view own connections"
  on public.user_connections
  for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Yang mengirim boleh membuat koneksi.
drop policy if exists "Users can create connections" on public.user_connections;
create policy "Users can create connections"
  on public.user_connections
  for insert
  to authenticated
  with check (requester_id = auth.uid());

-- Yang terlibat boleh mengubah status (mis. menerima atau menolak).
drop policy if exists "Users can update own connections" on public.user_connections;
create policy "Users can update own connections"
  on public.user_connections
  for update
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

-- Yang terlibat boleh menghapus (unfriend / batalkan).
drop policy if exists "Users can delete own connections" on public.user_connections;
create policy "Users can delete own connections"
  on public.user_connections
  for delete
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- notifications: hanya penerima yang boleh baca dan tandai terbaca.
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications
  for delete
  to authenticated
  using (recipient_id = auth.uid());

-- notification_preferences: hanya untuk diri sendiri.
drop policy if exists "Users can view own notification preferences" on public.notification_preferences;
create policy "Users can view own notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own notification preferences" on public.notification_preferences;
create policy "Users can delete own notification preferences"
  on public.notification_preferences
  for delete
  to authenticated
  using (user_id = auth.uid());

-- announcements: semua user login boleh baca yang aktif.
drop policy if exists "Authenticated can view active announcements" on public.announcements;
create policy "Authenticated can view active announcements"
  on public.announcements
  for select
  to authenticated
  using (active = true);

-- account_deletion_audit: user boleh lihat audit miliknya sendiri.
drop policy if exists "Users can view own deletion audit" on public.account_deletion_audit;
create policy "Users can view own deletion audit"
  on public.account_deletion_audit
  for select
  to authenticated
  using (user_id = auth.uid());


-- ------------------------------------------------------------------
-- 7. Helper: buat notifikasi
--
-- Dipakai dari API route (service role). Menghormati preferensi user:
-- kalau user mematikan notifikasi untuk tipe itu, tidak dibuat.
--
-- Dipakai juga dari sisi client (authenticated) - makanya RLS insert
-- diizinkan untuk actor_id = auth.uid() atau null.
-- ------------------------------------------------------------------
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
  -- Jangan kirim ke diri sendiri.
  if p_recipient_id = p_actor_id then
    return null;
  end if;

  -- Cek preferensi (default aktif kalau barisnya tidak ada).
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
