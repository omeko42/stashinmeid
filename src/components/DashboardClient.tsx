'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Transaction, Debt, TransactionType, UserRole } from '@/types/finance';
import { exportToPDF, exportToWord, parseCSVTransactions } from '@/lib/exportUtils';
import { CashflowAreaChart, DebtDonutChart } from '@/components/AnalyticsCharts';
import { BrandLogo } from '@/components/BrandLogo';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  LogOut,
  Loader2,
  Sparkles,
  FileDown,
  FileText,
  Upload,
  Shield,
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  SlidersHorizontal,
  Search,
  X,
  CalendarClock,
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  UserCheck,
  KeyRound,
  Lock,
  Smartphone,
} from 'lucide-react';

interface DashboardClientProps {
  initialTransactions: Transaction[];
  initialDebts: Debt[];
  userEmail: string | null;
  clientName: string;
  userRole: UserRole;
  isDemoMode: boolean;
  isSuperadmin?: boolean;
  impersonatingEmail?: string | null;
}

interface ManagedUser {
  id: string;
  email: string;
  client_name: string;
  role: UserRole;
  created_at: string;
}

const formatRp = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

const CATEGORIES = {
  inflow: ['Gaji', 'Freelance', 'Bonus', 'Refund', 'Investasi', 'Lainnya'],
  outflow: [
    'Makan & Minum',
    'Belanja',
    'Transport',
    'Tagihan & Cicilan',
    'Hiburan',
    'Kesehatan',
    'Transfer',
    'Lainnya',
  ],
};

type NavTab = 'overview' | 'cashflow' | 'debts' | 'tools' | 'users';

