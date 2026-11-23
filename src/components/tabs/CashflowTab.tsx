'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Transaction, TransactionType } from '@/types/finance';
import { formatFullDate, formatRp } from '@/lib/format';
import { getCategory } from '@/lib/categories';
import {
  createDefaultPeriodFilter,
  extractAvailableYears,
  filterTransactionsByPeriod,
  formatPeriodLabel,
  type PeriodFilterState,
} from '@/lib/periodFilter';
import { Amount, Label } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { PeriodFilterPopover } from '@/components/ui/PeriodFilterPopover';

type SortKey = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

interface CashflowTabProps {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  filterType: 'all' | TransactionType;
  searchQuery: string;
  canEdit: boolean;
  accounts?: { id: string; name: string; kind: string; currency: string }[];
  sharedGroups?: { id: string; name: string }[];
  onFilterTypeChange: (value: 'all' | TransactionType) => void;
  onSearchChange: (value: string) => void;
  onEdit?: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onQuickAdd: () => void;
  onExportCsv: () => void;
}

const TONE_BADGE: Record<string, string> = {
  brand: 'bg-[var(--brand-soft)] text-[var(--brand)]',
  out: 'bg-[var(--out-soft)] text-[var(--out)]',
  due: 'bg-[var(--due-soft)] text-[var(--due)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  muted: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
};

/**
 * Riwayat arus kas (ledger presisi).
 *
 * Seluruh filter Periode, Dompet, dan Kategori diringkas ke dalam satu ikon
 * Filter popover berbasis dropdown (skalabel tanpa batas tahun/dompet).
 */
