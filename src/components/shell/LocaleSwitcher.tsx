'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeShortLabels, locales, type Locale } from '@/i18n/routing';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { cn } from '@/lib/cn';

/** Pilih bahasa ID / EN dengan pop-up konfirmasi & pencatatan audit log. */
export function LocaleSwitcher({ compact }: { compact?: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { confirm } = useConfirm();

  const handleSelect = async (loc: Locale) => {
    if (loc === locale) return;
    const isEn = locale === 'en';
    const targetLabel = loc === 'en' ? 'English (EN)' : 'Bahasa Indonesia (ID)';
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
            onClick={() => void handleSelect(loc)}
            className={cn(
              'rounded-md px-2 py-1 font-semibold transition',
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
