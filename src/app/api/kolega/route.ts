import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';

/**
 * Kolaborator keuangan.
 *
 * Authorization di sini verifikasi manual dengan service role supaya tidak
 * tergantung RLS; semua aksi harus punya bukti keanggotaan/kepemilikan.
 * Undangan kolega aktif otomatis (status 'active') karena kolaborasi penuh
 * v1 - kolega harus terdaftar sebagai user di app.
 */

async function getUserId(): Promise<string | null> {
  // Sesi Supabase ATAU sesi superadmin (lihat lib/currentUser) - sebelumnya
  // superadmin yang login via dashboard selalu ditolak 401 di sini.
  return getCallerUserId();
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const memberships = await admin
    .from('finance_group_members')
    .select('group_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (memberships.error) return NextResponse.json({ error: memberships.error.message }, { status: 400 });

  const groupIds = memberships.data.map((m) => m.group_id);
  if (groupIds.length === 0) return NextResponse.json({ groups: [] });

  const [groupsRes, allMembers, txRes] = await Promise.all([
    admin.from('finance_groups').select('*').in('id', groupIds),
    admin
      .from('finance_group_members')
      .select('group_id, user_id, role, status')
      .in('group_id', groupIds),
    admin
      .from('transactions')
      .select('group_id, type, amount')
      .in('group_id', groupIds),
  ]);

  if (groupsRes.error || allMembers.error || txRes.error) {
    return NextResponse.json(
      { error: groupsRes.error?.message || allMembers.error?.message || txRes.error?.message },
      { status: 400 }
    );
  }

  const userIds = [...new Set(allMembers.data.map((m) => m.user_id))];
  const profilesRes = await admin
    .from('profiles')
    .select('id, email, client_name, avatar_url')
    .in('id', userIds);
  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });

  const profileById = new Map(profilesRes.data.map((p) => [p.id, p]));
  const totalsByGroup = new Map<string, { inflow: number; outflow: number }>();
  for (const tx of txRes.data) {
    const t = totalsByGroup.get(tx.group_id) ?? { inflow: 0, outflow: 0 };
    if (tx.type === 'inflow') t.inflow += Number(tx.amount);
    else t.outflow += Number(tx.amount);
    totalsByGroup.set(tx.group_id, t);
  }

  return NextResponse.json({
    groups: groupsRes.data.map((g) => ({
      ...g,
      isOwner: g.owner_id === userId,
      members: allMembers.data
        .filter((m) => m.group_id === g.id)
        .map((m) => ({
          user_id: m.user_id,
          role: m.role,
          status: m.status,
          profile: profileById.get(m.user_id) ?? null,
        })),
      totals: totalsByGroup.get(g.id) ?? { inflow: 0, outflow: 0 },
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const groupId = typeof body?.groupId === 'string' ? body.groupId : '';

  if (name && !groupId) {
    const { data, error } = await admin
      .from('finance_groups')
      .insert({ name, owner_id: userId })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin
      .from('finance_group_members')
      .insert({ group_id: data.id, user_id: userId, role: 'owner', status: 'active' });
    return NextResponse.json({ group: data });
  }

  if (groupId && email) {
    // Hanya pemilik grup yang boleh mengundang.
    const group = await admin
      .from('finance_groups')
      .select('id, owner_id, name')
      .eq('id', groupId)
      .single();
    if (group.error || !group.data) return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });
    if (group.data.owner_id !== userId) return NextResponse.json({ error: 'Hanya pemilik grup' }, { status: 403 });

    const member = await admin
      .from('profiles')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();
    if (member.error) return NextResponse.json({ error: member.error.message }, { status: 400 });
    if (!member.data) return NextResponse.json({ error: `User dengan email ${email} belum terdaftar` }, { status: 404 });
    if (member.data.id === userId) return NextResponse.json({ error: 'Kamu sudah jadi pemilik grup ini' }, { status: 400 });

    const { error: errIns } = await admin
      .from('finance_group_members')
      .upsert({ group_id: groupId, user_id: member.data.id, role: 'editor', status: 'active' });
    if (errIns) return NextResponse.json({ error: errIns.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const groupId = typeof body?.groupId === 'string' ? body.groupId : '';
  const memberUserId = typeof body?.userId === 'string' ? body.userId : '';
  if (!groupId || !memberUserId) return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });

  const group = await admin
    .from('finance_groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();
  if (group.error || !group.data) return NextResponse.json({ error: 'Grup tidak ditemukan' }, { status: 404 });

  // Pemilik boleh mengeluarkan siapa pun; anggota boleh keluar sendiri.
  const isOwner = group.data.owner_id === userId;
  const isSelf = memberUserId === userId;
  if (!isOwner && !isSelf) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 });

  const { error } = await admin
    .from('finance_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', memberUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
