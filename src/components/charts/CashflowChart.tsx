'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Transaction } from '@/types/finance';
import { appNow, formatRp, formatShortRp, parseIsoDate } from '@/lib/format';
import {
  type PeriodFilterState,
  resolvePeriodRange,
} from '@/lib/periodFilter';

export interface ChartPoint {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/**
 * Kelompokkan transaksi yang sudah tersaring ke dalam bucket waktu otomatis
 * sesuai periode filter (Hari, Minggu, Bulan, YTD, Tahun, Semua, Custom).
 */
export function bucketTransactionsByFilter(
  transactions: Transaction[],
  filter: PeriodFilterState,
  now = appNow()
): ChartPoint[] {
  const range = resolvePeriodRange(filter, now);

  // Tentukan granularitas: 'day' | 'month' | 'year'
  let granularity: 'day' | 'month' | 'year' = 'month';
  if (filter.preset === 'day' || filter.preset === 'week' || filter.preset === 'month') {
    granularity = 'day';
  } else if (filter.preset === 'year') {
    granularity = 'month';
  } else if (filter.preset === 'all') {
    granularity = 'year';
  } else if (filter.preset === 'custom' && range) {
    const s = parseIsoDate(range.start);
    const e = parseIsoDate(range.end);
    if (s && e) {
      const spanDays = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
      if (spanDays <= 45) granularity = 'day';
      else if (spanDays <= 730) granularity = 'month';
      else granularity = 'year';
    }
  }

  const buckets = new Map<string, ChartPoint>();
  const shortMonth = new Intl.DateTimeFormat('id-ID', { month: 'short' });
  const shortMonthYr = new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    year: '2-digit',
  });

  // Pre-fill slot kosong agar sumbu X tetap berjarak proporsional
  if (range) {
    const s = parseIsoDate(range.start);
    const e = parseIsoDate(range.end);
    if (s && e) {
      if (granularity === 'day') {
        const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
        const showMonthInLabel = s.getMonth() !== e.getMonth() || filter.preset === 'week' || filter.preset === 'day';
        while (cur.getTime() <= end.getTime()) {
          const k = dateKey(cur);
          buckets.set(k, {
            key: k,
            label: showMonthInLabel
              ? `${cur.getDate()}/${cur.getMonth() + 1}`
              : `${cur.getDate()}`,
            inflow: 0,
            outflow: 0,
          });
          cur.setDate(cur.getDate() + 1);
        }
      } else if (granularity === 'month') {
        const cur = new Date(s.getFullYear(), s.getMonth(), 1);
        const end = new Date(e.getFullYear(), e.getMonth(), 1);
        const multiYear = s.getFullYear() !== e.getFullYear();
        while (cur.getTime() <= end.getTime()) {
          const k = monthKey(cur);
          buckets.set(k, {
            key: k,
            label: multiYear ? shortMonthYr.format(cur) : shortMonth.format(cur),
            inflow: 0,
            outflow: 0,
          });
          cur.setMonth(cur.getMonth() + 1);
        }
      } else {
        for (let y = s.getFullYear(); y <= e.getFullYear(); y++) {
          const k = String(y);
          buckets.set(k, { key: k, label: k, inflow: 0, outflow: 0 });
        }
      }
    }
  }

  // Isi transaksi ke bucket yang sesuai
  for (const tx of transactions) {
    const d = parseIsoDate(tx.transaction_date);
    if (!d) continue;

    let k: string;
    let label: string;
    if (granularity === 'day') {
      k = dateKey(d);
      label = `${d.getDate()}/${d.getMonth() + 1}`;
    } else if (granularity === 'month') {
      k = monthKey(d);
      label = shortMonth.format(d);
    } else {
      k = String(d.getFullYear());
      label = k;
    }

    const existing = buckets.get(k) ?? { key: k, label, inflow: 0, outflow: 0 };
    if (tx.type === 'inflow') existing.inflow += Number(tx.amount);
    else existing.outflow += Number(tx.amount);
    buckets.set(k, existing);
  }

  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

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
 * Grafik tren masuk dan keluar yang mengikuti filter periode aktif.
 * Bila hanya ada 1 titik (mode "Hari ini"), otomatis memakai BarChart agar
 * perbandingan Masuk vs Keluar tetap jelas dan tajam.
 */
export function CashflowChart({
  transactions,
  filter,
}: {
  transactions: Transaction[];
  filter: PeriodFilterState;
}) {
  const data = useMemo(
    () => bucketTransactionsByFilter(transactions, filter),
    [transactions, filter]
  );

  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-[12px] text-[var(--text-muted)]">
        Belum ada transaksi pada periode ini.
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }} barGap={12}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
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
              domain={[0, (max: number) => (max > 0 ? max * 1.2 : 100)]}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)', opacity: 0.45 }} />
            <Bar
              dataKey="inflow"
              name="Masuk"
              fill="var(--brand)"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
              animationDuration={500}
            />
            <Bar
              dataKey="outflow"
              name="Keluar"
              fill="var(--out)"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
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
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--text-faint)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
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
            animationDuration={550}
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
            animationDuration={550}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Sparkline - jejak saldo berjalan untuk hero.
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
