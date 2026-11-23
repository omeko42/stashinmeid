'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CreditCard,
  TrendingDown,
  TrendingUp,
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
import { Amount, Label, Progress, SectionTitle } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { PeriodFilterPopover } from '@/components/ui/PeriodFilterPopover';
import { CashflowChart } from '@/components/charts/CashflowChart';
import { DebtDonut } from '@/components/charts/DebtDonut';
import type { BudgetStatus } from '@/lib/budget';
import { cn } from '@/lib/cn';

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
  /** Aset dompet: tunai vs non-tunai, untuk ringkasan & tooltip di hero saldo. */
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

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const cardMotion = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, delay, ease: EASE_OUT },
});

/**
 * Ringkasan utama dashboard dengan Filter Periode terpadu (Icon Popover 2 baris),
 * toggle seri grafik interaktif, donut pinjaman bebas tabrakan, dan animasi transisi halus.
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
  const [showInflow, setShowInflow] = useState(true);
  const [showOutflow, setShowOutflow] = useState(true);

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
    const totalVolume = inflow + outflow;
    const inflowShare = totalVolume > 0 ? (inflow / totalVolume) * 100 : 50;
    return { inflow, outflow, net, savingsRate, totalVolume, inflowShare };
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
  const hasAssetTotals = Boolean(
    assetTotals && assetTotals.physical + assetTotals.nonPhysical > 0
  );
  const heroBalance = hasAssetTotals
    ? (assetTotals?.physical ?? 0) + (assetTotals?.nonPhysical ?? 0)
    : netCashflow;

  const toggleSeries = (series: 'inflow' | 'outflow') => {
    if (series === 'inflow') {
      if (showInflow && !showOutflow) return;
      setShowInflow((v) => !v);
    } else {
      if (showOutflow && !showInflow) return;
      setShowOutflow((v) => !v);
    }
  };

  return (
    <div className="space-y-5">
      {/* HERO - panel saldo dengan ambient radial glow, rincian tunai/non-tunai, & arus bersih */}
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

            <div className="mt-2">
              <div className="group relative inline-block">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={heroBalance}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                  >
                    <Amount value={formatRp(heroBalance)} size="hero" />
                  </motion.div>
                </AnimatePresence>

                {hasAssetTotals && assetTotals && (
                  <div className="pointer-events-none invisible absolute left-0 top-full z-20 mt-2 w-64 translate-y-1 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)]/95 p-3 opacity-0 shadow-[var(--shadow-lg)] backdrop-blur-md transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {tOverview('assetTooltip')}
                    </span>
                    <div className="mt-2 space-y-1.5 text-[12px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--text-muted)]">
                          {tOverview('assetPhysical')}
                        </span>
                        <Amount value={formatRp(assetTotals.physical)} size="sm" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--text-muted)]">
                          {tOverview('assetNonPhysical')}
                        </span>
                        <Amount value={formatRp(assetTotals.nonPhysical)} size="sm" />
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-1.5">
                        <span className="font-semibold text-[var(--text-muted)]">
                          {tOverview('assetTotal')}
                        </span>
                        <Amount
                          value={formatRp(assetTotals.physical + assetTotals.nonPhysical)}
                          tone="brand"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rincian ringkas Tunai vs Non-Tunai + Tingkat Tabung */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
              {hasAssetTotals && assetTotals ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-2)]/70 px-2 py-0.5">
                    <Banknote className="size-3 text-[var(--brand)]" aria-hidden />
                    <span>{tOverview('assetPhysical')}</span>
                    <Amount
                      value={formatRp(assetTotals.physical)}
                      size="sm"
                      className="text-[11px]"
                    />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-2)]/70 px-2 py-0.5">
                    <CreditCard className="size-3 text-[var(--info)]" aria-hidden />
                    <span>{tOverview('assetNonPhysical')}</span>
                    <Amount
                      value={formatRp(assetTotals.nonPhysical)}
                      size="sm"
                      className="text-[11px]"
                    />
                  </span>
                </>
              ) : (
                <span>{tOverview('balanceHint')}</span>
              )}

              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-soft)] px-2 py-0.5 font-semibold text-[var(--brand)]">
                <span>{tOverview('savingsRate')}</span>
                <span className="tnum">{periodStats.savingsRate}%</span>
              </span>
            </div>
          </div>

          {/* Kartu Ringkas Arus Bersih Periode Aktif (klik membuka filter periode) */}
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            title={isEn ? 'Change period filter' : 'Ubah filter periode'}
            className="group flex w-fit items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/75 px-3 py-2 text-left transition-all duration-150 hover:border-[var(--brand)] hover:bg-[var(--surface-2)]"
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105',
                periodStats.net >= 0
                  ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                  : 'bg-[var(--out-soft)] text-[var(--out)]'
              )}
            >
              {periodStats.net >= 0 ? (
                <TrendingUp className="size-4" aria-hidden />
              ) : (
                <TrendingDown className="size-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                {isEn ? 'Net Flow' : 'Arus Bersih'} · {activePeriodLabel}
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${activePeriodLabel}-${periodStats.net}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                  className="mt-0.5"
                >
                  <Amount
                    value={`${periodStats.net >= 0 ? '+' : '-'}${formatRp(
                      Math.abs(periodStats.net)
                    )}`}
                    tone={periodStats.net >= 0 ? 'brand' : 'out'}
                    size="sm"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </button>
        </div>

        {/* Debit / kredit mengikuti filter periode aktif + rasio visual Masuk vs Keluar */}
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-[var(--line)]">
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
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`in-${activePeriodLabel}-${periodStats.inflow}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="mt-1.5"
                >
                  <Amount value={formatRp(periodStats.inflow)} tone="brand" size="lg" />
                </motion.div>
              </AnimatePresence>
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
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`out-${activePeriodLabel}-${periodStats.outflow}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="mt-1.5"
                >
                  <Amount value={formatRp(periodStats.outflow)} tone="out" size="lg" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Bilah Rasio Masuk vs Keluar */}
          {periodStats.totalVolume > 0 && (
            <div
              className="mt-3.5 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]"
              aria-hidden
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${periodStats.inflowShare}%` }}
                transition={{ duration: 0.55, ease: EASE_OUT }}
                className="h-full bg-[var(--brand)]"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${100 - periodStats.inflowShare}%` }}
                transition={{ duration: 0.55, ease: EASE_OUT }}
                className="h-full bg-[var(--out)]"
              />
            </div>
          )}
        </div>
      </motion.section>

      {/* Tren + komposisi pinjaman (tinggi seimbang sejajar) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.section
          {...cardMotion(0.06)}
          className="card-interactive flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 lg:col-span-2"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="min-w-0">
              <SectionTitle>{tOverview('trendTitle')}</SectionTitle>
              <p className="tnum mt-0.5 text-[11px] text-[var(--text-faint)]">
                {activePeriodLabel} · {periodTransactions.length.toLocaleString('id-ID')}{' '}
                {isEn ? 'transactions' : 'transaksi'}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Toggle seri Masuk / Keluar interaktif */}
              <button
                type="button"
                onClick={() => toggleSeries('inflow')}
                aria-pressed={showInflow}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition',
                  showInflow
                    ? 'border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-faint)] opacity-65 hover:opacity-100'
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full transition-opacity',
                    showInflow ? 'bg-[var(--brand)]' : 'bg-[var(--text-faint)]'
                  )}
                  aria-hidden
                />
                <span>{isEn ? 'In' : 'Masuk'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSeries('outflow')}
                aria-pressed={showOutflow}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition',
                  showOutflow
                    ? 'border-[var(--out)]/40 bg-[var(--out-soft)] text-[var(--out)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-faint)] opacity-65 hover:opacity-100'
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full transition-opacity',
                    showOutflow ? 'bg-[var(--out)]' : 'bg-[var(--text-faint)]'
                  )}
                  aria-hidden
                />
                <span>{isEn ? 'Out' : 'Keluar'}</span>
              </button>

              <PeriodFilterPopover
                value={periodFilter}
                onChange={setPeriodFilter}
                availableYears={availableYears}
                isEn={isEn}
                open={filterOpen}
                onOpenChange={setFilterOpen}
                hint={
                  isEn
                    ? 'Applies to In/Out & Chart'
                    : 'Berlaku ke Masuk/Keluar & Grafik'
                }
                onReset={() => setPeriodFilter(createDefaultPeriodFilter('month'))}
              />
            </div>
          </div>

          <div className="min-h-[268px] flex-1">
            <CashflowChart
              transactions={periodTransactions}
              filter={periodFilter}
              showInflow={showInflow}
              showOutflow={showOutflow}
            />
          </div>
        </motion.section>

        <motion.section
          {...cardMotion(0.11)}
          className="card-interactive flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
          <div>
            <SectionTitle
              action={
                <button
                  type="button"
                  onClick={onOpenDebts}
                  className="shrink-0 text-[11px] font-semibold text-[var(--brand)] transition hover:underline"
                >
                  {t('overview.openDebtsShort')}
                </button>
              }
            >
              {tOverview('debtComposition')}
            </SectionTitle>
            <div className="mt-2">
              <DebtDonut debts={debts} onSelectDebt={onOpenDebts} />
            </div>
          </div>

          {/* Ringkasan KPI 2-kolom yang rapi di kaki kartu */}
          <div className="mt-3.5 border-t border-[var(--line)] pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <Label className="block truncate text-[10px]">
                  {tOverview('totalDebt')}
                </Label>
                <div className="mt-1">
                  <Amount value={formatRp(totalDebt)} tone="due" size="sm" />
                </div>
                <p className="tnum mt-0.5 text-[10px] text-[var(--text-faint)]">
                  {activeDebtCount} {tOverview('activeDebts')}
                </p>
              </div>
              <div className="min-w-0 border-l border-[var(--line)] pl-3">
                <Label className="block truncate text-[10px]">
                  {tOverview('monthlyInstallment')}
                </Label>
                <div className="mt-1">
                  <Amount value={formatRp(monthlyDebtBurden)} size="sm" />
                </div>
                <p className="mt-0.5 text-[10px] text-[var(--text-faint)]">
                  {isEn ? 'per month' : 'estimasi / bln'}
                </p>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Jatuh tempo + transaksi terbaru */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <motion.section
          {...cardMotion(0.16)}
          className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
          <SectionTitle
            action={
              <button
                type="button"
                onClick={onOpenDebts}
                className="text-[12px] font-semibold text-[var(--brand)] transition hover:underline"
              >
                {tOverview('viewAll')}
              </button>
            }
          >
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
              {upcomingDueGroups.map((g, idx) => {
                const shown = g.items.length <= 10 ? g.items : g.items.slice(0, 9);
                const hidden = g.items.length - shown.length;
                const dueIso = `${g.nextDue.getFullYear()}-${String(g.nextDue.getMonth() + 1).padStart(2, '0')}-${String(g.nextDue.getDate()).padStart(2, '0')}`;
                const dLeft = daysUntil(dueIso);
                const urgent = dLeft <= 3;

                return (
                  <motion.div
                    key={g.dueDay}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: 0.18 + idx * 0.035,
                      ease: EASE_OUT,
                    }}
                    onClick={onOpenDebts}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenDebts();
                      }
                    }}
                    className="group relative flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 transition-all duration-150 last:border-b-0 hover:bg-[var(--surface-2)]/60 sm:rounded-lg sm:px-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-[var(--text)] transition-colors group-hover:text-[var(--brand)]">
                          {tOverview('dueMerged', { count: g.items.length })}
                        </p>
                        {Number.isFinite(dLeft) && dLeft >= 0 && (
                          <span
                            className={`tnum inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              urgent
                                ? 'bg-[var(--out-soft)] text-[var(--out)]'
                                : 'bg-[var(--due-soft)] text-[var(--due)]'
                            }`}
                          >
                            {urgent && (
                              <span
                                className="size-1.5 animate-pulse rounded-full bg-[var(--out)]"
                                aria-hidden
                              />
                            )}
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
                    <div className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1.5 w-[min(20rem,calc(100vw-3rem))] translate-y-1 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)]/95 p-3 opacity-0 shadow-[var(--shadow-lg)] backdrop-blur-md transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
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
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        <motion.section
          {...cardMotion(0.2)}
          className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
          <SectionTitle
            action={
              <button
                type="button"
                onClick={onOpenCashflow}
                className="text-[12px] font-semibold text-[var(--brand)] transition hover:underline"
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
              {recentTransactions.map((tx, idx) => {
                const meta = getCategory(tx.category);
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: 0.2 + idx * 0.03,
                      ease: EASE_OUT,
                    }}
                    onClick={onOpenCashflow}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenCashflow();
                      }
                    }}
                    className="group flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 transition-all duration-150 last:border-b-0 hover:bg-[var(--surface-2)]/60 sm:rounded-lg sm:px-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105 ${
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
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>

      {/* Anggaran per kategori */}
      <motion.section
        {...cardMotion(0.24)}
        className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
      >
        <SectionTitle
          action={
            <button
              type="button"
              onClick={onOpenBudget}
              className="text-[12px] font-semibold text-[var(--brand)] transition hover:underline"
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
            {budgetStatuses.map((status, idx) => (
              <motion.div
                key={status.budget.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: 0.25 + idx * 0.035,
                  ease: EASE_OUT,
                }}
                className="space-y-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-[var(--text)]">
                      {status.parsed.label}
                    </span>
                    {status.parsed.qty && status.parsed.unit && (
                      <span className="tnum shrink-0 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                        {status.parsed.qty} {status.parsed.unit}
                      </span>
                    )}
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
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
