'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Check, ChevronDown, Trash2, Wallet } from 'lucide-react';
import type { Budget, BudgetPeriod, Transaction } from '@/types/finance';
import { formatDate, formatRp, todayIso } from '@/lib/format';
import { CATEGORIES, getCategory } from '@/lib/categories';
import {
  budgetStatuses,
  DEFAULT_BUDGET_UNITS,
  encodeBudgetCategory,
  loadCustomBudgetUnits,
  parseBudgetCategory,
  rememberCustomBudgetUnit,
  spentInPeriod,
} from '@/lib/budget';
import { Amount, Progress, SectionTitle } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';

type BudgetTabFilter = BudgetPeriod | 'custom';

interface BudgetTabProps {
  budgets: Budget[];
  transactions: Transaction[];
  canEdit: boolean;
  onSave: (category: string, amount: number, period: BudgetPeriod) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function addDaysIso(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatQtyNum(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString('id-ID')
    : n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

/**
 * Anggaran per kategori ala SBM 2025:
 * - Mendukung periode Mingguan, Bulanan, Tahunan, serta Custom rentang tanggal bebas.
 * - Mendukung Qty × Harga Satuan = Total Pagu otomatis + Jenis Satuan (OH, OT, OB, OJ, OK,
 *   Hari, Orang, Paket, Pcs + satuan bebas yang otomatis tersimpan di memori user).
 * - Tersambung otomatis ke realisasi Outflow pada kategori & periode terkait.
 */
export function BudgetTab({
  budgets,
  transactions,
  canEdit,
  onSave,
  onRemove,
}: BudgetTabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const t = useTranslations();
  const tBudget = useTranslations('budget');

  const today = todayIso();
  const [period, setPeriod] = useState<BudgetTabFilter>('monthly');
  const [category, setCategory] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('OH');
  const [unitPrice, setUnitPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [unitOpen, setUnitOpen] = useState(false);
  const unitRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysIso(today, 1));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCustomUnits(loadCustomBudgetUnits());
  }, []);

  useEffect(() => {
    if (!unitOpen) return;
    const onDown = (e: MouseEvent) => {
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) {
        setUnitOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUnitOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [unitOpen]);

  // Daftar kategori outflow yang ada agar mudah disambungkan 100% ke Arus Kas
  const outflowCategories = useMemo(() => {
    const set = new Set<string>(CATEGORIES.outflow.map((c) => c.id));
    for (const tx of transactions) {
      if (tx.type === 'outflow' && tx.category.trim()) {
        set.add(tx.category.trim());
      }
    }
    return [...set];
  }, [transactions]);

  // Pratinjau realisasi outflow berjalan untuk kategori yang sedang diketik
  const liveCategoryOutflow = useMemo(() => {
    if (!category.trim()) return 0;
    const effectivePeriod: BudgetPeriod = period === 'custom' ? 'monthly' : period;
    return spentInPeriod(transactions, effectivePeriod, undefined, category.trim());
  }, [category, period, transactions]);

  const allUnitOptions = useMemo(() => {
    const defaults = DEFAULT_BUDGET_UNITS.map((u) => u.value);
    const merged = [...defaults];
    for (const cu of customUnits) {
      if (!merged.some((d) => d.toLowerCase() === cu.toLowerCase())) {
        merged.push(cu);
      }
    }
    return merged;
  }, [customUnits]);

  // Sinkronisasi otomatis: Harga Satuan × Qty = Total Pagu
  const handleQtyChange = (nextQtyStr: string) => {
    setQty(nextQtyStr);
    const q = Number(nextQtyStr);
    const p = Number(unitPrice);
    if (q > 0 && p > 0) {
      setAmount(String(Math.round(q * p)));
    }
  };

  const handleUnitPriceChange = (nextPriceStr: string) => {
    setUnitPrice(nextPriceStr);
    const q = Number(qty) || 1;
    const p = Number(nextPriceStr);
    if (q > 0 && p > 0) {
      setAmount(String(Math.round(q * p)));
    } else if (!nextPriceStr) {
      setAmount('');
    }
  };

  const handleTotalChange = (nextTotalStr: string) => {
    setAmount(nextTotalStr);
    const q = Number(qty);
    const tot = Number(nextTotalStr);
    if (q > 0 && tot > 0) {
      setUnitPrice(String(Math.round(tot / q)));
    } else if (!nextTotalStr) {
      setUnitPrice('');
    }
  };

  const statuses = budgetStatuses(budgets, transactions);
  const visible = statuses.filter((s) => {
    const parsed = s.parsed;
    if (period === 'custom') return parsed.isCustom;
    return !parsed.isCustom && s.budget.period === period;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(qty);
    const priceNum = Number(unitPrice);
    const computedTotal =
      Number(amount) > 0
        ? Number(amount)
        : qtyNum > 0 && priceNum > 0
          ? Math.round(qtyNum * priceNum)
          : 0;
    if (!category.trim() || !computedTotal || computedTotal <= 0) return;

    const cleanUnit = unit.trim();
    if (cleanUnit) {
      setCustomUnits(rememberCustomBudgetUnit(cleanUnit));
    }

    setSaving(true);
    try {
      const encoded = encodeBudgetCategory(category.trim(), {
        startIso: period === 'custom' ? startDate || today : null,
        endIso: period === 'custom' ? endDate || startDate || today : null,
        qty: qtyNum > 0 ? qtyNum : null,
        unit: cleanUnit || null,
      });
      await onSave(encoded, computedTotal, period === 'custom' ? 'yearly' : period);
      setAmount('');
      setUnitPrice('');
      setQty('1');
      setCategory('');
    } finally {
      setSaving(false);
    }
  };

  const applyQuickDuration = (days: number) => {
    const base = startDate || today;
    setStartDate(base);
    setEndDate(addDaysIso(base, Math.max(0, days - 1)));
    // Otomatis isi Qty bila satuan adalah Hari atau OH
    if (/^(hari|oh)$/i.test(unit.trim())) {
      handleQtyChange(String(days));
    }
  };

  const customDays = (() => {
    if (!startDate || !endDate) return 1;
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const s = new Date(sy, (sm || 1) - 1, sd || 1).getTime();
    const e = new Date(ey, (em || 1) - 1, ed || 1).getTime();
    return Math.max(1, Math.round(Math.abs(e - s) / 86_400_000) + 1);
  })();

  const periodOptions = [
    { value: 'weekly' as const, label: t('overview.period.week') },
    { value: 'monthly' as const, label: t('overview.period.month') },
    { value: 'yearly' as const, label: t('overview.period.year') },
    { value: 'custom' as const, label: 'Custom' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tBudget('title')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tBudget('subtitle')}
          </p>
        </div>
        <Segmented
          options={periodOptions}
          value={period}
          onChange={setPeriod}
          size="sm"
          ariaLabel={t('overview.period.label')}
        />
      </div>

      {canEdit && (
        <form
          onSubmit={handleSave}
          className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
        >
          {/* 1 Baris Ringkas: Kategori | Qty | Satuan (Dropdown ∨) | Harga/Satuan | Total Pagu | Atur pagu */}
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-[1.6]">
              <label
                htmlFor="budget-category"
                className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]"
              >
                <span>{t('common.category')}</span>
                {liveCategoryOutflow > 0 && (
                  <span className="tnum text-[10px] font-medium text-[var(--out)]">
                    Outflow: {formatRp(liveCategoryOutflow)}
                  </span>
                )}
              </label>
              <input
                id="budget-category"
                name="category"
                type="text"
                list="budget-outflow-categories"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={
                  period === 'custom'
                    ? isEn
                      ? 'e.g. Business Trip, Renovation'
                      : 'Mis. Perjalanan Dinas, Makan & Minum'
                    : 'Makanan, Transportasi, Belanja...'
                }
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
              />
              <datalist id="budget-outflow-categories">
                {outflowCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-end lg:gap-2">
              <div className="lg:w-20">
                <label
                  htmlFor="budget-qty"
                  className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
                >
                  Qty
                </label>
                <input
                  id="budget-qty"
                  name="qty"
                  type="number"
                  min="0.1"
                  step="any"
                  value={qty}
                  onChange={(e) => handleQtyChange(e.target.value)}
                  placeholder="1"
                  className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>

              {/* Combobox Satuan: ketik bebas ATAU klik ∨ buka list satuan SBM & custom */}
              <div ref={unitRef} className="relative lg:w-28">
                <label
                  htmlFor="budget-unit"
                  className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
                >
                  {isEn ? 'Unit' : 'Satuan'}
                </label>
                <div className="relative">
                  <input
                    id="budget-unit"
                    name="unit"
                    type="text"
                    maxLength={24}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    onFocus={() => setUnitOpen(true)}
                    placeholder="OH / ..."
                    className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] pl-2.5 pr-7 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setUnitOpen((v) => !v)}
                    aria-label={isEn ? 'Toggle unit list' : 'Buka daftar satuan'}
                    aria-expanded={unitOpen}
                    className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--surface-1)] hover:text-[var(--text)]"
                  >
                    <ChevronDown
                      className={`size-3.5 transition-transform duration-150 ${
                        unitOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                </div>

                {unitOpen && (
                  <div className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-lg)]">
                    <div className="border-b border-[var(--line)] px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Satuan SBM &amp; Custom
                      </p>
                      <p className="text-[10px] text-[var(--text-faint)]">
                        Ketik bebas untuk simpan satuan baru
                      </p>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                      {allUnitOptions.map((u) => {
                        const def = DEFAULT_BUDGET_UNITS.find((d) => d.value === u);
                        const active = unit.trim().toLowerCase() === u.toLowerCase();
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() => {
                              setUnit(u);
                              setUnitOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition ${
                              active
                                ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand)]'
                                : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                            }`}
                          >
                            <span className="min-w-0 truncate">
                              <span>{u}</span>
                              <span className="ml-1.5 text-[10px] font-normal text-[var(--text-faint)]">
                                {def ? (isEn ? def.hintEn : def.hintId) : 'Custom'}
                              </span>
                            </span>
                            {active && <Check className="size-3.5 shrink-0" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:w-32">
                <label
                  htmlFor="budget-unit-price"
                  className="mb-1 block truncate text-[11px] font-semibold text-[var(--text-muted)]"
                >
                  {isEn ? 'Unit Price' : 'Harga / Satuan'}
                </label>
                <input
                  id="budget-unit-price"
                  name="unitPrice"
                  type="number"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => handleUnitPriceChange(e.target.value)}
                  placeholder="50000"
                  className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>

              <div className="lg:w-36">
                <label
                  htmlFor="budget-amount"
                  className="mb-1 block truncate text-[11px] font-semibold text-[var(--text-muted)]"
                >
                  {isEn ? 'Total Limit' : 'Total Pagu'}
                </label>
                <input
                  id="budget-amount"
                  name="amount"
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => handleTotalChange(e.target.value)}
                  placeholder="1500000"
                  className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[13px] font-semibold text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="sm"
              loading={saving}
              className="shrink-0 whitespace-nowrap"
            >
              {tBudget('set')}
            </Button>
          </div>

          {period === 'custom' && (
            <div className="flex flex-col gap-2.5 border-t border-[var(--line)] pt-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid flex-1 grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="budget-start-date"
                    className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'Start Date' : 'Dari Tanggal'}
                  </label>
                  <input
                    id="budget-start-date"
                    name="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="budget-end-date"
                    className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'End Date' : 'Sampai Tanggal'}
                  </label>
                  <input
                    id="budget-end-date"
                    name="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: isEn ? '1d' : '1 Hari', days: 1 },
                  { label: isEn ? '2d' : '2 Hari', days: 2 },
                  { label: isEn ? '30d' : '30 Hari', days: 30 },
                  { label: isEn ? '2y' : '2 Tahun', days: 730 },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => applyQuickDuration(preset.days)}
                    className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] whitespace-nowrap transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                  >
                    {preset.label}
                  </button>
                ))}
                <span className="rounded-md bg-[var(--brand-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--brand)] whitespace-nowrap">
                  {customDays} {isEn ? 'days' : 'hari'}
                </span>
              </div>
            </div>
          )}
        </form>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          <EmptyState
            icon={<Wallet className="size-5" />}
            title={tBudget('empty.title')}
            description={tBudget('empty.description')}
            action={
              canEdit ? (
                <Button
                  size="sm"
                  onClick={() => {
                    const input = document.getElementById('budget-category');
                    input?.focus();
                  }}
                >
                  {tBudget('empty.action')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          <div className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5">
            <SectionTitle>{tBudget('title')}</SectionTitle>
          </div>

          {visible.map((status) => {
            const parsed = parseBudgetCategory(status.budget.category);
            const meta = getCategory(parsed.label);
            const Icon = meta.icon;
            return (
              <div
                key={status.budget.id}
                className="border-b border-[var(--line)] px-4 py-3.5 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className="size-4 shrink-0 text-[var(--text-faint)]"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                          {parsed.label}
                        </p>
                        {parsed.qty && parsed.unit && (
                          <span className="tnum inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                            {formatQtyNum(parsed.qty)} {parsed.unit}
                            {status.unitPrice
                              ? ` · ${formatRp(Math.round(status.unitPrice))}/${parsed.unit}`
                              : ''}
                          </span>
                        )}
                        {parsed.isCustom && parsed.startIso && parsed.endIso && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand)] whitespace-nowrap">
                            <Calendar className="size-2.5" aria-hidden />
                            {formatDate(parsed.startIso)} – {formatDate(parsed.endIso)}
                            {parsed.days ? ` (${parsed.days} ${isEn ? 'd' : 'hr'})` : ''}
                          </span>
                        )}
                      </div>
                      <p className="tnum mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {tBudget('of', { total: formatRp(status.budget.amount) })}
                        {status.matchedTxCount > 0 && (
                          <span> · {status.matchedTxCount} outflow</span>
                        )}
                        {parsed.qty &&
                          parsed.unit &&
                          status.spentQty !== null && (
                            <span>
                              {' '}
                              · {formatQtyNum(status.spentQty)} / {formatQtyNum(parsed.qty)}{' '}
                              {parsed.unit}
                            </span>
                          )}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <Amount
                        value={formatRp(status.spent)}
                        tone={status.over ? 'out' : 'default'}
                        size="sm"
                      />
                      <p
                        className={`tnum text-[11px] ${
                          status.over ? 'text-[var(--out)]' : 'text-[var(--text-faint)]'
                        }`}
                      >
                        {status.over
                          ? `${tBudget('over')} ${formatRp(Math.abs(status.remaining))}`
                          : `${tBudget('remaining')} ${formatRp(status.remaining)}`}
                      </p>
                    </div>
                    {canEdit && (
                      <IconButton
                        label={t('common.delete')}
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemove(status.budget.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    )}
                  </div>
                </div>

                <div className="mt-2.5">
                  <Progress
                    value={status.percent}
                    tone={status.over ? 'out' : status.percent >= 80 ? 'due' : 'brand'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
