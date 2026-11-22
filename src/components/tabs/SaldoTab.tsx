'use client';

import { useTranslations } from 'next-intl';
import { Segmented } from '@/components/ui/Segmented';
import { Amount, Label } from '@/components/ui/Surface';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { BudgetTab } from './BudgetTab';
import { CashflowTab } from './CashflowTab';
import { AssetsTab } from './AssetsTab';
import { formatRp } from '@/lib/format';
import type { AssetsApi } from '@/hooks/useAssets';
import type { Budget, BudgetPeriod, Transaction, TransactionType } from '@/types/finance';

export type SaldoSub = 'cashflow' | 'budget' | 'assets';

interface SaldoTabProps {
  assets: AssetsApi;
  /** Nilai saldo fisik & non-fisik yang sudah digabung dengan arus kas aktif. */
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
  onExportCsv: () => void;
  sharedGroups?: { id: string; name: string }[];
}

/**
 * Saldo - satu menu gabungan: ringkasan saldo fisik vs non-fisik
 * (terhubung langsung dengan Arus Kas & Dompet Aset),
 * lalu sub-tab Anggaran / Arus Kas / Aset.
 */
export function SaldoTab({
  assets,
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
          <div className="flex items-center gap-1.5">
            <Label>{t('totalLabel')}</Label>
            <BalanceVisibilityToggle />
          </div>
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
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            {physical.length === 0 ? (
              <>
                <span>Kas tunai</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => onSubChange('assets')}
                  className="font-semibold text-[var(--brand)] hover:underline"
                >
                  + Tambah dompet
                </button>
              </>
            ) : (
              t('physicalHint', { count: physical.length })
            )}
          </p>
        </section>
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <Label>{t('nonPhysical')}</Label>
          <div className="mt-1.5">
            <Amount value={formatRp(nonPhysicalTotal)} size="lg" />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            {nonPhysical.length === 0 ? (
              <>
                <span>Bank / e-wallet</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => onSubChange('assets')}
                  className="font-semibold text-[var(--brand)] hover:underline"
                >
                  + Tambah dompet
                </button>
              </>
            ) : (
              t('nonPhysicalHint', { count: nonPhysical.length })
            )}
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
          accounts={assets.accounts}
          sharedGroups={sharedGroups}
          onFilterTypeChange={onFilterTypeChange}
          onSearchChange={onSearchChange}
          onEdit={onEditTransaction}
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
