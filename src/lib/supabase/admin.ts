import { createClient } from '@supabase/supabase-js';
import { resolveServiceRoleKey, resolveSupabaseUrl } from '@/lib/supabase/project';

export function createAdminClient() {
  // Service role key TIDAK bisa di-commit - ini bypass RLS. Jadi dia tetap
  // wajib ada di environment variable.
  const url = resolveSupabaseUrl();
  const serviceKey = resolveServiceRoleKey();

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
