'use client';

import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Debt } from '@/types/finance';
import { formatRp } from '@/lib/format';

/**
 * PaletBorrow. Warna diambil dari token tema lewat `var()`, supaya donut
 * ikut berubah saat tema diganti dan tidak ada hex liar di komponen.
 */
const SLICE_COLORS = [
  'var(--brand)',
  'var(--due)',
  'var(--info)',
  'var(--out)',
  'var(--text-faint)',
  'var(--line-strong)',
];

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2 shadow-[var(--shadow-md)]">
      <p className="text-[11px] font-semibold text-[var(--text-muted)]">{entry?.name}</p>
      <p className="tnum text-[12px] font-semibold text-[var(--text)]">
        {formatRp(Number(entry?.value ?? 0))}
      </p>
    </div>
  );
}

/**
 * Donut komposisi sisa pinjaman.
 *
 * Persentase ditulis sebagai label di dalam slice supaya angkanya terbaca
 * tanpa harus hover - itu informasi inti, bukan tambahan.
 */
export function DebtDonut({ debts }: { debts: Debt[] }) {
  const data = useMemo(() => {
    const active = debts.filter((d) => d.status === 'active' && Number(d.remaining_balance) > 0);
    const total = active.reduce((s, d) => s + Number(d.remaining_balance), 0);

    return active.map((d) => ({
      name: d.platform,
      value: Number(d.remaining_balance),
      percent: total > 0 ? Math.round((Number(d.remaining_balance) / total) * 100) : 0,
    }));
  }, [debts]);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-[12px] text-[var(--text-muted)]">
        Semua pinjaman sudah lunas.
      </div>
    );
  }

  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            stroke="none"
            label={({ percent }: { percent?: number }) =>
              percent !== undefined && percent >= 8 ? `${Math.round(percent)}%` : ''
            }
            labelLine={false}
          >
            {data.map((entry, idx) => (
              <Cell key={entry.name} fill={SLICE_COLORS[idx % SLICE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
