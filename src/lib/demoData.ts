import type { Debt, Transaction } from '@/types/finance';
import type { AssetAccount } from '@/hooks/useAssets';

export function getDemoUser(locale: 'id' | 'en' = 'id') {
  if (locale === 'en') {
    return {
      email: 'demo@stashinme.biz.id',
      clientName: 'Demo Workspace',
      bio: 'Interactive sandbox — changes reset automatically on reload.',
    };
  }
  return {
    email: 'demo@stashinme.biz.id',
    clientName: 'Akun Demo Sandbox',
    bio: 'Mode uji coba interaktif — data kembali ke awal saat dimuat ulang.',
  };
}

export function createDemoTransactions(locale: 'id' | 'en' = 'id'): Transaction[] {
  const now = new Date();
  const isoDaysAgo = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  const isEn = locale === 'en';

  return [
    {
      id: 'demo-tx-1',
      type: 'inflow',
      amount: 14500000,
      category: 'Gaji',
      description: isEn ? 'Monthly Salary' : 'Gaji Bulanan',
      transaction_date: isoDaysAgo(1),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-2',
      type: 'outflow',
      amount: 1850000,
      category: 'Makan & Minum',
      description: isEn ? 'Groceries & Dining' : 'Belanja Bulanan & Dapur',
      transaction_date: isoDaysAgo(2),
      source: 'manual',
      group_id: null,
    },
    {
      id: 'demo-tx-3',
      type: 'outflow',
      amount: 920000,
      category: 'Tagihan & Cicilan',
      description: isEn ? 'Utilities & Home Internet' : 'Listrik, Air & Internet Rumah',
      transaction_date: isoDaysAgo(4),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-4',
      type: 'inflow',
      amount: 4200000,
      category: 'Freelance',
      description: isEn ? 'UI Design Consulting' : 'Proyek Desain Antarmuka',
      transaction_date: isoDaysAgo(6),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-5',
      type: 'outflow',
      amount: 650000,
      category: 'Transport',
      description: isEn ? 'Fuel & Commute' : 'BBM & Tol Mingguan',
      transaction_date: isoDaysAgo(8),
      source: 'manual',
      group_id: null,
    },
  ];
}

export function createDemoDebts(locale: 'id' | 'en' = 'id'): Debt[] {
  const isEn = locale === 'en';
  return [
    {
      id: 'demo-debt-1',
      platform: isEn ? 'Home Mortgage Loan' : 'KPR Bank Mandiri',
      contract_no: isEn ? 'MTG-2026-0041' : 'KPR-2026-0041',
      total_tenor: 120,
      remaining_tenor: 84,
      due_day: 25,
      remaining_balance: 185000000,
      monthly_installment: 2850000,
      status: 'active',
      notes: isEn ? 'Primary residence mortgage (Demo)' : 'Cicilan rumah utama (Demo)',
      group_id: null,
    },
    {
      id: 'demo-debt-2',
      platform: isEn ? '0% Laptop Installment' : 'Cicilan Laptop 0%',
      contract_no: 'CC-8821',
      total_tenor: 12,
      remaining_tenor: 4,
      due_day: 12,
      remaining_balance: 4800000,
      monthly_installment: 1200000,
      status: 'active',
      notes: isEn ? '4 months left (Demo)' : 'Sisa 4 bulan (Demo)',
      group_id: null,
    },
  ];
}

export function createDemoAccounts(locale: 'id' | 'en' = 'id'): AssetAccount[] {
  const isEn = locale === 'en';
  return [
    {
      id: 'demo-acc-1',
      name: isEn ? 'Cash Wallet' : 'Dompet Tunai',
      kind: 'cash',
      institution: isEn ? 'Personal Cash' : 'Kas Pribadi',
      currency: 'IDR',
      balance: 2400000,
    },
    {
      id: 'demo-acc-2',
      name: isEn ? 'Main Checking' : 'BCA Utama',
      kind: 'bank',
      institution: isEn ? 'Checking Bank' : 'Bank Central Asia',
      currency: 'IDR',
      balance: 18600000,
    },
    {
      id: 'demo-acc-3',
      name: isEn ? 'USDT Reserve' : 'Tabungan USDT',
      kind: 'crypto',
      institution: 'Crypto Wallet',
      currency: 'USDT',
      balance: 450,
    },
  ];
}
