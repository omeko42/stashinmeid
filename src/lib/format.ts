import type { Locale } from '@/i18n/routing';

/**
 * Format angka rupiah.
 * Semua angka uang di app ini melewati fungsi ini supaya konsisten.
 */
export function formatRp(amount: number, locale: Locale = 'id'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-ID' : 'id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format angka ringkas untuk axis chart: 1.2jt, 350rb, 500.
 */
export function formatShortRp(value: number, locale: Locale = 'id'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const suffix = locale === 'en' ? ['K', 'M', 'B'] : ['rb', 'jt', 'M'];

  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}${suffix[2]}`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}${suffix[1]}`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}${suffix[0]}`;
  return `${sign}${abs}`;
}

/**
 * Format tanggal ISO (YYYY-MM-DD) jadi formatPendek yang enak dibaca.
 */
export function formatDate(
  iso: string,
  locale: Locale = 'id',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', options).format(date);
}

export function formatFullDate(iso: string, locale: Locale = 'id'): string {
  return formatDate(iso, locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Tanggal hari ini dalam zona waktu pengguna, format YYYY-MM-DD.
 */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().split('T')[0];
}

/**
 * Ubah "YYYY-MM-DD" jadi Date tanpa pergeseran zona waktu.
 * `new Date('2026-11-20')` di-parse sebagai UTC lalu tampil jadi tanggal
 * sebelumnya di zona waktu negatif - itu bugs yang sering muncul.
 */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/**
 * Selisih hari dari hari ini ke tanggal ISO. Negatif = sudah lewat.
 */
export function daysUntil(iso: string): number {
  const target = parseIsoDate(iso);
  if (!target) return Number.POSITIVE_INFINITY;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Tanggal jatuh tempo berikutnya untuk debt dengan `due_day`.
 */
export function nextDueDate(dueDay: number, from = new Date()): Date {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const maxDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const clamped = Math.min(Math.max(dueDay, 1), maxDay);

  let next = new Date(today.getFullYear(), today.getMonth(), clamped);
  if (next.getTime() < today.getTime()) {
    const nextMonth = today.getMonth() + 1;
    const maxNext = new Date(today.getFullYear(), nextMonth + 1, 0).getDate();
    next = new Date(today.getFullYear(), nextMonth, Math.min(clamped, maxNext));
  }
  return next;
}
