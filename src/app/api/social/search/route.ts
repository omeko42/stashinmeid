import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Pencarian akun untuk lapisan sosial (kolega, obrolan).
 *
 * Cari pengguna berdasarkan nama atau email.$email hanya dicocokkan
 * utuh supaya seseorang tidak bisa menghitung email pengguna lain dari
 * substring.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };
  const userId = data?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const isFullEmail = q.includes('@') && q.includes('.');

  let query = admin
    .from('profiles')
    .select('id, client_name, avatar_url, email')
    .neq('id', userId)
    .limit(10);

  query = isFullEmail
    ? query.ilike('email', q)
    : query.ilike('client_name', `%${q}%`);

  const { data: users, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Email disembunyikan sebagian - pesan antarpengguna tidak butuh email.
  const safe = (users ?? []).map((u) => ({
    id: u.id,
    client_name: u.client_name,
    avatar_url: u.avatar_url,
    emailMasked: u.email
      ? u.email.replace(/^(.).*(@.*)$/, '$1***$2')
      : null,
  }));

  return NextResponse.json({ users: safe });
}
