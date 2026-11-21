-- ==========================================================
-- Migrasi 2026-11-22 - trigger profil untuk pendaftaran via OAuth
-- ==========================================================
-- Jalankan di Supabase SQL Editor. Aman diulang (idempotent).
--
-- Masalah yang diperbaiki
-- ---------------------
-- Pendaftaran lewat Google (atau OAuth lain) tidak mengirim
-- `client_name` di raw_user_meta_data - yang terkirim hanya `full_name`
-- dan `name`. Akibatnya trigger handle_new_user() membuat profil dengan
-- client_name = 'Personal', walapun user sudah memberikan namanya.
--
-- Perbaikan: pakai full_name / name sebagai fallback, lalu nama yang
-- bagian dari email sebagai fallback terakhir.
--
-- CATATAN: trigger aslinya memakai `new.email` yang bisa NULL kalau user
-- menolak share email ke aplikasi. Di sini dijaga supaya insert tidak
-- gagal (kolom email NOT NULL).
-- ==========================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, client_name, role, bio)
  values (
    new.id,
    coalesce(
      new.email,
      split_part(coalesce(new.raw_user_meta_data->>'email', ''), '@', 1) || '@oauth.local'
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'client_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, new.raw_user_meta_data->>'email', 'user'), '@', 1),
      'Personal'
    ),
    case
      when new.raw_user_meta_data->>'role' in ('admin', 'user')
        then new.raw_user_meta_data->>'role'
      else 'user'
    end,
    nullif(new.raw_user_meta_data->>'bio', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger-nya sendiri sudah ada dari bootstrap; drop lalu recreate
-- supaya pasti terpasang versi terbaru.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
