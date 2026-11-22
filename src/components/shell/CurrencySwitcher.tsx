'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Coins } from 'lucide-react';
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
 * Pemilih Mata Uang Utama berbasis anchored popover dropdown (muncul tepat di bawah tombol)
 * dengan tombol konfirmasi dan sinkronisasi global ke CurrencyContext & ticker pasar live.
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={isEn ? 'Select currency' : 'Pilih mata uang'}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-[var(--text)] transition hover:border-[var(--brand)]',
          compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'
        )}
      >
        <Coins className="size-3.5 text-[var(--brand)]" aria-hidden />
        <span className="font-mono">{primaryCurrency}</span>
        <ChevronDown
          className={cn(
            'size-3 opacity-70 transition-transform duration-150',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label={isEn ? 'Select currency' : 'Pilih mata uang'}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-1.5 shadow-2xl"
          >
            <div className="max-h-64 space-y-1 overflow-y-auto pr-0.5">
              {CURRENCY_LIST.map((cur) => {
                const active = cur.code === primaryCurrency;
                return (
                  <button
                    key={cur.code}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => void handleChoose(cur.code)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition',
                      active
                        ? 'bg-[var(--brand-soft)]/35 text-[var(--text)]'
                        : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex w-8 items-center justify-center rounded-md bg-[var(--surface-2)] py-0.5 font-mono text-[10px] font-bold text-[var(--brand)]">
                        {cur.sym}
                      </span>
                      <div>
                        <p className="text-[12px] font-semibold leading-tight">
                          {cur.code}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {isEn ? cur.nameEn : cur.nameId}
                        </p>
                      </div>
                    </div>
                    {active && (
                      <Check className="size-3.5 text-[var(--brand)]" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
