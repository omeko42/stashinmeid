import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import {
  getAcceptedConnectionIds,
  notifyMany,
} from '@/lib/notifications';

/**
 * Feed postingan (tabel social_posts). V1 terbuka: semua pengguna
 * terautentikasi melihat semua postingan, urut terbaru.
 *
 * GET  -> 50 postingan terakhir + profil penulis
 * POST { body } -> posting baru
 */
async function requireUserId() {
  return getCallerUserId();
}

/** Profil penulis: embed FK ke auth.users tidak tersedia untuk profiles,
 * jadi ambil terpisah (pola yang sama dengan /api/kolega). */
async function getAuthors(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  ids: string[]
) {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return new Map<string, { client_name: string; avatar_url: string | null }>();
  const { data, error } = await admin
    .from('profiles')
    .select('id, client_name, avatar_url')
    .in('id', uniq);
  if (error) return null;
  return new Map((data ?? []).map((p) => [p.id, p]));
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const { data, error } = await admin
    .from('social_posts')
    .select('id, author_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const authors = await getAuthors(admin, (data ?? []).map((p) => p.author_id));
  if (!authors) return NextResponse.json({ error: 'Gagal memuat profil penulis' }, { status: 400 });

  const posts = (data ?? []).map((p) => {
    const profile = authors.get(p.author_id);
    return {
      id: p.id,
      authorId: p.author_id,
      body: p.body,
      createdAt: p.created_at,
      author: {
        id: p.author_id,
        client_name: profile?.client_name ?? 'Pengguna',
        avatar_url: profile?.avatar_url ?? null,
      },
    };
  });

  return NextResponse.json({ posts, meId: userId });
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const payload = (await request.json().catch(() => null)) as { body?: string } | null;
  const body = payload?.body?.trim();
  if (!body || body.length > 2000) {
    return NextResponse.json({ error: 'Postingan tidak valid' }, { status: 400 });
  }

  const { data: inserted, error } = await admin
    .from('social_posts')
    .insert({ author_id: userId, body })
    .select('id, author_id, body, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const authors = await getAuthors(admin, [inserted.author_id]);
  const profile = authors?.get(inserted.author_id);
  const authorName = profile?.client_name ?? 'Pengguna';

  // Kabari kolega yang sudahaccepted ada posting baru di feed.
  //
  // Hanya kolega (bukan semua user) - supaya notifikasi tidak jadi
  // bising. Kalau user tidak punya kolega, tidak ada yang dikabari.
  const connectionIds = await getAcceptedConnectionIds(admin, userId);
  if (connectionIds.length) {
    await notifyMany(
      admin,
      connectionIds,
      userId,
      'feed_post',
      'Postingan baru di feed',
      `${authorName} memposting sesuatu.`,
      'tab:social:feed',
      userId
    );
  }

  return NextResponse.json({
    post: {
      id: inserted.id,
      authorId: inserted.author_id,
      body: inserted.body,
      createdAt: inserted.created_at,
      author: {
        id: inserted.author_id,
        client_name: authorName,
        avatar_url: profile?.avatar_url ?? null,
      },
    },
  });
}
