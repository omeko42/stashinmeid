/**
 * Metadata tambahan pinjaman: suku bunga, skema bunga (Flat / Floating),
 * serta konfigurasi Auto-Payment (tanggal debet & dompet/rekening sumber).
 *
 * Disimpan aman & backward-compatible di dalam kolom `debts.notes`
 * memakai penanda `[STASHINME_DEBT_META:{...}]`, sehingga catatan manual
 * pengguna tetap utuh dan tidak memerlukan migrasi kolom baru untuk jalan.
 */

export type InterestType = 'flat' | 'floating';
export type InstallmentMode = 'fixed' | 'custom' | 'interest' | 'lumpsum';

export interface DebtMeta {
  /** Mode perhitungan cicilan: hanya 1 mode aktif agar form tidak membingungkan. */
  installmentMode: InstallmentMode;
  /** Suku bunga dalam % per tahun (mis. 11.5). Null bila belum diatur. */
  interestRate: number | null;
  /** Skema bunga: 'flat' (tetap) atau 'floating' (mengambang). */
  interestType: InterestType;
  /** Aktifkan pembayaran cicilan otomatis tiap bulan. */
  autoPay: boolean;
  /** Tanggal pembayaran otomatis setiap bulan (1-31). */
  autoPayDay: number | null;
  /** ID dompet dari tabel `accounts`, atau '__cash__' untuk Kas Tunai. */
  autoPayAccountId: string | null;
  /** Bulan terakhir auto-payment dijalankan ('YYYY-MM') agar tidak dobel. */
  lastAutoPaidYm: string | null;
  /** Nominal cicilan khusus per bulan ('YYYY-MM' -> Rp), mis. untuk PayLater / tagihan bervariasi. */
  scheduleOverrides: Record<string, number>;
}

export const DEFAULT_DEBT_META: DebtMeta = {
  installmentMode: 'fixed',
  interestRate: null,
  interestType: 'flat',
  autoPay: false,
  autoPayDay: null,
  autoPayAccountId: null,
  lastAutoPaidYm: null,
  scheduleOverrides: {},
};

const VALID_MODES = new Set<InstallmentMode>(['fixed', 'custom', 'interest', 'lumpsum']);

const META_PREFIX = '[STASHINME_DEBT_META:';
const META_REGEX = /\s*\[STASHINME_DEBT_META:(\{[\s\S]*\})\]\s*$/;

function sanitizeOverrides(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(k)) continue;
    const num = Number(v);
    if (Number.isFinite(num) && num >= 0) {
      out[k] = Math.round(num);
    }
  }
  return out;
}

export function parseDebtNotes(notes: string | null | undefined): {
  text: string;
  meta: DebtMeta;
} {
  if (!notes) {
    return { text: '', meta: { ...DEFAULT_DEBT_META } };
  }

  const match = META_REGEX.exec(notes);
  if (!match) {
    return { text: notes.trim(), meta: { ...DEFAULT_DEBT_META } };
  }

  const text = notes.slice(0, match.index).trim();
  try {
    const raw = JSON.parse(match[1]) as Partial<DebtMeta>;
    const rate =
      typeof raw.interestRate === 'number' && Number.isFinite(raw.interestRate) && raw.interestRate >= 0
        ? raw.interestRate
        : null;
    const autoPayDay =
      typeof raw.autoPayDay === 'number' &&
      Number.isInteger(raw.autoPayDay) &&
      raw.autoPayDay >= 1 &&
      raw.autoPayDay <= 31
        ? raw.autoPayDay
        : null;
    const scheduleOverrides = sanitizeOverrides(raw.scheduleOverrides);
    const inferredMode: InstallmentMode =
      raw.installmentMode && VALID_MODES.has(raw.installmentMode)
        ? raw.installmentMode
        : Object.keys(scheduleOverrides).length > 0
          ? 'custom'
          : rate !== null && rate > 0
            ? 'interest'
            : 'fixed';
    return {
      text,
      meta: {
        installmentMode: inferredMode,
        interestRate: rate,
        interestType: raw.interestType === 'floating' ? 'floating' : 'flat',
        autoPay: Boolean(raw.autoPay),
        autoPayDay,
        autoPayAccountId:
          typeof raw.autoPayAccountId === 'string' && raw.autoPayAccountId.trim()
            ? raw.autoPayAccountId.trim()
            : null,
        lastAutoPaidYm:
          typeof raw.lastAutoPaidYm === 'string' && /^\d{4}-\d{2}$/.test(raw.lastAutoPaidYm)
            ? raw.lastAutoPaidYm
            : null,
        scheduleOverrides,
      },
    };
  } catch {
    return { text, meta: { ...DEFAULT_DEBT_META } };
  }
}

