'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calculator,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Eye,
  Landmark,
  LayoutGrid,
  List,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import type { Debt, Transaction } from '@/types/finance';
import { appNow, daysUntil, formatFullDate, formatRp } from '@/lib/format';
import {
  estimateMonthlyInterest,
  nextDebtScheduleDate,
  parseDebtNotes,
  type InterestType,
} from '@/lib/debtMeta';
import { Amount, Label, Progress, Rule } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';

export interface DebtFormState {
  platform: string;
  contract: string;
  balance: string;
  installment: string;
  tenor: string;
  dueDay: string;
  groupId: string;
  interestRate: string;
  interestType: InterestType;
  autoPay: boolean;
  autoPayDay: string;
  autoPayAccountId: string;
  notes: string;
  scheduleOverrides: Record<string, number>;
}

interface DebtsTabProps {
  debts: Debt[];
  transactions?: Transaction[];
  showDebtForm: boolean;
  editingDebtId?: string | null;
  debtForm: DebtFormState;
  canEdit: boolean;
  accounts?: { id: string; name: string; kind: string; currency: string }[];
  sharedGroups?: { id: string; name: string }[];
  groupNameById?: Record<string, string>;
  simSelectedIds: string[];
  simStats: { count: number; payoffNeeded: number; monthlySaved: number };
  onToggleSim: (id: string) => void;
  onClearSim: () => void;
  onFormChange: (next: DebtFormState) => void;
  onToggleForm: () => void;
  onEdit?: (debt: Debt) => void;
  onSubmitForm: (e: React.FormEvent) => void;
  onPay: (debt: Debt) => void;
  onDelete: (id: string) => void;
}

