import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from '@/lib/supabase/project';

export async function createClient() {
  const url = resolveSupabaseUrl();
  const key = resolveSupabaseAnonKey();

  if (!url || !key) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component context
        }
      },
    },
  });
}
