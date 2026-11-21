-- Lapisan sosial stashinmeid: feed postingan + obrolan antar pengguna.
-- Jalankan sekali di Supabase SQL Editor. Idempotent.

-- Feed: postingan singkat, feed menampilkan semua pengguna (v1 terbuka).
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Obrolan 1-on-1: pesan langsung antara dua pengguna.
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

-- Privileges: di project ini default privileges tidak otomatis memberi grant
-- ke tabel baru, jadi eksplisit di sini (idempotent).
grant usage on schema public to anon, authenticated, service_role;
grant all on public.social_posts, public.social_messages
  to anon, authenticated, service_role;

-- RLS: aplikasi berbicara lewat service role (API route), tapi policies
-- ini tetap dipasang supaya akses langsung dari klien juga aman.
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
