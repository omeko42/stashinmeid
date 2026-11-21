-- Migrasi 2026-11-21 - sederhanakan role jadi 2: admin & user
-- (sebelumnya: admin / member / viewer)
--
-- Jalankan di Supabase SQL Editor. Idempotent (aman diulang).

-- 1. Baris lama 'member' / 'viewer' jadi 'user' (sebelum ganti constraint).
update public.profiles set role = 'user' where role in ('member', 'viewer');

-- 2. Constraint role hanya 2 pilihan.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'user'));

-- 3. Trigger signup: default role 'user'.
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

-- 4. Policies yang menyaring role: 'member' -> 'user'.
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

drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts"
  on public.accounts for insert
  with check (auth.uid() = user_id and public.get_my_role() in ('admin', 'user'));
