import type { Transaction } from '@/types/finance';
import { appNow, parseIsoDate, todayIso } from '@/lib/format';

export type PeriodPreset =
  | 'day'
  | 'week'
  | 'month'
  | 'ytd'
  | 'year'
  | 'all'
  | 'custom';

export interface PeriodFilterState {
  preset: PeriodPreset;
  startDate: string; // YYYY-MM-DD (dipakai untuk custom)
  endDate: string; // YYYY-MM-DD (dipakai untuk custom)
}

export function createDefaultPeriodFilter(
  preset: PeriodPreset = 'month',
  now = appNow()
): PeriodFilterState {
  const end = todayIso();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return {
    preset,
    startDate: startOfMonth,
    endDate: end,
  };
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Mengembalikan rentang tanggal inklusif [start, end] (YYYY-MM-DD) untuk preset,
 * atau `null` bila `all` (Semua waktu).
 */
export function resolvePeriodRange(
  filter: PeriodFilterState,
  now = appNow()
): { start: string; end: string } | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (filter.preset) {
    case 'all':
      return null;
    case 'day': {
      const iso = toIso(new Date(y, m, d));
      return { start: iso, end: iso };
    }
    case 'week': {
      const start = toIso(new Date(y, m, d - 6));
      const end = toIso(new Date(y, m, d));
      return { start, end };
    }
    case 'month': {
      const start = toIso(new Date(y, m, 1));
      const end = toIso(new Date(y, m + 1, 0));
      return { start, end };
    }
    case 'ytd': {
      const start = `${y}-01-01`;
      const end = toIso(new Date(y, m, d));
      return { start, end };
    }
    case 'year': {
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    case 'custom': {
      const a = filter.startDate || toIso(new Date(y, m, 1));
      const b = filter.endDate || toIso(new Date(y, m, d));
      return a <= b ? { start: a, end: b } : { start: b, end: a };
    }
  }
}

/**
 * Menyaring transaksi berdasarkan periode aktif.
 * Memakai perbandingan leksikografis YYYY-MM-DD agar bebas bug zona waktu.
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
 * Label ringkas untuk tombol filter & badge periode di Hero.
 */
export function formatPeriodLabel(
  filter: PeriodFilterState,
  isEn = false,
  now = appNow()
): string {
  const y = now.getFullYear();
  switch (filter.preset) {
    case 'day':
      return isEn ? 'Today' : 'Hari ini';
    case 'week':
      return isEn ? '7 Days' : '7 Hari';
    case 'month':
      return isEn ? 'This Month' : 'Bulan ini';
    case 'ytd':
      return `YTD ${y}`;
    case 'year':
      return isEn ? `Year ${y}` : `Tahun ${y}`;
    case 'all':
      return isEn ? 'All Time' : 'Semua';
    case 'custom': {
      const range = resolvePeriodRange(filter, now);
      if (!range) return 'Custom';
      const s = parseIsoDate(range.start);
      const e = parseIsoDate(range.end);
      if (!s || !e) return 'Custom';
      const fmt = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'id-ID', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      });
      if (range.start === range.end) return fmt.format(s);
      // Cek bila persis satu tahun penuh (YYYY-01-01 s/d YYYY-12-31)
      if (
        range.start.endsWith('-01-01') &&
        range.end.endsWith('-12-31') &&
        range.start.slice(0, 4) === range.end.slice(0, 4)
      ) {
        return range.start.slice(0, 4);
      }
      return `${fmt.format(s)} – ${fmt.format(e)}`;
    }
  }
}
