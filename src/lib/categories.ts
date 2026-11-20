import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  HandCoins,
  Gift,
  RotateCcw,
  TrendingUp,
  MoreHorizontal,
  Coffee,
  ShoppingBag,
  Car,
  Receipt,
  Clapperboard,
  HeartPulse,
  ArrowLeftRight,
  CircleEllipsis,
} from 'lucide-react';
import type { TransactionType } from '@/types/finance';

export interface CategoryMeta {
  id: string;
  icon: LucideIcon;
  /** Token warna dari design system: brand / out / due / info / muted */
  tone: 'brand' | 'out' | 'due' | 'info' | 'muted';
}

/**
 * Kategori transaksi yang bisa dipilih.
 * `id` adalah nilai yang disimpan ke database - jangan diubah tanpa migrasi.
 */
export const CATEGORIES: Record<TransactionType, CategoryMeta[]> = {
  inflow: [
    { id: 'Gaji', icon: Briefcase, tone: 'brand' },
    { id: 'Freelance', icon: HandCoins, tone: 'brand' },
    { id: 'Bonus', icon: Gift, tone: 'brand' },
    { id: 'Refund', icon: RotateCcw, tone: 'brand' },
    { id: 'Investasi', icon: TrendingUp, tone: 'brand' },
    { id: 'Lainnya', icon: MoreHorizontal, tone: 'muted' },
  ],
  outflow: [
    { id: 'Makan & Minum', icon: Coffee, tone: 'out' },
    { id: 'Belanja', icon: ShoppingBag, tone: 'out' },
    { id: 'Transport', icon: Car, tone: 'out' },
    { id: 'Tagihan & Cicilan', icon: Receipt, tone: 'due' },
    { id: 'Hiburan', icon: Clapperboard, tone: 'out' },
    { id: 'Kesehatan', icon: HeartPulse, tone: 'out' },
    { id: 'Transfer', icon: ArrowLeftRight, tone: 'info' },
    { id: 'Lainnya', icon: CircleEllipsis, tone: 'muted' },
  ],
};

export const ALL_CATEGORIES: CategoryMeta[] = [...CATEGORIES.inflow, ...CATEGORIES.outflow];

const BY_ID = new Map(ALL_CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): CategoryMeta {
  return BY_ID.get(id) ?? { id, icon: CircleEllipsis, tone: 'muted' };
}

export function categoryOptions(type: TransactionType): CategoryMeta[] {
  return CATEGORIES[type];
}
