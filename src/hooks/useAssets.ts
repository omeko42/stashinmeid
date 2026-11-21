'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (opts.isDemoMode || opts.isSuperadmin) {
      setLoading(false);
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
    [refresh]
  );

  const removeAccount = useCallback(
    async (id: string) => {
      const supabase = createClient();
    if (!supabase) throw new Error('Supabase belum dikonfigurasi');
      const { error: err } = await supabase.from('accounts').delete().eq('id', id);
      if (err) throw err;
      await refresh();
    },
    [refresh]
  );

  const savePrimaryCurrency = useCallback(
    async (currency: string) => {
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
    []
  );

  const saveRate = useCallback(
    async (currency: string, rate: number) => {
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
    [refresh]
  );

  const removeRate = useCallback(
    async (currency: string) => {
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
    [refresh]
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
    convert,
    totalConverted,
  };
}

export type AssetsApi = ReturnType<typeof useAssets>;
