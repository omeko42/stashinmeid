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
    priceIdrMonthly: 159000,
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
    priceIdrMonthly: 479000,
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
    priceIdrMonthly: 1590000,
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
 * `yearlyTotal` dijamin tepat `monthlyEffective × 12` tanpa selisih pembulatan.
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

  const convertUsdClean = (usd: number): number => {
    if (usd === 0) return 0;
    if (code === 'USD') return usd;
    const raw = (usd * usdToIdr) / targetPerIdr;
    if (code === 'IDR') return Math.round(raw / 1000) * 1000;
    if (code === 'JPY') return Math.round(raw / 10) * 10;
    return Math.round(raw);
  };

  const monthlyRegular = convertUsdClean(plan.priceUsdMonthly);
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
