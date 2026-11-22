import type { Budget, Transaction } from '@/types/finance';
import { parseIsoDate } from '@/lib/format';

/**
 * Logika anggaran (pagu per kategori).
 *
 * Setiap pagu berlaku untuk satu periode berjalan. Jadi pagu bulanan dihitung
 * dari transaksi di bulan yang sama, bukan dari 30 hari terakhir.
 */

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
 * Status satu pagu terhadap-realisasi periode berjalan.
 */
export function budgetStatus(
  budget: Budget,
  transactions: Transaction[],
  now = new Date()
): BudgetStatus {
  const spent = spentInPeriod(transactions, budget.period, now, budget.category);
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
