import { createBrowserClient } from '@supabase/ssr';
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from '@/lib/supabase/project';

export function createClient() {
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseAnonKey();

  if (!url || !key) {
    return null;
  }

  return createBrowserClient(url, key);
}
