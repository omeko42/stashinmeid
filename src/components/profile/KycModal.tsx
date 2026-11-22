'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck,
  Briefcase,
  Clock,
  FileBadge,
  MapPin,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { readCachedApiIntegrations } from '@/components/profile/ApiIntegrationsManager';

interface KycExtendedForm {
  id_type: 'ktp' | 'passport' | 'sim';
  id_number: string;
  full_name: string;
  birth_date: string;
  nationality: 'WNI' | 'WNA';
  phone: string;
  city: string;
  postal_code: string;
  street_address: string;
  job_title: string;
  source_of_funds: string;
  monthly_cashflow_tier: string;
  account_purpose: string;
  tax_id: string;
}

const EMPTY_FORM: KycExtendedForm = {
  id_type: 'ktp',
  id_number: '',
  full_name: '',
  birth_date: '',
  nationality: 'WNI',
  phone: '',
  city: '',
  postal_code: '',
  street_address: '',
  job_title: '',
  source_of_funds: 'Gaji & Penghasilan Tetap',
  monthly_cashflow_tier: 'Rp 10 Juta - Rp 50 Juta',
  account_purpose: 'Manajemen Kas Pribadi & Keluarga',
  tax_id: '',
};

const META_MARKER = ' ||META:';

function packKycRow(form: KycExtendedForm) {
  const addressMeta = JSON.stringify({
    city: form.city,
    postal_code: form.postal_code,
    id_type: form.id_type,
    nationality: form.nationality,
  });
  const occupationMeta = JSON.stringify({
    source_of_funds: form.source_of_funds,
    monthly_cashflow_tier: form.monthly_cashflow_tier,
    account_purpose: form.account_purpose,
    tax_id: form.tax_id,
  });

  return {
    full_name: form.full_name.trim(),
    id_number: form.id_number.trim(),
    birth_date: form.birth_date || null,
    phone: form.phone.trim(),
    address: `${form.street_address.trim()}${META_MARKER}${addressMeta}`,
    occupation: `${form.job_title.trim()}${META_MARKER}${occupationMeta}`,
  };
}

function unpackKycRow(data: Record<string, unknown>): KycExtendedForm {
  const rawAddress = String(data.address ?? '');
  const rawOccupation = String(data.occupation ?? '');

  let street_address = rawAddress;
  let city = '';
  let postal_code = '';
  let id_type: 'ktp' | 'passport' | 'sim' = 'ktp';
  let nationality: 'WNI' | 'WNA' = 'WNI';

  if (rawAddress.includes(META_MARKER)) {
    const [base, jsonPart] = rawAddress.split(META_MARKER);
    street_address = base;
    try {
      const parsed = JSON.parse(jsonPart);
      city = parsed.city || '';
      postal_code = parsed.postal_code || '';
      if (['ktp', 'passport', 'sim'].includes(parsed.id_type)) {
        id_type = parsed.id_type;
      }
      if (parsed.nationality === 'WNA' || parsed.nationality === 'WNI') {
        nationality = parsed.nationality;
      }
    } catch {
      // Abaikan jika format lama
    }
  }

  let job_title = rawOccupation;
  let source_of_funds = 'Gaji & Penghasilan Tetap';
  let monthly_cashflow_tier = 'Rp 10 Juta - Rp 50 Juta';
  let account_purpose = 'Manajemen Kas Pribadi & Keluarga';
  let tax_id = '';

  if (rawOccupation.includes(META_MARKER)) {
    const [base, jsonPart] = rawOccupation.split(META_MARKER);
    job_title = base;
    try {
      const parsed = JSON.parse(jsonPart);
      source_of_funds = parsed.source_of_funds || source_of_funds;
      monthly_cashflow_tier =
        parsed.monthly_cashflow_tier || monthly_cashflow_tier;
      account_purpose = parsed.account_purpose || account_purpose;
      tax_id = parsed.tax_id || '';
    } catch {
      // Abaikan jika format lama
    }
  }

  return {
    id_type,
    id_number: String(data.id_number ?? ''),
    full_name: String(data.full_name ?? ''),
    birth_date: String(data.birth_date ?? ''),
    nationality,
    phone: String(data.phone ?? ''),
    city,
    postal_code,
    street_address,
    job_title,
    source_of_funds,
    monthly_cashflow_tier,
    account_purpose,
    tax_id,
  };
}

/**
 * Modal Verifikasi Identitas (KYC & Customer Due Diligence).
 * Mendukung mode pengguna Supabase reguler maupun sesi Superadmin.
 */
