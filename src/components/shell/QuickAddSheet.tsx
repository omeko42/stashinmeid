'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import type { TransactionType } from '@/types/finance';
import { categoryOptions } from '@/lib/categories';
import { todayIso } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

export interface QuickAddState {
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  date: string;
  /** Ruang bersama (kolega); kosong = pribadi. */
  groupId: string;
  /**
   * Sumber dana / dompet:
   * - '' (default)        = Kas Tunai (Saldo Fisik)
   * - '__non_physical__'  = Bank / E-Wallet (Saldo Non-Fisik)
   * - '<uuid>'            = ID dompet spesifik dari tabel `accounts`
   */
  accountId: string;
}

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  state: QuickAddState;
  scanMsg: string | null;
  saving: boolean;
  /** Sedang mengedit transaksi yang sudah ada (bukan tambah baru). */
  editing?: boolean;
  /** Daftar ruang bersama aktif; kosong = pilihan tidak muncul. */
  sharedGroups?: { id: string; name: string }[];
  /** Daftar dompet aset user untuk dihubungkan dengan arus kas. */
  accounts?: { id: string; name: string; kind: string; currency: string }[];
  onStateChange: (next: QuickAddState) => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Sheet catat transaksi.
 *
 *sheet ini juga jadi tempat hasil pindai struk AI mendarat - pesan scan
 *ditampilkan di atas form supaya user tahu datanya perlu dicek sebelum disimpan.
 */
export function QuickAddSheet({
  open,
  onClose,
  state,
  scanMsg,
  saving,
  editing = false,
  sharedGroups = [],
  accounts = [],
  onStateChange,
  onSubmit,
}: QuickAddSheetProps) {
  const t = useTranslations();
  const tQuickAdd = useTranslations('quickAdd');

  const set = <K extends keyof QuickAddState>(key: K, value: QuickAddState[K]) =>
    onStateChange({ ...state, [key]: value });

  const categories = categoryOptions(state.type);

  const handleTypeChange = (type: TransactionType) => {
    const options = categoryOptions(type);
    const stillValid = options.some((c) => c.id === state.category);
    set('type', type);
    if (!stillValid) set('category', options[0].id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Transaksi' : tQuickAdd('title')}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="quick-add-form" size="sm" loading={saving}>
            {editing ? 'Simpan Perubahan' : tQuickAdd('save')}
          </Button>
        </>
      }
    >
      <form id="quick-add-form" onSubmit={onSubmit} className="space-y-4">
        {scanMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--info)]/30 bg-[var(--info-soft)] px-3 py-2.5 text-[12px] text-[var(--info)]">
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{scanMsg}</span>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">
            {tQuickAdd('type')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('outflow')}
              aria-pressed={state.type === 'outflow'}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-[12px] font-semibold transition',
                state.type === 'outflow'
                  ? 'border-[var(--out)] bg-[var(--out-soft)] text-[var(--out)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)]'
              )}
            >
              {tQuickAdd('typeOutflow')}
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('inflow')}
              aria-pressed={state.type === 'inflow'}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-[12px] font-semibold transition',
                state.type === 'inflow'
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)]'
              )}
            >
              {tQuickAdd('typeInflow')}
            </button>
          </div>
        </div>

        <Input
          label={tQuickAdd('amount')}
          type="number"
          required
          min="1"
          inputMode="numeric"
          value={state.amount}
          onChange={(e) => set('amount', e.target.value)}
          placeholder={tQuickAdd('amountPlaceholder')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={tQuickAdd('category')}
            value={state.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </Select>
          <Input
            label={tQuickAdd('date')}
            type="date"
            value={state.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>

        <Input
          label={tQuickAdd('description')}
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={tQuickAdd('descriptionPlaceholder')}
        />

        <div className={cn('grid gap-3', sharedGroups.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
          <Select
            label="Dompet / Sumber Saldo"
            value={state.accountId}
            onChange={(e) => set('accountId', e.target.value)}
          >
            <option value="">Kas Tunai</option>
            <option value="__non_physical__">Non-Tunai (Bank / E-Wallet)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.currency})
              </option>
            ))}
          </Select>

          {sharedGroups.length > 0 && (
            <Select
              label={tQuickAdd('shared')}
              value={state.groupId}
              onChange={(e) => set('groupId', e.target.value)}
            >
              <option value="">{tQuickAdd('sharedPersonal')}</option>
              {sharedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  Grup: {g.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** State awal sheet. */
export function initialQuickAddState(defaultGroupId = ''): QuickAddState {
  return {
    type: 'outflow',
    amount: '',
    category: categoryOptions('outflow')[0].id,
    description: '',
    date: todayIso(),
    groupId: defaultGroupId,
    accountId: '',
  };
}
