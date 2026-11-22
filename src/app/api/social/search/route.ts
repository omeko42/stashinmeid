import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';

/**
 * Pencarian akun untuk lapisan sosial (kolega, obrolan).
 *
 * Cari pengguna berdasarkan nama atau email.$email hanya dicocokkan
 * utuh supaya seseorang tidak bisa menghitung email pengguna lain dari
 * substring.
 */
export async function GET(request: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const q = (request.nextUrl.searchParams.get('q') || '').trim();

  let query = admin
    .from('profiles')
    .select('id, client_name, avatar_url, email, bio, role')
    .neq('id', userId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (q.length >= 1) {
    // Cari berdasarkan nama workspace, username (bagian email), atau email
    const safeQ = q.replace(/[,%()]/g, '');
    query = query.or(`client_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
  }

  const { data: users, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const safe = (users ?? []).map((u) => {
    const username = u.email ? u.email.split('@')[0] : 'user';
    return {
      id: u.id,
      client_name: u.client_name,
      username,
      bio: u.bio || null,
      role: u.role,
      avatar_url: u.avatar_url,
      emailMasked: u.email
        ? u.email.replace(/^(..).*(@.*)$/, '$1***$2')
        : null,
    };
  });

  return NextResponse.json({ users: safe });
}
