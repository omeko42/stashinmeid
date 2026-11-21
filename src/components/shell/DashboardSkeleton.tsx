import { cn } from '@/lib/cn';

/**
 * Skeleton dashboard.
 *
 * Dipakai selagi data dimuat, supaya layout tidak melompat dari layar kosong
 * ke isi penuh. Strukturnya sengaja mengikuti dashboard sungguhan: pita saldo
 * di atas, lalu dua panel.
 */
export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-5', className)}>
      <div className="border-b border-[var(--line)] pb-5">
        <div className="h-3 w-16 animate-pulse rounded-md bg-[var(--surface-2)]" />
        <div className="mt-2.5 h-10 w-56 animate-pulse rounded-md bg-[var(--surface-2)]" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded-md bg-[var(--surface-2)]" />
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-3 w-14 animate-pulse rounded-md bg-[var(--surface-2)]" />
            <div className="h-5 w-28 animate-pulse rounded-md bg-[var(--surface-2)]" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-14 animate-pulse rounded-md bg-[var(--surface-2)]" />
            <div className="h-5 w-28 animate-pulse rounded-md bg-[var(--surface-2)]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4 lg:col-span-2">
          <div className="h-4 w-32 animate-pulse rounded-md bg-[var(--surface-2)]" />
          <div className="mt-4 h-56 w-full animate-pulse rounded-md bg-[var(--surface-2)]" />
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <div className="h-4 w-28 animate-pulse rounded-md bg-[var(--surface-2)]" />
          <div className="mt-4 h-40 w-full animate-pulse rounded-md bg-[var(--surface-2)]" />
        </div>
      </div>
    </div>
  );
}
