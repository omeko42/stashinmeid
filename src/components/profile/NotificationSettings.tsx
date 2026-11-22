'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Megaphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { BrandLoader } from '@/components/ui/BrandLoader';

const NOTIFICATION_TYPES = [
  'connection_requested',
  'connection_accepted',
  'group_member_joined',
  'feed_post',
  'chat_message',
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Ambil teks terjemahan dengan fallback.
 *
 * next-intl melempar error kalau key-nya tidak ada, dan itu terjadi saat
 * render di server - hasilnya seluruh halaman crash, bukan cuma komponen
 * ini yang kosong. Jadi di sini aman: kalau key hilang, pakai teks
 * cadangan yang masih terbaca.
 */
function safeTranslate(
  t: (key: string) => string,
  key: string,
  fallback: string
): string {
  try {
    return t(key);
  } catch {
    return fallback;
  }
}

/**
 * Preferensi notifikasi per user.
 *
 * Tiap jenis notifikasi bisa dimatikan sendiri-sendiri. Kalau dimatikan,
 * fungsi SQL `create_notification()` tidak membuat barisnya - jadi ini
 * bukan sekadar menyembunyikan tampilan, tapi benar-benar tidak dikirim.
 */
export function NotificationPreferences() {
  const t = useTranslations('settings.notifications');
  const [preferences, setPreferences] = useState<
    Partial<Record<NotificationType, boolean>>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<NotificationType | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/notifications/preferences');
        if (!res.ok) throw new Error('Gagal memuat preferensi');
        const json = await res.json();
        setPreferences(json.preferences ?? {});
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal memuat preferensi');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggle = useCallback(
    async (type: NotificationType, enabled: boolean) => {
      // Update lokal duluan supaya toggle terasa responsif.
      setPreferences((prev) => ({ ...prev, [type]: enabled }));
      setSaving(type);

      try {
        const res = await fetch('/api/notifications/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: { [type]: enabled } }),
        });
        if (!res.ok) throw new Error('Gagal menyimpan preferensi');
      } catch (e) {
        // Kembalikan ke nilai sebelumnya kalau gagal disimpan.
        setPreferences((prev) => ({ ...prev, [type]: !enabled }));
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan preferensi');
      } finally {
        setSaving(null);
      }
    },
    []
  );

  if (loading) {
    return <BrandLoader size="sm" showSkeleton skeletonRows={3} />;
  }

  return (
    <div className="space-y-3">
      {NOTIFICATION_TYPES.map((type) => (
        <div
          key={type}
          className="flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3"
        >
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text)]">
              {safeTranslate(t, `types.${type}.title`, type)}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">
              {safeTranslate(t, `types.${type}.hint`, '')}
            </p>
          </div>
          <Toggle
            checked={preferences[type] !== false}
            onChange={(checked) => toggle(type, checked)}
            disabled={saving === type}
            label={safeTranslate(t, `types.${type}.title`, type)}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Pita pengumuman - hanya untuk superadmin.
 *
 * Teksnya disimpan di database, jadi bisa diubah kapan saja tanpa deploy.
 * Hanya boleh ada satu pengumuman aktif: setiap publish mematikan yang
 * sebelumnya.
 */
export function AnnouncementEditor() {
  const t = useTranslations('settings.announcement');
  const [current, setCurrent] = useState<{ id: string; text: string } | null>(
    null
  );
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements', { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal memuat pengumuman');
      const json = await res.json();
      setCurrent(json.announcement ?? null);
      setDraft(json.announcement?.text ?? '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat pengumuman');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async () => {
    const text = draft.trim();
    if (!text) {
      toast.error(t('empty'));
      return;
    }
    if (text.length > 500) {
      toast.error(t('tooLong'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Gagal memuat pengumuman');
      }
      await load();
      window.dispatchEvent(new CustomEvent('stashinmeid:announcement-updated'));
      toast.success(t('published'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat pengumuman');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/announcements?id=${current.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus pengumuman');
      setCurrent(null);
      setDraft('');
      window.dispatchEvent(new CustomEvent('stashinmeid:announcement-updated'));
      toast.success(t('removed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus pengumuman');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <BrandLoader size="sm" showSkeleton skeletonRows={3} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-[var(--brand)]" aria-hidden />
        <p className="text-[13px] font-medium text-[var(--text)]">
          {t('title')}
        </p>
        {current && (
          <span className="rounded bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
            {t('active')}
          </span>
        )}
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
        {t('hint')}
      </p>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('placeholder')}
        maxLength={500}
        rows={3}
        disabled={saving}
      />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={publish} loading={saving} icon={<Send className="size-3.5" />}>
          {t('publish')}
        </Button>
        {current && (
          <Button size="sm" variant="secondary" onClick={remove} disabled={saving}>
            {t('remove')}
          </Button>
        )}
        <span className="ml-auto text-[11px] tabular-nums text-[var(--text-faint)]">
          {draft.length}/500
        </span>
      </div>
    </div>
  );
}