export function KycModal({
  open,
  onClose,
  isSuperadmin = false,
}: {
  open: boolean;
  onClose: () => void;
  isSuperadmin?: boolean;
}) {
  const t = useTranslations('settings.kyc');
  const tCommon = useTranslations('common');
  const [form, setForm] = useState<KycExtendedForm>(EMPTY_FORM);
  const [status, setStatus] = useState<string>('unverified');
  const [activeSection, setActiveSection] = useState<
    'identity' | 'domicile' | 'financial'
  >('identity');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            setForm(unpackKycRow(row));
            setStatus(String(row.status ?? 'unverified'));
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
          setForm(unpackKycRow(data as Record<string, unknown>));
          setStatus(data.status ?? 'unverified');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, isSuperadmin]);

  const set = <K extends keyof KycExtendedForm>(
    key: K,
    value: KycExtendedForm[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const completeness = useMemo(() => {
    const checks = [
      form.full_name.trim().length >= 3,
      form.id_number.trim().length >= 8,
      Boolean(form.birth_date),
      form.phone.trim().length >= 9,
      form.city.trim().length >= 2,
      form.street_address.trim().length >= 5,
      form.job_title.trim().length >= 2,
      Boolean(form.source_of_funds),
      Boolean(form.monthly_cashflow_tier),
      Boolean(form.account_purpose),
    ];
    const passed = checks.filter(Boolean).length;
    return Math.round((passed / checks.length) * 100);
  }, [form]);

  const handleSave = async (submitForVerification: boolean) => {
    if (submitForVerification && completeness < 80) {
      toast.error(
        'Lengkapi minimal 80% data identitas, domisili, dan profil finansial sebelum mengajukan verifikasi.'
      );
      return;
    }

    setSaving(true);
    const nextStatus = submitForVerification
      ? completeness === 100
        ? 'verified'
        : 'pending'
      : status;
    const packed = packKycRow(form);

    try {
      if (isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'kyc_profiles',
            payload: {
              ...packed,
              status: nextStatus,
              updated_at: new Date().toISOString(),
            },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || t('saveFailed'));
        }
        setStatus(nextStatus);
        toast.success(
          submitForVerification
            ? 'Verifikasi KYC berhasil diajukan & diperbarui!'
            : t('saved')
        );
        if (submitForVerification) onClose();
        return;
      }

      const supabase = createClient();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('saveFailed'));
        return;
      }
      const { error } = await supabase.from('kyc_profiles').upsert({
        user_id: user.id,
        ...packed,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setStatus(nextStatus);
      toast.success(
        submitForVerification
          ? 'Data KYC berhasil diverifikasi & disimpan!'
          : t('saved')
      );
      if (submitForVerification) onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = () => {
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--in-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--in)]">
          <BadgeCheck className="size-3.5" />
          Terverifikasi Penuh (Tier-2 KYC)
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--due-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--due)]">
          <Clock className="size-3.5" />
          Sedang Ditinjau (Pending)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
        <ShieldAlert className="size-3.5" />
        Belum Terverifikasi
      </span>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      description="Lengkapi data identitas untuk verifikasi akun."
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSave(false)}
              loading={saving}
              disabled={loading}
            >
              Simpan Draft
            </Button>
            <Button
              size="sm"
              icon={<ShieldCheck className="size-3.5" />}
              onClick={() => handleSave(true)}
              loading={saving}
              disabled={loading}
            >
              Ajukan & Verifikasi KYC
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Ringkasan Status & Progress Kelengkapan */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge()}
              {(() => {
                const kycApi = readCachedApiIntegrations().kyc;
                if (!kycApi.enabled) return null;
                return (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--info-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--info)]">
                    Provider: {kycApi.provider.toUpperCase()}
                  </span>
                );
              })()}
            </div>
            <span className="tnum text-[12px] font-semibold text-[var(--text)]">
              Kelengkapan Data: {completeness}%
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-1)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>

        {/* Tab Langkah KYC */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-1">
          {[
            {
              id: 'identity' as const,
              label: '1. Identitas',
              icon: <FileBadge className="size-3.5" />,
            },
            {
              id: 'domicile' as const,
              label: '2. Domisili',
              icon: <MapPin className="size-3.5" />,
            },
            {
              id: 'financial' as const,
              label: '3. Finansial',
              icon: <Briefcase className="size-3.5" />,
            },
          ].map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-colors ${
                  active
                    ? 'bg-[var(--brand)] text-[var(--bg)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bagian 1: Identitas Resmi */}
        {activeSection === 'identity' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                id="kyc-id-type"
                name="kycIdType"
                label="Jenis Dokumen Identitas"
                value={form.id_type}
                onChange={(e) =>
                  set('id_type', e.target.value as 'ktp' | 'passport' | 'sim')
                }
              >
                <option value="ktp">e-KTP (NIK 16 Digit)</option>
                <option value="passport">Paspor Internasional</option>
                <option value="sim">SIM A / C Aktif</option>
              </Select>

              <Select
                id="kyc-nationality"
                name="kycNationality"
                label="Kewarganegaraan"
                value={form.nationality}
                onChange={(e) =>
                  set('nationality', e.target.value as 'WNI' | 'WNA')
                }
              >
                <option value="WNI">WNI (Warga Negara Indonesia)</option>
                <option value="WNA">WNA (Warga Negara Asing)</option>
              </Select>
            </div>

            <Input
              id="kyc-full-name"
              name="kycFullName"
              label={t('fullName')}
              placeholder="Nama lengkap sesuai e-KTP / Paspor"
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="kyc-id-number"
                name="kycIdNumber"
                label={
                  form.id_type === 'ktp'
                    ? 'Nomor Induk Kependudukan (NIK)'
                    : 'Nomor Dokumen Identitas'
                }
                placeholder={
                  form.id_type === 'ktp' ? '16 digit NIK e-KTP' : 'Nomor dokumen'
                }
                hint={
                  form.id_type === 'ktp'
                    ? `${form.id_number.replace(/\D/g, '').length}/16 digit`
                    : undefined
                }
                value={form.id_number}
                onChange={(e) => set('id_number', e.target.value)}
              />
              <Input
                id="kyc-birth-date"
                name="kycBirthDate"
                label={t('birthDate')}
                type="date"
                value={form.birth_date}
                onChange={(e) => set('birth_date', e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveSection('domicile')}
              >
                Lanjut ke Kontak & Domisili →
              </Button>
            </div>
          </div>
        )}

        {/* Bagian 2: Kontak & Domisili */}
        {activeSection === 'domicile' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="kyc-phone"
                name="kycPhone"
                label="Nomor Telepon / WhatsApp Aktif"
                placeholder="Mis. +62 812-3456-7890"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
              <Input
                id="kyc-city"
                name="kycCity"
                label="Kota / Kabupaten Domisili"
                placeholder="Mis. Jakarta Selatan / Surabaya"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  id="kyc-street-address"
                  name="kycStreetAddress"
                  label={t('address')}
                  placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan"
                  value={form.street_address}
                  onChange={(e) => set('street_address', e.target.value)}
                />
              </div>
              <Input
                id="kyc-postal-code"
                name="kycPostalCode"
                label="Kode Pos"
                placeholder="Mis. 12190"
                value={form.postal_code}
                onChange={(e) => set('postal_code', e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveSection('identity')}
              >
                ← Kembali
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveSection('financial')}
              >
                Lanjut ke Profil Finansial →
              </Button>
            </div>
          </div>
        )}

        {/* Bagian 3: Profil Pekerjaan & Finansial (CDD) */}
        {activeSection === 'financial' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="kyc-job-title"
                name="kycJobTitle"
                label={t('occupation')}
                placeholder="Mis. Software Engineer / Direktur / Wiraswasta"
                value={form.job_title}
                onChange={(e) => set('job_title', e.target.value)}
              />
              <Input
                id="kyc-tax-id"
                name="kycTaxId"
                label="NPWP / NIK Pajak (Opsional)"
                placeholder="15 atau 16 digit NPWP"
                value={form.tax_id}
                onChange={(e) => set('tax_id', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                id="kyc-source-of-funds"
                name="kycSourceOfFunds"
                label="Sumber Dana Utama"
                value={form.source_of_funds}
                onChange={(e) => set('source_of_funds', e.target.value)}
              >
                <option value="Gaji & Penghasilan Tetap">
                  Gaji & Penghasilan Tetap
                </option>
                <option value="Hasil Usaha / Bisnis">
                  Hasil Usaha / Bisnis
                </option>
                <option value="Investasi & Dividen">
                  Investasi & Dividen
                </option>
                <option value="Freelance / Komisi Profesional">
                  Freelance / Komisi Profesional
                </option>
                <option value="Tabungan Keluarga / Lainnya">
                  Tabungan Keluarga / Lainnya
                </option>
              </Select>

              <Select
                id="kyc-cashflow-tier"
                name="kycCashflowTier"
                label="Estimasi Arus Kas Bulanan"
                value={form.monthly_cashflow_tier}
                onChange={(e) => set('monthly_cashflow_tier', e.target.value)}
              >
                <option value="< Rp 10 Juta">&lt; Rp 10 Juta / bulan</option>
                <option value="Rp 10 Juta - Rp 50 Juta">
                  Rp 10 Juta - Rp 50 Juta / bulan
                </option>
                <option value="Rp 50 Juta - Rp 250 Juta">
                  Rp 50 Juta - Rp 250 Juta / bulan
                </option>
                <option value="> Rp 250 Juta">&gt; Rp 250 Juta / bulan</option>
              </Select>
            </div>

            <Select
              id="kyc-account-purpose"
              name="kycAccountPurpose"
              label="Tujuan Penggunaan Workspace"
              value={form.account_purpose}
              onChange={(e) => set('account_purpose', e.target.value)}
            >
              <option value="Manajemen Kas Pribadi & Keluarga">
                Manajemen Kas Pribadi & Keluarga
              </option>
              <option value="Kolaborasi Tim & Operasional Perusahaan">
                Kolaborasi Tim & Operasional Perusahaan
              </option>
              <option value="Pemantauan Pinjaman & Aset Multi-Dompet">
                Pemantauan Pinjaman & Aset Multi-Dompet
              </option>
              <option value="Investasi & Perencanaan Dana Darurat">
                Investasi & Perencanaan Dana Darurat
              </option>
            </Select>
          </div>
        )}
      </div>
    </Modal>
  );
}
