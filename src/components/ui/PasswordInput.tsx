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
    /**
     * Pakai styling sendiri (bukan design system). Untuk halaman auth
     * yang punya tema visual berbeda dari aplikasi.
     */
    unstyled?: boolean;
    /** Class untuk tombol ikon mata. */
    toggleClassName?: string;
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
    unstyled = false,
    toggleClassName,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  const input = (
    <input
      ref={ref}
      id={fieldId}
      type={visible ? 'text' : 'password'}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(
        unstyled ? undefined : FIELD_BASE,
        !unstyled && 'pr-10',
        !unstyled && error && 'border-[var(--out)]',
        className
      )}
      {...props}
    />
  );

  const toggle = (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? hideLabel : showLabel}
      aria-pressed={visible}
      title={visible ? hideLabel : showLabel}
      className={cn(
        'absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
        unstyled
          ? 'text-slate-500 hover:text-slate-300'
          : 'text-[var(--text-faint)] hover:bg-[var(--surface-3)] hover:text-[var(--text-muted)]',
        toggleClassName
      )}
    >
      {visible ? (
        <EyeOff className="size-4" aria-hidden />
      ) : (
        <Eye className="size-4" aria-hidden />
      )}
    </button>
  );

  // Mode unstyled: caller sudah pegang label dan layout-nya sendiri.
  if (unstyled) {
    return (
      <div className="relative">
        {input}
        {toggle}
      </div>
    );
  }

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <div className="relative">
        {input}
        {toggle}
      </div>
    </FieldShell>
  );
});
