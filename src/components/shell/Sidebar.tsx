'use client';

import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  SlidersHorizontal,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react';
import type { UserRole } from '@/types/finance';
import { BrandLogo } from '@/components/BrandLogo';
import { ProfileMenu } from '@/components/shell/ProfileMenu';
import { cn } from '@/lib/cn';

export type NavTab =
  | 'overview'
  | 'cashflow'
  | 'debts'
  | 'budget'
  | 'assets'
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
  onOpenKyc: () => void;
  onOpenSecurity: () => void;
  onLogout: () => void;
}

/**
 * Sidebar desktop.
 *
 * Navigasi aktif ditandai dengan garis di kiri, bukan dengan gradient. Satu
 * elemen aktif harus terbaca sekilas tanpa harus dibaca labelnya.
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
  onOpenKyc,
  onOpenSecurity,
  onLogout,
}: SidebarProps) {
  const t = useTranslations();
  const tNav = useTranslations('nav');

  const items: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: tNav('overview'),
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      id: 'cashflow',
      label: tNav('cashflow'),
      icon: <ArrowLeftRight className="size-4" />,
    },
    {
      id: 'debts',
      label: tNav('debts'),
      icon: <Landmark className="size-4" />,
    },
    {
      id: 'budget',
      label: t('budget.title'),
      icon: <Wallet className="size-4" />,
    },
    {
      id: 'settings',
      label: tNav('settings'),
      icon: <SlidersHorizontal className="size-4" />,
    },
  ];

  return (
    <aside className="fixed inset-y-0 z-30 hidden w-60 flex-col border-r border-[var(--line)] bg-[var(--surface-1)] p-4 lg:flex">
      <div className="flex items-center gap-2.5 px-1">
        <BrandLogo size={32} />
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold leading-none tracking-tight lowercase">
            stashinmeid
          </h1>
          <span className="text-[10px] text-[var(--text-muted)]">
            {t('app.tagline')}
          </span>
        </div>
      </div>

      <nav className="mt-7 flex-1 space-y-0.5" aria-label={t('nav.openMenu')}>
        {items.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-[var(--surface-2)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--brand)]"
                  aria-hidden
                />
              )}
              {item.icon}
              {item.label}
            </button>
          );
        })}

        <div className="my-3 border-t border-[var(--line)]" />

        <button
          type="button"
          onClick={() => onNavigate('profile')}
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={cn(
            'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
            activeTab === 'profile'
              ? 'bg-[var(--surface-2)] text-[var(--text)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
          )}
        >
          {activeTab === 'profile' && (
            <span
              className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--brand)]"
              aria-hidden
            />
          )}
          <UserCircle className="size-4" />
          {tNav('profile')}
        </button>

        {isSuperadmin && (
          <button
            type="button"
            onClick={() => onNavigate('users')}
            aria-current={activeTab === 'users' ? 'page' : undefined}
            className={cn(
              'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
              activeTab === 'users'
                ? 'bg-[var(--surface-2)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
            )}
          >
            {activeTab === 'users' && (
              <span
                className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--brand)]"
                aria-hidden
              />
            )}
            <Users className="size-4" />
            {tNav('users')}
          </button>
        )}
      </nav>

      <div className="border-t border-[var(--line)] pt-3">
        <ProfileMenu
          profileClient={profileClient}
          profileEmail={profileEmail}
          profileUsername={profileUsername}
          userRole={userRole}
          avatarUrl={avatarUrl}
          onOpenProfile={() => onNavigate('profile')}
          onOpenKyc={onOpenKyc}
          onOpenSecurity={onOpenSecurity}
          onLogout={onLogout}
        />
      </div>
    </aside>
  );
}
