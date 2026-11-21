import type { Locale } from '@/i18n/routing';

/**
 * Zona waktu aplikasi.
 *
 * Server (Vercel) berjalan di UTC, sedangkan pengguna mostly di WIB (UTC+7).
 * Kalau render memakai zona waktu lokal masing-masing mesin, HTML dari server
 * dan dari browser berbeda - memicu hydration mismatch (React error #418) dan
 * membuat "hari ini" bergeser satu hari.
 *
 * Jadi semua tanggal di app dikunci ke zona ini: server dan browser
 * menghitung hari yang sama.
 */
export const APP_TIMEZONE = 'Asia/Jakarta';

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
 * Tanggal hari ini dalam zona waktu aplikasi, format YYYY-MM-DD.
 *
 * `Intl.DateTimeFormat` dengan `timeZone` memberi hasil yang sama di server
 * dan browser, jadi aman dipakai saat render (tidak memicu hydration
 * mismatch) - berbeda dengan `new Date()` yang memakai zona lokal mesin.
 */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * "Sekarang" dalam zona waktu aplikasi.
 *
 * Dipakai untuk membandingkan tanggal jatuh tempo, label sumbu chart, dan
 * "x menit lalu" - semuanya harus memakai zona yang sama di server dan
 * browser.
 */
export function appNow(): Date {
  // Representasi "dinding jam lokal" pada zona aplikasi: Ambil waktu UTC,
  // lalu geser sebesar offset zona aplikasi terhadap UTC pada tanggal itu.
  const now = new Date();
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  return new Date(
    Number(iso.year),
    Number(iso.month) - 1,
    Number(iso.day),
    Number(iso.hour) % 24,
    Number(iso.minute),
    Number(iso.second)
  );
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

  const now = appNow();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Tanggal jatuh tempo berikutnya untuk debt dengan `due_day`.
 */
export function nextDueDate(dueDay: number, from = appNow()): Date {
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
