'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface NotificationItem {
  id: string;
  type:
    | 'connection_requested'
    | 'connection_accepted'
    | 'group_member_joined'
    | 'feed_post'
    | 'chat_message';
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  actorName: string | null;
}

/** Interval polling notifikasi (ms). */
const POLL_INTERVAL_MS = 30_000;

/**
 * Notifikasi.
 *
 * Delivery pakai polling, bukan Realtime: polling cuma menarik satu
 * request kecil per 30 detik dan tidak butuh Realtime channel yang
 * harus diaktifkan di sisi Supabase. Untuk aplikasi sekecil ini,
 * Selisih 30 detik Trade-off yang sepadan.
 *
 * Polling langsung berhenti kalau tab tidak aktif - tidak perlu menarik
 * notifikasi untuk orang yang sedang nggak lihat layarnya.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal memuat notifikasi');
      const json = await res.json();
      setNotifications(json.notifications ?? []);
      setUnreadCount(json.unreadCount ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat notifikasi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') refresh();
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    startPolling();

    // Poll lagi begitu tab aktif lagi - bisa ada yang masuk saat tab
    // sedang tidak terlihat.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onMessagesUpdated = () => {
      void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('stashinmeid:messages-updated', onMessagesUpdated);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('stashinmeid:messages-updated', onMessagesUpdated);
    };
  }, [refresh]);

  /** Tandai satu notifikasi terbaca. */
  const markRead = useCallback(
    async (id: string) => {
      // Update lokal duluan supaya UI terasa responsif.
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id && !n.readAt
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (id.startsWith('live-msg:')) {
          window.dispatchEvent(new Event('stashinmeid:chat-sync'));
        }
      } catch {
        // Kalau gagal, polling berikutnya akan menyinkronkan lagi.
      }
    },
    []
  );

  /** Tandai semua terbaca. */
  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.readAt ? n : { ...n, readAt: new Date().toISOString() }
      )
    );
    setUnreadCount(0);

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      window.dispatchEvent(new Event('stashinmeid:chat-sync'));
    } catch {
      // Sama seperti di atas.
    }
  }, []);

  /** Hapus notifikasi. */
  const remove = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      try {
        await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      } catch {
        // Diabaikan.
      }
    },
    []
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    remove,
  };
}

export type NotificationsApi = ReturnType<typeof useNotifications>;
