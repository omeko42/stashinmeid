'use client';

import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Landmark, Wallet } from 'lucide-react';
import { Segmented } from '@/components/ui/Segmented';
import { Amount, Label } from '@/components/ui/Surface';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { BudgetTab } from './BudgetTab';
import { CashflowTab } from './CashflowTab';
import { AssetsTab } from './AssetsTab';
import { formatRp } from '@/lib/format';
import type { AssetsApi } from '@/hooks/useAssets';
import type { ReceiptsApi } from '@/hooks/useReceipts';
import type { Budget, BudgetPeriod, Transaction, TransactionType } from '@/types/finance';

export type SaldoSub = 'cashflow' | 'budget' | 'assets';

interface SaldoTabProps {
  assets: AssetsApi;
  receipts?: ReceiptsApi;
  /** Nilai saldo tunai & non-tunai yang sudah digabung dengan arus kas aktif. */
  computedTotals: {
    physical: number;
    nonPhysical: number;
    total: number;
  };
  sub: SaldoSub;
  onSubChange: (sub: SaldoSub) => void;
  canEdit: boolean;
  // Anggaran
  budgets: Budget[];
  transactions: Transaction[];
  onBudgetSave: (category: string, amount: number, period: BudgetPeriod) => Promise<void>;
  onBudgetRemove: (id: string) => Promise<void>;
  // Arus kas
  filteredTransactions: Transaction[];
  filterType: 'all' | TransactionType;
  searchQuery: string;
  onFilterTypeChange: (value: 'all' | TransactionType) => void;
  onSearchChange: (value: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onQuickAdd: () => void;
  onExportCsv: (rows?: Transaction[], periodLabel?: string) => void;
  onExportPdf?: (rows?: Transaction[], periodLabel?: string) => void;
  onExportExcel?: (rows?: Transaction[], periodLabel?: string) => void;
  onExportWord?: (rows?: Transaction[], periodLabel?: string) => void;
  sharedGroups?: { id: string; name: string }[];
}

/**
 * Saldo - satu menu gabungan: ringkasan saldo tunai vs non-tunai
 * (terhubung langsung dengan Arus Kas & Dompet Aset),
 * lalu sub-tab Arus Kas / Anggaran / Aset dengan transisi halus.
 */
export function SaldoTab({
  assets,
  receipts,
  computedTotals,
  sub,
  onSubChange,
  canEdit,
  budgets,
  transactions,
  onBudgetSave,
  onBudgetRemove,
  filteredTransactions,
  filterType,
  searchQuery,
  onFilterTypeChange,
  onSearchChange,
  onEditTransaction,
  onDeleteTransaction,
  onQuickAdd,
  onExportCsv,
  onExportPdf,
  onExportExcel,
  onExportWord,
  sharedGroups = [],
}: SaldoTabProps) {
  const t = useTranslations('saldo');

  const physical = assets.accounts.filter(
    (a) => a.kind === 'cash' || a.kind === 'other'
  );
  const nonPhysical = assets.accounts.filter(
    (a) => a.kind === 'bank' || a.kind === 'ewallet' || a.kind === 'crypto'
  );

  const physicalTotal = computedTotals.physical;
  const nonPhysicalTotal = computedTotals.nonPhysical;
  const grandTotal = computedTotals.total;

  const physicalCount =
    physical.length > 0 ? physical.length : physicalTotal !== 0 ? 1 : 0;
  const nonPhysicalCount =
    nonPhysical.length > 0 ? nonPhysical.length : nonPhysicalTotal !== 0 ? 1 : 0;

  const subOptions = [
    { value: 'cashflow' as const, label: t('sub.cashflow') },
    { value: 'budget' as const, label: t('sub.budget') },
    { value: 'assets' as const, label: t('sub.assets') },
  ];

  return (
    <div className="space-y-5">
      {/* Saldo tunai vs non-tunai */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="hero-surface card-interactive rounded-xl border border-[var(--brand)]/30 bg-[var(--surface-1)] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Label>{t('totalLabel')}</Label>
              <BalanceVisibilityToggle />
            </div>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
              <Wallet className="size-3.5" aria-hidden />
            </span>
          </div>
          <div className="mt-1.5">
            <Amount value={formatRp(grandTotal)} size="lg" />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {t('totalHint', { currency: assets.primaryCurrency })}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <Label>{t('physical')}</Label>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--brand)]">
              <Banknote className="size-3.5" aria-hidden />
            </span>
          </div>
          <div className="mt-1.5">
            <Amount value={formatRp(physicalTotal)} size="lg" />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {t('physicalHint', { count: physicalCount })}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <Label>{t('nonPhysical')}</Label>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--info-soft)] text-[var(--info)]">
              <Landmark className="size-3.5" aria-hidden />
            </span>
          </div>
          <div className="mt-1.5">
            <Amount value={formatRp(nonPhysicalTotal)} size="lg" />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {t('nonPhysicalHint', { count: nonPhysicalCount })}
          </p>
        </motion.section>
      </div>

      <Segmented
        options={subOptions}
        value={sub}
        onChange={onSubChange}
        size="sm"
        ariaLabel={t('subLabel')}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={sub}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {sub === 'cashflow' && (
            <CashflowTab
              transactions={transactions}
              filteredTransactions={filteredTransactions}
              filterType={filterType}
              searchQuery={searchQuery}
              canEdit={canEdit}
              accounts={assets.accounts}
              sharedGroups={sharedGroups}
              receipts={receipts}
              onFilterTypeChange={onFilterTypeChange}
              onSearchChange={onSearchChange}
              onEdit={onEditTransaction}
              onDelete={onDeleteTransaction}
              onQuickAdd={onQuickAdd}
              onExportCsv={onExportCsv}
              onExportPdf={onExportPdf}
              onExportExcel={onExportExcel}
              onExportWord={onExportWord}
            />
          )}

          {sub === 'budget' && (
            <BudgetTab
              budgets={budgets}
              transactions={transactions}
              canEdit={canEdit}
              onSave={onBudgetSave}
              onRemove={onBudgetRemove}
            />
          )}

          {sub === 'assets' && <AssetsTab assets={assets} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
