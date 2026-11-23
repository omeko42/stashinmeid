'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { Debt } from '@/types/finance';
import { formatRp, formatShortRp } from '@/lib/format';
import { maskAmount, useBalancePrivacy } from '@/components/ui/BalancePrivacy';
import { cn } from '@/lib/cn';

/**
 * Palet kontras tinggi untuk komposisi pinjaman (terbaca jelas di mode gelap & terang).
 * Urutan dipasangkan setelah data diurutkan dari sisa pinjaman terbesar ke terkecil,
 * supaya porsi terbesar selalu mendapat warna paling tegas.
 */
const SLICE_COLORS = [
  '#22c58b', // emerald (dominan)
  '#f59e0b', // amber
  '#3b82f6', // sky blue
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#ec4899', // pink
  '#84cc16', // lime
];

/**
 * Donut komposisi sisa pinjaman interaktif:
 * - Hover pada slice donut ATAU baris legenda saling sinkron (slice aktif menonjol,
 *   lainnya meredup halus).
 * - Pusat donut menampilkan persentase, nama platform, dan nominal secara dinamis
 *   dengan transisi halus — tanpa tooltip mengambang yang bertabrakan dengan teks pusat.
 */
export function DebtDonut({
  debts,
  onSelectDebt,
}: {
  debts: Debt[];
  onSelectDebt?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { hidden, ready } = useBalancePrivacy();
  const masked = ready && hidden;

  const data = useMemo(() => {
    const active = debts
      .filter((d) => d.status === 'active' && Number(d.remaining_balance) > 0)
      .sort((a, b) => Number(b.remaining_balance) - Number(a.remaining_balance));
    const total = active.reduce((s, d) => s + Number(d.remaining_balance), 0);

    return active.map((d, idx) => {
      const val = Number(d.remaining_balance);
      return {
        id: d.id,
        name: d.platform,
        value: val,
        percent: total > 0 ? Math.round((val / total) * 100) : 0,
        exactPercent: total > 0 ? (val / total) * 100 : 0,
        color: SLICE_COLORS[idx % SLICE_COLORS.length],
      };
    });
  }, [debts]);

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-[12px] text-[var(--text-muted)]">
        Semua pinjaman sudah lunas.
      </div>
    );
  }

  const focusedIdx =
    activeIndex !== null && activeIndex < data.length ? activeIndex : 0;
  const focused = data[focusedIdx];
  const isHovering = activeIndex !== null;

  const visibleLegend = data.slice(0, 6);
  const hiddenCount = Math.max(0, data.length - visibleLegend.length);

  return (
    <div className="space-y-3.5">
      {/* Donut Interaktif + Ringkasan Pusat Dinamis (bebas tabrakan) */}
      <div
        className="relative mx-auto h-44 w-full max-w-[240px]"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={78}
              paddingAngle={2.5}
              cornerRadius={5}
              dataKey="value"
              nameKey="name"
              stroke="none"
              isAnimationActive
              animationDuration={620}
              animationEasing="ease-out"
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onClick={() => onSelectDebt?.()}
            >
              {data.map((entry, idx) => {
                const isFocused = activeIndex === idx;
                const isDimmed = activeIndex !== null && activeIndex !== idx;
                return (
                  <Cell
                    key={entry.id}
                    fill={entry.color}
                    fillOpacity={isDimmed ? 0.28 : 1}
                    stroke={isFocused ? entry.color : 'transparent'}
                    strokeWidth={isFocused ? 3 : 0}
                    style={{
                      cursor: onSelectDebt ? 'pointer' : 'default',
                      transition:
                        'fill-opacity 180ms ease, stroke-width 180ms ease, filter 180ms ease',
                      filter: isFocused
                        ? `drop-shadow(0 0 8px ${entry.color}55)`
                        : 'none',
                    }}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Pusat Donut Dinamis: selalu jernih, merespons hover slice & legenda */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={focused.id}
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full transition-transform duration-200"
                  style={{
                    backgroundColor: focused.color,
                    transform: isHovering ? 'scale(1.25)' : 'scale(1)',
                  }}
                  aria-hidden
                />
                <span className="tnum text-[20px] font-bold leading-none text-[var(--text)]">
                  {focused.percent}%
                </span>
              </div>
              <span className="mt-1 max-w-[100px] truncate text-[10px] font-medium text-[var(--text-muted)]">
                {focused.name}
              </span>
              <span className="tnum mt-0.5 text-[10px] font-semibold text-[var(--text-faint)]">
                {masked ? maskAmount(formatShortRp(focused.value)) : formatShortRp(focused.value)}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Legenda 1-Kolom Interaktif dengan Bar Proporsi Halus */}
      <div className="space-y-1">
        {visibleLegend.map((entry, idx) => {
          const isActive = activeIndex === idx;
          const isDimmed = activeIndex !== null && activeIndex !== idx;
          const rpText = masked
            ? maskAmount(formatRp(entry.value))
            : formatRp(entry.value);

          return (
            <button
              key={entry.id}
              type="button"
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(idx)}
              onBlur={() => setActiveIndex(null)}
              onClick={() => onSelectDebt?.()}
              title={`${entry.name} · ${rpText} (${entry.percent}%)`}
              className={cn(
                'group relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-left text-[11px] transition-all duration-150',
                isActive
                  ? 'bg-[var(--surface-2)] ring-1 ring-[var(--line-strong)]'
                  : 'hover:bg-[var(--surface-2)]/70',
                isDimmed && 'opacity-55'
              )}
            >
              {/* Latar bar proporsi tipis yang meluncur halus */}
              <motion.span
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.max(0.02, entry.exactPercent / 100) }}
                transition={{
                  duration: 0.55,
                  delay: idx * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  backgroundColor: entry.color,
                  transformOrigin: 'left center',
                }}
                className="pointer-events-none absolute inset-y-0 left-0 w-full opacity-[0.07] transition-opacity duration-150 group-hover:opacity-[0.14]"
              />

              <span className="relative flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full transition-transform duration-150',
                    isActive && 'scale-125'
                  )}
                  style={{ backgroundColor: entry.color }}
                  aria-hidden
                />
                <span
                  className={cn(
                    'truncate transition-colors',
                    isActive
                      ? 'font-semibold text-[var(--text)]'
                      : 'text-[var(--text-muted)] group-hover:text-[var(--text)]'
                  )}
                >
                  {entry.name}
                </span>
              </span>

              <span className="relative flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'tnum hidden text-[10px] transition-opacity sm:inline',
                    isActive
                      ? 'font-medium text-[var(--text)] opacity-100'
                      : 'text-[var(--text-faint)] opacity-80'
                  )}
                >
                  {masked
                    ? maskAmount(formatShortRp(entry.value))
                    : formatShortRp(entry.value)}
                </span>
                <span className="tnum w-8 text-right font-semibold text-[var(--text)]">
                  {entry.percent}%
                </span>
              </span>
            </button>
          );
        })}

        {hiddenCount > 0 && (
          <p className="px-2 pt-0.5 text-[10px] text-[var(--text-faint)]">
            +{hiddenCount} pinjaman lainnya
          </p>
        )}
      </div>
    </div>
  );
}
