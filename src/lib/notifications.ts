import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Helper notifikasi untuk sisi server.
 *
 * Fungsi SQL `create_notification()` sudah menghormati preferensi user
 * (kalau tipe itu dimatikan, tidak dibuat). Helper ini memanggilnya untuk
 * banyak penerima sekaligus, dan diam-diam melewati error supaya notifikasi
 * tidak pernah menggagalkan aksi utama (mis. posting di feed).
 */

export type NotificationType =
  | 'connection_requested'
  | 'connection_accepted'
  | 'group_member_joined'
  | 'feed_post'
  | 'chat_message';

/**
 * Kirim notifikasi ke satu penerima.
 *
 * Kegagalan sengaja diabaikan - notifikasi itu pelengkap, bukan hal
 * utama. Kalau tabel `notifications` belum ada (migration belum
 * dijalankan), aplikasi harus tetap jalan.
 */
export async function notify(
  admin: SupabaseClient,
  recipientId: string,
  actorId: string | null,
  type: NotificationType,
  title: string,
  body?: string | null,
  link?: string | null
): Promise<void> {
  try {
    await admin.rpc('create_notification', {
      p_recipient_id: recipientId,
      p_actor_id: actorId,
      p_type: type,
      p_title: title,
      p_body: body ?? null,
      p_link: link ?? null,
    });
  } catch {
    // Sengaja diabaikan.
  }
}

/**
 * Kirim notifikasi ke banyak penerima.
 *
 * `excludeId` biasanya diisi dengan id pelaku supaya dia tidak
 * dikabari tentang aksinya sendiri.
 */
export async function notifyMany(
  admin: SupabaseClient,
  recipientIds: string[],
  actorId: string | null,
  type: NotificationType,
  title: string,
  body?: string | null,
  link?: string | null,
  excludeId?: string | null
): Promise<void> {
  const targets = [
    ...new Set(recipientIds.filter((id) => id && id !== excludeId)),
  ];
  if (targets.length === 0) return;

  // Dikirim paralel, tapi dibatasi 10 sekaligus supaya tidak membanjiri
  // koneksi saat penerima banyak.
  const BATCH = 10;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    await Promise.all(
      batch.map((id) => notify(admin, id, actorId, type, title, body, link))
    );
  }
}

/**
 * Ambil daftar user yang punya role 'user' (semua user selain superadmin).
 *
 * Dipakai untuk notifikasi broadcast, misalnya "ada orang baru posting di
 * feed".
 */
export async function getRegularUserIds(
  admin: SupabaseClient
): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from('profiles')
      .select('id, role')
      .eq('role', 'user');

    if (error) return [];
    return (data ?? []).map((p) => p.id);
  } catch {
    return [];
  }
}

/**
 * Ambil daftar kolega yang sudah accepted (status 'accepted').
 *
 * Dipakai untuk notifikasi yang hanya relevan untuk orang terdekat.
 */
export async function getAcceptedConnectionIds(
  admin: SupabaseClient,
  userId: string
): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from('user_connections')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) return [];
    return (data ?? [])
      .map((c) =>
        c.requester_id === userId ? c.addressee_id : c.requester_id
      )
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

/**
 * Ambil nama tampilan user.
 */
export async function getDisplayName(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  try {
    const { data } = await admin
      .from('profiles')
      .select('client_name')
      .eq('id', userId)
      .maybeSingle();
    return data?.client_name || 'Seseorang';
  } catch {
    return 'Seseorang';
  }
}
