'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { IconButton } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmProvider';

/** Putar tema terang / gelap / ikuti sistem dengan konfirmasi & audit log. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('common.theme');
  const locale = useLocale();
  const isEn = locale === 'en';
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { confirm } = useConfirm();

  const cycle = async () => {
    const order = ['light', 'dark', 'system'] as const;
    const current = (theme ?? 'system') as (typeof order)[number];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    const labelMap = isEn
      ? { light: 'Light', dark: 'Dark', system: 'System' }
      : { light: 'Terang', dark: 'Gelap', system: 'Ikuti Sistem' };

    const ok = await confirm({
      title: isEn ? 'Change Theme?' : 'Ganti Tema?',
      description: isEn
        ? `Switch appearance theme to ${labelMap[next]}?`
        : `Apakah Anda yakin mengganti tema tampilan ke ${labelMap[next]}?`,
      confirmLabel: isEn ? 'Yes, Change' : 'Ya, Ganti',
      cancelLabel: isEn ? 'Cancel' : 'Batal',
      audit: {
        action: 'Ganti Tema',
        category: 'settings',
        detail: `Tema diubah dari ${current} ke ${next}`,
      },
    });
    if (!ok) return;
    setTheme(next);
  };

  const icon =
    theme === 'system' ? (
      <Monitor className="size-4" />
    ) : resolvedTheme === 'light' ? (
      <Sun className="size-4" />
    ) : (
      <Moon className="size-4" />
    );

  return (
    <IconButton
      type="button"
      label={t('toggle')}
      onClick={() => void cycle()}
      className={className}
    >
      {icon}
    </IconButton>
  );
}
