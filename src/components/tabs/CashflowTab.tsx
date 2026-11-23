'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Transaction, TransactionType } from '@/types/finance';
import type { ReceiptsApi } from '@/hooks/useReceipts';
import type { StoredReceiptMeta } from '@/app/api/receipts/route';
import { formatFileBytes } from '@/lib/imageCompress';
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
import { Modal } from '@/components/ui/Modal';
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
  receipts?: ReceiptsApi;
  onFilterTypeChange: (value: 'all' | TransactionType) => void;
  onSearchChange: (value: string) => void;
  onEdit?: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onQuickAdd: () => void;
  onExportCsv: (rows?: Transaction[], periodLabel?: string) => void;
  onExportPdf?: (rows?: Transaction[], periodLabel?: string) => void;
  onExportExcel?: (rows?: Transaction[], periodLabel?: string) => void;
  onExportWord?: (rows?: Transaction[], periodLabel?: string) => void;
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
  receipts,
  onFilterTypeChange,
  onSearchChange,
  onEdit,
  onDelete,
  onQuickAdd,
  onExportCsv,
  onExportPdf,
  onExportExcel,
  onExportWord,
}: CashflowTabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [previewReceipt, setPreviewReceipt] = useState<{
    meta: StoredReceiptMeta;
    url: string | null;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

  const openReceiptPreview = async (meta: StoredReceiptMeta) => {
    setPreviewReceipt({ meta, url: null, loading: true });
    const url = (await receipts?.getSignedUrl(meta.id)) ?? null;
    setPreviewReceipt({ meta, url, loading: false });
  };
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
            {receipts && (
              <span className="tnum ml-1.5 text-[11px] text-[var(--text-faint)]">
                · Struk:{' '}
                {receipts.unlimited
                  ? `${formatFileBytes(receipts.usedBytes)} / Unlimited`
                  : `${formatFileBytes(receipts.usedBytes)} / ${receipts.quotaMb ?? 5} MB`}
                {receipts.aiDailyLimit !== null
                  ? ` · AI: ${receipts.aiUsedToday}/${receipts.aiDailyLimit}/hr`
                  : ''}
              </span>
            )}
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

          <div className="flex flex-wrap items-center gap-2">
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

            {/* Popover Ekspor 4 Format (PDF E-Statement, Excel .xlsx, Word .docx, CSV) */}
            <div ref={exportRef} className="relative">
              <IconButton
                label={isEn ? 'Export Report' : 'Ekspor Laporan'}
                variant="secondary"
                size="sm"
                onClick={() => setExportOpen((v) => !v)}
                disabled={!hasAnyTransaction}
              >
                <Download className="size-4" />
              </IconButton>

              <AnimatePresence>
                {exportOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-1.5 shadow-[var(--shadow-lg)]"
                  >
                    <div className="border-b border-[var(--line)] px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {isEn ? 'Export E-Statement' : 'Ekspor E-Statement'}
                      </p>
                      <p className="tnum text-[10px] text-[var(--text-faint)]">
                        {formatPeriodLabel(periodFilter, isEn)} ·{' '}
                        {sorted.length.toLocaleString('id-ID')}{' '}
                        {isEn ? 'rows' : 'baris'}
                      </p>
                    </div>

                    <div className="mt-1 space-y-0.5">
                      {onExportPdf && (
                        <button
                          type="button"
                          onClick={() => {
                            setExportOpen(false);
                            onExportPdf(sorted, formatPeriodLabel(periodFilter, isEn));
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-[var(--text)] transition hover:bg-[var(--surface-2)]"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--out-soft)] text-[var(--out)]">
                            <FileText className="size-3.5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">PDF (E-Statement)</span>
                            <span className="block text-[10px] text-[var(--text-faint)]">
                              Gaya rekening koran bank + logo
                            </span>
                          </span>
                        </button>
                      )}

                      {onExportExcel && (
                        <button
                          type="button"
                          onClick={() => {
                            setExportOpen(false);
                            onExportExcel(sorted, formatPeriodLabel(periodFilter, isEn));
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-[var(--text)] transition hover:bg-[var(--surface-2)]"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--brand-soft)] text-[var(--brand)]">
                            <FileSpreadsheet className="size-3.5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">Excel (.xlsx)</span>
                            <span className="block text-[10px] text-[var(--text-faint)]">
                              Multi-sheet (Ringkasan, Kas, Pinjaman)
                            </span>
                          </span>
                        </button>
                      )}

                      {onExportWord && (
                        <button
                          type="button"
                          onClick={() => {
                            setExportOpen(false);
                            onExportWord(sorted, formatPeriodLabel(periodFilter, isEn));
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-[var(--text)] transition hover:bg-[var(--surface-2)]"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--info-soft)] text-[var(--info)]">
                            <FileText className="size-3.5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">Word (.docx)</span>
                            <span className="block text-[10px] text-[var(--text-faint)]">
                              Laporan resmi siap edit
                            </span>
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setExportOpen(false);
                          onExportCsv(sorted, formatPeriodLabel(periodFilter, isEn));
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-[var(--text)] transition hover:bg-[var(--surface-2)]"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--text-muted)]">
                          <Download className="size-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">CSV (.csv)</span>
                          <span className="block text-[10px] text-[var(--text-faint)]">
                            Data mentah & impor balik
                          </span>
                        </span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
                {canEdit && <th scope="col" className="w-[82px] px-2 py-2.5" />}
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
                          {(() => {
                            const rec = receipts?.byTransactionId.get(tx.id);
                            return rec ? (
                              <IconButton
                                label={isEn ? 'View receipt' : 'Lihat struk'}
                                size="sm"
                                onClick={() => void openReceiptPreview(rec)}
                                className="text-[var(--brand)] hover:text-[var(--brand)]"
                              >
                                <Receipt className="size-3.5" />
                              </IconButton>
                            ) : null;
                          })()}
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
              <div className="flex flex-wrap items-center gap-2">
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

      {/* Modal Pratinjau Struk Terlampir */}
      <Modal
        open={Boolean(previewReceipt)}
        onClose={() => setPreviewReceipt(null)}
        title={previewReceipt?.meta.label || 'Struk Transaksi'}
        description={
          previewReceipt
            ? `Ukuran terkompresi: ${formatFileBytes(previewReceipt.meta.sizeBytes)}`
            : undefined
        }
        size="md"
      >
        {previewReceipt && (
          <div className="space-y-3">
            {previewReceipt.loading ? (
              <div className="flex h-64 items-center justify-center text-[12px] text-[var(--text-muted)]">
                Memuat gambar struk...
              </div>
            ) : previewReceipt.url ? (
              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewReceipt.url}
                  alt={previewReceipt.meta.label}
                  className="max-h-[60vh] w-full object-contain"
                />
              </div>
            ) : (
              <p className="py-8 text-center text-[12px] text-[var(--out)]">
                Gagal memuat gambar struk.
              </p>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
              {canEdit && receipts ? (
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 className="size-3.5" />}
                  onClick={async () => {
                    const ok = await receipts.deleteReceipt(previewReceipt.meta.id);
                    if (ok) setPreviewReceipt(null);
                  }}
                >
                  Hapus Struk
                </Button>
              ) : (
                <span />
              )}

              {previewReceipt.url && (
                <a
                  href={previewReceipt.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[12px] font-semibold text-[var(--text)] transition hover:border-[var(--brand)]"
                >
                  <Download className="size-3.5" aria-hidden />
                  Unduh Asli
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
