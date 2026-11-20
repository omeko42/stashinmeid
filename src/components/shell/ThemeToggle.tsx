'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/ui/Button';

/** Putar tema terang / gelap / ikuti sistem. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('common.theme');
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycle = () => {
    const order = ['light', 'dark', 'system'] as const;
    const current = (theme ?? 'system') as (typeof order)[number];
    const idx = order.indexOf(current);
    setTheme(order[(idx + 1) % order.length]);
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
    <IconButton type="button" label={t('toggle')} onClick={cycle} className={className}>
      {icon}
    </IconButton>
  );
}
