import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import { getDisplayName, notifyMany } from '@/lib/notifications';
import { getMaxGroupsForTier, resolveMembershipStatus } from '@/lib/membership';

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
    .in('status', ['active', 'pending']);
  if (memberships.error) return NextResponse.json({ error: memberships.error.message }, { status: 400 });

  const activeGroupIds = memberships.data
    .filter((m) => m.status === 'active')
    .map((m) => m.group_id);
  const pendingGroupIds = memberships.data
    .filter((m) => m.status === 'pending')
    .map((m) => m.group_id);

  // Undangan grup masuk (menunggu konfirmasi 2-arah dari penerima)
  let pendingInvites: {
    group_id: string;
    group_name: string;
    owner_id: string;
    owner_name: string;
  }[] = [];

  if (pendingGroupIds.length > 0) {
    const { data: pGroups } = await admin
      .from('finance_groups')
      .select('id, name, owner_id')
      .in('id', pendingGroupIds);
    const ownerIds = [...new Set((pGroups ?? []).map((g) => g.owner_id))];
    const { data: ownerProfiles } = ownerIds.length
      ? await admin
          .from('profiles')
          .select('id, email, client_name')
          .in('id', ownerIds)
      : { data: [] };
    const ownerMap = new Map(
      (ownerProfiles ?? []).map((p) => [p.id, p.client_name || p.email])
    );
    pendingInvites = (pGroups ?? []).map((g) => ({
      group_id: g.id,
      group_name: g.name,
      owner_id: g.owner_id,
      owner_name: ownerMap.get(g.owner_id) || 'Pemilik Grup',
    }));
  }

  const groupIds = activeGroupIds;
  if (groupIds.length === 0) {
    return NextResponse.json({ groups: [], pendingInvites });
  }

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
    pendingInvites,
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
    // Cek batas jumlah grup sesuai paket membership (Gratis: 3, Pro: 5, Enterprise: 9)
    const [{ data: authUser }, { data: profile }, { count: ownedCount }] =
      await Promise.all([
        admin.auth.admin.getUserById(userId),
        admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
        admin
          .from('finance_groups')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId),
      ]);

    const userMeta = (authUser?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const membership = resolveMembershipStatus(userMeta, profile?.role === 'admin');
    const tier = membership.effectiveTier;
    const maxGroups = getMaxGroupsForTier(tier);

    if ((ownedCount ?? 0) >= maxGroups) {
      return NextResponse.json(
        {
          error: `Batas paket ${tier.toUpperCase()} (maks. ${maxGroups} grup) tercapai. Upgrade di Pengaturan → Membership.`,
        },
        { status: 403 }
      );
    }

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

    // Undangan 2-arah: status awal 'pending' supaya penerima bisa terima/tolak
    // dan pengundang tetap bisa membatalkan bila salah undang.
    const { error: errIns } = await admin
      .from('finance_group_members')
      .upsert({
        group_id: groupId,
        user_id: member.data.id,
        role: 'editor',
        status: 'pending',
      });
    if (errIns) return NextResponse.json({ error: errIns.message }, { status: 400 });

    const { data: groupInfo } = await admin
      .from('finance_groups')
      .select('name')
      .eq('id', groupId)
      .maybeSingle();

    const inviterName = await getDisplayName(admin, userId);
    const groupName = groupInfo?.name || 'grup keuangan';

    await notifyMany(
      admin,
      [member.data.id],
      userId,
      'group_member_joined',
      `Undangan grup ${groupName}`,
      `${inviterName} mengundangmu bergabung ke grup ${groupName}. Terima atau tolak di menu Sosial.`,
      'tab:social:kolega'
    );

    return NextResponse.json({ ok: true, status: 'pending' });
  }

  return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Server config' }, { status: 500 });

  const body = await req.json().catch(() => null);
  const groupId = typeof body?.groupId === 'string' ? body.groupId : '';
  const action = typeof body?.action === 'string' ? body.action : '';
  const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : '';

  if (!groupId || !['accept', 'reject', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const { data: group } = await admin
    .from('finance_groups')
    .select('id, name, owner_id')
    .eq('id', groupId)
    .maybeSingle();
  if (!group) return NextResponse.json({ error: 'Grup tidak ditemukan.' }, { status: 404 });

  if (action === 'cancel') {
    if (group.owner_id !== userId || !targetUserId) {
      return NextResponse.json({ error: 'Hanya pemilik grup yang bisa membatalkan undangan.' }, { status: 403 });
    }
    const { error } = await admin
      .from('finance_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Penerima merespons undangan (accept / reject)
  if (action === 'accept') {
    const { error } = await admin
      .from('finance_group_members')
      .update({ status: 'active' })
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const joinerName = await getDisplayName(admin, userId);
    await notifyMany(
      admin,
      [group.owner_id],
      userId,
      'group_member_joined',
      `Undangan ${group.name} diterima`,
      `${joinerName} resmi bergabung ke grup ${group.name}.`,
      'tab:social:kolega'
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    const { error } = await admin
      .from('finance_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const actorName = await getDisplayName(admin, userId);
    await notifyMany(
      admin,
      [group.owner_id],
      userId,
      'group_member_joined',
      `Undangan ${group.name} ditolak`,
      `${actorName} menolak undangan bergabung ke grup ${group.name}.`,
      'tab:social:kolega'
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
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
