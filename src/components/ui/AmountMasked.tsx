'use client';

import { cn } from '@/lib/cn';
import { maskAmount, useBalancePrivacy } from './BalancePrivacy';

/**
 * Nominal uang, dengan dukungan mode "sembunyikan saldo".
 *
 * Kalau preferensi sembunyikan saldo aktif, angka diganti bullet.
 *
 * Catatan soal hydration: nilai awal `hidden` selalu false, sama dengan
 * render di server. Setelah localStorage selesai dibaca, barulah
 * dibunyikan. Kalau dibalik (dimasking sebelum localStorage terbaca),
 * server render dan client render akan beda dan memicu hydration mismatch.
 */
export function AmountMasked({
  value,
  tone = 'default',
  size = 'md',
  className,
}: {
  value: string;
  tone?: 'default' | 'brand' | 'out' | 'due' | 'info' | 'muted';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  className?: string;
}) {
  const { hidden, ready } = useBalancePrivacy();

  const tones = {
    default: 'text-[var(--text)]',
    brand: 'text-[var(--brand)]',
    out: 'text-[var(--out)]',
    due: 'text-[var(--due)]',
    info: 'text-[var(--info)]',
    muted: 'text-[var(--text-muted)]',
  } as const;

  const sizes = {
    sm: 'text-[13px]',
    md: 'text-[15px]',
    lg: 'text-[18px]',
    xl: 'text-[24px]',
    hero: 'text-[34px] sm:text-[44px] lg:text-[56px]',
  } as const;

  const masked = ready && hidden;

  return (
    <span
      className={cn(
        'tnum font-semibold tracking-[-0.02em] leading-none',
        tones[tone],
        sizes[size],
        className
      )}
      // Screen reader tetap membaca angka aslinya - yang disembunyikan
      // hanya tampilannya.
      aria-label={masked ? undefined : value}
      data-masked={masked ? 'true' : undefined}
    >
      {masked ? maskAmount(value) : value}
    </span>
  );
}
