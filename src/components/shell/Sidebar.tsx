'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Landmark,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  Wallet,
} from 'lucide-react';
import type { UserRole } from '@/types/finance';
import { BrandLogo } from '@/components/BrandLogo';
import { ProfileMenu } from '@/components/shell/ProfileMenu';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export type NavTab =
  | 'overview'
  | 'saldo'
  | 'cashflow'
  | 'debts'
  | 'budget'
  | 'assets'
  | 'social'
  | 'settings'
  | 'profile'
  | 'users';

interface SidebarProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  profileClient: string;
  profileEmail: string;
  profileUsername: string;
  userRole: UserRole;
  isSuperadmin: boolean;
  avatarUrl?: string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  unreadNotifications?: number;
  onOpenNotifications: () => void;
  onOpenKyc?: () => void;
  onOpenSecurity: () => void;
  /** Pengaturan kini dari menu profil pojok kiri bawah, bukan item sidebar. */
  onOpenSettings: () => void;
  onLogout: () => void;
}

/**
 * Sidebar desktop dengan dukungan Minimize / Maximize.
 *
 * Posisi di sebelah judul aplikasi adalah tombol Minimize / Maximize sidebar,
 * sedangkan Notifikasi berada di dalam menu Profil (di bawah Profil, di atas KYC).
 */
export function Sidebar({
  activeTab,
  onNavigate,
  profileClient,
  profileEmail,
  profileUsername,
  userRole,
  isSuperadmin,
  avatarUrl,
  collapsed = false,
  onToggleCollapse,
  unreadNotifications = 0,
  onOpenNotifications,
  onOpenKyc,
  onOpenSecurity,
  onOpenSettings,
  onLogout,
}: SidebarProps) {
  const t = useTranslations();
  const tNav = useTranslations('nav');

  const items: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: tNav('overview'),
      icon: <LayoutDashboard className="size-4 shrink-0" />,
    },
    {
      id: 'saldo',
      label: tNav('saldo'),
      icon: <Wallet className="size-4 shrink-0" />,
    },
    {
      id: 'debts',
      label: tNav('debts'),
      icon: <Landmark className="size-4 shrink-0" />,
    },
    {
      id: 'social',
      label: tNav('sosial'),
      icon: <Users className="size-4 shrink-0" />,
    },
  ];

  return (
    <aside
      className={cn(
        'fixed inset-y-0 z-40 hidden flex-col border-r border-[var(--line)] bg-[var(--surface-1)] transition-[width,padding] duration-200 lg:flex',
        collapsed ? 'w-[4.5rem] px-2.5 py-4' : 'w-60 p-4'
      )}
    >
      <div
        className={cn(
          'flex items-center',
          collapsed ? 'flex-col gap-2.5' : 'gap-2.5 px-1'
        )}
      >
        <BrandLogo size={collapsed ? 28 : 32} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold leading-none tracking-tight lowercase">
              stashinmeid
            </h1>
            <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">
              {t('app.tagline')}
            </span>
          </div>
        )}
        {onToggleCollapse && (
          <IconButton
            size="sm"
            variant="ghost"
            label={collapsed ? 'Perluas sidebar' : 'Kecilkan sidebar'}
            title={collapsed ? 'Perluas sidebar' : 'Kecilkan sidebar'}
            onClick={onToggleCollapse}
            className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </IconButton>
        )}
      </div>

      <nav className="mt-7 flex-1 space-y-1" aria-label={t('nav.openMenu')}>
        {items.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex w-full items-center rounded-lg py-2 text-[13px] font-medium transition-colors duration-150',
                collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                active
                  ? 'text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]/70 hover:text-[var(--text)]'
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-bg"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-[var(--surface-2)] ring-1 ring-[var(--brand)]/25"
                  aria-hidden
                />
              )}
              {active && (
                <motion.span
                  layoutId="sidebar-active-bar"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute left-0 top-1/2 z-10 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--brand)]"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'relative z-10 transition-colors',
                  active ? 'text-[var(--brand)]' : 'group-hover:text-[var(--text)]'
                )}
              >
                {item.icon}
              </span>
              {!collapsed && <span className="relative z-10 truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[var(--line)] pt-3">
        <ProfileMenu
          profileClient={profileClient}
          profileEmail={profileEmail}
          profileUsername={profileUsername}
          userRole={userRole}
          isSuperadmin={isSuperadmin}
          avatarUrl={avatarUrl}
          collapsed={collapsed}
          unreadNotifications={unreadNotifications}
          onOpenProfile={() => onNavigate('profile')}
          onOpenNotifications={onOpenNotifications}
          onOpenKyc={onOpenKyc}
          onOpenSecurity={onOpenSecurity}
          onOpenUsers={isSuperadmin || userRole === 'admin' ? () => onNavigate('users') : undefined}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />
      </div>
    </aside>
  );
}
