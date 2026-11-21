'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTranslations } from 'next-intl';

interface PasskeyItem {
  id: string;
  name: string;
  created_at?: string;
}

/**
 * Manajemen passkey.
 *
 * Passkey disimpan di sisi server Supabase, jadi aplikasi ini cuma
 * orchestrasi ceremony WebAuthn:
 *   daftar  : registerPasskey() -> navigator.credentials.create()
 *   masuk   : signInWithPasskey() -> navigator.credentials.get()
 *   hapus   : supabase.auth.passkey.delete(id)
 *
 * Syarat supaya bisa dipakai:
 *   - Supabase Auth > Providers > WebAuthn diaktifkan
 *   - Browser mendukung WebAuthn (semua browser modern sudah)
 *   - HTTPS (localhost Development juga boleh)
 */
export function PasskeyManager() {
  const t = useTranslations('settings.security.passkey');
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';

  const refresh = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await supabase.auth.getUser();
      if (err || !data.user) {
        setPasskeys([]);
        setLoading(false);
        return;
      }

      // Passkey tercatat sebagai factor di user metadata.
      const factors = data.user.factors ?? [];
      const items: PasskeyItem[] = factors
        .filter((f) => f.factor_type === 'webauthn')
        .map((f) => ({
          id: f.id,
          name: f.friendly_name || t('unnamed'),
          created_at: f.created_at,
        }));

      setPasskeys(items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat passkey');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRegister = async () => {
    if (!supported) {
      toast.error(t('unsupported'));
      return;
    }
    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.registerPasskey({
        options: { },
      });
      if (err) throw err;
      if (!data) throw new Error(t('failed'));

      await refresh();
      toast.success(t('registered'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    try {
      const { error: err } = await supabase.auth.passkey.delete({
        passkeyId: id,
      });
      if (err) throw err;
      await refresh();
      toast.success(t('removed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text)]">
            {t('title')}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {t('hint')}
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleRegister}
          loading={busy}
          disabled={!supported}
          icon={<Plus className="size-3.5" />}
        >
          {t('add')}
        </Button>
      </div>

      {!supported && (
        <p className="text-[12px] text-[var(--out)]">{t('unsupported')}</p>
      )}

      {error && <p className="text-[12px] text-[var(--out)]">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-4 animate-spin text-[var(--brand)]" />
        </div>
      ) : passkeys.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="size-5" />}
          title={t('emptyTitle')}
          description={t('emptyHint')}
        />
      ) : (
        <div className="space-y-2">
          {passkeys.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
            >
              <KeyRound className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text)]">
                {p.name}
              </span>
              <IconButton
                label={t('remove')}
                title={t('remove')}
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(p.id)}
                disabled={busy}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
