'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Pita pengumuman di paling atas (di bawah safe-area iPhone, di atas
 * header mobile / konten desktop). Teksnya berjalan pelan (marquee).
 *
 * - Ditutup (tombol X): hanya menyembunyikan untuk tampilan saat ini,
 *   sehingga saat halaman di-reload pita muncul kembali.
 * - Jarak antar teks dibuat rapat & konsisten (gap-6 dengan pemisah titik),
 *   dan kecepatan gulir diperlambat agar nyaman dibaca di layar lebar.
 */
export function AnnouncementBar() {
  const t = useTranslations('announcement');
  const defaultText = t('text');
  const [text, setText] = useState<string>(defaultText);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyText = (value: string | null) => {
      if (cancelled) return;
      const finalValue = value?.trim() || defaultText;
      setText(finalValue);
    };

    const load = async () => {
      try {
        const res = await fetch('/api/announcements', { cache: 'no-store' });
        if (!res.ok) {
          applyText(defaultText);
          return;
        }
        const json = await res.json();
        const announcement = json.announcement as { text?: string } | null;
        applyText(announcement?.text ?? defaultText);
      } catch {
        applyText(defaultText);
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
  }, [defaultText]);

  if (!text || hidden) return null;

  const dismiss = () => {
    setHidden(true);
  };

  // 6 item per track supaya di layar ultra-wide sekalipun selalu penuh
  // tanpa perlu justify-around yang membuat jarak antar teks terlalu jauh.
  const trackItems = [0, 1, 2, 3, 4, 5];

  return (
    <div
      role="status"
      className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--brand-soft)] pt-[env(safe-area-inset-top)]"
    >
      <div className="ann-marquee flex w-max items-center py-1.5 text-[11px] font-medium text-[var(--brand)]">
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
                <span>{text}</span>
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
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[var(--surface-1)]/85 p-1.5 text-[var(--text-muted)] shadow-sm backdrop-blur-sm transition hover:text-[var(--text)]"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  );
}
