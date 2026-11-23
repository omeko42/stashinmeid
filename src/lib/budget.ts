import type { Budget, Transaction } from '@/types/finance';
import { appNow, parseIsoDate } from '@/lib/format';

/**
 * Logika anggaran (pagu per kategori) dengan dukungan:
 * - Periode standar (mingguan, bulanan, tahunan) & Custom rentang tanggal bebas
 * - Kuantitas (Qty) + Satuan (default SBM 2025: OH, OT, OB, OJ, OK + Hari, Orang, Paket, Pcs
 *   + satuan custom bebas yang tersimpan di memori user)
 * - Tersambung otomatis ke realisasi Outflow pada periode aktif.
 *
 * Metadata disandikan secara backward-compatible di kolom kategori:
 *   "Nama [YYYY-MM-DD..YYYY-MM-DD] {qty|unit}"
 */

const CUSTOM_RANGE_RE = /\s*\[(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})\]/;
const QTY_UNIT_RE = /\s*\{(\d+(?:\.\d+)?)\|([^}]+)\}/;

export const DEFAULT_BUDGET_UNITS: { value: string; hintId: string; hintEn: string }[] = [
  { value: 'OH', hintId: 'Orang / Hari (SBM)', hintEn: 'Person / Day (OH)' },
  { value: 'OT', hintId: 'Orang / Tahun (SBM)', hintEn: 'Person / Year (OT)' },
  { value: 'OB', hintId: 'Orang / Bulan (SBM)', hintEn: 'Person / Month (OB)' },
  { value: 'OJ', hintId: 'Orang / Jam (SBM)', hintEn: 'Person / Hour (OJ)' },
  { value: 'OK', hintId: 'Orang / Kegiatan (SBM)', hintEn: 'Person / Activity (OK)' },
  { value: 'Hari', hintId: 'Per hari', hintEn: 'Per day' },
  { value: 'Orang', hintId: 'Per orang', hintEn: 'Per person' },
  { value: 'Paket', hintId: 'Per paket', hintEn: 'Per package' },
  { value: 'Pcs', hintId: 'Per buah / item', hintEn: 'Per piece' },
];

const CUSTOM_UNITS_STORAGE_KEY = 'stashinme_budget_custom_units';

export function loadCustomBudgetUnits(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_UNITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .slice(0, 40);
  } catch {
    return [];
  }
}

export function rememberCustomBudgetUnit(unit: string): string[] {
  const clean = unit.trim().replace(/[|{}[\]]/g, '').slice(0, 24);
  if (!clean) return loadCustomBudgetUnits();
  const isDefault = DEFAULT_BUDGET_UNITS.some(
    (u) => u.value.toLowerCase() === clean.toLowerCase()
  );
  const existing = loadCustomBudgetUnits();
  if (isDefault) return existing;
  const next = [
    clean,
    ...existing.filter((u) => u.toLowerCase() !== clean.toLowerCase()),
  ].slice(0, 40);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Abaikan bila storage penuh
    }
  }
  return next;
}

export interface ParsedBudgetCategory {
  label: string;
  startIso: string | null;
  endIso: string | null;
  days: number | null;
  isCustom: boolean;
  qty: number | null;
  unit: string | null;
}

export function parseBudgetCategory(raw: string): ParsedBudgetCategory {
  let working = raw.trim();
  let qty: number | null = null;
  let unit: string | null = null;
  let startIso: string | null = null;
  let endIso: string | null = null;
  let days: number | null = null;
  let isCustom = false;

  const qm = working.match(QTY_UNIT_RE);
  if (qm) {
    const n = Number(qm[1]);
    const u = qm[2].trim();
    if (Number.isFinite(n) && n > 0 && u) {
      qty = n;
      unit = u;
    }
    working = working.replace(QTY_UNIT_RE, '').trim();
  }

  const rm = working.match(CUSTOM_RANGE_RE);
  if (rm) {
    startIso = rm[1];
    endIso = rm[2];
    isCustom = true;
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    days =
      start && end
        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
        : null;
    working = working.replace(CUSTOM_RANGE_RE, '').trim();
  }

  return {
    label: working || raw.trim(),
    startIso,
    endIso,
    days,
    isCustom,
    qty,
    unit,
  };
}

export function encodeBudgetCategory(
  label: string,
  opts?: {
    startIso?: string | null;
    endIso?: string | null;
    qty?: number | null;
    unit?: string | null;
  }
): string {
  const clean = label
    .replace(QTY_UNIT_RE, '')
    .replace(CUSTOM_RANGE_RE, '')
    .trim();
  let result = clean;
  if (opts?.startIso && opts?.endIso) {
    const [from, to] =
      opts.startIso <= opts.endIso
        ? [opts.startIso, opts.endIso]
        : [opts.endIso, opts.startIso];
    result = `${result} [${from}..${to}]`;
  }
  const q = Number(opts?.qty ?? 0);
  const u = (opts?.unit ?? '').trim().replace(/[|{}[\]]/g, '').slice(0, 24);
  if (Number.isFinite(q) && q > 0 && u) {
    const qStr = Number.isInteger(q) ? String(q) : String(Number(q.toFixed(2)));
    result = `${result} {${qStr}|${u}}`;
  }
  return result;
}

