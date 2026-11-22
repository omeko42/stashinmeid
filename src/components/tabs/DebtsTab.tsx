'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Calculator,
  CalendarClock,
  CheckCircle2,
  Landmark,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import type { Debt } from '@/types/finance';
import { appNow, daysUntil, formatRp, nextDueDate } from '@/lib/format';
import { Amount, Label, Progress, Rule } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export interface DebtFormState {
  platform: string;
  contract: string;
  balance: string;
  installment: string;
  tenor: string;
  dueDay: string;
  groupId: string;
}

interface DebtsTabProps {
  debts: Debt[];
  showDebtForm: boolean;
  debtForm: DebtFormState;
  canEdit: boolean;
  sharedGroups?: { id: string; name: string }[];
  groupNameById?: Record<string, string>;
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
  sharedGroups = [],
  groupNameById = {},
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

  const totals = useMemo(() => {
    const active = debts.filter((d) => d.status === 'active');
    const totalRemaining = active.reduce((s, d) => s + Number(d.remaining_balance || 0), 0);
    const totalMonthly = active.reduce((s, d) => s + Number(d.monthly_installment || 0), 0);
    const paidOffCount = debts.length - active.length;
    return {
      activeCount: active.length,
      paidOffCount,
      totalRemaining,
      totalMonthly,
    };
  }, [debts]);

  const today = appNow();

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

