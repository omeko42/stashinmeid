'use client';

import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Debt } from '@/types/finance';
import { formatRp } from '@/lib/format';

/**
 * Palet kontras tinggi untuk komposisi pinjaman (terbaca jelas di mode gelap & terang).
 * Urutan dipasangkan setelah data diurutkan dari sisa pinjaman terbesar ke terkecil,
 * supaya porsi terbesar selalu mendapat warna paling tegas (tidak abu-abu pudar).
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

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: { percent?: number; color?: string };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const pct = entry?.payload?.percent ?? 0;
  const color = entry?.payload?.color ?? '#22c58b';
  return (
    <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface-1)]/95 px-3 py-2 shadow-[var(--shadow-md)] backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <p className="text-[11px] font-semibold text-[var(--text)]">{entry?.name}</p>
      </div>
      <p className="tnum mt-0.5 text-[12px] font-bold text-[var(--text)]">
        {formatRp(Number(entry?.value ?? 0))}{' '}
        <span className="font-medium text-[var(--text-muted)]">({pct}%)</span>
      </p>
    </div>
  );
}

/**
 * Donut komposisi sisa pinjaman dengan ringkasan pusat & legenda warna ringkas.
 */
export function DebtDonut({ debts }: { debts: Debt[] }) {
  const data = useMemo(() => {
    const active = debts
      .filter((d) => d.status === 'active' && Number(d.remaining_balance) > 0)
      .sort((a, b) => Number(b.remaining_balance) - Number(a.remaining_balance));
    const total = active.reduce((s, d) => s + Number(d.remaining_balance), 0);

    return active.map((d, idx) => ({
      name: d.platform,
      value: Number(d.remaining_balance),
      percent: total > 0 ? Math.round((Number(d.remaining_balance) / total) * 100) : 0,
      color: SLICE_COLORS[idx % SLICE_COLORS.length],
    }));
  }, [debts]);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-[12px] text-[var(--text-muted)]">
        Semua pinjaman sudah lunas.
      </div>
    );
  }

  const dominant = data[0];

  return (
    <div className="space-y-3">
      <div className="relative h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2.5}
              cornerRadius={4}
              dataKey="value"
              nameKey="name"
              stroke="none"
              isAnimationActive
              animationDuration={650}
              animationEasing="ease-out"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Label pusat donut: langsung terbaca tanpa hover */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="tnum text-[18px] font-bold leading-none text-[var(--text)]">
            {dominant.percent}%
          </span>
          <span className="mt-1 max-w-[92px] truncate text-[10px] font-medium text-[var(--text-muted)]">
            {dominant.name}
          </span>
        </div>
      </div>

      {/* Legenda ringkas multi-kolom agar semua pinjaman langsung jelas */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {data.slice(0, 6).map((entry) => (
          <div
            key={entry.name}
            title={`${entry.name} · ${formatRp(entry.value)} (${entry.percent}%)`}
            className="flex min-w-0 items-center justify-between gap-1.5 text-[11px]"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              <span className="truncate text-[var(--text-muted)]">{entry.name}</span>
            </span>
            <span className="tnum shrink-0 font-semibold text-[var(--text)]">
              {entry.percent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
