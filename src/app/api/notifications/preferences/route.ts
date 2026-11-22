import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';

/**
 * Preferensi notifikasi per user.
 *
 * GET  : semua preferensi saya (tipe yang belum di-set dianggap aktif).
 * PATCH: ubah satu atau beberapa tipe.
 *
 * Tipe yang tersedia:
 *   connection_requested, connection_accepted, group_member_joined,
 *   feed_post, chat_message
 */

const NOTIFICATION_TYPES = [
  'connection_requested',
  'connection_accepted',
  'group_member_joined',
  'feed_post',
  'chat_message',
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export async function GET() {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const { data, error } = await admin
    .from('notification_preferences')
    .select('type, enabled')
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Tipe yang belum pernah di-set default-nya aktif.
  const preferences: Record<string, boolean> = {};
  for (const type of NOTIFICATION_TYPES) {
    preferences[type] = true;
  }
  for (const row of data ?? []) {
    preferences[row.type] = row.enabled;
  }

  return NextResponse.json({ preferences });
}

/**
 * Ubah preferensi.
 *
 * Body: { preferences: { <type>: boolean, ... } }
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
  const incoming = body?.preferences;

  if (!incoming || typeof incoming !== 'object') {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
  }

  const rows: { user_id: string; type: NotificationType; enabled: boolean }[] =
    [];

  for (const [type, enabled] of Object.entries(incoming as Record<string, unknown>)) {
    if (!NOTIFICATION_TYPES.includes(type as NotificationType)) continue;
    if (typeof enabled !== 'boolean') continue;
    rows.push({
      user_id: userId,
      type: type as NotificationType,
      enabled,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Tidak ada preferensi valid.' }, { status: 400 });
  }

  const { error } = await admin
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'user_id,type' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
