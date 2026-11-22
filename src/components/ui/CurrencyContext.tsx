'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { setGlobalDisplayCurrency } from '@/lib/format';

/** Nilai default 1 unit mata uang asing ke IDR (fallback sebelum live ECB/CoinGecko tiba). */
export const DEFAULT_IDR_PER_UNIT: Record<string, number> = {
  IDR: 1,
  USD: 15865,
  EUR: 16920,
  SGD: 11820,
  GBP: 20150,
  JPY: 103,
  AUD: 10350,
  MYR: 3560,
  CNY: 2190,
  USDT: 15870,
  BTC: 1540000000,
  ETH: 49300000,
  SOL: 3420000,
};

interface CurrencyContextValue {
  primaryCurrency: string;
  idrPerUnit: Record<string, number>;
  setPrimaryCurrency: (currency: string) => void;
  /** Konversi nilai dari mata uang `from` ke mata uang utama aktif. */
  convertToPrimary: (amount: number, fromCurrency: string) => number;
  /** Konversi nilai dari mata uang `from` ke IDR (basis penyimpanan transaksi). */
  convertToIdr: (amount: number, fromCurrency: string) => number;
}

const STORAGE_KEY = 'stashinmeid_primary_currency';

const CurrencyContext = createContext<CurrencyContextValue>({
  primaryCurrency: 'IDR',
  idrPerUnit: DEFAULT_IDR_PER_UNIT,
  setPrimaryCurrency: () => {},
  convertToPrimary: (amount) => amount,
  convertToIdr: (amount) => amount,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [primaryCurrency, setPrimaryState] = useState<string>('IDR');
  const [idrPerUnit, setIdrPerUnit] =
    useState<Record<string, number>>(DEFAULT_IDR_PER_UNIT);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPrimaryState(saved);
        setGlobalDisplayCurrency(saved, DEFAULT_IDR_PER_UNIT[saved] ?? 1);
      }
    }

    // Ambil kurs live ECB & CoinGecko ke IDR agar konversi aset asing otomatis akurat
    let alive = true;
    (async () => {
      try {
        const [fxRes, cryptoRes] = await Promise.all([
          fetch(
            'https://api.frankfurter.dev/v1/latest?base=IDR&symbols=USD,EUR,SGD,GBP,JPY,AUD,MYR,CNY'
          ).catch(() => null),
          fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether&vs_currencies=idr'
          ).catch(() => null),
        ]);

        const nextRates: Record<string, number> = { ...DEFAULT_IDR_PER_UNIT };

        if (fxRes?.ok) {
          const fx = (await fxRes.json()) as { rates?: Record<string, number> };
          for (const [code, rate] of Object.entries(fx.rates ?? {})) {
            if (rate && rate > 0) nextRates[code] = 1 / rate;
          }
        }
        if (cryptoRes?.ok) {
          const c = (await cryptoRes.json()) as Record<
            string,
            { idr?: number }
          >;
          if (c.bitcoin?.idr) nextRates.BTC = c.bitcoin.idr;
          if (c.ethereum?.idr) nextRates.ETH = c.ethereum.idr;
          if (c.solana?.idr) nextRates.SOL = c.solana.idr;
          if (c.tether?.idr) nextRates.USDT = c.tether.idr;
        }

        if (alive) {
          setIdrPerUnit(nextRates);
          const cur =
            (typeof window !== 'undefined' &&
              localStorage.getItem(STORAGE_KEY)) ||
            'IDR';
          setGlobalDisplayCurrency(cur, nextRates[cur] ?? 1);
        }
      } catch {
        // Pakai fallback
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const setPrimaryCurrency = useCallback(
    (currency: string) => {
      const normalized = currency.toUpperCase();
      setPrimaryState(normalized);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, normalized);
      }
      setGlobalDisplayCurrency(normalized, idrPerUnit[normalized] ?? 1);
    },
    [idrPerUnit]
  );

  const convertToIdr = useCallback(
    (amount: number, fromCurrency: string) => {
      const code = fromCurrency.toUpperCase();
      if (code === 'IDR') return amount;
      const rate = idrPerUnit[code] ?? 1;
      return amount * rate;
    },
    [idrPerUnit]
  );

  const convertToPrimary = useCallback(
    (amount: number, fromCurrency: string) => {
      const inIdr = convertToIdr(amount, fromCurrency);
      if (primaryCurrency === 'IDR') return inIdr;
      const targetIdrPerUnit = idrPerUnit[primaryCurrency] ?? 1;
      return targetIdrPerUnit > 0 ? inIdr / targetIdrPerUnit : inIdr;
    },
    [convertToIdr, primaryCurrency, idrPerUnit]
  );

  return (
    <CurrencyContext.Provider
      value={{
        primaryCurrency,
        idrPerUnit,
        setPrimaryCurrency,
        convertToPrimary,
        convertToIdr,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
