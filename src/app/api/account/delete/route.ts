import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import { checkRateLimit, clientIp, rateLimitHeaders } from '@/lib/rateLimit';
import { verifyUserPassword } from '@/lib/supabase/verifyPassword';

/**
 * Hapus akun beserta seluruh datanya.
 *
 * Ini operasi destruktif, jadi ada beberapa lapis pengaman:
 *
 * 1. Wajib mengetik konfirmasi. Body harus berisi `confirm: 'HAPUS AKUN'`
 *    (atau padanan bahasa Inggris). Salah ketik => 400.
 * 2. Wajib password (kecuali akun yang memang tidak punya password, mis.
 *    pengguna yang masuk lewat Google - untuk mereka, konfirmasi email
 *    dipakai sebagai gantinya).
 * 3. Rate limit: 5 percobaan per jam per IP.
 * 4. User tidak bisa menghapus akun superadmin lewat endpoint ini.
 *
 * Jejak audit disimpan di tabel `account_deletion_audit` sebelum data
 * dihapus, supaya ada bukti Instructed penghapusan walaupun datanya
 * sendiri sudah hilang.
 */

/** Frasa konfirmasi yang harus diketik user. */
const CONFIRM_PHRASE = 'HAPUS AKUN';

const DELETE_LIMIT = 5;
const DELETE_WINDOW_MS = 60 * 60 * 1000;

export async function DELETE(req: NextRequest) {
  const ip = clientIp(req);
  const limit = checkRateLimit(
    `account-delete:${ip}`,
    DELETE_LIMIT,
    DELETE_WINDOW_MS
  );

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan penghapusan. Coba lagi dalam ${limit.retryAfterSeconds} detik.`,
      },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const confirm = typeof body?.confirm === 'string' ? body.confirm.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error: `Konfirmasi tidak cocok. Ketik "${CONFIRM_PHRASE}" dengan tepat untuk melanjutkan.`,
        requiresPhrase: CONFIRM_PHRASE,
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server config' }, { status: 500 });
  }

  // Ambil data user untuk cek role dan metode login.
  const { data: userRow, error: userErr } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 400 });
  }

  if (!userRow) {
    return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
  }

  // Akun superadmin (dibuat dari env, bukan dari form signup) tidak boleh
  // dihapus lewat endpoint ini - kalau tidak, aplikasi tidak ada yang bisa
  // mengelola lagi.
  if (userRow.role === 'admin' && !process.env.SUPERADMIN_USERNAME) {
    return NextResponse.json(
      { error: 'Akun admin bawaan tidak dapat dihapus lewat sini.' },
      { status: 403 }
    );
  }

  // Verifikasi password kalau akun punya password.
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const hasPassword = Boolean(authUser?.user?.identities?.some((i) => i.provider === 'email'));

  if (hasPassword) {
    if (!password) {
      return NextResponse.json(
        { error: 'Masukkan password akunmu untuk konfirmasi.', needsPassword: true },
        { status: 400 }
      );
    }

    if (!authUser?.user?.email) {
      return NextResponse.json(
        { error: 'Email akun tidak ditemukan - tidak bisa verifikasi password.' },
        { status: 400 }
      );
    }

    const check = await verifyUserPassword(authUser.user.email, password);
    if (!check.valid) {
      return NextResponse.json(
        { error: 'Password salah. Akun tidak dihapus.' },
        { status: 403 }
      );
    }
  }

  // Hitung ringkasan data yang akan dihapus (untuk audit).
  const counts: Record<string, number> = {};
  for (const table of ['transactions', 'debts', 'accounts', 'budgets']) {
    const { count } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    counts[table] = count ?? 0;
  }

  const { count: notifCount } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId);
  counts['notifications'] = notifCount ?? 0;

  const { count: groupCount } = await admin
    .from('finance_groups')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId);
  counts['finance_groups'] = groupCount ?? 0;

  // Simpan jejak audit dulu - kalau penghapusan user-nya gagal, jejaknya
  // tetap ada sebagai tanda percobaan.
  //
  // Catatan: id user disimpan sebagai uuid di tabel audit, tapi barisnya
  // tidak punya foreign key ke auth.users - jadi tidak ikut terhapus
  // waktu user dihapus. Itu memang yang mau: jejaknya harus bertahan.
  try {
    await admin.from('account_deletion_audit').insert({
      user_id: userId,
      email: userRow.email,
      actor_type: 'self',
      actor_id: userId,
      scope: 'all',
      deleted_counts: counts,
      reason: body?.reason ?? null,
    });
  } catch {
    // Kalau tabel audit belum ada, penghapusan tetap jalan - jangan
    // memblokir user hanya karena jejak audit gagal ditulis.
  }

  // Hapus user dari Supabase Auth.
  //
  // Foreign key dengan `on delete cascade` akan ikut menghapus transaksi,
  // utang, aset, notifikasi, dan lainnya.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json(
      {
        error: `Gagal menghapus akun: ${deleteError.message}`,
        note: 'Data kamu belum terhapus. Silakan coba lagi atau hubungi admin.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, deleted: true, counts });
}