export function serializeDebtNotes(
  text: string,
  meta: Partial<DebtMeta>
): string | null {
  const cleanText = text.trim();
  const cleanOverrides = sanitizeOverrides(meta.scheduleOverrides);
  const mode: InstallmentMode =
    meta.installmentMode && VALID_MODES.has(meta.installmentMode)
      ? meta.installmentMode
      : Object.keys(cleanOverrides).length > 0
        ? 'custom'
        : typeof meta.interestRate === 'number' && meta.interestRate > 0
          ? 'interest'
          : 'fixed';

  const normalized: DebtMeta = {
    installmentMode: mode,
    interestRate:
      typeof meta.interestRate === 'number' && Number.isFinite(meta.interestRate) && meta.interestRate >= 0
        ? Math.round(meta.interestRate * 100) / 100
        : null,
    interestType: meta.interestType === 'floating' ? 'floating' : 'flat',
    autoPay: Boolean(meta.autoPay),
    autoPayDay:
      typeof meta.autoPayDay === 'number' &&
      Number.isInteger(meta.autoPayDay) &&
      meta.autoPayDay >= 1 &&
      meta.autoPayDay <= 31
        ? meta.autoPayDay
        : null,
    autoPayAccountId: meta.autoPayAccountId ? meta.autoPayAccountId.trim() : null,
    lastAutoPaidYm: meta.lastAutoPaidYm || null,
    scheduleOverrides: mode === 'custom' ? cleanOverrides : {},
  };

  const hasMeta =
    normalized.installmentMode !== 'fixed' ||
    normalized.interestRate !== null ||
    normalized.interestType === 'floating' ||
    normalized.autoPay ||
    normalized.autoPayAccountId !== null ||
    normalized.lastAutoPaidYm !== null ||
    Object.keys(normalized.scheduleOverrides).length > 0;

  if (!hasMeta) {
    return cleanText || null;
  }

  const tag = `${META_PREFIX}${JSON.stringify(normalized)}]`;
  return cleanText ? `${cleanText}\n${tag}` : tag;
}

import { appNow, nextDueDate } from '@/lib/format';

/**
 * Hitung cicilan per bulan dari Pokok, Sisa Tenor, Suku Bunga (% / tahun), dan Skema (Flat / Floating).
 * - Flat: (Pokok / Tenor) + (Pokok × r_bulanan)
 * - Floating (Anuitas / Efektif): P × r × (1+r)^n / ((1+r)^n - 1)
 */
export function computeInstallmentFromInterest(
  principal: number,
  tenorMonths: number,
  annualRatePct: number | null,
  interestType: InterestType
): number {
  if (principal <= 0 || tenorMonths <= 0) return 0;
  const r = annualRatePct && annualRatePct > 0 ? annualRatePct / 100 / 12 : 0;
  if (r <= 0) return Math.round(principal / tenorMonths);
  if (interestType === 'flat') {
    return Math.round(principal / tenorMonths + principal * r);
  }
  const factor = Math.pow(1 + r, tenorMonths);
  return Math.round((principal * r * factor) / (factor - 1));
}

/**
 * Estimasi porsi bunga per bulan dari sisa pokok & suku bunga tahunan (%).
 */
export function estimateMonthlyInterest(
  remainingBalance: number,
  interestRateAnnual: number | null
): number {
  if (!interestRateAnnual || interestRateAnnual <= 0 || remainingBalance <= 0) return 0;
  return Math.round((remainingBalance * (interestRateAnnual / 100)) / 12);
}

/**
 * Hitung tanggal jatuh tempo / jadwal auto-payment berikutnya.
 * Bila cicilan bulan yang sama sudah dibayar (`lastAutoPaidYm === YYYY-MM`),
 * otomatis geser ke tanggal `day` di periode bulan berikutnya.
 */
export function nextDebtScheduleDate(
  day: number,
  notes: string | null | undefined,
  from = appNow()
): Date {
  const { meta } = parseDebtNotes(notes);
  const candidate = nextDueDate(day, from);
  const candYm = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}`;

  if (meta.lastAutoPaidYm === candYm) {
    const nextMonth = candidate.getMonth() + 1;
    const maxDay = new Date(candidate.getFullYear(), nextMonth + 1, 0).getDate();
    const clamped = Math.min(Math.max(day, 1), maxDay);
    return new Date(candidate.getFullYear(), nextMonth, clamped);
  }
  return candidate;
}
