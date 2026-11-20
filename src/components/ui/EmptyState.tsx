import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Empty state.
 *
 * Prinsipnya: layar kosong adalah ajakan, bukan pesan error.
 * Setiap empty state punya judul, penjelasan singkat, dan aksi utama.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {icon && (
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--text-faint)]">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-[14px] font-semibold text-[var(--text)]">{title}</p>
        {description && (
          <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
