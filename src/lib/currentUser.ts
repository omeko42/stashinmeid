import { cookies } from 'next/headers';
import { verifySuperadminToken } from '@/lib/jwt';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';

/**
 * Identitas pemanggil API yang dipakai lintas route.
 *
 * 1. Sesi Supabase dulu (login normal).
 * 2. Kalau kosong, sesi Superadmin (cookie stashinme_session): impersonate
 *    = bertindak sebagai user target; tanpa impersonate = user superadmin
 *    sendiri. Sama dengan pola /api/superadmin/finance.
 *
 * Tanpa ini, superadmin yang login via dashboard terkena 401 di API yang
 * hanya menerima supabase.auth.getUser() (kolega, sosial).
 */
export async function getCallerUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (supabase) {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return data.user.id;
  }

  const cookieStore = await cookies();
  const session = await verifySuperadminToken(
    cookieStore.get('stashinme_session')?.value
  );
  if (!session) return null;

  return session.impersonateUserId ?? getOrCreateSuperadminUserId();
}