export function DebtsTab({
  debts,
  transactions = [],
  showDebtForm,
  editingDebtId = null,
  debtForm,
  canEdit,
  accounts = [],
  sharedGroups = [],
  groupNameById = {},
  simSelectedIds,
  simStats,
  onToggleSim,
  onClearSim,
  onFormChange,
  onToggleForm,
  onEdit,
  onSubmitForm,
  onPay,
  onDelete,
}: DebtsTabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const tDebts = useTranslations('debts');
  const tCommon = useTranslations('common');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paid_off'>('all');
  const [viewMode, setViewMode] = useState<'ledger' | 'cards'>('ledger');
  const [detailDebt, setDetailDebt] = useState<Debt | null>(null);
  const [detailTab, setDetailTab] = useState<'schedule' | 'history'>('schedule');
  const [formTab, setFormTab] = useState<'info' | 'schedule'>('info');

  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const walletName = (id: string | null) => {
    if (!id || id === '__cash__') return isEn ? 'Cash' : 'Kas Tunai';
    return accountById.get(id)?.name ?? (isEn ? 'Wallet' : 'Dompet');
  };

  const set = <K extends keyof DebtFormState>(key: K) => (value: DebtFormState[K]) =>
    onFormChange({ ...debtForm, [key]: value });

  const today = appNow();

  const getEffectiveNextInstallment = (d: Debt) => {
    const { meta } = parseDebtNotes(d.notes);
    const dueDay = d.due_day || meta.autoPayDay || 1;
    const nextDue = nextDebtScheduleDate(dueDay, d.notes, today);
    const nextYm = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, '0')}`;
    const hasCustom = Object.prototype.hasOwnProperty.call(meta.scheduleOverrides, nextYm);
    const amount = hasCustom
      ? meta.scheduleOverrides[nextYm]
      : Number(d.monthly_installment || 0);
    return {
      amount,
      isCustom: hasCustom,
      overrideCount: Object.keys(meta.scheduleOverrides).length,
      nextYm,
    };
  };

  const totals = useMemo(() => {
    const now = appNow();
    const active = debts.filter((d) => d.status === 'active');
    const totalRemaining = active.reduce((s, d) => s + Number(d.remaining_balance || 0), 0);
    const totalMonthly = active.reduce((s, d) => {
      const { meta } = parseDebtNotes(d.notes);
      const dueDay = d.due_day || meta.autoPayDay || 1;
      const nd = nextDebtScheduleDate(dueDay, d.notes, now);
      const ym = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
      const eff = Object.prototype.hasOwnProperty.call(meta.scheduleOverrides, ym)
        ? meta.scheduleOverrides[ym]
        : Number(d.monthly_installment || 0);
      return s + eff;
    }, 0);
    const paidOffCount = debts.length - active.length;
    const autoPayCount = active.filter((d) => parseDebtNotes(d.notes).meta.autoPay).length;
    return {
      activeCount: active.length,
      paidOffCount,
      autoPayCount,
      totalRemaining,
      totalMonthly,
    };
  }, [debts]);

  const filteredDebts = useMemo(() => {
    const now = appNow();
    const q = searchQuery.trim().toLowerCase();
    return debts
      .filter((d) => {
        if (statusFilter === 'active' && d.status !== 'active') return false;
        if (statusFilter === 'paid_off' && d.status !== 'paid_off') return false;
        if (!q) return true;
        return (
          d.platform.toLowerCase().includes(q) ||
          (d.contract_no || '').toLowerCase().includes(q) ||
          (d.notes || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Aktif di atas, lalu urutkan dari jatuh tempo terdekat
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        const da = a.due_day ? nextDebtScheduleDate(a.due_day, a.notes, now).getTime() : Infinity;
        const db = b.due_day ? nextDebtScheduleDate(b.due_day, b.notes, now).getTime() : Infinity;
        return da - db;
      });
  }, [debts, searchQuery, statusFilter]);

  // Helper generate jadwal pembayaran bulanan ke depan untuk 1 pinjaman
  const buildScheduleForDebt = (d: Debt) => {
    const { meta } = parseDebtNotes(d.notes);
    const dueDay = d.due_day || meta.autoPayDay || 1;
    const installment = Number(d.monthly_installment || 0);
    let remBal = Number(d.remaining_balance || 0);
    const remTenor = Math.max(
      1,
      d.remaining_tenor ?? (installment > 0 ? Math.ceil(remBal / installment) : 1)
    );
    const totalTenor = d.total_tenor ?? remTenor;
    const paidSoFar = Math.max(0, totalTenor - remTenor);
    const firstDate = nextDebtScheduleDate(dueDay, d.notes, today);
    const rows: {
      seq: number;
      ym: string;
      dateIso: string;
      installment: number;
      isCustom: boolean;
      estInterest: number;
      estBalanceAfter: number;
      daysLeft: number;
    }[] = [];

    const maxRows = Math.min(remTenor, 24);
    for (let i = 0; i < maxRows; i++) {
      const targetYear = firstDate.getFullYear();
      const targetMonth = firstDate.getMonth() + i;
      const lastDom = new Date(targetYear, targetMonth + 1, 0).getDate();
      const dt = new Date(targetYear, targetMonth, Math.min(dueDay, lastDom));
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const iso = `${ym}-${String(dt.getDate()).padStart(2, '0')}`;
      const estInt = estimateMonthlyInterest(remBal, meta.interestRate);
      const isCustom = Object.prototype.hasOwnProperty.call(meta.scheduleOverrides, ym);
      const pay = isCustom
        ? meta.scheduleOverrides[ym]
        : Math.min(installment || remBal, remBal);
      remBal = Math.max(0, remBal - pay);
      rows.push({
        seq: paidSoFar + i + 1,
        ym,
        dateIso: iso,
        installment: pay,
        isCustom,
        estInterest: estInt,
        estBalanceAfter: remBal,
        daysLeft: daysUntil(iso),
      });
    }
    return { rows, totalRemainingCount: remTenor };
  };

  // Baris jadwal yang bisa diedit per-bulan di dalam modal Edit/Tambah Pinjaman
  const editableSchedule = useMemo(() => {
    const editingDebtObj = editingDebtId
      ? debts.find((d) => d.id === editingDebtId) ?? null
      : null;
    const dueDay = Math.min(
      31,
      Math.max(1, Number(debtForm.dueDay || debtForm.autoPayDay) || 1)
    );
    const defaultInst = Math.max(0, Number(debtForm.installment) || 0);
    let remBal = Math.max(0, Number(debtForm.balance) || 0);
    const parsedTenor = Number(debtForm.tenor);
    const count = Math.min(
      24,
      Math.max(
        1,
        Number.isFinite(parsedTenor) && parsedTenor > 0
          ? Math.floor(parsedTenor)
          : defaultInst > 0 && remBal > 0
            ? Math.ceil(remBal / defaultInst)
            : 6
      )
    );
    const totalTenor = editingDebtObj?.total_tenor ?? count;
    const paidSoFar = Math.max(0, totalTenor - count);
    const firstDate = nextDebtScheduleDate(
      dueDay,
      editingDebtObj?.notes ?? null,
      appNow()
    );

    const rows: {
      seq: number;
      ym: string;
      dateIso: string;
      amount: number;
      isCustom: boolean;
      estBalanceAfter: number;
    }[] = [];

    let totalScheduled = 0;
    for (let i = 0; i < count; i++) {
      const targetYear = firstDate.getFullYear();
      const targetMonth = firstDate.getMonth() + i;
      const lastDom = new Date(targetYear, targetMonth + 1, 0).getDate();
      const dt = new Date(targetYear, targetMonth, Math.min(dueDay, lastDom));
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const iso = `${ym}-${String(dt.getDate()).padStart(2, '0')}`;
      const isCustom = Object.prototype.hasOwnProperty.call(
        debtForm.scheduleOverrides,
        ym
      );
      const amount = isCustom ? debtForm.scheduleOverrides[ym] : defaultInst;
      totalScheduled += amount;
      remBal = Math.max(0, remBal - amount);
      rows.push({
        seq: paidSoFar + i + 1,
        ym,
        dateIso: iso,
        amount,
        isCustom,
        estBalanceAfter: remBal,
      });
    }
    return {
      rows,
      totalScheduled,
      overrideCount: Object.keys(debtForm.scheduleOverrides).length,
    };
  }, [
    debts,
    editingDebtId,
    debtForm.dueDay,
    debtForm.autoPayDay,
    debtForm.installment,
    debtForm.balance,
    debtForm.tenor,
    debtForm.scheduleOverrides,
  ]);

  // Riwayat pembayaran nyata di Arus Kas yang cocok dengan pinjaman ini
  const getLinkedPayments = (d: Debt) => {
    const rawKey = d.platform.split('(')[0].trim().toLowerCase();
    const keywords = [rawKey, d.platform.toLowerCase(), (d.contract_no || '').toLowerCase()]
      .map((s) => s.trim())
      .filter((s) => s.length >= 3);
    return transactions
      .filter((tx) => {
        if (tx.type !== 'outflow') return false;
        const hay = `${tx.description || ''} ${tx.category}`.toLowerCase();
        return keywords.some((kw) => hay.includes(kw));
      })
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
      .slice(0, 30);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tDebts('headerTitle')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tDebts('subtitle')}
          </p>
        </div>

        {/* Toolbar ringkas ala Arus Kas (semua h-9 seragam) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-initial">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-faint)]"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? 'Search loan...' : 'Cari pinjaman...'}
              aria-label={isEn ? 'Search loans' : 'Cari pinjaman'}
              className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] pl-8 pr-2.5 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          <Segmented
            size="sm"
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel={isEn ? 'Filter loan status' : 'Filter status pinjaman'}
            options={[
              { value: 'all', label: isEn ? 'All' : 'Semua' },
              { value: 'active', label: isEn ? 'Active' : 'Aktif' },
              { value: 'paid_off', label: isEn ? 'Paid' : 'Lunas' },
            ]}
          />

          <div className="inline-flex h-9 items-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              aria-label="Tampilan Tabel"
              title="Tampilan Tabel Ledger"
              className={`inline-flex size-8 items-center justify-center rounded-md transition ${
                viewMode === 'ledger'
                  ? 'bg-[var(--surface-1)] text-[var(--brand)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <List className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-label="Tampilan Kartu"
              title="Tampilan Kartu"
              className={`inline-flex size-8 items-center justify-center rounded-md transition ${
                viewMode === 'cards'
                  ? 'bg-[var(--surface-1)] text-[var(--brand)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <LayoutGrid className="size-3.5" aria-hidden />
            </button>
          </div>

          {canEdit && (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => {
                setFormTab('info');
                onToggleForm();
              }}
            >
              {tDebts('add')}
            </Button>
          )}
        </div>
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
              {totals.activeCount} {isEn ? 'active' : 'aktif'}
              {totals.autoPayCount > 0 ? ` · ${totals.autoPayCount} auto-pay` : ''}
              {totals.paidOffCount > 0
                ? ` · ${totals.paidOffCount} ${isEn ? 'paid off' : 'lunas'}`
                : ''}
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
              {isEn ? 'Total monthly installment obligation' : 'Total kewajiban cicilan bulanan'}
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
                ? `${simStats.count} ${isEn ? 'selected · Payoff' : 'dipilih · Lunasi'} ${formatRp(simStats.payoffNeeded)}`
                : isEn
                  ? 'Tick loans below to simulate payoff'
                  : 'Centang pinjaman di bawah untuk simulasi lunas'}
            </p>
          </div>
        </div>
      )}

      {/* Pop-up Modal Tambah / Edit Pinjaman + Jadwal Cicilan per Bulan */}
      <Modal
        open={showDebtForm && canEdit}
        onClose={() => {
          setFormTab('info');
          onToggleForm();
        }}
        title={
          editingDebtId
            ? isEn
              ? `Edit Loan · ${debtForm.platform || 'Details'}`
              : `Edit Pinjaman · ${debtForm.platform || 'Pengaturan'}`
            : isEn
              ? 'Add New Loan'
              : 'Tambah Pinjaman Baru'
        }
        description={
          isEn
            ? 'Configure loan details, auto-payment, and custom monthly installment amounts.'
            : 'Atur detail pinjaman, auto-payment, dan nominal cicilan berbeda tiap bulan (PayLater / cicilan variabel).'
        }
        size="lg"
      >
        <form onSubmit={onSubmitForm} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              size="sm"
              value={formTab}
              onChange={setFormTab}
              ariaLabel={isEn ? 'Loan form tabs' : 'Tab form pinjaman'}
              options={[
                {
                  value: 'info',
                  label: isEn ? 'Info & Settings' : 'Info & Pengaturan',
                },
                {
                  value: 'schedule',
                  label: isEn
                    ? `Monthly Schedule (${editableSchedule.overrideCount > 0 ? `${editableSchedule.overrideCount} custom` : `${editableSchedule.rows.length} mo`})`
                    : `Jadwal per Bulan (${editableSchedule.overrideCount > 0 ? `${editableSchedule.overrideCount} custom` : `${editableSchedule.rows.length} bln`})`,
                },
              ]}
            />
            {editingDebtId && debtForm.platform && (
              <span className="rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
                {debtForm.platform}
              </span>
            )}
          </div>

          {formTab === 'info' ? (
            <div className="space-y-4">
              {/* Informasi pokok pinjaman */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    placeholder="BRIguna, SPinjam, GoPay Later"
                    className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
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
                    className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
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
                    className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="debt-installment"
                    className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'Default Installment / mo' : 'Cicilan Default / Bln'}
                  </label>
                  <input
                    id="debt-installment"
                    name="installment"
                    type="number"
                    min="0"
                    value={debtForm.installment}
                    onChange={(e) => set('installment')(e.target.value)}
                    placeholder="500000"
                    className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
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
                    className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
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
                    onChange={(e) => {
                      const val = e.target.value;
                      onFormChange({
                        ...debtForm,
                        dueDay: val,
                        autoPayDay: debtForm.autoPayDay || val,
                      });
                    }}
                    placeholder="24"
                    className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Suku Bunga & Skema Flat / Floating */}
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 p-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="debt-interest-rate"
                    className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    <Percent className="size-3.5 text-[var(--due)]" aria-hidden />
                    {isEn ? 'Interest Rate (% / year)' : 'Suku Bunga (% / tahun)'}
                  </label>
                  <input
                    id="debt-interest-rate"
                    name="interestRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="200"
                    value={debtForm.interestRate}
                    onChange={(e) => set('interestRate')(e.target.value)}
                    placeholder={isEn ? 'e.g. 11.5' : 'mis. 11.5'}
                    className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]">
                    {isEn ? 'Interest Scheme' : 'Skema Bunga'}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        {
                          id: 'flat' as const,
                          label: 'Flat',
                          desc: isEn ? 'Fixed rate' : 'Tetap',
                        },
                        {
                          id: 'floating' as const,
                          label: 'Floating',
                          desc: isEn ? 'Market rate' : 'Mengambang',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = debtForm.interestType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => set('interestType')(opt.id)}
                          className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition ${
                            active
                              ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                              : 'border-[var(--line)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          <span className="text-[10px] font-normal opacity-75">
                            ({opt.desc})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Auto-Payment: Tanggal & Dompet/Rekening Sumber */}
              <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-7 items-center justify-center rounded-lg ${
                        debtForm.autoPay
                          ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                          : 'bg-[var(--surface-1)] text-[var(--text-faint)]'
                      }`}
                    >
                      <Zap className="size-3.5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-[var(--text)]">
                        {isEn ? 'Auto-Payment Schedule' : 'Auto-Payment Otomatis'}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {isEn
                          ? 'Automatically deducts installment every month from the chosen wallet'
                          : 'Otomatis mencatat cicilan keluar tiap bulan dari dompet/rekening pilihan'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={debtForm.autoPay}
                    onClick={() =>
                      onFormChange({
                        ...debtForm,
                        autoPay: !debtForm.autoPay,
                        autoPayDay: debtForm.autoPayDay || debtForm.dueDay || '1',
                        autoPayAccountId:
                          debtForm.autoPayAccountId ||
                          accounts[0]?.id ||
                          '__cash__',
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                      debtForm.autoPay ? 'bg-[var(--brand)]' : 'bg-[var(--line-strong)]'
                    }`}
                  >
                    <span
                      className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
                        debtForm.autoPay ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {debtForm.autoPay && (
                  <div className="grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="debt-autopay-day"
                        className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
                      >
                        {isEn ? 'Auto-Pay Every Day of Month (1-31)' : 'Auto-Bayar Setiap Tanggal (1-31)'}
                      </label>
                      <input
                        id="debt-autopay-day"
                        name="autoPayDay"
                        type="number"
                        min="1"
                        max="31"
                        required={debtForm.autoPay}
                        value={debtForm.autoPayDay}
                        onChange={(e) => set('autoPayDay')(e.target.value)}
                        placeholder="24"
                        className="tnum h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="debt-autopay-account"
                        className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]"
                      >
                        <Wallet className="size-3.5 text-[var(--brand)]" aria-hidden />
                        {isEn ? 'Source Wallet / Bank Account' : 'Dompet / Rekening Sumber'}
                      </label>
                      <select
                        id="debt-autopay-account"
                        name="autoPayAccountId"
                        value={debtForm.autoPayAccountId || '__cash__'}
                        onChange={(e) => set('autoPayAccountId')(e.target.value)}
                        className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                      >
                        <option value="__cash__">
                          {isEn ? 'Cash Wallet (Tunai)' : 'Kas Tunai'}
                        </option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.kind.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sharedGroups.length > 0 && (
                  <div>
                    <label
                      htmlFor="debt-group-id"
                      className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
                    >
                      {isEn ? 'Finance Space' : 'Ruang Keuangan'}
                    </label>
                    <select
                      id="debt-group-id"
                      name="groupId"
                      value={debtForm.groupId}
                      onChange={(e) => set('groupId')(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
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

                <div className={sharedGroups.length > 0 ? '' : 'sm:col-span-2'}>
                  <label
                    htmlFor="debt-notes"
                    className="mb-1 block text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'Notes (optional)' : 'Catatan (opsional)'}
                  </label>
                  <input
                    id="debt-notes"
                    name="notes"
                    type="text"
                    value={debtForm.notes}
                    onChange={(e) => set('notes')(e.target.value)}
                    placeholder={
                      isEn
                        ? 'e.g. PayLater installments vary per month'
                        : 'mis. Cicilan PayLater beda nominal tiap bulan'
                    }
                    className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Jadwal Cicilan per Bulan (Custom per YYYY-MM) */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--text)]">
                    {isEn
                      ? 'Customize installment amount per month'
                      : 'Ubah nominal tagihan spesifik per bulan'}
                  </p>
                  <p className="tnum text-[11px] text-[var(--text-muted)]">
                    {isEn ? 'Scheduled total:' : 'Total jadwal:'}{' '}
                    <span className="font-semibold text-[var(--due)]">
                      {formatRp(editableSchedule.totalScheduled)}
                    </span>
                    {Number(debtForm.balance) > 0 &&
                      editableSchedule.totalScheduled !== Number(debtForm.balance) && (
                        <span className="ml-1.5 text-[10px] text-[var(--text-faint)]">
                          ({isEn ? 'Current balance' : 'Sisa tercatat'}:{' '}
                          {formatRp(Number(debtForm.balance))})
                        </span>
                      )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<RefreshCw className="size-3.5" />}
                    onClick={() => {
                      const firstAmt = editableSchedule.rows[0]?.amount ?? 0;
                      onFormChange({
                        ...debtForm,
                        balance:
                          editableSchedule.totalScheduled > 0
                            ? String(editableSchedule.totalScheduled)
                            : debtForm.balance,
                        installment:
                          firstAmt > 0 ? String(firstAmt) : debtForm.installment,
                      });
                    }}
                  >
                    {isEn ? 'Sync → Remaining' : 'Sinkron → Sisa Pinjaman'}
                  </Button>
                  {editableSchedule.overrideCount > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      icon={<RotateCcw className="size-3.5" />}
                      onClick={() => set('scheduleOverrides')({})}
                    >
                      {isEn ? 'Reset All' : 'Reset'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--line)]">
                <table className="w-full table-fixed border-collapse text-left text-[12px]">
                  <thead className="sticky top-0 z-10 bg-[var(--surface-2)]">
                    <tr className="border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                      <th className="w-12 px-2.5 py-2">Ke-</th>
                      <th className="w-36 px-2.5 py-2">
                        {isEn ? 'Due Date' : 'Bulan / Tgl'}
                      </th>
                      <th className="px-2.5 py-2">
                        {isEn ? 'Installment (Rp)' : 'Nominal Cicilan (Rp)'}
                      </th>
                      <th className="hidden w-28 px-2.5 py-2 text-right sm:table-cell">
                        {isEn ? 'Est. Left' : 'Est. Sisa'}
                      </th>
                      <th className="w-10 px-2 py-2 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {editableSchedule.rows.map((row, idx) => (
                      <tr
                        key={row.ym}
                        className={
                          row.isCustom
                            ? 'bg-[var(--brand-soft)]/25'
                            : idx === 0
                              ? 'bg-[var(--surface-2)]/30'
                              : ''
                        }
                      >
                        <td className="tnum px-2.5 py-1.5 font-semibold text-[var(--text-muted)]">
                          #{row.seq}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <p className="tnum font-medium text-[var(--text)]">
                            {formatFullDate(row.dateIso)}
                          </p>
                          {row.isCustom && (
                            <span className="inline-block rounded bg-[var(--brand-soft)] px-1.5 py-0.2 text-[9px] font-semibold text-[var(--brand)]">
                              Custom
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            aria-label={`Cicilan ${row.ym}`}
                            value={row.amount === 0 && !row.isCustom ? '' : row.amount}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextOverrides = { ...debtForm.scheduleOverrides };
                              if (raw === '') {
                                delete nextOverrides[row.ym];
                              } else {
                                const num = Math.max(0, Math.round(Number(raw)));
                                if (Number.isFinite(num)) {
                                  nextOverrides[row.ym] = num;
                                }
                              }
                              set('scheduleOverrides')(nextOverrides);
                            }}
                            placeholder={debtForm.installment || '0'}
                            className={`tnum h-8 w-full rounded-lg border px-2.5 text-[12px] font-semibold text-[var(--text)] focus:border-[var(--brand)] focus:outline-none ${
                              row.isCustom
                                ? 'border-[var(--brand)]/50 bg-[var(--surface-1)]'
                                : 'border-[var(--line)] bg-[var(--surface-2)]'
                            }`}
                          />
                        </td>
                        <td className="tnum hidden px-2.5 py-1.5 text-right text-[var(--due)] sm:table-cell">
                          {formatRp(row.estBalanceAfter)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {row.isCustom && (
                            <button
                              type="button"
                              title={isEn ? 'Reset to default' : 'Kembalikan ke default'}
                              onClick={() => {
                                const nextOverrides = { ...debtForm.scheduleOverrides };
                                delete nextOverrides[row.ym];
                                set('scheduleOverrides')(nextOverrides);
                              }}
                              className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                            >
                              <RotateCcw className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[var(--text-faint)]">
                {isEn
                  ? 'Tip: Edit any month that differs from the default, then click "Sync → Remaining" to update the total remaining balance automatically.'
                  : 'Tip: Ubah nominal bulan yang berbeda (mis. GoPay Later / SPayLater), lalu klik "Sinkron → Sisa Pinjaman" agar total sisa tagihan langsung cocok.'}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
            <div className="text-[11px] text-[var(--text-faint)]">
              {formTab === 'info' ? (
                <button
                  type="button"
                  onClick={() => setFormTab('schedule')}
                  className="font-semibold text-[var(--brand)] hover:underline"
                >
                  {isEn
                    ? 'Edit different amounts per month →'
                    : 'Atur nominal beda tiap bulan →'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setFormTab('info')}
                  className="font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  ← {isEn ? 'Back to Info' : 'Kembali ke Info'}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFormTab('info');
                  onToggleForm();
                }}
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" size="sm">
                {editingDebtId
                  ? isEn
                    ? 'Save Changes'
                    : 'Simpan Perubahan'
                  : tCommon('save')}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

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
      ) : filteredDebts.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-8 text-center text-[12px] text-[var(--text-muted)]">
          Tidak ada pinjaman yang cocok dengan filter pencarian.
        </div>
      ) : viewMode === 'ledger' ? (
        /* Tampilan Ledger Tabel Pinjaman (seperti Arus Kas: lengkap jadwal bayar & klik -> detail) */
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          {/* Mobile list */}
          <div className="divide-y divide-[var(--line)] sm:hidden">
            {filteredDebts.map((debt) => {
              const settled = debt.status === 'paid_off';
              const { meta } = parseDebtNotes(debt.notes);
              const dueDay = debt.due_day || meta.autoPayDay;
              const nextDue = !settled && dueDay ? nextDebtScheduleDate(dueDay, debt.notes, today) : null;
              const nextDueIso = nextDue
                ? `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, '0')}-${String(nextDue.getDate()).padStart(2, '0')}`
                : null;
              const dLeft = nextDueIso ? daysUntil(nextDueIso) : null;
              const effNext = getEffectiveNextInstallment(debt);

              return (
                <div
                  key={debt.id}
                  onClick={() => {
                    setDetailTab('schedule');
                    setDetailDebt(debt);
                  }}
                  className="cursor-pointer px-4 py-3 transition hover:bg-[var(--surface-2)]/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                        {debt.platform}
                      </p>
                      <p className="tnum mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {settled
                          ? 'Lunas'
                          : nextDueIso
                            ? `Bayar ${formatFullDate(nextDueIso)}${dLeft !== null && dLeft >= 0 ? ` (${dLeft === 0 ? 'Hari ini' : `H-${dLeft}`})` : ''}`
                            : 'Jadwal belum diatur'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Amount value={formatRp(debt.remaining_balance)} tone="due" size="sm" />
                      <p className="tnum text-[10px] text-[var(--text-faint)]">
                        {formatRp(effNext.amount)}/bln
                        {effNext.overrideCount > 0 ? ' · Variabel' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop ledger table */}
          <table className="hidden w-full table-fixed border-collapse text-left sm:table">
            <thead className="bg-[var(--surface-2)]">
              <tr className="border-b border-[var(--line)]">
                {canEdit && <th className="w-[36px] px-3 py-2.5" />}
                <th className="w-[156px] px-3 py-2.5">
                  <Label>{isEn ? 'Next Due' : 'Jatuh Tempo'}</Label>
                </th>
                <th className="px-3 py-2.5">
                  <Label>{isEn ? 'Loan & Details' : 'Pinjaman & Detail'}</Label>
                </th>
                <th className="hidden w-[112px] px-3 py-2.5 lg:table-cell">
                  <Label>Tenor</Label>
                </th>
                <th className="w-[126px] px-3 py-2.5 text-right">
                  <Label>{isEn ? 'Installment' : 'Cicilan / Bln'}</Label>
                </th>
                <th className="w-[138px] px-3 py-2.5 text-right">
                  <Label>{isEn ? 'Remaining' : 'Sisa Pinjaman'}</Label>
                </th>
                <th className="w-[116px] px-3 py-2.5 text-right">
                  <Label>{isEn ? 'Actions' : 'Aksi'}</Label>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-[12px]">
              {filteredDebts.map((debt) => {
                const isSimSelected = simSelectedIds.includes(debt.id);
                const settled = debt.status === 'paid_off';
                const { meta } = parseDebtNotes(debt.notes);
                const dueDay = debt.due_day || meta.autoPayDay;
                const nextDue =
                  !settled && dueDay
                    ? nextDebtScheduleDate(dueDay, debt.notes, today)
                    : null;
                const nextDueIso = nextDue
                  ? `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, '0')}-${String(nextDue.getDate()).padStart(2, '0')}`
                  : null;
                const dLeft = nextDueIso ? daysUntil(nextDueIso) : null;
                const urgent = dLeft !== null && dLeft >= 0 && dLeft <= 3;
                const effNext = getEffectiveNextInstallment(debt);

                return (
                  <tr
                    key={debt.id}
                    onClick={() => {
                      setDetailTab('schedule');
                      setDetailDebt(debt);
                    }}
                    className={`group cursor-pointer transition-colors hover:bg-[var(--surface-2)]/60 ${
                      isSimSelected ? 'bg-[var(--info-soft)]/30' : ''
                    }`}
                  >
                    {canEdit && (
                      <td
                        className="px-3 py-2.5 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!settled && (
                          <input
                            type="checkbox"
                            checked={isSimSelected}
                            onChange={() => onToggleSim(debt.id)}
                            aria-label={tDebts('simulator.hint')}
                            className="size-4 cursor-pointer accent-[var(--info)]"
                          />
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5 align-middle">
                      {settled ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                          <CheckCircle2 className="size-3" aria-hidden />
                          Lunas
                        </span>
                      ) : nextDueIso ? (
                        <div>
                          <p className="tnum font-semibold text-[var(--text)]">
                            {formatFullDate(nextDueIso)}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            {dLeft !== null && dLeft >= 0 && (
                              <span
                                className={`tnum rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                                  urgent
                                    ? 'bg-[var(--out-soft)] text-[var(--out)]'
                                    : 'bg-[var(--due-soft)] text-[var(--due)]'
                                }`}
                              >
                                {dLeft === 0 ? 'Hari ini' : `H-${dLeft}`}
                              </span>
                            )}
                            {meta.autoPay && (
                              <span
                                title={`Auto-Pay tgl ${meta.autoPayDay || debt.due_day} · ${walletName(meta.autoPayAccountId)}`}
                                className="inline-flex items-center gap-0.5 rounded bg-[var(--brand-soft)] px-1.5 py-0.2 text-[10px] font-semibold text-[var(--brand)]"
                              >
                                <Zap className="size-2.5" aria-hidden />
                                Auto
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--text-faint)]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-[var(--text)] group-hover:text-[var(--brand)]">
                            {debt.platform}
                          </p>
                          {debt.group_id && groupNameById[debt.group_id] && (
                            <span className="shrink-0 rounded bg-[var(--info-soft)] px-1.5 py-0.2 text-[9.5px] font-semibold text-[var(--info)]">
                              {groupNameById[debt.group_id]}
                            </span>
                          )}
                        </div>
                        <p className="tnum mt-0.5 truncate text-[11px] text-[var(--text-faint)]">
                          {debt.contract_no ? `No. ${debt.contract_no}` : 'Pribadi'}
                          {meta.interestRate
                            ? ` · Bunga ${meta.interestRate}% (${meta.interestType === 'floating' ? 'Floating' : 'Flat'})`
                            : ''}
                        </p>
                      </div>
                    </td>
                    <td className="tnum hidden px-3 py-2.5 align-middle text-[var(--text-muted)] lg:table-cell">
                      {debt.remaining_tenor ?? '-'}
                      {debt.total_tenor ? ` / ${debt.total_tenor}` : ''} bln
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                      <Amount value={formatRp(effNext.amount)} size="sm" />
                      {effNext.overrideCount > 0 && (
                        <p className="text-[9.5px] font-medium text-[var(--brand)]">
                          Variabel ({effNext.overrideCount} bln)
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle">
                      <Amount
                        value={formatRp(debt.remaining_balance)}
                        tone={settled ? 'brand' : 'due'}
                        size="sm"
                      />
                    </td>
                    <td
                      className="px-3 py-2.5 text-right align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-0.5">
                        <IconButton
                          size="sm"
                          label={isEn ? 'Schedule & details' : 'Jadwal & detail'}
                          onClick={() => {
                            setDetailTab('schedule');
                            setDetailDebt(debt);
                          }}
                          className="text-[var(--text-faint)] hover:text-[var(--brand)]"
                        >
                          <Eye className="size-3.5" />
                        </IconButton>
                        {canEdit && onEdit && (
                          <IconButton
                            size="sm"
                            label={tCommon('edit')}
                            onClick={() => {
                              setFormTab('info');
                              onEdit(debt);
                            }}
                            className="text-[var(--text-faint)] hover:text-[var(--brand)]"
                          >
                            <Pencil className="size-3.5" />
                          </IconButton>
                        )}
                        {canEdit && (
                          <IconButton
                            size="sm"
                            label={tCommon('delete')}
                            onClick={() => onDelete(debt.id)}
                            className="text-[var(--text-faint)] hover:text-[var(--out)]"
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredDebts.map((debt, idx) => {
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
            const { meta } = parseDebtNotes(debt.notes);
            const monthlyEstInterest = estimateMonthlyInterest(
              Number(debt.remaining_balance),
              meta.interestRate
            );

            let dueCountdown: number | null = null;
            let nextDueIso: string | null = null;
            if (!settled && debt.due_day) {
              const nd = nextDebtScheduleDate(debt.due_day, debt.notes, today);
              const iso = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
              nextDueIso = iso;
              const dLeft = daysUntil(iso);
              if (Number.isFinite(dLeft) && dLeft >= 0) dueCountdown = dLeft;
            }

            let nextAutoPayIso: string | null = null;
            if (!settled && meta.autoPay) {
              const autoDay = meta.autoPayDay || debt.due_day || 1;
              const nd = nextDebtScheduleDate(autoDay, debt.notes, today);
              nextAutoPayIso = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
            }

            const currentYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

            return (
              <motion.article
                key={debt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.24) }}
                className={`card-interactive flex flex-col justify-between rounded-xl border bg-[var(--surface-1)] p-4 ${
                  isSimSelected
                    ? 'border-[var(--info)] ring-1 ring-[var(--info)]/40'
                    : settled
                      ? 'border-[var(--brand)]/30 opacity-75'
                      : 'border-[var(--line)]'
                }`}
              >
                <div>
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

                    {/* Baris ikon status & aksi rapi sejajar di pojok kanan atas */}
                    <div className="flex shrink-0 items-center gap-1">
                      {/* Ikon Warning Jatuh Tempo (hover -> detail jatuh tempo) */}
                      {dueCountdown !== null && dueCountdown <= 7 && (
                        <div className="group/due relative">
                          <button
                            type="button"
                            aria-label={
                              dueCountdown === 0
                                ? isEn
                                  ? 'Due today'
                                  : 'Jatuh tempo hari ini'
                                : isEn
                                  ? `Due in ${dueCountdown} days`
                                  : `Jatuh tempo ${dueCountdown} hari lagi`
                            }
                            className={`flex size-8 items-center justify-center rounded-lg border transition ${
                              dueCountdown <= 3
                                ? 'border-[var(--out)]/30 bg-[var(--out-soft)] text-[var(--out)]'
                                : 'border-[var(--due)]/30 bg-[var(--due-soft)] text-[var(--due)]'
                            }`}
                          >
                            <AlertTriangle className="size-3.5" aria-hidden />
                          </button>
                          <div className="pointer-events-none invisible absolute bottom-full right-0 z-30 mb-1.5 w-48 translate-y-1 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-1)]/95 px-2.5 py-2 opacity-0 shadow-[var(--shadow-lg)] backdrop-blur-sm transition-all duration-150 group-hover/due:visible group-hover/due:translate-y-0 group-hover/due:opacity-100 group-focus-within/due:visible group-focus-within/due:translate-y-0 group-focus-within/due:opacity-100">
                            <p
                              className={`text-[11px] font-semibold ${
                                dueCountdown <= 3 ? 'text-[var(--out)]' : 'text-[var(--due)]'
                              }`}
                            >
                              {dueCountdown === 0
                                ? isEn
                                  ? 'Due Today'
                                  : 'Jatuh Tempo Hari Ini'
                                : isEn
                                  ? `Due in ${dueCountdown} days`
                                  : `Jatuh Tempo ${dueCountdown} Hari Lagi`}
                            </p>
                            {nextDueIso && (
                              <p className="tnum mt-0.5 text-[10px] text-[var(--text-muted)]">
                                {formatFullDate(nextDueIso)}
                                {debt.due_day
                                  ? isEn
                                    ? ` · Day ${debt.due_day}`
                                    : ` · Tgl ${debt.due_day}`
                                  : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Ikon Kalender Auto-Payment / Payroll Otomatis (hover -> detail tanggal & rekening) */}
                      {meta.autoPay && (
                        <div className="group/auto relative">
                          <button
                            type="button"
                            aria-label={
                              isEn
                                ? `Auto-pay every day ${meta.autoPayDay || debt.due_day || 1}`
                                : `Auto-payment setiap tanggal ${meta.autoPayDay || debt.due_day || 1}`
                            }
                            className="flex size-8 items-center justify-center rounded-lg border border-[var(--brand)]/30 bg-[var(--brand-soft)] text-[var(--brand)] transition hover:border-[var(--brand)]"
                          >
                            <Calendar className="size-3.5" aria-hidden />
                          </button>
                          <div className="pointer-events-none invisible absolute bottom-full right-0 z-30 mb-1.5 w-60 translate-y-1 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-1)]/95 px-2.5 py-2 opacity-0 shadow-[var(--shadow-lg)] backdrop-blur-sm transition-all duration-150 group-hover/auto:visible group-hover/auto:translate-y-0 group-hover/auto:opacity-100 group-focus-within/auto:visible group-focus-within/auto:translate-y-0 group-focus-within/auto:opacity-100">
                            <p className="text-[11px] font-semibold text-[var(--brand)]">
                              {isEn ? 'Auto-Payment Active' : 'Auto-Payment Aktif'}
                            </p>
                            <p className="tnum mt-0.5 text-[11px] text-[var(--text)]">
                              {isEn
                                ? `Every day ${meta.autoPayDay || debt.due_day || 1}`
                                : `Otomatis setiap tgl ${meta.autoPayDay || debt.due_day || 1}`}
                            </p>
                            {nextAutoPayIso && (
                              <p className="tnum mt-0.5 text-[10px] text-[var(--text-muted)]">
                                {isEn ? 'Next schedule: ' : 'Periode berikutnya: '}
                                <span className="font-semibold text-[var(--text)]">
                                  {formatFullDate(nextAutoPayIso)}
                                </span>
                              </p>
                            )}
                            <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                              {isEn ? 'From: ' : 'Sumber: '}
                              {walletName(meta.autoPayAccountId)}
                            </p>
                            {meta.lastAutoPaidYm === currentYm && (
                              <p className="mt-1 text-[10px] font-medium text-[var(--brand)]">
                                ✓ {isEn ? 'Paid this period' : 'Sudah tercatat bulan ini'}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Ikon Bunga (hover -> detail %/thn Flat/Floating & estimasi bunga/bln) */}
                      {meta.interestRate !== null && (
                        <div className="group/rate relative">
                          <button
                            type="button"
                            aria-label={`${meta.interestRate}% ${meta.interestType}`}
                            className="flex size-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] transition hover:border-[var(--due)] hover:text-[var(--due)]"
                          >
                            <Percent className="size-3.5" aria-hidden />
                          </button>
                          <div className="pointer-events-none invisible absolute bottom-full right-0 z-30 mb-1.5 w-48 translate-y-1 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-1)]/95 px-2.5 py-2 opacity-0 shadow-[var(--shadow-lg)] backdrop-blur-sm transition-all duration-150 group-hover/rate:visible group-hover/rate:translate-y-0 group-hover/rate:opacity-100 group-focus-within/rate:visible group-focus-within/rate:translate-y-0 group-focus-within/rate:opacity-100">
                            <p className="tnum text-[11px] font-semibold text-[var(--text)]">
                              {meta.interestRate}% / {isEn ? 'year' : 'tahun'} ·{' '}
                              {meta.interestType === 'floating' ? 'Floating' : 'Flat'}
                            </p>
                            {monthlyEstInterest > 0 && (
                              <p className="tnum mt-0.5 text-[10px] text-[var(--text-muted)]">
                                {isEn ? 'Est. interest/mo: ' : 'Est. bunga/bln: '}~
                                {formatRp(monthlyEstInterest)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {canEdit && (
                        <>
                          {onEdit && (
                            <IconButton
                              label={isEn ? 'Edit loan' : 'Edit pinjaman'}
                              size="sm"
                              onClick={() => onEdit(debt)}
                              className="!size-8 text-[var(--text-faint)] hover:text-[var(--brand)]"
                            >
                              <Pencil className="size-3.5" />
                            </IconButton>
                          )}
                          <IconButton
                            label={tCommon('delete')}
                            size="sm"
                            onClick={() => onDelete(debt.id)}
                            className="!size-8 text-[var(--text-faint)] hover:text-[var(--out)]"
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        </>
                      )}
                    </div>
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
                </div>

                <div>
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

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      icon={<CalendarClock className="size-3.5" />}
                      onClick={() => {
                        setDetailTab('schedule');
                        setDetailDebt(debt);
                      }}
                    >
                      {isEn ? 'Schedule' : 'Jadwal'}
                    </Button>
                    {!settled && canEdit && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => onPay(debt)}
                      >
                        {tDebts('card.pay')}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Pop-up Detail Pinjaman + Jadwal Pembayaran Mendatang + Riwayat Arus Kas */}
      <Modal
        open={Boolean(detailDebt)}
        onClose={() => setDetailDebt(null)}
        title={detailDebt ? detailDebt.platform : 'Detail Pinjaman'}
        description={
          detailDebt
            ? [
                detailDebt.contract_no ? `No. Kontrak: ${detailDebt.contract_no}` : null,
                detailDebt.due_day ? `Jatuh tempo tgl ${detailDebt.due_day} tiap bulan` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Detail pinjaman & jadwal angsuran'
            : undefined
        }
        size="lg"
      >
        {detailDebt && (() => {
          const { meta, text: cleanNotes } = parseDebtNotes(detailDebt.notes);
          const settled = detailDebt.status === 'paid_off';
          const { rows: scheduleRows, totalRemainingCount } = buildScheduleForDebt(detailDebt);
          const linkedPayments = getLinkedPayments(detailDebt);

          return (
            <div className="space-y-4">
              {/* Ringkasan KPI 4-kolom */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                  <Label className="text-[10px]">Sisa Pinjaman</Label>
                  <div className="mt-1">
                    <Amount
                      value={formatRp(detailDebt.remaining_balance)}
                      tone={settled ? 'brand' : 'due'}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                  <Label className="text-[10px]">Cicilan / Bln</Label>
                  <div className="mt-1">
                    <Amount value={formatRp(detailDebt.monthly_installment)} size="sm" />
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                  <Label className="text-[10px]">Sisa Tenor</Label>
                  <p className="tnum mt-1 text-[13px] font-semibold text-[var(--text)]">
                    {detailDebt.remaining_tenor ?? '-'}
                    {detailDebt.total_tenor ? ` / ${detailDebt.total_tenor}` : ''} bln
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
                  <Label className="text-[10px]">Bunga / Auto-Pay</Label>
                  <p className="tnum mt-1 truncate text-[12px] font-semibold text-[var(--text)]">
                    {meta.interestRate
                      ? `${meta.interestRate}% (${meta.interestType === 'floating' ? 'Float' : 'Flat'})`
                      : meta.autoPay
                        ? `Auto tgl ${meta.autoPayDay || detailDebt.due_day}`
                        : '-'}
                  </p>
                </div>
              </div>

              {meta.autoPay && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-3 py-2 text-[12px] text-[var(--brand)]">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Zap className="size-3.5" aria-hidden />
                    Auto-Payment aktif setiap tanggal {meta.autoPayDay || detailDebt.due_day || 1}
                  </span>
                  <span className="text-[11px] opacity-90">
                    Sumber: {walletName(meta.autoPayAccountId)}
                  </span>
                </div>
              )}

              {cleanNotes && (
                <p className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2 text-[12px] text-[var(--text-muted)]">
                  {cleanNotes}
                </p>
              )}

              {/* Switcher Tab: Jadwal Mendatang vs Riwayat Pembayaran */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Segmented
                  size="sm"
                  value={detailTab}
                  onChange={setDetailTab}
                  ariaLabel="Tab detail pinjaman"
                  options={[
                    {
                      value: 'schedule',
                      label: `Jadwal Bayar (${totalRemainingCount})`,
                    },
                    {
                      value: 'history',
                      label: `Riwayat Terbayar (${linkedPayments.length})`,
                    },
                  ]}
                />

                {!settled && canEdit && (
                  <div className="flex items-center gap-1.5">
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Pencil className="size-3.5" />}
                        onClick={() => {
                          const d = detailDebt;
                          setDetailDebt(null);
                          setFormTab('schedule');
                          onEdit(d);
                        }}
                      >
                        {isEn ? 'Edit Schedule' : 'Edit Jadwal'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        const d = detailDebt;
                        setDetailDebt(null);
                        onPay(d);
                      }}
                    >
                      Bayar Cicilan
                    </Button>
                  </div>
                )}
              </div>

              {detailTab === 'schedule' ? (
                settled ? (
                  <p className="py-6 text-center text-[12px] text-[var(--brand)]">
                    Pinjaman ini sudah lunas seluruhnya.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--line)]">
                    <table className="w-full table-fixed border-collapse text-left text-[12px]">
                      <thead className="sticky top-0 bg-[var(--surface-2)]">
                        <tr className="border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                          <th className="w-16 px-3 py-2">Ke-</th>
                          <th className="px-3 py-2">Tanggal Bayar</th>
                          <th className="w-28 px-3 py-2 text-right">Cicilan</th>
                          <th className="hidden w-28 px-3 py-2 text-right sm:table-cell">
                            Est. Bunga
                          </th>
                          <th className="w-32 px-3 py-2 text-right">Est. Sisa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {scheduleRows.map((row, i) => (
                          <tr
                            key={row.seq}
                            className={i === 0 ? 'bg-[var(--brand-soft)]/35' : ''}
                          >
                            <td className="tnum px-3 py-2 font-semibold text-[var(--text-muted)]">
                              #{row.seq}
                            </td>
                            <td className="px-3 py-2">
                              <span className="tnum font-medium text-[var(--text)]">
                                {formatFullDate(row.dateIso)}
                              </span>
                              {i === 0 && (
                                <span className="ml-1.5 rounded bg-[var(--brand-soft)] px-1.5 py-0.2 text-[9.5px] font-semibold text-[var(--brand)]">
                                  {row.daysLeft === 0
                                    ? 'Hari ini'
                                    : row.daysLeft > 0
                                      ? `H-${row.daysLeft}`
                                      : 'Berikutnya'}
                                </span>
                              )}
                            </td>
                            <td className="tnum px-3 py-2 text-right font-semibold text-[var(--text)]">
                              <span>{formatRp(row.installment)}</span>
                              {row.isCustom && (
                                <span className="ml-1 inline-block rounded bg-[var(--brand-soft)] px-1 py-0.2 text-[9px] font-semibold text-[var(--brand)]">
                                  Custom
                                </span>
                              )}
                            </td>
                            <td className="tnum hidden px-3 py-2 text-right text-[var(--text-muted)] sm:table-cell">
                              {row.estInterest > 0 ? formatRp(row.estInterest) : '-'}
                            </td>
                            <td className="tnum px-3 py-2 text-right text-[var(--due)]">
                              {formatRp(row.estBalanceAfter)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {totalRemainingCount > scheduleRows.length && (
                      <p className="border-t border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2 text-center text-[11px] text-[var(--text-faint)]">
                        Menampilkan 24 jadwal terdekat dari total {totalRemainingCount} sisa tenor.
                      </p>
                    )}
                  </div>
                )
              ) : linkedPayments.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-[var(--text-muted)]">
                  Belum ada transaksi pembayaran yang cocok di Arus Kas untuk pinjaman ini.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--line)]">
                  <table className="w-full table-fixed border-collapse text-left text-[12px]">
                    <thead className="sticky top-0 bg-[var(--surface-2)]">
                      <tr className="border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                        <th className="w-28 px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Keterangan</th>
                        <th className="w-32 px-3 py-2 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {linkedPayments.map((tx) => (
                        <tr key={tx.id}>
                          <td className="tnum px-3 py-2 text-[var(--text-muted)]">
                            {formatFullDate(tx.transaction_date)}
                          </td>
                          <td className="truncate px-3 py-2 text-[var(--text)]">
                            {tx.description || tx.category}
                          </td>
                          <td className="tnum px-3 py-2 text-right font-semibold text-[var(--out)]">
                            -{formatRp(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
