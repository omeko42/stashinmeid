import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';

/**
 * Notifikasi terpadu:
 * Menggabungkan notifikasi tersimpan (`notifications`) dengan aktivitas live
 * yang belum terbaca / menunggu tindakan:
 * - Pesan obrolan masuk yang belum dibaca (`social_messages`)
 * - Permintaan kolega masuk (`user_connections`)
 * - Undangan grup keuangan masuk (`finance_group_members`)
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

  const [notifRes, unreadCountRes, unreadMsgRes, pendingConnRes, pendingGroupRes] =
    await Promise.all([
      admin
        .from('notifications')
        .select('id, type, title, body, link, read_at, created_at, actor_id')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      admin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null),
      admin
        .from('social_messages')
        .select('id, sender_id, body, created_at')
        .eq('recipient_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('user_connections')
        .select('id, requester_id, created_at')
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      admin
        .from('finance_group_members')
        .select('group_id, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .limit(20),
    ]);

  if (notifRes.error) {
    return NextResponse.json({ error: notifRes.error.message }, { status: 400 });
  }

  const notifications = notifRes.data ?? [];
  const unreadMsgs = unreadMsgRes.data ?? [];
  const pendingConns = pendingConnRes.data ?? [];
  const pendingGroups = pendingGroupRes.data ?? [];

  // Kelompokkan pesan belum dibaca per pengirim agar rapi (1 notifikasi per pengirim)
  const unreadBySender = new Map<
    string,
    { count: number; lastBody: string; lastAt: string }
  >();
  for (const m of unreadMsgs) {
    const existing = unreadBySender.get(m.sender_id);
    if (!existing) {
      unreadBySender.set(m.sender_id, {
        count: 1,
        lastBody: m.body,
        lastAt: m.created_at,
      });
    } else {
      existing.count += 1;
    }
  }

  // Ambil info grup untuk undangan grup masuk
  const pendingGroupIds = pendingGroups.map((g) => g.group_id);
  const groupInfoMap = new Map<string, { name: string; owner_id: string }>();
  if (pendingGroupIds.length > 0) {
    const { data: gRows } = await admin
      .from('finance_groups')
      .select('id, name, owner_id')
      .in('id', pendingGroupIds);
    for (const g of gRows ?? []) {
      groupInfoMap.set(g.id, { name: g.name, owner_id: g.owner_id });
    }
  }

  // Kumpulkan semua actor ID untuk resolve nama tampilan sekali query
  const actorIds = [
    ...new Set([
      ...notifications
        .map((n) => n.actor_id)
        .filter((id): id is string => Boolean(id)),
      ...unreadBySender.keys(),
      ...pendingConns.map((c) => c.requester_id),
      ...[...groupInfoMap.values()].map((g) => g.owner_id),
    ]),
  ];

  let actorById = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, client_name')
      .in('id', actorIds);
    actorById = new Map(
      (profiles ?? []).map((p) => [p.id, p.client_name || 'Seseorang'])
    );
  }

  // Sintesis notifikasi live (selalu muncul selama masih unread / pending)
  const liveItems: {
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    readAt: string | null;
    createdAt: string;
    actorName: string | null;
  }[] = [];

  for (const [senderId, info] of unreadBySender.entries()) {
    const senderName = actorById.get(senderId) || 'Kolega';
    liveItems.push({
      id: `live-msg:${senderId}`,
      type: 'chat_message',
      title:
        info.count > 1
          ? `${info.count} pesan baru dari ${senderName}`
          : `Pesan baru dari ${senderName}`,
      body: info.lastBody.slice(0, 120),
      link: 'tab:social:chat',
      readAt: null,
      createdAt: info.lastAt,
      actorName: senderName,
    });
  }

  for (const c of pendingConns) {
    const requesterName = actorById.get(c.requester_id) || 'Pengguna';
    liveItems.push({
      id: `live-conn:${c.id}`,
      type: 'connection_requested',
      title: `Permintaan kolega dari ${requesterName}`,
      body: 'Buka Kelola Kolega untuk menerima atau menolak permintaan ini.',
      link: 'tab:social:manage',
      readAt: null,
      createdAt: c.created_at,
      actorName: requesterName,
    });
  }

  for (const g of pendingGroups) {
    const info = groupInfoMap.get(g.group_id);
    const ownerName = info ? actorById.get(info.owner_id) || 'Kolega' : 'Kolega';
    liveItems.push({
      id: `live-grp:${g.group_id}`,
      type: 'group_member_joined',
      title: `Undangan grup: ${info?.name || 'Grup Keuangan'}`,
      body: `${ownerName} mengundang Anda bergabung ke ruang grup ini.`,
      link: 'tab:social:manage',
      readAt: null,
      createdAt: g.created_at || new Date().toISOString(),
      actorName: ownerName,
    });
  }

  // Hindari duplikasi kalau tabel notifications sudah mencatat pesan yang sama persis
  const dbMapped = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.read_at,
    createdAt: n.created_at,
    actorName: n.actor_id ? (actorById.get(n.actor_id) ?? null) : null,
  }));

  const merged = [...liveItems, ...dbMapped]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  // Hitung total unread secara akurat: notifikasi DB belum dibaca + jumlah pesan belum dibaca + koneksi/grup pending
  const totalUnread =
    (unreadCountRes.count ?? 0) +
    unreadMsgs.length +
    pendingConns.length +
    pendingGroups.length;

  return NextResponse.json({
    notifications: merged,
    unreadCount: totalUnread,
  });
}

/**
 * Tandai terbaca.
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

  const nowIso = new Date().toISOString();

  // Jika menandai item pesan live terbaca
  if (id.startsWith('live-msg:')) {
    const senderId = id.slice('live-msg:'.length);
    await admin
      .from('social_messages')
      .update({ read_at: nowIso })
      .match({ sender_id: senderId, recipient_id: userId })
      .is('read_at', null);
    return NextResponse.json({ ok: true });
  }

  // Item koneksi/grup pending tetap menunggu tindakan Terima/Tolak di Kelola Kolega
  if (id.startsWith('live-conn:') || id.startsWith('live-grp:')) {
    return NextResponse.json({ ok: true });
  }

  let query = admin
    .from('notifications')
    .update({ read_at: nowIso })
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (!all) query = query.eq('id', id);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (all) {
    await admin
      .from('social_messages')
      .update({ read_at: nowIso })
      .eq('recipient_id', userId)
      .is('read_at', null);
  }

  return NextResponse.json({ ok: true });
}

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
  const id = searchParams.get('id') || '';
  if (!id) {
    return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });
  }

  if (id.startsWith('live-msg:')) {
    const senderId = id.slice('live-msg:'.length);
    await admin
      .from('social_messages')
      .update({ read_at: new Date().toISOString() })
      .match({ sender_id: senderId, recipient_id: userId })
      .is('read_at', null);
    return NextResponse.json({ ok: true });
  }

  if (id.startsWith('live-conn:') || id.startsWith('live-grp:')) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('recipient_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
