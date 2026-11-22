/**
 * Konfigurasi Supabase publik - aman di-commit.
 *
 * Kenapa constant, bukan env var?
 * ------------------------------
 * `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sama
 * sekali bukan rahasia - keduanya memang dikirim ke browser. Menaruhnya
 * di repo membuat konfigurasi ikut ter-deploy otomatis tanpa harus
 * menyetel environment variable di hosting tiap kali project Supabase
 * diganti.
 *
 * Yang tetap WAJIB ada di environment variable (tidak boleh di-commit):
 *   - SUPABASE_SERVICE_ROLE_KEY  : bypass RLS dan pengingat JWT. Jangan
 *                                   pernah masuk repo.
 *   - SUPERADMIN_PASSWORD(_HASH) : kredensial login superadmin.
 *   - JWT_SECRET                : kunci tanda tangan session.
 */

/** URL project Supabase. */
export const SUPABASE_URL = 'https://zykqeucsrldzvzxmyplq.supabase.co';

/**
 * Anon / publishable key.
 *
 * Aman dipublikasikan: key ini dibatasi oleh RLS, jadi user hanya bisa
 * membaca baris miliknya sendiri.
 */
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5a3FldWNzcmxkenZ6eG15cGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNDIxODAsImV4cCI6MjExMDgxODE4MH0.zlH9Inwq0x6n1VQP4Trplg6bSf2pnp214E1xMsjndnc';

/**
 * Resolve URL Supabase dengan validasi ketat.
 *
 * Jika env `NEXT_PUBLIC_SUPABASE_URL` salah isi (mis. tertukar dengan
 * publishable key `sb_publishable_...` atau ada newline), jangan teruskan
 * ke `createClient()` yang akan melempar `Invalid supabaseUrl` dan membuat
 * seluruh SSR crash (React #441). Fallback aman ke `SUPABASE_URL`.
 */
export function resolveSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (raw && /^https?:\/\/[^/\s]+/i.test(raw)) {
    try {
      new URL(raw);
      return raw;
    } catch {
      // Fall through ke konstanta default yang valid.
    }
  }
  return SUPABASE_URL;
}

/**
 * Resolve anon/publishable key Supabase.
 * Bersihkan whitespace/newline dan fallback ke `SUPABASE_ANON_KEY` jika invalid.
 */
export function resolveSupabaseAnonKey(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (raw && !/[\r\n\s]/.test(raw) && !raw.startsWith('<')) {
    return raw;
  }
  return SUPABASE_ANON_KEY;
}

/**
 * Resolve service role key (khusus sisi server).
 * Mengembalikan null jika belum diset atau formatnya jelas tidak valid.
 */
export function resolveServiceRoleKey(): string | null {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!raw || /[\r\n\s]/.test(raw) || raw.startsWith('<')) {
    return null;
  }
  return raw;
}
