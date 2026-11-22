import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperadminToken } from '@/lib/jwt';

/**
 * Audit log.
 *
 * Hanya bisa diakses superadmin. Isinya:
 *   - account_deletion_audit : siapa akun yang dihapus, kapan, berapa data
 *   - notifications            : jejak notifikasi yang terkirim (ringkas)
 *
 * Data yang dihapus user tidak bisa dipulihkan dari sini - audit log
 * cuma bukti, bukan backup.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await verifySuperadminToken(
    cookieStore.get('stashinme_session')?.value
  );

  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get('limit')) || 50, 1),
    200
  );

  const { data: deletions, error: delErr } = await admin
    .from('account_deletion_audit')
    .select(
      'id, user_id, email, client_name, actor_type, actor_id, scope, deleted_counts, reason, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  // Notifikasi terakhir yang terkirim - berguna untuk cek kalau ada yang
  // mencurigakan.
  const { data: recentNotifications } = await admin
    .from('notifications')
    .select('id, type, title, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  return NextResponse.json({
    deletions: deletions ?? [],
    recentNotifications: recentNotifications ?? [],
  });
}
