'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'stashinmeid_hide_balance';

interface BalancePrivacyValue {
  /** true = nominal disembunyikan di seluruh aplikasi. */
  hidden: boolean;
  /** Balikkan status. */
  toggle: () => void;
  /** Set status secara eksplisit. */
  setHidden: (hidden: boolean) => void;
  /** Sudah selesai baca preferensi dari localStorage? */
  ready: boolean;
}

const BalancePrivacyContext = createContext<BalancePrivacyValue>({
  hidden: false,
  toggle: () => {},
  setHidden: () => {},
  ready: false,
});

/**
 * Preferensi "sembunyikan saldo".
 *
 * Diterapkan secara global lewat komponen `Amount`, jadi sekali sakel,
 * semua nominal uang di aplikasi ikut tersembunyi - bukan cuma di satu
 * tempat. Ini yang biasa dipakai aplikasi keuangan untuk dipakai di
 * tempat umum.
 *
 * Preferensi disimpan di localStorage, jadi tetap berlaku setelah reload
 * dan di perangkat yang sama.
 */
export function BalancePrivacyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hidden, setHiddenState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setHiddenState(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // localStorage bisa diblokir (mode privasi browser).
    }
    setReady(true);
  }, []);

  const setHidden = useCallback((next: boolean) => {
    setHiddenState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Diabaikan - preferensi hanya berlaku selama sesi ini.
    }
  }, []);

  const toggle = useCallback(() => {
    setHiddenState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Diabaikan.
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ hidden, toggle, setHidden, ready }),
    [hidden, toggle, setHidden, ready]
  );

  return (
    <BalancePrivacyContext.Provider value={value}>
      {children}
    </BalancePrivacyContext.Provider>
  );
}

/**
 * Akses preferensi sembunyikan saldo.
 *
 * `ready` dipakai supaya komponen bisa menunggu state localStorage sudah
 * termuat sebelum menyetel tampilan - mencegah hydration mismatch.
 */
export function useBalancePrivacy() {
  return useContext(BalancePrivacyContext);
}

/**
 * Masking nominal uang.
 *
 * Dipakai di `Amount` supaya semua angka uang di app konsisten. Format
 * aslinya (`Rp 1.234.567`) diganti bullet dengan panjang yang wajar supaya
 * layout tidak bergeser drastic.
 */
export function maskAmount(value: string): string {
  // Jumlah digit angka menentukan panjang bullet - cukup jelas bahwa ini
  // nominal, tapi tidak membocorkan urutan besarnya secara detail.
  const digits = value.replace(/\D/g, '').length;
  const bullets = Math.min(Math.max(digits, 4), 8);
  return '•'.repeat(bullets);
}
