import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import { verifySuperadminToken } from '@/lib/jwt';

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

const AUDIT_BUCKET = 'receipts';

async function readAuditJson(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  path: string
): Promise<AuditEntry[]> {
  try {
    const { data, error } = await admin.storage.from(AUDIT_BUCKET).download(path);
    if (error || !data) return [];
    const parsed = JSON.parse(await data.text());
    return Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

async function appendAuditJson(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  path: string,
  entry: AuditEntry,
  maxItems: number
) {
  try {
    const existing = await readAuditJson(admin, path);
    const next = [entry, ...existing].slice(0, maxItems);
    const payload = Buffer.from(JSON.stringify(next), 'utf8');
    await admin.storage.from(AUDIT_BUCKET).upload(path, payload, {
      contentType: 'application/json',
      upsert: true,
    });
  } catch {
    // Non-blocking: jangan ganggu request utama bila storage belum siap
  }
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

  const [isAdmin, myLogs] = await Promise.all([
    checkIsAdmin(admin, userId),
    readAuditJson(admin, `_system/audit/${userId}.json`),
  ]);

  const globalLogs = isAdmin
    ? await readAuditJson(admin, `_system/audit/global.json`)
    : [];

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

  const [{ data: actorProfile }, { data: targetProfile }] =
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

  // Simpan ke private Storage (0 byte di JWT cookie agar tidak pernah kena 494 REQUEST_HEADER_TOO_LARGE)
  await Promise.all([
    appendAuditJson(admin, `_system/audit/${userId}.json`, entry, 100),
    targetUserId && targetUserId !== userId
      ? appendAuditJson(admin, `_system/audit/${targetUserId}.json`, entry, 100)
      : Promise.resolve(),
    appendAuditJson(admin, `_system/audit/global.json`, entry, 250),
  ]);

  return NextResponse.json({ ok: true, entry });
}
