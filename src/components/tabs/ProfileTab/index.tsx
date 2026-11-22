'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Camera, Images, Pencil, Shield, UserCircle } from 'lucide-react';
import type { UserRole } from '@/types/finance';
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
  canEdit: boolean;
  onEditProfile: () => void;
  onProfileMediaChange: (avatarUrl: string | null, bannerUrl: string | null) => void;
  /** Data kolega dari DashboardClient supaya tidak fetch dobel. */
  kolega: KolegaApi;
  /** Kolega sosial (pertemanan 2-arah). */
  connections: ConnectionsApi;
}

/**
 * Profil.
 *
 * Identitas, banner, foto, bio, KYC, dan kolega. Keamanan pribadi (PIN, 2FA)
 * pindah ke modal yang dibuka dari menu profil di pojok kiri bawah sidebar.
 * Foto/banner diunggah ke Storage `avatars`/`banners` milik sendiri.
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
  canEdit,
  onEditProfile,
  onProfileMediaChange,
  kolega,
  connections,
}: ProfileTabProps) {
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

      // Bersihkan file lama biar bucket nggak menumpuk (abaikan error).
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
                {uploading === 'banner' ? '…' : 'Ubah banner'}
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
                <h3 className="truncate text-[16px] font-semibold text-[var(--text)]">
                  {profileClient}
                </h3>
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
                    {uploading === 'avatar' ? '…' : 'Ganti foto profil'}
                  </button>
                )}
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
        </section>
      </div>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
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
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadMedia('banner', f, bannerUrl);
          e.target.value = '';
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Bio */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5 lg:col-span-2">
          <Label>{tSettings('profile.bio')}</Label>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text)]">
            {profileBio || tSettings('profile.bioPlaceholder')}
          </p>

          <Rule className="my-4" />

          <div>
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

      <KolegaSection kolega={kolega} connections={connections} />
    </div>
  );
}
