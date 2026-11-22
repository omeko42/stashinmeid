'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Banknote,
  Bitcoin,
  Building2,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Amount } from '@/components/ui/Surface';
import { BalanceVisibilityToggle } from '@/components/ui/BalanceVisibilityToggle';
import { Button } from '@/components/ui/Button';
import { CURRENCY_OPTIONS, useAssets, type AccountKind } from '@/hooks/useAssets';
import { formatRp } from '@/lib/format';
import { cn } from '@/lib/cn';

const KIND_ICONS: Record<AccountKind, React.ReactNode> = {
  bank: <Landmark className="size-4" />,
  cash: <Banknote className="size-4" />,
  ewallet: <Wallet className="size-4" />,
  crypto: <Bitcoin className="size-4" />,
  other: <Building2 className="size-4" />,
};

const EMPTY_FORM = {
  name: '',
  kind: 'bank' as AccountKind,
  institution: '',
  currency: 'IDR',
  balance: '',
};

/**
 * Aset: dompet terpisah (bank spesifik, kas, crypto, dll) + mata uang masing-
 * masing + kurs manual + mata uang utama. Nilai total dikonversi ke mata uang
 * utama supaya aset bisa dihitung dalam satu satuan.
 */
export function AssetsTab({ assets }: { assets: ReturnType<typeof useAssets> }) {
  const t = useTranslations('assets');
  const tCommon = useTranslations('common');
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [rateDraft, setRateDraft] = useState<{ currency: string; rate: string }>({
    currency: 'USD',
    rate: '',
  });

  /**
   * Kurs otomatis: setiap tab Aset dibuka, segarkan kurs yang sudah
   * lebih tua dari 24 jam (atau mata uang dompet yang belum punya kurs)
   * - tanpa toast, diam-diam di belakang. Isi manual tetap bisa.
   */
  useEffect(() => {
    if (assets.loading) return;
    const ids = assets.accounts.map((a) => a.currency).filter((c) => c !== assets.primaryCurrency);
    const wanted = new Set([...ids, ...assets.rates.map((r) => r.currency)]);
    wanted.delete(assets.primaryCurrency);
    if (wanted.size === 0) return;
    const now = Date.now();
    const DAY = 24 * 3600 * 1000;
    const stale = [...wanted].some((c) => {
      const row = assets.rates.find((r) => r.currency === c);
      if (!row) return true;
      return !row.updated_at || now - new Date(row.updated_at).getTime() > DAY;
    });
    if (!stale) return;
    assets.syncRates().catch(() => {
      /* auto-sync gagal diam saja; kurs lama tetap kepakai */
    });
    // Jalankan sekali per buka tab; syncRates ikut berubah saat data berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.loading]);

  const handleAdd = async () => {
    const bal = Number(form.balance);
    if (!form.name.trim() || !Number.isFinite(bal)) return;
    setAdding(true);
    try {
      await assets.saveAccount({
        name: form.name.trim(),
        kind: form.kind,
        institution: form.institution.trim() || null,
        currency: form.currency,
        balance: bal,
      });
      setForm(EMPTY_FORM);
      toast.success(tCommon('saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tCommon('failed'));
    } finally {
      setAdding(false);
    }
  };

  const handleRate = async () => {
    const r = Number(rateDraft.rate);
    if (!rateDraft.currency || !Number.isFinite(r) || r <= 0) return;
    try {
      await assets.saveRate(rateDraft.currency, r);
      setRateDraft({ ...rateDraft, rate: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tCommon('failed'));
    }
  };

  const primary = assets.primaryCurrency;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--text)]">{t('title')}</h2>
        <p className="text-[12px] text-[var(--text-muted)]">{t('subtitle')}</p>
      </div>

      {/* Hero total + mata uang utama */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('totalIn', { currency: primary })}
              </p>
              <BalanceVisibilityToggle />
            </div>
            <Amount value={formatRp(assets.totalConverted)} size="xl" />
          </div>
          <label
            htmlFor="asset-primary-currency"
            className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]"
          >
            {t('primaryCurrency')}
            <select
              id="asset-primary-currency"
              name="primaryCurrency"
              value={primary}
              onChange={async (e) => {
                try {
                  await assets.savePrimaryCurrency(e.target.value);
                } catch (er) {
                  toast.error(er instanceof Error ? er.message : tCommon('failed'));
                }
              }}
              className="h-9 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Daftar dompet */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
        {assets.loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
          </div>
        ) : assets.accounts.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px] font-medium text-[var(--text)]">{t('empty.title')}</p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">{t('empty.description')}</p>
          </div>
        ) : (
          assets.accounts.map((a, idx) => {
            const converted = assets.convert(a.balance, a.currency);
            return (
              <div
                key={a.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5',
                  idx > 0 && 'border-t border-[var(--line)]'
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">
                  {KIND_ICONS[a.kind] ?? KIND_ICONS.other}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                    {a.name}
                  </p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    {/* `a.kind` datang dari database, jadi bisa nilai apa
                        saja. Fallback ke label mentahnya supaya halaman
                        tidak crash kalau ada jenis yang belum punya
                        terjemahan. */}
                    {(() => {
                      try {
                        return t('kind.' + a.kind);
                      } catch {
                        return a.kind;
                      }
                    })()}
                    {a.institution ? ` · ${a.institution}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[13px] font-semibold text-[var(--text)]">
                    {a.currency} {a.balance.toLocaleString('id-ID')}
                  </p>
                  {a.currency !== primary && (
                    <p className="tnum text-[11px] text-[var(--text-muted)]">
                      ≈ {formatRp(converted ?? 0)}
                      {converted === null && <span className="text-[var(--due)]"> · {t('noRate')}</span>}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={tCommon('delete')}
                  onClick={async () => {
                    try {
                      await assets.removeAccount(a.id);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : tCommon('failed'));
                    }
                  }}
                  className="shrink-0 rounded p-1.5 text-[var(--text-faint)] transition hover:text-[var(--out)]"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            );
          })
        )}
      </section>

      {/* Tambah dompet */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
          <Plus className="size-4 text-[var(--brand)]" aria-hidden />
          {t('addTitle')}
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            id="asset-name"
            name="assetName"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('form.name')}
            aria-label={t('form.name')}
            className="h-9 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
          />
          <select
            id="asset-kind"
            name="assetKind"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as AccountKind })}
            aria-label={t('form.kind')}
            className="h-9 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
          >
            {(['bank', 'cash', 'ewallet', 'crypto', 'other'] as AccountKind[]).map((k) => (
              <option key={k} value={k}>
                {t('kind.' + k)}
              </option>
            ))}
          </select>
          <input
            id="asset-institution"
            name="assetInstitution"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
            placeholder={t('form.institution')}
            aria-label={t('form.institution')}
            className="h-9 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
          />
          <select
            id="asset-currency"
            name="assetCurrency"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            aria-label={t('form.currency')}
            className="h-9 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              id="asset-balance"
              name="assetBalance"
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
              placeholder={t('form.balance')}
              aria-label={t('form.balance')}
              type="number"
              inputMode="decimal"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
            />
            <Button size="sm" onClick={handleAdd} loading={adding}>
              {tCommon('save')}
            </Button>
          </div>
        </div>
      </section>

      {/* Kurs manual */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">{t('ratesTitle')}</h3>
          <Button
            size="sm"
            variant="ghost"
            loading={assets.syncing}
            onClick={async () => {
              try {
                const n = await assets.syncRates();
                if (n > 0) toast.success(t('ratesSynced', { count: n }));
                else toast.info(t('ratesSyncNone'));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : tCommon('failed'));
              }
            }}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {t('ratesSync')}
          </Button>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {t('ratesHint', { currency: primary })}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <select
            id="fx-rate-currency"
            name="rateCurrency"
            value={rateDraft.currency}
            onChange={(e) => setRateDraft({ ...rateDraft, currency: e.target.value })}
            aria-label={t('form.currency')}
            className="h-9 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
          >
            {CURRENCY_OPTIONS.filter((c) => c !== primary).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            id="fx-rate-value"
            name="rateValue"
            value={rateDraft.rate}
            onChange={(e) => setRateDraft({ ...rateDraft, rate: e.target.value })}
            placeholder={t('ratePlaceholder', { currency: primary })}
            aria-label={t('ratesTitle')}
            type="number"
            inputMode="decimal"
            step="any"
            className="h-9 w-36 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
          />
          <Button size="sm" onClick={handleRate}>
            {tCommon('save')}
          </Button>
        </div>

        {assets.rates.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line)]">
            {assets.rates.map((r, idx) => (
              <div
                key={r.currency}
                className={cn(
                  'flex items-center justify-between px-3 py-2 text-[12px]',
                  idx > 0 && 'border-t border-[var(--line)]'
                )}
              >
                <span className="font-semibold text-[var(--text)]">{r.currency}</span>
                <span className="tnum text-[var(--text-muted)]">
                  1 {r.currency} = {Number(r.rate).toLocaleString('id-ID')} {primary}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await assets.removeRate(r.currency);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : tCommon('failed'));
                    }
                  }}
                  aria-label={tCommon('delete')}
                  className="text-[var(--text-faint)] transition hover:text-[var(--out)]"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
