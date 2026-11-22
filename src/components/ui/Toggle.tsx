'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Saklar on/off.
 *
 * Memakai `role="switch"` supaya pembaca screen reader-announcer "on" dan
 * "off", bukan sekadar "checked". Label dikaitkan lewat `aria-labelledby`
 * supaya diklik lewat teksnya juga menyalakan saklar.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  id,
}: ToggleProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const descId = description ? `${switchId}-desc` : undefined;

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label
              htmlFor={switchId}
              className={cn(
                'block text-[13px] font-medium',
                disabled ? 'text-[var(--text-faint)]' : 'text-[var(--text)]',
                'cursor-pointer'
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p id={descId} className="mt-0.5 text-[12px] text-[var(--text-faint)]">
              {description}
            </p>
          )}
        </div>
      )}

      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
          checked ? 'bg-[var(--brand)]' : 'bg-[var(--surface-3)]',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Kotak centang.
 *
 * Dipakai untuk pilihan banyak (mis. preferensi notifikasi). Kalau hanya
 * satu pilihan, pakai `Toggle` - lebih mudah dibaca.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  id,
}: CheckboxProps) {
  const generatedId = useId();
  const boxId = id ?? generatedId;
  const descId = description ? `${boxId}-desc` : undefined;

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={boxId}
        name={boxId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={descId}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'mt-0.5 size-4 shrink-0 cursor-pointer rounded border-[var(--line-strong)] bg-[var(--surface-2)] accent-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      />
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label
              htmlFor={boxId}
              className={cn(
                'block text-[13px]',
                disabled ? 'text-[var(--text-faint)]' : 'text-[var(--text)]',
                'cursor-pointer'
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p id={descId} className="mt-0.5 text-[12px] text-[var(--text-faint)]">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
