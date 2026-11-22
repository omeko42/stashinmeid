'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useCurrency } from '@/components/ui/CurrencyContext';
import { useHotkey } from '@/hooks/useHotkey';
import { useCountUp } from '@/hooks/useCountUp';
import { useBudgets } from '@/hooks/useBudgets';
import { useKolega } from '@/hooks/useKolega';
import { useConnections } from '@/hooks/useConnections';
import { useAssets } from '@/hooks/useAssets';
import { CommandPalette, type CommandAction } from '@/components/shell/CommandPalette';
import { Sidebar, type NavTab } from '@/components/shell/Sidebar';
import { AnnouncementBar } from '@/components/shell/AnnouncementBar';
import {
  NAVIGATE_EVENT,
  NotificationModal,
} from '@/components/shell/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { MobileHeader } from '@/components/shell/MobileHeader';
import { BottomNav } from '@/components/shell/BottomNav';
import {
  QuickAddSheet,
  initialQuickAddState,
  type QuickAddState,
} from '@/components/shell/QuickAddSheet';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { SaldoTab, type SaldoSub } from '@/components/tabs/SaldoTab';
import { DebtsTab, type DebtFormState } from '@/components/tabs/DebtsTab';
import {
  SettingsTab,
  type AdminSection,
  type PersonalSection,
} from '@/components/tabs/SettingsTab';
import { ProfileTab } from '@/components/tabs/ProfileTab';
import { FloatingQuickChat } from '@/components/shell/FloatingQuickChat';
import {
  KycModal,
  type KycVerificationStatus,
} from '@/components/profile/KycModal';
import {
  UsersTab,
  type CreateUserPayload,
  type ManagedUser,
  type SaveUserPayload,
} from '@/components/tabs/UsersTab';
import { SocialTab, type SocialSub } from '@/components/tabs/SocialTab';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { createClient } from '@/lib/supabase/client';
import type { Debt, Transaction, TransactionType, UserRole } from '@/types/finance';
import type { MembershipTier } from '@/lib/membership';
import {
  exportToCSV,
  exportToPDF,
  exportToWord,
  parseCSVTransactions,
} from '@/lib/exportUtils';
import { budgetStatuses } from '@/lib/budget';
import { reportDbError } from '@/lib/dbErrors';
import { createDemoDebts, createDemoTransactions } from '@/lib/demoData';
import { appNow, nextDueDate, todayIso } from '@/lib/format';
import {
  ArrowLeftRight,
  Bitcoin,
  Building2,
  Camera,
  Check,
  ChevronDown,
  FlaskConical,
  Landmark,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  User,
  UserCheck,
  Wallet,
  X,
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
  initialBio?: string;
  initialAvatarUrl?: string | null;
  initialBannerUrl?: string | null;
}

