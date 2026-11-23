'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  Filter,
} from 'lucide-react';
import type { Debt, Transaction } from '@/types/finance';
import { daysUntil, formatDate, formatFullDate, formatRp } from '@/lib/format';
import { getCategory } from '@/lib/categories';
import {
  createDefaultPeriodFilter,
  filterTransactionsByPeriod,
  formatPeriodLabel,
  type PeriodFilterState,
  type PeriodPreset,
} from '@/lib/periodFilter';
import { Amount, Label, Progress, Rule, SectionTitle } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { EmptyState } from '@/components/ui/EmptyState';
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
 * Ringkasan utama dashboard dengan Filter Periode terpadu (Icon Popover)
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
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target as Node)
      ) {
        setFilterOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterOpen]);

  // Transaksi tersaring sesuai periode aktif — dipakai oleh MASUK, KELUAR, Tingkat Tabung & Grafik
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

  // Tahun historis dari data transaksi nyata (untuk shortcut 1-klik di mode Custom)
  const availableYears = useMemo(() => {
    const ys = new Set<string>();
    for (const tx of transactions) {
      const y = tx.transaction_date?.slice(0, 4);
      if (y && /^\d{4}$/.test(y)) ys.add(y);
    }
    return [...ys].sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
        .slice(0, 6),
    [transactions]
  );

  const activePeriodLabel = formatPeriodLabel(periodFilter, isEn);

  const presetItems: { id: PeriodPreset; label: string; hint: string }[] = [
    {
      id: 'day',
      label: isEn ? 'Today' : 'Hari ini',
      hint: isEn ? 'Current day' : 'Transaksi hari ini',
    },
    {
      id: 'week',
      label: isEn ? 'Week (7d)' : 'Minggu',
      hint: isEn ? 'Last 7 days' : '7 hari terakhir',
    },
    {
      id: 'month',
      label: isEn ? 'Month' : 'Bulan',
      hint: isEn ? 'This calendar month' : 'Bulan berjalan',
    },
    {
      id: 'ytd',
      label: 'YTD',
      hint: isEn ? 'Jan 1 – Today' : 'Awal tahun s/d hari ini',
    },
    {
      id: 'year',
      label: isEn ? 'Year' : 'Tahun',
      hint: isEn ? 'Full current year' : 'Satu tahun penuh',
    },
    {
      id: 'all',
      label: isEn ? 'All Time' : 'Semua',
      hint: isEn ? 'Entire history' : 'Seluruh riwayat',
    },
    {
      id: 'custom',
      label: 'Custom',
      hint: isEn ? 'Pick date range' : 'Pilih rentang tanggal',
    },
  ];

  const selectPreset = (preset: PeriodPreset) => {
    setPeriodFilter((prev) => ({ ...prev, preset }));
    if (preset !== 'custom') {
      setFilterOpen(false);
    }
  };

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
                {/* Hover saldo: detail dompet tunai vs non-tunai */}
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

            {/* Ikon Filter Corong (icon-only) + Popover Periode */}
            <div ref={filterPopoverRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={filterOpen}
                aria-label={isEn ? 'Filter period' : 'Filter periode'}
                title={isEn ? `Filter period: ${activePeriodLabel}` : `Filter periode: ${activePeriodLabel}`}
                className={`inline-flex size-9 items-center justify-center rounded-lg border transition ${
                  filterOpen
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
                }`}
              >
                <Filter className="size-4" aria-hidden />
              </button>

              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    role="dialog"
                    aria-label={isEn ? 'Period Filter' : 'Filter Periode'}
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-full z-40 mt-2 w-[min(19.5rem,calc(100vw-2.5rem))] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-3 shadow-[var(--shadow-lg)]"
                  >
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {isEn ? 'Filter Period' : 'Filter Periode'}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)]">
                        {isEn ? 'Applies to In/Out & Chart' : 'Berlaku ke Masuk/Keluar & Grafik'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {presetItems.map((item) => {
                        const active = periodFilter.preset === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => selectPreset(item.id)}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                              item.id === 'custom' ? 'col-span-2' : ''
                            } ${
                              active
                                ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                                : 'border-[var(--line)] bg-[var(--surface-2)]/60 text-[var(--text)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold leading-tight">
                                {item.label}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-[var(--text-faint)]">
                                {item.hint}
                              </p>
                            </div>
                            {active && <Check className="size-3.5 shrink-0" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Rentang tanggal custom + shortcut tahun historis */}
                    <AnimatePresence initial={false}>
                      {periodFilter.preset === 'custom' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.16 }}
                          className="mt-3 space-y-2.5 overflow-hidden border-t border-[var(--line)] pt-3"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label
                                htmlFor="overview-filter-start"
                                className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                              >
                                {isEn ? 'From' : 'Dari Tanggal'}
                              </label>
                              <input
                                id="overview-filter-start"
                                type="date"
                                value={periodFilter.startDate}
                                onChange={(e) =>
                                  setPeriodFilter((prev) => ({
                                    ...prev,
                                    preset: 'custom',
                                    startDate: e.target.value,
                                  }))
                                }
                                className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="overview-filter-end"
                                className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                              >
                                {isEn ? 'To' : 'Sampai Tanggal'}
                              </label>
                              <input
                                id="overview-filter-end"
                                type="date"
                                value={periodFilter.endDate}
                                onChange={(e) =>
                                  setPeriodFilter((prev) => ({
                                    ...prev,
                                    preset: 'custom',
                                    endDate: e.target.value,
                                  }))
                                }
                                className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[11px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                              />
                            </div>
                          </div>

                          {availableYears.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="pr-1 text-[10px] font-semibold text-[var(--text-faint)]">
                                {isEn ? 'Quick year:' : 'Tahun cepat:'}
                              </span>
                              {availableYears.map((yr) => (
                                <button
                                  key={yr}
                                  type="button"
                                  onClick={() => {
                                    setPeriodFilter({
                                      preset: 'custom',
                                      startDate: `${yr}-01-01`,
                                      endDate: `${yr}-12-31`,
                                    });
                                    setFilterOpen(false);
                                  }}
                                  className="tnum rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                                >
                                  {yr}
                                </button>
                              ))}
                            </div>
                          )}

                          <Button
                            size="sm"
                            fullWidth
                            onClick={() => setFilterOpen(false)}
                          >
                            {isEn ? 'Apply Range' : 'Terapkan Rentang'}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
