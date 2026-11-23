/**
 * Metadata tambahan pinjaman: suku bunga, skema bunga (Flat / Floating),
 * serta konfigurasi Auto-Payment (tanggal debet & dompet/rekening sumber).
 *
 * Disimpan aman & backward-compatible di dalam kolom `debts.notes`
 * memakai penanda `[STASHINME_DEBT_META:{...}]`, sehingga catatan manual
 * pengguna tetap utuh dan tidak memerlukan migrasi kolom baru untuk jalan.
 */

export type InterestType = 'flat' | 'floating';

export interface DebtMeta {
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
}

export const DEFAULT_DEBT_META: DebtMeta = {
  interestRate: null,
  interestType: 'flat',
  autoPay: false,
  autoPayDay: null,
  autoPayAccountId: null,
  lastAutoPaidYm: null,
};

const META_PREFIX = '[STASHINME_DEBT_META:';
const META_REGEX = /\s*\[STASHINME_DEBT_META:(\{[\s\S]*?\})\]\s*$/;

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
    return {
      text,
      meta: {
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
  const normalized: DebtMeta = {
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
  };

  const hasMeta =
    normalized.interestRate !== null ||
    normalized.interestType === 'floating' ||
    normalized.autoPay ||
    normalized.autoPayAccountId !== null ||
    normalized.lastAutoPaidYm !== null;

  if (!hasMeta) {
    return cleanText || null;
  }

  const tag = `${META_PREFIX}${JSON.stringify(normalized)}]`;
  return cleanText ? `${cleanText}\n${tag}` : tag;
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
