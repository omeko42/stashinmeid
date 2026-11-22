import { formatMoney } from '@/lib/format';

export type MembershipTier = 'free' | 'standard' | 'pro' | 'business';
export type BillingCycle = 'monthly' | 'yearly';

export const YEARLY_DISCOUNT_PCT = 20;

export interface MembershipPlan {
  id: MembershipTier;
  maxGroups: number;
  /** Harga bulanan dasar dalam USD. */
  priceUsdMonthly: number;
  /** Harga bulanan dasar dalam IDR. */
  priceIdrMonthly: number;
  labelId: string;
  labelEn: string;
  badgeId: string;
  badgeEn: string;
  summaryId: string;
  summaryEn: string;
  featuresId: string[];
  featuresEn: string[];
}

export interface MembershipOrder {
  id: string;
  invoiceNo: string;
  userId: string;
  userEmail: string;
  userName: string;
  requestedTier: Exclude<MembershipTier, 'free'>;
  billingCycle?: BillingCycle;
  amountIdr: number;
  amountUsd?: number;
  paymentProvider: string;
  paymentMethod: string;
  paymentRef: string;
  checkoutUrl?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt?: string | null;
}

export interface EnterpriseInquiry {
  id: string;
  name: string;
  contact: string;
  company: string;
  groupEstimate: string;
  requirements: string;
  status: 'new' | 'contacted' | 'closed';
  createdAt: string;
}

export const MEMBERSHIP_TIER_ORDER: MembershipTier[] = [
  'free',
  'standard',
  'pro',
  'business',
];

export const MEMBERSHIP_PLANS: Record<MembershipTier, MembershipPlan> = {
  free: {
    id: 'free',
    maxGroups: 3,
    priceUsdMonthly: 0,
    priceIdrMonthly: 0,
    labelId: 'Gratis',
    labelEn: 'Free',
    badgeId: 'Maks. 3 Grup',
    badgeEn: 'Up to 3 Groups',
    summaryId: 'Pribadi, Keluarga, dan maks. 1 PT / bisnis.',
    summaryEn: 'Personal, Family, and up to 1 company workspace.',
    featuresId: [
      'Maksimal 3 grup (Keluarga + maks. 1 PT)',
      'Arus kas, pinjaman & kurs live',
      'Sosial, obrolan cepat & berita pasar',
    ],
    featuresEn: [
      'Up to 3 groups (Family + max 1 company)',
      'Cashflow, loans & live FX rates',
      'Social hub, fast chat & market news',
    ],
  },
  standard: {
    id: 'standard',
    maxGroups: 5,
    priceUsdMonthly: 10,
    priceIdrMonthly: 100000,
    labelId: 'Standard',
    labelEn: 'Standard',
    badgeId: 'Maks. 5 Grup',
    badgeEn: 'Up to 5 Groups',
    summaryId: 'Untuk keluarga besar & multi-unit usaha awal.',
    summaryEn: 'For growing families & small multi-unit teams.',
    featuresId: [
      'Maksimal 5 grup kolega & bisnis',
      'Semua fitur paket Gratis',
      'Ekspor laporan PDF/Word & Excel/CSV',
    ],
    featuresEn: [
      'Up to 5 colleague & business groups',
      'Everything in Free',
      'Full PDF/Word & CSV report export',
    ],
  },
  pro: {
    id: 'pro',
    maxGroups: 9,
    priceUsdMonthly: 30,
    priceIdrMonthly: 500000,
    labelId: 'Pro',
    labelEn: 'Pro',
    badgeId: 'Maks. 9 Grup',
    badgeEn: 'Up to 9 Groups',
    summaryId: 'Untuk pebisnis aktif dengan banyak cabang & proyek.',
    summaryEn: 'For active operators managing multiple ventures.',
    featuresId: [
      'Maksimal 9 grup perusahaan & keluarga',
      'Semua fitur paket Standard',
      'Prioritas verifikasi KYC & dukungan cepat',
    ],
    featuresEn: [
      'Up to 9 company & family groups',
      'Everything in Standard',
      'Priority KYC verification & fast support',
    ],
  },
  business: {
    id: 'business',
    maxGroups: 15,
    priceUsdMonthly: 100,
    priceIdrMonthly: 1000000,
    labelId: 'Business',
    labelEn: 'Business',
    badgeId: 'Maks. 15 Grup',
    badgeEn: 'Up to 15 Groups',
    summaryId: 'Paket tertinggi reguler untuk holding & grup bisnis besar.',
    summaryEn: 'Top standard plan for holdings & multi-entity organizations.',
    featuresId: [
      'Maksimal 15 grup perusahaan & tim',
      'Semua fitur paket Pro',
      'Audit log lengkap & dukungan prioritas',
    ],
    featuresEn: [
      'Up to 15 company & team groups',
      'Everything in Pro',
      'Full audit trail & priority support',
    ],
  },
};

export function getPlanPrice(plan: MembershipPlan, cycle: BillingCycle) {
  const mult = cycle === 'yearly' ? (100 - YEARLY_DISCOUNT_PCT) / 100 : 1;
  const usdMonthlyEffective = Math.round(plan.priceUsdMonthly * mult);
  const idrMonthlyEffective =
    Math.round((plan.priceIdrMonthly * mult) / 1000) * 1000;
  return {
    usdMonthlyEffective,
    usdTotalBilled: cycle === 'yearly' ? usdMonthlyEffective * 12 : usdMonthlyEffective,
    idrMonthlyEffective,
    idrTotalBilled: cycle === 'yearly' ? idrMonthlyEffective * 12 : idrMonthlyEffective,
  };
}

