'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Transaction } from '@/types/finance';
import { appNow, formatRp, formatShortRp, parseIsoDate } from '@/lib/format';

export type ChartPeriod = 'week' | 'month' | 'year';

export interface ChartPoint {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
}

/**
 * Kelompokkan transaksi ke dalam bucket waktu sesuai periode.
 *
 * Tanpa ini semua tanggal ditumpuk jadi satu sumbu X dan grafiknya
 * mustahil dibaca.
 */
export function bucketTransactions(
  transactions: Transaction[],
  period: ChartPeriod,
  now = appNow()
): ChartPoint[] {
  const buckets = new Map<string, ChartPoint>();

  const keyFor = (date: Date): { key: string; label: string } => {
    if (period === 'week') {
      // Tujuh hari terakhir, satu titik per hari.
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return {
        key: `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
        label: `${day.getDate()}/${day.getMonth() + 1}`,
      };
    }
    if (period === 'month') {
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(date),
      };
    }
    return {
      key: `${date.getFullYear()}`,
      label: String(date.getFullYear()),
    };
  };

  for (const tx of transactions) {
    const date = parseIsoDate(tx.transaction_date);
    if (!date) continue;

    const { key, label } = keyFor(date);
    const bucket = buckets.get(key) ?? { key, label, inflow: 0, outflow: 0 };
    if (tx.type === 'inflow') bucket.inflow += Number(tx.amount);
    else bucket.outflow += Number(tx.amount);
    buckets.set(key, bucket);
  }

  const points = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));

  // Untuk 'week' dan 'month' kita lengkapi titik yang kosong supaya sumbu X
  // tetap berjarak sama - sumbu kategori akan membuat titik meloncat-loncat.
  if (period === 'week' || period === 'month') {
    return fillGaps(points, period, now);
  }
  return points;
}

function fillGaps(points: ChartPoint[], period: ChartPeriod, now: Date): ChartPoint[] {
  const filled: ChartPoint[] = [];
  const byKey = new Map(points.map((p) => [p.key, p]));

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      filled.push(
        byKey.get(key) ?? {
          key,
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          inflow: 0,
          outflow: 0,
        }
      );
    }
    return filled;
  }

  // month: 12 bulan terakhir
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    filled.push(
      byKey.get(key) ?? {
        key,
        label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(d),
        inflow: 0,
        outflow: 0,
      }
    );
  }
  return filled;
}

/**
 * Tooltip yang mengikuti tema aplikasi.
 * Warna diambil dari CSS variable, bukan hex, supaya ikut berubah saat tema diganti.
 */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const inflow = payload.find((p) => p.dataKey === 'inflow')?.value ?? 0;
  const outflow = payload.find((p) => p.dataKey === 'outflow')?.value ?? 0;
  const net = inflow - outflow;

  return (
    <div className="min-w-[168px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)]/95 px-3 py-2.5 shadow-[var(--shadow-md)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
      <div className="mt-1.5 space-y-1 text-[12px]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <span className="size-2 rounded-full bg-[var(--brand)]" aria-hidden />
            Masuk
          </span>
          <span className="tnum font-semibold text-[var(--brand)]">{formatRp(inflow)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <span className="size-2 rounded-full bg-[var(--out)]" aria-hidden />
            Keluar
          </span>
          <span className="tnum font-semibold text-[var(--out)]">{formatRp(outflow)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Selisih</span>
          <span
            className={`tnum font-semibold ${
              net >= 0 ? 'text-[var(--brand)]' : 'text-[var(--out)]'
            }`}
          >
            {net >= 0 ? '+' : ''}
            {formatRp(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Grafik tren masuk dan keluar.
 *
 * Warnanya lewat CSS variable supaya mengikuti tema terang/gelap, dan area
 * warnanya memakai gradient yang diredupkan supaya tidak mendominasi.
 */
export function CashflowChart({
  transactions,
  period,
}: {
  transactions: Transaction[];
  period: ChartPeriod;
}) {
  const data = useMemo(
    () => bucketTransactions(transactions, period),
    [transactions, period]
  );

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-[12px] text-[var(--text-muted)]">
        Belum ada transaksi untuk digrafikkan.
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="smInflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.32} />
              <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="smOutflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--out)" stopOpacity={0.26} />
              <stop offset="95%" stopColor="var(--out)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--line)"
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="var(--text-faint)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--text-faint)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatShortRp(Number(v))}
            width={58}
            domain={[0, (max: number) => (max > 0 ? max * 1.15 : 100)]}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Area
            type="monotone"
            dataKey="inflow"
            name="Masuk"
            stroke="var(--brand)"
            strokeWidth={2.25}
            fill="url(#smInflowGrad)"
            fillOpacity={1}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface-1)', fill: 'var(--brand)' }}
            animationDuration={600}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="outflow"
            name="Keluar"
            stroke="var(--out)"
            strokeWidth={2.25}
            fill="url(#smOutflowGrad)"
            fillOpacity={1}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface-1)', fill: 'var(--out)' }}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Sparkline - jejak saldo berjalan untuk hero.
 * Tanpa sumbu, tanpa tooltip: ini dekorasi yang informatif, bukan chart utama.
 */
export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const width = 100;
  const height = 28;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / span) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-7 w-full overflow-visible"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
