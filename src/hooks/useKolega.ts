'use client';

import { useCallback, useEffect, useState } from 'react';

export interface Kolega {
  user_id: string;
  role: string;
  status: string;
  profile: { id: string; email: string; client_name: string; avatar_url: string | null } | null;
}

export interface KolegaGroup {
  id: string;
  name: string;
  owner_id: string;
  isOwner: boolean;
  members: Kolega[];
  totals: { inflow: number; outflow: number };
}

/**
 * Ruang keuangan bersama (kolega): daftar grup, buat grup, undang kolega
 * by email, keluar/tendang anggota. Data mentah dari /api/kolega.
 */
export function useKolega() {
  const [groups, setGroups] = useState<KolegaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kolega', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat kolega');
      setGroups(json.groups ?? []);
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

  return { groups, loading, error, refresh, createGroup, invite, remove };
}

export type KolegaApi = ReturnType<typeof useKolega>;
