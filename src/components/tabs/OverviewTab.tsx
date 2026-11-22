'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDownRight, ArrowUpRight, CalendarClock, Camera, Plus } from 'lucide-react';
import type { Debt, Transaction } from '@/types/finance';
import { formatDate, formatRp } from '@/lib/format';
import { getCategory } from '@/lib/categories';
import { Amount, Label, Progress, Rule, SectionTitle } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { CashflowChart, type ChartPeriod } from '@/components/charts/CashflowChart';
import { DebtDonut } from '@/components/charts/DebtDonut';
import type { BudgetStatus } from '@/lib/budget';

/** Satu gugus jatuh tempo: beberapa pinjaman dengan tanggal tagih sama. */
export interface UpcomingDueGroup {
  dueDay: number;
  nextDue: Date;
  items: Debt[];
  total: number;
}

interface OverviewTabProps {
  transactions: Transaction[];
  debts: Debt[];
  totalInflow: number;
  totalOutflow: number;
  netCashflow: number;
  savingsRate: number;
  totalDebt: number;
  monthlyDebtBurden: number;
  activeDebtCount: number;
  upcomingDueGroups: UpcomingDueGroup[];
  budgetStatuses: BudgetStatus[];
  /** Aset dompet: fisik vs non-fisik, untuk tooltip di hero saldo. */
  assetTotals?: { physical: number; nonPhysical: number };
  canEdit: boolean;
  scanning: boolean;
  onQuickAdd: () => void;
  onScan: () => void;
  onOpenDebts: () => void;
  onOpenCashflow: () => void;
  onOpenBudget: () => void;
}

/**
 * Ringkasan.
 *
 * Hero-nya bukan kartu gradien - dia pita full-width dengan angka saldo besar
 * di kiri dan dua kolom masuk/keluar yang dipisah garis vertikal. Angka adalah
 * pahlawan; sisanya dirapatkan.
 */
