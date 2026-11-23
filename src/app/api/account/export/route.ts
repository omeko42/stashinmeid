import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';

/**
 * Ekspor seluruh data pengguna.
 *
 * Dipakai dari "Zona Berbahaya" - user bisa mengunduh salinan data
 * mereka sebelum menghapus akun. Hasilnya satu file JSON.
 *
 * Data yang diekspor: profil, transaksi, utang, aset, budget, koneksi,
 * grup keuangan, dan notifikasi. Tidak termasuk data user lain.
 */
export async function GET() {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  // Tabel yang diekspor. Untuk tabel yang tidak punya kolom user_id
  // (mis. grup yang dibuat user), ambil lewat relasi ke grup milik user.
  const ownTables = [
    'transactions',
    'debts',
    'accounts',
    'fx_rates',
    'kyc_profiles',
    'budgets',
    'notification_preferences',
  ] as const;

  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    format: 'stashinme-export-v1',
  };

  const { data: profileData, error: profileErr } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId);
  payload['profiles'] = profileErr ? { error: profileErr.message } : (profileData ?? []);

  for (const table of ownTables) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .eq('user_id', userId);

    // Tabel yang belum ada di database (mis. migration belum dijalankan)
    // tidak boleh menggagalkan seluruh ekspor.
    if (error) {
      payload[table] = { error: error.message };
      continue;
    }
    payload[table] = data ?? [];
  }

  const { data: notifData, error: notifErr } = await admin
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId);
  payload['notifications'] = notifErr ? { error: notifErr.message } : (notifData ?? []);

  const { data: connData, error: connErr } = await admin
    .from('user_connections')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  payload['user_connections'] = connErr ? { error: connErr.message } : (connData ?? []);

  // Grup keuangan milik user ini.
  const { data: groups } = await admin
    .from('finance_groups')
    .select('*')
    .eq('owner_id', userId);

  const groupIds = (groups ?? []).map((g) => g.id);
  let groupMembers: unknown[] = [];
  if (groupIds.length) {
    const { data: members } = await admin
      .from('finance_group_members')
      .select('*')
      .in('group_id', groupIds);
    groupMembers = members ?? [];
  }
  payload['finance_groups'] = groups ?? [];
  payload['finance_group_members'] = groupMembers;

  // Transaksi milik anggota grup juga di luar boundary pribadi, jadi tidak
  // ikut. Yang di-export hanya milik user ini sendiri.

  const filename = `stashinme-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
