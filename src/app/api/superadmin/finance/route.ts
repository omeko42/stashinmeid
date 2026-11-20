import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySuperadminToken } from '@/lib/jwt';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';

async function getTargetUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  const session = await verifySuperadminToken(token);
  if (!session) return null;
  if (session.impersonateUserId) return session.impersonateUserId;
  return getOrCreateSuperadminUserId();
}

export async function POST(req: NextRequest) {
  const userId = await getTargetUserId();
  const admin = createAdminClient();
  if (!userId || !admin) {
    return NextResponse.json({ error: 'Unauthorized or Supabase Admin not configured.' }, { status: 401 });
  }

  const body = await req.json();
  const { table, payload } = body;

  if (table === 'transactions') {
    const rows = Array.isArray(payload)
      ? payload.map((r) => ({ ...r, user_id: userId }))
      : [{ ...payload, user_id: userId }];

    const { data, error } = await admin.from('transactions').insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (table === 'debts') {
    const { data, error } = await admin
      .from('debts')
      .insert({ ...payload, user_id: userId })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Invalid table.' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const userId = await getTargetUserId();
  const admin = createAdminClient();
  if (!userId || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, updates } = await req.json();
  const { error } = await admin
    .from('debts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getTargetUserId();
  const admin = createAdminClient();
  if (!userId || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { table, id } = await req.json();
  if (!['transactions', 'debts'].includes(table) || !id) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { error } = await admin.from(table).delete().eq('id', id).eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
