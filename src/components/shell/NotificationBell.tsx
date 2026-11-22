'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  MessageCircle,
  UserPlus,
  Users,
  Trash2,
} from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';

/**
 * Event navigasi global.
 *
 * Notifikasi hidup di header, tapi tombol notifikasi harus bisa
 * mengarahkan user ke tab yang relevan. Daripada menarik state notifikasi
 * dan callback navigasi lewat beberapa level prop, lonceng ini
 * menembakkan event; DashboardClient yang mendengarkan.
 */
export const NAVIGATE_EVENT = 'stashinmeid:navigate';

/**
 * Minta aplikasi pindah ke tab tertentu.
 *
 * `sub` dipakai untuk tab yang punya sub-tab (mis. sosial: chat).
 */
export function navigateToTab(tab: string, sub?: string) {
  window.dispatchEvent(
    new CustomEvent(NAVIGATE_EVENT, { detail: { tab, sub } })
  );
}

/**
 * Ikon lonceng notifikasi.
 *
 * Badge merah menunjukkan jumlah notifikasi yang belum dibaca. Panel
 * dibuka dengan klik, ditutup dengan klik di luar atau tekan Escape.
 *
 * Data diambil sendiri lewat `useNotifications`, jadi komponen ini bisa
 * dipakai di header mana pun tanpa drilling props.
 */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    remove,
  } = useNotifications();

  // Tutup panel kalau klik di luar, atau tekan Escape.
  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <IconButton
        ref={buttonRef}
        label={t('title')}
        title={t('title')}
        size="sm"
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-[var(--out)] px-1 text-[9px] font-bold leading-[16px] text-white"
            aria-label={`${unreadCount} notifikasi belum dibaca`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </IconButton>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('title')}
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)] shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <h3 className="text-[13px] font-semibold text-[var(--text)]">
              {t('title')}
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--brand)] hover:underline"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                {t('markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-5" />}
                title={t('emptyTitle')}
                description={t('emptyHint')}
                className="border-0"
              />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onMarkRead={markRead}
                    onRemove={remove}
                    onClose={() => setOpen(false)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Satu baris notifikasi. */
function NotificationRow({
  notification: n,
  onMarkRead,
  onRemove,
  onClose,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('notifications');
  const unread = !n.readAt;

  const Icon = (() => {
    switch (n.type) {
      case 'connection_requested':
        return UserPlus;
      case 'connection_accepted':
        return Check;
      case 'group_member_joined':
        return Users;
      case 'chat_message':
        return MessageCircle;
      default:
        return Bell;
    }
  })();

  return (
    <li
      className={cn(
        'flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]',
        unread && 'bg-[var(--brand-soft)]/30'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
          unread
            ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
            : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => {
            if (unread) onMarkRead(n.id);
            if (n.link) {
              // Format link notifikasi: "tab:<tab>" atau
              // "tab:<tab>:<sub-tab>".
              const parts = n.link.split(':');
              if (parts[0] === 'tab' && parts[1]) {
                navigateToTab(parts[1], parts[2]);
              }
              onClose();
            }
          }}
          className="block w-full text-left"
        >
          <p
            className={cn(
              'text-[12px] leading-snug',
              unread
                ? 'font-semibold text-[var(--text)]'
                : 'font-medium text-[var(--text-muted)]'
            )}
          >
            {n.title}
          </p>
          {n.body && (
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-faint)]">
              {n.body}
            </p>
          )}
          <time className="mt-1 block text-[10px] text-[var(--text-faint)]">
            {formatRelative(n.createdAt)}
          </time>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {unread && (
          <IconButton
            label={t('markRead')}
            title={t('markRead')}
            variant="ghost"
            size="sm"
            onClick={() => onMarkRead(n.id)}
          >
            <Check className="size-3.5" />
          </IconButton>
        )}
        <IconButton
          label={t('remove')}
          title={t('remove')}
          variant="ghost"
          size="sm"
          onClick={() => onRemove(n.id)}
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </li>
  );
}

/** Waktu relatif ringkas: "baru saja", "5 menit lalu", "kemarin". */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'kemarin';
  if (days < 7) return `${days} hari lalu`;

  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}
