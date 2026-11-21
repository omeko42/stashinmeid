-- ==========================================================
-- VERIFIKASI GRANT & KESIAPAN DATABASE (read-only)
-- ==========================================================
-- Jalankan di Supabase SQL Editor untuk project yang SEDANG DIPAKAI.
-- Query ini tidak mengubah apa pun - hanya melaporkan.
--
-- Cara baca hasil:
--   - Setiap tabel aplikasi harus punya 4 baris: SELECT, INSERT, UPDATE, DELETE
--     dengan grantee = 'authenticated'.
--   - Tabel `profiles` hanya boleh punya UPDATE dengan daftar kolom, bukan
--     UPDATE penuh - itu yang mencegah user biasa menaikkan role-nya.
--   - Kolom 'Total' = 11 kalau semua beres.
-- ==========================================================

-- 1. Hak akses tabel per role
select
  table_name,
  grantee,
  string_agg(distinct privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'profiles','transactions','debts','budgets','accounts','fx_rates',
    'kyc_profiles','finance_groups','finance_group_members',
    'social_posts','social_messages'
  )
  and grantee in ('authenticated','anon','service_role')
group by table_name, grantee
order by table_name, grantee;

-- 2. Rakeupan: tabel mana yang belum punya grant untuk 'authenticated'
select
  c.relname as table_name,
  case when g.granted is null then 'HILANG - wajib di-grant' else 'ok' end as status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select c2.relname as relname, true as granted
  from pg_class c2
  join pg_namespace n2 on n2.oid = c2.relnamespace
  join information_schema.role_table_grants g2
    on g2.table_name = c2.relname and g2.grantee = 'authenticated'
  where n2.nspname = 'public'
) g on g.relname = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles','transactions','debts','budgets','accounts','fx_rates',
    'kyc_profiles','finance_groups','finance_group_members',
    'social_posts','social_messages'
  )
order by status desc, table_name;

-- 3. Update pada profiles harus per-kolom (bukan update penuh)
select
  table_name,
  grantee,
  privilege_type,
  column_name
from information_schema.column_table_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and privilege_type = 'UPDATE'
order by grantee, column_name;

-- 4. Role yang ada (harus ada 'authenticated')
select rolname, rolcanlogin
from pg_roles
where rolname in ('anon','authenticated','service_role','postgres')
order by rolname;

-- 5. Constraint role profiles (harus 'admin' dan 'user' saja)
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname like '%role%';

-- 6. Jumlah user yang sudah terdaftar
select count(*) as jumlah_user from auth.users;

-- 7. Baris per tabel (untuk memastikan data masuk)
select 'profiles' as tabel, count(*) from public.profiles
union all select 'transactions', count(*) from public.transactions
union all select 'debts', count(*) from public.debts
union all select 'budgets', count(*) from public.budgets
union all select 'accounts', count(*) from public.accounts
union all select 'fx_rates', count(*) from public.fx_rates
union all select 'social_posts', count(*) from public.social_posts
union all select 'social_messages', count(*) from public.social_messages
order by tabel;
