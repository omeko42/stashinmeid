'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  localeLabels,
  localeShortLabels,
  locales,
  type Locale,
} from '@/i18n/routing';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { cn } from '@/lib/cn';

/**
 * Pemilih bahasa berbasis anchored popover dropdown (muncul tepat di bawah tombol)
 * agar skalabel jika kontributor menambah bahasa lain, lengkap dengan konfirmasi
 * pop-up & pencatatan audit log.
 */
export function LocaleSwitcher({ compact }: { compact?: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isEn = locale === 'en';

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
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] font-semibold text-[var(--text)] transition hover:border-[var(--brand)]',
          compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]'
        )}
      >
        <Globe className="size-3.5 text-[var(--brand)]" aria-hidden />
        <span>{localeShortLabels[locale]}</span>
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
            aria-label={t('language')}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-1.5 shadow-2xl"
          >
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {locales.map((loc) => {
                const active = loc === locale;
                return (
                  <button
                    key={loc}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => void handleSelect(loc)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition',
                      active
                        ? 'bg-[var(--brand-soft)]/35 text-[var(--text)]'
                        : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--surface-2)] font-mono text-[10px] font-bold text-[var(--brand)]">
                        {localeShortLabels[loc]}
                      </span>
                      <span className="text-[12px] font-semibold">
                        {localeLabels[loc]}
                      </span>
                    </div>
                    {active && (
                      <Check className="size-3.5 text-[var(--brand)]" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-1.5 border-t border-[var(--line)] px-2 pb-1 pt-2 text-center text-[10px] text-[var(--text-muted)]">
              <a
                href="https://github.com/omeko42/stashinmeid"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--brand)] hover:underline"
              >
                {isEn ? '+ Contribute a language' : '+ Tambah bahasa via GitHub'}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
