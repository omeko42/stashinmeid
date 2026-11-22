import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import { verifySuperadminToken } from '@/lib/jwt';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';

const LEGACY_DUMMY_PATTERNS = [
  'stashinmeid v3 sekarang live',
  'stashinmeid v3 is now live',
];

function isLegacyDummyText(text: string): boolean {
  const lower = text.toLowerCase();
  return LEGACY_DUMMY_PATTERNS.some((p) => lower.includes(p));
}

async function requireAdminOrSuperadmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  if (await verifySuperadminToken(token)) return true;

  const userId = await getCallerUserId();
  if (!userId) return false;

  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role === 'admin';
}

export async function GET() {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ announcement: null }, { status: 200 });
    }

    const { data, error } = await admin
      .from('announcements')
      .select('id, text, active, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ announcement: null }, { status: 200 });
    }

    const latest = data?.[0] ?? null;
    if (!latest || !latest.text || isLegacyDummyText(latest.text)) {
      return NextResponse.json({ announcement: null });
    }

    return NextResponse.json({
      announcement: { id: latest.id, text: latest.text },
    });
  } catch {
    return NextResponse.json({ announcement: null }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const allowed = await requireAdminOrSuperadmin();
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';

  if (!text) {
    return NextResponse.json(
      { error: 'Teks pengumuman wajib diisi.' },
      { status: 400 }
    );
  }
  if (text.length > 500) {
    return NextResponse.json(
      { error: 'Maksimal 500 karakter.' },
      { status: 400 }
    );
  }

  await admin
    .from('announcements')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('active', true);

  const callerId = (await getCallerUserId()) || (await getOrCreateSuperadminUserId());

  const { data, error } = await admin
    .from('announcements')
    .insert({
      text,
      created_by: callerId,
      active: true,
    })
    .select('id, text, active, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ announcement: data });
}

export async function PATCH(req: NextRequest) {
  const allowed = await requireAdminOrSuperadmin();
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const active = body?.active === true;

  if (!id) {
    return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });
  }

  const { error } = await admin
    .from('announcements')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const allowed = await requireAdminOrSuperadmin();
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });
  }

  const { error } = await admin.from('announcements').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
