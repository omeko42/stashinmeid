'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

/**
 * Penghitung global jumlah modal aktif agar modal bertumpuk (mis. ConfirmProvider
 * di atas Modal lain) tidak pernah meninggalkan `body.style.overflow = 'hidden'`
 * tersangkut saat ditutup atau berpindah halaman (termasuk ke /demo).
 */
let activeModalCount = 0;

function lockBodyScroll() {
  activeModalCount += 1;
  if (activeModalCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

function unlockBodyScroll() {
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    document.body.style.overflow = '';
  }
}

/**
 * Modal yang aksesibel:
 * - focus dipindah ke panel saat dibuka
 * - Escape menutup
 * - klik backdrop menutup
 * - scroll lock aman untuk modal bertumpuk (reference-counted)
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  headerAction,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', onKeyDown);
    lockBodyScroll();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
  } as const;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] sm:pb-0',
              'rounded-t-2xl border border-[var(--line)] bg-[var(--surface-1)] shadow-[var(--shadow-lg)] sm:rounded-2xl',
              sizes[size]
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-[15px] font-semibold text-[var(--text)]">{title}</h2>
                {description && (
                  <p className="text-[12px] text-[var(--text-muted)]">{description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {headerAction}
                <IconButton label="Close" size="sm" onClick={onClose}>
                  <X className="size-4" />
                </IconButton>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
