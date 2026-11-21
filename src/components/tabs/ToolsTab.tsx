'use client';

import { useTranslations } from 'next-intl';
import { Camera, FileDown, FileText, Table2, Upload } from 'lucide-react';

interface ToolsTabProps {
  /** true saat dirender di dalam halaman lain (Pengaturan): sembunyikan judulnya sendiri. */
  embedded?: boolean;
  canEdit: boolean;
  scanning: boolean;
  hasTransactions: boolean;
  hasDebts: boolean;
  onScan: () => void;
  onImport: () => void;
  onExportPdf: () => void;
  onExportWord: () => void;
  onExportCsv: () => void;
}

/**
 * Alat data: pindai struk, impor, ekspor.
 *
 * Datar, tanpa kartu gradien - tiap alat adalah baris dengan ikon, judul,
 * penjelasan, dan aksi.
 */
export function ToolsTab({
  embedded = false,
  canEdit,
  scanning,
  hasTransactions,
  hasDebts,
  onScan,
  onImport,
  onExportPdf,
  onExportWord,
  onExportCsv,
}: ToolsTabProps) {
  const tTools = useTranslations('tools');
  const tSettings = useTranslations('settings.data');

  const tools = [
    {
      id: 'scan',
      icon: Camera,
      title: tSettings('scan'),
      hint: tSettings('scanHint'),
      action: onScan,
      disabled: !canEdit || scanning,
      tone: 'var(--info)',
    },
    {
      id: 'import',
      icon: Upload,
      title: tSettings('import'),
      hint: tSettings('importHint'),
      action: onImport,
      disabled: !canEdit,
      tone: 'var(--brand)',
    },
    {
      id: 'export-csv',
      icon: Table2,
      title: tSettings('exportCsv'),
      hint: tTools('csvHint'),
      action: onExportCsv,
      disabled: !hasTransactions && !hasDebts,
      tone: 'var(--text-muted)',
    },
    {
      id: 'export-pdf',
      icon: FileDown,
      title: tSettings('exportPdf'),
      hint: tTools('pdfHint'),
      action: onExportPdf,
      disabled: !hasTransactions && !hasDebts,
      tone: 'var(--out)',
    },
    {
      id: 'export-word',
      icon: FileText,
      title: tSettings('exportWord'),
      hint: tTools('wordHint'),
      action: onExportWord,
      disabled: !hasTransactions && !hasDebts,
      tone: 'var(--due)',
    },
  ];

  return (
    <div className={embedded ? '' : 'space-y-4'}>
      {!embedded && (
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tTools('title')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tTools('subtitle')}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
        {tools.map((tool, idx) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
                idx > 0 ? 'border-t border-[var(--line)]' : ''
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]"
                  style={{ color: tool.tone }}
                >
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text)]">
                    {tool.title}
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                    {tool.hint}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={tool.action}
                disabled={tool.disabled}
                className="shrink-0 self-start rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-3)] hover:border-[var(--line-strong)] disabled:cursor-not-allowed disabled:opacity-40 sm:self-auto"
              >
                {tool.disabled && tool.id.startsWith('export')
                  ? tTools('emptyToExport')
                  : tTools('run')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
