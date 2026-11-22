'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  ChevronUp,
  LogOut,
  Shield,
  SlidersHorizontal,
  UserCircle,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UserRole } from '@/types/finance';
import { cn } from '@/lib/cn';

interface ProfileMenuProps {
  profileClient: string;
  profileEmail: string;
  profileUsername: string;
  userRole: UserRole;
  isSuperadmin: boolean;
  avatarUrl?: string | null;
  collapsed?: boolean;
  unreadNotifications?: number;
  onOpenProfile: () => void;
  /** Di bawah Profil, di atas Verifikasi KYC sesuai permintaan user. */
  onOpenNotifications?: () => void;
  /** Diauditkan bila KYC modal siap (patch 4); item KYC muncul bila handler ada. */
  onOpenKyc?: () => void;
  onOpenSecurity: () => void;
  /** Manajemen user - hanya muncul di role admin / superadmin. */
  onOpenUsers?: () => void;
  /** Pengaturan - pindah dari item sidebar ke menu profil. */
  onOpenSettings?: () => void;
  onLogout: () => void;
}

/**
 * Profil di pojok kiri bawah sidebar.
 *
 * Bukan sekadar informasi - jadi menu pintasan: Profil, Notifikasi, KYC,
 * dan keamanan pribadi (modal). Buka ke atas supaya tetap di jangkauan bawah.
 */
export function ProfileMenu({
  profileClient,
  profileEmail,
  profileUsername,
  userRole,
  isSuperadmin,
  avatarUrl,
  collapsed = false,
  unreadNotifications = 0,
  onOpenProfile,
  onOpenNotifications,
  onOpenKyc,
  onOpenSecurity,
  onOpenUsers,
  onOpenSettings,
  onLogout,
}: ProfileMenuProps) {
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

  const items: {
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    action: () => void;
  }[] = [
    {
      id: 'bio',
      label: tSettings('profile.bio'),
      icon: <UserCircle className="size-4" aria-hidden />,
      action: onOpenProfile,
    },
    ...(onOpenNotifications
      ? [
          {
            id: 'notifications',
            label: tNotif('title'),
            icon: <Bell className="size-4" aria-hidden />,
            badge: unreadNotifications,
            action: onOpenNotifications,
          },
        ]
      : []),
    ...(onOpenKyc
      ? [
          {
            id: 'kyc',
            label: tSettings('kyc.title'),
            icon: <BadgeCheck className="size-4" aria-hidden />,
            action: onOpenKyc,
          },
        ]
      : []),
    {
      id: 'security',
      label: tSettings('security.title'),
      icon: <Shield className="size-4" aria-hidden />,
      action: onOpenSecurity,
    },
    // Manajemen user di bawah keamanan; hanya role admin / superadmin.
    ...(onOpenUsers && (userRole === 'admin' || isSuperadmin)
      ? [
          {
            id: 'users',
            label: tNav('users'),
            icon: <Users className="size-4" aria-hidden />,
            action: onOpenUsers,
          },
        ]
      : []),
    // Pengaturan pindah ke sini dari item sidebar (slotnya diganti Sosial).
    ...(onOpenSettings
      ? [
          {
            id: 'settings',
            label: tNav('settings'),
            icon: <SlidersHorizontal className="size-4" aria-hidden />,
            action: onOpenSettings,
          },
        ]
      : []),
  ];

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)] shadow-lg',
            collapsed ? 'w-56' : 'right-0'
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.action();
              }}
              className="flex w-full items-center justify-between gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="text-[var(--text-muted)]">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="tnum flex min-w-[18px] items-center justify-center rounded-full bg-[var(--out)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          ))}

          <div className="border-t border-[var(--line)]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-[var(--out)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <LogOut className="size-4" aria-hidden />
            {tNav('signOut')}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={collapsed ? `${profileClient} (${profileEmail || `@${profileUsername}`})` : undefined}
        className={cn(
          'flex w-full items-center rounded-lg border border-transparent text-left transition-colors hover:bg-[var(--surface-2)]',
          collapsed ? 'justify-center p-1.5' : 'gap-2.5 px-2.5 py-2',
          open && 'border-[var(--line)] bg-[var(--surface-2)]'
        )}
      >
        {/* Foto profil dari menu Bio; inisial jaga posisi sebelum ada filenya. */}
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--text-muted)]">
          <span className="flex size-full items-center justify-center overflow-hidden rounded-full">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              (profileClient || '?').slice(0, 1).toUpperCase()
            )}
          </span>
          {unreadNotifications > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex min-w-[15px] items-center justify-center rounded-full bg-[var(--out)] px-1 text-[9px] font-bold leading-[15px] text-white ring-2 ring-[var(--surface-1)]"
              aria-label={`${unreadNotifications} notifikasi belum dibaca`}
            >
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-[var(--text)]">
                {profileClient}
              </span>
              <span className="block truncate text-[11px] text-[var(--text-muted)]">
                {profileEmail || `@${profileUsername}`}
              </span>
            </span>
            <ChevronUp
              className={cn(
                'size-4 shrink-0 text-[var(--text-muted)] transition-transform',
                open && 'rotate-180'
              )}
              aria-hidden
            />
          </>
        )}
      </button>

      <span className="sr-only">{userRole}</span>
    </div>
  );
}
