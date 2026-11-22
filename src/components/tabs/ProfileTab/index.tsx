'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Circle,
  Crown,
  FileBadge,
  Images,
  Lock,
  Pencil,
  Shield,
  SlidersHorizontal,
  UserCircle,
} from 'lucide-react';
import type { UserRole } from '@/types/finance';
import type { KycVerificationStatus } from '@/components/profile/KycModal';
import { Amount, Progress, Rule, Label } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { KolegaSection } from '@/components/profile/KolegaSection';
import type { KolegaApi } from '@/hooks/useKolega';
import type { ConnectionsApi } from '@/hooks/useConnections';
import { createClient } from '@/lib/supabase/client';

interface ProfileTabProps {
  profileUsername: string;
  profileEmail: string;
  profileClient: string;
  profileBio: string;
  userRole: UserRole;
  profileCompleteness: number;
  profileAvatarUrl: string | null;
  profileBannerUrl: string | null;
  appPinSet?: boolean;
  kycStatus?: KycVerificationStatus;
  canEdit: boolean;
  onEditProfile: () => void;
  onOpenSecurity?: () => void;
  onOpenKyc?: () => void;
  onOpenSettings?: () => void;
  onProfileMediaChange: (avatarUrl: string | null, bannerUrl: string | null) => void;
  kolega: KolegaApi;
  connections: ConnectionsApi;
}

/**
 * Profil & Keamanan Terpadu.
 *
 * Skor Kelengkapan Akun (100%) terhubung langsung dengan:
 *   1. Identitas & Email (30%)
 *   2. Bio & Foto Profil (20%)
 *   3. Proteksi PIN / 2FA (20%)
 *   4. Verifikasi e-KYC Pihak Ketiga (30%)
 *
 * Setiap item di bawah bar kelengkapan bisa langsung diklik untuk membuka
 * pengaturan terkait sehingga Profil, Keamanan, KYC, dan Pengaturan saling menyatu.
 */
