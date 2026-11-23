'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  MessageCircle,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import type { UserRole } from '@/types/finance';
import type { SocialSub } from '@/components/tabs/SocialTab';
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
  socialSub?: SocialSub;
  onSelectSocialSub?: (sub: SocialSub) => void;
  socialManageBadge?: number;
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
 * Sidebar desktop dengan dukungan Minimize / Maximize dan dropdown sub-menu Sosial.
 */
export function Sidebar({
  activeTab,
  onNavigate,
  socialSub = 'kolega',
  onSelectSocialSub,
  socialManageBadge = 0,
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
  const tSos = useTranslations('sosial');

  const [socialExpanded, setSocialExpanded] = useState(activeTab === 'social');

  useEffect(() => {
    if (activeTab === 'social') {
      setSocialExpanded(true);
    }
  }, [activeTab]);

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

  const socialItems: {
    id: SocialSub;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'kolega',
      label: 'Ringkasan',
      icon: <LayoutGrid className="size-3.5 shrink-0" />,
    },
    {
      id: 'chat',
      label: tSos('chat'),
      icon: <MessageCircle className="size-3.5 shrink-0" />,
    },
    {
      id: 'feed',
      label: 'Feed',
      icon: <PenSquare className="size-3.5 shrink-0" />,
    },
    {
      id: 'find',
      label: 'Kolega',
      icon: <Users className="size-3.5 shrink-0" />,
    },
    {
      id: 'manage',
      label: 'Kelola Kolega',
      icon: <UserCog className="size-3.5 shrink-0" />,
      badge: socialManageBadge,
    },
    {
      id: 'news',
      label: 'Berita',
      icon: <Newspaper className="size-3.5 shrink-0" />,
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

      <nav
        className="mt-7 flex-1 space-y-1 overflow-y-auto pr-0.5"
        aria-label={t('nav.openMenu')}
      >
        {items.map((item) => {
          const active = activeTab === item.id;
          const isSocial = item.id === 'social';

          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (isSocial && !collapsed) {
                    if (activeTab === 'social') {
                      setSocialExpanded((v) => !v);
                    } else {
                      setSocialExpanded(true);
                      onNavigate('social');
                    }
                  } else {
                    onNavigate(item.id);
                  }
                }}
                aria-current={active ? 'page' : undefined}
                aria-expanded={isSocial && !collapsed ? socialExpanded : undefined}
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
                {!collapsed && (
                  <span className="relative z-10 flex-1 truncate text-left">
                    {item.label}
                  </span>
                )}
                {!collapsed && isSocial && (
                  <span className="relative z-10 flex items-center gap-1.5">
                    {!socialExpanded && socialManageBadge > 0 && (
                      <span className="tnum flex min-w-[16px] items-center justify-center rounded-full bg-[var(--out)] px-1 text-[10px] font-bold leading-[16px] text-white">
                        {socialManageBadge}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'size-3.5 text-[var(--text-faint)] transition-transform duration-200',
                        socialExpanded && 'rotate-180 text-[var(--brand)]'
                      )}
                      aria-hidden
                    />
                  </span>
                )}
              </button>

              {/* Dropdown sub-menu Sosial di sidebar PC */}
              {isSocial && !collapsed && (
                <AnimatePresence initial={false}>
                  {socialExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="ml-4 mt-1 space-y-0.5 border-l border-[var(--line)] pl-2.5">
                        {socialItems.map((subItem) => {
                          const subActive =
                            activeTab === 'social' && socialSub === subItem.id;
                          return (
                            <button
                              key={subItem.id}
                              type="button"
                              onClick={() => {
                                if (onSelectSocialSub) {
                                  onSelectSocialSub(subItem.id);
                                } else {
                                  onNavigate('social');
                                }
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                                subActive
                                  ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand)]'
                                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                              )}
                            >
                              {subItem.icon}
                              <span className="flex-1 truncate text-left">
                                {subItem.label}
                              </span>
                              {subItem.badge !== undefined && subItem.badge > 0 && (
                                <span className="tnum flex min-w-[16px] items-center justify-center rounded-full bg-[var(--out)] px-1 text-[10px] font-bold leading-[16px] text-white">
                                  {subItem.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
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
