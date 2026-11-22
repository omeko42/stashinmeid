'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Pita pengumuman di paling atas (di bawah safe-area iPhone, di atas
 * header mobile / konten desktop). Teksnya berjalan pelan (marquee).
 *
 * Teksnya diambil dari database (tabel `announcements`), jadi superadmin
 * bisa mengubahnya dari Pengaturan tanpa deploy ulang. Kalau tabelnya
 * belum ada atau tidak ada pengumuman aktif, pita tidak ditampilkan.
 *
 * Ditutup: ingat per perangkat di localStorage, kunci mengikuti isi teks
 * supaya pengumuman baru selalu muncul lagi.
 */
export function AnnouncementBar() {
  const t = useTranslations('announcement');
  const [text, setText] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/announcements', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;

        const announcement = json.announcement as { text?: string } | null;
        const value = announcement?.text?.trim() || null;
        setText(value);

        if (value) {
          setHidden(window.localStorage.getItem('annDismissed') === value);
        } else {
          setHidden(true);
        }
      } catch {
        // Kalau API tidak bisa dihubungi, pita tidak ditampilkan - lebih
        // baik daripada menampilkan teks hardcoded yang bisa basi.
        if (!cancelled) setHidden(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!text || hidden) return null;

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
