'use client';

import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FieldShell, FIELD_BASE } from './Field';

/**
 * Input password dengan ikon mata untuk lihat/sembunyikan.
 *
 * Tombolnya memakai `type="button"` supaya tidak triggering submit form, dan
 * `aria-label` berubah mengikuti status supaya pembaca screen reader tahu
 * aksi apa yang terjadi kalau diklik.
 *
 * Nilai `type` tetap `password` walau sedang terlihat - kalau diubah ke
 * `type="text"`, password bisa bocor lewat autocomplete atau password
 * manager di browser.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    hint?: string;
    error?: string;
    /** Label tombol saat password terlihat. */
    hideLabel?: string;
    /** Label tombol saat password tersembunyi. */
    showLabel?: string;
  }
>(function PasswordInput(
  {
    label,
    hint,
    error,
    required,
    className,
    id,
    hideLabel = 'Sembunyikan password',
    showLabel = 'Lihat password',
    ...props
  },
  ref
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type="password"
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            FIELD_BASE,
            'pr-10',
            error && 'border-[var(--out)]',
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          title={visible ? hideLabel : showLabel}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </FieldShell>
  );
});