const EMPTY_DEBT_FORM: DebtFormState = {
  platform: '',
  contract: '',
  balance: '',
  installment: '',
  tenor: '',
  dueDay: '',
  groupId: '',
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
  const locale = useLocale();
  const isEn = locale === 'en';
  const { confirm } = useConfirm();
  const { primaryCurrency, convertToIdr } = useCurrency();
  const t = useTranslations();
  const tNav = useTranslations('nav');
  const tCashflow = useTranslations('cashflow');
  const tDebts = useTranslations('debts');
  const tBudget = useTranslations('budget');
  const tUsers = useTranslations('users');
  const tQuickAdd = useTranslations('quickAdd');
  const tSettings = useTranslations('settings.profile');
  const router = useRouter();

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  // Role sekarang hanya admin & user - keduanya bisa kelola keuangannya sendiri.
  const canEdit = true;

  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [saldoSub, setSaldoSub] = useState<SaldoSub>('cashflow');
  const [sosialSub, setSosialSub] = useState<SocialSub>('kolega');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsAdminMode, setSettingsAdminMode] = useState(false);
  const [settingsPersonalSection, setSettingsPersonalSection] =
    useState<PersonalSection>('appearance');
  const [settingsAdminSection, setSettingsAdminSection] =
    useState<AdminSection>('admin_billing');
  const [settingsSectionRequest, setSettingsSectionRequest] = useState<{
    section: PersonalSection;
    seq: number;
  } | null>(null);
  const [socialQuickActionOpen, setSocialQuickActionOpen] = useState(false);
  const [externalChatPeer, setExternalChatPeer] = useState<{
    id: string;
    client_name: string;
    avatar_url: string | null;
  } | null>(null);
  const [kycOpen, setKycOpen] = useState(false);

  const openSecurityPage = () => {
    setSettingsAdminMode(false);
    setSettingsPersonalSection('security');
    setSettingsSectionRequest((prev) => ({
      section: 'security',
      seq: (prev?.seq ?? 0) + 1,
    }));
    navigate('settings');
  };
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeScope, setActiveScope] = useState<'all' | 'personal' | string>(
    'all'
  );
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const groupPickerRef = useRef<HTMLDivElement>(null);
  const [fabOpen, setFabOpen] = useState(false);

  useEffect(() => {
    if (!groupPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        groupPickerRef.current &&
        !groupPickerRef.current.contains(e.target as Node)
      ) {
        setGroupPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGroupPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [groupPickerOpen]);

  // Simulasi pelunasan
  const [simSelectedIds, setSimSelectedIds] = useState<string[]>([]);

  // Manajemen user (admin & superadmin)
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Keamanan: PIN, 2FA & Status e-KYC Pihak Ketiga Terpadu
  const [appPin, setAppPin] = useState('');
  const [pinLocked, setPinLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [kycStatus, setKycStatus] = useState<KycVerificationStatus>('unverified');

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
  const connections = useConnections();
  const assets = useAssets({ isDemoMode, isSuperadmin });
  const notifications = useNotifications();

  useEffect(() => {
    const savedPin =
      typeof window !== 'undefined' ? localStorage.getItem('stashinme_pin') : null;
    if (savedPin) setAppPin(savedPin);
    const savedCollapsed =
      typeof window !== 'undefined'
        ? localStorage.getItem('stashinmeid_sidebar_collapsed')
        : null;
    if (savedCollapsed === '1') setSidebarCollapsed(true);
    const savedKyc =
      typeof window !== 'undefined'
        ? localStorage.getItem('stashinmeid_kyc_status')
        : null;
    if (savedKyc === 'verified' || savedKyc === 'pending') {
      setKycStatus(savedKyc);
    }
  }, []);

  const handleToggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('stashinmeid_sidebar_collapsed', next ? '1' : '0');
      }
      return next;
    });
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

  useEffect(() => {
    setProfileUsername(
      userEmail && !userEmail.includes('@') ? userEmail : userEmail?.split('@')[0] || 'user'
    );
    setProfileEmail(userEmail && userEmail.includes('@') ? userEmail : '');
    setProfileClient(clientName);
    setProfileBio(
      initialBio || 'Pengelola keuangan pribadi & pemantauan cashflow di stashinmeid.'
    );
    setProfileAvatarUrl(initialAvatarUrl);
    setProfileBannerUrl(initialBannerUrl);
  }, [userEmail, clientName, initialBio, initialAvatarUrl, initialBannerUrl]);

  // Navigasi dari lonceng notifikasi.
  //
  // Notifikasi hidup di header (banyak tempat), jadi daripada menarik
  // callback navigasi lewat beberapa level prop, lonceng menembakkan event
  // dan di sini yang menerjemahkannya ke tab yang benar.
  //
  // Format detail: { tab: 'social' | 'overview' | ..., sub?: 'chat' | 'kolega' }
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: string; sub?: string }>).detail;
      if (!detail?.tab) return;

      const tab = detail.tab as NavTab;
      setActiveTab(tab);

      if (tab === 'social' && detail.sub) {
        const sub = detail.sub === 'group' ? 'kolega' : (detail.sub as SocialSub);
        setSosialSub(sub);
      }
    };

    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(NAVIGATE_EVENT, onNavigate);
  }, []);

  // ------------------------------------------------------------------
  // Isolasi Ruang Keuangan (Pribadi vs Grup Kolega) & Metrik Terhubung
  // ------------------------------------------------------------------

  const scopedTransactions = useMemo(() => {
    if (activeScope === 'all') return transactions;
    if (activeScope === 'personal') {
      return transactions.filter((tx) => !tx.group_id);
    }
    return transactions.filter((tx) => tx.group_id === activeScope);
  }, [transactions, activeScope]);

  const scopedDebts = useMemo(() => {
    if (activeScope === 'all') return debts;
    if (activeScope === 'personal') {
      return debts.filter((d) => !d.group_id);
    }
    return debts.filter((d) => d.group_id === activeScope);
  }, [debts, activeScope]);

  // Split dompet fisik (kas) vs non-fisik (bank/e-wallet/crypto) + transaksi
  // arus kas yang belum dikaitkan ke dompet spesifik (`!tx.account_id`).
  // Semua nilai internal dihitung dalam basis IDR (aset mata uang asing
  // otomatis dikonversi memakai kurs live) lalu diformat sesuai mata uang utama.
  const computedTotals = useMemo(() => {
    const includePersonalWallets =
      activeScope === 'personal' || activeScope === 'all';
    const walletPhysical = includePersonalWallets
      ? assets.accounts
          .filter((a) => a.kind === 'cash' || a.kind === 'other')
          .reduce((s, a) => s + convertToIdr(a.balance, a.currency), 0)
      : 0;
    const walletNonPhysical = includePersonalWallets
      ? assets.accounts
          .filter(
            (a) =>
              a.kind === 'bank' || a.kind === 'ewallet' || a.kind === 'crypto'
          )
          .reduce((s, a) => s + convertToIdr(a.balance, a.currency), 0)
      : 0;

    let txPhysical = 0;
    let txNonPhysical = 0;
    for (const tx of scopedTransactions) {
      if (tx.account_id) continue;
      const signed =
        tx.type === 'inflow' ? Number(tx.amount) : -Number(tx.amount);
      if (
        tx.source === 'manual_non_physical' ||
        tx.category === 'Transfer'
      ) {
        txNonPhysical += signed;
      } else {
        txPhysical += signed;
      }
    }

    const physical = walletPhysical + txPhysical;
    const nonPhysical = walletNonPhysical + txNonPhysical;
    return {
      physical,
      nonPhysical,
      total: physical + nonPhysical,
      primaryCurrency,
    };
  }, [assets.accounts, scopedTransactions, activeScope, convertToIdr, primaryCurrency]);

  const totalInflow = useMemo(
    () =>
      scopedTransactions
        .filter((tx) => tx.type === 'inflow')
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [scopedTransactions]
  );

  const totalOutflow = useMemo(
    () =>
      scopedTransactions
        .filter((tx) => tx.type === 'outflow')
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [scopedTransactions]
  );

  const netCashflow = totalInflow - totalOutflow;
  const savingsRate =
    totalInflow > 0 ? Math.max(0, Math.round((netCashflow / totalInflow) * 100)) : 0;

  // Angka hero di Ringkasan menampilkan total saldo terhubung (dompet + arus kas ruang aktif).
  const animatedBalance = useCountUp(computedTotals.total);

  const activeDebts = useMemo(
    () => scopedDebts.filter((d) => d.status === 'active'),
    [scopedDebts]
  );
  const totalDebt = useMemo(
    () => activeDebts.reduce((sum, d) => sum + Number(d.remaining_balance), 0),
    [activeDebts]
  );
  const monthlyDebtBurden = useMemo(
    () => activeDebts.reduce((sum, d) => sum + Number(d.monthly_installment || 0), 0),
    [activeDebts]
  );

  const upcomingDueGroups = useMemo(() => {
    const today = appNow();
    const groups = new Map<number, Debt[]>();
    for (const d of activeDebts) {
      if (d.due_day === null) continue;
      const list = groups.get(d.due_day) ?? [];
      list.push(d);
      groups.set(d.due_day, list);
    }
    return [...groups.entries()]
      .map(([dueDay, items]) => ({
        dueDay,
        nextDue: nextDueDate(dueDay, today),
        items: items.sort(
          (a, b) => Number(b.monthly_installment) - Number(a.monthly_installment)
        ),
        total: items.reduce((s, d) => s + Number(d.monthly_installment), 0),
      }))
      .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime())
      .slice(0, 5);
  }, [activeDebts]);

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
    return scopedTransactions.filter((tx) => {
      const matchType = filterType === 'all' || tx.type === filterType;
      const matchQuery =
        !q ||
        (tx.description || '').toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  }, [scopedTransactions, filterType, searchQuery]);

  const budgetList = useMemo(
    () => budgetStatuses(budgets.budgets, scopedTransactions),
    [budgets.budgets, scopedTransactions]
  );

  // Skor Kelengkapan Akun & Keamanan Terpadu (0 - 100%)
  // e-KYC saat ini dinonaktifkan untuk user umum sampai fitur simpan saldo Stash hadir.
  const profileCompleteness = useMemo(() => {
    let score = 0;
    // 1. Identitas & Email (40%)
    if (profileClient) score += 15;
    if (profileUsername) score += 10;
    if (profileEmail && profileEmail.includes('@')) score += 15;
    // 2. Bio & Foto Profil (30%)
    if (profileBio && profileBio.trim().length >= 5) score += 15;
    if (profileAvatarUrl) score += 15;
    // 3. Keamanan PIN / 2FA (30%)
    if (appPin || mfaQr) score += 30;
    return Math.min(100, score);
  }, [
    profileClient,
    profileUsername,
    profileEmail,
    profileBio,
    profileAvatarUrl,
    appPin,
    mfaQr,
  ]);

  // Pengingat keuangan & pesan masuk nyata untuk AnnouncementBar (tanpa teks dummy!)
  const liveAlerts = useMemo(() => {
    const alerts: string[] = [];

    // 1. Pesan obrolan masuk & notifikasi live yang belum dibaca
    const unreadNotifs = notifications.notifications.filter((n) => !n.readAt);
    for (const n of unreadNotifs.slice(0, 3)) {
      const preview = n.body ? `: "${n.body.slice(0, 60)}${n.body.length > 60 ? '…' : ''}"` : '';
      alerts.push(`${n.title}${preview}`);
    }

    // 2. Permintaan pertemanan kolega masuk (jika belum terwakili di atas)
    if (
      connections.incoming.length > 0 &&
      !unreadNotifs.some((n) => n.type === 'connection_requested')
    ) {
      alerts.push(
        isEn
          ? `${connections.incoming.length} incoming colleague request(s) in Social`
          : `${connections.incoming.length} permintaan kolega baru di Kelola Kolega`
      );
    }

    // 3. Undangan grup masuk (jika belum terwakili di atas)
    if (
      kolega.pendingInvites.length > 0 &&
      !unreadNotifs.some((n) => n.id.startsWith('live-grp:'))
    ) {
      alerts.push(
        isEn
          ? `${kolega.pendingInvites.length} pending group invitation(s) waiting in Social`
          : `${kolega.pendingInvites.length} undangan grup menunggu konfirmasi di menu Sosial`
      );
    }

    // 4. Cicilan jatuh tempo dalam 7 hari
    const nowMs = appNow().getTime();
    for (const g of upcomingDueGroups) {
      const days = Math.ceil((g.nextDue.getTime() - nowMs) / 86_400_000);
      if (days >= 0 && days <= 7) {
        alerts.push(
          isEn
            ? `Loan due in ${days === 0 ? 'today' : `${days}d`}: ${g.items.map((d) => d.platform).join(', ')}`
            : `Cicilan jatuh tempo ${days === 0 ? 'hari ini' : `${days} hari lagi`}: ${g.items.map((d) => d.platform).join(', ')}`
        );
      }
    }

    // 5. Pagu anggaran melampaui batas
    const overBudgets = budgetList.filter((b) => b.over);
    if (overBudgets.length > 0) {
      alerts.push(
        isEn
          ? `Budget limit exceeded: ${overBudgets.map((b) => b.budget.category).join(', ')}`
          : `Anggaran melampaui batas: ${overBudgets.map((b) => b.budget.category).join(', ')}`
      );
    }
    return alerts;
  }, [
    notifications.notifications,
    connections.incoming.length,
    kolega.pendingInvites,
    upcomingDueGroups,
    budgetList,
    isEn,
  ]);

  // ------------------------------------------------------------------
  // Transaksi (Tambah & Edit Dompet/Kategori/Grup)
  // ------------------------------------------------------------------

  const openEditTransaction = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setScanMsg(null);
    setQuickAdd({
      type: tx.type,
      amount: String(tx.amount),
      category: tx.category,
      description: tx.description ?? '',
      date: tx.transaction_date || todayIso(),
      groupId: tx.group_id ?? '',
      accountId: tx.account_id
        ? tx.account_id
        : tx.source === 'manual_non_physical'
          ? '__non_physical__'
          : '',
    });
    setShowQuickAdd(true);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(quickAdd.amount);
    if (!amountNum || amountNum <= 0) return;

    setTxLoading(true);
    const isNonPhysicalVirtual = quickAdd.accountId === '__non_physical__';
    const realAccountId =
      quickAdd.accountId && !isNonPhysicalVirtual ? quickAdd.accountId : null;
    const txSource = scanMsg
      ? 'ai_scan'
      : isNonPhysicalVirtual
        ? 'manual_non_physical'
        : 'manual';
    const targetGroupId = quickAdd.groupId || null;

    // MODE EDIT TRANSAKSI EXISTING
    if (editingTxId) {
      const prevTx = transactions.find((x) => x.id === editingTxId);
      const updatedFields = {
        type: quickAdd.type,
        amount: amountNum,
        category: quickAdd.category,
        description: quickAdd.description || null,
        transaction_date: quickAdd.date || todayIso(),
        source:
          prevTx?.source === 'ai_scan' && !isNonPhysicalVirtual
            ? 'ai_scan'
            : txSource,
        group_id: targetGroupId,
        account_id: realAccountId,
      };

      try {
        if (!isDemoMode && isSuperadmin) {
          const res = await fetch('/api/superadmin/finance', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'transactions',
              id: editingTxId,
              updates: updatedFields,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast.error(json.error || 'Gagal memperbarui transaksi.');
            return;
          }
        } else if (!isDemoMode && supabase) {
          const { error } = await supabase
            .from('transactions')
            .update(updatedFields)
            .eq('id', editingTxId);
          if (error) {
            toast.error(error.message);
            return;
          }
        }

        // Sinkronkan perubahan saldo dompet (balikkan delta lama, terapkan delta baru)
        const oldAccId = prevTx?.account_id ?? null;
        const oldDelta = prevTx
          ? prevTx.type === 'inflow'
            ? Number(prevTx.amount)
            : -Number(prevTx.amount)
          : 0;
        const newDelta =
          updatedFields.type === 'inflow'
            ? Number(updatedFields.amount)
            : -Number(updatedFields.amount);

        if (oldAccId && oldAccId === realAccountId) {
          const diff = newDelta - oldDelta;
          if (diff !== 0) {
            const acc = assets.accounts.find((a) => a.id === oldAccId);
            if (acc) {
              await assets.saveAccount({
                id: acc.id,
                name: acc.name,
                kind: acc.kind,
                institution: acc.institution,
                currency: acc.currency,
                balance: Number(acc.balance) + diff,
              });
            }
          }
        } else {
          if (oldAccId) {
            const oldAcc = assets.accounts.find((a) => a.id === oldAccId);
            if (oldAcc) {
              await assets.saveAccount({
                id: oldAcc.id,
                name: oldAcc.name,
                kind: oldAcc.kind,
                institution: oldAcc.institution,
                currency: oldAcc.currency,
                balance: Number(oldAcc.balance) - oldDelta,
              });
            }
          }
          if (realAccountId) {
            const newAcc = assets.accounts.find((a) => a.id === realAccountId);
            if (newAcc) {
              await assets.saveAccount({
                id: newAcc.id,
                name: newAcc.name,
                kind: newAcc.kind,
                institution: newAcc.institution,
                currency: newAcc.currency,
                balance: Number(newAcc.balance) + newDelta,
              });
            }
          }
        }

        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === editingTxId ? { ...tx, ...updatedFields } : tx
          )
        );
        setEditingTxId(null);
        setQuickAdd(initialQuickAddState());
        setScanMsg(null);
        setShowQuickAdd(false);
        toast.success(isEn ? 'Transaction updated' : 'Transaksi berhasil diperbarui');
      } finally {
        setTxLoading(false);
      }
      return;
    }

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type: quickAdd.type,
      amount: amountNum,
      category: quickAdd.category,
      description: quickAdd.description || null,
      transaction_date: quickAdd.date || todayIso(),
      source: txSource,
      group_id: targetGroupId,
      account_id: realAccountId,
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
              ...(targetGroupId ? { group_id: targetGroupId } : {}),
              ...(realAccountId ? { account_id: realAccountId } : {}),
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
              ...(targetGroupId ? { group_id: targetGroupId } : {}),
              ...(realAccountId ? { account_id: realAccountId } : {}),
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

      // Sinkronkan saldo dompet spesifik jika pengguna memilih salah satu akun aset
      if (realAccountId) {
        const targetAcc = assets.accounts.find((a) => a.id === realAccountId);
        if (targetAcc) {
          const delta =
            newTx.type === 'inflow' ? Number(newTx.amount) : -Number(newTx.amount);
          await assets.saveAccount({
            id: targetAcc.id,
            name: targetAcc.name,
            kind: targetAcc.kind,
            institution: targetAcc.institution,
            currency: targetAcc.currency,
            balance: Number(targetAcc.balance) + delta,
          });
        }
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

    const ok = await confirm({
      title: isEn ? 'Delete this transaction?' : 'Hapus transaksi ini?',
      description: `${tx.description || tx.category} (${tx.type === 'inflow' ? '+' : '-'}${tx.amount.toLocaleString('id-ID')})`,
      tone: 'danger',
      audit: {
        action: 'Hapus Transaksi',
        category: 'finance',
        detail: `${tx.category}: ${tx.description || '-'} (${tx.amount})`,
      },
    });
    if (!ok) return;

    setTransactions((prev) => prev.filter((x) => x.id !== id));

    // Hapus permanen setelah jeda undo habis.
    const timer = setTimeout(async () => {
      try {
        if (!isDemoMode && isSuperadmin) {
          const res = await fetch('/api/superadmin/finance', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'transactions', id }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || t('errors.generic'));
          }
        } else if (!isDemoMode && supabase) {
          // Supabase tidak melempar exception - ia mengembalikan { error }.
          // Kalau tidak dicek, baris hilang dari DB tapi user tidak diberi tahu.
          const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

          if (deleteError) {
            // Kembalikan baris ke layar: penghapusan gagal, jadi data masih ada.
            setTransactions((prev) =>
              prev.some((x) => x.id === id) ? prev : [tx, ...prev]
            );
            reportDbError(deleteError, t('errors.generic'));
          }
        }
      } catch (e) {
        setTransactions((prev) =>
          prev.some((x) => x.id === id) ? prev : [tx, ...prev]
        );
        reportDbError(e, t('errors.generic'));
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

    if (!isDemoMode && isSuperadmin) {
      const res = await fetch('/api/superadmin/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'transactions',
          payload: parsed,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || t('tools.importFailed'));
      } else if (json.data) {
        setTransactions((prev) => [...(json.data as Transaction[]), ...prev]);
        toast.success(t('tools.importSuccess', { count: json.data.length }));
      }
    } else if (!isDemoMode && supabase) {
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
    const targetGroupId = debtForm.groupId || null;

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
      group_id: targetGroupId,
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
            ...(targetGroupId ? { group_id: targetGroupId } : {}),
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) {
        setDebts((prev) => [json.data, ...prev]);
      } else {
        reportDbError(json.error, t('errors.generic'));
        return;
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
            ...(targetGroupId ? { group_id: targetGroupId } : {}),
          })
          .select()
          .single();

        if (error) {
          reportDbError(error, t('errors.generic'));
          return;
        }
        if (data) setDebts((prev) => [data, ...prev]);
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

    const ok = await confirm({
      title: isEn
        ? `Pay installment for ${debt.platform}?`
        : `Bayar cicilan ${debt.platform}?`,
      description: isEn
        ? `An outflow transaction will be recorded and the remaining balance will be reduced.`
        : `Pengeluaran sebesar Rp ${payAmount.toLocaleString('id-ID')} akan dicatat dan sisa pinjaman berkurang.`,
      audit: {
        action: 'Bayar Cicilan',
        category: 'finance',
        detail: `${debt.platform} · Rp ${payAmount.toLocaleString('id-ID')}`,
      },
    });
    if (!ok) return;

    const newBalance = Math.max(0, debt.remaining_balance - payAmount);
    const newTenor = debt.remaining_tenor
      ? Math.max(0, debt.remaining_tenor - 1)
      : null;
    const newStatus = newBalance === 0 ? 'paid_off' : 'active';

    if (!isDemoMode && isSuperadmin) {
      const debtRes = await fetch('/api/superadmin/finance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'debts',
          id: debt.id,
          updates: {
            remaining_balance: newBalance,
            remaining_tenor: newTenor,
            status: newStatus,
          },
        }),
      });
      const debtJson = await debtRes.json().catch(() => ({}));
      if (!debtRes.ok) {
        toast.error(debtJson.error || t('errors.generic'));
        return;
      }

      const txRes = await fetch('/api/superadmin/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'transactions',
          payload: {
            type: 'outflow',
            amount: payAmount,
            category: 'Tagihan & Cicilan',
            description: `Bayar cicilan ${debt.platform}`,
            transaction_date: todayIso(),
            source: 'debt_payment',
          },
        }),
      });
      const txJson = await txRes.json().catch(() => ({}));
      if (!txRes.ok || !txJson.data?.[0]) {
        toast.error(txJson.error || t('errors.generic'));
        // Kompensasi best-effort: kembalikan saldo utang kalau transaksi
        // cicilan tidak berhasil dicatat.
        const rollback = await fetch('/api/superadmin/finance', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'debts',
            id: debt.id,
            updates: {
              remaining_balance: debt.remaining_balance,
              remaining_tenor: debt.remaining_tenor,
              status: debt.status,
            },
          }),
        });
        if (!rollback.ok) toast.error(t('errors.generic'));
        return;
      }
      setTransactions((prev) => [txJson.data[0], ...prev]);
    } else if (!isDemoMode && supabase) {
      // Urutan penting: update utang dulu, baru catat transaksinya.
      // Kalau dibalik, dan insert transaksi berhasil tapi update utang gagal,
      // user sudah terbayar tapi sisa utangnya tidak berkurang.
      const { error: debtError } = await supabase
        .from('debts')
        .update({
          remaining_balance: newBalance,
          remaining_tenor: newTenor,
          status: newStatus,
        })
        .eq('id', debt.id);

      if (debtError) {
        reportDbError(debtError, t('errors.generic'));
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: txData, error: txError } = await supabase
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

        if (txError) {
          // Utang sudah berkurang tapi transaksi tidak tercatat. Kembalikan
          // sisa utang supaya angka di layar dan di database tetap sama.
          reportDbError(txError, t('errors.generic'));
          const { error: rollbackError } = await supabase
            .from('debts')
            .update({
              remaining_balance: debt.remaining_balance,
              remaining_tenor: debt.remaining_tenor,
              status: debt.status,
            })
            .eq('id', debt.id);

          if (rollbackError) {
            // Rollback juga gagal: sekarang angka di DB tidak sama dengan
            // yang tampil. User perlu diberi tahu supaya mengecek kondisi data.
            reportDbError(rollbackError, t('errors.generic'));
          }
          return;
        }

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
    const target = debts.find((d) => d.id === id);
    const ok = await confirm({
      title: isEn
        ? `Delete loan "${target?.platform || ''}"?`
        : `Hapus pinjaman "${target?.platform || ''}"?`,
      description: isEn
        ? 'This loan record will be permanently removed.'
        : 'Catatan pinjaman ini akan dihapus secara permanen.',
      tone: 'danger',
      audit: {
        action: 'Hapus Pinjaman',
        category: 'finance',
        detail: target?.platform || id,
      },
    });
    if (!ok) return;

    try {
      if (!isDemoMode && isSuperadmin) {
        const res = await fetch('/api/superadmin/finance', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'debts', id }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || t('errors.generic'));
        }
      } else if (!isDemoMode && supabase) {
        const { error: deleteError } = await supabase
          .from('debts')
          .delete()
          .eq('id', id);

        if (deleteError) {
          reportDbError(deleteError, t('errors.generic'));
          return;
        }
      }
    } catch (e) {
      reportDbError(e, t('errors.generic'));
      return;
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
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ client_name: draftClient, bio: draftBio })
        .eq('id', userData.user.id);

      // Tanpa pengecekan ini, update yang gagal diam-diam dan user tetap
      // melihat "berhasil disimpan" padahal nama workspace tidak berubah.
      if (profileError) {
        reportDbError(profileError, tSettings('saveFailed'));
        setProfileSaving(false);
        return;
      }
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
    const ok = await confirm({
      title: isEn ? 'Sign out from stashinmeid?' : 'Keluar dari akun?',
      description: isEn
        ? 'You will return to the landing page and can sign back in anytime.'
        : 'Anda akan kembali ke halaman utama dan bisa masuk kembali kapan saja.',
      confirmLabel: isEn ? 'Sign Out' : 'Ya, Keluar',
      audit: isDemoMode
        ? undefined
        : {
            action: 'Keluar Akun',
            category: 'auth',
            detail: profileEmail || profileUsername,
          },
    });
    if (!ok) return;

    if (isDemoMode) {
      if (supabase) await supabase.auth.signOut().catch(() => {});
      router.push('/');
      router.refresh();
      return;
    }
    await fetch('/api/auth/superadmin', { method: 'DELETE' });
    if (supabase) await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const handleResetDemo = async () => {
    setTransactions(createDemoTransactions(isEn ? 'en' : 'id'));
    setDebts(createDemoDebts(isEn ? 'en' : 'id'));
    setActiveScope('personal');
    setSimSelectedIds([]);
    await assets.refresh();
    toast.success(
      isEn ? 'Demo data reset to initial state.' : 'Data demo dikembalikan ke awal.'
    );
  };

  // ------------------------------------------------------------------
  // Manajemen user (admin & superadmin)
  // ------------------------------------------------------------------

  const loadManagedUsers = useCallback(async () => {
    if (!isSuperadmin && userRole !== 'admin') return;
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
  }, [isSuperadmin, userRole, t]);

  useEffect(() => {
    if (activeTab === 'users' && (isSuperadmin || userRole === 'admin')) {
      void loadManagedUsers();
    }
  }, [activeTab, isSuperadmin, userRole, loadManagedUsers]);

  const handleCreateUser = async (
    payload: CreateUserPayload
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || t('errors.generic'));
        return false;
      }
      if (json.user) {
        setManagedUsers((prev) => [json.user, ...prev]);
      } else {
        await loadManagedUsers();
      }
      toast.success(`Akun ${payload.client_name} berhasil dibuat!`);
      return true;
    } catch {
      toast.error(t('errors.generic'));
      return false;
    }
  };

  const handleSaveUser = async (payload: SaveUserPayload): Promise<boolean> => {
    const durLabel =
      payload.membership_tier === 'free'
        ? 'Gratis'
        : payload.membership_expires_at
          ? `${payload.membership_tier.toUpperCase()} s/d ${payload.membership_expires_at}`
          : payload.membership_duration_months > 0
            ? `${payload.membership_tier.toUpperCase()} (${payload.membership_duration_months} bln)`
            : `${payload.membership_tier.toUpperCase()} (Permanen)`;

    const ok = await confirm({
      title: isEn
        ? `Save changes for ${payload.client_name || payload.email}?`
        : `Simpan perubahan untuk ${payload.client_name || payload.email}?`,
      description: isEn
        ? `Role: ${payload.role.toUpperCase()} · Plan: ${durLabel}${payload.membership_note ? ` · ${payload.membership_note}` : ''}`
        : `Peran: ${payload.role.toUpperCase()} · Paket: ${durLabel}${payload.membership_note ? ` · ${payload.membership_note}` : ''}`,
      audit: {
        action: 'Ubah Pengguna & Paket Membership',
        category: 'admin',
        detail: `${payload.client_name || payload.email} · Role: ${payload.role} · Paket: ${durLabel}${payload.membership_note ? ` · ${payload.membership_note}` : ''}`,
        targetUserId: payload.userId,
      },
    });
    if (!ok) return false;

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const m = json.membership as
        | {
            effectiveTier?: MembershipTier;
            storedTier?: MembershipTier;
            expiresAt?: string | null;
            durationMonths?: number | null;
            note?: string | null;
            isExpired?: boolean;
            daysLeft?: number | null;
          }
        | undefined;
      setManagedUsers((prev) =>
        prev.map((u) =>
          u.id === payload.userId
            ? {
                ...u,
                email: payload.email,
                client_name: payload.client_name,
                bio: payload.bio || null,
                role: payload.role,
                membership_tier: m?.effectiveTier ?? payload.membership_tier,
                membership_stored_tier: m?.storedTier ?? payload.membership_tier,
                membership_expires_at: m?.expiresAt ?? null,
                membership_duration_months:
                  m?.durationMonths ?? payload.membership_duration_months,
                membership_note: m?.note ?? (payload.membership_note || null),
                membership_is_expired: m?.isExpired ?? false,
                membership_days_left: m?.daysLeft ?? null,
              }
            : u
        )
      );
      toast.success(tUsers('saved'));
      return true;
    }
    toast.error(json.error || t('errors.generic'));
    return false;
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
    const u = managedUsers.find((x) => x.id === userId);
    const ok = await confirm({
      title: isEn
        ? `Permanently delete ${u?.client_name || 'this user'}?`
        : `Hapus akun ${u?.client_name || 'ini'} secara permanen?`,
      description: isEn
        ? 'All data belonging to this user will be removed and cannot be undone.'
        : 'Seluruh data milik akun ini akan dihapus permanen dan tidak bisa dibatalkan.',
      tone: 'danger',
      audit: {
        action: 'Hapus Pengguna',
        category: 'admin',
        detail: `${u?.client_name || userId} (${u?.email || '-'})`,
        targetUserId: userId,
      },
    });
    if (!ok) return;

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
      onSelect: () => {
        setSaldoSub('cashflow');
        navigate('saldo');
      },
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
      onSelect: () => {
        setSaldoSub('budget');
        navigate('saldo');
      },
    },
    {
      id: 'go-assets',
      label: tNav('assets'),
      group: 'navigate',
      onSelect: () => {
        setSaldoSub('assets');
        navigate('saldo');
      },
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
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        unreadNotifications={notifications.unreadCount}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenKyc={undefined}
        onOpenSecurity={openSecurityPage}
        onOpenSettings={() => navigate('settings')}
        onLogout={handleLogout}
      />

      <div
        className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ${
          sidebarCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-60'
        }`}
      >
        {/* Pita pengumuman & pengingat nyata (pesan masuk, undangan, jatuh tempo) */}
        <AnnouncementBar
          liveAlerts={liveAlerts}
          onClickAlert={() => setNotificationsOpen(true)}
        />

        <MobileHeader
          profileClient={profileClient}
          isSuperadmin={isSuperadmin || userRole === 'admin'}
          canEdit={canEdit}
          unreadNotifications={notifications.unreadCount}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onProfile={() => navigate('profile')}
          onOpenKyc={undefined}
          onOpenSecurity={openSecurityPage}
          onOpenSettings={() => navigate('settings')}
          onUsers={() => navigate('users')}
          onScan={() => fileInputRef.current?.click()}
          onImport={() => csvInputRef.current?.click()}
          onExportPdf={handleExportPdf}
          onExportWord={handleExportWord}
          onExportCsv={handleExportCsv}
          onLogout={handleLogout}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-7 lg:px-8 lg:pb-10 lg:pt-10">
          {isDemoMode && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--due)]/35 bg-[var(--due-soft)] px-4 py-3 text-[12px] text-[var(--text)]">
              <span className="inline-flex items-center gap-2">
                <FlaskConical className="size-4 shrink-0 text-[var(--due)]" aria-hidden />
                <span>
                  <strong>{isEn ? 'Demo Mode' : 'Mode Demo'}</strong> ·{' '}
                  {isEn
                    ? 'Changes are temporary and reset automatically on reload.'
                    : 'Perubahan hanya sementara dan kembali ke awal saat dimuat ulang.'}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<RotateCcw className="size-3.5" />}
                  onClick={handleResetDemo}
                >
                  {isEn ? 'Reset Data' : 'Reset Data'}
                </Button>
                <Button size="sm" onClick={handleLogout}>
                  {isEn ? 'Sign Up / Exit' : 'Daftar / Keluar'}
                </Button>
              </div>
            </div>
          )}

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

          {/* Switcher Ruang Keuangan (#1 Semua Ruang, #2 Pribadi, #3 Grup via Pop-up List) */}
          {(activeTab === 'overview' ||
            activeTab === 'saldo' ||
            activeTab === 'debts') && (() => {
            const activeGroup = kolega.groups.find((g) => g.id === activeScope);
            const isGroupScope = Boolean(activeGroup);
            return (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-2 sm:p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="hidden px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] sm:inline">
                    {isEn ? 'Space:' : 'Ruang Keuangan:'}
                  </span>

                  {/* #1 Semua Ruang — di mobile cukup icon stack saja agar ringkas 1 baris */}
                  <button
                    type="button"
                    onClick={() => setActiveScope('all')}
                    aria-label={isEn ? 'All Spaces' : 'Semua Ruang'}
                    title={isEn ? 'All Spaces' : 'Semua Ruang'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                      activeScope === 'all'
                        ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Layers className="size-3.5 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">
                      {isEn ? 'All Spaces' : 'Semua Ruang'}
                    </span>
                  </button>

                  {/* #2 Pribadi — di mobile cukup icon user saja */}
                  <button
                    type="button"
                    onClick={() => setActiveScope('personal')}
                    aria-label={isEn ? 'Personal' : 'Pribadi'}
                    title={isEn ? 'Personal' : 'Pribadi'}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                      activeScope === 'personal'
                        ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <User className="size-3.5 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">
                      {isEn ? 'Personal' : 'Pribadi'}
                    </span>
                  </button>

                  {/* #3 Grup — popover dropdown tepat di bawah tombol agar rapi & hemat ruang */}
                  <div ref={groupPickerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setGroupPickerOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={groupPickerOpen}
                      aria-label={
                        activeGroup
                          ? `${isEn ? 'Group' : 'Grup'}: ${activeGroup.name}`
                          : isEn
                            ? 'Groups'
                            : 'Grup'
                      }
                      title={
                        activeGroup
                          ? `${isEn ? 'Group' : 'Grup'}: ${activeGroup.name}`
                          : isEn
                            ? 'Groups'
                            : 'Grup'
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                        isGroupScope
                          ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Building2 className="size-3.5 shrink-0" aria-hidden />
                      {activeGroup ? (
                        <span className="max-w-[110px] truncate sm:max-w-none">
                          <span className="hidden sm:inline">
                            {isEn ? 'Group: ' : 'Grup: '}
                          </span>
                          {activeGroup.name}
                        </span>
                      ) : (
                        <span className="hidden sm:inline">
                          {isEn ? 'Groups' : 'Grup'}
                        </span>
                      )}
                      {kolega.groups.length > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            isGroupScope
                              ? 'bg-black/20 text-[var(--brand-contrast)]'
                              : 'bg-[var(--surface-1)] text-[var(--text-muted)]'
                          }`}
                        >
                          {kolega.groups.length}
                        </span>
                      )}
                      <ChevronDown
                        className={`size-3.5 opacity-80 transition-transform duration-150 ${
                          groupPickerOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                      />
                    </button>

                    <AnimatePresence>
                      {groupPickerOpen && (
                        <motion.div
                          role="listbox"
                          aria-label={isEn ? 'Select Group Workspace' : 'Pilih Ruang Grup'}
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.14, ease: 'easeOut' }}
                          className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-2 shadow-2xl"
                        >
                          <div className="mb-1.5 flex items-center justify-between px-2 pt-0.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              {isEn ? 'Group Workspaces' : 'Daftar Ruang Grup'}
                            </span>
                            <span className="text-[10px] text-[var(--text-faint)]">
                              {kolega.groups.length} {isEn ? 'groups' : 'grup'}
                            </span>
                          </div>

                          {kolega.groups.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-4 text-center text-[11px] text-[var(--text-muted)]">
                              {isEn
                                ? 'No groups yet. Create one in Social.'
                                : 'Belum ada grup. Buat grup di menu Sosial.'}
                            </div>
                          ) : (
                            <div className="max-h-60 space-y-1 overflow-y-auto pr-0.5">
                              {kolega.groups.map((g) => {
                                const selected = activeScope === g.id;
                                const txCount = transactions.filter(
                                  (tx) => tx.group_id === g.id
                                ).length;
                                const debtCount = debts.filter(
                                  (d) =>
                                    d.group_id === g.id && d.status === 'active'
                                ).length;
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => {
                                      setActiveScope(g.id);
                                      setGroupPickerOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                                      selected
                                        ? 'bg-[var(--brand-soft)]/35 text-[var(--text)]'
                                        : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--brand)]">
                                        <Building2 className="size-3.5" aria-hidden />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-[12px] font-semibold">
                                          {g.name}
                                        </p>
                                        <p className="text-[10px] text-[var(--text-muted)]">
                                          {g.members.length}{' '}
                                          {isEn ? 'members' : 'anggota'} · {txCount}{' '}
                                          {isEn ? 'tx' : 'transaksi'} · {debtCount}{' '}
                                          {isEn ? 'loans' : 'pinjaman'}
                                        </p>
                                      </div>
                                    </div>
                                    {selected && (
                                      <Check
                                        className="size-3.5 shrink-0 text-[var(--brand)]"
                                        aria-hidden
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="mt-2 border-t border-[var(--line)] pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setGroupPickerOpen(false);
                                setSosialSub('kolega');
                                navigate('social');
                              }}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-[11px] font-semibold text-[var(--brand)] transition hover:bg-[var(--surface-3)]"
                            >
                              <Plus className="size-3.5" aria-hidden />
                              {isEn
                                ? 'Manage / Create Groups'
                                : 'Kelola / Buat Grup di Sosial'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2 text-[11px] text-[var(--text-muted)]">
                  <span>
                    {scopedTransactions.length}{' '}
                    {isEn ? 'transactions' : 'transaksi'} · {activeDebts.length}{' '}
                    {isEn ? 'active loans' : 'pinjaman aktif'}
                  </span>
                  {isGroupScope && (
                    <button
                      type="button"
                      onClick={() => {
                        setSosialSub('kolega');
                        navigate('social');
                      }}
                      className="font-semibold text-[var(--brand)] hover:underline"
                    >
                      {isEn ? 'Open in Social →' : 'Buka di Sosial →'}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

              {activeTab === 'overview' && (
                <OverviewTab
                  transactions={scopedTransactions}
                  debts={scopedDebts}
                  assetTotals={{
                    physical: computedTotals.physical,
                    nonPhysical: computedTotals.nonPhysical,
                  }}
                  totalInflow={totalInflow}
                  totalOutflow={totalOutflow}
                  netCashflow={animatedBalance}
                  savingsRate={savingsRate}
                  totalDebt={totalDebt}
                  monthlyDebtBurden={monthlyDebtBurden}
                  activeDebtCount={activeDebts.length}
                  upcomingDueGroups={upcomingDueGroups}
                  budgetStatuses={budgetList}
                  canEdit={canEdit}
                  onOpenDebts={() => navigate('debts')}
                  onOpenCashflow={() => {
                    setSaldoSub('cashflow');
                    navigate('saldo');
                  }}
                  onOpenBudget={() => {
                    setSaldoSub('budget');
                    navigate('saldo');
                  }}
                />
              )}

              {activeTab === 'saldo' && (
                <SaldoTab
                  assets={assets}
                  computedTotals={computedTotals}
                  sub={saldoSub}
                  onSubChange={setSaldoSub}
                  canEdit={canEdit}
                  budgets={budgets.budgets}
                  transactions={scopedTransactions}
                  onBudgetSave={budgets.saveBudget}
                  onBudgetRemove={budgets.removeBudget}
                  filteredTransactions={filteredTransactions}
                  filterType={filterType}
                  searchQuery={searchQuery}
                  onFilterTypeChange={setFilterType}
                  onSearchChange={setSearchQuery}
                  onEditTransaction={openEditTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  sharedGroups={
                    !isDemoMode
                      ? kolega.groups.map((g) => ({ id: g.id, name: g.name }))
                      : []
                  }
                  onQuickAdd={() => {
                    setEditingTxId(null);
                    setQuickAdd(
                      initialQuickAddState(
                        activeScope !== 'personal' && activeScope !== 'all'
                          ? activeScope
                          : ''
                      )
                    );
                    setShowQuickAdd(true);
                  }}
                  onExportCsv={handleExportCsv}
                />
              )}

              {activeTab === 'debts' && (
                <DebtsTab
                  debts={scopedDebts}
                  sharedGroups={
                    !isDemoMode
                      ? kolega.groups.map((g) => ({ id: g.id, name: g.name }))
                      : []
                  }
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
                  onToggleForm={() => {
                    if (
                      !showDebtForm &&
                      activeScope !== 'personal' &&
                      activeScope !== 'all'
                    ) {
                      setDebtForm((prev) => ({ ...prev, groupId: activeScope }));
                    }
                    setShowDebtForm((v) => !v);
                  }}
                  onSubmitForm={handleAddDebt}
                  onPay={handlePayDebt}
                  onDelete={handleDeleteDebt}
                />
              )}

              {activeTab === 'social' && (
                <SocialTab
                  sub={sosialSub}
                  onSubChange={setSosialSub}
                  kolega={kolega}
                  connections={connections}
                  transactions={transactions}
                  debts={debts}
                  selectedGroupId={
                    activeScope !== 'personal' && activeScope !== 'all'
                      ? activeScope
                      : null
                  }
                  onQuickAddForGroup={(groupId) => {
                    setQuickAdd((prev) => ({ ...prev, groupId }));
                    setShowQuickAdd(true);
                  }}
                  onAddDebtForGroup={(groupId) => {
                    setActiveScope(groupId);
                    setDebtForm((prev) => ({ ...prev, groupId }));
                    setShowDebtForm(true);
                    navigate('debts');
                  }}
                  onFocusGroupInDashboard={(groupId) => {
                    setActiveScope(groupId);
                    navigate('overview');
                  }}
                  onBackToMain={() => navigate('overview')}
                  quickActionOpen={socialQuickActionOpen}
                  onCloseQuickAction={() => setSocialQuickActionOpen(false)}
                  externalChatPeer={externalChatPeer}
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
                  onSavePrimaryCurrency={assets.savePrimaryCurrency}
                  isAdmin={userRole === 'admin'}
                  isSuperadmin={isSuperadmin}
                  appPinSet={Boolean(appPin)}
                  kycStatus={kycStatus}
                  profileCompleteness={profileCompleteness}
                  onOpenSecurity={openSecurityPage}
                  onOpenKyc={undefined}
                  onOpenProfile={() => navigate('profile')}
                  onOpenUsers={() => navigate('users')}
                  onBackToMain={() => navigate('overview')}
                  controlledAdminMode={settingsAdminMode}
                  onControlledAdminModeChange={setSettingsAdminMode}
                  controlledPersonalSection={settingsPersonalSection}
                  onControlledPersonalSectionChange={setSettingsPersonalSection}
                  controlledAdminSection={settingsAdminSection}
                  onControlledAdminSectionChange={setSettingsAdminSection}
                  requestedSection={settingsSectionRequest}
                  securityProps={{
                    appPin,
                    newPinInput,
                    mfaQr,
                    mfaCode,
                    canEdit,
                    onNewPinChange: setNewPinInput,
                    onSavePin: handleSavePin,
                    onRemovePin: handleRemovePin,
                    onLockNow: () => setPinLocked(true),
                    onEnroll2FA: handleEnroll2FA,
                    onMfaCodeChange: setMfaCode,
                    onVerify2FA: handleVerify2FA,
                    onOpenEditProfile: openEditProfile,
                  }}
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
                  appPinSet={Boolean(appPin)}
                  kycStatus={kycStatus}
                  canEdit={canEdit}
                  onEditProfile={openEditProfile}
                  onOpenSecurity={openSecurityPage}
                  onOpenKyc={undefined}
                  onOpenSettings={() => navigate('settings')}
                  onProfileMediaChange={(avatar, banner) => {
                    if (avatar !== undefined) setProfileAvatarUrl(avatar);
                    if (banner !== undefined) setProfileBannerUrl(banner);
                  }}
                  kolega={kolega}
                  connections={connections}
                />
              )}

              {/* KYC Pihak Ketiga: modal terhubung dengan skor kelengkapan Profil */}
              <KycModal
                open={kycOpen}
                onClose={() => setKycOpen(false)}
                isSuperadmin={isSuperadmin}
                unifiedCompleteness={profileCompleteness}
                kycStatus={kycStatus}
                defaultFullName={profileClient}
                onStatusChange={setKycStatus}
                onOpenApiSettings={() => navigate('settings')}
              />

              {/* Notifikasi: modal dari menu profil (di bawah Profil, di atas KYC) */}
              <NotificationModal
                open={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                api={notifications}
              />

              {activeTab === 'users' && (isSuperadmin || userRole === 'admin') && (
                <UsersTab
                  users={managedUsers}
                  loading={usersLoading}
                  error={usersError}
                  onRefresh={loadManagedUsers}
                  onSaveUser={handleSaveUser}
                  onResetPassword={handleAdminResetPassword}
                  onImpersonate={handleImpersonate}
                  onDelete={handleDeleteUser}
                  onCreateUser={handleCreateUser}
                />
              )}
        </main>
      </div>

      <BottomNav
        activeTab={activeTab}
        onNavigate={navigate}
        canEdit={canEdit}
        onAddMenu={() => setAddMenuOpen(true)}
        socialSub={sosialSub}
        onSocialSubChange={setSosialSub}
        onSocialQuickAction={() => setSocialQuickActionOpen(true)}
        socialPendingBadge={
          connections.incoming.length + kolega.pendingInvites.length
        }
        settingsAdminMode={settingsAdminMode}
        settingsPersonalSection={settingsPersonalSection}
        onSettingsPersonalChange={setSettingsPersonalSection}
        settingsAdminSection={settingsAdminSection}
        onSettingsAdminChange={setSettingsAdminSection}
      />

      {/* Input tersembunyi */}
      <input
        ref={fileInputRef}
        id="receipt-image-upload"
        name="receiptImage"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        aria-label={t('settings.data.scan')}
        className="hidden"
        aria-hidden
      />
      <input
        ref={csvInputRef}
        id="transactions-csv-upload"
        name="csvFile"
        type="file"
        accept=".csv"
        onChange={handleCSVImport}
        aria-label={t('settings.data.import')}
        className="hidden"
        aria-hidden
      />

      <QuickAddSheet
        open={showQuickAdd}
        onClose={() => {
          setShowQuickAdd(false);
          setEditingTxId(null);
        }}
        state={quickAdd}
        scanMsg={scanMsg}
        saving={txLoading}
        editing={Boolean(editingTxId)}
        sharedGroups={!isDemoMode ? kolega.groups.map((g) => ({ id: g.id, name: g.name })) : []}
        accounts={assets.accounts}
        onCreateAccount={async ({ name, kind }) =>
          assets.saveAccount({
            name,
            kind,
            institution: null,
            currency: assets.primaryCurrency || 'IDR',
            balance: 0,
          })
        }
        onStateChange={setQuickAdd}
        onSubmit={handleAddTransaction}
      />

      {/* Menu pilihan "+ catat": arus kas, pindai struk AI, anggaran, aset, atau pinjaman */}
      <Modal
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        title={tQuickAdd('choiceTitle')}
        size="sm"
      >
        <div className="grid gap-2">
          {[
            {
              id: 'cashflow' as const,
              label: tQuickAdd('choiceCashflow'),
              icon: <ArrowLeftRight className="size-4" aria-hidden />,
            },
            {
              id: 'scan' as const,
              label: isEn ? 'Upload Receipt (AI)' : 'Upload (AI) — Pindai Struk',
              icon: <Camera className="size-4" aria-hidden />,
            },
            {
              id: 'budget' as const,
              label: tQuickAdd('choiceBudget'),
              icon: <Wallet className="size-4" aria-hidden />,
            },
            {
              id: 'assets' as const,
              label: tQuickAdd('choiceAssets'),
              icon: <Bitcoin className="size-4" aria-hidden />,
            },
            {
              id: 'debts' as const,
              label: tQuickAdd('choiceDebts'),
              icon: <Landmark className="size-4" aria-hidden />,
            },
          ].map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => {
                setAddMenuOpen(false);
                if (choice.id === 'cashflow') {
                  if (activeScope !== 'personal' && activeScope !== 'all') {
                    setQuickAdd((prev) => ({ ...prev, groupId: activeScope }));
                  }
                  setShowQuickAdd(true);
                } else if (choice.id === 'scan') {
                  fileInputRef.current?.click();
                } else if (choice.id === 'budget') {
                  setSaldoSub('budget');
                  navigate('saldo');
                } else if (choice.id === 'assets') {
                  setSaldoSub('assets');
                  navigate('saldo');
                } else if (choice.id === 'debts') {
                  setShowDebtForm(true);
                  navigate('debts');
                }
              }}
              className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-left text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--brand)]"
            >
              <span className="text-[var(--brand)]">{choice.icon}</span>
              {choice.label}
            </button>
          ))}
        </div>
      </Modal>

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

          <PasswordInput
            label={tSettings('newPassword')}
            hint={tSettings('newPasswordHint')}
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
              id="app-pin-unlock"
              name="pinUnlock"
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

      {/* Floating Action Stack kanan bawah: Obrolan Cepat (mengambang di semua menu kecuali Obrolan) + Tombol Catat/Upload AI */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2.5 lg:bottom-6 lg:right-6">
        {!(activeTab === 'social' && sosialSub === 'chat') && !isDemoMode && (
          <FloatingQuickChat
            contacts={connections.accepted.map((c) => ({
              id: c.user_id,
              client_name: c.profile?.client_name || c.profile?.email || 'Kolega',
              email: c.profile?.email || '',
              avatar_url: c.profile?.avatar_url ?? null,
            }))}
            onOpenFullChat={(peer) => {
              if (peer) {
                setExternalChatPeer({
                  id: peer.id,
                  client_name: peer.client_name,
                  avatar_url: peer.avatar_url ?? null,
                });
              }
              setSosialSub('chat');
              navigate('social');
            }}
            onFindColleague={() => {
              setSosialSub('find');
              navigate('social');
            }}
          />
        )}

        {canEdit && (
          <div className="hidden flex-col items-end gap-2.5 lg:flex">
          <AnimatePresence>
            {fabOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setFabOpen(false)}
                  aria-hidden
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="relative z-40 w-48 overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-1.5 shadow-2xl"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFabOpen(false);
                      if (activeScope !== 'personal' && activeScope !== 'all') {
                        setQuickAdd((prev) => ({ ...prev, groupId: activeScope }));
                      }
                      setShowQuickAdd(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Plus className="size-4" aria-hidden />
                    </span>
                    <span>{isEn ? 'Record' : 'Catat'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => {
                      setFabOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
                  >
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--info-soft)] text-[var(--info)]">
                      {scanning ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Camera className="size-4" aria-hidden />
                      )}
                    </span>
                    <span>{isEn ? 'Upload (AI)' : 'Upload (AI)'}</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setFabOpen((v) => !v)}
            aria-label={isEn ? 'Quick actions' : 'Aksi cepat catat atau pindai'}
            aria-expanded={fabOpen}
            className="relative z-40 flex size-13 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-contrast)] shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            {fabOpen ? (
              <X className="size-6" aria-hidden />
            ) : (
              <Plus className="size-6" aria-hidden />
            )}
          </button>
          </div>
        )}
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        actions={paletteActions}
      />
    </div>
  );
}
