'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';

/** Bentuk data yang dipakai modal - cocok dengan tabel `kyc_profiles`. */
interface KycForm {
  full_name: string;
  id_number: string;
  birth_date: string;
  address: string;
  phone: string;
  occupation: string;
}

const EMPTY: KycForm = {
  full_name: '',
  id_number: '',
  birth_date: '',
  address: '',
  phone: '',
  occupation: '',
};

/**
 * Modal data KYC - diakses dari menu profil di sidebar. Data hidup di tabel
 * `kyc_profiles` (terpisah dari profiles), hanya bisa dilihat pemiliknya.
 */
export function KycModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('settings.kyc');
  const tCommon = useTranslations('common');
  const [form, setForm] = useState<KycForm>(EMPTY);
  const [status, setStatus] = useState<string>('unverified');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
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
      if (alive) {
        if (data) {
          setForm({
            full_name: data.full_name ?? '',
            id_number: data.id_number ?? '',
            birth_date: data.birth_date ?? '',
            address: data.address ?? '',
            phone: data.phone ?? '',
            occupation: data.occupation ?? '',
          });
          setStatus(data.status ?? 'unverified');
        }
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const set = (key: keyof KycForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
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
        ...form,
        birth_date: form.birth_date || null,
        status,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(t('saved'));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      description={t('subtitle')}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={loading}>
            {t('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t('status.' + (status as 'unverified' | 'pending' | 'verified'))}
          </span>
        </div>
        <Input
          label={t('fullName')}
          value={form.full_name}
          onChange={(e) => set('full_name', e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={t('idNumber')}
            value={form.id_number}
            onChange={(e) => set('id_number', e.target.value)}
          />
          <Input
            label={t('birthDate')}
            type="date"
            value={form.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
          />
        </div>
        <Input
          label={t('address')}
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={t('phone')}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Input
            label={t('occupation')}
            value={form.occupation}
            onChange={(e) => set('occupation', e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
