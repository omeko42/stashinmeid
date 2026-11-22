export type MembershipTier = 'free' | 'pro' | 'enterprise';

export interface MembershipPlan {
  id: MembershipTier;
  maxGroups: number;
  priceIdr: number;
  priceUsd: number;
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
  amountIdr: number;
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

export const MEMBERSHIP_PLANS: Record<MembershipTier, MembershipPlan> = {
  free: {
    id: 'free',
    maxGroups: 3,
    priceIdr: 0,
    priceUsd: 0,
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
  pro: {
    id: 'pro',
    maxGroups: 5,
    priceIdr: 49000,
    priceUsd: 4,
    labelId: 'Pro',
    labelEn: 'Pro',
    badgeId: 'Maks. 5 Grup',
    badgeEn: 'Up to 5 Groups',
    summaryId: 'Untuk keluarga besar & multi-unit usaha.',
    summaryEn: 'For growing families & multiple business units.',
    featuresId: [
      'Maksimal 5 grup kolega & bisnis',
      'Semua fitur paket Gratis',
      'Ekspor laporan PDF/Word & API pihak ketiga',
    ],
    featuresEn: [
      'Up to 5 colleague & business groups',
      'Everything in Free',
      'Full PDF/Word export & 3rd-party API hub',
    ],
  },
  enterprise: {
    id: 'enterprise',
    maxGroups: 9,
    priceIdr: 149000,
    priceUsd: 12,
    labelId: 'Bisnis',
    labelEn: 'Business',
    badgeId: 'Maks. 9 Grup',
    badgeEn: 'Up to 9 Groups',
    summaryId: 'Paket tertinggi reguler untuk banyak grup & unit usaha.',
    summaryEn: 'Top standard plan for multi-group teams & business units.',
    featuresId: [
      'Maksimal 9 grup perusahaan & keluarga',
      'Semua fitur paket Pro',
      'Prioritas verifikasi KYC & dukungan khusus',
    ],
    featuresEn: [
      'Up to 9 company & family groups',
      'Everything in Pro',
      'Priority KYC verification & dedicated support',
    ],
  },
};

export function normalizeTier(raw: unknown): MembershipTier {
  if (raw === 'pro' || raw === 'enterprise' || raw === 'free') return raw;
  return 'free';
}

export function getMaxGroupsForTier(tier: MembershipTier): number {
  return MEMBERSHIP_PLANS[tier].maxGroups;
}
