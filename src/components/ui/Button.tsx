'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--brand)] text-[var(--brand-contrast)] hover:bg-[var(--brand-hover)] active:brightness-95 disabled:hover:bg-[var(--brand)]',
  secondary:
    'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--line)] hover:bg-[var(--surface-3)] hover:border-[var(--line-strong)]',
  ghost: 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
  danger:
    'bg-[var(--out-soft)] text-[var(--out)] border border-[var(--out)]/30 hover:bg-[var(--out)] hover:text-white',
  subtle:
    'bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-[var(--brand-contrast)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[13px] gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[14px] gap-2 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    fullWidth = false,
    disabled,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/**
 * Tombol hanya ikon. Wajib punya `aria-label` - komponen ini memaksa
 * lewat tipe, supaya tidak ada tombol ikon tanpa nama.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: Variant;
    size?: Size;
    loading?: boolean;
  }
>(function IconButton(
  { label, className, variant = 'ghost', size = 'md', loading, children, disabled, ...props },
  ref
) {
  const iconSizes = {
    sm: 'size-8 rounded-lg',
    md: 'size-10 rounded-lg',
    lg: 'size-12 rounded-xl',
  } as const;

  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        iconSizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
});