export function OverviewTab({
  transactions,
  debts,
  totalInflow,
  totalOutflow,
  netCashflow,
  savingsRate,
  totalDebt,
  monthlyDebtBurden,
  activeDebtCount,
  upcomingDueGroups,
  budgetStatuses,
  assetTotals,
  canEdit,
  scanning,
  onQuickAdd,
  onScan,
  onOpenDebts,
  onOpenCashflow,
  onOpenBudget,
}: OverviewTabProps) {
  const t = useTranslations();
  const tOverview = useTranslations('overview');
  const [period, setPeriod] = useState<ChartPeriod>('month');

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
        .slice(0, 5),
    [transactions]
  );

  const periodOptions = [
    { value: 'week' as const, label: tOverview('period.week') },
    { value: 'month' as const, label: tOverview('period.month') },
    { value: 'year' as const, label: tOverview('period.year') },
  ];

  return (
    <div className="space-y-5">
      {/* HERO - pita saldo */}
      <section className="border-b border-[var(--line)] pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Label>{tOverview('balanceLabel')}</Label>
              <BalanceVisibilityToggle />
            </div>
            <div className="mt-1.5">
              <div className="group relative inline-block">
                <Amount
                  value={formatRp(
                    assetTotals && assetTotals.physical + assetTotals.nonPhysical > 0
                      ? assetTotals.physical + assetTotals.nonPhysical
                      : netCashflow
                  )}
                  size="hero"
                />
                {/* Hover saldo: detail dompet fisik vs non-fisik */}
                {assetTotals && assetTotals.physical + assetTotals.nonPhysical > 0 && (
                  <div className="pointer-events-none invisible absolute left-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-3 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {tOverview('assetTooltip')}
                    </span>
                    <div className="mt-2 space-y-1.5 text-[12px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--text-muted)]">
                          {tOverview('assetPhysical')}
                        </span>
                        <span className="tnum font-semibold text-[var(--text)]">
                          {formatRp(assetTotals.physical)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--text-muted)]">
                          {tOverview('assetNonPhysical')}
                        </span>
                        <span className="tnum font-semibold text-[var(--text)]">
                          {formatRp(assetTotals.nonPhysical)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-1.5">
                        <span className="font-semibold text-[var(--text-muted)]">
                          {tOverview('assetTotal')}
                        </span>
                        <span className="tnum font-semibold text-[var(--brand)]">
                          {formatRp(assetTotals.physical + assetTotals.nonPhysical)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
              {tOverview('balanceHint')} · {tOverview('savingsRate')}{' '}
              <span className="tnum font-semibold text-[var(--brand)]">
                {savingsRate}%
              </span>
            </p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button icon={<Plus className="size-4" />} onClick={onQuickAdd}>
                {tOverview('quickAdd')}
              </Button>
              <Button
                variant="secondary"
                icon={<Camera className="size-4" />}
                onClick={onScan}
                loading={scanning}
              >
                <span className="hidden sm:inline">{t('settings.data.scan')}</span>
                <span className="sm:hidden">{t('tools.scanShort')}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Debit / kredit dipisah garis vertikal, bukan kartu terpisah */}
        <div className="mt-5 grid grid-cols-2 divide-x divide-[var(--line)]">
          <div className="pr-4">
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="size-3.5 text-[var(--brand)]" aria-hidden />
              <Label>{tOverview('inflow')}</Label>
            </div>
            <div className="mt-1">
              <Amount value={formatRp(totalInflow)} tone="brand" size="lg" />
            </div>
          </div>
          <div className="pl-4">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-[var(--out)]" aria-hidden />
              <Label>{tOverview('outflow')}</Label>
            </div>
            <div className="mt-1">
              <Amount value={formatRp(totalOutflow)} tone="out" size="lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Tren + komposisi pinjaman */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>{tOverview('trendTitle')}</SectionTitle>
            <Segmented
              options={periodOptions}
              value={period}
              onChange={setPeriod}
              size="sm"
              ariaLabel={tOverview('period.label')}
            />
          </div>
          <CashflowChart transactions={transactions} period={period} />
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <SectionTitle action={
            <button
              type="button"
              onClick={onOpenDebts}
              className="shrink-0 text-[11px] font-semibold text-[var(--brand)] hover:underline"
            >
              {t('overview.openDebtsShort')}
            </button>
          }>
            {tOverview('debtComposition')}
          </SectionTitle>
          <div className="mt-2">
            <DebtDonut debts={debts} />
          </div>
          <Rule className="my-3" />
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label>{tOverview('totalDebt')}</Label>
              <Amount value={formatRp(totalDebt)} tone="due" size="sm" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <Label>{tOverview('monthlyInstallment')}</Label>
              <Amount value={formatRp(monthlyDebtBurden)} size="sm" />
            </div>
            <p className="text-[11px] text-[var(--text-faint)]">
              {activeDebtCount} {tOverview('activeDebts')}
            </p>
          </div>
        </section>
      </div>

      {/* Jatuh tempo + transaksi terbaru */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="size-4 text-[var(--due)]" aria-hidden />
              {tOverview('upcoming')}
            </span>
          </SectionTitle>

          {upcomingDueGroups.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[var(--text-muted)]">
              {tOverview('upcomingEmpty')}
            </p>
          ) : (
            <div className="mt-2">
              {upcomingDueGroups.map((g) => {
                // Kalo total pinjaman dalam gugus <= 10, tampilkan semua;
                // kalau lebih, 9 tertinggi + 1 baris "N lainnya".
                const shown = g.items.length <= 10 ? g.items : g.items.slice(0, 9);
                const hidden = g.items.length - shown.length;
                return (
                  <div
                    key={g.dueDay}
                    className="group relative flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[var(--text)]">
                        {tOverview('dueMerged', { count: g.items.length })}
                      </p>
                      <p className="text-[11px] text-[var(--text-faint)]">
                        {formatDate(g.nextDue.toISOString().slice(0, 10))} ·{' '}
                        {g.items.map((d) => d.platform).join(', ')}
                      </p>
                    </div>
                    <Amount value={formatRp(g.total)} tone="due" size="sm" />

                    {/* Detail muncul saat hover */}
                    <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 hidden w-[min(20rem,calc(100vw-3rem))] rounded-lg border border-[var(--line)] bg-[var(--surface-1)] p-3 shadow-lg group-hover:block">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {tOverview('dueDetailTitle')} · {g.items.length}{' '}
                        {tOverview('dueDetailCount')}
                      </p>
                      <div className="max-h-56 overflow-y-auto">
                        {shown.map((d) => (
                          <div
                            key={d.id}
                            className="tnum flex items-center justify-between gap-3 py-1 text-[12px]"
                          >
                            <span className="truncate text-[var(--text)]">
                              {d.platform}
                            </span>
                            <span className="shrink-0 text-[var(--text-muted)]">
                              {formatRp(d.monthly_installment)}
                            </span>
                          </div>
                        ))}
                        {hidden > 0 && (
                          <div className="tnum flex items-center justify-between gap-3 border-t border-[var(--line)] py-1 text-[12px] font-semibold text-[var(--text-muted)]">
                            <span>
                              {tOverview('dueOthers', { count: hidden })}
                            </span>
                            <span>{formatRp(g.total - shown.reduce((s, d) => s + Number(d.monthly_installment), 0))}</span>
                          </div>
                        )}
                      </div>
                      <div className="tnum mt-1.5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-1.5 text-[12px] font-semibold text-[var(--text)]">
                        <span>{tOverview('dueTotal')}</span>
                        <span>{formatRp(g.total)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <SectionTitle
            action={
              <button
                type="button"
                onClick={onOpenCashflow}
                className="text-[12px] font-semibold text-[var(--brand)] hover:underline"
              >
                {tOverview('viewAll')}
              </button>
            }
          >
            {tOverview('recent')}
          </SectionTitle>

          {recentTransactions.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[var(--text-muted)]">
              {tOverview('recentEmpty')}
            </p>
          ) : (
            <div className="mt-2">
              {recentTransactions.map((tx) => {
                const meta = getCategory(tx.category);
                const Icon = meta.icon;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        className="size-4 shrink-0 text-[var(--text-faint)]"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[var(--text)]">
                          {tx.description || tx.category}
                        </p>
                        <p className="text-[11px] text-[var(--text-faint)]">
                          {formatDate(tx.transaction_date)} · {tx.category}
                        </p>
                      </div>
                    </div>
                    <Amount
                      value={`${tx.type === 'inflow' ? '+' : '-'}${formatRp(tx.amount)}`}
                      tone={tx.type === 'inflow' ? 'brand' : 'out'}
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Anggaran per kategori */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
        <SectionTitle
          action={
            <button
              type="button"
              onClick={onOpenBudget}
              className="text-[12px] font-semibold text-[var(--brand)] hover:underline"
            >
              {t('budget.set')}
            </button>
          }
        >
          {t('budget.title')}
        </SectionTitle>

        {budgetStatuses.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-5" />}
            title={t('budget.empty.title')}
            description={t('budget.empty.description')}
            action={
              canEdit ? (
                <Button size="sm" onClick={onOpenBudget}>
                  {t('budget.empty.action')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {budgetStatuses.map((status) => (
              <div key={status.budget.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-[var(--text)]">
                    {status.budget.category}
                  </span>
                  <span className="tnum shrink-0 text-[12px] text-[var(--text-muted)]">
                    {formatRp(status.spent)} / {formatRp(status.budget.amount)}
                  </span>
                </div>
                <Progress
                  value={status.percent}
                  tone={status.over ? 'out' : status.percent >= 80 ? 'due' : 'brand'}
                />
                <p
                  className={`text-[11px] ${
                    status.over ? 'text-[var(--out)]' : 'text-[var(--text-faint)]'
                  }`}
                >
                  {status.over
                    ? `${t('budget.over')} · ${formatRp(Math.abs(status.remaining))}`
                    : `${t('budget.remaining')} ${formatRp(status.remaining)}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
