import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/project';

/**
 * Verifikasi password user dengan meniru percobaan login.
 *
 * Cara ini dipakai untuk destructive action (hapus akun): kalau passwordnya
 * benar, Supabase memang akan memberi session. Kalau salah, ditolak.
 *
 * Client-nya pakai anon key dan `persistSession: false`, jadi session
 * hasil percobaan ini tidak nyangkut di mana pun dan tidak mengganggu
 * session user yang sedang login.
 */
export async function verifyUserPassword(
  email: string,
  password: string
): Promise<{ valid: boolean; reason?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { valid: false, reason: 'Supabase belum dikonfigurasi.' };
  }

  if (!password) {
    return { valid: false, reason: 'Password kosong.' };
  }

  try {
    const client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return {
        valid: false,
        reason: error?.message || 'Password salah.',
      };
    }

    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      reason: e instanceof Error ? e.message : 'Gagal memverifikasi password.',
    };
  }
}