export default function DashboardClient({
  initialTransactions,
  initialDebts,
  userEmail,
  clientName,
  userRole,
  isDemoMode,
  isSuperadmin = false,
  impersonatingEmail = null,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const canEdit = userRole !== 'viewer';

  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Debt Payoff Simulator Selection
  const [simSelectedIds, setSimSelectedIds] = useState<string[]>([]);

  // Superadmin User Management State
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [adminToast, setAdminToast] = useState<string | null>(null);

  // Security: PIN Lock & 2FA Authenticator State
  const [appPin, setAppPin] = useState<string>('');
  const [pinLocked, setPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [securityMsg, setSecurityMsg] = useState<string | null>(null);

  useEffect(() => {
    const savedPin = typeof window !== 'undefined' ? localStorage.getItem('stashinme_pin') : null;
    if (savedPin) {
      setAppPin(savedPin);
    }
  }, []);

  const handleSavePin = () => {
    if (!/^\d{6}$/.test(newPinInput)) {
      setSecurityMsg('PIN harus tepat 6 digit angka.');
      return;
    }
    localStorage.setItem('stashinme_pin', newPinInput);
    setAppPin(newPinInput);
    setNewPinInput('');
    setSecurityMsg('PIN 6-digit berhasil diaktifkan!');
  };

  const handleRemovePin = () => {
    localStorage.removeItem('stashinme_pin');
    setAppPin('');
    setPinLocked(false);
    setSecurityMsg('PIN dinonaktifkan.');
  };

  const handleEnroll2FA = async () => {
    setSecurityMsg(null);
    if (!supabase || isDemoMode) {
      setSecurityMsg('Login dengan akun Supabase (email) untuk mengaktifkan 2FA Authenticator.');
      return;
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'stashinmeid Authenticator',
    });
    if (error) {
      setSecurityMsg(error.message);
      return;
    }
    setMfaFactorId(data.id);
    setMfaQr(data.totp.qr_code);
    setSecurityMsg('Scan QR Code ini di Google Authenticator / Authy lalu masukkan kode 6 digit.');
  };

  const handleVerify2FA = async () => {
    if (!supabase || !mfaFactorId || !mfaCode) return;
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (chErr) {
      setSecurityMsg(chErr.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: mfaCode,
    });
    if (error) {
      setSecurityMsg(error.message);
    } else {
      setMfaQr(null);
      setMfaCode('');
      setSecurityMsg('2FA Authenticator berhasil diaktifkan!');
    }
  };

  const handleAdminResetPassword = async (email: string) => {
    setAdminToast(null);
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    setAdminToast(res.ok ? json.message : json.error || 'Gagal kirim reset password.');
  };

  const loadManagedUsers = async () => {
    if (!isSuperadmin) return;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.error) setUsersError(json.error);
      setManagedUsers(json.users || []);
    } catch {
      setUsersError('Gagal memuat daftar user.');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && isSuperadmin) {
      loadManagedUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isSuperadmin]);

  const handleImpersonate = async (u: ManagedUser) => {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, email: u.email, clientName: u.client_name }),
    });
    if (res.ok) {
      router.refresh();
      window.location.href = '/';
    }
  };

  const handleStopImpersonate = async () => {
    const res = await fetch('/api/admin/impersonate', { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
      window.location.href = '/';
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
    }
  };

  // Transaction Form State
  const [txType, setTxType] = useState<TransactionType>('outflow');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Makan & Minum');
  const [txDesc, setTxDesc] = useState('');
  const [txDate, setTxDate] = useState('');
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    setTxDate(new Date().toISOString().split('T')[0]);
  }, []);

  // AI Scan State
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  // Debt Form State
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtPlatform, setDebtPlatform] = useState('');
  const [debtContract, setDebtContract] = useState('');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtInstallment, setDebtInstallment] = useState('');
  const [debtTenor, setDebtTenor] = useState('');
  const [debtDueDay, setDebtDueDay] = useState('');

  // Metrics
  const totalInflow = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'inflow')
        .reduce((sum, t) => sum + Number(t.amount), 0),
    [transactions]
  );

  const totalOutflow = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'outflow')
        .reduce((sum, t) => sum + Number(t.amount), 0),
    [transactions]
  );

  const netCashflow = totalInflow - totalOutflow;
  const savingsRate = totalInflow > 0 ? Math.max(0, Math.round((netCashflow / totalInflow) * 100)) : 0;

  const activeDebts = useMemo(() => debts.filter((d) => d.status === 'active'), [debts]);
  const totalDebt = useMemo(
    () => activeDebts.reduce((sum, d) => sum + Number(d.remaining_balance), 0),
    [activeDebts]
  );
  const monthlyDebtBurden = useMemo(
    () => activeDebts.reduce((sum, d) => sum + Number(d.monthly_installment || 0), 0),
    [activeDebts]
  );

  // Upcoming bills sorted by due_day
  const upcomingDebts = useMemo(() => {
    return [...activeDebts]
      .filter((d) => d.due_day !== null)
      .sort((a, b) => (a.due_day || 31) - (b.due_day || 31))
      .slice(0, 4);
  }, [activeDebts]);

  // Payoff Simulator Calculation
  const simStats = useMemo(() => {
    const selected = activeDebts.filter((d) => simSelectedIds.includes(d.id));
    return {
      count: selected.length,
      payoffNeeded: selected.reduce((s, d) => s + Number(d.remaining_balance), 0),
      monthlySaved: selected.reduce((s, d) => s + Number(d.monthly_installment || 0), 0),
    };
  }, [activeDebts, simSelectedIds]);

  const toggleSimDebt = (id: string) => {
    setSimSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchType = filterType === 'all' || t.type === filterType;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        (t.description || '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  }, [transactions, filterType, searchQuery]);

  // AI Image Scan Handler
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
        setScanMsg(json.error || 'Gagal membaca gambar.');
      } else if (json.data) {
        const d = json.data;
        setTxType(d.type === 'inflow' ? 'inflow' : 'outflow');
        setTxAmount(String(d.amount || ''));
        setTxCategory(d.category || 'Lainnya');
        setTxDesc(d.description || '');
        if (d.transaction_date) setTxDate(d.transaction_date);
        setScanMsg('Berhasil dibaca AI! Cek datanya lalu klik Simpan.');
      }
    } catch {
      setScanMsg('Terjadi kesalahan saat menghubungi AI.');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add Transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(txAmount);
    if (!amountNum || amountNum <= 0) return;

    setTxLoading(true);
    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type: txType,
      amount: amountNum,
      category: txCategory,
      description: txDesc || null,
      transaction_date: txDate || new Date().toISOString().split('T')[0],
      source: scanMsg ? 'ai_scan' : 'manual',
    };

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
          })
          .select()
          .single();

        if (!error && data) {
          setTransactions((prev) => [data, ...prev]);
        }
      }
    } else {
      setTransactions((prev) => [newTx, ...prev]);
    }

    setTxAmount('');
    setTxDesc('');
    setScanMsg(null);
    setTxLoading(false);
    setShowQuickAdd(false);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!isDemoMode && isSuperadmin) {
      await fetch('/api/superadmin/finance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'transactions', id }),
      });
    } else if (!isDemoMode && supabase) {
      await supabase.from('transactions').delete().eq('id', id);
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = Number(debtBalance);
    const installmentNum = Number(debtInstallment) || 0;
    const tenorNum = Number(debtTenor) || null;
    const dueNum = Number(debtDueDay) || null;

    if (!debtPlatform || !balanceNum) return;

    const newDebt: Debt = {
      id: crypto.randomUUID(),
      platform: debtPlatform,
      contract_no: debtContract || null,
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

        if (!error && data) {
          setDebts((prev) => [data, ...prev]);
        }
      }
    } else {
      setDebts((prev) => [newDebt, ...prev]);
    }

    setDebtPlatform('');
    setDebtContract('');
    setDebtBalance('');
    setDebtInstallment('');
    setDebtTenor('');
    setDebtDueDay('');
    setShowDebtForm(false);
  };

  const handlePayDebt = async (debt: Debt) => {
    const payAmount =
      debt.monthly_installment > 0
        ? Math.min(debt.monthly_installment, debt.remaining_balance)
        : debt.remaining_balance;

    const newBalance = Math.max(0, debt.remaining_balance - payAmount);
    const newTenor = debt.remaining_tenor ? Math.max(0, debt.remaining_tenor - 1) : null;
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
            transaction_date: new Date().toISOString().split('T')[0],
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
          transaction_date: new Date().toISOString().split('T')[0],
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
  };

  const handleLogout = async () => {
    await fetch('/api/auth/superadmin', { method: 'DELETE' });
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push('/login');
    router.refresh();
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;

    const text = await file.text();
    const parsed = parseCSVTransactions(text);
    if (parsed.length === 0) return;

    if (!isDemoMode && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const rows = parsed.map((p) => ({ ...p, user_id: userData.user!.id }));
        const { data, error } = await supabase.from('transactions').insert(rows).select();
        if (!error && data) {
          setTransactions((prev) => [...(data as Transaction[]), ...prev]);
        }
      }
    } else {
      const withIds: Transaction[] = parsed.map((p) => ({ ...p, id: crypto.randomUUID() }));
      setTransactions((prev) => [...withIds, ...prev]);
    }

    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'cashflow', label: 'Cashflow', icon: <ArrowLeftRight className="w-5 h-5" /> },
    { id: 'debts', label: 'Debt', icon: <Landmark className="w-5 h-5" /> },
    { id: 'tools', label: 'Tools', icon: <SlidersHorizontal className="w-5 h-5" /> },
    ...(isSuperadmin
      ? [{ id: 'users' as NavTab, label: 'Users', icon: <Users className="w-5 h-5" /> }]
      : []),
  ];

  return (
    <div className="relative min-h-screen bg-[#09090b] text-zinc-100 flex flex-col lg:flex-row pb-24 lg:pb-0 overflow-x-hidden">
      {/* Ambient Coral & Indigo Mesh Glows */}
      <div className="pointer-events-none fixed top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-rose-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />

      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVImport}
        className="hidden"
      />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl p-5 justify-between z-20">
        <div className="space-y-8">
          <div className="flex items-center gap-3 px-1">
            <BrandLogo size={38} />
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-none lowercase">stashinmeid</h1>
              <span className="text-[11px] text-zinc-500 font-medium">manajemen keuanganmu</span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/25 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/[0.06]">
          <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/[0.06] text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span className="truncate">{clientName}</span>
            </div>
            <p className="text-zinc-400 truncate">{userEmail || 'Demo Mode'}</p>
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 uppercase tracking-wider">
              {userRole}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative z-10 flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#09090b]/85 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={32} />
            <div>
              <h1 className="font-bold text-base leading-none lowercase">stashinmeid</h1>
              <span className="text-[11px] text-zinc-400">{clientName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
                title="Scan Struk AI"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-zinc-300"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8 max-w-6xl w-full mx-auto">
          {impersonatingEmail && (
            <div className="mb-5 p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                <span>
                  Mode Impersonate aktif: melihat data <strong>{impersonatingEmail}</strong>
                </span>
              </div>
              <button
                onClick={handleStopImpersonate}
                className="px-3 py-1.5 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-400 transition"
              >
                Kembali ke Superadmin
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Bento Row 1: Hero Balance Card + Debt Snapshot */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Hero Fintech Card */}
                  <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/50 border border-white/10 p-6 flex flex-col justify-between gap-6 shadow-2xl">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                          Net Cashflow (Real)
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-1 text-white">
                          {formatRp(netCashflow)}
                        </h2>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        Savings {savingsRate}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.06] flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                          <ArrowDownRight className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] text-zinc-400 block">Inflow</span>
                          <span className="font-bold text-sm sm:text-base text-emerald-400 truncate block">
                            {formatRp(totalInflow)}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-black/30 border border-white/[0.06] flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[11px] text-zinc-400 block">Outflow</span>
                          <span className="font-bold text-sm sm:text-base text-rose-400 truncate block">
                            {formatRp(totalOutflow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        <button
                          onClick={() => setShowQuickAdd(true)}
                          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
                        >
                          <Plus className="w-4 h-4" /> Catat Transaksi
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={scanning}
                          className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          {scanning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Camera className="w-4 h-4 text-indigo-400" />
                          )}
                          Scan Struk AI
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Debt Snapshot Card */}
                  <div className="rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 p-6 flex flex-col justify-between gap-4">
                    <div>
                      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Total Kewajiban Debt
                      </span>
                      <p className="text-2xl sm:text-3xl font-bold text-amber-400 mt-1">
                        {formatRp(totalDebt)}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {activeDebts.length} pinjaman aktif
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                      <span className="text-[11px] text-amber-300/80 block">
                        Beban Cicilan / Bulan
                      </span>
                      <span className="text-lg font-bold text-amber-300">
                        {formatRp(monthlyDebtBurden)}
                      </span>
                    </div>

                    <button
                      onClick={() => setActiveTab('debts')}
                      className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-zinc-200 transition"
                    >
                      Buka Simulasi & Daftar Debt →
                    </button>
                  </div>
                </div>

                {/* Bento Row 2: Interactive Recharts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm">Tren Inflow vs Outflow</h3>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Inflow
                        </span>
                        <span className="flex items-center gap-1 text-rose-400">
                          <span className="w-2 h-2 rounded-full bg-rose-400" /> Outflow
                        </span>
                      </div>
                    </div>
                    <CashflowAreaChart transactions={transactions} />
                  </div>

                  <div className="rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 p-5">
                    <h3 className="font-semibold text-sm mb-2">Komposisi Sisa Debt</h3>
                    <DebtDonutChart debts={debts} />
                  </div>
                </div>

                {/* Bento Row 3: Upcoming Bills + Recent Transactions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-amber-400" />
                        Jatuh Tempo Terdekat
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {upcomingDebts.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/[0.05] text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-zinc-200 truncate">{d.platform}</p>
                            <p className="text-zinc-500">Setiap tgl {d.due_day}</p>
                          </div>
                          <span className="font-semibold text-amber-400 shrink-0">
                            {formatRp(d.monthly_installment)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Transaksi Terbaru</h3>
                      <button
                        onClick={() => setActiveTab('cashflow')}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Lihat semua
                      </button>
                    </div>
                    <div className="space-y-2">
                      {transactions.slice(0, 4).map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/[0.05] text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-zinc-200 truncate">
                              {tx.description || tx.category}
                            </p>
                            <p className="text-zinc-500">{tx.transaction_date}</p>
                          </div>
                          <span
                            className={`font-semibold shrink-0 ${
                              tx.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {tx.type === 'inflow' ? '+' : '-'} {formatRp(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CASHFLOW TAB */}
            {activeTab === 'cashflow' && (
              <motion.div
                key="cashflow"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Riwayat Inflow & Outflow</h2>
                  <div className="flex gap-2">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari transaksi..."
                        className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl border border-white/10 text-xs">
                      {(['all', 'inflow', 'outflow'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilterType(f)}
                          className={`px-2.5 py-1 rounded-lg capitalize transition ${
                            filterType === f
                              ? 'bg-rose-500 text-white font-semibold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {f === 'all' ? 'Semua' : f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {filteredTransactions.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-12 bg-zinc-900/60 border border-white/10 rounded-3xl">
                      Tidak ada transaksi yang cocok.
                    </p>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/70 border border-white/[0.08] hover:border-white/15 transition"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">
                              {tx.description || tx.category}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300">
                              {tx.category}
                            </span>
                            {tx.source === 'ai_scan' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                                AI
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">{tx.transaction_date}</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`font-semibold text-sm ${
                              tx.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {tx.type === 'inflow' ? '+' : '-'} {formatRp(tx.amount)}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="text-zinc-500 hover:text-rose-400 transition p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* DEBTS TAB */}
            {activeTab === 'debts' && (
              <motion.div
                key="debts"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Debt & Simulasi Pelunasan</h2>
                    <p className="text-xs text-zinc-400">
                      Centang pinjaman di bawah untuk simulasi penghematan cashflow bulanan.
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowDebtForm(!showDebtForm)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4" /> Tambah Debt
                    </button>
                  )}
                </div>

                {/* Payoff Simulator Banner */}
                <div className="rounded-3xl bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-rose-950/40 border border-indigo-500/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">
                        Simulasi Pelunasan ({simStats.count} dipilih)
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Dana tutup tagihan:{' '}
                        <span className="text-white font-semibold">
                          {formatRp(simStats.payoffNeeded)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-emerald-300/80 block">
                      Penghematan Cicilan / Bulan
                    </span>
                    <span className="text-xl font-bold text-emerald-400">
                      +{formatRp(simStats.monthlySaved)}
                    </span>
                  </div>
                </div>

                {showDebtForm && (
                  <form
                    onSubmit={handleAddDebt}
                    className="bg-zinc-900/90 border border-white/10 rounded-3xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Platform (e.g. SPinjam, Kredivo)"
                      value={debtPlatform}
                      onChange={(e) => setDebtPlatform(e.target.value)}
                      className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                    />
                    <input
                      type="text"
                      placeholder="No. Kontrak / Keterangan"
                      value={debtContract}
                      onChange={(e) => setDebtContract(e.target.value)}
                      className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                    />
                    <input
                      type="number"
                      required
                      placeholder="Sisa Tagihan (Rp)"
                      value={debtBalance}
                      onChange={(e) => setDebtBalance(e.target.value)}
                      className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Cicilan / Bulan (Rp)"
                      value={debtInstallment}
                      onChange={(e) => setDebtInstallment(e.target.value)}
                      className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Sisa Tenor (Bulan)"
                      value={debtTenor}
                      onChange={(e) => setDebtTenor(e.target.value)}
                      className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Tgl Jatuh Tempo"
                        value={debtDueDay}
                        onChange={(e) => setDebtDueDay(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-amber-500 text-zinc-950 font-semibold rounded-xl text-sm shrink-0"
                      >
                        Simpan
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {debts.map((debt) => {
                    const isSimSelected = simSelectedIds.includes(debt.id);
                    const paidPct =
                      debt.total_tenor && debt.remaining_tenor !== null
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                ((debt.total_tenor - debt.remaining_tenor) / debt.total_tenor) * 100
                              )
                            )
                          )
                        : 0;

                    return (
                      <div
                        key={debt.id}
                        className={`rounded-3xl bg-zinc-900/70 backdrop-blur-xl border p-5 flex flex-col justify-between gap-4 transition ${
                          isSimSelected
                            ? 'border-indigo-500/60 ring-1 ring-indigo-500/30'
                            : debt.status === 'paid_off'
                            ? 'border-emerald-500/30 opacity-70'
                            : 'border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            {debt.status === 'active' && (
                              <input
                                type="checkbox"
                                checked={isSimSelected}
                                onChange={() => toggleSimDebt(debt.id)}
                                className="mt-1 accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                                title="Pilih untuk simulasi pelunasan"
                              />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-base">{debt.platform}</h3>
                                {debt.status === 'paid_off' && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Lunas
                                  </span>
                                )}
                              </div>
                              {debt.contract_no && (
                                <p className="text-xs text-zinc-400 mt-0.5">{debt.contract_no}</p>
                              )}
                            </div>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteDebt(debt.id)}
                              className="text-zinc-500 hover:text-rose-400 transition p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-zinc-400">
                            <span>Progres Tenor</span>
                            <span>{paidPct}%</span>
                          </div>
                          <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                              style={{ width: `${paidPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs bg-black/30 p-3 rounded-2xl border border-white/[0.06]">
                          <div>
                            <span className="text-zinc-500 block">Sisa Tagihan</span>
                            <span className="font-bold text-amber-400 text-sm">
                              {formatRp(debt.remaining_balance)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Cicilan/bln</span>
                            <span className="font-semibold text-zinc-200">
                              {debt.monthly_installment ? formatRp(debt.monthly_installment) : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Tenor / Tgl</span>
                            <span className="font-semibold text-zinc-200">
                              {debt.remaining_tenor ?? '-'} bln{' '}
                              {debt.due_day ? `(Tgl ${debt.due_day})` : ''}
                            </span>
                          </div>
                        </div>

                        {debt.status === 'active' && canEdit && (
                          <button
                            onClick={() => handlePayDebt(debt)}
                            className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 text-xs font-semibold transition"
                          >
                            Bayar Cicilan & Catat Outflow
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* TOOLS TAB */}
            {activeTab === 'tools' && (
              <motion.div
                key="tools"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold">Tools, Import & Export</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={scanning || !canEdit}
                    className="p-6 rounded-3xl bg-zinc-900/70 border border-white/10 hover:border-indigo-500/50 text-left space-y-2 transition disabled:opacity-50"
                  >
                    <Camera className="w-6 h-6 text-indigo-400" />
                    <h3 className="font-semibold text-sm">Scan Struk / Transfer (AI)</h3>
                    <p className="text-xs text-zinc-400">
                      Ambil foto struk atau screenshot transfer untuk isi transaksi otomatis.
                    </p>
                  </button>

                  <button
                    onClick={() => csvInputRef.current?.click()}
                    disabled={!canEdit}
                    className="p-6 rounded-3xl bg-zinc-900/70 border border-white/10 hover:border-emerald-500/50 text-left space-y-2 transition disabled:opacity-50"
                  >
                    <Upload className="w-6 h-6 text-emerald-400" />
                    <h3 className="font-semibold text-sm">Import Data CSV</h3>
                    <p className="text-xs text-zinc-400">
                      Upload file CSV (type, amount, category, description, transaction_date).
                    </p>
                  </button>

                  <button
                    onClick={() => exportToPDF(transactions, debts, clientName)}
                    className="p-6 rounded-3xl bg-zinc-900/70 border border-white/10 hover:border-rose-500/50 text-left space-y-2 transition"
                  >
                    <FileDown className="w-6 h-6 text-rose-400" />
                    <h3 className="font-semibold text-sm">Export Laporan PDF</h3>
                    <p className="text-xs text-zinc-400">
                      Unduh ringkasan cashflow dan daftar cicilan dalam format PDF.
                    </p>
                  </button>

                  <button
                    onClick={() => exportToWord(transactions, debts, clientName)}
                    className="p-6 rounded-3xl bg-zinc-900/70 border border-white/10 hover:border-blue-500/50 text-left space-y-2 transition"
                  >
                    <FileText className="w-6 h-6 text-blue-400" />
                    <h3 className="font-semibold text-sm">Export Laporan Word (.docx)</h3>
                    <p className="text-xs text-zinc-400">
                      Unduh laporan lengkap dalam format Microsoft Word yang bisa diedit.
                    </p>
                  </button>
                </div>

                {/* Security: PIN Lock & 2FA Authenticator */}
                <div className="pt-4 space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Lock className="w-5 h-5 text-emerald-400" /> Keamanan (PIN & 2FA Authenticator)
                  </h3>

                  {securityMsg && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
                      {securityMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* App PIN Lock */}
                    <div className="p-6 rounded-3xl bg-zinc-900/70 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-emerald-400" /> App PIN Lock (6 Digit)
                        </h4>
                        {appPin && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        Kunci layar aplikasi dengan PIN 6 angka agar lebih aman di HP.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          maxLength={6}
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="6 digit PIN baru"
                          className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs"
                        />
                        <button
                          onClick={handleSavePin}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-semibold text-xs"
                        >
                          Simpan PIN
                        </button>
                      </div>
                      {appPin && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setPinLocked(true)}
                            className="flex-1 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium"
                          >
                            Kunci Layar Sekarang
                          </button>
                          <button
                            onClick={handleRemovePin}
                            className="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-300 text-xs"
                          >
                            Hapus PIN
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2FA Authenticator */}
                    <div className="p-6 rounded-3xl bg-zinc-900/70 border border-white/10 space-y-3">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-indigo-400" /> 2FA Authenticator (TOTP)
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Hubungkan Google Authenticator / Authy untuk verifikasi 2 langkah.
                      </p>
                      {!mfaQr ? (
                        <button
                          onClick={handleEnroll2FA}
                          className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold"
                        >
                          Aktifkan 2FA Authenticator
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <img
                            src={mfaQr}
                            alt="2FA QR Code"
                            className="w-40 h-40 rounded-xl bg-white p-2"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              value={mfaCode}
                              onChange={(e) => setMfaCode(e.target.value)}
                              placeholder="Kode 6 digit"
                              className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs"
                            />
                            <button
                              onClick={handleVerify2FA}
                              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-semibold text-xs"
                            >
                              Verifikasi
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SUPERADMIN USERS & IMPERSONATE TAB */}
            {activeTab === 'users' && isSuperadmin && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Manajemen User & Impersonate</h2>
                    <p className="text-xs text-zinc-400">
                      Kelola akun terdaftar, ubah role, atau impersonate untuk melihat dashboard user.
                    </p>
                  </div>
                  <button
                    onClick={loadManagedUsers}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium transition"
                  >
                    Refresh
                  </button>
                </div>

                {adminToast && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
                    {adminToast}
                  </div>
                )}

                {usersError && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
                    {usersError}
                  </div>
                )}

                {usersLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  </div>
                ) : managedUsers.length === 0 ? (
                  <div className="p-10 text-center text-sm text-zinc-500 bg-zinc-900/60 border border-white/10 rounded-3xl">
                    Belum ada user terdaftar (atau pastikan <code className="text-zinc-300">SUPABASE_SERVICE_ROLE_KEY</code> sudah diset di Vercel).
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {managedUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{u.email}</p>
                          <p className="text-xs text-zinc-400">
                            Workspace: {u.client_name} • Daftar:{' '}
                            {new Date(u.created_at).toLocaleDateString('id-ID')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeUserRole(u.id, e.target.value as UserRole)}
                            className="px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>

                          <button
                            onClick={() => handleAdminResetPassword(u.email)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition"
                            title="Kirim link reset password ke email user"
                          >
                            <KeyRound className="w-3.5 h-3.5" /> Reset PW
                          </button>

                          <button
                            onClick={() => handleImpersonate(u)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Impersonate
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                            title="Hapus User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation with Centered FAB */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-t border-white/[0.08] px-3 py-2 flex items-center justify-around">
        {navItems.slice(0, 2).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-medium transition ${
              activeTab === item.id ? 'text-rose-400' : 'text-zinc-500'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        {/* Centered FAB */}
        {canEdit && (
          <button
            onClick={() => setShowQuickAdd(true)}
            className="-mt-7 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-zinc-950 shadow-xl shadow-emerald-500/30 active:scale-95 transition"
            aria-label="Tambah Transaksi"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {navItems.slice(2).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-medium transition ${
              activeTab === item.id ? 'text-rose-400' : 'text-zinc-500'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* PIN Lock Overlay */}
      {pinLocked && appPin && (
        <div className="fixed inset-0 z-[60] bg-[#09090b]/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-zinc-900 border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base">stashinmeid Terkunci</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Masukkan PIN 6 digit untuk membuka</p>
            </div>
            <input
              type="password"
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
              className="w-full text-center tracking-[0.5em] text-lg py-3 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Quick Add / AI Scan Bottom-Sheet Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full sm:max-w-md bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Catat Transaksi</h3>
              <button
                onClick={() => setShowQuickAdd(false)}
                className="p-1.5 rounded-xl bg-white/[0.06] text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scanMsg && (
              <div className="p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{scanMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddTransaction} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTxType('outflow');
                    setTxCategory(CATEGORIES.outflow[0]);
                  }}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                    txType === 'outflow'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-black/40 border-white/10 text-zinc-400'
                  }`}
                >
                  Outflow (Keluar)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('inflow');
                    setTxCategory(CATEGORIES.inflow[0]);
                  }}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                    txType === 'inflow'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-black/40 border-white/10 text-zinc-400'
                  }`}
                >
                  Inflow (Masuk)
                </button>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Kategori</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                  >
                    {CATEGORIES[txType].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Catatan</label>
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="Contoh: Kopi Kenangan / Gaji Bulanan"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={txLoading}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 hover:opacity-90 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Simpan Transaksi
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
