'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ConnectionProfile {
  id: string;
  email: string;
  client_name: string;
  avatar_url: string | null;
}

export interface Connection {
  id: string;
  user_id: string;
  /** 'incoming' = orang ini mengirim permintaan ke saya. */
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'accepted';
  created_at: string;
  profile: ConnectionProfile | null;
}

/**
 * Kolega (pertemanan 2-arah).
 *
 * Terpisah dari grup keuangan: becoming kolega tidak memberi akses ke
 * transaksi satu sama lain. Ini murni sosial.
 */
export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kolega/connections', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat kolega');
      setConnections(json.connections ?? []);
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

  /** Kirim permintaan koneksi ke user lain. */
  const request = useCallback(async (userId: string) => {
    const res = await fetch('/api/kolega/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal mengirim permintaan');
    await refresh();
  }, [refresh]);

  /** Terima / tolak / hapus koneksi. */
  const respond = useCallback(
    async (connectionId: string, action: 'accept' | 'reject' | 'remove') => {
      const res = await fetch('/api/kolega/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui koneksi');
      await refresh();
    },
    [refresh]
  );

  const accepted = connections.filter((c) => c.status === 'accepted');
  const incoming = connections.filter(
    (c) => c.direction === 'incoming' && c.status === 'pending'
  );
  const outgoing = connections.filter(
    (c) => c.direction === 'outgoing' && c.status === 'pending'
  );

  return {
    connections,
    accepted,
    incoming,
    outgoing,
    loading,
    error,
    refresh,
    request,
    respond,
  };
}

export type ConnectionsApi = ReturnType<typeof useConnections>;
