import type { Transaction } from '@/types/finance';
import { appNow, parseIsoDate, todayIso } from '@/lib/format';

export type PeriodPreset =
  | 'all'
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'custom';

export interface PeriodFilterState {
  preset: PeriodPreset;
  /** Tanggal acuan (YYYY-MM-DD) untuk mode 'day' (hari itu) dan 'week' (akhir rentang 7 hari). */
  date: string;
  /** Bulan 1..12 untuk mode 'month'. */
  month: number;
  /** Tahun (mis. 2026) untuk mode 'month' dan 'year'. */
  year: number;
  /** Rentang awal (YYYY-MM-DD) untuk mode 'custom'. */
  startDate: string;
  /** Rentang akhir (YYYY-MM-DD) untuk mode 'custom'. */
  endDate: string;
}

export function createDefaultPeriodFilter(
  preset: PeriodPreset = 'month',
  now = appNow()
): PeriodFilterState {
  const today = todayIso();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const startOfMonth = `${y}-${String(m).padStart(2, '0')}-01`;
  return {
    preset,
    date: today,
    month: m,
    year: y,
    startDate: startOfMonth,
    endDate: today,
  };
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Mengembalikan rentang tanggal inklusif [start, end] (YYYY-MM-DD),
 * atau `null` bila `all` (Semua waktu).
 */
export function resolvePeriodRange(
  filter: PeriodFilterState,
  now = appNow()
): { start: string; end: string } | null {
  const today = todayIso();

  switch (filter.preset) {
    case 'all':
      return null;

    case 'day': {
      const target = filter.date || today;
      return { start: target, end: target };
    }

    case 'week': {
      const anchor = parseIsoDate(filter.date || today) ?? now;
      const start = new Date(
        anchor.getFullYear(),
        anchor.getMonth(),
        anchor.getDate() - 6
      );
      return { start: toIso(start), end: toIso(anchor) };
    }

    case 'month': {
      const y = filter.year || now.getFullYear();
      const m = Math.min(12, Math.max(1, filter.month || now.getMonth() + 1));
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { start: toIso(start), end: toIso(end) };
    }

    case 'year': {
      const y = filter.year || now.getFullYear();
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }

    case 'custom': {
      const a = filter.startDate || today;
      const b = filter.endDate || today;
      return a <= b ? { start: a, end: b } : { start: b, end: a };
    }
  }
}

/**
 * Menyaring transaksi berdasarkan periode aktif.
 */
export function filterTransactionsByPeriod(
  transactions: Transaction[],
  filter: PeriodFilterState,
  now = appNow()
): Transaction[] {
  const range = resolvePeriodRange(filter, now);
  if (!range) return transactions;
  return transactions.filter((tx) => {
    const iso = tx.transaction_date?.slice(0, 10);
    if (!iso) return false;
    return iso >= range.start && iso <= range.end;
  });
}

/**
 * Daftar tahun unik dari transaksi + tahun sekarang (diurutkan terbaru ke terlama).
 */
export function extractAvailableYears(
  transactions: Transaction[],
  now = appNow()
): number[] {
  const set = new Set<number>([now.getFullYear()]);
  for (const tx of transactions) {
    const y = Number(tx.transaction_date?.slice(0, 4));
    if (Number.isInteger(y) && y >= 1970 && y <= 2100) {
      set.add(y);
    }
  }
  return [...set].sort((a, b) => b - a);
}

/**
 * Label ringkas untuk badge/header periode aktif.
 */
export function formatPeriodLabel(
  filter: PeriodFilterState,
  isEn = false,
  now = appNow()
): string {
  const today = todayIso();
  const localeStr = isEn ? 'en-GB' : 'id-ID';

  switch (filter.preset) {
    case 'all':
      return isEn ? 'All Time' : 'Semua';

    case 'day': {
      if (!filter.date || filter.date === today) {
        return isEn ? 'Today' : 'Hari ini';
      }
      const d = parseIsoDate(filter.date);
      return d
        ? new Intl.DateTimeFormat(localeStr, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }).format(d)
        : filter.date;
    }

    case 'week': {
      if (!filter.date || filter.date === today) {
        return isEn ? '7 Days' : '7 Hari';
      }
      const range = resolvePeriodRange(filter, now);
      if (!range) return isEn ? 'Week' : 'Minggu';
      const s = parseIsoDate(range.start);
      const e = parseIsoDate(range.end);
      if (!s || !e) return isEn ? 'Week' : 'Minggu';
      const fmt = new Intl.DateTimeFormat(localeStr, {
        day: 'numeric',
        month: 'short',
      });
      return `${fmt.format(s)} – ${fmt.format(e)}`;
    }

    case 'month': {
      const y = filter.year || now.getFullYear();
      const m = Math.min(12, Math.max(1, filter.month || now.getMonth() + 1));
      return new Intl.DateTimeFormat(localeStr, {
        month: 'short',
        year: 'numeric',
      }).format(new Date(y, m - 1, 1));
    }

    case 'year': {
      const y = filter.year || now.getFullYear();
      return isEn ? `Year ${y}` : `Tahun ${y}`;
    }

    case 'custom': {
      const range = resolvePeriodRange(filter, now);
      if (!range) return 'Custom';
      const s = parseIsoDate(range.start);
      const e = parseIsoDate(range.end);
      if (!s || !e) return 'Custom';
      const fmt = new Intl.DateTimeFormat(localeStr, {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      });
      if (range.start === range.end) return fmt.format(s);
      return `${fmt.format(s)} – ${fmt.format(e)}`;
    }
  }
}
