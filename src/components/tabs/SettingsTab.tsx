'use client';

import { useTranslations } from 'next-intl';
import { Globe, MoonStar, SlidersHorizontal } from 'lucide-react';
import { ToolsTab } from '@/components/tabs/ToolsTab';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { LocaleSwitcher } from '@/components/shell/LocaleSwitcher';

interface SettingsTabProps {
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
 * Pengaturan: satu halaman, beberapa seksi.
 *
 * Menggantikan kombinasi "Alat Data" di sidebar + menu pengaturan di top bar
 * yang tidak lagi ada. Tema dan bahasa memakai komponen shell yang sama.
 */
export function SettingsTab({
  canEdit,
  scanning,
  hasTransactions,
  hasDebts,
  onScan,
  onImport,
  onExportPdf,
  onExportWord,
  onExportCsv,
}: SettingsTabProps) {
  const tSettings = useTranslations('settings');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--text)]">
          {tSettings('title')}
        </h2>
        <p className="text-[12px] text-[var(--text-muted)]">
          {tSettings('subtitle')}
        </p>
      </div>

      {/* Data dan ekspor */}
      <section aria-label={tSettings('sections.data')}>
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {tSettings('sections.data')}
        </p>
        <ToolsTab
          embedded
          canEdit={canEdit}
          scanning={scanning}
          hasTransactions={hasTransactions}
          hasDebts={hasDebts}
          onScan={onScan}
          onImport={onImport}
          onExportPdf={onExportPdf}
          onExportWord={onExportWord}
          onExportCsv={onExportCsv}
        />
      </section>

      {/* Tampilan */}
      <section aria-label={tSettings('sections.appearance')}>
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {tSettings('sections.appearance')}
        </p>
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          <SettingRow
            icon={<MoonStar className="size-4" />}
            title={tSettings('appearance.title')}
            caption={tSettings('appearance.theme')}
          >
            <ThemeToggle />
          </SettingRow>
          <SettingRow
            icon={<Globe className="size-4" />}
            title={tSettings('sections.appearance')}
            caption={tSettings('appearance.language')}
          >
            <LocaleSwitcher />
          </SettingRow>
          <SettingRow
            icon={<SlidersHorizontal className="size-4" />}
            title={tSettings('security.title')}
            caption={tSettings('security.pinHint')}
          >
            <SecurityHint />
          </SettingRow>
        </div>
      </section>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  caption,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3.5 first:border-t-0">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--text)]">{title}</p>
          {caption && (
            <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
              {caption}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Petunjuk arah keamanan - PIN dan 2FA hidup dari modal profil (patch 3). */
function SecurityHint() {
  const tSettings = useTranslations('settings');
  return (
    <span className="text-[11px] text-[var(--text-muted)]">
      {tSettings('sections.profile')} → {tSettings('security.title')}
    </span>
  );
}
