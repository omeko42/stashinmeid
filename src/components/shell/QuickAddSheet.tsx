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
}

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  state: QuickAddState;
  scanMsg: string | null;
  saving: boolean;
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
      title={tQuickAdd('title')}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="quick-add-form" size="sm" loading={saving}>
            {tQuickAdd('save')}
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
      </form>
    </Modal>
  );
}

/** State awal sheet. */
export function initialQuickAddState(): QuickAddState {
  return {
    type: 'outflow',
    amount: '',
    category: categoryOptions('outflow')[0].id,
    description: '',
    date: todayIso(),
  };
}
