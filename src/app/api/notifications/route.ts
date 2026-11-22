import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';

/**
 * Notifikasi.
 *
 * GET    : daftar notifikasi saya + jumlah yang belum dibaca.
 * PATCH  : tandai terbaca (satu ID, atau semua).
 * DELETE : hapus notifikasi.
 */
export async function GET(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get('limit')) || 30, 1),
    100
  );

  const { data: rows, error } = await admin
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at, actor_id')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const notifications = rows ?? [];

  // Hitung yang belum dibaca tanpa menarik semua baris.
  const { count: unreadCount } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);

  // Nama pelaku, supaya notifikasi "Budi join" menampilkan nama, bukan uuid.
  const actorIds = [
    ...new Set(
      notifications.map((n) => n.actor_id).filter((id): id is string => Boolean(id))
    ),
  ];
  let actorById = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, client_name')
      .in('id', actorIds);
    actorById = new Map(
      (profiles ?? []).map((p) => [p.id, p.client_name || 'Seseorang'])
    );
  }

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      readAt: n.read_at,
      createdAt: n.created_at,
      actorName: n.actor_id ? (actorById.get(n.actor_id) ?? null) : null,
    })),
    unreadCount: unreadCount ?? 0,
  });
}

/**
 * Tandai terbaca.
 *
 * Body: { id } untuk satu notifikasi, atau { all: true } untuk semua.
 */
export async function PATCH(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const all = body?.all === true;
  const id = typeof body?.id === 'string' ? body.id : '';

  if (!all && !id) {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
  }

  let query = admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (!all) query = query.eq('id', id);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/** Hapus notifikasi (satu atau semua). */
export async function DELETE(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  let query = admin.from('notifications').delete().eq('recipient_id', userId);
  if (id) query = query.eq('id', id);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
