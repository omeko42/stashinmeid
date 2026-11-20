import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Permukaan dasar.
 *
 * Level permukaannya sengaja dibuat berbeda supaya hierarki terlihat:
 * - `hero`  : pita utama, tanpa radius, garis bawah tegas
 * - `panel` : blok berisi satu topik, radius medium
 * - `row`   : baris data, tanpa radius, dipisah garis
 *
 * Semua komponen lain harus pakai ini, bukan bikin `rounded-3xl` sendiri.
 */
export function Surface({
  children,
  level = 'panel',
  className,
}: {
  children: ReactNode;
  level?: 'hero' | 'panel' | 'row' | 'flat';
  className?: string;
}) {
  const base = 'bg-[var(--surface-1)]';

  const levels = {
    hero: `${base} border-b border-[var(--line)]`,
    panel: `${base} border border-[var(--line)] rounded-xl`,
    row: 'border-b border-[var(--line)] last:border-b-0',
    flat: 'bg-transparent',
  } as const;

  return <div className={cn(levels[level], className)}>{children}</div>;
}

/**
 * Garis pemisah. Dipakai sebagai elemen visual, bukan spacing.
 */
export function Rule({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-[var(--line)]', className)} />;
}

/**
 * Label kecil di atas konten. Bukan eyebrow ALL-CAPS - ini gaya ledger:
 * huruf besar, rapat, warna redup.
 */
export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]',
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Judul seksi.
 */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="text-[15px] font-semibold text-[var(--text)]">{children}</h2>
      {action}
    </div>
  );
}

/**
 * Nilai angka besar. Semua angka uang di app ini lewat komponen ini supaya
 * tipografi dan align-nya konsisten.
 */
export function Amount({
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

  return (
    <span
      className={cn(
        'tnum font-semibold tracking-[-0.02em] leading-none',
        tones[tone],
        sizes[size],
        className
      )}
    >
      {value}
    </span>
  );
}

/**
 * Progress bar tipis untuk progress bar tenor / pagu anggaran.
 */
export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  value: number;
  tone?: 'brand' | 'out' | 'due';
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const tones = {
    brand: 'bg-[var(--brand)]',
    out: 'bg-[var(--out)]',
    due: 'bg-[var(--due)]',
  } as const;

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
