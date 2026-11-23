'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Filter, RotateCcw } from 'lucide-react';
import {
  formatPeriodLabel,
  resolvePeriodRange,
  type PeriodFilterState,
  type PeriodPreset,
} from '@/lib/periodFilter';
import { parseIsoDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface PeriodFilterPopoverProps {
  value: PeriodFilterState;
  onChange: (next: PeriodFilterState) => void;
  availableYears: number[];
  isEn?: boolean;
  /** Jumlah filter tambahan yang sedang aktif (mis. dompet/kategori di Arus Kas) untuk badge titik/angka. */
  activeCount?: number;
  /** Kontrol tambahan di bawah rentang periode (mis. dropdown Dompet & Kategori di Arus Kas). */
  extraFields?: ReactNode;
  /** Callback reset seluruh filter (opsional). */
  onReset?: () => void;
  /** Subtitle kanan atas popover. */
  hint?: string;
  /** Kontrol buka/tutup eksternal (opsional, mis. bila dibuka juga dari badge Hero). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Tombol ikon Filter corong (icon-only) dengan Popover 2 baris yang bersih & skalabel:
 * - Baris 1: Jenis periode (Semua · Hari · Minggu · Bulan · Tahun · Custom)
 * - Baris 2: Rentang periode dinamis yang otomatis menyesuaikan Baris 1
 *   (Dropdown Bulan+Tahun, Dropdown Tahun, Date Picker Hari/Minggu, atau Rentang Custom)
 */
export function PeriodFilterPopover({
  value,
  onChange,
  availableYears,
  isEn = false,
  activeCount = 0,
  extraFields,
  onReset,
  hint,
  open: controlledOpen,
  onOpenChange,
}: PeriodFilterPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const months = isEn ? MONTHS_EN : MONTHS_ID;
  const activeLabel = formatPeriodLabel(value, isEn);
  const weekRange = value.preset === 'week' ? resolvePeriodRange(value) : null;

  const presets: { id: PeriodPreset; label: string }[] = [
    { id: 'all', label: isEn ? 'All' : 'Semua' },
    { id: 'day', label: isEn ? 'Day' : 'Hari' },
    { id: 'week', label: isEn ? 'Week' : 'Minggu' },
    { id: 'month', label: isEn ? 'Month' : 'Bulan' },
    { id: 'year', label: isEn ? 'Year' : 'Tahun' },
    { id: 'custom', label: 'Custom' },
  ];

  const selectCls =
    'h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none';
  const inputCls =
    'h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none';

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={isEn ? 'Filter' : 'Filter'}
        title={`${isEn ? 'Filter' : 'Filter'}: ${activeLabel}`}
        className={`relative inline-flex size-9 items-center justify-center rounded-lg border transition ${
          isOpen || activeCount > 0
            ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
            : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
        }`}
      >
        <Filter className="size-4" aria-hidden />
        {activeCount > 0 && (
          <span className="tnum absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--brand)] text-[9px] font-bold text-[var(--brand-contrast)] shadow-sm">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label={isEn ? 'Filter Period' : 'Filter Periode'}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-3.5 shadow-[var(--shadow-lg)]"
          >
            {/* Header */}
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {isEn ? 'Filter' : 'Filter'}
              </span>
              {hint && (
                <span className="truncate text-[10px] text-[var(--text-faint)]">
                  {hint}
                </span>
              )}
            </div>

            {/* BARIS 1: Pilihan Periode (1 baris kompak) */}
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold text-[var(--text-muted)]">
                {isEn ? 'Period Type' : 'Periode'}
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-1 sm:grid-cols-6">
                {presets.map((p) => {
                  const active = value.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChange({ ...value, preset: p.id })}
                      className={`rounded-md px-1.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition ${
                        active
                          ? 'bg-[var(--brand)] text-[var(--brand-contrast)] shadow-xs'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)]/60 hover:text-[var(--text)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BARIS 2: Rentang Periode Dinamis (otomatis menyesuaikan Baris 1) */}
            <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/40 p-2.5">
              {value.preset === 'all' && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isEn
                    ? 'Showing all transactions across your entire history.'
                    : 'Menampilkan seluruh riwayat transaksi dari awal hingga sekarang.'}
                </p>
              )}

              {value.preset === 'day' && (
                <div>
                  <label
                    htmlFor="pf-day-date"
                    className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'Select Date' : 'Pilih Tanggal'}
                  </label>
                  <input
                    id="pf-day-date"
                    type="date"
                    value={value.date}
                    onChange={(e) => onChange({ ...value, date: e.target.value })}
                    className={inputCls}
                  />
                </div>
              )}

              {value.preset === 'week' && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="pf-week-date"
                    className="block text-[10px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? '7-Day Window Ending On' : 'Rentang 7 Hari Sampai Tanggal'}
                  </label>
                  <input
                    id="pf-week-date"
                    type="date"
                    value={value.date}
                    onChange={(e) => onChange({ ...value, date: e.target.value })}
                    className={inputCls}
                  />
                  {weekRange && (
                    <p className="tnum text-[10px] text-[var(--text-faint)]">
                      {(() => {
                        const s = parseIsoDate(weekRange.start);
                        const e = parseIsoDate(weekRange.end);
                        if (!s || !e) return '';
                        const fmt = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        });
                        return `${fmt.format(s)} – ${fmt.format(e)}`;
                      })()}
                    </p>
                  )}
                </div>
              )}

              {value.preset === 'month' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="pf-month-select"
                      className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                    >
                      {isEn ? 'Month' : 'Bulan'}
                    </label>
                    <select
                      id="pf-month-select"
                      value={value.month}
                      onChange={(e) =>
                        onChange({ ...value, month: Number(e.target.value) })
                      }
                      className={selectCls}
                    >
                      {months.map((label, idx) => (
                        <option key={label} value={idx + 1}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="pf-month-year"
                      className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                    >
                      {isEn ? 'Year' : 'Tahun'}
                    </label>
                    <select
                      id="pf-month-year"
                      value={value.year}
                      onChange={(e) =>
                        onChange({ ...value, year: Number(e.target.value) })
                      }
                      className={selectCls}
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {value.preset === 'year' && (
                <div>
                  <label
                    htmlFor="pf-year-select"
                    className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'Select Year' : 'Pilih Tahun'}
                  </label>
                  <select
                    id="pf-year-select"
                    value={value.year}
                    onChange={(e) =>
                      onChange({ ...value, year: Number(e.target.value) })
                    }
                    className={selectCls}
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {value.preset === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="pf-custom-start"
                      className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                    >
                      {isEn ? 'Start Date' : 'Dari Tanggal'}
                    </label>
                    <input
                      id="pf-custom-start"
                      type="date"
                      value={value.startDate}
                      onChange={(e) =>
                        onChange({ ...value, startDate: e.target.value })
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="pf-custom-end"
                      className="mb-1 block text-[10px] font-semibold text-[var(--text-muted)]"
                    >
                      {isEn ? 'End Date' : 'Sampai Tanggal'}
                    </label>
                    <input
                      id="pf-custom-end"
                      type="date"
                      value={value.endDate}
                      onChange={(e) =>
                        onChange({ ...value, endDate: e.target.value })
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Field tambahan opsional (Dompet / Kategori di Arus Kas) */}
            {extraFields && (
              <div className="mt-3 space-y-2.5 border-t border-[var(--line)] pt-3">
                {extraFields}
              </div>
            )}

            {/* Footer aksi */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
              {onReset ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  <RotateCcw className="size-3" aria-hidden />
                  Reset
                </button>
              ) : (
                <span className="truncate text-[11px] font-medium text-[var(--text-muted)]">
                  {activeLabel}
                </span>
              )}
              <Button size="sm" onClick={() => setOpen(false)}>
                {isEn ? 'Done' : 'Selesai'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