export function ProfileTab({
  profileUsername,
  profileEmail,
  profileClient,
  profileBio,
  userRole,
  profileCompleteness,
  profileAvatarUrl,
  profileBannerUrl,
  appPinSet = false,
  kycStatus = 'unverified',
  canEdit,
  onEditProfile,
  onOpenSecurity,
  onOpenKyc,
  onOpenSettings,
  onProfileMediaChange,
  kolega,
  connections,
}: ProfileTabProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const t = useTranslations();
  const tSettings = useTranslations('settings');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(profileAvatarUrl);
  const [bannerUrl, setBannerUrl] = useState(profileBannerUrl);
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);

  useEffect(() => {
    setAvatarUrl(profileAvatarUrl);
  }, [profileAvatarUrl]);

  useEffect(() => {
    setBannerUrl(profileBannerUrl);
  }, [profileBannerUrl]);

  const uploadMedia = async (
    kind: 'avatar' | 'banner',
    file: File,
    currentUrl: string | null
  ) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error(t('settings.profile.saveFailed'));
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUploading(kind);
    try {
      const bucket = kind === 'avatar' ? 'avatars' : 'banners';
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadErr && !uploadErr.message.includes('already')) throw uploadErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const { error: dbErr } = await supabase
        .from('profiles')
        .update(kind === 'avatar' ? { avatar_url: publicUrl } : { banner_url: publicUrl })
        .eq('id', user.id);
      if (dbErr) throw dbErr;

      if (currentUrl) {
        try {
          const oldPath = new URL(currentUrl).pathname.split(`/${bucket}/`)[1];
          if (oldPath) await supabase.storage.from(bucket).remove([decodeURIComponent(oldPath)]);
        } catch {
          /* biarkan */
        }
      }

      if (kind === 'avatar') setAvatarUrl(publicUrl);
      else setBannerUrl(publicUrl);
      onProfileMediaChange(
        kind === 'avatar' ? publicUrl : avatarUrl,
        kind === 'banner' ? publicUrl : bannerUrl
      );
      toast.success(tSettings('profile.saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tSettings('profile.saveFailed'));
    } finally {
      setUploading(null);
    }
  };

  const identityDone = Boolean(
    profileClient && profileUsername && profileEmail && profileEmail.includes('@')
  );
  const bioMediaDone = Boolean(profileBio && profileBio.trim().length >= 5);
  const kycDone = kycStatus === 'verified';

  const milestones = [
    {
      id: 'identity' as const,
      label: isEn ? 'Account & Email (+30%)' : 'Identitas & Email (+30%)',
      done: identityDone,
      partial: false,
    },
    {
      id: 'bio' as const,
      label: isEn ? 'Bio & Avatar (+20%)' : 'Bio & Foto Profil (+20%)',
      done: bioMediaDone && Boolean(avatarUrl),
      partial: bioMediaDone && !avatarUrl,
    },
    {
      id: 'security' as const,
      label: isEn ? 'PIN / 2FA Lock (+20%)' : 'Kunci PIN / 2FA (+20%)',
      done: appPinSet,
      partial: false,
    },
    {
      id: 'kyc' as const,
      label:
        kycStatus === 'verified'
          ? isEn
            ? 'e-KYC Verified (+30%)'
            : 'e-KYC Terverifikasi (+30%)'
          : kycStatus === 'pending'
            ? isEn
              ? 'e-KYC Pending (+15%)'
              : 'e-KYC Menunggu (+15%)'
            : isEn
              ? 'Verify e-KYC (+30%)'
              : 'Verifikasi e-KYC (+30%)',
      done: kycDone,
      partial: kycStatus === 'pending',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tSettings('profile.cover')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tSettings('title')} · {tSettings('subtitle')}
          </p>
        </div>

        {onOpenSettings && (
          <Button
            size="sm"
            variant="secondary"
            icon={<SlidersHorizontal className="size-3.5" />}
            onClick={onOpenSettings}
          >
            {isEn ? 'All Settings' : 'Buka Pengaturan'}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        {/* Banner */}
        <div className="relative h-28 bg-[var(--surface-2)] sm:h-36">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="" className="size-full object-cover" />
          ) : null}
          {canEdit && (
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              aria-label="Ubah banner"
              className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-transparent transition hover:bg-black/40 hover:text-white"
            >
              <Images className="size-5" aria-hidden />
              <span className="text-[12px] font-medium">
                {uploading === 'banner' ? '…' : isEn ? 'Change banner' : 'Ubah banner'}
              </span>
            </button>
          )}
        </div>

        {/* Identitas */}
        <section className="bg-[var(--surface-1)] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative -mt-10 size-20 shrink-0 overflow-hidden rounded-full border-2 border-[var(--surface-1)] bg-[var(--surface-2)]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <UserCircle className="size-10 text-[var(--text-faint)]" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[16px] font-semibold text-[var(--text)]">
                    {profileClient}
                  </h3>
                  {kycDone && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--in-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--in)]">
                      <BadgeCheck className="size-3" />
                      KYC
                    </span>
                  )}
                </div>
                <p className="tnum mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                  @{profileUsername}
                </p>
                <p className="truncate text-[12px] text-[var(--text-faint)]">
                  {profileEmail || tSettings('profile.emailNotSet')}
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--brand)] hover:underline"
                  >
                    <Camera className="size-3" aria-hidden />
                    {uploading === 'avatar'
                      ? '…'
                      : isEn
                        ? 'Change avatar'
                        : 'Ganti foto profil'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onOpenKyc && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<FileBadge className="size-3.5 text-[var(--brand)]" />}
                  onClick={onOpenKyc}
                >
                  {kycDone
                    ? isEn
                      ? 'e-KYC Verified'
                      : 'e-KYC Terverifikasi'
                    : isEn
                      ? 'Verify e-KYC'
                      : 'Verifikasi e-KYC'}
                </Button>
              )}
              {onOpenSecurity && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Lock className="size-3.5" />}
                  onClick={onOpenSecurity}
                >
                  {isEn ? 'Security' : 'Keamanan'}
                </Button>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Pencil className="size-3.5" />}
                  onClick={onEditProfile}
                >
                  {tSettings('profile.edit')}
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <input
        ref={avatarInputRef}
        id="profile-avatar-upload"
        name="avatarUpload"
        type="file"
        accept="image/*"
        aria-label="Ganti foto profil"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadMedia('avatar', f, avatarUrl);
          e.target.value = '';
        }}
      />
      <input
        ref={bannerInputRef}
        id="profile-banner-upload"
        name="bannerUpload"
        type="file"
        accept="image/*"
        aria-label="Ubah banner"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadMedia('banner', f, bannerUrl);
          e.target.value = '';
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Bio & Skor Kelengkapan Terpadu (Profil + Keamanan + e-KYC) */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5 lg:col-span-2">
          <Label>{tSettings('profile.bio')}</Label>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text)]">
            {profileBio || tSettings('profile.bioPlaceholder')}
          </p>

          <Rule className="my-4" />

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <Label>
                {isEn
                  ? 'Account, Security & KYC Completeness'
                  : 'Kelengkapan Akun, Keamanan & e-KYC'}
              </Label>
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

            {/* 4 Milestone Interaktif Terhubung */}
            <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {milestones.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (m.id === 'identity') onEditProfile();
                    else if (m.id === 'bio') {
                      if (!avatarUrl) avatarInputRef.current?.click();
                      else onEditProfile();
                    } else if (m.id === 'security') onOpenSecurity?.();
                    else if (m.id === 'kyc') onOpenKyc?.();
                  }}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition ${
                    m.done
                      ? 'border-[var(--brand)]/35 bg-[var(--brand-soft)]/20 text-[var(--text)]'
                      : m.partial
                        ? 'border-[var(--due)]/35 bg-[var(--due-soft)]/40 text-[var(--text)]'
                        : 'border-[var(--line)] bg-[var(--surface-2)]/70 text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-medium">
                    {m.done ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-[var(--brand)]" />
                    ) : (
                      <Circle className="size-3.5 shrink-0 text-[var(--text-faint)]" />
                    )}
                    <span>{m.label}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-[var(--brand)]">
                    {m.done ? (isEn ? 'Done' : 'Selesai') : isEn ? 'Open →' : 'Lengkapi →'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Info Akun & Pintasan Menu Terhubung */}
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
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {tSettings('profile.role')}
              </dt>
              <dd>
                <span className="inline-block rounded bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--brand)]">
                  {userRole}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                e-KYC
              </dt>
              <dd>
                <button
                  type="button"
                  onClick={onOpenKyc}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                    kycDone
                      ? 'bg-[var(--in-soft)] text-[var(--in)]'
                      : 'bg-[var(--surface-2)] text-[var(--brand)] hover:underline'
                  }`}
                >
                  {kycDone
                    ? isEn
                      ? 'Verified'
                      : 'Terverifikasi'
                    : kycStatus === 'pending'
                      ? isEn
                        ? 'Pending →'
                        : 'Menunggu →'
                      : isEn
                        ? 'Verify Now →'
                        : 'Verifikasi →'}
                </button>
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {isEn ? 'PIN Lock' : 'Kunci PIN'}
              </dt>
              <dd>
                <button
                  type="button"
                  onClick={onOpenSecurity}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                    appPinSet
                      ? 'bg-[var(--in-soft)] text-[var(--in)]'
                      : 'bg-[var(--surface-2)] text-[var(--brand)] hover:underline'
                  }`}
                >
                  {appPinSet
                    ? isEn
                      ? 'Active'
                      : 'Aktif'
                    : isEn
                      ? 'Set PIN →'
                      : 'Atur PIN →'}
                </button>
              </dd>
            </div>
            {onOpenSettings && (
              <div className="flex items-center justify-between border-t border-[var(--line)] pt-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Membership
                </dt>
                <dd>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-1 rounded bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)] hover:underline"
                  >
                    <Crown className="size-3" />
                    {isEn ? 'Manage Plan →' : 'Kelola Paket →'}
                  </button>
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <KolegaSection kolega={kolega} connections={connections} />
    </div>
  );
}
