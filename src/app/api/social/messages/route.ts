import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Obrolan 1-on-1 antar pengguna (tabel social_messages).
 *
 * GET ?threads=1  -> daftar percakapan + pesan terakhir + unread
 * GET ?peer=<id>  -> riwayat percakapan dengan satu pengguna
 * POST { peer, body } -> kirim pesan
 *
 * Authorization: profil pembicara diambil dengan service role, pesan
 * difilter manual ke dua pesertanya.
 */

async function getProfile(admin: NonNullable<ReturnType<typeof createAdminClient>>, ids: string[]) {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return new Map<string, { client_name: string; avatar_url: string | null }>();
  const { data, error } = await admin
    .from('profiles')
    .select('id, client_name, avatar_url')
    .in('id', uniq);
  if (error) return null;
  return new Map((data ?? []).map((p) => [p.id, p]));
}

async function requireUserId() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function GET(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const params = request.nextUrl.searchParams;
  const peer = params.get('peer');

  if (peer) {
    // Riwayat satu percakapan, terbaru di akhir.
    const { data, error } = await admin
      .from('social_messages')
      .select('id, sender_id, recipient_id, body, read_at, created_at')
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const messages = data ?? [];
    // Tandai sudah dibaca kecuali pesan dari diri sendiri (v1 tanpa realtime).
    await admin
      .from('social_messages')
      .update({ read_at: new Date().toISOString() })
      .match({ sender_id: peer, recipient_id: userId })
      .is('read_at', null);

    return NextResponse.json({ messages });
  }

  // Daftar thread: ambil semua pesan yang melibatkan saya, kelompokkan
  // sederhana di sisi server lalu ringkas per lawan bicara.
  const { data, error } = await admin
    .from('social_messages')
    .select('sender_id, recipient_id, body, read_at, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const threads = new Map<
    string,
    { peerId: string; lastMessage: string; lastUserId: string; lastAt: string; unread: number }
  >();
  for (const m of data ?? []) {
    const peerId = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (!threads.has(peerId)) {
      threads.set(peerId, {
        peerId,
        lastMessage: m.body,
        lastUserId: m.sender_id,
        lastAt: m.created_at,
        unread: 0,
      });
    }
    if (m.recipient_id === userId && !m.read_at) {
      threads.get(peerId)!.unread += 1;
    }
  }

  const list = await getProfile(admin, [...threads.keys()]);
  if (!list) return NextResponse.json({ error: 'Gagal memuat profil' }, { status: 400 });

  return NextResponse.json({
    threads: [...threads.values()].map((t) => ({
      ...t,
      peer: list.get(t.peerId) ?? { client_name: 'Pengguna', avatar_url: null },
    })),
  });
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const payload = (await request.json().catch(() => null)) as
    | { peer?: string; body?: string }
    | null;
  const peer = payload?.peer?.trim();
  const body = payload?.body?.trim();
  if (!peer || !body || body.length > 2000) {
    return NextResponse.json({ error: 'Pesan tidak valid' }, { status: 400 });
  }
  if (peer === userId) {
    return NextResponse.json({ error: 'Tidak dapat mengirim ke diri sendiri' }, { status: 400 });
  }

  // Pastikan penerima benar-benar ada (jangan bisa spam id acak).
  const { data: target } = await admin
    .from('profiles')
    .select('id')
    .eq('id', peer)
    .single();
  if (!target) return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });

  const { data: inserted, error } = await admin
    .from('social_messages')
    .insert({ sender_id: userId, recipient_id: peer, body })
    .select('id, sender_id, recipient_id, body, read_at, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ message: inserted });
}
