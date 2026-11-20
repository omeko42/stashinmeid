'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, ChevronDown, FileDown, Settings, Upload, UserCircle, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

type SettingsMenuProps = {
  onProfile: () => void;
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

/** Menu Pengaturan: profil, user, pindai, impor/ekspor, tema, bahasa. */
export function SettingsMenu({
  onProfile,
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
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-semibold transition',
          'border border-[var(--line)] bg-[var(--surface-1)] text-[var(--text)]',
          'hover:bg-[var(--surface-2)] hover:border-[var(--line-strong)]'
        )}
      >
        <Settings className="size-4" aria-hidden />
        <span className="hidden sm:inline">{tNav('settings')}</span>
        <ChevronDown className={cn('size-4 text-[var(--text-muted)] transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-50 mt-2 min-w-[min(100vw-2rem,16rem)] rounded-xl border border-[var(--line)]',
            'bg-[var(--surface-1)] shadow-[var(--shadow-lg)] py-1',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <MenuItem icon={<UserCircle className="size-4" />} label={tNav('profile')} onSelect={() => run(onProfile)} />
          {showUsers && onUsers && (
            <MenuItem icon={<Users className="size-4" />} label={tNav('users')} onSelect={() => run(onUsers)} />
          )}
          {canEdit && onScan && (
            <MenuItem icon={<Camera className="size-4" />} label={tSettings('data.scan')} onSelect={() => run(onScan)} />
          )}
          {canEdit && onImport && (
            <MenuItem icon={<Upload className="size-4" />} label={tSettings('data.import')} onSelect={() => run(onImport)} />
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
          <div className="px-3 py-2 flex items-center justify-between gap-2">
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
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] text-left"
    >
      <span className="text-[var(--text-muted)]" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}
