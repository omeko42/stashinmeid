'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Bell,
  Coins,
  Crown,
  Database,
  FileBadge,
  Globe,
  Lock,
  Megaphone,
  MoonStar,
  Plug,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  User,
  UserCircle,
  UserCog,
  Users,
} from 'lucide-react';
import { ToolsTab } from '@/components/tabs/ToolsTab';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { LocaleSwitcher } from '@/components/shell/LocaleSwitcher';
import { CurrencySwitcher } from '@/components/shell/CurrencySwitcher';
import {
  AnnouncementEditor,
  NotificationPreferences,
} from '@/components/profile/NotificationSettings';
import { ApiIntegrationsManager } from '@/components/profile/ApiIntegrationsManager';
import { MembershipPanel } from '@/components/profile/MembershipPanel';
import { AuditLogPanel } from '@/components/profile/AuditLogPanel';
import { DangerZone } from '@/components/profile/DangerZone';
import type { KycVerificationStatus } from '@/components/profile/KycModal';
import {
  SecuritySettings,
  type SecuritySettingsProps,
} from '@/components/profile/SecuritySettings';
import { Button } from '@/components/ui/Button';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { useBalancePrivacy } from '@/components/ui/BalancePrivacy';

export type PersonalSection =
  | 'appearance'
  | 'security'
  | 'notifications'
  | 'membership'
  | 'audit'
  | 'data'
  | 'account';

export type AdminSection =
  | 'admin_billing'
  | 'admin_announcement'
  | 'admin_integrations'
  | 'admin_audit'
  | 'admin_users';

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
  onSavePrimaryCurrency?: (currency: string) => Promise<void>;
  isAdmin?: boolean;
  isSuperadmin?: boolean;
  appPinSet?: boolean;
  kycStatus?: KycVerificationStatus;
  profileCompleteness?: number;
  onOpenSecurity?: () => void;
  onOpenKyc?: () => void;
  onOpenProfile?: () => void;
  onOpenUsers?: () => void;
  onBackToMain?: () => void;
  securityProps?: SecuritySettingsProps;
  requestedSection?: { section: PersonalSection; seq: number } | null;
  controlledAdminMode?: boolean;
  onControlledAdminModeChange?: (val: boolean) => void;
  controlledPersonalSection?: PersonalSection;
  onControlledPersonalSectionChange?: (val: PersonalSection) => void;
  controlledAdminSection?: AdminSection;
  onControlledAdminSectionChange?: (val: AdminSection) => void;
}

