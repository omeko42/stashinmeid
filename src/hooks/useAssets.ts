'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createDemoAccounts } from '@/lib/demoData';

export type AccountKind = 'bank' | 'cash' | 'ewallet' | 'crypto' | 'other';

export interface AssetAccount {
  id: string;
  name: string;
  kind: AccountKind;
  institution: string | null;
  currency: string;
  balance: number;
}

export interface FxRate {
  currency: string;
  rate: number;
  updated_at?: string;
}

export const CURRENCY_OPTIONS = [
  'IDR', 'USD', 'EUR', 'SGD', 'JPY', 'AUD', 'GBP', 'CNY', 'MYR', 'USDT',
];

/**
 * Aset terpisah: dompet bank spesifik, kas, crypto, dst. + kurs manual
 * (1 unit mata uang = rate × mata_uang_utama) dan mata uang utama.
 *
 * Semuanya hidup di DB Supabase (tabel `accounts`, `fx_rates`, kolom
 * `primary_currency` di `profiles`) - jadi tidak hilang saat refresh.
 */
export function useAssets(opts: { isDemoMode: boolean; isSuperadmin: boolean }) {
  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [rates, setRates] = useState<FxRate[]>([]);
  const [primaryCurrency, setPrimaryCurrency] = useState('IDR');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (opts.isDemoMode) {
      setAccounts(createDemoAccounts());
      setRates([{ currency: 'USDT', rate: 15870 }, { currency: 'USD', rate: 15865 }]);
      setPrimaryCurrency('IDR');
      setError(null);
      setLoading(false);
      return;
    }

    // Superadmin (termasuk saat impersonate) tidak punya sesi Supabase
    // milik user target, jadi datanya diambil lewat API admin yang memakai
    // service role. Tanpa ini, dompet & kurs selalu kosong untuk superadmin.
    if (opts.isSuperadmin) {
      setLoading(true);
      try {
        const [accRes, rateRes, profRes] = await Promise.all([
          fetch('/api/superadmin/finance?table=accounts'),
          fetch('/api/superadmin/finance?table=fx_rates'),
          fetch('/api/superadmin/finance?table=profiles'),
        ]);

        const accJson = await accRes.json().catch(() => ({}));
        const rateJson = await rateRes.json().catch(() => ({}));
        const profJson = await profRes.json().catch(() => ({}));

        if (!accRes.ok) {
          setError(accJson.error || 'Gagal memuat dompet.');
          setAccounts([]);
          setRates([]);
        } else {
          setAccounts((accJson.data as AssetAccount[]) ?? []);
          setRates((rateJson.data as FxRate[]) ?? []);
          const profRow = Array.isArray(profJson.data) ? profJson.data[0] : profJson.data;
          if (profRow?.primary_currency) setPrimaryCurrency(profRow.primary_currency);
          setError(null);
        }
      } catch {
        setError('Gagal memuat dompet.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [accRes, rateRes, profRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, kind, institution, currency, balance')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('fx_rates')
        .select('currency, rate, updated_at')
        .eq('user_id', user.id)
        .order('currency'),
      supabase.from('profiles').select('primary_currency').eq('id', user.id).single(),
    ]);

    if (accRes.error || rateRes.error || profRes.error) {
      setError(accRes.error?.message || rateRes.error?.message || profRes.error?.message || null);
    } else {
      setAccounts((accRes.data as AssetAccount[]) ?? []);
      setRates((rateRes.data as FxRate[]) ?? []);
      if (profRes.data?.primary_currency) setPrimaryCurrency(profRes.data.primary_currency);
      setError(null);
    }
    setLoading(false);
  }, [opts.isDemoMode, opts.isSuperadmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveAccount = useCallback(
    async (row: {
      id?: string;
      name: string;
      kind: AccountKind;
      institution: string | null;
      currency: string;
      balance: number;
    }) => {
      if (opts.isDemoMode) {
        setAccounts((prev) => {
          if (row.id) {
            return prev.map((a) => (a.id === row.id ? { ...a, ...row, id: row.id } : a));
          }
          return [...prev, { ...row, id: crypto.randomUUID() }];
        });
        return;
      }

      // Superadmin menulis lewat API admin (service role), bukan sesi Supabase.
      if (opts.isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: row.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'accounts',
            id: row.id,
            updates: row,
            payload: row,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Gagal menyimpan dompet.');
        await refresh();
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error('Supabase belum dikonfigurasi');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum login');
      const { error: err } =
        row.id
          ? await supabase
              .from('accounts')
              .update({ ...row, updated_at: new Date().toISOString() })
              .eq('id', row.id)
              .eq('user_id', user.id)
          : await supabase.from('accounts').insert({ ...row, user_id: user.id });
      if (err) throw err;
      await refresh();
    },
    [opts.isDemoMode, opts.isSuperadmin, refresh]
  );

  const removeAccount = useCallback(
    async (id: string) => {
      if (opts.isDemoMode) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        return;
      }

      if (opts.isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'accounts', id }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Gagal menghapus dompet.');
        await refresh();
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error('Supabase belum dikonfigurasi');
      const { error: err } = await supabase.from('accounts').delete().eq('id', id);
      if (err) throw err;
      await refresh();
    },
    [opts.isDemoMode, opts.isSuperadmin, refresh]
  );

  const savePrimaryCurrency = useCallback(
    async (currency: string) => {
      if (opts.isDemoMode) {
        setPrimaryCurrency(currency);
        return;
      }

      if (opts.isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'profiles',
            updates: { primary_currency: currency },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Gagal menyimpan mata uang utama.');
        setPrimaryCurrency(currency);
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error('Supabase belum dikonfigurasi');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum login');
      const { error: err } = await supabase
        .from('profiles')
        .update({ primary_currency: currency })
        .eq('id', user.id);
      if (err) throw err;
      setPrimaryCurrency(currency);
    },
    [opts.isDemoMode, opts.isSuperadmin]
  );

  const saveRate = useCallback(
    async (currency: string, rate: number) => {
      if (opts.isDemoMode) {
        setRates((prev) => {
          const exists = prev.some((r) => r.currency === currency);
          return exists
            ? prev.map((r) => (r.currency === currency ? { ...r, rate } : r))
            : [...prev, { currency, rate }];
        });
        return;
      }

      if (opts.isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'fx_rates',
            payload: { currency, rate },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Gagal menyimpan kurs.');
        await refresh();
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error('Supabase belum dikonfigurasi');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum login');
      const { error: err } = await supabase.from('fx_rates').upsert(
        { user_id: user.id, currency, rate, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,currency' }
      );
      if (err) throw err;
      await refresh();
    },
    [opts.isDemoMode, opts.isSuperadmin, refresh]
  );

  /**
   * Update kurs OTOMATIS: fiat dari Frankfurter (ECB), crypto dari CoinGecko.
   * Hanya menyegarkan mata uang yang dipakai di dompet / sudah ada di kurs,
   * lalu hasilnya di-upsert ke fx_rates.
   */
  const syncRates = useCallback(async () => {
    setSyncing(true);
    try {
      const base = primaryCurrency;
      const codes = new Set<string>();
      for (const a of accounts) if (a.currency !== base) codes.add(a.currency);
      for (const r of rates) if (r.currency !== base) codes.add(r.currency);
      const wanted = [...codes];
      if (wanted.length === 0) return 0;

      const COINGECKO_IDS: Record<string, string> = {
        USDT: 'tether',
        BTC: 'bitcoin',
        ETH: 'ethereum',
        BNB: 'binancecoin',
        SOL: 'solana',
        XRP: 'ripple',
        DOGE: 'dogecoin',
      };
      const fiat = wanted.filter((c) => !COINGECKO_IDS[c]);
      const cryptoIds = wanted
        .filter((c) => COINGECKO_IDS[c])
        .map((c) => COINGECKO_IDS[c]);

      const fetched: { currency: string; rate: number }[] = [];
      if (fiat.length > 0) {
        const res = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${fiat.join(',')}`
        );
        if (!res.ok) throw new Error('Gagal mengambil kurs fiat (ECB)');
        const json = (await res.json()) as { rates?: Record<string, number> };
        for (const c of fiat) {
          const inv = json.rates?.[c];
          if (inv && inv > 0) fetched.push({ currency: c, rate: 1 / inv });
        }
      }
      if (cryptoIds.length > 0) {
        const vs = encodeURIComponent(base.toLowerCase());
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds.join(',')}&vs_currencies=${vs}`
        );
        if (!res.ok) throw new Error('Gagal mengambil kurs crypto (CoinGecko)');
        const json = (await res.json()) as Record<string, Record<string, number>>;
        for (const c of wanted) {
          const id = COINGECKO_IDS[c];
          const v = id ? json[id]?.[base.toLowerCase()] : undefined;
          if (v && v > 0) fetched.push({ currency: c, rate: v });
        }
      }
      if (fetched.length === 0) return 0;

      const now = new Date().toISOString();

      if (opts.isDemoMode) {
        setRates((prev) => {
          const next = [...prev];
          for (const f of fetched) {
            const idx = next.findIndex((r) => r.currency === f.currency);
            if (idx >= 0) next[idx] = { ...next[idx], rate: f.rate, updated_at: now };
            else next.push({ currency: f.currency, rate: f.rate, updated_at: now });
          }
          return next;
        });
        return fetched.length;
      }

      if (opts.isSuperadmin) {
        // Superadmin tidak punya sesi Supabase milik user target, jadi kurs
        // ditulis lewat API admin (service role).
        for (const f of fetched) {
          const res = await fetch('/api/superadmin/finance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'fx_rates',
              payload: { currency: f.currency, rate: f.rate, updated_at: now },
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || 'Gagal menyimpan kurs.');
        }
      } else {
        const supabase = createClient();
        if (!supabase) throw new Error('Supabase belum dikonfigurasi');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Belum login');

        const { error: err } = await supabase.from('fx_rates').upsert(
          fetched.map((f) => ({ user_id: user.id, currency: f.currency, rate: f.rate, updated_at: now })),
          { onConflict: 'user_id,currency' }
        );
        if (err) throw err;
      }

      await refresh();
      return fetched.length;
    } finally {
      setSyncing(false);
    }
  }, [accounts, rates, primaryCurrency, refresh, opts.isDemoMode, opts.isSuperadmin]);

  const removeRate = useCallback(
    async (currency: string) => {
      if (opts.isDemoMode) {
        setRates((prev) => prev.filter((r) => r.currency !== currency));
        return;
      }

      if (opts.isSuperadmin) {
        // Endpoint DELETE butuh id baris, sedangkan fx_rates diidentifikasi
        // lewat (user, currency). Jadi id-nya dicari dulu lewat API admin.
        const listRes = await fetch('/api/superadmin/finance?table=fx_rates');
        const listJson = await listRes.json().catch(() => ({}));
        if (!listRes.ok) throw new Error(listJson.error || 'Gagal menghapus kurs.');

        const rows = (listJson.data as (FxRate & { id: string })[]) ?? [];
        const row = rows.find((r) => r.currency === currency);
        if (!row) return;

        const res = await fetch('/api/superadmin/finance', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'fx_rates', id: row.id }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Gagal menghapus kurs.');
        await refresh();
        return;
      }

      const supabase = createClient();
      if (!supabase) throw new Error('Supabase belum dikonfigurasi');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum login');
      const { error: err } = await supabase
        .from('fx_rates')
        .delete()
        .eq('user_id', user.id)
        .eq('currency', currency);
      if (err) throw err;
      await refresh();
    },
    [opts.isDemoMode, opts.isSuperadmin, refresh]
  );

  /** Nilai satu akun dikonversi ke mata uang utama. */
  const convert = useCallback(
    (balance: number, currency: string) => {
      if (currency === primaryCurrency) return balance;
      const r = rates.find((x) => x.currency === currency);
      if (!r) return null; // tanpa kurs, tidak bisa dikonversi
      return balance * Number(r.rate);
    },
    [rates, primaryCurrency]
  );

  const totalConverted = accounts.reduce(
    (sum, a) => sum + (convert(a.balance, a.currency) ?? 0),
    0
  );

  return {
    accounts,
    rates,
    primaryCurrency,
    loading,
    error,
    refresh,
    saveAccount,
    removeAccount,
    savePrimaryCurrency,
    saveRate,
    removeRate,
    syncRates,
    syncing,
    convert,
    totalConverted,
  };
}

export type AssetsApi = ReturnType<typeof useAssets>;
