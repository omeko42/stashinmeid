'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useHotkey } from '@/hooks/useHotkey';
import { useCountUp } from '@/hooks/useCountUp';
import { useBudgets } from '@/hooks/useBudgets';
import { useKolega } from '@/hooks/useKolega';
import { CommandPalette, type CommandAction } from '@/components/shell/CommandPalette';
import { Sidebar, type NavTab } from '@/components/shell/Sidebar';
import { MobileHeader } from '@/components/shell/MobileHeader';
import { BottomNav } from '@/components/shell/BottomNav';
import {
  QuickAddSheet,
  initialQuickAddState,
  type QuickAddState,
} from '@/components/shell/QuickAddSheet';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { CashflowTab } from '@/components/tabs/CashflowTab';
import { DebtsTab } from '@/components/tabs/DebtsTab';
import { BudgetTab } from '@/components/tabs/BudgetTab';
import { SettingsTab } from '@/components/tabs/SettingsTab';
import { ProfileTab } from '@/components/tabs/ProfileTab';
import { SecuritySettings } from '@/components/profile/SecuritySettings';
import { KycModal } from '@/components/profile/KycModal';
import { UsersTab, type ManagedUser } from '@/components/tabs/UsersTab';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { createClient } from '@/lib/supabase/client';
import type { Debt, Transaction, TransactionType, UserRole } from '@/types/finance';
import {
  exportToCSV,
  exportToPDF,
  exportToWord,
  parseCSVTransactions,
} from '@/lib/exportUtils';
import { budgetStatuses } from '@/lib/budget';
import { todayIso } from '@/lib/format';
import { UserCheck } from 'lucide-react';

interface DashboardClientProps {
  initialTransactions: Transaction[];
  initialDebts: Debt[];
  userEmail: string | null;
  clientName: string;
  userRole: UserRole;
  isDemoMode: boolean;
  isSuperadmin?: boolean;
  impersonatingEmail?: string | null;
  initialBio?: string;
  initialAvatarUrl?: string | null;
  initialBannerUrl?: string | null;
}

interface DebtFormState {
  platform: string;
  contract: string;
  balance: string;
  installment: string;
  tenor: string;
  dueDay: string;
}

const EMPTY_DEBT_FORM: DebtFormState = {
  platform: '',
  contract: '',
  balance: '',
  installment: '',
  tenor: '',
  dueDay: '',
};

/**
 * Orquestrator dashboard.
 *
 * File ini hanya memegang state dan memanggil handler. Tampilan tiap tab
 * ada di `components/tabs/`, dan bagian kerangka ada di `components/shell/`.
 * Logic pengambilan data di `app/[locale]/page.tsx` tidak disentuh.
 */
