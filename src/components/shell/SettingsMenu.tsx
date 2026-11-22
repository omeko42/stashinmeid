'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  Camera,
  FileDown,
  Settings,
  Shield,
  SlidersHorizontal,
  Upload,
  UserCircle,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

type SettingsMenuProps = {
  onProfile: () => void;
  onOpenNotifications?: () => void;
  unreadNotifications?: number;
  onOpenKyc?: () => void;
  onOpenSecurity?: () => void;
  onOpenSettings?: () => void;
  onUsers?: () => void;
  onScan?: () => void;
  onImport?: () => void;
  onExportPdf?: () => void;
  onExportWord?: () => void;
  onExportCsv?: () => void;
  showUsers?: boolean;
  canEdit?: boolean;
  align?: 'left' | 'right';
};

/** Menu Pengaturan ringkas (ikon saja) untuk header mobile & tablet. */
export function SettingsMenu({
  onProfile,
  onOpenNotifications,
  unreadNotifications = 0,
  onOpenKyc,
  onOpenSecurity,
  onOpenSettings,
  onUsers,
  onScan,
  onImport,
  onExportPdf,
  onExportWord,
  onExportCsv,
  showUsers,
  canEdit,
  align = 'right',
}: SettingsMenuProps) {
  const tNav = useTranslations('nav');
  const tSettings = useTranslations('settings');
  const tNotif = useTranslations('notifications');
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn?: () => void) => {
    setOpen(false);
    fn?.();
  };

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        type="button"
        label={tNav('settings')}
        title={tNav('settings')}
        size="sm"
        variant="secondary"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Settings className="size-4" aria-hidden />
        {unreadNotifications > 0 && (
          <span
            className="absolute -right-1 -top-1 flex min-w-[15px] items-center justify-center rounded-full bg-[var(--out)] px-1 text-[9px] font-bold leading-[15px] text-white"
            aria-label={`${unreadNotifications} notifikasi belum dibaca`}
          >
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </IconButton>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'z-50 max-h-[calc(100vh-4.5rem)] overflow-y-auto rounded-xl border border-[var(--line)]',
            'bg-[var(--surface-1)] py-1 shadow-[var(--shadow-lg)]',
            'fixed right-3 top-14 w-[min(17rem,calc(100vw-1.5rem))] sm:absolute sm:top-full sm:mt-2 sm:w-64',
            align === 'right' ? 'sm:right-0 sm:left-auto' : 'sm:left-0 sm:right-auto'
          )}
        >
          <MenuItem
            icon={<UserCircle className="size-4" />}
            label={tNav('profile')}
            onSelect={() => run(onProfile)}
          />
          {onOpenNotifications && (
            <MenuItem
              icon={<Bell className="size-4" />}
              label={tNotif('title')}
              badge={unreadNotifications}
              onSelect={() => run(onOpenNotifications)}
            />
          )}
          {onOpenKyc && (
            <MenuItem
              icon={<BadgeCheck className="size-4" />}
              label={tSettings('kyc.title')}
              onSelect={() => run(onOpenKyc)}
            />
          )}
          {onOpenSecurity && (
            <MenuItem
              icon={<Shield className="size-4" />}
              label={tSettings('security.title')}
              onSelect={() => run(onOpenSecurity)}
            />
          )}
          {showUsers && onUsers && (
            <MenuItem
              icon={<Users className="size-4" />}
              label={tNav('users')}
              onSelect={() => run(onUsers)}
            />
          )}
          {onOpenSettings && (
            <MenuItem
              icon={<SlidersHorizontal className="size-4" />}
              label={tNav('settings')}
              onSelect={() => run(onOpenSettings)}
            />
          )}
          {canEdit && (onScan || onImport) && (
            <>
              <hr className="my-1 border-[var(--line)]" />
              {onScan && (
                <MenuItem
                  icon={<Camera className="size-4" />}
                  label={tSettings('data.scan')}
                  onSelect={() => run(onScan)}
                />
              )}
              {onImport && (
                <MenuItem
                  icon={<Upload className="size-4" />}
                  label={tSettings('data.import')}
                  onSelect={() => run(onImport)}
                />
              )}
            </>
          )}
          {(onExportPdf || onExportWord || onExportCsv) && (
            <>
              <hr className="my-1 border-[var(--line)]" />
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                {tSettings('data.exportHint')}
              </p>
              {onExportPdf && (
                <MenuItem
                  icon={<FileDown className="size-4" />}
                  label={tSettings('data.exportPdf')}
                  onSelect={() => run(onExportPdf)}
                />
              )}
              {onExportWord && (
                <MenuItem
                  icon={<FileDown className="size-4" />}
                  label={tSettings('data.exportWord')}
                  onSelect={() => run(onExportWord)}
                />
              )}
              {onExportCsv && (
                <MenuItem
                  icon={<FileDown className="size-4" />}
                  label={tSettings('data.exportCsv')}
                  onSelect={() => run(onExportCsv)}
                />
              )}
            </>
          )}
          <hr className="my-1 border-[var(--line)]" />
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <LocaleSwitcher compact />
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  badge,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-[var(--text-muted)]" aria-hidden>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="tnum flex min-w-[18px] items-center justify-center rounded-full bg-[var(--out)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
