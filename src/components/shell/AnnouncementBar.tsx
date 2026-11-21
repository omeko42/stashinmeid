'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Pita pengumuman di paling atas (di bawah safe-area iPhone, di atas
 * header mobile / konten desktop). Teksnya berjalan pelan (marquee).
 *
 * Isi diubah di src/messages/{id,en}.json -> announcement.text.
 * Ditutup: ingat per sesi localStorage, kunci mengikuti isi teks supaya
 * pengumuman baru selalu muncul lagi.
 */
export function AnnouncementBar() {
  const t = useTranslations('announcement');
  const text = t('text');

  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    setHidden(window.localStorage.getItem('annDismissed') === text);
  }, [text]);

  if (hidden) return null;

  const dismiss = () => {
    window.localStorage.setItem('annDismissed', text);
    setHidden(true);
  };

  return (
    <div
      role="status"
      className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--brand-soft)] pt-[env(safe-area-inset-top)]"
    >
      <div className="ann-marquee flex w-max items-center gap-16 py-1.5 pl-6 text-[11px] font-medium text-[var(--brand)]">
        <span className="inline-flex items-center gap-1.5">
          <Megaphone className="size-3" aria-hidden />
          {text}
        </span>
        {/* Duplikat supaya loop marquee mulus tanpa putus */}
        <span aria-hidden>{text}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-[var(--surface-1)]/70 p-1.5 text-[var(--text-muted)] transition hover:text-[var(--text)]"
      >
        <X className="size-3" aria-hidden />
      </button>
    </div>
  );
}