export default function DashboardClient({
  initialTransactions,
  initialDebts,
  userEmail,
  clientName,
  userRole,
  isDemoMode,
  isSuperadmin = false,
  impersonatingEmail = null,
  initialBio = '',
  initialAvatarUrl = null,
  initialBannerUrl = null,
}: DashboardClientProps) {
  const t = useTranslations();
  const tNav = useTranslations('nav');
  const tCashflow = useTranslations('cashflow');
  const tDebts = useTranslations('debts');
  const tBudget = useTranslations('budget');
  const tUsers = useTranslations('users');
  const tSettings = useTranslations('settings.profile');
  const tSecSettings = useTranslations('settings');
  const router = useRouter();

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const canEdit = userRole !== 'viewer';

  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);

  // Simulasi pelunasan
  const [simSelectedIds, setSimSelectedIds] = useState<string[]>([]);

  // Manajemen user (superadmin)
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserClient, setEditUserClient] = useState('');

  // Keamanan: PIN & 2FA
  const [appPin, setAppPin] = useState('');
  const [pinLocked, setPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Profil
  const [profileUsername, setProfileUsername] = useState(
    userEmail && !userEmail.includes('@') ? userEmail : userEmail?.split('@')[0] || 'user'
  );
  const [profileEmail, setProfileEmail] = useState(
    userEmail && userEmail.includes('@') ? userEmail : ''
  );
  const [profileClient, setProfileClient] = useState(clientName);
  const [profileBio, setProfileBio] = useState(
    initialBio || 'Pengelola keuangan pribadi & pemantauan cashflow di stashinmeid.'
  );
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [profileBannerUrl, setProfileBannerUrl] = useState<string | null>(initialBannerUrl);

  // Draft profil untuk modal edit
  const [draftUsername, setDraftUsername] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftClient, setDraftClient] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Form transaksi
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(initialQuickAddState);
  const [txLoading, setTxLoading] = useState(false);

  // Pindai struk AI
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  // Form pinjaman
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtForm, setDebtForm] = useState<DebtFormState>(EMPTY_DEBT_FORM);

  const budgets = useBudgets({ isDemoMode, isSuperadmin });
  const kolega = useKolega();

  useEffect(() => {
    const savedPin =
      typeof window !== 'undefined' ? localStorage.getItem('stashinme_pin') : null;
    if (savedPin) setAppPin(savedPin);
  }, []);

  // Sinkronkan state lokal dengan data dari server.
  //
  // Tanpa ini, `router.refresh()` (mis. setelah impersonate) tidak mengubah
  // apa pun yang tampil: state di sini diinisialisasi sekali dari props.
  // Identitas array props berubah setiap server render, jadi ini aman -
  // pengubahan lokal (tambah/hapus transaksi) tidak memicu effect.
  useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  useEffect(() => {
    setDebts(initialDebts);
  }, [initialDebts]);

  // ------------------------------------------------------------------
  // Metrik
  // ------------------------------------------------------------------

  const totalInflow = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'inflow')
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions]
  );

  const totalOutflow = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'outflow')
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions]
  );

  const netCashflow = totalInflow - totalOutflow;
  const savingsRate =
    totalInflow > 0 ? Math.max(0, Math.round((netCashflow / totalInflow) * 100)) : 0;

  // Angka hero menghitung naik saat berubah - motion menjawab aksi.
  const animatedBalance = useCountUp(netCashflow);

  const activeDebts = useMemo(
    () => debts.filter((d) => d.status === 'active'),
    [debts]
  );
  const totalDebt = useMemo(
    () => activeDebts.reduce((sum, d) => sum + Number(d.remaining_balance), 0),
    [activeDebts]
  );
  const monthlyDebtBurden = useMemo(
    () => activeDebts.reduce((sum, d) => sum + Number(d.monthly_installment || 0), 0),
    [activeDebts]
  );

  const upcomingDebts = useMemo(
    () =>
      [...activeDebts]
        .filter((d) => d.due_day !== null)
        .sort((a, b) => (a.due_day || 31) - (b.due_day || 31))
        .slice(0, 4),
    [activeDebts]
  );

  const simStats = useMemo(() => {
    const selected = activeDebts.filter((d) => simSelectedIds.includes(d.id));
    return {
      count: selected.length,
      payoffNeeded: selected.reduce((s, d) => s + Number(d.remaining_balance), 0),
      monthlySaved: selected.reduce(
        (s, d) => s + Number(d.monthly_installment || 0),
        0
      ),
    };
  }, [activeDebts, simSelectedIds]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchType = filterType === 'all' || tx.type === filterType;
      const matchQuery =
        !q ||
        (tx.description || '').toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  }, [transactions, filterType, searchQuery]);

  const budgetList = useMemo(
    () => budgetStatuses(budgets.budgets, transactions),
    [budgets.budgets, transactions]
  );

  const profileCompleteness = useMemo(() => {
    let score = 40;
    if (profileUsername) score += 15;
    if (profileEmail && profileEmail.includes('@')) score += 15;
    if (profileClient) score += 15;
    if (appPin) score += 15;
    return Math.min(100, score);
  }, [profileUsername, profileEmail, profileClient, appPin]);

  // ------------------------------------------------------------------
  // Transaksi
  // ------------------------------------------------------------------

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(quickAdd.amount);
    if (!amountNum || amountNum <= 0) return;

    setTxLoading(true);
    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type: quickAdd.type,
      amount: amountNum,
      category: quickAdd.category,
      description: quickAdd.description || null,
      transaction_date: quickAdd.date || todayIso(),
      source: scanMsg ? 'ai_scan' : 'manual',
    };

    try {
      if (!isDemoMode && isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'transactions',
            payload: {
              type: newTx.type,
              amount: newTx.amount,
              category: newTx.category,
              description: newTx.description,
              transaction_date: newTx.transaction_date,
              source: newTx.source,
            },
          }),
        });
        const json = await res.json();
        if (res.ok && json.data?.[0]) {
          setTransactions((prev) => [json.data[0], ...prev]);
        } else {
          toast.error(json.error || t('quickAdd.failed'));
          return;
        }
      } else if (!isDemoMode && supabase) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data, error } = await supabase
            .from('transactions')
            .insert({
              user_id: userData.user.id,
              type: newTx.type,
              amount: newTx.amount,
              category: newTx.category,
              description: newTx.description,
              transaction_date: newTx.transaction_date,
              source: newTx.source,
              ...(quickAdd.groupId ? { group_id: quickAdd.groupId } : {}),
            })
            .select()
            .single();

          if (error) {
            toast.error(error.message);
            return;
          }
          if (data) setTransactions((prev) => [data, ...prev]);
        }
      } else {
        setTransactions((prev) => [newTx, ...prev]);
      }

      setQuickAdd(initialQuickAddState());
      setScanMsg(null);
      setShowQuickAdd(false);
      toast.success(t('quickAdd.saved'));
    } finally {
      setTxLoading(false);
    }
  };

  /**
   * Hapus transaksi dengan jeda 5 detik.
   *
   * Baris langsung hilang dari layar supaya feels-nya responsif, tapi datanya
   * masih ada di state sampai:jeda habis. Kalau user menekan Batal, transaksi
   * dikembalikan tanpa perlu query ulang.
   */
  const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find((x) => x.id === id);
    if (!tx) return;

    setTransactions((prev) => prev.filter((x) => x.id !== id));

    // Hapus permanen setelah jeda undo habis.
    const timer = setTimeout(async () => {
      try {
        if (!isDemoMode && isSuperadmin) {
          await fetch('/api/superadmin/finance', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'transactions', id }),
          });
        } else if (!isDemoMode && supabase) {
          await supabase.from('transactions').delete().eq('id', id);
        }
      } catch {
        // Kegagalan di backend tidak bisa dipulihkan dari sisi client, tapi
        // barisnya sudah hilang dari layar - beri tahu user agar mengecek.
        toast.error(t('errors.generic'));
      }
    }, 5000);

    toast(tCashflow('deleted'), {
      action: {
        label: t('common.undo'),
        onClick: () => {
          clearTimeout(timer);
          setTransactions((prev) => [tx, ...prev]);
          toast.success(tCashflow('restored'));
        },
      },
      duration: 5000,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanMsg(null);
    setShowQuickAdd(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setScanMsg(json.error || t('tools.scanFailed'));
      } else if (json.data) {
        const d = json.data;
        setQuickAdd((prev) => ({
          ...prev,
          type: d.type === 'inflow' ? 'inflow' : 'outflow',
          amount: String(d.amount || ''),
          category: d.category || 'Lainnya',
          description: d.description || '',
          date: d.transaction_date || prev.date,
        }));
        setScanMsg(t('tools.scanSuccess'));
      }
    } catch {
      setScanMsg(t('tools.scanFailed'));
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;

    const text = await file.text();
    const parsed = parseCSVTransactions(text);
    if (parsed.length === 0) {
      toast.error(t('tools.importFailed'));
      if (csvInputRef.current) csvInputRef.current.value = '';
      return;
    }

    if (!isDemoMode && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const rows = parsed.map((p) => ({ ...p, user_id: userData.user!.id }));
        const { data, error } = await supabase
          .from('transactions')
          .insert(rows)
          .select();
        if (error) {
          toast.error(t('tools.importFailed'));
        } else if (data) {
          setTransactions((prev) => [...(data as Transaction[]), ...prev]);
          toast.success(t('tools.importSuccess', { count: data.length }));
        }
      }
    } else {
      const withIds: Transaction[] = parsed.map((p) => ({
        ...p,
        id: crypto.randomUUID(),
      }));
      setTransactions((prev) => [...withIds, ...prev]);
      toast.success(t('tools.importSuccess', { count: withIds.length }));
    }

    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // ------------------------------------------------------------------
  // Pinjaman
  // ------------------------------------------------------------------

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = Number(debtForm.balance);
    const installmentNum = Number(debtForm.installment) || 0;
    const tenorNum = Number(debtForm.tenor) || null;
    const dueNum = Number(debtForm.dueDay) || null;

    if (!debtForm.platform || !balanceNum) return;

    const newDebt: Debt = {
      id: crypto.randomUUID(),
      platform: debtForm.platform,
      contract_no: debtForm.contract || null,
      total_tenor: tenorNum,
      remaining_tenor: tenorNum,
      due_day: dueNum,
      remaining_balance: balanceNum,
      monthly_installment: installmentNum,
      status: 'active',
      notes: null,
    };

    if (!isDemoMode && isSuperadmin) {
      const res = await fetch('/api/superadmin/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'debts',
          payload: {
            platform: newDebt.platform,
            contract_no: newDebt.contract_no,
            total_tenor: newDebt.total_tenor,
            remaining_tenor: newDebt.remaining_tenor,
            due_day: newDebt.due_day,
            remaining_balance: newDebt.remaining_balance,
            monthly_installment: newDebt.monthly_installment,
            status: 'active',
          },
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setDebts((prev) => [json.data, ...prev]);
      }
    } else if (!isDemoMode && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data, error } = await supabase
          .from('debts')
          .insert({
            user_id: userData.user.id,
            platform: newDebt.platform,
            contract_no: newDebt.contract_no,
            total_tenor: newDebt.total_tenor,
            remaining_tenor: newDebt.remaining_tenor,
            due_day: newDebt.due_day,
            remaining_balance: newDebt.remaining_balance,
            monthly_installment: newDebt.monthly_installment,
            status: 'active',
          })
          .select()
          .single();

        if (!error && data) setDebts((prev) => [data, ...prev]);
      }
    } else {
      setDebts((prev) => [newDebt, ...prev]);
    }

    setDebtForm(EMPTY_DEBT_FORM);
    setShowDebtForm(false);
    toast.success(tDebts('added'));
  };

  const handlePayDebt = async (debt: Debt) => {
    const payAmount =
      debt.monthly_installment > 0
        ? Math.min(debt.monthly_installment, debt.remaining_balance)
        : debt.remaining_balance;

    const newBalance = Math.max(0, debt.remaining_balance - payAmount);
    const newTenor = debt.remaining_tenor
      ? Math.max(0, debt.remaining_tenor - 1)
      : null;
    const newStatus = newBalance === 0 ? 'paid_off' : 'active';

    if (!isDemoMode && supabase) {
      await supabase
        .from('debts')
        .update({
          remaining_balance: newBalance,
          remaining_tenor: newTenor,
          status: newStatus,
        })
        .eq('id', debt.id);

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: txData } = await supabase
          .from('transactions')
          .insert({
            user_id: userData.user.id,
            type: 'outflow',
            amount: payAmount,
            category: 'Tagihan & Cicilan',
            description: `Bayar cicilan ${debt.platform}`,
            transaction_date: todayIso(),
            source: 'debt_payment',
          })
          .select()
          .single();
        if (txData) setTransactions((prev) => [txData, ...prev]);
      }
    } else {
      setTransactions((prev) => [
        {
          id: crypto.randomUUID(),
          type: 'outflow',
          amount: payAmount,
          category: 'Tagihan & Cicilan',
          description: `Bayar cicilan ${debt.platform}`,
          transaction_date: todayIso(),
          source: 'debt_payment',
        },
        ...prev,
      ]);
    }

    setDebts((prev) =>
      prev.map((d) =>
        d.id === debt.id
          ? {
              ...d,
              remaining_balance: newBalance,
              remaining_tenor: newTenor,
              status: newStatus,
            }
          : d
      )
    );
    toast.success(tDebts('card.paidToast'));
  };

  const handleDeleteDebt = async (id: string) => {
    if (!isDemoMode && isSuperadmin) {
      await fetch('/api/superadmin/finance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'debts', id }),
      });
    } else if (!isDemoMode && supabase) {
      await supabase.from('debts').delete().eq('id', id);
    }
    setDebts((prev) => prev.filter((d) => d.id !== id));
    toast.success(tDebts('deleted'));
  };

  // ------------------------------------------------------------------
  // Profil & keamanan
  // ------------------------------------------------------------------

  const openEditProfile = () => {
    setDraftUsername(profileUsername);
    setDraftEmail(profileEmail);
    setDraftClient(profileClient);
    setDraftBio(profileBio);
    setProfileNewPassword('');
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);

    if (isSuperadmin) {
      const res = await fetch('/api/superadmin/finance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'profiles',
          updates: {
            client_name: draftClient,
            bio: draftBio,
            ...(draftEmail && draftEmail.includes('@') ? { email: draftEmail } : {}),
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error || tSettings('saveFailed'));
        setProfileSaving(false);
        return;
      }
      setProfileUsername(draftUsername);
      setProfileEmail(draftEmail);
      setProfileClient(draftClient);
      setProfileBio(draftBio);
      setProfileNewPassword('');
      setEditingProfile(false);
      toast.success(tSettings('saved'));
      setProfileSaving(false);
      return;
    }

    if (!supabase || isDemoMode) {
      setProfileUsername(draftUsername);
      setProfileEmail(draftEmail);
      setProfileClient(draftClient);
      setProfileBio(draftBio);
      setEditingProfile(false);
      toast.success(tSettings('saved'));
      setProfileSaving(false);
      return;
    }

    const updates: { email?: string; password?: string } = {};
    if (draftEmail && draftEmail !== profileEmail) updates.email = draftEmail;
    if (profileNewPassword.length >= 8) updates.password = profileNewPassword;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.auth.updateUser(updates);
      if (error) {
        toast.error(error.message);
        setProfileSaving(false);
        return;
      }
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase
        .from('profiles')
        .update({ client_name: draftClient, bio: draftBio })
        .eq('id', userData.user.id);
    }

    setProfileUsername(draftUsername);
    setProfileEmail(draftEmail);
    setProfileClient(draftClient);
    setProfileBio(draftBio);
    setProfileNewPassword('');
    setEditingProfile(false);
    toast.success(tSettings('saved'));
    setProfileSaving(false);
  };

  const handleSavePin = () => {
    if (!/^\d{6}$/.test(newPinInput)) {
      toast.error(t('settings.security.pinInvalid'));
      return;
    }
    localStorage.setItem('stashinme_pin', newPinInput);
    setAppPin(newPinInput);
    setNewPinInput('');
    toast.success(t('settings.security.pinSaved'));
  };

  const handleRemovePin = () => {
    localStorage.removeItem('stashinme_pin');
    setAppPin('');
    setPinLocked(false);
    toast.success(t('settings.security.pinRemoved'));
  };

  const handleEnroll2FA = async () => {
    if (!supabase || isDemoMode) {
      toast.error(t('settings.security.twofaNeedLogin'));
      return;
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'stashinmeid Authenticator',
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setMfaFactorId(data.id);
    setMfaQr(data.totp.qr_code);
  };

  const handleVerify2FA = async () => {
    if (!supabase || !mfaFactorId || !mfaCode) return;
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (chErr) {
      toast.error(chErr.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setMfaQr(null);
      setMfaCode('');
      toast.success(t('settings.security.twofaActive'));
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/superadmin', { method: 'DELETE' });
    if (supabase) await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // ------------------------------------------------------------------
  // Manajemen user (superadmin)
  // ------------------------------------------------------------------

  const loadManagedUsers = useCallback(async () => {
    if (!isSuperadmin) return;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.error) setUsersError(json.error);
      setManagedUsers(json.users || []);
    } catch {
      setUsersError(t('errors.generic'));
    } finally {
      setUsersLoading(false);
    }
  }, [isSuperadmin, t]);

  useEffect(() => {
    if (activeTab === 'users' && isSuperadmin) {
      void loadManagedUsers();
    }
  }, [activeTab, isSuperadmin, loadManagedUsers]);

  const handleSaveUserEdit = async (userId: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: editUserEmail,
        client_name: editUserClient,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setManagedUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, email: editUserEmail, client_name: editUserClient }
            : u
        )
      );
      setEditingUserId(null);
      toast.success(tUsers('saved'));
    } else {
      toast.error(json.error || t('errors.generic'));
    }
  };

  const handleChangeUserRole = async (userId: string, role: UserRole) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    if (res.ok) {
      setManagedUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success(tUsers('saved'));
    }
  };

  const handleAdminResetPassword = async (email: string) => {
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (res.ok) {
      toast.success(tUsers('resetSent', { email }));
    } else {
      toast.error(json.error || t('errors.generic'));
    }
  };

  const handleImpersonate = async (u: ManagedUser) => {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: u.id,
        email: u.email,
        clientName: u.client_name,
      }),
    });
    if (res.ok) {
      // Muat ulang dari server supaya session impersonate langsung berlaku.
      router.refresh();
    }
  };

  const handleStopImpersonate = async () => {
    const res = await fetch('/api/admin/impersonate', { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setManagedUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success(tUsers('deleteUserDone'));
    }
  };

  // ------------------------------------------------------------------
  // Ekspor
  // ------------------------------------------------------------------

  const handleExportCsv = () => {
    exportToCSV(transactions, debts, profileClient || clientName);
    toast.success(t('tools.exported'));
  };

  const handleExportPdf = () => {
    exportToPDF(transactions, debts, profileClient || clientName);
    toast.success(t('tools.exported'));
  };

  const handleExportWord = () => {
    void exportToWord(transactions, debts, profileClient || clientName);
    toast.success(t('tools.exported'));
  };

  // ------------------------------------------------------------------
  // Navigasi
  // ------------------------------------------------------------------

  const navigate = useCallback((tab: NavTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const paletteActions: CommandAction[] = [
    {
      id: 'go-overview',
      label: tNav('overview'),
      group: 'navigate',
      onSelect: () => navigate('overview'),
    },
    {
      id: 'go-cashflow',
      label: tNav('cashflow'),
      group: 'navigate',
      onSelect: () => navigate('cashflow'),
    },
    {
      id: 'go-debts',
      label: tNav('debts'),
      group: 'navigate',
      onSelect: () => navigate('debts'),
    },
    {
      id: 'go-budget',
      label: tBudget('title'),
      group: 'navigate',
      onSelect: () => navigate('budget'),
    },
    {
      id: 'go-settings',
      label: tNav('settings'),
      group: 'navigate',
      onSelect: () => navigate('settings'),
    },
    {
      id: 'go-profile',
      label: tNav('profile'),
      group: 'navigate',
      onSelect: () => navigate('profile'),
    },
    ...(isSuperadmin
      ? [
          {
            id: 'go-users',
            label: tNav('users'),
            group: 'navigate' as const,
            onSelect: () => navigate('users'),
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: 'scan',
            label: t('settings.data.scan'),
            group: 'action' as const,
            onSelect: () => fileInputRef.current?.click(),
          },
          {
            id: 'quick-add',
            label: t('quickAdd.title'),
            group: 'action' as const,
            onSelect: () => setShowQuickAdd(true),
          },
        ]
      : []),
  ];

  useHotkey('mod+k', () => setCommandOpen(true));

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)] lg:flex-row lg:pb-0">
      <Sidebar
        activeTab={activeTab}
        onNavigate={navigate}
        profileClient={profileClient}
        profileEmail={profileEmail}
        profileUsername={profileUsername}
        userRole={userRole}
        isSuperadmin={isSuperadmin}
        avatarUrl={profileAvatarUrl}
        onOpenKyc={() => setKycOpen(true)}
        onOpenSecurity={() => setSecurityOpen(true)}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <MobileHeader
          profileClient={profileClient}
          isSuperadmin={isSuperadmin}
          canEdit={canEdit}
          onProfile={() => navigate('profile')}
          onUsers={() => navigate('users')}
          onScan={() => fileInputRef.current?.click()}
          onImport={() => csvInputRef.current?.click()}
          onExportPdf={handleExportPdf}
          onExportWord={handleExportWord}
          onExportCsv={handleExportCsv}
          onLogout={handleLogout}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 lg:px-8 lg:pb-10">
          {impersonatingEmail && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--info)]/30 bg-[var(--info-soft)] px-4 py-3 text-[12px] text-[var(--info)]">
              <span className="inline-flex items-center gap-2">
                <UserCheck className="size-4 shrink-0" aria-hidden />
                {tUsers('impersonating', { email: impersonatingEmail })}
              </span>
              <Button size="sm" onClick={handleStopImpersonate}>
                {tUsers('stopImpersonate')}
              </Button>
            </div>
          )}

              {activeTab === 'overview' && (
                <OverviewTab
                  transactions={transactions}
                  debts={debts}
                  totalInflow={totalInflow}
                  totalOutflow={totalOutflow}
                  netCashflow={animatedBalance}
                  savingsRate={savingsRate}
                  totalDebt={totalDebt}
                  monthlyDebtBurden={monthlyDebtBurden}
                  activeDebtCount={activeDebts.length}
                  upcomingDebts={upcomingDebts}
                  budgetStatuses={budgetList}
                  canEdit={canEdit}
                  scanning={scanning}
                  onQuickAdd={() => setShowQuickAdd(true)}
                  onScan={() => fileInputRef.current?.click()}
                  onOpenDebts={() => navigate('debts')}
                  onOpenCashflow={() => navigate('cashflow')}
                  onOpenBudget={() => navigate('budget')}
                />
              )}

              {activeTab === 'cashflow' && (
                <CashflowTab
                  transactions={transactions}
                  filteredTransactions={filteredTransactions}
                  filterType={filterType}
                  searchQuery={searchQuery}
                  canEdit={canEdit}
                  onFilterTypeChange={setFilterType}
                  onSearchChange={setSearchQuery}
                  onDelete={handleDeleteTransaction}
                  onQuickAdd={() => setShowQuickAdd(true)}
                  onExportCsv={handleExportCsv}
                />
              )}

              {activeTab === 'debts' && (
                <DebtsTab
                  debts={debts}
                  showDebtForm={showDebtForm}
                  debtForm={debtForm}
                  canEdit={canEdit}
                  simSelectedIds={simSelectedIds}
                  simStats={simStats}
                  onToggleSim={(id) =>
                    setSimSelectedIds((prev) =>
                      prev.includes(id)
                        ? prev.filter((x) => x !== id)
                        : [...prev, id]
                    )
                  }
                  onClearSim={() => setSimSelectedIds([])}
                  onFormChange={setDebtForm}
                  onToggleForm={() => setShowDebtForm((v) => !v)}
                  onSubmitForm={handleAddDebt}
                  onPay={handlePayDebt}
                  onDelete={handleDeleteDebt}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetTab
                  budgets={budgets.budgets}
                  transactions={transactions}
                  canEdit={canEdit}
                  onSave={budgets.saveBudget}
                  onRemove={budgets.removeBudget}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  canEdit={canEdit}
                  scanning={scanning}
                  hasTransactions={transactions.length > 0}
                  hasDebts={debts.length > 0}
                  onScan={() => fileInputRef.current?.click()}
                  onImport={() => csvInputRef.current?.click()}
                  onExportCsv={handleExportCsv}
                  onExportPdf={handleExportPdf}
                  onExportWord={handleExportWord}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileTab
                  profileUsername={profileUsername}
                  profileEmail={profileEmail}
                  profileClient={profileClient}
                  profileBio={profileBio}
                  userRole={userRole}
                  profileCompleteness={profileCompleteness}
                  profileAvatarUrl={profileAvatarUrl}
                  profileBannerUrl={profileBannerUrl}
                  canEdit={canEdit}
                  onEditProfile={openEditProfile}
                  onProfileMediaChange={(avatar, banner) => {
                    if (avatar !== undefined) setProfileAvatarUrl(avatar);
                    if (banner !== undefined) setProfileBannerUrl(banner);
                  }}
                  kolega={kolega}
                />
              )}

              {/* Keamanan pribadi: modal pop-up dari menu profil di sidebar */}
              <Modal
                open={securityOpen}
                onClose={() => setSecurityOpen(false)}
                title={tSecSettings('security.title')}
                description={tSecSettings('security.twofaHint')}
                size="lg"
              >
                <SecuritySettings
                  appPin={appPin}
                  newPinInput={newPinInput}
                  mfaQr={mfaQr}
                  mfaCode={mfaCode}
                  canEdit={canEdit}
                  onNewPinChange={setNewPinInput}
                  onSavePin={handleSavePin}
                  onRemovePin={handleRemovePin}
                  onLockNow={() => {
                    setSecurityOpen(false);
                    setPinLocked(true);
                  }}
                  onEnroll2FA={handleEnroll2FA}
                  onMfaCodeChange={setMfaCode}
                  onVerify2FA={handleVerify2FA}
                />
              </Modal>

              {/* KYC: modal dari menu profil di sidebar */}
              <KycModal open={kycOpen} onClose={() => setKycOpen(false)} />

              {activeTab === 'users' && isSuperadmin && (
                <UsersTab
                  users={managedUsers}
                  loading={usersLoading}
                  error={usersError}
                  editingUserId={editingUserId}
                  editUserEmail={editUserEmail}
                  editUserClient={editUserClient}
                  onRefresh={loadManagedUsers}
                  onChangeRole={handleChangeUserRole}
                  onResetPassword={handleAdminResetPassword}
                  onImpersonate={handleImpersonate}
                  onDelete={handleDeleteUser}
                  onToggleEdit={(u) => {
                    setEditingUserId(editingUserId === u.id ? null : u.id);
                    setEditUserEmail(u.email);
                    setEditUserClient(u.client_name);
                  }}
                  onEditFieldChange={(field, value) => {
                    if (field === 'email') setEditUserEmail(value);
                    else setEditUserClient(value);
                  }}
                  onSaveEdit={handleSaveUserEdit}
                  onCancelEdit={() => setEditingUserId(null)}
                />
              )}
        </main>
      </div>

      <BottomNav
        activeTab={activeTab}
        onNavigate={navigate}
        canEdit={canEdit}
        onQuickAdd={() => setShowQuickAdd(true)}
      />

      {/* Input tersembunyi */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
        aria-hidden
      />
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVImport}
        className="hidden"
        aria-hidden
      />

      <QuickAddSheet
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        state={quickAdd}
        scanMsg={scanMsg}
        saving={txLoading}
        sharedGroups={!isDemoMode ? kolega.groups.map((g) => ({ id: g.id, name: g.name })) : []}
        onStateChange={setQuickAdd}
        onSubmit={handleAddTransaction}
      />

      {/* Modal edit profil */}
      <Modal
        open={editingProfile}
        onClose={() => setEditingProfile(false)}
        title={tSettings('editTitle')}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditingProfile(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              loading={profileSaving}
              onClick={handleSaveProfile}
            >
              {tSettings('save')}
            </Button>
          </>
        }
      >
        <form
          onSubmit={handleSaveProfile}
          autoComplete="off"
          className="space-y-3.5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label={tSettings('username')}
              value={draftUsername}
              onChange={(e) => setDraftUsername(e.target.value)}
              autoComplete="off"
            />
            <Input
              label={tSettings('email')}
              type="email"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
              placeholder="nama@email.com"
              autoComplete="off"
            />
          </div>

          <Input
            label={tSettings('workspace')}
            value={draftClient}
            onChange={(e) => setDraftClient(e.target.value)}
            autoComplete="off"
          />

          <Input
            label={tSettings('bio')}
            value={draftBio}
            onChange={(e) => setDraftBio(e.target.value)}
            placeholder={tSettings('bioPlaceholder')}
          />

          <Input
            label={tSettings('newPassword')}
            hint={tSettings('newPasswordHint')}
            type="password"
            value={profileNewPassword}
            onChange={(e) => setProfileNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </form>
      </Modal>

      {/* Overlay kunci PIN */}
      {pinLocked && appPin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--bg)]/95 p-4 backdrop-blur-xl">
          <div className="w-full max-w-xs space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-6 text-center">
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--text)]">
                {t('settings.security.locked')}
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                {t('settings.security.unlock')}
              </p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setPinInput(v);
                if (v === appPin) {
                  setPinLocked(false);
                  setPinInput('');
                }
              }}
              placeholder="••••••"
              aria-label={t('settings.security.unlock')}
              className="tnum w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3 text-center text-[18px] tracking-[0.5em] focus:border-[var(--brand)] focus:outline-none"
              autoFocus
            />
          </div>
        </div>
      )}

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        actions={paletteActions}
      />
    </div>
  );
}
