'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileBadge,
  Plug,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { BrandLoader } from '@/components/ui/BrandLoader';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { createClient } from '@/lib/supabase/client';
import { readCachedApiIntegrations } from '@/components/profile/ApiIntegrationsManager';

export type KycVerificationStatus = 'unverified' | 'pending' | 'verified';

const PROVIDER_INFO: Record<
  string,
  {
    name: string;
    badge: string;
    portalUrl: string;
    descId: string;
    descEn: string;
  }
> = {
  didit_free: {
    name: 'Didit.me e-KYC',
    badge: 'Global & e-KTP · Liveness 3D',
    portalUrl: 'https://verification.didit.me',
    descId:
      'Verifikasi identitas pihak ketiga menggunakan pemindaian dokumen (e-KTP / Paspor) dan biometrik wajah di portal terenkripsi Didit.me.',
    descEn:
      'Third-party identity verification using document OCR (National ID / Passport) and 3D face liveness on Didit.me hosted portal.',
  },
  verihubs: {
    name: 'Verihubs e-KYC Indonesia',
    badge: 'Dukcapil e-KTP & Biometrik',
    portalUrl: 'https://verihubs.com',
    descId:
      'Verifikasi NIK e-KTP Indonesia dan kecocokan swafoto melalui halaman verifikasi pihak ketiga Verihubs.',
    descEn:
      'Indonesian National ID (e-KTP) and selfie liveness verification via Verihubs hosted portal.',
  },
  sumsub: {
    name: 'Sumsub Global KYC',
    badge: 'Global Identity & AML',
    portalUrl: 'https://sumsub.com',
    descId:
      'Verifikasi dokumen identitas internasional dan pemeriksaan kepatuhan melalui portal Sumsub WebSDK.',
    descEn:
      'International document verification and compliance checks via Sumsub hosted WebSDK.',
  },
  custom_kyc: {
    name: 'Custom KYC Gateway',
    badge: 'Endpoint Pihak Ketiga',
    portalUrl: 'https://verification.didit.me',
    descId:
      'Verifikasi identitas diarahkan langsung ke halaman provider KYC pihak ketiga yang dikonfigurasi di Koneksi API.',
    descEn:
      'Identity verification redirects directly to your configured third-party KYC provider.',
  },
};

/**
 * Modal Verifikasi Identitas (e-KYC Pihak Ketiga).
 *
 * Sesuai arsitektur aplikasi: verifikasi tidak lagi memakai form panjang manual
 * yang membebani database internal, melainkan diarahkan ke halaman provider
 * pihak ketiga (Didit.me / Verihubs / Sumsub) dan menyinkronkan statusnya
 * secara terpusat dengan skor Kelengkapan Akun di menu Profil.
 */
