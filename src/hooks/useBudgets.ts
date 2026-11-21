'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Budget, BudgetPeriod } from '@/types/finance';

interface UseBudgetsOptions {
  isDemoMode: boolean;
  isSuperadmin: boolean;
}

interface UseBudgetsResult {
  budgets: Budget[];
  loading: boolean;
  error: string | null;
  /** Simpan pagu. Kategori + periode yang sama akan diperbarui, bukan diduplikasi. */
  saveBudget: (category: string, amount: number, period: BudgetPeriod) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Pagu per kategori.
 *
 * Tiga sumber data, sesuai mode sesi:
 * - user biasa  -> tabel `budgets` lewat RLS Supabase
 * - superadmin  -> API admin (service role), termasuk saat impersonate
 * - demo        -> hanya di memori, tidak menyentuh database
 */
export function useBudgets({
  isDemoMode,
  isSuperadmin,
}: UseBudgetsOptions): UseBudgetsResult {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isDemoMode) {
      setBudgets([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSuperadmin) {
        const res = await fetch('/api/superadmin/finance?table=budgets');
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Gagal memuat pagu.');
          setBudgets([]);
          return;
        }
        setBudgets((json.data as Budget[]) || []);
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        setBudgets([]);
        return;
      }

      const { data, error: sbError } = await supabase
        .from('budgets')
        .select('*')
        .order('category', { ascending: true });

      if (sbError) {
        // Tabel `budgets` belum ada di Supabase - migrasi belum dijalankan.
        // Ini kondisi yang wajar, jadi bukan error yang perlu dikhawatirkan user.
        setError(null);
        setBudgets([]);
        return;
      }

      setBudgets((data as Budget[]) || []);
    } catch {
      setError('Gagal memuat pagu.');
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, isSuperadmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBudget = useCallback(
    async (category: string, amount: number, period: BudgetPeriod) => {
      const value = Number(amount);
      if (!category || !value || value <= 0) return;

      if (isDemoMode) {
        setBudgets((prev) => {
          const existing = prev.find(
            (b) => b.category === category && b.period === period
          );
          if (existing) {
            return prev.map((b) =>
              b.id === existing.id ? { ...b, amount: value } : b
            );
          }
          return [
            ...prev,
            { id: crypto.randomUUID(), category, amount: value, period },
          ];
        });
        return;
      }

      if (isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'budgets',
            payload: { category, amount: value, period },
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Gagal menyimpan pagu.');
          return;
        }
        if (json.data) {
          const saved = json.data as Budget;
          setBudgets((prev) => {
            const without = prev.filter((b) => b.id !== saved.id);
            return [...without, saved].sort((a, b) =>
              a.category.localeCompare(b.category)
            );
          });
        }
        return;
      }

      const supabase = createClient();
      if (!supabase) return;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error: sbError } = await supabase
        .from('budgets')
        .upsert(
          {
            user_id: userData.user.id,
            category,
            amount: value,
            period,
          },
          { onConflict: 'user_id,category,period' }
        )
        .select()
        .single();

      if (sbError) {
        setError(sbError.message);
        return;
      }

      if (data) {
        const saved = data as Budget;
        setBudgets((prev) => {
          const without = prev.filter((b) => b.id !== saved.id);
          return [...without, saved].sort((a, b) =>
            a.category.localeCompare(b.category)
          );
        });
      }
    },
    [isDemoMode, isSuperadmin]
  );

  const removeBudget = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setBudgets((prev) => prev.filter((b) => b.id !== id));
        return;
      }

      if (isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'budgets', id }),
        });
        if (res.ok) setBudgets((prev) => prev.filter((b) => b.id !== id));
        return;
      }

      const supabase = createClient();
      if (!supabase) return;

      const { error: sbError } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);

      if (sbError) {
        setError(sbError.message);
        throw sbError;
      }
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    },
    [isDemoMode, isSuperadmin]
  );

  return {
    budgets,
    loading,
    error,
    saveBudget,
    removeBudget,
    refresh: load,
  };
}
