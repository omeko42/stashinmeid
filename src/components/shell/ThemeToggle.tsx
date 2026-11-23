'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { IconButton } from '@/components/ui/Button';

type ThemeOption = 'light' | 'dark' | 'system';

/**
 * Pengalih tema terang / gelap / ikuti sistem (1-klik langsung tanpa pop-up konfirmasi).
 * - `variant="segmented"`: menampilkan ketiga tombol sekaligus (Terang · Gelap · Sistem).
 * - `variant="icon"` (default): tombol ikon ringkas untuk menu kecil.
 */
export function ThemeToggle({
  className,
  variant = 'icon',
}: {
  className?: string;
  variant?: 'icon' | 'segmented';
}) {
  const t = useTranslations('common.theme');
  const locale = useLocale();
  const isEn = locale === 'en';
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = ((mounted ? theme : 'system') ?? 'system') as ThemeOption;

  if (variant === 'segmented') {
    const options: { id: ThemeOption; label: string; icon: React.ReactNode }[] = [
      {
        id: 'light',
        label: isEn ? 'Light' : 'Terang',
        icon: <Sun className="size-3.5" aria-hidden />,
      },
      {
        id: 'dark',
        label: isEn ? 'Dark' : 'Gelap',
        icon: <Moon className="size-3.5" aria-hidden />,
      },
      {
        id: 'system',
        label: isEn ? 'System' : 'Sistem',
        icon: <Monitor className="size-3.5" aria-hidden />,
      },
    ];

    return (
      <div
        role="radiogroup"
        aria-label={t('toggle')}
        className={`inline-flex h-9 items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5 ${className ?? ''}`}
      >
        {options.map((opt) => {
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(opt.id)}
              className={`inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[var(--surface-1)] text-[var(--text)] shadow-xs ring-1 ring-[var(--line)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const cycle = () => {
    const order: readonly ThemeOption[] = ['light', 'dark', 'system'];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    setTheme(next);
  };

  const icon =
    current === 'system' ? (
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
      onClick={cycle}
      className={className}
    >
      {icon}
    </IconButton>
  );
}
