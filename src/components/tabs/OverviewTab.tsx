'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Filter,
} from 'lucide-react';
import type { Debt, Transaction } from '@/types/finance';
import { daysUntil, formatDate, formatFullDate, formatRp } from '@/lib/format';
import { getCategory } from '@/lib/categories';
import {
  createDefaultPeriodFilter,
  extractAvailableYears,
  filterTransactionsByPeriod,
  formatPeriodLabel,
  type PeriodFilterState,
} from '@/lib/periodFilter';
import { Amount, Label, Progress, Rule, SectionTitle } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { PeriodFilterPopover } from '@/components/ui/PeriodFilterPopover';
import { CashflowChart } from '@/components/charts/CashflowChart';
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
  /** Aset dompet: tunai vs non-tunai, untuk tooltip di hero saldo. */
  assetTotals?: { physical: number; nonPhysical: number };
  canEdit: boolean;
  onOpenDebts: () => void;
  onOpenCashflow: () => void;
  onOpenBudget: () => void;
}

const TONE_BADGE: Record<string, string> = {
  brand: 'bg-[var(--brand-soft)] text-[var(--brand)]',
  out: 'bg-[var(--out-soft)] text-[var(--out)]',
  due: 'bg-[var(--due-soft)] text-[var(--due)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  muted: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
};

const cardMotion = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] as const },
});

/**
 * Ringkasan utama dashboard dengan Filter Periode terpadu (Icon Popover 2 baris)
 * yang langsung menyinkronkan MASUK, KELUAR, Tingkat Tabung, dan Grafik Tren.
 */
