'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Fingerprint,
  KeyRound,
  Lock,
  Pencil,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PasskeyManager } from './PasskeyManager';

export interface SecuritySettingsProps {
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
  onOpenEditProfile?: () => void;
}

/**
 * Halaman Keamanan Akun (khusus proteksi akses: Passkey, 2FA, PIN Perangkat, & Password).
 * Verifikasi Identitas (e-KYC) dipisahkan di menu sendiri agar tidak tercampur.
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
  onOpenEditProfile,
}: SecuritySettingsProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const tSettings = useTranslations('settings');
  const [passkeyCount, setPasskeyCount] = useState(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 1. Passkey */}
        <section className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
          <div>
            <SecurityHeader
              icon={<Fingerprint className="size-4 text-[var(--brand)]" />}
              title={tSettings('security.passkey.title')}
              status={
                passkeyCount > 0
                  ? `${tSettings('security.passkeyStatus')} (${passkeyCount})`
                  : isEn
                    ? 'Not registered'
                    : 'Belum terdaftar'
              }
              statusOn={passkeyCount > 0}
            />
            <div className="mt-3">
              <PasskeyManager onCountChange={setPasskeyCount} />
            </div>
          </div>
        </section>

        {/* 2. 2FA Authenticator */}
        <section className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
          <div>
            <SecurityHeader
              icon={<Smartphone className="size-4 text-[var(--info)]" />}
              title={tSettings('security.twofa')}
              status={
                mfaQr
                  ? tSettings('security.twofaActive')
                  : tSettings('security.twofaOff')
              }
              statusOn={Boolean(mfaQr)}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {tSettings('security.twofaHint')}
            </p>
          </div>

          {!mfaQr ? (
            <div className="mt-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={onEnroll2FA}
                disabled={!canEdit}
                icon={<ShieldCheck className="size-3.5" />}
              >
                {tSettings('security.twofaEnable')}
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mfaQr}
                alt="Kode QR 2FA"
                className="size-36 rounded-lg bg-white p-2"
              />
              <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                {tSettings('security.twofaScanHint')}
              </p>
              <div className="flex gap-2">
                <input
                  id="security-mfa-code"
                  name="mfaCode"
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

        {/* 3. PIN Kunci Perangkat */}
        <section className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
          <div>
            <SecurityHeader
              icon={<Lock className="size-4 text-[var(--text-muted)]" />}
              title={tSettings('security.pin')}
              status={
                appPin
                  ? tSettings('security.pinSet')
                  : tSettings('security.pinNotSet')
              }
              statusOn={Boolean(appPin)}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {tSettings('security.pinHint')}
            </p>
          </div>

          {canEdit && (
            <div className="mt-4">
              <div className="flex gap-2">
                <input
                  id="security-new-pin"
                  name="newPin"
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
                <div className="mt-2.5 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onLockNow}
                    icon={<Lock className="size-3.5" />}
                  >
                    {tSettings('security.lockNow')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onRemovePin}>
                    {tSettings('security.pinRemove')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4. Password Akun */}
        <section className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
          <div>
            <SecurityHeader
              icon={<KeyRound className="size-4 text-[var(--brand)]" />}
              title={tSettings('security.password')}
              status={tSettings('security.passwordManaged')}
              statusOn
            />
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {tSettings('security.passwordHint')}
            </p>
          </div>
          {onOpenEditProfile && (
            <div className="mt-4">
              <Button
                size="sm"
                variant="secondary"
                icon={<Pencil className="size-3.5" />}
                onClick={onOpenEditProfile}
              >
                {isEn ? 'Change Password & Profile' : 'Ubah Password & Profil'}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SecurityHeader({
  icon,
  title,
  status,
  statusOn,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  statusOn: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
        {icon}
        {title}
      </h3>
      <span
        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
          statusOn
            ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
            : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
        }`}
      >
        {status}
      </span>
    </div>
  );
}
