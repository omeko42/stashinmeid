'use client';

import { useTranslations } from 'next-intl';
import { Segmented } from '@/components/ui/Segmented';
import { Amount, Label } from '@/components/ui/Surface';
import { BudgetTab } from './BudgetTab';
import { CashflowTab } from './CashflowTab';
import { AssetsTab } from './AssetsTab';
import { formatRp } from '@/lib/format';
import type { AssetsApi } from '@/hooks/useAssets';
import type { Budget, BudgetPeriod, Transaction, TransactionType } from '@/types/finance';

export type SaldoSub = 'cashflow' | 'budget' | 'assets';

interface SaldoTabProps {
  assets: AssetsApi;
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
  onDeleteTransaction: (id: string) => void;
  onQuickAdd: () => void;
  onExportCsv: () => void;
}

/**
 * Saldo - satu menu gabungan: ringkasan saldo fisik vs non-fisik,
 * lalu sub-tab Anggaran / Arus Kas / Aset.
 */
export function SaldoTab({
  assets,
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
  onDeleteTransaction,
  onQuickAdd,
  onExportCsv,
}: SaldoTabProps) {
  const t = useTranslations('saldo');

  const physical = assets.accounts.filter(
    (a) => a.kind === 'cash' || a.kind === 'other'
  );
  const nonPhysical = assets.accounts.filter(
    (a) => a.kind === 'bank' || a.kind === 'ewallet' || a.kind === 'crypto'
  );
  const sum = (list: typeof physical) =>
    list.reduce((s, a) => s + (assets.convert(a.balance, a.currency) ?? 0), 0);

  const physicalTotal = sum(physical);
  const nonPhysicalTotal = sum(nonPhysical);
  const grandTotal = physicalTotal + nonPhysicalTotal;

  const subOptions = [
    { value: 'cashflow' as const, label: t('sub.cashflow') },
    { value: 'budget' as const, label: t('sub.budget') },
    { value: 'assets' as const, label: t('sub.assets') },
  ];

  return (
    <div className="space-y-5">
      {/* Saldo fisik vs non-fisik */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 sm:col-span-1">
          <Label>{t('totalLabel')}</Label>
          <div className="mt-1.5">
            <Amount value={formatRp(grandTotal)} size="lg" />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {t('totalHint', { currency: assets.primaryCurrency })}
          </p>
        </section>
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <Label>{t('physical')}</Label>
          <div className="mt-1.5">
            <Amount value={formatRp(physicalTotal)} size="lg" />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {t('physicalHint', { count: physical.length })}
          </p>
        </section>
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <Label>{t('nonPhysical')}</Label>
          <div className="mt-1.5">
            <Amount value={formatRp(nonPhysicalTotal)} size="lg" />
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            {t('nonPhysicalHint', { count: nonPhysical.length })}
          </p>
        </section>
      </div>

      <Segmented
        options={subOptions}
        value={sub}
        onChange={onSubChange}
        size="sm"
        ariaLabel={t('subLabel')}
      />

      {sub === 'cashflow' && (
        <CashflowTab
          transactions={transactions}
          filteredTransactions={filteredTransactions}
          filterType={filterType}
          searchQuery={searchQuery}
          canEdit={canEdit}
          onFilterTypeChange={onFilterTypeChange}
          onSearchChange={onSearchChange}
          onDelete={onDeleteTransaction}
          onQuickAdd={onQuickAdd}
          onExportCsv={onExportCsv}
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
    </div>
  );
}
