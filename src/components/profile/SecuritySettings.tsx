'use client';

import { useTranslations } from 'next-intl';
import { KeyRound, Lock, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SecuritySettingsProps {
  appPin: string;
  newPinInput: string;
  mfaQr: string | null;
  mfaCode: string;
  canEdit: boolean;
  onNewPinChange: (value: string) => void;
  onSavePin: () => void;
  onRemovePin: () => void;
  onLockNow: () => void;
  onEnroll2FA: () => void;
  onMfaCodeChange: (value: string) => void;
  onVerify2FA: () => void;
}

/**
 * Pengaturan keamanan pribadi: PIN aplikasi + 2FA.
 *
 * Isi persis sama dengan bekas seksi keamanan di ProfileTab; sekarang
 * dirender di dalam modal pop-up yang dibuka dari menu profil di sidebar.
 */
export function SecuritySettings({
  appPin,
  newPinInput,
  mfaQr,
  mfaCode,
  canEdit,
  onNewPinChange,
  onSavePin,
  onRemovePin,
  onLockNow,
  onEnroll2FA,
  onMfaCodeChange,
  onVerify2FA,
}: SecuritySettingsProps) {
  const tSettings = useTranslations('settings');

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
            <KeyRound className="size-4 text-[var(--brand)]" aria-hidden />
            {tSettings('security.pin')}
          </h3>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
              appPin
                ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
            }`}
          >
            {appPin ? tSettings('security.pinSet') : tSettings('security.pinNotSet')}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {tSettings('security.pinHint')}
        </p>

        {canEdit && (
          <>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="new-password"
                value={newPinInput}
                onChange={(e) =>
                  onNewPinChange(e.target.value.replace(/\D/g, ''))
                }
                placeholder={tSettings('security.pinNew')}
                aria-label={tSettings('security.pinNew')}
                className="h-10 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
              />
              <Button size="sm" onClick={onSavePin}>
                {tSettings('security.pinSave')}
              </Button>
            </div>

            {appPin && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Lock className="size-3.5" />}
                  onClick={onLockNow}
                >
                  {tSettings('security.lock')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={onRemovePin}
                >
                  {tSettings('security.pinRemove')}
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
            <Smartphone className="size-4 text-[var(--info)]" aria-hidden />
            {tSettings('security.twofa')}
          </h3>
          {mfaQr && (
            <span className="rounded bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
              {tSettings('security.twofaActive')}
            </span>
          )}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {tSettings('security.twofaHint')}
        </p>

        {!mfaQr ? (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={onEnroll2FA}
            disabled={!canEdit}
          >
            {tSettings('security.twofaEnable')}
          </Button>
        ) : (
          <div className="mt-3 space-y-3">
            {/* QR code datang sebagai data URL dari Supabase - next/image
                tidak bisa mengoptimasi data URL, jadi <img> yang tepat di sini. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mfaQr}
              alt="Kode QR 2FA"
              className="size-36 rounded-lg bg-white p-2"
            />
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(e) =>
                  onMfaCodeChange(e.target.value.replace(/\D/g, ''))
                }
                placeholder={tSettings('security.twofaVerify')}
                aria-label={tSettings('security.twofaVerify')}
                className="h-10 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
              />
              <Button size="sm" onClick={onVerify2FA}>
                {tSettings('security.twofaConfirm')}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
