'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  localeLabels,
  localeShortLabels,
  locales,
  type Locale,
} from '@/i18n/routing';
import { Modal } from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { cn } from '@/lib/cn';

/**
 * Pemilih bahasa berbasis Pop-up Modal (skalabel jika kontributor menambah bahasa lain)
 * lengkap dengan konfirmasi pop-up & pencatatan audit log.
 */
export function LocaleSwitcher({ compact }: { compact?: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);

  const isEn = locale === 'en';

  const handleSelect = async (loc: Locale) => {
    setOpen(false);
    if (loc === locale) return;
    const targetLabel = `${localeLabels[loc]} (${localeShortLabels[loc]})`;
    const ok = await confirm({
      title: isEn ? 'Change Language?' : 'Ganti Bahasa?',
      description: isEn
        ? `Are you sure you want to switch language to ${targetLabel}?`
        : `Apakah Anda yakin mengganti bahasa ke ${targetLabel}?`,
      confirmLabel: isEn ? 'Yes, Switch' : 'Ya, Ganti',
      cancelLabel: isEn ? 'Cancel' : 'Batal',
      audit: {
        action: 'Ganti Bahasa',
        category: 'settings',
        detail: `Mengganti bahasa dari ${locale.toUpperCase()} ke ${loc.toUpperCase()}`,
      },
    });
    if (!ok) return;
    router.replace(pathname, { locale: loc });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('language')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-[var(--text)] transition hover:border-[var(--brand)]',
          compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'
        )}
      >
        <Globe className="size-3.5 text-[var(--brand)]" aria-hidden />
        <span>{localeShortLabels[locale]}</span>
        <ChevronDown className="size-3 opacity-70" aria-hidden />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isEn ? 'Choose Language' : 'Pilih Bahasa'}
        description={
          isEn
            ? 'Select your preferred display language.'
            : 'Pilih bahasa tampilan aplikasi.'
        }
        size="sm"
      >
        <div className="space-y-1.5">
          {locales.map((loc) => {
            const active = loc === locale;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => void handleSelect(loc)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition',
                  active
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)]/30 text-[var(--text)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)]/70 text-[var(--text)] hover:border-[var(--line-strong)]'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[var(--surface-1)] font-mono text-[11px] font-bold text-[var(--brand)]">
                    {localeShortLabels[loc]}
                  </span>
                  <span className="text-[13px] font-semibold">
                    {localeLabels[loc]}
                  </span>
                </div>
                {active && (
                  <Check className="size-4 text-[var(--brand)]" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-4 border-t border-[var(--line)] pt-3 text-center text-[11px] text-[var(--text-muted)]">
          {isEn ? 'Want to add another language?' : 'Ingin bantu tambah bahasa lain?'}{' '}
          <a
            href="https://github.com/omeko42/stashinmeid"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            Contribute on GitHub
          </a>
        </p>
      </Modal>
    </>
  );
}
