'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Pita pengumuman & pengingat nyata (tanpa teks dummy!).
 *
 * Hanya muncul jika:
 * 1. Admin menerbitkan pengumuman resmi aktif di Pengaturan (Mode Admin) → Pita Pengumuman, ATAU
 * 2. Ada pengingat keuangan / aktivitas nyata (`liveAlerts`, mis. undangan grup masuk,
 *    cicilan jatuh tempo dalam 7 hari, atau kategori anggaran melampaui batas).
 *
 * Jika tidak ada pengumuman resmi maupun pengingat aktif, pita otomatis disembunyikan.
 */
export function AnnouncementBar({
  liveAlerts = [],
  onClickAlert,
}: {
  liveAlerts?: string[];
  onClickAlert?: () => void;
}) {
  const t = useTranslations('announcement');
  const [adminText, setAdminText] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/announcements', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) {
            setAdminText(null);
            setLoaded(true);
          }
          return;
        }
        const json = await res.json();
        const announcement = json.announcement as { text?: string } | null;
        if (!cancelled) {
          setAdminText(announcement?.text?.trim() || null);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setAdminText(null);
          setLoaded(true);
        }
      }
    };

    void load();

    const onUpdated = () => {
      setHidden(false);
      void load();
    };
    window.addEventListener('stashinmeid:announcement-updated', onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('stashinmeid:announcement-updated', onUpdated);
    };
  }, []);

  const segments = [
    ...(adminText ? [adminText] : []),
    ...liveAlerts,
  ];
  const combinedText = segments.length > 0 ? segments.join('   •   ') : null;

  if (!loaded || !combinedText || hidden) return null;

  const trackItems = [0, 1, 2, 3, 4, 5];

  return (
    <div
      role="status"
      className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--brand-soft)] pt-[env(safe-area-inset-top)]"
    >
      <div
        onClick={onClickAlert}
        className={`ann-marquee flex w-max items-center py-1.5 text-[11px] font-medium text-[var(--brand)] ${
          onClickAlert ? 'cursor-pointer' : ''
        }`}
      >
        {[0, 1].map((groupIdx) => (
          <div
            key={groupIdx}
            aria-hidden={groupIdx === 1 ? true : undefined}
            className="flex shrink-0 items-center gap-6 pr-6"
          >
            {trackItems.map((itemIdx) => (
              <span
                key={itemIdx}
                aria-hidden={groupIdx === 1 || itemIdx > 0 ? true : undefined}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap"
              >
                <Megaphone className="size-3 shrink-0" aria-hidden />
                <span>{combinedText}</span>
                <span
                  aria-hidden
                  className="ml-4 text-[10px] text-[var(--brand)]/50"
                >
                  •
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label={t('dismiss')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[var(--surface-1)]/85 p-1.5 text-[var(--text-muted)] shadow-sm backdrop-blur-sm transition hover:text-[var(--text)]"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  );
}
