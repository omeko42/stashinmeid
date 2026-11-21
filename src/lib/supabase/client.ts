import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/project';

export function createClient() {
  // Env var tetap diprioritaskan kalau di-set (override), tapi kalau tidak
  // ada, pakai konstanta di repo. Supaya ganti project tidak wajib
  // menyetel environment variable di hosting.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createBrowserClient(url, key);
}
