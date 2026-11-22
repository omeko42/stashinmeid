import type { Budget, Transaction } from '@/types/finance';
import { parseIsoDate } from '@/lib/format';

/**
 * Logika anggaran (pagu per kategori).
 *
 * Mendukung periode standar (mingguan, bulanan, tahunan) sekaligus periode
 * Custom rentang tanggal bebas (1 hari, 2 hari, hingga multi-tahun) yang
 * disandikan secara kompatibel di kolom kategori: "Nama [YYYY-MM-DD..YYYY-MM-DD]".
 */

const CUSTOM_RANGE_RE = /^(.*?)\s*\[(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})\]$/;

export interface ParsedBudgetCategory {
  label: string;
  startIso: string | null;
  endIso: string | null;
  days: number | null;
  isCustom: boolean;
}

export function parseBudgetCategory(raw: string): ParsedBudgetCategory {
  const m = raw.trim().match(CUSTOM_RANGE_RE);
  if (!m) {
    return { label: raw.trim(), startIso: null, endIso: null, days: null, isCustom: false };
  }
  const label = m[1].trim() || raw.trim();
  const startIso = m[2];
  const endIso = m[3];
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const days =
    start && end
      ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
      : null;
  return { label, startIso, endIso, days, isCustom: true };
}

export function encodeCustomBudgetCategory(
  label: string,
  startIso: string,
  endIso: string
): string {
  const clean = label.replace(CUSTOM_RANGE_RE, '$1').trim();
  const [from, to] = startIso <= endIso ? [startIso, endIso] : [endIso, startIso];
  return `${clean} [${from}..${to}]`;
}

/** Awal dan akhir periode berjalan untuk `period`, relatif terhadap `now`. */
export function periodRange(
  period: Budget['period'],
  now = new Date()
): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  if (period === 'weekly') {
    // Minggu berjalan dimulai Senin.
    const day = now.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(y, m, d + offset);
    const end = new Date(y, m, d + offset + 7);
    return { start, end };
  }

  if (period === 'yearly') {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  }

  // monthly
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
}

function spentInCustomRange(
  transactions: Transaction[],
  startIso: string,
  endIso: string,
  category?: string
): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return 0;
  const startMs = start.getTime();
  // Inklusif sampai akhir hari endIso
  const endExclusiveMs = end.getTime() + 86_400_000;
  const normalizedCat = category?.trim().toLowerCase();

  return transactions.reduce((sum, tx) => {
    if (tx.type !== 'outflow') return sum;
    if (normalizedCat && tx.category.trim().toLowerCase() !== normalizedCat) {
      return sum;
    }
    const date = parseIsoDate(tx.transaction_date);
    if (!date) return sum;
    const ms = date.getTime();
    if (ms < startMs || ms >= endExclusiveMs) return sum;
    return sum + Number(tx.amount);
  }, 0);
}

/**
 * Transaksi yang masuk ke periode berjalan (opsional difilter per kategori).
 * Hanya outflow yang dihitung - pagu mengatur pengeluaran, bukan pemasukan.
 */
export function spentInPeriod(
  transactions: Transaction[],
  period: Budget['period'],
  now = new Date(),
  category?: string
): number {
  const { start, end } = periodRange(period, now);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const normalizedCat = category?.trim().toLowerCase();

  return transactions.reduce((sum, tx) => {
    if (tx.type !== 'outflow') return sum;
    if (normalizedCat && tx.category.trim().toLowerCase() !== normalizedCat) {
      return sum;
    }
    const date = parseIsoDate(tx.transaction_date);
    if (!date) return sum;
    const ms = date.getTime();
    if (ms < startMs || ms >= endMs) return sum;
    return sum + Number(tx.amount);
  }, 0);
}

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  /** 0-100, bisa lebih dari 100 kalau pagu terlampaui. */
  percent: number;
  over: boolean;
}

/**
 * Status satu pagu terhadap realisasi periode berjalan / rentang custom.
 */
export function budgetStatus(
  budget: Budget,
  transactions: Transaction[],
  now = new Date()
): BudgetStatus {
  const parsed = parseBudgetCategory(budget.category);
  const spent =
    parsed.isCustom && parsed.startIso && parsed.endIso
      ? spentInCustomRange(transactions, parsed.startIso, parsed.endIso, parsed.label)
      : spentInPeriod(transactions, budget.period, now, parsed.label);
  const limit = Number(budget.amount);
  const remaining = limit - spent;
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;

  return {
    budget,
    spent,
    remaining,
    percent,
    over: spent > limit,
  };
}

/**
 * Semua pagu dengan statusnya, diurutkan dari yang paling mepet.
 */
export function budgetStatuses(
  budgets: Budget[],
  transactions: Transaction[],
  now = new Date()
): BudgetStatus[] {
  return budgets
    .map((b) => budgetStatus(b, transactions, now))
    .sort((a, b) => b.percent - a.percent);
}
