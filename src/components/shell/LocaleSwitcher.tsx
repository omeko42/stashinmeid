'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeShortLabels, locales, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/** Pilih bahasa ID / EN; mempertahankan path saat ini. */
export function LocaleSwitcher({ compact }: { compact?: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      className={cn('flex gap-1', compact ? 'text-[11px]' : 'text-xs')}
      role="group"
      aria-label={t('language')}
    >
      {locales.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => router.replace(pathname, { locale: loc })}
            className={cn(
              'px-2 py-1 rounded-md font-semibold transition',
              active
                ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
            )}
            aria-pressed={active}
          >
            {localeShortLabels[loc]}
          </button>
        );
      })}
    </div>
  );
}
