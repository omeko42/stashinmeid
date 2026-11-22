import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import { verifySuperadminToken } from '@/lib/jwt';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  targetUserId?: string | null;
  targetName?: string | null;
  action: string;
  category:
    | 'settings'
    | 'finance'
    | 'group'
    | 'membership'
    | 'admin'
    | 'auth';
  detail: string;
  createdAt: string;
}

async function checkIsAdmin(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  if (await verifySuperadminToken(token)) return true;

  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role === 'admin';
}

async function getPrimaryAdminId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<string | null> {
  const superId = await getOrCreateSuperadminUserId();
  if (superId) return superId;
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function appendUserLog(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  uid: string,
  field: 'personal_audit_logs' | 'global_audit_logs',
  entry: AuditEntry,
  maxItems: number
) {
  const { data } = await admin.auth.admin.getUserById(uid);
  if (!data?.user) return;
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const existing = Array.isArray(meta[field])
    ? (meta[field] as AuditEntry[])
    : [];
  const next = [entry, ...existing].slice(0, maxItems);
  await admin.auth.admin.updateUserById(uid, {
    user_metadata: {
      ...meta,
      [field]: next,
    },
  });
}

export async function GET() {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ myLogs: [], globalLogs: [], isAdmin: false });
  }

  const [isAdmin, userRes, primaryAdminId] = await Promise.all([
    checkIsAdmin(admin, userId),
    admin.auth.admin.getUserById(userId),
    getPrimaryAdminId(admin),
  ]);

  const userMeta = (userRes.data?.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const myLogs = Array.isArray(userMeta.personal_audit_logs)
    ? (userMeta.personal_audit_logs as AuditEntry[])
    : [];

  let globalLogs: AuditEntry[] = [];
  if (isAdmin && primaryAdminId) {
    const adminRes =
      primaryAdminId === userId
        ? userRes
        : await admin.auth.admin.getUserById(primaryAdminId);
    const adminMeta = (adminRes.data?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    globalLogs = Array.isArray(adminMeta.global_audit_logs)
      ? (adminMeta.global_audit_logs as AuditEntry[])
      : [];
  }

  return NextResponse.json({
    myLogs,
    globalLogs,
    isAdmin,
  });
}

export async function POST(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) {
    // Pengunjung belum login (mis. di Landing Page / Demo): tidak error, cukup abaikan
    return NextResponse.json({ ok: true, skipped: true });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim().slice(0, 100);
  const detail = String(body.detail || '').trim().slice(0, 280);
  const category = (
    ['settings', 'finance', 'group', 'membership', 'admin', 'auth'].includes(
      body.category
    )
      ? body.category
      : 'settings'
  ) as AuditEntry['category'];
  const targetUserId =
    typeof body.targetUserId === 'string' && body.targetUserId
      ? body.targetUserId
      : null;

  if (!action) {
    return NextResponse.json({ error: 'action wajib diisi' }, { status: 400 });
  }

  const [{ data: actorProfile }, { data: targetProfile }, primaryAdminId] =
    await Promise.all([
      admin
        .from('profiles')
        .select('email, client_name')
        .eq('id', userId)
        .maybeSingle(),
      targetUserId
        ? admin
            .from('profiles')
            .select('email, client_name')
            .eq('id', targetUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      getPrimaryAdminId(admin),
    ]);

  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    actorId: userId,
    actorName: actorProfile?.client_name || actorProfile?.email || 'Pengguna',
    actorEmail: actorProfile?.email || '',
    targetUserId,
    targetName:
      targetProfile?.client_name || targetProfile?.email || undefined,
    action,
    category,
    detail: detail || action,
    createdAt: new Date().toISOString(),
  };

  // 1. Catat ke log pribadi pelaku
  await appendUserLog(admin, userId, 'personal_audit_logs', entry, 100);

  // 2. Catat 2-arah ke log pihak terkait (bila berbeda dari pelaku)
  if (targetUserId && targetUserId !== userId) {
    await appendUserLog(admin, targetUserId, 'personal_audit_logs', entry, 100);
  }

  // 3. Catat ke log global Admin
  if (primaryAdminId) {
    await appendUserLog(admin, primaryAdminId, 'global_audit_logs', entry, 250);
  }

  return NextResponse.json({ ok: true, entry });
}