      {/* Ringkasan Pinjaman KPI */}
      {debts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
            <div className="flex items-center justify-between gap-2">
              <Label>{tDebts('card.remainingLabel')}</Label>
              <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--due-soft)] text-[var(--due)]">
                <Landmark className="size-3.5" aria-hidden />
              </span>
            </div>
            <div className="mt-1.5">
              <Amount value={formatRp(totals.totalRemaining)} tone="due" size="lg" />
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {totals.activeCount} aktif
              {totals.paidOffCount > 0 ? ` · ${totals.paidOffCount} lunas` : ''}
            </p>
          </div>
          <div className="card-interactive rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
            <div className="flex items-center justify-between gap-2">
              <Label>{tDebts('card.installmentLabel')}</Label>
              <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--out-soft)] text-[var(--out)]">
                <CalendarClock className="size-3.5" aria-hidden />
              </span>
            </div>
            <div className="mt-1.5">
              <Amount value={formatRp(totals.totalMonthly)} size="lg" />
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Total kewajiban cicilan bulanan
            </p>
          </div>
          <div className="card-interactive rounded-xl border border-[var(--info)]/25 bg-[var(--info-soft)] p-4">
            <div className="flex items-center justify-between gap-2">
              <Label>{tDebts('simulator.savings')}</Label>
              <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--surface-1)] text-[var(--info)]">
                <Calculator className="size-3.5" aria-hidden />
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <Amount value={`+${formatRp(simStats.monthlySaved)}`} tone="brand" size="lg" />
              {simStats.count > 0 && (
                <button
                  type="button"
                  onClick={onClearSim}
                  className="text-[11px] font-semibold text-[var(--info)] hover:underline"
                >
                  {tDebts('simulator.clear')}
                </button>
              )}
            </div>
            <p className="tnum mt-1 truncate text-[11px] text-[var(--text-muted)]">
              {simStats.count > 0
                ? `${simStats.count} dipilih · Lunasi ${formatRp(simStats.payoffNeeded)}`
                : 'Centang pinjaman di bawah untuk simulasi lunas'}
            </p>
          </div>
        </div>
      )}

      {/* Form tambah pinjaman */}
      {showDebtForm && canEdit && (
        <motion.form
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          onSubmit={onSubmitForm}
          className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 sm:grid-cols-3"
        >
          <div>
            <label
              htmlFor="debt-platform"
              className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
            >
              {tDebts('form.platform')}
            </label>
            <input
              id="debt-platform"
              name="platform"
              type="text"
              required
              value={debtForm.platform}
              onChange={(e) => set('platform')(e.target.value)}
              placeholder="Spinjam, Kredivo"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="debt-contract"
              className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
            >
              {tDebts('form.contract')}
            </label>
            <input
              id="debt-contract"
              name="contract"
              type="text"
              value={debtForm.contract}
              onChange={(e) => set('contract')(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="debt-balance"
              className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
            >
              {tDebts('form.balance')}
            </label>
            <input
              id="debt-balance"
              name="balance"
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
            <label
              htmlFor="debt-installment"
              className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
            >
              {tDebts('form.installment')}
            </label>
            <input
              id="debt-installment"
              name="installment"
              type="number"
              min="0"
              value={debtForm.installment}
              onChange={(e) => set('installment')(e.target.value)}
              placeholder="500000"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="debt-tenor"
              className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
            >
              {tDebts('form.tenor')}
            </label>
            <input
              id="debt-tenor"
              name="tenor"
              type="number"
              min="1"
              value={debtForm.tenor}
              onChange={(e) => set('tenor')(e.target.value)}
              placeholder="12"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="debt-due-day"
              className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
            >
              {tDebts('form.dueDay')}
            </label>
            <input
              id="debt-due-day"
              name="dueDay"
              type="number"
              min="1"
              max="31"
              value={debtForm.dueDay}
              onChange={(e) => set('dueDay')(e.target.value)}
              placeholder="1"
              className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          {sharedGroups.length > 0 && (
            <div className="sm:col-span-3">
              <label
                htmlFor="debt-group-id"
                className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
              >
                Ruang Keuangan (Pisahkan utang Pribadi / Keluarga / Perusahaan)
              </label>
              <select
                id="debt-group-id"
                name="groupId"
                value={debtForm.groupId}
                onChange={(e) => set('groupId')(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
              >
                <option value="">Pribadi (Tidak masuk grup kolega)</option>
                {sharedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Grup Kolega: {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" size="sm">
              {tCommon('save')}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onToggleForm}>
              {tCommon('cancel')}
            </Button>
          </div>
        </motion.form>
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
          {debts.map((debt, idx) => {
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

            let dueCountdown: number | null = null;
            if (!settled && debt.due_day) {
              const nd = nextDueDate(debt.due_day, today);
              const iso = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
              const dLeft = daysUntil(iso);
              if (Number.isFinite(dLeft) && dLeft >= 0) dueCountdown = dLeft;
            }

            return (
              <motion.article
                key={debt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.24) }}
                className={`card-interactive rounded-xl border bg-[var(--surface-1)] p-4 ${
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
                        id={`debt-sim-${debt.id}`}
                        name={`debt-sim-${debt.id}`}
                        type="checkbox"
                        checked={isSimSelected}
                        onChange={() => onToggleSim(debt.id)}
                        aria-label={tDebts('simulator.hint')}
                        className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--info)]"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-[14px] font-semibold text-[var(--text)]">
                          {debt.platform}
                        </h3>
                        {debt.group_id && groupNameById[debt.group_id] ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[var(--info-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--info)]">
                            <Users className="size-3" aria-hidden />
                            {groupNameById[debt.group_id]}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                            Pribadi
                          </span>
                        )}
                        {dueCountdown !== null && dueCountdown <= 7 && (
                          <span
                            className={`tnum inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              dueCountdown <= 3
                                ? 'bg-[var(--out-soft)] text-[var(--out)]'
                                : 'bg-[var(--due-soft)] text-[var(--due)]'
                            }`}
                          >
                            {dueCountdown === 0 ? 'Jatuh tempo hari ini' : `H-${dueCountdown}`}
                          </span>
                        )}
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
                    <span className="tnum text-[11px] font-semibold text-[var(--text-muted)]">
                      {paidPct}%
                    </span>
                  </div>
                  <Progress value={paidPct} tone={settled ? 'brand' : 'due'} />
                </div>

                <Rule className="my-3" />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="min-w-0">
                    <Label>{tDebts('card.remainingLabel')}</Label>
                    <div className="mt-0.5 truncate">
                      <Amount
                        value={formatRp(debt.remaining_balance)}
                        tone="due"
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Label>{tDebts('card.installmentLabel')}</Label>
                    <div className="mt-0.5 truncate">
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
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <Label>{tDebts('card.tenorLabel')}</Label>
                    <div className="mt-0.5">
                      <span className="tnum text-[13px] font-semibold text-[var(--text)]">
                        {debt.remaining_tenor ?? '-'}
                      </span>
                      {debt.due_day && (
                        <span className="tnum ml-1 text-[11px] text-[var(--text-faint)]">
                          · tgl {debt.due_day}
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
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
