'use client';

import { useTranslations } from 'next-intl';
import {
  Landmark,
  LayoutDashboard,
  Plus,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NavTab } from './Sidebar';

interface BottomNavProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  canEdit: boolean;
  /** Tombol "+": membuka menu pilihan catat (anggaran/arus kas/aset). */
  onAddMenu: () => void;
}

/**
 * Bottom nav mobile.
 *
 * Lima slot sesuai spesifikasi: Ringkasan, Saldo, tanda "+" untuk mencatat,
 * Pinjaman, dan Sosial. Pengaturan dijangkau lewat menu gear di header mobile.
 */
export function BottomNav({
  activeTab,
  onNavigate,
  canEdit,
  onAddMenu,
}: BottomNavProps) {
  const t = useTranslations();
  const tNav = useTranslations('nav');

  const left: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: tNav('overview'),
      icon: <LayoutDashboard className="size-5" />,
    },
    {
      id: 'saldo',
      label: tNav('saldo'),
      icon: <Wallet className="size-5" />,
    },
  ];

  const right: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'debts',
      label: tNav('debts'),
      icon: <Landmark className="size-5" />,
    },
    {
      id: 'social',
      label: tNav('sosial'),
      icon: <Users className="size-5" />,
    },
  ];

  const renderItem = (item: { id: NavTab; label: string; icon: React.ReactNode }) => {
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavigate(item.id)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 transition-colors',
          active
            ? 'text-[var(--brand)]'
            : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]'
        )}
      >
        {item.icon}
        <span className="max-w-full truncate text-[10px] font-medium">
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label={t('nav.openMenu')}
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-1 border-t border-[var(--line)] bg-[var(--surface-1)]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden"
    >
      {left.map(renderItem)}

      {canEdit && (
        <button
          type="button"
          onClick={onAddMenu}
          aria-label={t('quickAdd.title')}
          className="mx-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-contrast)] shadow-[var(--shadow-md)] transition active:scale-95"
        >
          <Plus className="size-5" />
        </button>
      )}

      {right.map(renderItem)}
    </nav>
  );
}
