'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Pita pengumuman & pengingat nyata (tanpa teks dummy!).
 *
 * Menampilkan pengumuman resmi Admin dan pengingat aktivitas nyata
 * (pesan obrolan masuk, permintaan kolega, undangan grup, cicilan jatuh tempo)
 * dengan jarak antar-item lega dan kecepatan gulir santai.
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

  if (!loaded || segments.length === 0 || hidden) return null;

  // Ulangi daftar secukupnya agar loop marquee selalu mulus tanpa ruang kosong
  const repeatedSegments =
    segments.length >= 3
      ? [...segments, ...segments]
      : [...segments, ...segments, ...segments, ...segments];

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
            className="flex shrink-0 items-center"
          >
            {repeatedSegments.map((text, itemIdx) => (
              <span
                key={`${groupIdx}-${itemIdx}`}
                aria-hidden={groupIdx === 1 || itemIdx >= segments.length ? true : undefined}
                className="inline-flex shrink-0 items-center whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-2">
                  <Megaphone className="size-3 shrink-0" aria-hidden />
                  <span>{text}</span>
                </span>
                <span
                  aria-hidden
                  className="mx-8 text-[11px] text-[var(--brand)]/45 select-none"
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