/**
 * Hitung tampilan harga paket dalam mata uang pilihan user secara konsisten:
 * - IDR memakai harga lokal khusus Indonesia (Rp 100rb / Rp 500rb / Rp 1jt).
 * - USD memakai harga global ($10 / $30 / $100).
 * - Mata uang asing lain dikonversi dari harga global USD.
 * - `yearlyTotal` dijamin tepat `monthlyEffective × 12` tanpa selisih pembulatan.
 */
export function computePlanDisplayPricing(opts: {
  plan: MembershipPlan;
  cycle: BillingCycle;
  currency: string;
  idrPerUnit: Record<string, number>;
  locale: 'id' | 'en';
}) {
  const { plan, cycle, currency, idrPerUnit, locale } = opts;
  const code = (currency || 'USD').toUpperCase();
  const usdToIdr = idrPerUnit.USD || 15865;
  const targetPerIdr = idrPerUnit[code] || 1;

  const getMonthlyRegular = (): number => {
    if (plan.priceUsdMonthly === 0) return 0;
    if (code === 'IDR') return plan.priceIdrMonthly;
    if (code === 'USD') return plan.priceUsdMonthly;
    const raw = (plan.priceUsdMonthly * usdToIdr) / targetPerIdr;
    if (code === 'JPY') return Math.round(raw / 10) * 10;
    return Math.round(raw);
  };

  const monthlyRegular = getMonthlyRegular();
  const discountedRaw = monthlyRegular * ((100 - YEARLY_DISCOUNT_PCT) / 100);
  const monthlyEffective =
    cycle === 'yearly'
      ? code === 'IDR'
        ? Math.round(discountedRaw / 1000) * 1000
        : code === 'JPY'
          ? Math.round(discountedRaw / 10) * 10
          : Math.round(discountedRaw * 100) / 100
      : monthlyRegular;

  const yearlyTotal = Math.round(monthlyEffective * 12 * 100) / 100;
  const yearlySavings = Math.max(
    0,
    Math.round((monthlyRegular - monthlyEffective) * 12 * 100) / 100
  );

  return {
    monthlyRegular,
    monthlyEffective,
    yearlyTotal,
    yearlySavings,
    formattedMonthlyRegular: formatMoney(monthlyRegular, code, locale),
    formattedMonthlyEffective: formatMoney(monthlyEffective, code, locale),
    formattedYearlyTotal: formatMoney(yearlyTotal, code, locale),
    formattedYearlySavings: formatMoney(yearlySavings, code, locale),
  };
}

export interface MembershipStatusInfo {
  storedTier: MembershipTier;
  effectiveTier: MembershipTier;
  expiresAt: string | null;
  durationMonths: number | null;
  note: string | null;
  isExpired: boolean;
  daysLeft: number | null;
}

/** Tambah N bulan kalender dari waktu sekarang (ISO string). */
export function addMonthsIso(months: number, from = new Date()): string {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

/**
 * Evaluasi status paket & masa berlaku dari `auth.users.user_metadata`.
 * Jika masa langganan sudah lewat (`expiresAt < now`), efektif otomatis turun ke `'free'`.
 */
export function resolveMembershipStatus(
  meta: Record<string, unknown> | null | undefined,
  isAdmin = false
): MembershipStatusInfo {
  const m = meta ?? {};
  const storedTier: MembershipTier =
    isAdmin && !m.membership_tier
      ? 'business'
      : normalizeTier(m.membership_tier);
  const expiresAt =
    typeof m.membership_expires_at === 'string' && m.membership_expires_at
      ? m.membership_expires_at
      : null;
  const durationMonths =
    typeof m.membership_duration_months === 'number'
      ? m.membership_duration_months
      : null;
  const note =
    typeof m.membership_note === 'string' && m.membership_note.trim()
      ? m.membership_note.trim()
      : null;

  if (storedTier === 'free' || !expiresAt) {
    return {
      storedTier,
      effectiveTier: storedTier,
      expiresAt,
      durationMonths,
      note,
      isExpired: false,
      daysLeft: null,
    };
  }

  const expMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  if (Number.isNaN(expMs)) {
    return {
      storedTier,
      effectiveTier: storedTier,
      expiresAt: null,
      durationMonths,
      note,
      isExpired: false,
      daysLeft: null,
    };
  }

  const diffMs = expMs - nowMs;
  if (diffMs <= 0) {
    return {
      storedTier,
      effectiveTier: 'free',
      expiresAt,
      durationMonths,
      note,
      isExpired: true,
      daysLeft: 0,
    };
  }

  return {
    storedTier,
    effectiveTier: storedTier,
    expiresAt,
    durationMonths,
    note,
    isExpired: false,
    daysLeft: Math.max(1, Math.ceil(diffMs / 86_400_000)),
  };
}

export function normalizeTier(raw: unknown): MembershipTier {
  if (raw === 'standard' || raw === 'pro' || raw === 'business' || raw === 'free') {
    return raw;
  }
  // Backward compatibility untuk akun lama yang tersimpan sebagai 'enterprise'
  if (raw === 'enterprise') return 'business';
  return 'free';
}

export function getMaxGroupsForTier(tier: MembershipTier): number {
  return MEMBERSHIP_PLANS[tier].maxGroups;
}
