'use client';

import { useTranslations } from 'next-intl';
import { KeyRound, Lock, Pencil, Shield, Smartphone, UserCircle } from 'lucide-react';
import type { UserRole } from '@/types/finance';
import { Amount, Label, Progress, Rule } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';

interface ProfileTabProps {
  profileUsername: string;
  profileEmail: string;
  profileClient: string;
  profileBio: string;
  userRole: UserRole;
  profileCompleteness: number;
  appPin: string;
  newPinInput: string;
  mfaQr: string | null;
  mfaCode: string;
  canEdit: boolean;
  onEditProfile: () => void;
  onNewPinChange: (value: string) => void;
  onSavePin: () => void;
  onRemovePin: () => void;
  onLockNow: () => void;
  onEnroll2FA: () => void;
  onMfaCodeChange: (value: string) => void;
  onVerify2FA: () => void;
}

/**
 * Profil & keamanan.
 *
 * Dua kolom: identitas di kiri (dengan avatar dan kelengkapan data),
 * keamanan di kanan. Bagian keamanan dipisah oleh garis, bukan kartu
 * tersendiri - ini masih satu halaman.
 */
export function ProfileTab({
  profileUsername,
  profileEmail,
  profileClient,
  profileBio,
  userRole,
  profileCompleteness,
  appPin,
  newPinInput,
  mfaQr,
  mfaCode,
  canEdit,
  onEditProfile,
  onNewPinChange,
  onSavePin,
  onRemovePin,
  onLockNow,
  onEnroll2FA,
  onMfaCodeChange,
  onVerify2FA,
}: ProfileTabProps) {
  const tSettings = useTranslations('settings');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--text)]">
          {tSettings('profile.cover')}
        </h2>
        <p className="text-[12px] text-[var(--text-muted)]">
          {tSettings('title')} · {tSettings('subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identitas */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)]">
                <UserCircle className="size-8 text-[var(--text-faint)]" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-semibold text-[var(--text)]">
                  {profileClient}
                </h3>
                <p className="tnum mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                  @{profileUsername}
                </p>
                <p className="truncate text-[12px] text-[var(--text-faint)]">
                  {profileEmail || tSettings('profile.emailNotSet')}
                </p>
              </div>
            </div>

            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Pencil className="size-3.5" />}
                onClick={onEditProfile}
                className="shrink-0"
              >
                {tSettings('profile.edit')}
              </Button>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <Label>{tSettings('profile.completeness')}</Label>
              <Amount
                value={`${profileCompleteness}%`}
                tone={profileCompleteness >= 80 ? 'brand' : 'due'}
                size="sm"
              />
            </div>
            <Progress
              value={profileCompleteness}
              tone={profileCompleteness >= 80 ? 'brand' : 'due'}
              className="mt-1.5"
            />
          </div>

          <Rule className="my-4" />

          <div className="space-y-1.5">
            <Label>{tSettings('profile.bio')}</Label>
            <p className="text-[13px] leading-relaxed text-[var(--text)]">
              {profileBio || tSettings('profile.bioPlaceholder')}
            </p>
          </div>
        </section>

        {/* Info akun */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
            <Shield className="size-4 text-[var(--brand)]" aria-hidden />
            {tSettings('sections.profile')}
          </h3>

          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {tSettings('profile.username')}
              </dt>
              <dd className="tnum mt-0.5 text-[13px] text-[var(--text)]">
                @{profileUsername}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {tSettings('profile.email')}
              </dt>
              <dd className="mt-0.5 truncate text-[13px] text-[var(--text)]">
                {profileEmail || tSettings('profile.emailNotSet')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {tSettings('profile.workspace')}
              </dt>
              <dd className="mt-0.5 truncate text-[13px] text-[var(--text)]">
                {profileClient}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {tSettings('profile.role')}
              </dt>
              <dd className="mt-1">
                <span className="inline-block rounded bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--brand)]">
                  {userRole}
                </span>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Keamanan */}
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
    </div>
  );
}
