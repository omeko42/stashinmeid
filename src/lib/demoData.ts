import type { Debt, Transaction } from '@/types/finance';
import type { AssetAccount } from '@/hooks/useAssets';

export const DEMO_USER = {
  email: 'demo@stashinmeid.app',
  clientName: 'Akun Demo Sandbox',
  bio: 'Mode uji coba interaktif — data kembali ke awal saat dimuat ulang.',
};

export function createDemoTransactions(): Transaction[] {
  const now = new Date();
  const isoDaysAgo = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  return [
    {
      id: 'demo-tx-1',
      type: 'inflow',
      amount: 14500000,
      category: 'Gaji',
      description: 'Gaji Bulanan',
      transaction_date: isoDaysAgo(1),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-2',
      type: 'outflow',
      amount: 1850000,
      category: 'Makan & Minum',
      description: 'Belanja Bulanan & Kebutuhan Dapur',
      transaction_date: isoDaysAgo(2),
      source: 'manual',
      group_id: null,
    },
    {
      id: 'demo-tx-3',
      type: 'outflow',
      amount: 920000,
      category: 'Tagihan & Cicilan',
      description: 'Listrik, Air & Internet Rumah',
      transaction_date: isoDaysAgo(4),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-4',
      type: 'inflow',
      amount: 4200000,
      category: 'Freelance',
      description: 'Proyek Desain Antarmuka',
      transaction_date: isoDaysAgo(6),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-5',
      type: 'outflow',
      amount: 650000,
      category: 'Transport',
      description: 'BBM & Tol Mingguan',
      transaction_date: isoDaysAgo(8),
      source: 'manual',
      group_id: null,
    },
  ];
}

export function createDemoDebts(): Debt[] {
  return [
    {
      id: 'demo-debt-1',
      platform: 'KPR Bank Mandiri',
      contract_no: 'KPR-2026-0041',
      total_tenor: 120,
      remaining_tenor: 84,
      due_day: 25,
      remaining_balance: 185000000,
      monthly_installment: 2850000,
      status: 'active',
      notes: 'Cicilan rumah utama (Data Demo)',
      group_id: null,
    },
    {
      id: 'demo-debt-2',
      platform: 'Cicilan Laptop 0%',
      contract_no: 'CC-8821',
      total_tenor: 12,
      remaining_tenor: 4,
      due_day: 12,
      remaining_balance: 4800000,
      monthly_installment: 1200000,
      status: 'active',
      notes: 'Sisa 4 bulan (Data Demo)',
      group_id: null,
    },
  ];
}

export function createDemoAccounts(): AssetAccount[] {
  return [
    {
      id: 'demo-acc-1',
      name: 'Dompet Tunai',
      kind: 'cash',
      institution: 'Kas Pribadi',
      currency: 'IDR',
      balance: 2400000,
    },
    {
      id: 'demo-acc-2',
      name: 'BCA Utama',
      kind: 'bank',
      institution: 'Bank Central Asia',
      currency: 'IDR',
      balance: 18600000,
    },
    {
      id: 'demo-acc-3',
      name: 'Tabungan USDT',
      kind: 'crypto',
      institution: 'Wallet Crypto',
      currency: 'USDT',
      balance: 450,
    },
  ];
}
