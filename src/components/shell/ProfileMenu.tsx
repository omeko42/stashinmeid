'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { BadgeCheck, ChevronUp, LogOut, Shield, UserCircle, Users } from 'lucide-react';
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
  onOpenProfile: () => void;
  /** Diauditkan bila KYC modal siap (patch 4); item KYC muncul bila handler ada. */
  onOpenKyc?: () => void;
  onOpenSecurity: () => void;
  /** Manajemen user - hanya muncul di role admin / superadmin. */
  onOpenUsers?: () => void;
  onLogout: () => void;
}

/**
 * Profil di pojok kiri bawah sidebar.
 *
 * Bukan sekadar informasi - jadi menu pintasan: Bio, KYC, dan keamanan
 * pribadi (modal). Buka ke atas supaya tetap di jangkauan bawah.
 */
export function ProfileMenu({
  profileClient,
  profileEmail,
  profileUsername,
  userRole,
  isSuperadmin,
  avatarUrl,
  onOpenProfile,
  onOpenKyc,
  onOpenSecurity,
  onOpenUsers,
  onLogout,
}: ProfileMenuProps) {
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

  const items = [
    {
      id: 'bio',
      label: tSettings('profile.bio'),
      icon: <UserCircle className="size-4" aria-hidden />,
      action: onOpenProfile,
    },
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
  ];

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute bottom-full left-0 right-0 z-40 mb-2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)] shadow-lg"
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
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="text-[var(--text-muted)]">{item.icon}</span>
              {item.label}
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
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-2)]',
          open && 'border-[var(--line)] bg-[var(--surface-2)]'
        )}
      >
        {/* Foto profil dari menu Bio; inisial jaga posisi sebelum ada filenya. */}
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--text-muted)]">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            (profileClient || '?').slice(0, 1).toUpperCase()
          )}
        </span>
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
      </button>

      <span className="sr-only">{userRole}</span>
    </div>
  );
}
