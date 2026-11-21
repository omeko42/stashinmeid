'use client';

import { useTranslations } from 'next-intl';
import { Calculator, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { Debt } from '@/types/finance';
import { formatRp } from '@/lib/format';
import { Amount, Label, Progress, Rule } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

interface DebtFormState {
  platform: string;
  contract: string;
  balance: string;
  installment: string;
  tenor: string;
  dueDay: string;
}

interface DebtsTabProps {
  debts: Debt[];
  showDebtForm: boolean;
  debtForm: DebtFormState;
  canEdit: boolean;
  simSelectedIds: string[];
  simStats: { count: number; payoffNeeded: number; monthlySaved: number };
  onToggleSim: (id: string) => void;
  onClearSim: () => void;
  onFormChange: (next: DebtFormState) => void;
  onToggleForm: () => void;
  onSubmitForm: (e: React.FormEvent) => void;
  onPay: (debt: Debt) => void;
  onDelete: (id: string) => void;
}

export function DebtsTab({
  debts,
  showDebtForm,
  debtForm,
  canEdit,
  simSelectedIds,
  simStats,
  onToggleSim,
  onClearSim,
  onFormChange,
  onToggleForm,
  onSubmitForm,
  onPay,
  onDelete,
}: DebtsTabProps) {
  const tDebts = useTranslations('debts');
  const tCommon = useTranslations('common');

  const set = (key: keyof DebtFormState) => (value: string) =>
    onFormChange({ ...debtForm, [key]: value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tDebts('headerTitle')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tDebts('subtitle')}
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant={showDebtForm ? 'secondary' : 'primary'}
            icon={<Plus className="size-4" />}
            onClick={onToggleForm}
          >
            {tDebts('add')}
          </Button>
        )}
      </div>

      {/* Simulator - banner datar, bukan kartu gradien */}
      <section className="rounded-xl border border-[var(--info)]/25 bg-[var(--info-soft)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-1)] text-[var(--info)]">
              <Calculator className="size-4" aria-hidden />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text)]">
                {tDebts('simulator.title')}
              </h3>
              <p className="text-[12px] text-[var(--text-muted)]">
                {tDebts('simulator.selected', { count: simStats.count })} ·{' '}
                {tDebts('simulator.payoff')}{' '}
                <span className="tnum font-semibold text-[var(--text)]">
                  {formatRp(simStats.payoffNeeded)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:text-right">
            <div>
              <Label>{tDebts('simulator.savings')}</Label>
              <div className="mt-0.5">
                <Amount
                  value={`+${formatRp(simStats.monthlySaved)}`}
                  tone="brand"
                  size="lg"
                />
              </div>
            </div>
            {simStats.count > 0 && (
              <Button size="sm" variant="ghost" onClick={onClearSim}>
                {tDebts('simulator.clear')}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Form tambah pinjaman */}
      {showDebtForm && canEdit && (
        <form
          onSubmit={onSubmitForm}
          className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 sm:grid-cols-3"
        >
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
              {tDebts('form.platform')}
            </label>
            <input
              type="text"
              required
              value={debtForm.platform}
              onChange={(e) => set('platform')(e.target.value)}
              placeholder="Spinjam, Kredivo"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
              {tDebts('form.contract')}
            </label>
            <input
              type="text"
              value={debtForm.contract}
              onChange={(e) => set('contract')(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
              {tDebts('form.balance')}
            </label>
            <input
              type="number"
              required
              min="1"
              value={debtForm.balance}
              onChange={(e) => set('balance')(e.target.value)}
              placeholder="4000000"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
              {tDebts('form.installment')}
            </label>
            <input
              type="number"
              min="0"
              value={debtForm.installment}
              onChange={(e) => set('installment')(e.target.value)}
              placeholder="500000"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
              {tDebts('form.tenor')}
            </label>
            <input
              type="number"
              min="1"
              value={debtForm.tenor}
              onChange={(e) => set('tenor')(e.target.value)}
              placeholder="12"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
              {tDebts('form.dueDay')}
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={debtForm.dueDay}
              onChange={(e) => set('dueDay')(e.target.value)}
              placeholder="1"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" size="sm">
              {tCommon('save')}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onToggleForm}>
              {tCommon('cancel')}
            </Button>
          </div>
        </form>
      )}

      {debts.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          <EmptyState
            icon={<Plus className="size-5" />}
            title={tDebts('empty.title')}
            description={tDebts('empty.description')}
            action={
              canEdit ? (
                <Button size="sm" onClick={onToggleForm}>
                  {tDebts('empty.action')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {debts.map((debt) => {
            const isSimSelected = simSelectedIds.includes(debt.id);
            const paidPct =
              debt.total_tenor && debt.remaining_tenor !== null
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round(
                        ((debt.total_tenor - debt.remaining_tenor) /
                          debt.total_tenor) *
                          100
                      )
                    )
                  )
                : 0;
            const settled = debt.status === 'paid_off';

            return (
              <article
                key={debt.id}
                className={`rounded-xl border bg-[var(--surface-1)] p-4 transition ${
                  isSimSelected
                    ? 'border-[var(--info)] ring-1 ring-[var(--info)]/40'
                    : settled
                      ? 'border-[var(--brand)]/30 opacity-75'
                      : 'border-[var(--line)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    {!settled && canEdit && (
                      <input
                        type="checkbox"
                        checked={isSimSelected}
                        onChange={() => onToggleSim(debt.id)}
                        aria-label={tDebts('simulator.hint')}
                        className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--info)]"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[14px] font-semibold text-[var(--text)]">
                          {debt.platform}
                        </h3>
                        {settled && (
                          <span className="inline-flex items-center gap-1 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                            <CheckCircle2 className="size-3" aria-hidden />
                            {tDebts('card.paidOff')}
                          </span>
                        )}
                      </div>
                      {debt.contract_no && (
                        <p className="tnum mt-0.5 truncate text-[11px] text-[var(--text-faint)]">
                          {debt.contract_no}
                        </p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <IconButton
                      label={tCommon('delete')}
                      size="sm"
                      onClick={() => onDelete(debt.id)}
                      className="shrink-0 text-[var(--text-faint)] hover:text-[var(--out)]"
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label>{tDebts('card.progress')}</Label>
                    <span className="tnum text-[11px] text-[var(--text-muted)]">
                      {paidPct}%
                    </span>
                  </div>
                  <Progress
                    value={paidPct}
                    tone={settled ? 'brand' : 'due'}
                  />
                </div>

                <Rule className="my-3" />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>{tDebts('card.remainingLabel')}</Label>
                    <div className="mt-0.5">
                      <Amount
                        value={formatRp(debt.remaining_balance)}
                        tone="due"
                        size="sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{tDebts('card.installmentLabel')}</Label>
                    <div className="mt-0.5">
                      <Amount
                        value={
                          debt.monthly_installment
                            ? formatRp(debt.monthly_installment)
                            : '-'
                        }
                        size="sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{tDebts('card.tenorLabel')}</Label>
                    <div className="mt-0.5">
                      <span className="tnum text-[13px] font-semibold text-[var(--text)]">
                        {debt.remaining_tenor ?? '-'}
                      </span>
                      {debt.due_day && (
                        <span className="tnum ml-1 text-[11px] text-[var(--text-faint)]">
                          tgl {debt.due_day}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!settled && canEdit && (
                  <Button
                    size="sm"
                    variant="secondary"
                    fullWidth
                    className="mt-3"
                    onClick={() => onPay(debt)}
                  >
                    {tDebts('card.pay')}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
