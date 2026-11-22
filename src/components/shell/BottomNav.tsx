'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Activity,
  Bell,
  Crown,
  Database,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Newspaper,
  PenSquare,
  Plug,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NavTab } from './Sidebar';
import type { SocialSub } from '@/components/tabs/SocialTab';
import type { AdminSection, PersonalSection } from '@/components/tabs/SettingsTab';

interface BottomNavProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  canEdit: boolean;
  /** Tombol "+" utama: membuka menu pilihan catat (anggaran/arus kas/aset). */
  onAddMenu: () => void;
  /** Konteks sub-navigasi Sosial (menggantikan BottomNav utama saat di Sosial). */
  socialSub?: SocialSub;
  onSocialSubChange?: (sub: SocialSub) => void;
  onSocialQuickAction?: () => void;
  socialPendingBadge?: number;
  /** Konteks sub-navigasi Pengaturan (menggantikan BottomNav utama saat di Pengaturan). */
  settingsAdminMode?: boolean;
  settingsPersonalSection?: PersonalSection;
  onSettingsPersonalChange?: (section: PersonalSection) => void;
  settingsAdminSection?: AdminSection;
  onSettingsAdminChange?: (section: AdminSection) => void;
}

/**
 * Bottom nav mobile kontekstual:
 * - Default (Utama): Ringkasan, Saldo, +, Pinjaman, Sosial
 * - Saat di Sosial: Ringkasan, Obrolan, Feed, +, Kolega, Kelola, Berita
 * - Saat di Pengaturan: tab Pengaturan (Mode Pribadi / Mode Admin)
 */
