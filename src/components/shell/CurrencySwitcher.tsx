'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Check, ChevronDown, Coins } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useCurrency } from '@/components/ui/CurrencyContext';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { cn } from '@/lib/cn';

const CURRENCY_LIST: { code: string; nameId: string; nameEn: string; sym: string }[] = [
  { code: 'IDR', nameId: 'Rupiah Indonesia', nameEn: 'Indonesian Rupiah', sym: 'Rp' },
  { code: 'USD', nameId: 'Dolar Amerika', nameEn: 'US Dollar', sym: '$' },
  { code: 'EUR', nameId: 'Euro', nameEn: 'Euro', sym: '€' },
  { code: 'SGD', nameId: 'Dolar Singapura', nameEn: 'Singapore Dollar', sym: 'S$' },
  { code: 'GBP', nameId: 'Poundsterling', nameEn: 'British Pound', sym: '£' },
  { code: 'JPY', nameId: 'Yen Jepang', nameEn: 'Japanese Yen', sym: '¥' },
  { code: 'AUD', nameId: 'Dolar Australia', nameEn: 'Australian Dollar', sym: 'A$' },
  { code: 'MYR', nameId: 'Ringgit Malaysia', nameEn: 'Malaysian Ringgit', sym: 'RM' },
];

/**
 * Pemilih Mata Uang Utama berbasis Pop-up Modal dengan tombol konfirmasi
 * dan sinkronisasi global ke CurrencyContext & ticker pasar live.
 */
export function CurrencySwitcher({
  compact,
  onSelectCurrency,
}: {
  compact?: boolean;
  onSelectCurrency?: (currency: string) => void;
}) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const { primaryCurrency, setPrimaryCurrency } = useCurrency();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);

  const handleChoose = async (code: string) => {
    setOpen(false);
    if (code === primaryCurrency) return;
    const item = CURRENCY_LIST.find((c) => c.code === code);
    const label = item
      ? `${item.code} (${isEn ? item.nameEn : item.nameId})`
      : code;

    const ok = await confirm({
      title: isEn ? `Switch currency to ${code}?` : `Ubah mata uang ke ${code}?`,
      description: isEn
        ? `Are you sure you want to switch display currency and live rates to ${label}?`
        : `Apakah Anda yakin mengubah satuan mata uang dan kurs live ke ${label}?`,
      confirmLabel: isEn ? 'Yes, Switch' : 'Ya, Ubah',
      cancelLabel: isEn ? 'Cancel' : 'Batal',
      audit: {
        action: 'Ubah Mata Uang Utama',
        category: 'settings',
        detail: `${primaryCurrency} → ${code}`,
      },
    });
    if (!ok) return;

    setPrimaryCurrency(code);
    onSelectCurrency?.(code);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isEn ? 'Select currency' : 'Pilih mata uang'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-[var(--text)] transition hover:border-[var(--brand)]',
          compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'
        )}
      >
        <Coins className="size-3.5 text-[var(--brand)]" aria-hidden />
        <span className="font-mono">{primaryCurrency}</span>
        <ChevronDown className="size-3 opacity-70" aria-hidden />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEn ? 'Select Currency' : 'Pilih Mata Uang'}
        description={
          isEn
            ? 'Live market prices, balances, and plans will follow this currency.'
            : 'Kurs pasar live, saldo, dan tampilan harga akan mengikuti satuan mata uang ini.'
        }
        size="sm"
      >
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
          {CURRENCY_LIST.map((cur) => {
            const active = cur.code === primaryCurrency;
            return (
              <button
                key={cur.code}
                type="button"
                onClick={() => void handleChoose(cur.code)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition',
                  active
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)]/30 text-[var(--text)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)]/70 text-[var(--text)] hover:border-[var(--line-strong)]'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex w-10 items-center justify-center rounded-lg bg-[var(--surface-1)] py-1 font-mono text-[11px] font-bold text-[var(--brand)]">
                    {cur.sym}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold">{cur.code}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {isEn ? cur.nameEn : cur.nameId}
                    </p>
                  </div>
                </div>
                {active && (
                  <Check className="size-4 text-[var(--brand)]" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
