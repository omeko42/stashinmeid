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

/**
 * Whitelist kolom yang boleh ditulis per tabel.
 *
 * Tanpa whitelist, request bisa meng-update kolom apa saja - termasuk `id`
 * (mengganti primary key) atau `role` (menaikkan hak akses pengguna menjadi
 * admin). Semua kolom yang di luar daftar ini diabaikan.
 */
const ALLOWED_COLUMNS: Record<string, string[]> = {
  profiles: ['client_name', 'email', 'bio'],
  transactions: [
    'type',
    'amount',
    'category',
    'description',
    'transaction_date',
    'source',
  ],
  debts: [
    'platform',
    'contract_no',
    'total_tenor',
    'remaining_tenor',
    'due_day',
    'remaining_balance',
    'monthly_installment',
    'status',
    'notes',
  ],
};

/**
 * Ambil hanya kolom yang diizinkan dari payload bebas.
 * Mengembalikan null kalau tidak ada satu pun kolom valid.
 */
function sanitizeUpdates(
  table: string,
  payload: unknown
): Record<string, unknown> | null {
  const allowed = ALLOWED_COLUMNS[table];
  if (!allowed) return null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const source = payload as Record<string, unknown>;
  const clean: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in source) clean[key] = source[key];
  }

  return Object.keys(clean).length > 0 ? clean : null;
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

  const { table, id, updates } = await req.json();

  // Hanya tabel yang memang boleh diubah lewat superadmin. `profiles` ikut
  // bisa diubah supaya superadmin bisa impersonate lalu menyunting profil target.
  if (table !== 'profiles' && table !== 'debts') {
    return NextResponse.json({ error: 'Invalid table.' }, { status: 400 });
  }

  const clean = sanitizeUpdates(table, updates);
  if (!clean) {
    return NextResponse.json({ error: 'Invalid updates.' }, { status: 400 });
  }

  if (table === 'profiles') {
    // Selalu batasi ke userId - jangan biarkan request menarget user lain.
    const { error } = await admin.from('profiles').update(clean).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // debts: wajib menyebut id baris yang mau diubah, dan tetap batasi ke userId.
  if (!id) {
    return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 });
  }

  const { error } = await admin
    .from('debts')
    .update(clean)
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