export function BottomNav({
  activeTab,
  onNavigate,
  canEdit,
  onAddMenu,
  socialSub = 'kolega',
  onSocialSubChange,
  onSocialQuickAction,
  socialPendingBadge = 0,
  settingsAdminMode = false,
  settingsPersonalSection = 'appearance',
  onSettingsPersonalChange,
  settingsAdminSection = 'admin_billing',
  onSettingsAdminChange,
}: BottomNavProps) {
  const t = useTranslations();
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const isEn = locale === 'en';

  // MODE 1: SUB-NAVIGASI BAR SOSIAL (7 slot: Ringkasan, Obrolan, Feed, +, Kolega, Kelola, Berita)
  if (activeTab === 'social' && onSocialSubChange) {
    const leftSocial: {
      id: SocialSub;
      label: string;
      icon: React.ReactNode;
    }[] = [
      {
        id: 'kolega',
        label: isEn ? 'Summary' : 'Ringkasan',
        icon: <LayoutGrid className="size-[18px]" />,
      },
      {
        id: 'chat',
        label: isEn ? 'Chat' : 'Obrolan',
        icon: <MessageCircle className="size-[18px]" />,
      },
      {
        id: 'feed',
        label: 'Feed',
        icon: <PenSquare className="size-[18px]" />,
      },
    ];

    const rightSocial: {
      id: SocialSub;
      label: string;
      icon: React.ReactNode;
      badge?: number;
    }[] = [
      {
        id: 'find',
        label: isEn ? 'Colleagues' : 'Kolega',
        icon: <Users className="size-[18px]" />,
      },
      {
        id: 'manage',
        label: isEn ? 'Manage' : 'Kelola',
        icon: <UserCog className="size-[18px]" />,
        badge: socialPendingBadge,
      },
      {
        id: 'news',
        label: isEn ? 'News' : 'Berita',
        icon: <Newspaper className="size-[18px]" />,
      },
    ];

    const renderSocialSlot = (item: {
      id: SocialSub;
      label: string;
      icon: React.ReactNode;
      badge?: number;
    }) => {
      const active = socialSub === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSocialSubChange(item.id)}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors',
            active
              ? 'text-[var(--brand)]'
              : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]'
          )}
        >
          <span className="relative">
            {item.icon}
            {item.badge && item.badge > 0 ? (
              <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[8.5px] font-bold text-[var(--brand-contrast)]">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            ) : null}
          </span>
          <span className="max-w-full truncate text-[9px] font-medium leading-tight">
            {item.label}
          </span>
        </button>
      );
    };

    return (
      <nav
        aria-label={isEn ? 'Social navigation' : 'Navigasi Sosial'}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-0.5 border-t border-[var(--line)] bg-[var(--surface-1)]/95 px-1.5 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden"
      >
        {leftSocial.map(renderSocialSlot)}

        <button
          type="button"
          onClick={() =>
            onSocialQuickAction
              ? onSocialQuickAction()
              : onSocialSubChange('feed')
          }
          aria-label={isEn ? 'Create post or group' : 'Buat postingan atau grup'}
          className="mx-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-contrast)] shadow-[var(--shadow-md)] transition active:scale-95"
        >
          <Plus className="size-5" />
        </button>

        {rightSocial.map(renderSocialSlot)}
      </nav>
    );
  }

  // MODE 2: SUB-NAVIGASI BAR PENGATURAN (Mode Pribadi atau Mode Admin)
  if (activeTab === 'settings' && onSettingsPersonalChange && onSettingsAdminChange) {
    if (settingsAdminMode) {
      const adminSlots: {
        id: AdminSection;
        label: string;
        icon: React.ReactNode;
      }[] = [
        { id: 'admin_billing', label: isEn ? 'Plans' : 'Paket', icon: <Crown className="size-[18px]" /> },
        { id: 'admin_announcement', label: isEn ? 'Notice' : 'Info', icon: <Megaphone className="size-[18px]" /> },
        { id: 'admin_integrations', label: 'API', icon: <Plug className="size-[18px]" /> },
        { id: 'admin_audit', label: 'Audit', icon: <Activity className="size-[18px]" /> },
        { id: 'admin_users', label: 'Users', icon: <Users className="size-[18px]" /> },
      ];
      return (
        <nav
          aria-label={isEn ? 'Admin settings navigation' : 'Navigasi Pengaturan Admin'}
          className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-0.5 border-t border-[var(--line)] bg-[var(--surface-1)]/95 px-1.5 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden"
        >
          {adminSlots.map((item) => {
            const active = settingsAdminSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSettingsAdminChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors',
                  active
                    ? 'text-[var(--brand)]'
                    : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]'
                )}
              >
                {item.icon}
                <span className="max-w-full truncate text-[9.5px] font-medium leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      );
    }

    const personalSlots: {
      id: PersonalSection;
      label: string;
      icon: React.ReactNode;
    }[] = [
      { id: 'appearance', label: isEn ? 'Display' : 'Tampil', icon: <SlidersHorizontal className="size-[18px]" /> },
      { id: 'security', label: isEn ? 'Security' : 'Aman', icon: <ShieldCheck className="size-[18px]" /> },
      { id: 'notifications', label: isEn ? 'Alerts' : 'Notif', icon: <Bell className="size-[18px]" /> },
      { id: 'membership', label: isEn ? 'Plan' : 'Paket', icon: <Crown className="size-[18px]" /> },
      { id: 'audit', label: 'Audit', icon: <Activity className="size-[18px]" /> },
      { id: 'data', label: 'Data', icon: <Database className="size-[18px]" /> },
      { id: 'account', label: isEn ? 'Account' : 'Akun', icon: <UserCog className="size-[18px]" /> },
    ];

    return (
      <nav
        aria-label={isEn ? 'Settings navigation' : 'Navigasi Pengaturan'}
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-0.5 border-t border-[var(--line)] bg-[var(--surface-1)]/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden"
      >
        {personalSlots.map((item) => {
          const active = settingsPersonalSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSettingsPersonalChange(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors',
                active
                  ? 'text-[var(--brand)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]'
              )}
            >
              {item.icon}
              <span className="max-w-full truncate text-[9px] font-medium leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  // MODE 3: NAVIGASI BAR UTAMA (DEFAULT: Ringkasan, Saldo, +, Pinjaman, Sosial)
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