export function CashflowTab({
  transactions,
  filteredTransactions,
  filterType,
  searchQuery,
  canEdit,
  accounts = [],
  sharedGroups = [],
  onFilterTypeChange,
  onSearchChange,
  onEdit,
  onDelete,
  onQuickAdd,
  onExportCsv,
}: CashflowTabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const groupById = useMemo(
    () => new Map(sharedGroups.map((g) => [g.id, g.name])),
    [sharedGroups]
  );

  const walletLabel = (tx: Transaction) => {
    if (tx.account_id) {
      const acc = accountById.get(tx.account_id);
      if (acc) return acc.name;
    }
    if (tx.source === 'manual_non_physical') return 'Non-Tunai';
    return 'Tunai';
  };

  const t = useTranslations();
  const tCashflow = useTranslations('cashflow');
  const tCommon = useTranslations('common');

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>(() =>
    createDefaultPeriodFilter('all')
  );
  const [selectedWallet, setSelectedWallet] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_STEP = 50;
  const [visibleLimit, setVisibleLimit] = useState(PAGE_STEP);

  const availableYears = useMemo(
    () => extractAvailableYears(transactions),
    [transactions]
  );

  const walletOptions = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    if (transactions.some((tx) => !tx.account_id)) {
      list.push({ id: '__cash__', label: isEn ? 'Cash (Tunai)' : 'Kas Tunai' });
    }
    for (const acc of accounts) {
      list.push({ id: acc.id, label: acc.name });
    }
    return list;
  }, [transactions, accounts, isEn]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      if (tx.category) set.add(tx.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const refined = useMemo(() => {
    const byPeriod = filterTransactionsByPeriod(filteredTransactions, periodFilter);
    return byPeriod.filter((tx) => {
      if (selectedWallet === '__cash__' && tx.account_id) return false;
      if (
        selectedWallet !== 'all' &&
        selectedWallet !== '__cash__' &&
        tx.account_id !== selectedWallet
      ) {
        return false;
      }
      if (selectedCategory !== 'all' && tx.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [filteredTransactions, periodFilter, selectedWallet, selectedCategory]);

  const sorted = useMemo(() => {
    const rows = [...refined];
    rows.sort((a, b) => {
      if (sortKey === 'amount') {
        const diff = Number(a.amount) - Number(b.amount);
        return sortDir === 'asc' ? diff : -diff;
      }
      const diff = a.transaction_date.localeCompare(b.transaction_date);
      return sortDir === 'asc' ? diff : -diff;
    });
    return rows;
  }, [refined, sortKey, sortDir]);

  const summary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of refined) {
      if (tx.type === 'inflow') inflow += Number(tx.amount);
      else outflow += Number(tx.amount);
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [refined]);

  const visibleRows = useMemo(
    () => sorted.slice(0, visibleLimit),
    [sorted, visibleLimit]
  );
  const remainingCount = Math.max(0, sorted.length - visibleRows.length);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const activeFilterCount =
    (periodFilter.preset !== 'all' ? 1 : 0) +
    (selectedWallet !== 'all' ? 1 : 0) +
    (selectedCategory !== 'all' ? 1 : 0);

  const resetSubFilters = () => {
    setPeriodFilter(createDefaultPeriodFilter('all'));
    setSelectedWallet('all');
    setSelectedCategory('all');
    setVisibleLimit(PAGE_STEP);
  };

  const resetAllFilters = () => {
    onSearchChange('');
    onFilterTypeChange('all');
    resetSubFilters();
  };

  const filterOptions = [
    { value: 'all' as const, label: tCashflow('filterAll') },
    { value: 'inflow' as const, label: tCashflow('filterInflow') },
    { value: 'outflow' as const, label: tCashflow('filterOutflow') },
  ];

  const hasAnyTransaction = transactions.length > 0;
  const selectCls =
    'h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none';

  return (
    <div className="space-y-4">
      {/* Header & kontrol utama — ringkas 1 baris tanpa strip filter memanjang */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tCashflow('title')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tCashflow('subtitle')} ·{' '}
            <span className="tnum font-medium text-[var(--text)]">
              {tCashflow('count', { count: refined.length })}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative sm:w-52">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]"
              aria-hidden
            />
            <input
              id="cashflow-search"
              name="cashflowSearch"
              type="search"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setVisibleLimit(PAGE_STEP);
              }}
              placeholder={tCommon('searchPlaceholder')}
              aria-label={tCommon('search')}
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] pl-9 pr-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] transition focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Segmented
              options={filterOptions}
              value={filterType}
              onChange={(val) => {
                onFilterTypeChange(val);
                setVisibleLimit(PAGE_STEP);
              }}
              size="sm"
              ariaLabel={tCashflow('filterAll')}
            />

            {/* Satu ikon Filter corong untuk Periode + Dompet + Kategori (skalabel) */}
            <PeriodFilterPopover
              value={periodFilter}
              onChange={(next) => {
                setPeriodFilter(next);
                setVisibleLimit(PAGE_STEP);
              }}
              availableYears={availableYears}
              isEn={isEn}
              activeCount={activeFilterCount}
              hint={isEn ? 'Period, Wallet & Category' : 'Periode, Dompet & Kategori'}
              onReset={resetSubFilters}
              extraFields={
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="cf-wallet-select"
                      className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                    >
                      {isEn ? 'Wallet' : 'Dompet'}
                    </label>
                    <select
                      id="cf-wallet-select"
                      value={selectedWallet}
                      onChange={(e) => {
                        setSelectedWallet(e.target.value);
                        setVisibleLimit(PAGE_STEP);
                      }}
                      className={selectCls}
                    >
                      <option value="all">
                        {isEn ? 'All Wallets' : 'Semua Dompet'}
                      </option>
                      {walletOptions.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="cf-category-select"
                      className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                    >
                      {isEn ? 'Category' : 'Kategori'}
                    </label>
                    <select
                      id="cf-category-select"
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setVisibleLimit(PAGE_STEP);
                      }}
                      className={selectCls}
                    >
                      <option value="all">
                        {isEn ? 'All Categories' : 'Semua Kategori'}
                      </option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              }
            />

            <IconButton
              label={t('settings.data.exportCsv')}
              variant="secondary"
              size="sm"
              onClick={onExportCsv}
              disabled={!hasAnyTransaction}
            >
              <Download className="size-4" />
            </IconButton>

            {canEdit && (
              <Button size="sm" icon={<Plus className="size-4" />} onClick={onQuickAdd}>
                {tCommon('add')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Chip ringkas hanya muncul bila ada filter aktif (0 space saat default) */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {periodFilter.preset !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-2 py-0.5 font-semibold text-[var(--brand)]">
              {formatPeriodLabel(periodFilter, isEn)}
              <button
                type="button"
                aria-label="Hapus filter periode"
                onClick={() => {
                  setPeriodFilter(createDefaultPeriodFilter('all'));
                  setVisibleLimit(PAGE_STEP);
                }}
                className="hover:opacity-75"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          {selectedWallet !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-2 py-0.5 font-semibold text-[var(--brand)]">
              {walletOptions.find((w) => w.id === selectedWallet)?.label ?? selectedWallet}
              <button
                type="button"
                aria-label="Hapus filter dompet"
                onClick={() => {
                  setSelectedWallet('all');
                  setVisibleLimit(PAGE_STEP);
                }}
                className="hover:opacity-75"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          {selectedCategory !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-2 py-0.5 font-semibold text-[var(--brand)]">
              {selectedCategory}
              <button
                type="button"
                aria-label="Hapus filter kategori"
                onClick={() => {
                  setSelectedCategory('all');
                  setVisibleLimit(PAGE_STEP);
                }}
                className="hover:opacity-75"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={resetSubFilters}
            className="ml-1 font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
          >
            Reset
          </button>
        </div>
      )}

      {/* Ringkasan ringkas sesuai filter aktif */}
      {refined.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <ArrowDownRight className="size-3.5 text-[var(--brand)]" aria-hidden />
              Masuk
            </span>
            <Amount value={formatRp(summary.inflow)} tone="brand" size="sm" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <ArrowUpRight className="size-3.5 text-[var(--out)]" aria-hidden />
              Keluar
            </span>
            <Amount value={formatRp(summary.outflow)} tone="out" size="sm" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] px-3.5 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Selisih
            </span>
            <Amount
              value={`${summary.net >= 0 ? '+' : ''}${formatRp(summary.net)}`}
              tone={summary.net >= 0 ? 'brand' : 'out'}
              size="sm"
            />
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          {hasAnyTransaction ? (
            <EmptyState
              title={tCashflow('noMatch')}
              action={
                <Button size="sm" variant="secondary" onClick={resetAllFilters}>
                  {tCommon('all')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Plus className="size-5" />}
              title={tCashflow('empty.title')}
              description={tCashflow('empty.description')}
              action={
                canEdit ? (
                  <Button size="sm" onClick={onQuickAdd}>
                    {tCashflow('empty.action')}
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)] shadow-[var(--shadow-sm)]">
          {/* Mobile: kartu 2-baris lega */}
          <div className="divide-y divide-[var(--line)] sm:hidden">
            {visibleRows.map((tx) => {
              const meta = getCategory(tx.category);
              const Icon = meta.icon;
              const expanded = expandedId === tx.id;
              return (
                <div
                  key={tx.id}
                  onClick={() => setExpandedId(expanded ? null : tx.id)}
                  className="cursor-pointer px-3.5 py-3 transition-colors hover:bg-[var(--surface-2)]/60"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        TONE_BADGE[meta.tone] ?? TONE_BADGE.muted
                      }`}
                    >
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`min-w-0 flex-1 text-[13px] font-medium leading-snug text-[var(--text)] ${
                            expanded ? 'break-anywhere whitespace-normal' : 'truncate'
                          }`}
                        >
                          {tx.description || tx.category}
                        </p>
                        <Amount
                          value={`${tx.type === 'inflow' ? '+' : '-'}${formatRp(tx.amount)}`}
                          tone={tx.type === 'inflow' ? 'brand' : 'out'}
                          size="sm"
                          className="shrink-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
                          <span className="tnum whitespace-nowrap">
                            {formatFullDate(tx.transaction_date)}
                          </span>
                          <span>·</span>
                          <span className="truncate">{tx.category}</span>
                          <span className="max-w-[110px] truncate rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                            {walletLabel(tx)}
                          </span>
                          {tx.group_id && groupById.get(tx.group_id) && (
                            <span className="truncate rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                              {groupById.get(tx.group_id)}
                            </span>
                          )}
                        </div>
                        {canEdit && (
                          <div
                            className="flex shrink-0 items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {onEdit && (
                              <IconButton
                                label="Edit"
                                size="sm"
                                onClick={() => onEdit(tx)}
                                className="text-[var(--text-faint)] hover:text-[var(--brand)]"
                              >
                                <Pencil className="size-3.5" />
                              </IconButton>
                            )}
                            <IconButton
                              label={tCommon('delete')}
                              size="sm"
                              onClick={() => onDelete(tx.id)}
                              className="text-[var(--text-faint)] hover:text-[var(--out)]"
                            >
                              <Trash2 className="size-3.5" />
                            </IconButton>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: tabel ledger `table-fixed` */}
          <table className="hidden w-full table-fixed border-collapse text-left sm:table">
            <thead className="sticky top-0 z-10 bg-[var(--surface-2)]">
              <tr className="border-b border-[var(--line)]">
                <th scope="col" className="w-[116px] px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('date')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] transition hover:text-[var(--text)]"
                  >
                    {tCommon('date')}
                    {sortKey === 'date' &&
                      (sortDir === 'asc' ? (
                        <ArrowUp className="size-3" aria-hidden />
                      ) : (
                        <ArrowDown className="size-3" aria-hidden />
                      ))}
                  </button>
                </th>
                <th scope="col" className="px-4 py-2.5">
                  <Label>{tCommon('description')}</Label>
                </th>
                <th scope="col" className="hidden w-[224px] px-4 py-2.5 lg:table-cell">
                  <Label>{tCommon('category')}</Label>
                </th>
                <th scope="col" className="w-[146px] px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('amount')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] transition hover:text-[var(--text)]"
                  >
                    {tCommon('amount')}
                    {sortKey === 'amount' &&
                      (sortDir === 'asc' ? (
                        <ArrowUp className="size-3" aria-hidden />
                      ) : (
                        <ArrowDown className="size-3" aria-hidden />
                      ))}
                  </button>
                </th>
                {canEdit && <th scope="col" className="w-[74px] px-2 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((tx) => {
                const meta = getCategory(tx.category);
                const Icon = meta.icon;
                const expanded = expandedId === tx.id;
                const descText = tx.description || tx.category;
                const wLabel = walletLabel(tx);
                return (
                  <tr
                    key={tx.id}
                    onClick={() => setExpandedId(expanded ? null : tx.id)}
                    className={`group cursor-pointer border-b border-[var(--line)] transition-colors last:border-b-0 ${
                      expanded ? 'bg-[var(--surface-2)]/70' : 'hover:bg-[var(--surface-2)]/55'
                    }`}
                  >
                    <td className="tnum whitespace-nowrap px-4 py-2.5 align-middle text-[12px] text-[var(--text-muted)]">
                      {formatFullDate(tx.transaction_date)}
                    </td>
                    <td className="min-w-0 px-4 py-2.5 align-middle">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                            TONE_BADGE[meta.tone] ?? TONE_BADGE.muted
                          }`}
                        >
                          <Icon className="size-3.5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            title={descText}
                            className={`text-[13px] font-medium text-[var(--text)] ${
                              expanded ? 'break-anywhere whitespace-normal' : 'truncate'
                            }`}
                          >
                            {descText}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-faint)] lg:hidden">
                            {tx.category} · {wLabel}
                          </p>
                          <AnimatePresence initial={false}>
                            {expanded && (
                              <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.16 }}
                                className="mt-1 overflow-hidden text-[11px] text-[var(--text-muted)]"
                              >
                                Sumber:{' '}
                                <span className="font-medium text-[var(--text)]">{wLabel}</span>
                                {' · '}Kategori:{' '}
                                <span className="font-medium text-[var(--text)]">
                                  {tx.category}
                                </span>
                                {tx.source === 'import' ? ' · Impor Mutasi' : ''}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                        {tx.source === 'ai_scan' && (
                          <span className="shrink-0 rounded bg-[var(--info-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--info)]">
                            AI
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 align-middle text-[12px] text-[var(--text-muted)] lg:table-cell">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium text-[var(--text)]">
                          {tx.category}
                        </span>
                        <span
                          title={wLabel}
                          className="max-w-[108px] shrink-0 truncate rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
                        >
                          {wLabel}
                        </span>
                        {tx.group_id && groupById.get(tx.group_id) && (
                          <span className="shrink-0 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                            {groupById.get(tx.group_id)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right align-middle">
                      <Amount
                        value={`${tx.type === 'inflow' ? '+' : '-'}${formatRp(tx.amount)}`}
                        tone={tx.type === 'inflow' ? 'brand' : 'out'}
                        size="sm"
                      />
                    </td>
                    {canEdit && (
                      <td
                        className="px-2 py-2.5 text-right align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
                          {onEdit && (
                            <IconButton
                              label="Edit"
                              size="sm"
                              onClick={() => onEdit(tx)}
                              className="text-[var(--text-faint)] hover:text-[var(--brand)]"
                            >
                              <Pencil className="size-3.5" />
                            </IconButton>
                          )}
                          <IconButton
                            label={tCommon('delete')}
                            size="sm"
                            onClick={() => onDelete(tx.id)}
                            className="text-[var(--text-faint)] hover:text-[var(--out)]"
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {remainingCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--surface-2)]/60 px-4 py-3">
              <p className="tnum text-[12px] text-[var(--text-muted)]">
                Menampilkan{' '}
                <span className="font-semibold text-[var(--text)]">
                  {visibleRows.length.toLocaleString('id-ID')}
                </span>{' '}
                dari{' '}
                <span className="font-semibold text-[var(--text)]">
                  {sorted.length.toLocaleString('id-ID')}
                </span>{' '}
                transaksi
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_STEP)}
                >
                  Muat {Math.min(PAGE_STEP, remainingCount)} lagi
                </Button>
                {remainingCount > PAGE_STEP && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setVisibleLimit(sorted.length)}
                  >
                    Tampilkan semua ({sorted.length.toLocaleString('id-ID')})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
