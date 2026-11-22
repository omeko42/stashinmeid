'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { CurrencySwitcher } from './CurrencySwitcher';
import { LocaleSwitcher } from './LocaleSwitcher';
import { cn } from '@/lib/cn';

const emptySubscribe = () => () => {};

/**
 * Menu Pengaturan terpadu untuk halaman publik (Landing Page & halaman Legal):
 * mengelompokkan Tema (Terang/Gelap/Sistem), Mata Uang, dan Bahasa dalam satu
 * dropdown popover agar header tetap bersih dan semua preferensi selalu sinkron.
 */
export function PublicSettingsMenu({ className }: { className?: string }) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
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

  const currentTheme = mounted ? (theme ?? 'dark') : 'dark';

  const themeOptions = [
    {
      value: 'light' as const,
      label: isEn ? 'Light' : 'Terang',
      Icon: Sun,
    },
    {
      value: 'dark' as const,
      label: isEn ? 'Dark' : 'Gelap',
      Icon: Moon,
    },
    {
      value: 'system' as const,
      label: isEn ? 'System' : 'Sistem',
      Icon: Monitor,
    },
  ];

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={isEn ? 'Display Settings' : 'Pengaturan Tampilan'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text)] transition hover:border-[var(--brand)]"
      >
        <Settings className="size-3.5 text-[var(--brand)]" aria-hidden />
        <span className="hidden sm:inline">
          {isEn ? 'Settings' : 'Pengaturan'}
        </span>
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
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            role="dialog"
            aria-label={isEn ? 'Display Settings' : 'Pengaturan Tampilan'}
            className="absolute right-0 z-50 mt-2 w-[276px] rounded-2xl border border-[var(--line)] bg-[var(--surface-1)] p-3.5 text-[var(--text)] shadow-[var(--shadow-lg)]"
          >
            <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-2.5">
              <span className="text-[12px] font-semibold text-[var(--text)]">
                {isEn ? 'Display Settings' : 'Pengaturan Tampilan'}
              </span>
              <span className="text-[10.5px] text-[var(--text-muted)]">
                {isEn ? 'Synced' : 'Tersinkron'}
              </span>
            </div>

            <div className="space-y-3.5">
              {/* 1. Tema */}
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  {isEn ? 'Theme' : 'Tema'}
                </p>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-1">
                  {themeOptions.map(({ value, label, Icon }) => {
                    const active = currentTheme === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTheme(value)}
                        className={cn(
                          'inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition',
                          active
                            ? 'bg-[var(--brand)] text-[var(--brand-contrast)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Mata Uang */}
              <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
                <div>
                  <p className="text-[12px] font-medium text-[var(--text)]">
                    {isEn ? 'Currency' : 'Mata Uang'}
                  </p>
                  <p className="text-[10.5px] text-[var(--text-muted)]">
                    {isEn ? 'Primary display' : 'Tampilan utama'}
                  </p>
                </div>
                <CurrencySwitcher compact />
              </div>

              {/* 3. Bahasa */}
              <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
                <div>
                  <p className="text-[12px] font-medium text-[var(--text)]">
                    {isEn ? 'Language' : 'Bahasa'}
                  </p>
                  <p className="text-[10.5px] text-[var(--text-muted)]">
                    {isEn ? 'Interface language' : 'Bahasa aplikasi'}
                  </p>
                </div>
                <LocaleSwitcher compact />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