export function encodeCustomBudgetCategory(
  label: string,
  startIso: string,
  endIso: string
): string {
  return encodeBudgetCategory(label, { startIso, endIso });
}

/** Awal dan akhir periode berjalan untuk `period`, relatif terhadap `now`. */
export function periodRange(
  period: Budget['period'],
  now = appNow()
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

function matchOutflowCategory(tx: Transaction, normalizedCat?: string): boolean {
  if (!normalizedCat) return true;
  if (tx.category.trim().toLowerCase() === normalizedCat) return true;
  // Dukungan bila user menamai anggaran khusus (mis. "Perjalanan Dinas") yang cocok di keterangan
  if (tx.description && tx.description.trim().toLowerCase().includes(normalizedCat)) {
    return true;
  }
  return false;
}

function spentInCustomRangeDetailed(
  transactions: Transaction[],
  startIso: string,
  endIso: string,
  category?: string
): { total: number; count: number } {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return { total: 0, count: 0 };
  const startMs = start.getTime();
  const endExclusiveMs = end.getTime() + 86_400_000;
  const normalizedCat = category?.trim().toLowerCase();

  let total = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.type !== 'outflow') continue;
    if (!matchOutflowCategory(tx, normalizedCat)) continue;
    const date = parseIsoDate(tx.transaction_date);
    if (!date) continue;
    const ms = date.getTime();
    if (ms < startMs || ms >= endExclusiveMs) continue;
    total += Number(tx.amount);
    count += 1;
  }
  return { total, count };
}

/**
 * Transaksi yang masuk ke periode berjalan (opsional difilter per kategori).
 * Hanya outflow yang dihitung - pagu mengatur pengeluaran, bukan pemasukan.
 */
function spentInPeriodDetailed(
  transactions: Transaction[],
  period: Budget['period'],
  now = appNow(),
  category?: string
): { total: number; count: number } {
  const { start, end } = periodRange(period, now);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const normalizedCat = category?.trim().toLowerCase();

  let total = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.type !== 'outflow') continue;
    if (!matchOutflowCategory(tx, normalizedCat)) continue;
    const date = parseIsoDate(tx.transaction_date);
    if (!date) continue;
    const ms = date.getTime();
    if (ms < startMs || ms >= endMs) continue;
    total += Number(tx.amount);
    count += 1;
  }
  return { total, count };
}

export function spentInPeriod(
  transactions: Transaction[],
  period: Budget['period'],
  now = appNow(),
  category?: string
): number {
  return spentInPeriodDetailed(transactions, period, now, category).total;
}

export interface BudgetStatus {
  budget: Budget;
  parsed: ParsedBudgetCategory;
  spent: number;
  matchedTxCount: number;
  remaining: number;
  /** 0-100, bisa lebih dari 100 kalau pagu terlampaui. */
  percent: number;
  over: boolean;
  /** Harga satuan = total pagu / qty (bila qty diisi). */
  unitPrice: number | null;
  /** Realisasi outflow dalam satuan qty (spent / unitPrice). */
  spentQty: number | null;
  /** Sisa kuota dalam satuan qty. */
  remainingQty: number | null;
}

/**
 * Status satu pagu terhadap realisasi periode berjalan / rentang custom.
 */
export function budgetStatus(
  budget: Budget,
  transactions: Transaction[],
  now = appNow()
): BudgetStatus {
  const parsed = parseBudgetCategory(budget.category);
  const { total: spent, count: matchedTxCount } =
    parsed.isCustom && parsed.startIso && parsed.endIso
      ? spentInCustomRangeDetailed(transactions, parsed.startIso, parsed.endIso, parsed.label)
      : spentInPeriodDetailed(transactions, budget.period, now, parsed.label);
  const limit = Number(budget.amount);
  const remaining = limit - spent;
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;

  const unitPrice = parsed.qty && parsed.qty > 0 ? limit / parsed.qty : null;
  const spentQty = unitPrice && unitPrice > 0 ? spent / unitPrice : null;
  const remainingQty =
    parsed.qty && spentQty !== null ? parsed.qty - spentQty : null;

  return {
    budget,
    parsed,
    spent,
    matchedTxCount,
    remaining,
    percent,
    over: spent > limit,
    unitPrice,
    spentQty,
    remainingQty,
  };
}

/**
 * Semua pagu dengan statusnya, diurutkan dari yang paling mepet.
 */
export function budgetStatuses(
  budgets: Budget[],
  transactions: Transaction[],
  now = appNow()
): BudgetStatus[] {
  return budgets
    .map((b) => budgetStatus(b, transactions, now))
    .sort((a, b) => b.percent - a.percent);
}
