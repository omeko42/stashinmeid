'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bell,
  Crown,
  Database,
  Globe,
  Megaphone,
  MoonStar,
  Plug,
  Shield,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react';
import { ToolsTab } from '@/components/tabs/ToolsTab';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { LocaleSwitcher } from '@/components/shell/LocaleSwitcher';
import {
  AnnouncementEditor,
  NotificationPreferences,
} from '@/components/profile/NotificationSettings';
import { ApiIntegrationsManager } from '@/components/profile/ApiIntegrationsManager';
import { MembershipPanel } from '@/components/profile/MembershipPanel';
import { DangerZone } from '@/components/profile/DangerZone';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { useBalancePrivacy } from '@/components/ui/BalancePrivacy';

type SettingsSection =
  | 'appearance'
  | 'notifications'
  | 'membership'
  | 'integrations'
  | 'data'
  | 'account';

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
  /** Superadmin bisa mengatur pita pengumuman global. */
  isSuperadmin?: boolean;
}

/**
 * Pengaturan.
 *
 * Dipisah jadi sub-menu: Tampilan, Notifikasi, dan Data. Setiap
 * sub-menu punya satu fokus, jadi pengaturannya tidak menumpuk di satu
 * halaman panjang yang harus di-scroll jauh.
 *
 * Sub-menu Notifikasi memuat dua hal yang beda:
 *   - preferensi notifikasi pribadi (semua user)
 *   - pita pengumuman global (superadmin saja)
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
  isSuperadmin = false,
}: SettingsTabProps) {
  const tSettings = useTranslations('settings');
  const [section, setSection] = useState<SettingsSection>('appearance');

  const tabs: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    {
      id: 'appearance',
      label: tSettings('sections.appearance'),
      icon: <SlidersHorizontal className="size-4" />,
    },
    {
      id: 'notifications',
      label: tSettings('sections.notifications'),
      icon: <Bell className="size-4" />,
    },
    {
      id: 'membership',
      label: 'Membership',
      icon: <Crown className="size-4" />,
    },
    {
      id: 'integrations',
      label: 'Koneksi API',
      icon: <Plug className="size-4" />,
    },
    {
      id: 'data',
      label: tSettings('sections.data'),
      icon: <Database className="size-4" />,
    },
    {
      id: 'account',
      label: tSettings('sections.account'),
      icon: <UserCog className="size-4" />,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--text)]">
          {tSettings('title')}
        </h2>
        <p className="text-[12px] text-[var(--text-muted)]">
          {tSettings('subtitle')}
        </p>
      </div>

      {/* Sub-menu pengaturan */}
      <div
        role="tablist"
        aria-label={tSettings('title')}
        className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-1"
      >
        {tabs.map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-[var(--surface-3)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {section === 'appearance' && (
        <div
          role="tabpanel"
          className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]"
        >
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
            icon={<Shield className="size-4" />}
            title={tSettings('balance.id.title')}
            caption={tSettings('balance.id.hint')}
          >
            <BalanceToggleSwitch />
          </SettingRow>
          <SettingRow
            icon={<SlidersHorizontal className="size-4" />}
            title={tSettings('security.title')}
            caption={tSettings('security.pinHint')}
          >
            <SecurityHint />
          </SettingRow>
        </div>
      )}

      {section === 'notifications' && (
        <div role="tabpanel" className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">
                <Bell className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--text)]">
                  {tSettings('notifications.title')}
                </p>
                <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                  {tSettings('notifications.hint')}
                </p>
              </div>
            </div>
            <NotificationPreferences />
          </div>

          {isSuperadmin && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">
                  <Megaphone className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text)]">
                    {tSettings('announcement.title')}
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                    {tSettings('announcement.hint')}
                  </p>
                </div>
              </div>
              <AnnouncementEditor />
            </div>
          )}
        </div>
      )}

      {section === 'membership' && (
        <section role="tabpanel" aria-label="Membership">
          <MembershipPanel />
        </section>
      )}

      {section === 'integrations' && (
        <section role="tabpanel" aria-label="Koneksi API">
          <ApiIntegrationsManager />
        </section>
      )}

      {section === 'data' && (
        <section role="tabpanel" aria-label={tSettings('sections.data')}>
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
      )}

      {section === 'account' && (
        <div role="tabpanel" className="space-y-4">
          <DangerZone />
        </div>
      )}
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

/**
 * Saklar "sembunyikan saldo".
 *
 * Bedanya dengan tombol mata di header: yang ini saklar beneran (on/off)
 * dan terlihat statusnya, sementara tombol di header cuma shortcut.
 */
function BalanceToggleSwitch() {
  const tSettings = useTranslations('settings');
  const { hidden, toggle, ready } = useBalancePrivacy();

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[var(--text-muted)]">
        {ready && hidden
          ? tSettings('balance.hiddenNote')
          : tSettings('balance.id.title')}
      </span>
      <BalanceVisibilityToggle onClick={toggle} />
    </div>
  );
}

/** Petunjuk arah keamanan - PIN dan 2FA hidup dari menu profil. */
function SecurityHint() {
  const tSettings = useTranslations('settings');
  return (
    <span className="text-[11px] text-[var(--text-muted)]">
      {tSettings('sections.profile')} → {tSettings('security.title')}
    </span>
  );
}
