import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/supabase/project';

export function createAdminClient() {
  // Service role key TIDAK bisa di-commit - ini bypass RLS. Jadi dia tetap
  // wajib ada di environment variable.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
