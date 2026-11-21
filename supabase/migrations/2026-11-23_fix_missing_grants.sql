-- Migrasi 2026-11-23 - perbaiki GRANT yang hilang (BUG: UI tidak terhubung DB)
--
-- Jalankan file ini di Supabase SQL Editor. Aman diulang (idempotent):
-- tidak akan merusak data yang sudah ada.
--
-- BUG YANG DIPERBAIKI
-- ------------------
-- Tabelnya sudah ADA semua (profiles, transactions, debts, budgets, accounts,
-- fx_rates, kyc_profiles, finance_groups, finance_group_members) dan RLS-nya
-- juga sudah ada. Yang TIDAK ADA adalah hak akses (GRANT) untuk role
-- `authenticated`.
--
-- Di project ini default privileges Supabase tidak otomatis memberi grant ke
-- tabel yang dibuat lewat SQL Editor, jadi tabel yang dibuat sebelum
-- migration 2026-11-22 (social) tidak pernah dapat akses. Akibatnya:
--   - UI tidak bisa membaca data  -> "permission denied for table X"
--   - UI tidak bisa menulis data  -> update diam-diam gagal, user tetap
--                                     melihat toast "berhasil disimpan"
--
-- Grant untuk social_posts / social_messages sudah ada di migration
-- 2026-11-22, jadi file ini tidak perlu menyentuhnya lagi (tapi aman diulang).
--
-- CARA PAKAI
-- ---------
-- 1. Buka project Supabase -> SQL Editor -> New query
-- 2. Paste seluruh isi file ini
-- 3. Klik Run
-- 4. Refresh aplikasi. Data di profile, transaksi, pinjaman, pagu anggaran,
--    dompet, dan kurs akan langsung terbaca dan bisa diubah.

-- ------------------------------------------------------------------
-- 1. Usage schema
--    Tanpa ini, role authenticated tidak bisa menyentuh objek di schema public.
-- ------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------------------------
-- 2. Hak akses tabel
--
--    SELECT    : UI perlu untuk membaca dan menampilkan data
--    INSERT    : menambah transaksi / pinjaman / pagu / dompet
--    UPDATE    : mengubah profil, status pinjaman, saldo dompet, kurs
--    DELETE    : menghapus transaksi / pinjaman / pagu / dompet
--
--    Catatan: tabel `profiles` memakai kolom `id` sebagai foreign key ke
--    auth.users, tabel lain memakai `user_id`. Keduanya sudah ditangani RLS
--    di migration masing-masing, jadi grant di sini cukup untuk memberi
--    hak akses - batas baris tetap dijaga RLS.
--
--    Pakai DO block + to_regclass supaya tabel yang belum ada (mis. belum
--    dijalankan migration accounts/social) tidak menggagalkan seluruh file.
-- ------------------------------------------------------------------
do $$
declare
  t text;
  tbls text[] := array[
    'profiles', 'transactions', 'debts', 'budgets', 'accounts', 'fx_rates',
    'kyc_profiles', 'finance_groups', 'finance_group_members',
    'social_posts', 'social_messages'
  ];
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'grant select, insert, update, delete on public.%I to authenticated, service_role',
        t
      );
      raise notice 'grant diberikan untuk tabel public.%', t;
    else
      raise warning 'tabel public.% belum ada, dilewati (jalankan migration terkait dulu)', t;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 3. Sequence
--    Tabel dengan kolom id serial / identity butuh hak akses sequence,
--    kalau tidak insert akan gagal dengan "permission denied for sequence".
-- ------------------------------------------------------------------
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ------------------------------------------------------------------
-- 4. Grant kolom untuk profiles
--
--    Update ke `profiles` dibatasi per-kolom, bukan per-tabel. Ini disengaja:
--    tanpa pembatasan, user biasa bisa meng-update kolom `role` (menaikkan
--    hak aksesnya jadi admin) atau `id` (mengganti primary key).
--
--    Kolom yang boleh diubah user: nama workspace, bio, email, avatar, banner,
--    dan mata uang utama.
--
--    Hanya kolom yang benar-benar ada yang di-grant, supaya file ini tetap
--    jalan kalau migration accounts belum pernah dijalankan.
-- ------------------------------------------------------------------
do $$
declare
  c text;
  cols text[] := array[
    'email', 'client_name', 'bio', 'avatar_url', 'banner_url', 'primary_currency'
  ];
  present text := '';
begin
  if to_regclass('public.profiles') is null then
    raise warning 'tabel public.profiles belum ada, dilewati';
    return;
  end if;

  revoke update on public.profiles from authenticated;

  foreach c in array cols loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = c
    ) then
      present := present || quote_ident(c) || ', ';
    end if;
  end loop;

  if present = '' then
    raise warning 'tidak ada kolom profil yang perlu di-grant';
    return;
  end if;

  present := rtrim(present, ', ');
  execute format(
    'grant update (%s) on public.profiles to authenticated', present
  );
  raise notice 'grant update kolom profiles diberikan untuk: %', present;
end $$;

-- ------------------------------------------------------------------
-- 5. Verifikasi (opsional)
--    Jalankan query ini setelah Run untuk memastikan grant sudah berlaku:
--
--    select table_name, privilege_type
--    from information_schema.role_table_grants
--    where grantee = 'authenticated'
--      and table_schema = 'public'
--    order by table_name, privilege_type;
--
--    Yang diharapkan: tiap tabel punya 4 baris (SELECT, INSERT, UPDATE, DELETE).
-- ------------------------------------------------------------------