export function OverviewTab({
  transactions,
  debts,
  netCashflow,
  totalDebt,
  monthlyDebtBurden,
  activeDebtCount,
  upcomingDueGroups,
  budgetStatuses,
  assetTotals,
  canEdit,
  onOpenDebts,
  onOpenCashflow,
  onOpenBudget,
}: OverviewTabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const t = useTranslations();
  const tOverview = useTranslations('overview');

  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(() =>
    createDefaultPeriodFilter('month')
  );
  const [filterOpen, setFilterOpen] = useState(false);

  const periodTransactions = useMemo(
    () => filterTransactionsByPeriod(transactions, periodFilter),
    [transactions, periodFilter]
  );

  const periodStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of periodTransactions) {
      if (tx.type === 'inflow') inflow += Number(tx.amount);
      else outflow += Number(tx.amount);
    }
    const net = inflow - outflow;
    const savingsRate =
      inflow > 0 ? Math.max(0, Math.round((net / inflow) * 100)) : 0;
    return { inflow, outflow, net, savingsRate };
  }, [periodTransactions]);

  const availableYears = useMemo(
    () => extractAvailableYears(transactions),
    [transactions]
  );

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
        .slice(0, 6),
    [transactions]
  );

  const activePeriodLabel = formatPeriodLabel(periodFilter, isEn);

  return (
    <div className="space-y-5">
      {/* HERO - panel saldo dengan ambient radial glow halus */}
      <motion.section
        {...cardMotion(0)}
        className="hero-surface card-interactive rounded-2xl border border-[var(--line)] bg-[var(--surface-1)] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                {assetTotals && assetTotals.physical + assetTotals.nonPhysical > 0 && (
                  <div className="pointer-events-none invisible absolute left-0 top-full z-20 mt-2 w-64 translate-y-1 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)]/95 p-3 opacity-0 shadow-[var(--shadow-lg)] backdrop-blur-sm transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
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
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
              <span>{tOverview('balanceHint')}</span>
              <span>·</span>
              <span>{tOverview('savingsRate')}</span>
              <span className="tnum inline-flex items-center rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
                {periodStats.savingsRate}%
              </span>
            </p>
          </div>

          {/* Badge periode aktif di Hero — klik langsung buka filter periode */}
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            title={isEn ? 'Change period filter' : 'Ubah filter periode'}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/80 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand)] hover:text-[var(--text)]"
          >
            <Filter className="size-3.5 text-[var(--brand)]" aria-hidden />
            <span>{activePeriodLabel}</span>
            <span className="tnum text-[10px] text-[var(--text-faint)]">
              ({periodTransactions.length.toLocaleString('id-ID')})
            </span>
          </button>
        </div>

        {/* Debit / kredit mengikuti filter periode aktif */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-[var(--line)]">
          <div className="sm:pr-5">
            <div className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]">
                <ArrowDownRight className="size-3.5" aria-hidden />
              </span>
              <Label>{tOverview('inflow')}</Label>
              <span className="text-[10px] font-medium text-[var(--text-faint)]">
                · {activePeriodLabel}
              </span>
            </div>
            <div className="mt-1.5">
              <Amount value={formatRp(periodStats.inflow)} tone="brand" size="lg" />
            </div>
          </div>
          <div className="sm:pl-5">
            <div className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-md bg-[var(--out-soft)] text-[var(--out)]">
                <ArrowUpRight className="size-3.5" aria-hidden />
              </span>
              <Label>{tOverview('outflow')}</Label>
              <span className="text-[10px] font-medium text-[var(--text-faint)]">
                · {activePeriodLabel}
              </span>
            </div>
            <div className="mt-1.5">
              <Amount value={formatRp(periodStats.outflow)} tone="out" size="lg" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Tren + komposisi pinjaman */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.section
          {...cardMotion(0.05)}
          className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 lg:col-span-2"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SectionTitle>{tOverview('trendTitle')}</SectionTitle>
              <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
                {activePeriodLabel} · {periodTransactions.length.toLocaleString('id-ID')}{' '}
                {isEn ? 'transactions' : 'transaksi'}
              </p>
            </div>

            <PeriodFilterPopover
              value={periodFilter}
              onChange={setPeriodFilter}
              availableYears={availableYears}
              isEn={isEn}
              open={filterOpen}
              onOpenChange={setFilterOpen}
              hint={
                isEn ? 'Applies to In/Out & Chart' : 'Berlaku ke Masuk/Keluar & Grafik'
              }
              onReset={() => setPeriodFilter(createDefaultPeriodFilter('month'))}
            />
          </div>

          <CashflowChart transactions={periodTransactions} filter={periodFilter} />
        </motion.section>

        <motion.section
          {...cardMotion(0.1)}
          className="card-interactive flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
          <div>
            <SectionTitle
              action={
                <button
                  type="button"
                  onClick={onOpenDebts}
                  className="shrink-0 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                >
                  {t('overview.openDebtsShort')}
                </button>
              }
            >
              {tOverview('debtComposition')}
            </SectionTitle>
            <div className="mt-2">
              <DebtDonut debts={debts} />
            </div>
          </div>
          <div>
            <Rule className="my-3" />
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label>{tOverview('totalDebt')}</Label>
                <Amount value={formatRp(totalDebt)} tone="due" size="sm" className="shrink-0" />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <Label>{tOverview('monthlyInstallment')}</Label>
                <Amount value={formatRp(monthlyDebtBurden)} size="sm" className="shrink-0" />
              </div>
              <p className="text-[11px] text-[var(--text-faint)]">
                {activeDebtCount} {tOverview('activeDebts')}
              </p>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Jatuh tempo + transaksi terbaru */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <motion.section
          {...cardMotion(0.14)}
          className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
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
                const shown = g.items.length <= 10 ? g.items : g.items.slice(0, 9);
                const hidden = g.items.length - shown.length;
                const dueIso = `${g.nextDue.getFullYear()}-${String(g.nextDue.getMonth() + 1).padStart(2, '0')}-${String(g.nextDue.getDate()).padStart(2, '0')}`;
                const dLeft = daysUntil(dueIso);
                const urgent = dLeft <= 3;

                return (
                  <div
                    key={g.dueDay}
                    className="group relative flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 transition-colors last:border-b-0 hover:bg-[var(--surface-2)]/40 sm:rounded-lg sm:px-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-[var(--text)]">
                          {tOverview('dueMerged', { count: g.items.length })}
                        </p>
                        {Number.isFinite(dLeft) && dLeft >= 0 && (
                          <span
                            className={`tnum shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              urgent
                                ? 'bg-[var(--out-soft)] text-[var(--out)]'
                                : 'bg-[var(--due-soft)] text-[var(--due)]'
                            }`}
                          >
                            {dLeft === 0 ? 'Hari ini' : `H-${dLeft}`}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--text-faint)]">
                        {formatDate(dueIso)} · {g.items.map((d) => d.platform).join(', ')}
                      </p>
                    </div>
                    <Amount value={formatRp(g.total)} tone="due" size="sm" className="shrink-0" />

                    {/* Detail muncul halus saat hover */}
                    <div className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1.5 w-[min(20rem,calc(100vw-3rem))] translate-y-1 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)]/95 p-3 opacity-0 shadow-[var(--shadow-lg)] backdrop-blur-sm transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
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
                            <span>
                              {formatRp(
                                g.total -
                                  shown.reduce((s, d) => s + Number(d.monthly_installment), 0)
                              )}
                            </span>
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
        </motion.section>

        <motion.section
          {...cardMotion(0.18)}
          className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
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
                    className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 transition-colors last:border-b-0 hover:bg-[var(--surface-2)]/40 sm:rounded-lg sm:px-1.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                          TONE_BADGE[meta.tone] ?? TONE_BADGE.muted
                        }`}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          title={tx.description || tx.category}
                          className="truncate text-[13px] font-medium text-[var(--text)]"
                        >
                          {tx.description || tx.category}
                        </p>
                        <p className="tnum truncate text-[11px] text-[var(--text-faint)]">
                          {formatFullDate(tx.transaction_date)} · {tx.category}
                        </p>
                      </div>
                    </div>
                    <Amount
                      value={`${tx.type === 'inflow' ? '+' : '-'}${formatRp(tx.amount)}`}
                      tone={tx.type === 'inflow' ? 'brand' : 'out'}
                      size="sm"
                      className="shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>

      {/* Anggaran per kategori */}
      <motion.section
        {...cardMotion(0.22)}
        className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
      >
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
      </motion.section>
    </div>
  );
}
