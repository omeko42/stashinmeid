'use client';

import { useTranslations } from 'next-intl';
import {
  Fingerprint,
  KeyRound,
  Lock,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PasskeyManager } from './PasskeyManager';

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
 * Pengaturan keamanan.
 *
 * Empat cara masuk yang berbeda, masing-masing dengan statusnya sendiri
 * supaya user langsung tahu mana yang sudah aktif:
 *
 *   1. Password   - selalu ada (dikelola di menu profil).
 *   2. Passkey    - daftar perPasskey, bisa dihapus.
 *   3. 2FA (TOTP) - opsional, sekali aktif minta kode saat login.
 *   4. PIN aplikasi - kunci layar aplikasi di perangkat ini saja.
 *
 * Bedanya penting untuk user: 2FA dan passkey melindungi akun dari
 * orang lain, sedangkan PIN aplikasi hanya melindungi data di layar
 * perangkat yang sedang dipakai. Jadi urutannya dari yang paling
 * relevan ke yang paling lokal.
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
    <div className="space-y-4">
      {/* Passkey - metode login tanpa password, jadi paling relevan */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <SecurityHeader
          icon={<Fingerprint className="size-4 text-[var(--brand)]" />}
          title={tSettings('security.passkey.title')}
          status={tSettings('security.passkeyStatus')}
          statusOn
        />
        <PasskeyManager />
      </section>

      {/* 2FA - melindungi akun dari orang lain */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <SecurityHeader
          icon={<Smartphone className="size-4 text-[var(--info)]" />}
          title={tSettings('security.twofa')}
          status={
            mfaQr ? tSettings('security.twofaActive') : tSettings('security.twofaOff')
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
            {/* QR code datang sebagai data URL dari Supabase - next/image
                tidak bisa mengoptimasi data URL, jadi <img> yang tepat di sini. */}
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
            appPin ? tSettings('security.pinSet') : tSettings('security.pinNotSet')
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

      {/* Password - pretaut yang singkat soal di mana dikelola */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <SecurityHeader
          icon={<KeyRound className="size-4 text-[var(--brand)]" />}
          title={tSettings('security.password')}
          status={tSettings('security.passwordManaged')}
          statusOn
        />
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {tSettings('security.passwordHint')}
        </p>
      </section>
    </div>
  );
}

/**
 * Kepala seksi keamanan: ikon, judul, dan badge status.
 *
 * Badge status memakai dua warna supaya kelihatan aktif vs belum -
 * "belum aktif" bukan berarti salah, tapi belum dipakai.
 */
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
