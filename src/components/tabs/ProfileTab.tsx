'use client';

import { useTranslations } from 'next-intl';
import { Pencil, Shield, UserCircle } from 'lucide-react';
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
  canEdit: boolean;
  onEditProfile: () => void;
}

/**
 * Profil.
 *
 * Identitas, kelengkapan data, dan bio. Keamanan pribadi (PIN, 2FA) pindah
 * ke modal yang dibuka dari menu profil di pojok kiri bawah sidebar.
 */
export function ProfileTab({
  profileUsername,
  profileEmail,
  profileClient,
  profileBio,
  userRole,
  profileCompleteness,
  canEdit,
  onEditProfile,
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
    </div>
  );
}
