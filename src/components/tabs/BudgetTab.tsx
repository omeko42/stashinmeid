'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Wallet } from 'lucide-react';
import type { Budget, BudgetPeriod } from '@/types/finance';
import { formatRp } from '@/lib/format';
import { getCategory } from '@/lib/categories';
import { budgetStatuses } from '@/lib/budget';
import type { Transaction } from '@/types/finance';
import { Amount, Label, Progress, SectionTitle } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';

interface BudgetTabProps {
  budgets: Budget[];
  transactions: Transaction[];
  canEdit: boolean;
  onSave: (category: string, amount: number, period: BudgetPeriod) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

/**
 * Anggaran per kategori.
 *
 * Pagu ditampilkan sebagai baris ledger: kategori, pagu, dan realisasi.
 * Form untuk mengatur pagu ada di dalam baris, jadi tidak perlu pindah layar.
 */
export function BudgetTab({
  budgets,
  transactions,
  canEdit,
  onSave,
  onRemove,
}: BudgetTabProps) {
  const t = useTranslations();
  const tBudget = useTranslations('budget');

  const [period, setPeriod] = useState<BudgetPeriod>('monthly');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const statuses = budgetStatuses(budgets, transactions);
  const visible = statuses.filter((s) => s.budget.period === period);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!category.trim() || !value || value <= 0) return;

    setSaving(true);
    await onSave(category.trim(), value, period);
    setAmount('');
    setSaving(false);
  };

  const periodOptions = [
    { value: 'weekly' as const, label: t('overview.period.week') },
    { value: 'monthly' as const, label: t('overview.period.month') },
    { value: 'yearly' as const, label: t('overview.period.year') },
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
          className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
              {t('common.category')}
            </label>
            <input
              type="text"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Makan & Minum"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
              {tBudget('placeholder')}
            </label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000000"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <Button type="submit" size="sm" loading={saving}>
            {tBudget('set')}
          </Button>
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
                <Button size="sm" onClick={() => setPeriod('monthly')}>
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
            const meta = getCategory(status.budget.category);
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
                      <p className="truncate text-[13px] font-medium text-[var(--text)]">
                        {status.budget.category}
                      </p>
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
