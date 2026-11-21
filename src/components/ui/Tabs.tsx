'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Penanda Attention - misalnya ada notifikasi belum dibaca. */
  badge?: number | string;
  /** Tandai sebagai area berisiko (mis. zona berbahaya). */
  danger?: boolean;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Tampilan mendatar (default) atau vertikal. */
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  ariaLabel?: string;
}

/**
 * Sub-menu pengaturan.
 *
 * Bedanya dengan `Segmented`: `Segmented` untuk pilihan yang setara (mis.
 * ganti periode chart), `Tabs` untuk navigasi antar bagian (mis. Data,
 * Keamanan, Notifikasi). Tab punya state navigasi, bukan nilai filter.
 *
 * Panah kiri/kanan memindah tab sesuai pola ARIA, jadi bisa dinavigasi
 * dengan keyboard.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  orientation = 'horizontal',
  className,
  ariaLabel,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = items.findIndex((i) => i.value === value);
    if (index === -1) return;

    let next = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;

    e.preventDefault();
    onChange(items[next].value);
    // Fokus pindah ke tab yang baru aktif supaya keyboard user tidak
    // kehilangan posisi.
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="flex flex-col gap-1"
        >
          {items.map((item) => {
            const active = item.value === value;
            return (
              <button
                key={item.value}
                role="tab"
                type="button"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(item.value)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                  active
                    ? item.danger
                      ? 'bg-[var(--out)]/10 text-[var(--out)]'
                      : 'bg-[var(--surface-2)] text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text)]'
                )}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && item.badge !== 0 && (
                  <span className="shrink-0 rounded-full bg-[var(--brand)] px-1.5 py-px text-[10px] font-semibold text-[var(--brand-contrast)]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-[var(--line)]',
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
              active
                ? item.danger
                  ? 'text-[var(--out)]'
                  : 'text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            )}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            {item.label}
            {item.badge !== undefined && item.badge !== 0 && (
              <span className="rounded-full bg-[var(--brand)] px-1.5 py-px text-[10px] font-semibold text-[var(--brand-contrast)]">
                {item.badge}
              </span>
            )}
            {active && (
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 -bottom-px h-0.5 rounded-full',
                  item.danger ? 'bg-[var(--out)]' : 'bg-[var(--brand)]'
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
