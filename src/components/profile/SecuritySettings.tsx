'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BadgeCheck,
  FileBadge,
  Fingerprint,
  KeyRound,
  Lock,
  Pencil,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PasskeyManager } from './PasskeyManager';
import type { KycVerificationStatus } from './KycModal';

interface SecuritySettingsProps {
  appPin: string;
  newPinInput: string;
  mfaQr: string | null;
  mfaCode: string;
  canEdit: boolean;
  kycStatus?: KycVerificationStatus;
  onNewPinChange: (value: string) => void;
  onSavePin: () => void;
  onRemovePin: () => void;
  onLockNow: () => void;
  onEnroll2FA: () => void;
  onMfaCodeChange: (value: string) => void;
  onVerify2FA: () => void;
  onOpenEditProfile?: () => void;
  onOpenKyc?: () => void;
}

/**
 * Pengaturan keamanan terhubung dengan Profil & e-KYC.
 */
export function SecuritySettings({
  appPin,
  newPinInput,
  mfaQr,
  mfaCode,
  canEdit,
  kycStatus = 'unverified',
  onNewPinChange,
  onSavePin,
  onRemovePin,
  onLockNow,
  onEnroll2FA,
  onMfaCodeChange,
  onVerify2FA,
  onOpenEditProfile,
  onOpenKyc,
}: SecuritySettingsProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const tSettings = useTranslations('settings');
  const [passkeyCount, setPasskeyCount] = useState(0);

  return (
    <div className="space-y-4">
      {/* Passkey - status badge mencerminkan jumlah passkey nyata */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
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
      </section>

      {/* 2FA - melindungi akun dari orang lain */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
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

        {!mfaQr ? (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={onEnroll2FA}
            disabled={!canEdit}
            icon={<ShieldCheck className="size-3.5" />}
          >
            {tSettings('security.twofaEnable')}
          </Button>
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

      {/* PIN aplikasi - hanya kunci perangkat ini */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
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

        {canEdit && (
          <>
            <div className="mt-3 flex gap-2">
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
              <div className="mt-2 flex gap-2">
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
          </>
        )}
      </section>

      {/* Password & Verifikasi e-KYC Terhubung Langsung */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <section className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
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
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              icon={<Pencil className="size-3.5" />}
              onClick={onOpenEditProfile}
            >
              {isEn ? 'Change Password & Profile' : 'Ubah Password & Profil'}
            </Button>
          )}
        </section>

        <section className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <div>
            <SecurityHeader
              icon={<FileBadge className="size-4 text-[var(--info)]" />}
              title={isEn ? 'Identity e-KYC' : 'Verifikasi e-KYC'}
              status={
                kycStatus === 'verified'
                  ? isEn
                    ? 'Verified'
                    : 'Terverifikasi'
                  : kycStatus === 'pending'
                    ? isEn
                      ? 'Pending'
                      : 'Menunggu'
                    : isEn
                      ? 'Unverified'
                      : 'Belum Verifikasi'
              }
              statusOn={kycStatus === 'verified'}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {isEn
                ? 'Third-party identity check (+30% unified profile completeness).'
                : 'Verifikasi identitas lewat provider pihak ketiga (+30% skor kelengkapan profil).'}
            </p>
          </div>
          {onOpenKyc && (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              icon={<BadgeCheck className="size-3.5" />}
              onClick={onOpenKyc}
            >
              {isEn ? 'Open e-KYC Portal' : 'Buka Portal e-KYC'}
            </Button>
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
        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
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
