import type { Debt, Transaction } from '@/types/finance';
import type { AssetAccount } from '@/hooks/useAssets';
import { serializeDebtNotes } from '@/lib/debtMeta';

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
    {
      id: 'demo-tx-6',
      type: 'outflow',
      amount: 2850000,
      category: 'Tagihan & Cicilan',
      description: isEn ? 'BRIguna Auto-Debit' : 'Cicilan BRIguna (Auto-Debet)',
      transaction_date: isoDaysAgo(10),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-7',
      type: 'outflow',
      amount: 485000,
      category: 'Kesehatan',
      description: isEn ? 'Pharmacy & Vitamins' : 'Apotek & Vitamin Keluarga',
      transaction_date: isoDaysAgo(12),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-8',
      type: 'outflow',
      amount: 340000,
      category: 'Hiburan',
      description: isEn ? 'Streaming & Cinema' : 'Langganan Streaming & Bioskop',
      transaction_date: isoDaysAgo(15),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-9',
      type: 'outflow',
      amount: 1200000,
      category: 'Belanja',
      description: isEn ? 'Work Desk Accessories' : 'Perlengkapan Meja Kerja',
      transaction_date: isoDaysAgo(19),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-10',
      type: 'inflow',
      amount: 14500000,
      category: 'Gaji',
      description: isEn ? 'Previous Month Salary' : 'Gaji Bulan Lalu',
      transaction_date: isoDaysAgo(31),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-11',
      type: 'outflow',
      amount: 2850000,
      category: 'Tagihan & Cicilan',
      description: isEn ? 'BRIguna Auto-Debit' : 'Cicilan BRIguna (Auto-Debet)',
      transaction_date: isoDaysAgo(35),
      source: 'manual_non_physical',
      group_id: null,
    },
    {
      id: 'demo-tx-12',
      type: 'outflow',
      amount: 2150000,
      category: 'Makan & Minum',
      description: isEn ? 'Monthly Groceries' : 'Belanja Dapur & Makan',
      transaction_date: isoDaysAgo(40),
      source: 'manual',
      group_id: null,
    },
  ];
}

export function createDemoDebts(locale: 'id' | 'en' = 'id'): Debt[] {
  const isEn = locale === 'en';
  const now = new Date();
  const ymOffset = (m: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  return [
    {
      id: 'demo-debt-1',
      platform: isEn ? 'BRIguna Bank Loan' : 'BRIguna (Bank BRI)',
      contract_no: 'BRI-2026-0041',
      total_tenor: 60,
      remaining_tenor: 36,
      due_day: 25,
      remaining_balance: 78500000,
      monthly_installment: 2850000,
      status: 'active',
      notes: serializeDebtNotes(
        isEn ? 'Auto-debit from BCA Utama' : 'Auto-debet otomatis dari BCA Utama',
        {
          installmentMode: 'interest',
          interestRate: 11.5,
          interestType: 'flat',
          autoPay: true,
          autoPayDay: 25,
          autoPayAccountId: 'demo-acc-2',
        }
      ),
      group_id: null,
    },
    {
      id: 'demo-debt-2',
      platform: 'GoPay Later',
      contract_no: isEn ? 'Variable PayLater' : 'Cicilan & Transaksi Berjalan',
      total_tenor: 4,
      remaining_tenor: 4,
      due_day: 1,
      remaining_balance: 1219717,
      monthly_installment: 329217,
      status: 'active',
      notes: serializeDebtNotes(
        isEn ? 'Different installment per month' : 'Nominal cicilan berbeda tiap bulan',
        {
          installmentMode: 'custom',
          scheduleOverrides: {
            [ymOffset(1)]: 329217,
            [ymOffset(2)]: 415000,
            [ymOffset(3)]: 280500,
            [ymOffset(4)]: 195000,
          },
        }
      ),
      group_id: null,
    },
    {
      id: 'demo-debt-3',
      platform: isEn ? '0% Laptop Installment' : 'Cicilan Laptop 0%',
      contract_no: 'CC-8821',
      total_tenor: 12,
      remaining_tenor: 4,
      due_day: 12,
      remaining_balance: 4800000,
      monthly_installment: 1200000,
      status: 'active',
      notes: serializeDebtNotes(
        isEn ? '4 months left (0% flat)' : 'Sisa 4 bulan (cicilan tetap 0%)',
        { installmentMode: 'fixed' }
      ),
      group_id: null,
    },
    {
      id: 'demo-debt-4',
      platform: isEn ? 'Colleague Advance' : 'Kasbon Rekan Kerja',
      contract_no: 'KB-01',
      total_tenor: 1,
      remaining_tenor: 1,
      due_day: 28,
      remaining_balance: 750000,
      monthly_installment: 750000,
      status: 'active',
      notes: serializeDebtNotes(
        isEn ? 'Pay in full next payday' : 'Lunas 1x saat gajian',
        { installmentMode: 'lumpsum' }
      ),
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
      name: 'SeaBank',
      kind: 'bank',
      institution: 'PT Bank SeaBank Indonesia',
      currency: 'IDR',
      balance: 4250000,
    },
    {
      id: 'demo-acc-4',
      name: isEn ? 'USDT Reserve' : 'Tabungan USDT',
      kind: 'crypto',
      institution: 'Crypto Wallet',
      currency: 'USDT',
      balance: 450,
    },
  ];
}
