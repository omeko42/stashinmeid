'use client';

import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { IconButton } from '@/components/ui/Button';
import { SettingsMenu } from './SettingsMenu';

interface MobileHeaderProps {
  profileClient: string;
  isSuperadmin: boolean;
  canEdit: boolean;
  unreadNotifications?: number;
  onProfile: () => void;
  onOpenNotifications: () => void;
  onOpenKyc: () => void;
  onOpenSecurity: () => void;
  onOpenSettings: () => void;
  onUsers: () => void;
  onScan: () => void;
  onImport: () => void;
  onExportPdf: () => void;
  onExportWord: () => void;
  onExportCsv: () => void;
  onLogout: () => void;
}

/** Header mobile & tablet: logo, nama workspace, dan menu pengaturan ikon ringkas (termasuk Notifikasi). */
export function MobileHeader({
  profileClient,
  isSuperadmin,
  canEdit,
  unreadNotifications = 0,
  onProfile,
  onOpenNotifications,
  onOpenKyc,
  onOpenSecurity,
  onOpenSettings,
  onUsers,
  onScan,
  onImport,
  onExportPdf,
  onExportWord,
  onExportCsv,
  onLogout,
}: MobileHeaderProps) {
  const tNav = useTranslations('nav');

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--bg)]/90 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <BrandLogo size={28} />
        <div className="min-w-0">
          <h1 className="text-[13px] font-bold leading-none lowercase">
            stashinmeid
          </h1>
          <span className="block truncate text-[10px] text-[var(--text-muted)]">
            {profileClient}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <SettingsMenu
          canEdit={canEdit}
          showUsers={isSuperadmin}
          unreadNotifications={unreadNotifications}
          onProfile={onProfile}
          onOpenNotifications={onOpenNotifications}
          onOpenKyc={onOpenKyc}
          onOpenSecurity={onOpenSecurity}
          onOpenSettings={onOpenSettings}
          onUsers={onUsers}
          onScan={onScan}
          onImport={onImport}
          onExportPdf={onExportPdf}
          onExportWord={onExportWord}
          onExportCsv={onExportCsv}
        />
        <IconButton
          label={tNav('signOut')}
          size="sm"
          variant="secondary"
          onClick={onLogout}
        >
          <LogOut className="size-4" />
        </IconButton>
      </div>
    </header>
  );
}