/**
 * Pengaturan Terpadu dengan Switch Mode Pribadi ↔ Mode Admin di pojok kanan atas:
 * - Mode Pribadi: Tampilan, Bahasa, Mata Uang, Keamanan PIN/2FA, Status e-KYC,
 *   Notifikasi Pribadi, Billing/Membership Pribadi, Audit Log Saya, Data & Akun.
 * - Mode Admin  : Pengaturan Harga & Kuota Paket Membership, Aktivasi Pembayaran,
 *   Pita Pengumuman Global, Koneksi API Pihak Ketiga, Audit Log Global, & Manajemen User.
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
  onSavePrimaryCurrency,
  isAdmin = false,
  isSuperadmin = false,
  appPinSet = false,
  kycStatus = 'unverified',
  profileCompleteness = 60,
  onOpenSecurity,
  onOpenKyc,
  onOpenProfile,
  onOpenUsers,
  onBackToMain,
  securityProps,
  requestedSection,
  controlledAdminMode,
  onControlledAdminModeChange,
  controlledPersonalSection,
  onControlledPersonalSectionChange,
  controlledAdminSection,
  onControlledAdminSectionChange,
}: SettingsTabProps) {
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const isEn = locale === 'en';
  const canUseAdminMode = isAdmin || isSuperadmin;

  const [internalAdminMode, setInternalAdminMode] = useState(false);
  const [internalPersonalSection, setInternalPersonalSection] =
    useState<PersonalSection>('appearance');
  const [internalAdminSection, setInternalAdminSection] =
    useState<AdminSection>('admin_billing');

  const adminMode = controlledAdminMode ?? internalAdminMode;
  const setAdminMode = (v: boolean) => {
    setInternalAdminMode(v);
    onControlledAdminModeChange?.(v);
  };
  const personalSection = controlledPersonalSection ?? internalPersonalSection;
  const setPersonalSection = (v: PersonalSection) => {
    setInternalPersonalSection(v);
    onControlledPersonalSectionChange?.(v);
  };
  const adminSection = controlledAdminSection ?? internalAdminSection;
  const setAdminSection = (v: AdminSection) => {
    setInternalAdminSection(v);
    onControlledAdminSectionChange?.(v);
  };
  const [lastRequestSeq, setLastRequestSeq] = useState(0);

  if (requestedSection && requestedSection.seq !== lastRequestSeq) {
    setLastRequestSeq(requestedSection.seq);
    setAdminMode(false);
    setPersonalSection(requestedSection.section);
  }

  const personalTabs: {
    id: PersonalSection;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'appearance',
      label: isEn ? 'Display' : 'Tampilan',
      icon: <SlidersHorizontal className="size-4" />,
    },
    {
      id: 'security',
      label: isEn ? 'Security' : 'Keamanan',
      icon: <ShieldCheck className="size-4" />,
    },
    {
      id: 'notifications',
      label: tSettings('sections.notifications'),
      icon: <Bell className="size-4" />,
    },
    {
      id: 'membership',
      label: isEn ? 'My Membership' : 'Membership Saya',
      icon: <Crown className="size-4" />,
    },
    {
      id: 'audit',
      label: isEn ? 'My Activity Log' : 'Audit Log Saya',
      icon: <Activity className="size-4" />,
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

  const adminTabs: {
    id: AdminSection;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'admin_billing',
      label: isEn ? 'Billing & Plan Prices' : 'Billing & Harga Paket',
      icon: <Crown className="size-4" />,
    },
    {
      id: 'admin_integrations',
      label: isEn ? '3rd-Party API Hub' : 'Koneksi API',
      icon: <Plug className="size-4" />,
    },
    {
      id: 'admin_announcement',
      label: isEn ? 'Announcement Bar' : 'Pita Pengumuman',
      icon: <Megaphone className="size-4" />,
    },
    {
      id: 'admin_audit',
      label: isEn ? 'Global Audit Log' : 'Audit Log Global',
      icon: <Activity className="size-4" />,
    },
    {
      id: 'admin_users',
      label: isEn ? 'User Management' : 'Manajemen User',
      icon: <Users className="size-4" />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Pengaturan + Tombol Kembali + Switch Mode Pribadi ↔ Mode Admin */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {onBackToMain && (
              <button
                type="button"
                onClick={onBackToMain}
                aria-label={isEn ? 'Back to main menu' : 'Kembali ke menu utama'}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-2 sm:px-2.5 text-[12px] font-medium text-[var(--text)] whitespace-nowrap transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                <ArrowLeft className="size-4" aria-hidden />
                <span className="hidden sm:inline">
                  {isEn ? 'Back' : 'Kembali'}
                </span>
              </button>
            )}
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              {tSettings('title')}
            </h2>
            {canUseAdminMode && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                  adminMode
                    ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                }`}
              >
                {adminMode
                  ? isEn
                    ? 'Admin'
                    : 'Admin'
                  : isEn
                    ? 'Personal'
                    : 'Pribadi'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            {adminMode
              ? isEn
                ? 'Configure global plan prices, payment activations, 3rd-party APIs, and announcements.'
                : 'Kelola harga paket aplikasi, aktivasi pembayaran, koneksi API pihak ketiga, dan pengumuman global.'
              : isEn
                ? 'Manage your own display, security, personal subscription, and account data.'
                : 'Kelola tampilan, keamanan akun, langganan paket pribadimu, dan ekspor data.'}
          </p>
        </div>

        {/* Switch Button Khusus Admin di Pojok Kanan Atas */}
        {canUseAdminMode && (
          <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-1">
            <button
              type="button"
              onClick={() => setAdminMode(false)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition ${
                !adminMode
                  ? 'bg-[var(--brand)] text-[var(--brand-contrast)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <User className="size-3.5" />
              <span className="sm:hidden">{isEn ? 'Personal' : 'Pribadi'}</span>
              <span className="hidden sm:inline">
                {isEn ? 'Personal Mode' : 'Mode Pribadi'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAdminMode(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition ${
                adminMode
                  ? 'bg-[var(--brand)] text-[var(--brand-contrast)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span className="sm:hidden">Admin</span>
              <span className="hidden sm:inline">
                {isEn ? 'Admin Mode' : 'Mode Admin'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-menu berdasarkan Mode Pribadi vs Mode Admin (di mobile pindah ke BottomNav) */}
      {!adminMode ? (
        <>
          <div
            role="tablist"
            aria-label={tSettings('title')}
            className="hidden gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-1 lg:flex"
          >
            {personalTabs.map((tab) => {
              const active = personalSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPersonalSection(tab.id)}
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

          {personalSection === 'appearance' && (
            <div
              role="tabpanel"
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)]"
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
                title={isEn ? 'Display Language' : 'Bahasa Aplikasi'}
                caption={tSettings('appearance.language')}
              >
                <LocaleSwitcher />
              </SettingRow>

              <SettingRow
                icon={<Coins className="size-4" />}
                title={isEn ? 'Primary Currency' : 'Mata Uang Utama'}
                caption={
                  isEn
                    ? 'Foreign assets & balances automatically convert to this currency.'
                    : 'Semua saldo & aset mata uang asing langsung dikonversi ke satuan ini.'
                }
              >
                <CurrencySwitcher
                  onSelectCurrency={(code) => {
                    if (onSavePrimaryCurrency) {
                      void onSavePrimaryCurrency(code).catch(() => {});
                    }
                  }}
                />
              </SettingRow>

              <SettingRow
                icon={<Shield className="size-4" />}
                title={tSettings('balance.id.title')}
                caption={tSettings('balance.id.hint')}
              >
                <BalanceToggleSwitch />
              </SettingRow>

              {/* Baris Keamanan PIN, Passkey & 2FA — Terhubung Langsung */}
              <SettingRow
                icon={<Lock className="size-4" />}
                title={tSettings('security.title')}
                caption={tSettings('security.pinHint')}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      appPinSet
                        ? 'bg-[var(--in-soft)] text-[var(--in)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                  >
                    {appPinSet
                      ? isEn
                        ? 'PIN Active'
                        : 'PIN Aktif'
                      : isEn
                        ? 'PIN Not Set'
                        : 'PIN Belum Diatur'}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (securityProps) setPersonalSection('security');
                      else onOpenSecurity?.();
                    }}
                  >
                    {isEn ? 'Manage Security' : 'Atur Keamanan'}
                  </Button>
                </div>
              </SettingRow>

              {/* Baris Verifikasi e-KYC Pihak Ketiga — Terhubung Langsung */}
              <SettingRow
                icon={<FileBadge className="size-4" />}
                title={isEn ? 'Third-Party e-KYC Verification' : 'Verifikasi Identitas (e-KYC)'}
                caption={
                  isEn
                    ? `Identity verification status · Completeness score: ${profileCompleteness}%`
                    : `Verifikasi identitas pihak ketiga · Skor kelengkapan akun: ${profileCompleteness}%`
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      kycStatus === 'verified'
                        ? 'bg-[var(--in-soft)] text-[var(--in)]'
                        : kycStatus === 'pending'
                          ? 'bg-[var(--due-soft)] text-[var(--due)]'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                  >
                    {kycStatus === 'verified' && <BadgeCheck className="size-3" />}
                    {kycStatus === 'verified'
                      ? isEn
                        ? 'Verified'
                        : 'Terverifikasi'
                      : kycStatus === 'pending'
                        ? isEn
                          ? 'Pending'
                          : 'Menunggu'
                        : isEn
                          ? 'Unverified'
                          : 'Belum Verifikasi'}
                  </span>
                  {onOpenKyc && (
                    <Button size="sm" variant="secondary" onClick={onOpenKyc}>
                      {isEn ? 'Open e-KYC' : 'Buka e-KYC'}
                    </Button>
                  )}
                </div>
              </SettingRow>

              {/* Baris Profil & Workspace — Terhubung Langsung */}
              {onOpenProfile && (
                <SettingRow
                  icon={<UserCircle className="size-4" />}
                  title={isEn ? 'Profile & Colleagues' : 'Profil, Bio & Kolega'}
                  caption={
                    isEn
                      ? 'Edit your avatar, cover banner, bio, and connected colleagues.'
                      : 'Ubah foto profil, banner, bio, dan kelola daftar kolega.'
                  }
                >
                  <Button size="sm" variant="secondary" onClick={onOpenProfile}>
                    {isEn ? 'Open Profile' : 'Buka Profil'}
                  </Button>
                </SettingRow>
              )}
            </div>
          )}

          {personalSection === 'security' && securityProps && (
            <div role="tabpanel" className="space-y-4">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
                <h2 className="text-[15px] font-semibold text-[var(--text)]">
                  {isEn ? 'Account Security' : 'Keamanan Akun'}
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                  {isEn
                    ? 'Manage Passkeys, 2FA Authenticator, Device PIN Lock, and Account Password.'
                    : 'Kelola Passkey, 2FA Authenticator, Kunci PIN Perangkat, dan Password Akun Anda.'}
                </p>
              </div>
              <SecuritySettings {...securityProps} />
            </div>
          )}

          {personalSection === 'notifications' && (
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
            </div>
          )}

          {personalSection === 'membership' && (
            <section role="tabpanel" aria-label="Membership Saya">
              <MembershipPanel mode="personal" />
            </section>
          )}

          {personalSection === 'audit' && (
            <section role="tabpanel" aria-label="Audit Log Saya">
              <AuditLogPanel defaultView="my" />
            </section>
          )}

          {personalSection === 'data' && (
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

          {personalSection === 'account' && (
            <div role="tabpanel" className="space-y-4">
              <DangerZone />
            </div>
          )}
        </>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Pengaturan Mode Admin"
            className="hidden gap-1 overflow-x-auto rounded-xl border border-[var(--brand)]/35 bg-[var(--surface-1)] p-1 lg:flex"
          >
            {adminTabs.map((tab) => {
              const active = adminSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setAdminSection(tab.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {adminSection === 'admin_billing' && (
            <section role="tabpanel" aria-label="Billing & Harga Paket">
              <MembershipPanel mode="admin" />
            </section>
          )}

          {adminSection === 'admin_integrations' && (
            <section role="tabpanel" aria-label="Koneksi API">
              <ApiIntegrationsManager />
            </section>
          )}

          {adminSection === 'admin_announcement' && (
            <div
              role="tabpanel"
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--brand)]">
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

          {adminSection === 'admin_audit' && (
            <section role="tabpanel" aria-label="Audit Log Global">
              <AuditLogPanel defaultView="global" />
            </section>
          )}

          {adminSection === 'admin_users' && (
            <div
              role="tabpanel"
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Users className="size-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-semibold text-[var(--text)]">
                    {isEn
                      ? 'User & Manual Subscription Management'
                      : 'Manajemen Pengguna & Langganan Manual'}
                  </h4>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {isEn
                      ? 'Create users, edit roles, set active membership tiers, and grant custom subscription durations (e.g. free 3 months for friends).'
                      : 'Tambah akun, ubah peran, dan atur paket aktif beserta durasi bulan langganan (mis. gratis 3 bulan untuk teman).'}
                  </p>
                </div>
              </div>
              {onOpenUsers && (
                <Button
                  size="sm"
                  icon={<Users className="size-4" />}
                  onClick={onOpenUsers}
                >
                  {isEn ? 'Open User Management' : 'Buka Manajemen User'}
                </Button>
              )}
            </div>
          )}
        </>
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3.5 first:border-t-0">
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