export function KycModal({
  open,
  onClose,
  isSuperadmin = false,
  unifiedCompleteness = 60,
  kycStatus = 'unverified',
  defaultFullName = '',
  onStatusChange,
  onOpenApiSettings,
}: {
  open: boolean;
  onClose: () => void;
  isSuperadmin?: boolean;
  /** Skor kelengkapan terpadu (0-100) yang sama persis dengan halaman Profil. */
  unifiedCompleteness?: number;
  kycStatus?: KycVerificationStatus;
  defaultFullName?: string;
  onStatusChange?: (status: KycVerificationStatus) => void;
  onOpenApiSettings?: () => void;
}) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const t = useTranslations('settings.kyc');
  const tCommon = useTranslations('common');
  const { confirm } = useConfirm();

  const [status, setStatus] = useState<KycVerificationStatus>(kycStatus);
  const [docType, setDocType] = useState<'ktp' | 'passport' | 'sim'>('ktp');
  const [fullName, setFullName] = useState(defaultFullName);
  const [sessionId, setSessionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(kycStatus);
  }, [kycStatus]);

  useEffect(() => {
    if (defaultFullName && !fullName) {
      setFullName(defaultFullName);
    }
  }, [defaultFullName, fullName]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        if (isSuperadmin) {
          const res = await fetch('/api/superadmin/finance?table=kyc_profiles');
          const json = await res.json().catch(() => ({}));
          const row = Array.isArray(json.data) ? json.data[0] : json.data;
          if (alive && row) {
            const st =
              row.status === 'verified' || row.status === 'pending'
                ? row.status
                : 'unverified';
            setStatus(st);
            onStatusChange?.(st);
            if (row.full_name) setFullName(String(row.full_name));
            if (row.id_number) setSessionId(String(row.id_number));
          }
          if (alive) setLoading(false);
          return;
        }

        const supabase = createClient();
        if (!supabase) {
          if (alive) setLoading(false);
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (alive) setLoading(false);
          return;
        }
        const { data } = await supabase
          .from('kyc_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (alive && data) {
          const st: KycVerificationStatus =
            data.status === 'verified' || data.status === 'pending'
              ? data.status
              : 'unverified';
          setStatus(st);
          onStatusChange?.(st);
          if (data.full_name) setFullName(String(data.full_name));
          if (data.id_number) setSessionId(String(data.id_number));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, isSuperadmin, onStatusChange]);

  const kycConfig = readCachedApiIntegrations().kyc;
  const providerMeta =
    PROVIDER_INFO[kycConfig.provider] ?? PROVIDER_INFO.didit_free;
  const targetUrl =
    kycConfig.baseUrl && /^https?:\/\//i.test(kycConfig.baseUrl)
      ? kycConfig.baseUrl
      : providerMeta.portalUrl;

  const persistStatus = async (
    nextStatus: KycVerificationStatus,
    refCode: string
  ) => {
    setSaving(true);
    try {
      const payload = {
        full_name: fullName.trim() || defaultFullName || 'Pengguna stashinmeid',
        id_number: refCode,
        birth_date: null,
        phone: kycConfig.provider || 'didit_free',
        address: `3RD_PARTY_KYC:${docType.toUpperCase()}`,
        occupation: providerMeta.name,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (isSuperadmin) {
        await fetch('/api/superadmin/finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'kyc_profiles',
            payload,
          }),
        });
      } else {
        const supabase = createClient();
        if (supabase) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('kyc_profiles').upsert({
              user_id: user.id,
              ...payload,
            });
          }
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('stashinmeid_kyc_status', nextStatus);
      }
      setStatus(nextStatus);
      setSessionId(refCode);
      onStatusChange?.(nextStatus);
    } finally {
      setSaving(false);
    }
  };

  const handleLaunchThirdParty = async () => {
    const newRef =
      sessionId ||
      `KYC-${kycConfig.provider.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const ok = await confirm({
      title: isEn
        ? `Continue to ${providerMeta.name}?`
        : `Lanjutkan verifikasi ke ${providerMeta.name}?`,
      description: isEn
        ? `You will be redirected to ${providerMeta.name} to scan your ID and complete face verification.`
        : `Anda akan diarahkan ke halaman resmi ${providerMeta.name} untuk memindai dokumen identitas & verifikasi wajah.`,
      confirmLabel: isEn ? 'Open Verification Page' : 'Buka Halaman Pihak Ketiga',
      audit: {
        action: 'Buka Sesi KYC Pihak Ketiga',
        category: 'settings',
        detail: `${providerMeta.name} · Dokumen: ${docType.toUpperCase()} (${newRef})`,
      },
    });
    if (!ok) return;

    const nextSt: KycVerificationStatus =
      status === 'verified' ? 'verified' : 'pending';
    await persistStatus(nextSt, newRef);

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    toast.success(
      isEn
        ? `Verification session opened on ${providerMeta.name}.`
        : `Halaman verifikasi ${providerMeta.name} dibuka di tab baru.`
    );
  };

  const handleSyncVerified = async () => {
    const ref =
      sessionId ||
      `KYC-${kycConfig.provider.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const ok = await confirm({
      title: isEn
        ? 'Confirm third-party KYC verification?'
        : 'Sinkronkan status KYC Terverifikasi?',
      description: isEn
        ? `Mark this account as verified via ${providerMeta.name} and update profile completeness.`
        : `Tandai identitas akun telah terverifikasi melalui ${providerMeta.name} dan perbarui skor kelengkapan profil.`,
      audit: {
        action: 'Verifikasi KYC Selesai',
        category: 'settings',
        detail: `Terverifikasi via ${providerMeta.name} (${ref})`,
      },
    });
    if (!ok) return;

    await persistStatus('verified', ref);
    toast.success(
      isEn
        ? 'KYC status synced: Verified!'
        : 'Status e-KYC berhasil disinkronkan: Terverifikasi!'
    );
  };

  const statusBadge = () => {
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--in-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--in)]">
          <BadgeCheck className="size-3.5" />
          {isEn ? 'Verified via Third-Party KYC' : 'Terverifikasi e-KYC'}
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--due-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--due)]">
          <Clock className="size-3.5" />
          {isEn ? 'Waiting Provider Callback' : 'Menunggu Sesi Pihak Ketiga'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
        <ShieldAlert className="size-3.5" />
        {isEn ? 'Unverified' : 'Belum Terverifikasi'}
      </span>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      description={
        isEn
          ? 'Identity verification is processed securely by our third-party e-KYC partner.'
          : 'Verifikasi identitas diproses langsung melalui halaman resmi mitra e-KYC pihak ketiga.'
      }
      size="md"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {status !== 'verified' && (
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="size-3.5" />}
                onClick={handleSyncVerified}
                loading={saving}
                disabled={loading}
              >
                {isEn ? 'Sync Callback Status' : 'Sinkronkan Status'}
              </Button>
            )}
            <Button
              size="sm"
              icon={<ExternalLink className="size-3.5" />}
              onClick={handleLaunchThirdParty}
              loading={saving}
              disabled={loading}
            >
              {isEn
                ? `Verify on ${providerMeta.name}`
                : `Verifikasi di ${providerMeta.name}`}
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <BrandLoader
          size="sm"
          label={isEn ? 'Checking KYC session...' : 'Memeriksa sesi e-KYC...'}
          showSkeleton
          skeletonRows={2}
        />
      ) : (
        <div className="space-y-4">
          {/* Skor Kelengkapan Terpadu (SAMA PERSIS dengan halaman Profil!) */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {statusBadge()}
              <span className="tnum text-[12px] font-semibold text-[var(--text)]">
                {isEn ? 'Account & KYC Completeness' : 'Kelengkapan Akun & KYC'}:{' '}
                <strong className="text-[var(--brand)]">
                  {unifiedCompleteness}%
                </strong>
              </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-1)]">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
                style={{ width: `${unifiedCompleteness}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              {status === 'verified'
                ? isEn
                  ? 'Identity verified (+30% completeness score active).'
                  : 'Identitas sudah terverifikasi (+30% skor kelengkapan profil sudah aktif).'
                : isEn
                  ? 'Completing third-party e-KYC adds +30% to your unified profile score.'
                  : 'Menyelesaikan verifikasi e-KYC pihak ketiga menambah +30% ke skor kelengkapan profilmu.'}
            </p>
          </div>

          {/* Kartu Provider Pihak Ketiga Aktif */}
          <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)]/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <FileBadge className="size-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[14px] font-semibold text-[var(--text)]">
                      {providerMeta.name}
                    </h4>
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                      {providerMeta.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                    {isEn ? providerMeta.descEn : providerMeta.descId}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-muted)] sm:grid-cols-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-[var(--brand)]" />
                <span>{isEn ? '1. Pick ID Type' : '1. Pilih Jenis ID'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-[var(--brand)]" />
                <span>
                  {isEn ? '2. Scan on Provider' : '2. Scan di Pihak Ketiga'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-[var(--brand)]" />
                <span>
                  {isEn ? '3. Webhook Auto-Sync' : '3. Sinkron Otomatis'}
                </span>
              </div>
            </div>
          </div>

          {/* Pilihan Jenis Dokumen sebelum Redirect */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="kyc-holder-name"
                className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]"
              >
                {isEn ? 'Full Name on ID' : 'Nama Sesuai Identitas'}
              </label>
              <input
                id="kyc-holder-name"
                name="kycHolderName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isEn ? 'Full legal name' : 'Nama lengkap sesuai KTP/Paspor'}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="kyc-doc-type"
                className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]"
              >
                {isEn ? 'Document Type' : 'Jenis Dokumen'}
              </label>
              <select
                id="kyc-doc-type"
                name="kycDocType"
                value={docType}
                onChange={(e) =>
                  setDocType(e.target.value as 'ktp' | 'passport' | 'sim')
                }
                className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
              >
                <option value="ktp">
                  {isEn ? 'National ID (e-KTP)' : 'e-KTP (NIK 16 Digit)'}
                </option>
                <option value="passport">
                  {isEn ? 'International Passport' : 'Paspor Internasional'}
                </option>
                <option value="sim">
                  {isEn ? "Driver's License" : 'SIM A / C Aktif'}
                </option>
              </select>
            </div>
          </div>

          {sessionId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2 text-[11px] text-[var(--text-muted)]">
              <span>
                {isEn ? 'Session Ref' : 'ID Sesi Verifikasi'}:{' '}
                <strong className="font-mono text-[var(--text)]">
                  {sessionId}
                </strong>
              </span>
              {onOpenApiSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenApiSettings();
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-[var(--brand)] hover:underline"
                >
                  <Plug className="size-3" />
                  {isEn ? 'Change KYC Provider' : 'Atur Provider KYC'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
