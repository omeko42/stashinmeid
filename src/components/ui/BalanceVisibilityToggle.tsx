'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton } from './Button';
import { useBalancePrivacy } from './BalancePrivacy';

/**
 * Tombol ikon mata untuk menyembunyikan / menampilkan nominal saldo.
 *
 * Statusnya global - sekali diklik, semua nominal uang di aplikasi ikut
 * tersembunyi. Sumber kebenarannya `BalancePrivacyProvider`.
 */
export function BalanceVisibilityToggle({
  className,
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  const t = useTranslations('settings.balance');
  const { hidden, toggle, ready } = useBalancePrivacy();

  return (
    <IconButton
      label={hidden ? t('show') : t('hide')}
      title={hidden ? t('show') : t('hide')}
      variant="ghost"
      size={size}
      onClick={toggle}
      className={className}
      // Sebelum localStorage terbaca, disable supaya tidak ada state yang
      // belum sinkron.
      disabled={!ready}
      aria-pressed={hidden}
    >
      {hidden ? (
        <EyeOff className="size-4" aria-hidden />
      ) : (
        <Eye className="size-4" aria-hidden />
      )}
    </IconButton>
  );
}
