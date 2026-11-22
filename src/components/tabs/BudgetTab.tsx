'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Trash2, Wallet } from 'lucide-react';
import type { Budget, BudgetPeriod, Transaction } from '@/types/finance';
import { formatDate, formatRp, todayIso } from '@/lib/format';
import { getCategory } from '@/lib/categories';
import {
  budgetStatuses,
  encodeCustomBudgetCategory,
  parseBudgetCategory,
} from '@/lib/budget';
import { Amount, Label, Progress, SectionTitle } from '@/components/ui/Surface';
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

/**
 * Anggaran per kategori.
 * Mendukung periode Mingguan, Bulanan, Tahunan, serta Custom rentang tanggal
 * bebas (1 hari, 2 hari, beberapa bulan, hingga lebih dari 1 tahun).
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
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysIso(today, 1));
  const [saving, setSaving] = useState(false);

  const statuses = budgetStatuses(budgets, transactions);
  const visible = statuses.filter((s) => {
    const parsed = parseBudgetCategory(s.budget.category);
    if (period === 'custom') return parsed.isCustom;
    return !parsed.isCustom && s.budget.period === period;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!category.trim() || !value || value <= 0) return;

    setSaving(true);
    try {
      if (period === 'custom') {
        const from = startDate || today;
        const to = endDate || from;
        const encoded = encodeCustomBudgetCategory(category.trim(), from, to);
        await onSave(encoded, value, 'yearly');
      } else {
        await onSave(category.trim(), value, period);
      }
      setAmount('');
      setCategory('');
    } finally {
      setSaving(false);
    }
  };

  const applyQuickDuration = (days: number) => {
    const base = startDate || today;
    setStartDate(base);
    setEndDate(addDaysIso(base, Math.max(0, days - 1)));
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="budget-category"
                className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
              >
                {t('common.category')}
              </label>
              <input
                id="budget-category"
                name="category"
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={
                  period === 'custom'
                    ? isEn
                      ? 'e.g. Weekend Trip, Renovation, Daily Meals'
                      : 'Mis. Liburan 2 Hari, Makan Harian, Renovasi'
                    : 'Makan & Minum'
                }
                className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="budget-amount"
                className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
              >
                {tBudget('placeholder')}
              </label>
              <input
                id="budget-amount"
                name="amount"
                type="number"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000000"
                className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
              />
            </div>
            <Button type="submit" size="sm" loading={saving} className="whitespace-nowrap">
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
                        <p className="truncate text-[13px] font-medium text-[var(--text)]">
                          {parsed.label}
                        </p>
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
                        className={`text-[11px] ${
                          status.over
                            ? 'text-[var(--out)]'
                            : 'text-[var(--text-faint)]'
                        }`}
                      >
                        {status.over
                          ? `${tBudget('over')} · ${formatRp(Math.abs(status.remaining))}`
                          : `${tBudget('remaining')} ${formatRp(status.remaining)}`}
                      </p>
                    </div>
                    {canEdit && (
                      <IconButton
                        label={tBudget('unset')}
                        size="sm"
                        onClick={() => onRemove(status.budget.id)}
                        className="text-[var(--text-faint)] hover:text-[var(--out)]"
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    )}
                  </div>
                </div>

                <Progress
                  value={status.percent}
                  tone={
                    status.over ? 'out' : status.percent >= 80 ? 'due' : 'brand'
                  }
                  className="mt-2.5"
                />

                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <Label>{tBudget('spent')}</Label>
                  <span className="tnum text-[11px] text-[var(--text-muted)]">
                    {status.percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
