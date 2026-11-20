'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Transaction, Debt } from '@/types/finance';

interface AnalyticsChartsProps {
  transactions: Transaction[];
  debts: Debt[];
}

const CORAL_PALETTE = ['#fb7185', '#f97316', '#818cf8', '#34d399', '#fbbf24', '#c084fc'];

const formatShortRp = (val: number) => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}rb`;
  return String(val);
};

export function CashflowAreaChart({ transactions }: { transactions: Transaction[] }) {
  // Group by date (last 7 entries or chronological)
  const grouped: Record<string, { date: string; inflow: number; outflow: number }> = {};

  transactions.forEach((tx) => {
    const d = tx.transaction_date.slice(5); // MM-DD
    if (!grouped[d]) {
      grouped[d] = { date: d, inflow: 0, outflow: 0 };
    }
    if (tx.type === 'inflow') grouped[d].inflow += Number(tx.amount);
    else grouped[d].outflow += Number(tx.amount);
  });

  const data = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-xs text-zinc-500">
        Belum ada data transaksi untuk grafik.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatShortRp}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#f4f4f5',
            }}
            formatter={(value) =>
              new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0,
              }).format(Number(value))
            }
          />
          <Area
            type="monotone"
            dataKey="inflow"
            name="Inflow"
            stroke="#34d399"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#inflowGrad)"
          />
          <Area
            type="monotone"
            dataKey="outflow"
            name="Outflow"
            stroke="#fb7185"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#outflowGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DebtDonutChart({ debts }: Pick<AnalyticsChartsProps, 'debts'>) {
  const active = debts.filter((d) => d.status === 'active' && d.remaining_balance > 0);
  const data = active.map((d) => ({
    name: d.platform,
    value: Number(d.remaining_balance),
  }));

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-xs text-zinc-500">
        Semua pinjaman sudah lunas!
      </div>
    );
  }

  return (
    <div className="h-56 w-full flex items-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={82}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={CORAL_PALETTE[idx % CORAL_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#f4f4f5',
            }}
            formatter={(value) =>
              new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0,
              }).format(Number(value))
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
