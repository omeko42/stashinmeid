'use client';

import { useCallback, useEffect, useState } from 'react';

export interface Kolega {
  user_id: string;
  role: string;
  /** Jabatan / peran custom yang bisa diubah (mis. Ayah, Ibu, Direktur Utama, Komisaris). */
  title?: string | null;
  isSelf?: boolean;
  status: string;
  profile: {
    id: string;
    email: string;
    client_name: string;
    avatar_url: string | null;
  } | null;
}

export interface KolegaGroup {
  id: string;
  name: string;
  owner_id: string;
  isOwner: boolean;
  members: Kolega[];
  totals: { inflow: number; outflow: number };
}

export interface PendingGroupInvite {
  group_id: string;
  group_name: string;
  owner_id: string;
  owner_name: string;
}

/**
 * Ruang keuangan bersama (kolega): daftar grup, undangan masuk/keluar 2-arah
 * (terima / tolak / batalkan undangan), buat grup, undang kolega, keluar/hapus anggota.
 */
export function useKolega() {
  const [groups, setGroups] = useState<KolegaGroup[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingGroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kolega', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat kolega');
      setGroups(json.groups ?? []);
      setPendingInvites(json.pendingInvites ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat kolega');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createGroup = useCallback(
    async (name: string) => {
      const res = await fetch('/api/kolega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membuat grup');
      await refresh();
    },
    [refresh]
  );

  const invite = useCallback(
    async (groupId: string, email: string) => {
      const res = await fetch('/api/kolega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengundang kolega');
      await refresh();
    },
    [refresh]
  );

  const respondInvite = useCallback(
    async (groupId: string, action: 'accept' | 'reject') => {
      const res = await fetch('/api/kolega', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memproses undangan');
      await refresh();
    },
    [refresh]
  );

  const cancelInvite = useCallback(
    async (groupId: string, targetUserId: string) => {
      const res = await fetch('/api/kolega', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, action: 'cancel', targetUserId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membatalkan undangan');
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (groupId: string, userId: string) => {
      const res = await fetch('/api/kolega', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus kolega');
      await refresh();
    },
    [refresh]
  );

  const updateMemberTitle = useCallback(
    async (groupId: string, targetUserId: string, title: string) => {
      const res = await fetch('/api/kolega', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          action: 'set_title',
          targetUserId,
          title,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan jabatan anggota');
      await refresh();
    },
    [refresh]
  );

  return {
    groups,
    pendingInvites,
    loading,
    error,
    refresh,
    createGroup,
    invite,
    respondInvite,
    cancelInvite,
    remove,
    updateMemberTitle,
  };
}

export type KolegaApi = ReturnType<typeof useKolega>;
