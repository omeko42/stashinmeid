'use client';

import { BrandLogo } from '@/components/BrandLogo';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

/**
 * Animasi loading khas stashinmeid:
 * Logo berdenyut halus + 3 titik ritmis (• • •) + opsional baris skeleton shimmer.
 */
export function BrandLoader({
  label,
  size = 'md',
  showSkeleton = false,
  skeletonRows = 3,
  className,
}: {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showSkeleton?: boolean;
  skeletonRows?: number;
  className?: string;
}) {
  const logoSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center',
        size === 'sm' ? 'py-5' : size === 'lg' ? 'py-14' : 'py-9',
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        <span
          aria-hidden
          className="absolute -inset-2.5 animate-ping rounded-2xl bg-[var(--brand)]/15 duration-1000"
        />
        <div className="relative animate-pulse">
          <BrandLogo size={logoSize} />
        </div>
      </div>

      {/* 3 titik animasi bergantian */}
      <div className="mt-3 flex items-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-[var(--brand)]"
            style={{
              animationDelay: `${i * 150}ms`,
              animationDuration: '900ms',
            }}
          />
        ))}
      </div>

      {label && (
        <p className="mt-2 text-[11px] font-medium text-[var(--text-muted)]">
          {label}
        </p>
      )}

      {showSkeleton && (
        <div className="mt-5 w-full">
          <SkeletonRows rows={skeletonRows} />
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton kartu pengaturan / panel selagi data API dimuat.
 */
export function PanelSkeleton({
  label,
  rows = 3,
  cards = 0,
}: {
  label?: string;
  rows?: number;
  cards?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
      <BrandLoader size="sm" label={label} />
      {cards > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, idx) => (
            <div
              key={idx}
              className="space-y-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 p-3.5"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      )}
      {rows > 0 && (
        <div className="mt-2">
          <SkeletonRows rows={rows} />
        </div>
      )}
    </div>
  );
}
