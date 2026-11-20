'use client';

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const FIELD_BASE =
  'w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] transition-colors hover:border-[var(--line-strong)] focus:border-[var(--brand)] focus:outline-none disabled:opacity-50';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[12px] font-medium text-[var(--text-muted)]">
          {label}
          {required && <span className="ml-0.5 text-[var(--out)]">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[12px] text-[var(--out)]">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-[var(--text-faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }
>(function Input({ label, hint, error, required, className, id, ...props }, ref) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_BASE, error && 'border-[var(--out)]', className)}
        {...props}
      />
    </FieldShell>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string; error?: string }
>(function Textarea({ label, hint, error, required, className, id, ...props }, ref) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_BASE, 'resize-none', error && 'border-[var(--out)]', className)}
        {...props}
      />
    </FieldShell>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string; error?: string }
>(function Select({ label, hint, error, required, className, id, children, ...props }, ref) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={fieldId}
    >
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_BASE, 'cursor-pointer', error && 'border-[var(--out)]', className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});
