import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';

/**
 * Kolega (pertemanan 2-arah).
 *
 * Berbeda dari finance_groups yang berarti "grup keuangan" (pooling
 * transaksi): di sini tidak ada akses data keuangan apa pun. Hubungan ini
 * murni sosial - seperti daftar teman.
 *
 * Alur:
 *   - A kirim permintaan ke B  -> status 'pending'
 *   - B menerima              -> status 'accepted', A jadi kolega B
 *   - B menolak / A membatalkan -> hapus baris
 *   - Salah satu unfriend      -> hapus baris (hanya kalau sudah accepted)
 */

export interface ConnectionProfile {
  id: string;
  email: string;
  client_name: string;
  avatar_url: string | null;
}

export interface Connection {
  id: string;
  /** User di sisi lain. */
  user_id: string;
  /** 'incoming' = orang ini mengirim permintaan ke saya. */
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'accepted';
  created_at: string;
  profile: ConnectionProfile | null;
}

async function requireUser() {
  const userId = await getCallerUserId();
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: 'Server config' }, { status: 500 }) };
  }
  return { userId, admin };
}

export async function GET() {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const { userId, admin } = auth;

  // Semua koneksi yang melibatkan saya, dari dua arah.
  const { data: rows, error } = await admin
    .from('user_connections')
    .select('id, requester_id, addressee_id, status, created_at')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .neq('status', 'blocked');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const connections = rows ?? [];

  // Ambil profil user di sisi lain supaya UI bisa tampilkan nama.
  const otherIds = [
    ...new Set(
      connections.map((c) =>
        c.requester_id === userId ? c.addressee_id : c.requester_id
      )
    ),
  ];

  let profileById = new Map<string, ConnectionProfile>();
  if (otherIds.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, client_name, avatar_url')
      .in('id', otherIds);
    profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  }

  const shaped: Connection[] = connections.map((c) => {
    const incoming = c.addressee_id === userId;
    const otherId = incoming ? c.requester_id : c.addressee_id;
    return {
      id: c.id,
      user_id: otherId,
      direction: incoming ? 'incoming' : 'outgoing',
      status: c.status as 'pending' | 'accepted',
      created_at: c.created_at,
      profile: profileById.get(otherId) ?? null,
    };
  });

  return NextResponse.json({
    connections: shaped,
    // Permintaan yang menunggu jawaban saya.
    incomingCount: shaped.filter((c) => c.direction === 'incoming' && c.status === 'pending')
      .length,
  });
}

/**
 * Kirim permintaan koneksi.
 *
 * Kalau ternyata koneksi sudah ada (dengan arah sebaliknya), accept langsung
 * - persis seperti application's "mutual follow" di media sosial.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const { userId, admin } = auth;

  const body = await req.json().catch(() => null);
  const targetId = typeof body?.userId === 'string' ? body.userId : '';

  if (!targetId) {
    return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });
  }
  if (targetId === userId) {
    return NextResponse.json(
      { error: 'Tidak bisa menambah diri sendiri.' },
      { status: 400 }
    );
  }

  // Target harus benar-benar user yang terdaftar.
  const { data: target } = await admin
    .from('profiles')
    .select('id, client_name')
    .eq('id', targetId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json(
      { error: 'User tidak ditemukan.' },
      { status: 404 }
    );
  }

  // Sudah ada koneksi ke user ini (dari arah mana pun)?
  const { data: existing } = await admin
    .from('user_connections')
    .select('id, requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${targetId}),` +
        `and(requester_id.eq.${targetId},addressee_id.eq.${userId})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') {
      return NextResponse.json({ error: 'Sudah jadi kolega.' }, { status: 400 });
    }

    // Kalau yang sebelumnya menerima permintaan, sekarang giliran saya yang
    // mengirim -> accept.
    if (existing.requester_id === targetId) {
      const { data: updated, error: updErr } = await admin
        .from('user_connections')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }

      // Kabari target bahwa permintaannya diterima.
      await admin.rpc('create_notification', {
        p_recipient_id: targetId,
        p_actor_id: userId,
        p_type: 'connection_accepted',
        p_title: 'Permintaan kolega diterima',
        p_body: `${target.client_name || 'Seseorang'} menerima permintaanmu.`,
        p_link: 'tab:social:kolega',
      });

      return NextResponse.json({ connection: updated });
    }

    // Sudah ada permintaan keluar yang masih pending.
    return NextResponse.json(
      { error: 'Permintaan sudah dikirim, menunggu jawaban.' },
      { status: 400 }
    );
  }

  const { data: created, error: insErr } = await admin
    .from('user_connections')
    .insert({
      requester_id: userId,
      addressee_id: targetId,
      status: 'pending',
    })
    .select()
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  await admin.rpc('create_notification', {
    p_recipient_id: targetId,
    p_actor_id: userId,
    p_type: 'connection_requested',
    p_title: 'Permintaan kolega baru',
    p_body: `${target.client_name || 'Seseorang'} ingin jadi kolegamu.`,
    p_link: 'tab:social:kolega',
  });

  return NextResponse.json({ connection: created });
}

/**
 * Terima / tolak / hapus koneksi.
 *
 * Body: { connectionId, action: 'accept' | 'reject' | 'remove' }
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const { userId, admin } = auth;

  const body = await req.json().catch(() => null);
  const connectionId = typeof body?.connectionId === 'string' ? body.connectionId : '';
  const action = typeof body?.action === 'string' ? body.action : '';

  if (!connectionId || !['accept', 'reject', 'remove'].includes(action)) {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
  }

  const { data: conn } = await admin
    .from('user_connections')
    .select('id, requester_id, addressee_id, status')
    .eq('id', connectionId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: 'Koneksi tidak ditemukan.' }, { status: 404 });
  }

  const involved = conn.requester_id === userId || conn.addressee_id === userId;
  if (!involved) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 });
  }

  // Terima: hanya yang menerima permintaan (addressee) yang boleh.
  if (action === 'accept') {
    if (conn.addressee_id !== userId) {
      return NextResponse.json(
        { error: 'Hanya penerima permintaan yang bisa menerima.' },
        { status: 403 }
      );
    }
    if (conn.status === 'accepted') {
      return NextResponse.json({ ok: true });
    }

    const { error: updErr } = await admin
      .from('user_connections')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    await admin.rpc('create_notification', {
      p_recipient_id: conn.requester_id,
      p_actor_id: userId,
      p_type: 'connection_accepted',
      p_title: 'Permintaan kolega diterima',
      p_body: 'Permintaan kolegamu sudah diterima.',
      p_link: 'tab:social:kolega',
    });

    return NextResponse.json({ ok: true });
  }

  // Tolak: hanya addressee. Hapus baris, biar bisa kirim ulang nanti.
  if (action === 'reject') {
    if (conn.addressee_id !== userId) {
      return NextResponse.json(
        { error: 'Hanya penerima permintaan yang bisa menolak.' },
        { status: 403 }
      );
    }

    const { error: delErr } = await admin
      .from('user_connections')
      .delete()
      .eq('id', connectionId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  // Remove: unfriend. Boleh oleh salah satu pihak, baik yang masih pending
  // (membatalkan permintaan) maupun yang sudah accepted (putus pertemanan).
  const { error: delErr } = await admin
    .from('user_connections')
    .delete()
    .eq('id', connectionId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
