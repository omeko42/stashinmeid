'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Transaction, TransactionType } from '@/types/finance';
import { formatDate, formatRp } from '@/lib/format';
import { getCategory } from '@/lib/categories';
import { Amount, Label } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';

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

/**
 * Riwayat arus kas.
 *
 * Bentuknya tabel ledger, bukan tumpukan kartu: kolom angka rata kanan,
 * tanggal dicap, baris dipisah garis tipis. Sticky header supaya konteks
 * kolom tidak hilang saat tabel panjang.
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
    if (tx.source === 'manual_non_physical') return 'Non-Fisik';
    return 'Kas Fisik';
  };
  const t = useTranslations();
  const tCashflow = useTranslations('cashflow');
  const tCommon = useTranslations('common');

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const rows = [...filteredTransactions];
    rows.sort((a, b) => {
      if (sortKey === 'amount') {
        const diff = Number(a.amount) - Number(b.amount);
        return sortDir === 'asc' ? diff : -diff;
      }
      const diff = a.transaction_date.localeCompare(b.transaction_date);
      return sortDir === 'asc' ? diff : -diff;
    });
    return rows;
  }, [filteredTransactions, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filterOptions = [
    { value: 'all' as const, label: tCashflow('filterAll') },
    { value: 'inflow' as const, label: tCashflow('filterInflow') },
    { value: 'outflow' as const, label: tCashflow('filterOutflow') },
  ];

  const hasAnyTransaction = transactions.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tCashflow('title')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tCashflow('subtitle')} ·{' '}
            <span className="tnum">{tCashflow('count', { count: filteredTransactions.length })}</span>
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
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={tCommon('searchPlaceholder')}
              aria-label={tCommon('search')}
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] pl-9 pr-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Segmented
              options={filterOptions}
              value={filterType}
              onChange={onFilterTypeChange}
              size="sm"
              ariaLabel={tCashflow('filterAll')}
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

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          {hasAnyTransaction ? (
            <EmptyState
              title={tCashflow('noMatch')}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onSearchChange('');
                    onFilterTypeChange('all');
                  }}
                >
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
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          {/* Mobile: daftar baris, bukan tabel. Nominal pindah ke baris yang
              sama supaya tidak ada kolom yang terpotong di layar sempit.
              Desktop: tabel ledger sungguhan. */}
          <div className="divide-y divide-[var(--line)] sm:hidden">
            {sorted.map((tx) => {
              const meta = getCategory(tx.category);
              const Icon = meta.icon;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon
                    className="size-4 shrink-0 text-[var(--text-faint)]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--text)]">
                      {tx.description || tx.category}
                    </p>
                    <p className="tnum truncate text-[11px] text-[var(--text-faint)]">
                      {formatDate(tx.transaction_date)} · {tx.category} · {walletLabel(tx)}
                      {tx.group_id && groupById.get(tx.group_id)
                        ? ` · Grup ${groupById.get(tx.group_id)}`
                        : ''}
                    </p>
                  </div>
                  <Amount
                    value={`${tx.type === 'inflow' ? '+' : '-'}${formatRp(tx.amount)}`}
                    tone={tx.type === 'inflow' ? 'brand' : 'out'}
                    size="sm"
                    className="shrink-0"
                  />
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-0.5">
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
                  )}
                </div>
              );
            })}
          </div>

          <table className="hidden w-full border-collapse text-left sm:table">
            <thead className="sticky top-0 z-10 bg-[var(--surface-2)]">
              <tr className="border-b border-[var(--line)]">
                <th scope="col" className="w-[104px] px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('date')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] hover:text-[var(--text)]"
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
                <th scope="col" className="hidden px-4 py-2.5 lg:table-cell">
                  <Label>{tCommon('category')}</Label>
                </th>
                <th scope="col" className="w-[128px] px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('amount')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] hover:text-[var(--text)]"
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
                {canEdit && <th scope="col" className="w-20 px-2 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx) => {
                const meta = getCategory(tx.category);
                const Icon = meta.icon;
                return (
                  <tr
                    key={tx.id}
                    className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--surface-2)]"
                  >
                    <td className="tnum whitespace-nowrap px-4 py-2.5 text-[12px] text-[var(--text-muted)]">
                      {formatDate(tx.transaction_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className="size-4 shrink-0 text-[var(--text-faint)]"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[var(--text)]">
                            {tx.description || tx.category}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-faint)] lg:hidden">
                            {tx.category}
                          </p>
                        </div>
                        {tx.source === 'ai_scan' && (
                          <span className="shrink-0 rounded bg-[var(--info-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--info)]">
                            AI
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-[12px] text-[var(--text-muted)] lg:table-cell">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{tx.category}</span>
                        <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                          {walletLabel(tx)}
                        </span>
                        {tx.group_id && groupById.get(tx.group_id) && (
                          <span className="rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                            Grup: {groupById.get(tx.group_id)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <Amount
                        value={`${tx.type === 'inflow' ? '+' : '-'}${formatRp(tx.amount)}`}
                        tone={tx.type === 'inflow' ? 'brand' : 'out'}
                        size="sm"
                      />
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2.5 text-right">
                        <div className="inline-flex items-center gap-0.5">
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
        </div>
      )}
    </div>
  );
}
