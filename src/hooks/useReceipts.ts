'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { compressReceiptImage } from '@/lib/imageCompress';
import type { StoredReceiptMeta } from '@/app/api/receipts/route';

export interface ReceiptQuotaInfo {
  items: StoredReceiptMeta[];
  usedBytes: number;
  quotaBytes: number | null;
  quotaMb: number | null;
  unlimited: boolean;
  tier: string;
  aiUsedToday: number;
  aiDailyLimit: number | null;
}

export interface ReceiptsApi extends ReceiptQuotaInfo {
  loading: boolean;
  byTransactionId: Map<string, StoredReceiptMeta>;
  refresh: () => Promise<void>;
  uploadReceipt: (
    file: File,
    opts?: { transactionId?: string | null; label?: string }
  ) => Promise<{
    receipt: StoredReceiptMeta | null;
    quotaExceeded?: boolean;
    error?: string;
    compressedBytes?: number;
    originalBytes?: number;
  }>;
  linkToTransaction: (
    receiptId: string,
    transactionId: string,
    label?: string
  ) => Promise<void>;
  getSignedUrl: (receiptId: string) => Promise<string | null>;
  deleteReceipt: (receiptId: string) => Promise<boolean>;
}

const EMPTY_STATE: ReceiptQuotaInfo = {
  items: [],
  usedBytes: 0,
  quotaBytes: 5 * 1024 * 1024,
  quotaMb: 5,
  unlimited: false,
  tier: 'free',
  aiUsedToday: 0,
  aiDailyLimit: 2,
};

export function useReceipts(isDemoMode: boolean): ReceiptsApi {
  const [state, setState] = useState<ReceiptQuotaInfo>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (isDemoMode) {
      setState(EMPTY_STATE);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/receipts', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setState({
        items: Array.isArray(json.items) ? json.items : [],
        usedBytes: Number(json.usedBytes) || 0,
        quotaBytes: json.quotaBytes === null ? null : Number(json.quotaBytes) || 0,
        quotaMb: json.quotaMb === null ? null : Number(json.quotaMb) || 0,
        unlimited: Boolean(json.unlimited),
        tier: String(json.tier || 'free'),
        aiUsedToday: Number(json.aiUsedToday) || 0,
        aiDailyLimit:
          json.aiDailyLimit === null ? null : Number(json.aiDailyLimit) || 2,
      });
    } catch {
      // Abaikan gangguan jaringan sementara
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byTransactionId = useMemo(() => {
    const map = new Map<string, StoredReceiptMeta>();
    for (const r of state.items) {
      if (r.transactionId && !map.has(r.transactionId)) {
        map.set(r.transactionId, r);
      }
    }
    return map;
  }, [state.items]);

  const uploadReceipt = useCallback(
    async (
      rawFile: File,
      opts?: { transactionId?: string | null; label?: string }
    ) => {
      if (isDemoMode) {
        return {
          receipt: null,
          error: 'Simpan struk tidak tersedia di Mode Demo.',
        };
      }
      const compressed = await compressReceiptImage(rawFile);
      const fd = new FormData();
      fd.append('file', compressed.file);
      if (opts?.transactionId) fd.append('transactionId', opts.transactionId);
      if (opts?.label) fd.append('label', opts.label);

      const res = await fetch('/api/receipts', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          receipt: null,
          quotaExceeded: json.code === 'STORAGE_QUOTA_EXCEEDED',
          error: json.error || 'Gagal menyimpan struk.',
          compressedBytes: compressed.compressedBytes,
          originalBytes: compressed.originalBytes,
        };
      }
      const receipt = json.receipt as StoredReceiptMeta;
      setState((prev) => ({
        ...prev,
        items: [receipt, ...prev.items],
        usedBytes: Number(json.usedBytes) || prev.usedBytes + receipt.sizeBytes,
      }));
      return {
        receipt,
        compressedBytes: compressed.compressedBytes,
        originalBytes: compressed.originalBytes,
      };
    },
    [isDemoMode]
  );

  const linkToTransaction = useCallback(
    async (receiptId: string, transactionId: string, label?: string) => {
      if (isDemoMode || !receiptId || !transactionId) return;
      const res = await fetch('/api/receipts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, transactionId, label }),
      });
      if (res.ok) {
        setState((prev) => ({
          ...prev,
          items: prev.items.map((r) =>
            r.id === receiptId
              ? { ...r, transactionId, label: label || r.label }
              : r
          ),
        }));
      }
    },
    [isDemoMode]
  );

  const getSignedUrl = useCallback(async (receiptId: string) => {
    const res = await fetch(`/api/receipts?id=${encodeURIComponent(receiptId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return typeof json.signedUrl === 'string' ? json.signedUrl : null;
  }, []);

  const deleteReceipt = useCallback(async (receiptId: string) => {
    const res = await fetch('/api/receipts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptId }),
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => ({}));
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((r) => r.id !== receiptId),
      usedBytes:
        typeof json.usedBytes === 'number' ? json.usedBytes : prev.usedBytes,
    }));
    return true;
  }, []);

  return {
    ...state,
    loading,
    byTransactionId,
    refresh,
    uploadReceipt,
    linkToTransaction,
    getSignedUrl,
    deleteReceipt,
  };
}
