'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Globe,
  Landmark,
  LayoutGrid,
  Loader2,
  MessageCircle,
  Newspaper,
  PenSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Amount, Label } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { ChatPanel } from './ChatPanel';
import { FeedTab } from './FeedTab';
import { formatDate, formatRp } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { KolegaApi } from '@/hooks/useKolega';
import type { ConnectionsApi } from '@/hooks/useConnections';
import type { Debt, Transaction } from '@/types/finance';

export type SocialSub = 'kolega' | 'chat' | 'feed' | 'find' | 'news';

interface SocialTabProps {
  sub: SocialSub;
  onSubChange: (sub: SocialSub) => void;
  kolega: KolegaApi;
  connections: ConnectionsApi;
  transactions?: Transaction[];
  debts?: Debt[];
  selectedGroupId?: string | null;
  onSelectGroup?: (groupId: string | null) => void;
  onQuickAddForGroup?: (groupId: string) => void;
  onAddDebtForGroup?: (groupId: string) => void;
  onFocusGroupInDashboard?: (groupId: string) => void;
  externalChatPeer?: {
    id: string;
    client_name: string;
    avatar_url: string | null;
  } | null;
}

interface GlobalUserResult {
  id: string;
  client_name: string;
  username: string;
  bio: string | null;
  role: string;
  avatar_url: string | null;
  emailMasked: string | null;
}

interface FinanceNewsItem {
  id: string;
  region: 'lokal' | 'global' | 'crypto';
  regionLabel: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
}

interface MarketTicker {
  label: string;
  price: string;
  delta: string;
  up: boolean;
}

const FALLBACK_NEWS: FinanceNewsItem[] = [
  {
    id: 'bi-rate-2026',
    region: 'lokal',
    regionLabel: 'Indonesia',
    title: 'BI Tahan Suku Bunga Acuan di 6,00%, Likuiditas Rupiah Terjaga',
    summary:
      'Suku bunga KPR dan kredit usaha tetap stabil; fokuskan arus kas pada pelunasan cicilan berbunga tinggi lebih dulu.',
    source: 'CNBC Indonesia',
    url: 'https://www.cnbcindonesia.com/market',
    publishedAt: 'Hari ini',
  },
  {
    id: 'crypto-fx-volatility',
    region: 'crypto',
    regionLabel: 'Global · Crypto',
    title: 'Pergerakan Bitcoin & Stablecoin Jadi Acuan Likuiditas Aset Digital',
    summary:
      'Penggunaan dompet valas dan stablecoin untuk lindung nilai terhadap fluktuasi kurs terus meningkat.',
    source: 'CoinTelegraph',
    url: 'https://cointelegraph.com',
    publishedAt: 'Hari ini',
  },
];

const FALLBACK_TICKERS: MarketTicker[] = [
  { label: 'BTC / IDR', price: 'Rp 1,54 M', delta: '+2,1%', up: true },
  { label: 'ETH / IDR', price: 'Rp 49,3 Jt', delta: '+1,4%', up: true },
  { label: 'SOL / IDR', price: 'Rp 3,42 Jt', delta: '+3,8%', up: true },
  { label: 'USDT / IDR', price: 'Rp 15.870', delta: '+0,1%', up: true },
  { label: 'USD / IDR', price: 'Rp 15.865', delta: 'FX', up: true },
  { label: 'SGD / IDR', price: 'Rp 11.820', delta: 'FX', up: true },
];

export function SocialTab({
  sub,
  onSubChange,
  kolega,
  connections,
  transactions = [],
  debts = [],
  selectedGroupId: externalGroupId,
  onSelectGroup,
  onQuickAddForGroup,
  onAddDebtForGroup,
  onFocusGroupInDashboard,
  externalChatPeer,
}: SocialTabProps) {
  const tSos = useTranslations('sosial');
  const tKolega = useTranslations('settings.kolega');
  const tConn = useTranslations('sosial.connections');
  const { confirm } = useConfirm();

  // State modal "Atur Grup" untuk satu kolega
  const [assigningColleague, setAssigningColleague] = useState<{
    userId: string;
    name: string;
    email: string;
  } | null>(null);
  const [busyGroupAction, setBusyGroupAction] = useState<string | null>(null);

  // Grup kolega yang sedang dipilih untuk Ringkasan Grup
  const [internalGroupId, setInternalGroupId] = useState<string | null>(null);
  const activeGroupId =
    externalGroupId !== undefined && externalGroupId !== null
      ? externalGroupId
      : internalGroupId || kolega.groups[0]?.id || null;

  const setActiveGroupId = (id: string | null) => {
    setInternalGroupId(id);
    onSelectGroup?.(id);
  };

  const selectedGroup = useMemo(
    () => kolega.groups.find((g) => g.id === activeGroupId) ?? kolega.groups[0] ?? null,
    [kolega.groups, activeGroupId]
  );

  // State form buat grup & undang anggota
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // State Obrolan
  const [chatTarget, setChatTarget] = useState<{
    id: string;
    client_name: string;
    avatar_url: string | null;
  } | null>(null);

  // State Pop-up Bagikan Momen Koneksi (ke Feed StashinMe atau Media Sosial)
  const [shareConnName, setShareConnName] = useState<string | null>(null);
  const [shareConnText, setShareConnText] = useState('');
  const [shareConnPosting, setShareConnPosting] = useState(false);

  // State Feed composer focus / prefill dari berita
  const [feedAutoFocus, setFeedAutoFocus] = useState(false);
  const [feedPrefill, setFeedPrefill] = useState('');

  // State Find My Colleague
  const [findQuery, setFindQuery] = useState('');
  const [findResults, setFindResults] = useState<GlobalUserResult[]>([]);
  const [findLoading, setFindLoading] = useState(false);
  const [busyConnId, setBusyConnId] = useState<string | null>(null);

  // State Berita & Pasar Live (Gratis: CNBC ID, Antara, CoinTelegraph, CoinGecko, ECB)
  const [newsFilter, setNewsFilter] = useState<'all' | FinanceNewsItem['region']>('all');
  const [liveNews, setLiveNews] = useState<FinanceNewsItem[]>(FALLBACK_NEWS);
  const [liveTickers, setLiveTickers] = useState<MarketTicker[]>(FALLBACK_TICKERS);
  const [newsLoading, setNewsLoading] = useState(false);

  const loadMarketNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch('/api/market-news', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) {
        if (Array.isArray(json.news) && json.news.length > 0) {
          setLiveNews(json.news);
        }
        if (Array.isArray(json.tickers) && json.tickers.length > 0) {
          setLiveTickers(json.tickers);
        }
      }
    } catch {
      // Gunakan fallback
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sub === 'news') {
      void loadMarketNews();
    }
  }, [sub, loadMarketNews]);

  // Daftar kontak dari kolega yang sudah accepted (untuk WA-style chat)
  const acceptedContacts = useMemo(
    () =>
      connections.accepted.map((c) => ({
        id: c.user_id,
        client_name: c.profile?.client_name || c.profile?.email || 'Kolega',
        avatar_url: c.profile?.avatar_url ?? null,
        email: c.profile?.email,
      })),
    [connections.accepted]
  );

  // Transaksi & Pinjaman yang khusus milik Grup yang sedang dipilih
  const groupTransactions = useMemo(() => {
    if (!selectedGroup) return [];
    return transactions.filter((tx) => tx.group_id === selectedGroup.id);
  }, [transactions, selectedGroup]);

  const groupDebts = useMemo(() => {
    if (!selectedGroup) return [];
    return debts.filter((d) => d.group_id === selectedGroup.id);
  }, [debts, selectedGroup]);

  const groupMetrics = useMemo(() => {
    if (!selectedGroup) {
      return { inflow: 0, outflow: 0, balance: 0, debtTotal: 0, monthlyDebt: 0 };
    }
    const inflow =
      groupTransactions.length > 0
        ? groupTransactions
            .filter((tx) => tx.type === 'inflow')
            .reduce((s, tx) => s + Number(tx.amount), 0)
        : selectedGroup.totals.inflow;
    const outflow =
      groupTransactions.length > 0
        ? groupTransactions
            .filter((tx) => tx.type === 'outflow')
            .reduce((s, tx) => s + Number(tx.amount), 0)
        : selectedGroup.totals.outflow;
    const activeDebts = groupDebts.filter((d) => d.status === 'active');
    const debtTotal = activeDebts.reduce((s, d) => s + Number(d.remaining_balance), 0);
    const monthlyDebt = activeDebts.reduce((s, d) => s + Number(d.monthly_installment || 0), 0);

    return {
      inflow,
      outflow,
      balance: inflow - outflow,
      debtTotal,
      monthlyDebt,
    };
  }, [selectedGroup, groupTransactions, groupDebts]);

  // Load daftar pengguna untuk Find My Colleague
  const searchGlobalUsers = useCallback(async (q: string) => {
    setFindLoading(true);
    try {
      const res = await fetch(`/api/social/search?q=${encodeURIComponent(q.trim())}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) {
        setFindResults(json.users ?? []);
      }
    } catch {
      setFindResults([]);
    } finally {
      setFindLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sub !== 'find') return;
    const timer = setTimeout(() => {
      void searchGlobalUsers(findQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [sub, findQuery, searchGlobalUsers]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      await kolega.createGroup(newGroupName.trim());
      setNewGroupName('');
      toast.success(tKolega('created'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tKolega('failed'));
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleInviteToGroup = async (groupId: string, email: string) => {
    if (!email.trim()) return;
    const grp = kolega.groups.find((g) => g.id === groupId);
    const ok = await confirm({
      title: 'Kirim Undangan Grup?',
      description: `Undang ${email.trim()} ke grup "${grp?.name || 'Keuangan'}"? Penerima perlu menyetujui undangan (2 arah), dan kamu tetap bisa membatalkannya sebelum diterima.`,
      confirmLabel: 'Ya, Kirim Undangan',
      audit: {
        action: 'Undang ke Grup',
        category: 'group',
        detail: `Mengundang ${email.trim()} ke grup ${grp?.name || groupId}`,
      },
    });
    if (!ok) return;

    setInviting(true);
    try {
      await kolega.invite(groupId, email.trim());
      setInviteEmail('');
      toast.success('Undangan terkirim. Menunggu konfirmasi kolega.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tKolega('failed'));
    } finally {
      setInviting(false);
    }
  };

  const handleShareConnectionToFeed = async () => {
    const body = shareConnText.trim();
    if (!body || shareConnPosting) return;
    setShareConnPosting(true);
    try {
      const res = await fetch('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Gagal membagikan ke Feed.');
      } else {
        toast.success('Berhasil dibagikan ke Feed StashinMe!');
        setShareConnName(null);
        setShareConnText('');
        onSubChange('feed');
      }
    } finally {
      setShareConnPosting(false);
    }
  };

  const openFullChatWith = (peer: {
    id: string;
    client_name: string;
    avatar_url: string | null;
  }) => {
    setChatTarget(peer);
    onSubChange('chat');
  };

  const navItems: {
    id: SocialSub;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
    highlight?: boolean;
  }[] = [
    {
      id: 'kolega',
      label: 'Ringkasan Kolega',
      shortLabel: 'Ringkasan',
      icon: <LayoutGrid className="size-4" />,
    },
    {
      id: 'chat',
      label: tSos('chat'),
      shortLabel: tSos('chat'),
      icon: <MessageCircle className="size-4" />,
    },
    {
      id: 'feed',
      label: '+ Post & Feed',
      shortLabel: '+ Feed',
      icon: <PenSquare className="size-4" />,
      highlight: true,
    },
    {
      id: 'find',
      label: 'Find Colleague',
      shortLabel: 'Find',
      icon: <Compass className="size-4" />,
      badge: connections.incoming.length,
    },
    {
      id: 'news',
      label: 'Berita Finance',
      shortLabel: 'Berita',
      icon: <Newspaper className="size-4" />,
    },
  ];

  const filteredNews = useMemo(
    () =>
      newsFilter === 'all'
        ? liveNews
        : liveNews.filter((item) => item.region === newsFilter),
    [newsFilter, liveNews]
  );

  return (
    <div className="space-y-5">
      {/* HEADER MENU SOSIAL:
          - Desktop (lg): Judul & Pemilih Grup di KIRI, Tab Sub-Menu di KANAN.
          - Smartphone (< lg): 5 Tombol Cepat Sosial (Ringkasan, Obrolan, +Feed, FindColleague, Berita). */}
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              Sosial
            </h2>
            {selectedGroup && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
                <Users className="size-3" aria-hidden />
                {selectedGroup.name}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            Kolega, obrolan cepat, feed, dan berita pasar.
          </p>
        </div>

        {/* Desktop Sub-Menu di sebelah KANAN */}
        <div
          role="tablist"
          aria-label={tSos('title')}
          className="hidden shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-1 lg:flex"
        >
          {navItems.map((item) => {
            const active = sub === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (item.id === 'feed') setFeedAutoFocus(true);
                  onSubChange(item.id);
                }}
                className={cn(
                  'relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  active
                    ? 'bg-[var(--brand)] text-[var(--brand-contrast)] shadow-sm'
                    : item.highlight
                      ? 'bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-[var(--brand-contrast)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="tnum ml-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-[var(--out)] px-1 text-[10px] font-bold leading-[16px] text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Smartphone & Tablet (< lg): 5 Tombol Cepat Sosial */}
        <div
          role="tablist"
          aria-label="5 Menu Cepat Sosial"
          className="grid grid-cols-5 gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-1.5 lg:hidden"
        >
          {navItems.map((item) => {
            const active = sub === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (item.id === 'feed') setFeedAutoFocus(true);
                  onSubChange(item.id);
                }}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center transition',
                  item.highlight && !active
                    ? 'bg-[var(--brand-soft)] text-[var(--brand)] font-semibold'
                    : active
                      ? 'bg-[var(--brand)] text-[var(--brand-contrast)] font-semibold shadow-sm'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                )}
              >
                {item.icon}
                <span className="max-w-full truncate text-[10px] leading-tight">
                  {item.shortLabel}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="tnum absolute right-1 top-1 flex min-w-[14px] items-center justify-center rounded-full bg-[var(--out)] px-1 text-[9px] font-bold leading-[14px] text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          SUB-MENU 1: RINGKASAN (SELECTED KOLEGA / GRUP KEUANGAN)
      ===================================================================== */}
      {sub === 'kolega' && (
        <div className="space-y-5">
          {/* Undangan Grup Masuk (Konfirmasi 2-Arah: Terima / Tolak) */}
          {kolega.pendingInvites.length > 0 && (
            <section className="rounded-xl border border-[var(--brand)]/40 bg-[var(--brand-soft)]/50 p-4">
              <p className="text-[13px] font-semibold text-[var(--text)]">
                Undangan Bergabung ke Grup ({kolega.pendingInvites.length})
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {kolega.pendingInvites.map((inv) => (
                  <div
                    key={inv.group_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                        {inv.group_name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        Diundang oleh {inv.owner_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        loading={busyGroupAction === `accept-${inv.group_id}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Terima Undangan Grup?',
                            description: `Apakah Anda yakin bergabung ke grup "${inv.group_name}" milik ${inv.owner_name}?`,
                            confirmLabel: 'Ya, Bergabung',
                            audit: {
                              action: 'Terima Undangan Grup',
                              category: 'group',
                              detail: `Bergabung ke grup ${inv.group_name}`,
                              targetUserId: inv.owner_id,
                            },
                          });
                          if (!ok) return;
                          setBusyGroupAction(`accept-${inv.group_id}`);
                          try {
                            await kolega.respondInvite(inv.group_id, 'accept');
                            toast.success(`Bergabung ke grup ${inv.group_name}.`);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Gagal menerima undangan.');
                          } finally {
                            setBusyGroupAction(null);
                          }
                        }}
                      >
                        Terima
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyGroupAction === `accept-${inv.group_id}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Tolak Undangan Grup?',
                            description: `Tolak ajakan bergabung ke grup "${inv.group_name}"?`,
                            confirmLabel: 'Ya, Tolak',
                            tone: 'danger',
                            audit: {
                              action: 'Tolak Undangan Grup',
                              category: 'group',
                              detail: `Menolak undangan grup ${inv.group_name}`,
                              targetUserId: inv.owner_id,
                            },
                          });
                          if (!ok) return;
                          setBusyGroupAction(`reject-${inv.group_id}`);
                          try {
                            await kolega.respondInvite(inv.group_id, 'reject');
                            toast.success('Undangan ditolak.');
                          } finally {
                            setBusyGroupAction(null);
                          }
                        }}
                      >
                        Tolak
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bar Pemilih Grup Kolega + Buat Grup Baru */}
          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <Label>Grup Kolega</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {kolega.groups.length === 0 ? (
                    <span className="text-[12px] text-[var(--text-muted)]">
                      Belum ada grup. Buat grup baru di kanan.
                    </span>
                  ) : (
                    kolega.groups.map((g) => {
                      const active = selectedGroup?.id === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setActiveGroupId(g.id)}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition',
                            active
                              ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                              : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                          )}
                        >
                          <Building2 className="size-3.5" aria-hidden />
                          <span>{g.name}</span>
                          <span className="rounded-full bg-[var(--surface-1)] px-1.5 py-0.2 text-[10px]">
                            {g.members.length} anggota
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Form Buat Grup Baru */}
              <div className="flex items-center gap-2">
                <input
                  id="social-new-group-name"
                  name="newGroupName"
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Nama grup baru (mis. PT Maju / Keluarga)"
                  aria-label="Nama grup keuangan baru"
                  maxLength={80}
                  className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none sm:w-64"
                />
                <Button
                  size="sm"
                  onClick={handleCreateGroup}
                  loading={creatingGroup}
                  icon={<Plus className="size-3.5" />}
                >
                  Buat Grup
                </Button>
              </div>
            </div>
          </section>

          {/* Ringkasan Detail Grup yang Sedang Dipilih */}
          {selectedGroup ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Kolom Kiri & Tengah (2 kolom): Metrik, Transaksi Grup, dan Pinjaman Grup */}
              <div className="space-y-4 lg:col-span-2">
                <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Label>Ringkasan Kas Grup: {selectedGroup.name}</Label>
                        {selectedGroup.isOwner && (
                          <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--brand)]">
                            {tKolega('owner')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <Amount value={formatRp(groupMetrics.balance)} size="xl" />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        Saldo bersih ruang <strong>{selectedGroup.name}</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {onQuickAddForGroup && (
                        <Button
                          size="sm"
                          icon={<Plus className="size-3.5" />}
                          onClick={() => onQuickAddForGroup(selectedGroup.id)}
                        >
                          Catat Kas Grup
                        </Button>
                      )}
                      {onAddDebtForGroup && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Landmark className="size-3.5" />}
                          onClick={() => onAddDebtForGroup(selectedGroup.id)}
                        >
                          Catat Pinjaman Grup
                        </Button>
                      )}
                      {onFocusGroupInDashboard && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onFocusGroupInDashboard(selectedGroup.id)}
                        >
                          Buka di Ringkasan Utama →
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-3">
                    <div>
                      <div className="flex items-center gap-1">
                        <ArrowDownRight className="size-3.5 text-[var(--brand)]" aria-hidden />
                        <Label>Masuk Grup</Label>
                      </div>
                      <div className="mt-1">
                        <Amount value={formatRp(groupMetrics.inflow)} tone="brand" size="md" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <ArrowUpRight className="size-3.5 text-[var(--out)]" aria-hidden />
                        <Label>Keluar Grup</Label>
                      </div>
                      <div className="mt-1">
                        <Amount value={formatRp(groupMetrics.outflow)} tone="out" size="md" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <Landmark className="size-3.5 text-[var(--due)]" aria-hidden />
                        <Label>Utang / Pinjaman Grup</Label>
                      </div>
                      <div className="mt-1">
                        <Amount value={formatRp(groupMetrics.debtTotal)} tone="due" size="md" />
                      </div>
                      <p className="tnum mt-0.5 text-[11px] text-[var(--text-faint)]">
                        Cicilan: {formatRp(groupMetrics.monthlyDebt)}/bln
                      </p>
                    </div>
                  </div>
                </section>

                {/* Daftar Pinjaman & Transaksi Khusus Grup Ini */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Transaksi Grup */}
                  <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[14px] font-semibold text-[var(--text)]">
                        Arus Kas {selectedGroup.name}
                      </h3>
                      <span className="tnum text-[11px] text-[var(--text-muted)]">
                        {groupTransactions.length} transaksi
                      </span>
                    </div>

                    {groupTransactions.length === 0 ? (
                      <p className="py-6 text-center text-[12px] text-[var(--text-muted)]">
                        Belum ada transaksi tercatat di grup {selectedGroup.name}.
                      </p>
                    ) : (
                      <div className="mt-2 divide-y divide-[var(--line)]">
                        {groupTransactions.slice(0, 6).map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between gap-2 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-medium text-[var(--text)]">
                                {tx.description || tx.category}
                              </p>
                              <p className="text-[11px] text-[var(--text-faint)]">
                                {formatDate(tx.transaction_date)} · {tx.category}
                              </p>
                            </div>
                            <Amount
                              value={`${tx.type === 'inflow' ? '+' : '-'}${formatRp(tx.amount)}`}
                              tone={tx.type === 'inflow' ? 'brand' : 'out'}
                              size="sm"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Pinjaman / Kewajiban Grup */}
                  <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[14px] font-semibold text-[var(--text)]">
                        Pinjaman {selectedGroup.name}
                      </h3>
                      <span className="tnum text-[11px] text-[var(--text-muted)]">
                        {groupDebts.length} kontrak
                      </span>
                    </div>

                    {groupDebts.length === 0 ? (
                      <p className="py-6 text-center text-[12px] text-[var(--text-muted)]">
                        Tidak ada pinjaman/utang di grup {selectedGroup.name}.
                      </p>
                    ) : (
                      <div className="mt-2 divide-y divide-[var(--line)]">
                        {groupDebts.map((d) => (
                          <div key={d.id} className="py-2.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[12px] font-semibold text-[var(--text)]">
                                {d.platform}
                              </p>
                              <Amount
                                value={formatRp(d.remaining_balance)}
                                tone="due"
                                size="sm"
                              />
                            </div>
                            <p className="tnum text-[11px] text-[var(--text-muted)]">
                              Cicilan {formatRp(d.monthly_installment)}/bln
                              {d.remaining_tenor ? ` · Sisa ${d.remaining_tenor} bln` : ''}
                              {d.due_day ? ` · Tgl ${d.due_day}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              {/* Kolom Kanan: Anggota Grup + Daftar Kolega Terhubung */}
              <div className="space-y-4">
                <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
                    <Users className="size-4 text-[var(--brand)]" aria-hidden />
                    Anggota {selectedGroup.name} ({selectedGroup.members.length})
                  </h3>

                  <div className="mt-3 space-y-2">
                    {selectedGroup.members.map((m) => {
                      const displayName =
                        m.profile?.client_name || m.profile?.email || 'Anggota';
                      return (
                        <div
                          key={m.user_id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-bold text-[var(--brand)]">
                              {displayName.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-[12px] font-semibold text-[var(--text)]">
                                  {displayName}
                                </p>
                                {m.status === 'pending' && (
                                  <span className="rounded bg-[var(--due-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--due)]">
                                    Menunggu
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-[10px] uppercase text-[var(--text-muted)]">
                                {m.role}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            {m.status === 'pending' && selectedGroup.isOwner ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Batalkan Undangan?',
                                    description: `Batalkan undangan ${displayName} ke grup "${selectedGroup.name}"?`,
                                    confirmLabel: 'Ya, Batalkan',
                                    tone: 'danger',
                                    audit: {
                                      action: 'Batalkan Undangan Grup',
                                      category: 'group',
                                      detail: `Membatalkan undangan ${displayName} dari grup ${selectedGroup.name}`,
                                      targetUserId: m.user_id,
                                    },
                                  });
                                  if (!ok) return;
                                  try {
                                    await kolega.cancelInvite(selectedGroup.id, m.user_id);
                                    toast.success('Undangan dibatalkan.');
                                  } catch (e) {
                                    toast.error(
                                      e instanceof Error ? e.message : tKolega('failed')
                                    );
                                  }
                                }}
                              >
                                Batalkan
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    openFullChatWith({
                                      id: m.user_id,
                                      client_name: displayName,
                                      avatar_url: m.profile?.avatar_url ?? null,
                                    })
                                  }
                                >
                                  Chat
                                </Button>
                                {selectedGroup.isOwner && m.role !== 'owner' && (
                                  <IconButton
                                    size="sm"
                                    variant="ghost"
                                    label={tKolega('remove')}
                                    onClick={async () => {
                                      const ok = await confirm({
                                        title: 'Keluarkan Anggota?',
                                        description: `Keluarkan ${displayName} dari grup "${selectedGroup.name}"?`,
                                        confirmLabel: 'Ya, Keluarkan',
                                        tone: 'danger',
                                        audit: {
                                          action: 'Keluarkan Anggota Grup',
                                          category: 'group',
                                          detail: `Mengeluarkan ${displayName} dari grup ${selectedGroup.name}`,
                                          targetUserId: m.user_id,
                                        },
                                      });
                                      if (!ok) return;
                                      try {
                                        await kolega.remove(selectedGroup.id, m.user_id);
                                        toast.success(tKolega('removed'));
                                      } catch (e) {
                                        toast.error(
                                          e instanceof Error ? e.message : tKolega('failed')
                                        );
                                      }
                                    }}
                                  >
                                    <X className="size-3.5" />
                                  </IconButton>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedGroup.isOwner && (
                    <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
                      <Label>Undang Kolega ke Grup {selectedGroup.name}</Label>
                      <div className="flex gap-1.5">
                        <input
                          id="group-invite-email"
                          name="groupInviteEmail"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="email@kolega.com"
                          aria-label="Email kolega untuk diundang ke grup"
                          className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={inviting}
                          disabled={!inviteEmail.includes('@')}
                          onClick={() => handleInviteToGroup(selectedGroup.id, inviteEmail)}
                        >
                          Undang
                        </Button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Kontak Kolega Sosial (Pertemanan 2-Arah) */}
                <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14px] font-semibold text-[var(--text)]">
                      {tConn('listTitle')} ({connections.accepted.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => onSubChange('find')}
                      className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
                    >
                      + Cari Kolega
                    </button>
                  </div>

                  {connections.incoming.length > 0 && (
                    <div className="mt-3 rounded-lg border border-[var(--due)]/30 bg-[var(--due-soft)] p-2.5">
                      <p className="text-[11px] font-semibold text-[var(--due)]">
                        {connections.incoming.length} permintaan pertemanan menunggu
                      </p>
                      <button
                        type="button"
                        onClick={() => onSubChange('find')}
                        className="mt-1 text-[11px] font-semibold text-[var(--text)] underline"
                      >
                        Lihat & Terima di Find Colleague →
                      </button>
                    </div>
                  )}

                  {connections.accepted.length === 0 ? (
                    <p className="py-5 text-center text-[12px] text-[var(--text-muted)]">
                      {tConn('emptyHint')}
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {connections.accepted.map((c) => {
                        const name = c.profile?.client_name || c.profile?.email || 'Kolega';
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-[var(--text)]">
                                {name}
                              </p>
                              {c.profile?.email && (
                                <p className="truncate text-[11px] text-[var(--text-muted)]">
                                  {c.profile.email}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {c.profile?.email &&
                                kolega.groups.some((g) => g.isOwner) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setAssigningColleague({
                                        userId: c.user_id,
                                        name,
                                        email: c.profile?.email || '',
                                      })
                                    }
                                  >
                                    Atur Grup
                                  </Button>
                                )}
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  openFullChatWith({
                                    id: c.user_id,
                                    client_name: name,
                                    avatar_url: c.profile?.avatar_url ?? null,
                                  })
                                }
                              >
                                Chat
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
              <EmptyState
                icon={<Wallet className="size-6" />}
                title="Belum ada Grup Kolega"
                description="Buat grup keuangan pertamamu di atas (mis. Grup Keluarga atau PT Perusahaan) agar kas dan utang grup terpisah rapi dari keuangan pribadi."
              />
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-MENU 2: OBROLAN (WA-STYLE CONTACTS + CHAT)
      ===================================================================== */}
      {sub === 'chat' && (
        <ChatPanel
          contacts={acceptedContacts}
          initialPeer={chatTarget ?? externalChatPeer ?? null}
        />
      )}

      {/* =====================================================================
          SUB-MENU 3: FEED GLOBAL (+ TOMBOL TAMBAH POSTINGAN)
      ===================================================================== */}
      {sub === 'feed' && (
        <FeedTab
          autoFocusComposer={feedAutoFocus}
          prefillText={feedPrefill}
          onStartChat={(author) => openFullChatWith(author)}
        />
      )}

      {/* =====================================================================
          SUB-MENU 4: FIND MY COLLEAGUE (PENCARIAN KOLEGA GLOBAL)
      ===================================================================== */}
      {sub === 'find' && (
        <div className="space-y-4">
          {/* Permintaan Pertemanan Masuk */}
          {connections.incoming.length > 0 && (
            <section className="rounded-xl border border-[var(--brand)]/35 bg-[var(--brand-soft)] p-4">
              <h3 className="text-[13px] font-semibold text-[var(--text)]">
                {tConn('incomingTitle')} ({connections.incoming.length})
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {connections.incoming.map((c) => {
                  const name = c.profile?.client_name || c.profile?.email || 'Pengguna';
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                          {name}
                        </p>
                        {c.profile?.email && (
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            {c.profile.email}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="sm"
                          loading={busyConnId === c.id}
                          icon={<Check className="size-3.5" />}
                          onClick={async () => {
                            setBusyConnId(c.id);
                            try {
                              await connections.respond(c.id, 'accept');
                              toast.success(tConn('accepted'));
                              setShareConnName(name);
                              setShareConnText(
                                `Baru saja terhubung dengan ${name} di StashinMe! Kolaborasi keuangan makin rapi di https://stashinme.biz.id`
                              );
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : tKolega('failed')
                              );
                            } finally {
                              setBusyConnId(null);
                            }
                          }}
                        >
                          {tConn('accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyConnId === c.id}
                          onClick={async () => {
                            setBusyConnId(c.id);
                            try {
                              await connections.respond(c.id, 'reject');
                              toast.success(tConn('rejected'));
                            } finally {
                              setBusyConnId(null);
                            }
                          }}
                        >
                          {tConn('reject')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Kotak Pencarian Global */}
          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--text)]">
                  Find My Colleague
                </h3>
                <p className="text-[12px] text-[var(--text-muted)]">
                  Cari berdasarkan nama, @username, atau email.
                </p>
              </div>
              <div className="relative sm:w-80">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]"
                  aria-hidden
                />
                <input
                  id="find-colleague-input"
                  name="findColleagueQuery"
                  type="search"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  placeholder="Cari nama, @username, atau email..."
                  aria-label="Cari kolega berdasarkan nama, username, atau email"
                  className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] pl-9 pr-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>
            </div>

            {findLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
              </div>
            ) : findResults.length === 0 ? (
              <EmptyState
                icon={<Compass className="size-6" />}
                title="Tidak ada pengguna yang cocok"
                description="Coba kata kunci nama, username, atau email yang lain."
              />
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {findResults.map((u) => {
                  const existingConn = connections.connections.find(
                    (c) => c.user_id === u.id
                  );
                  const isAccepted = existingConn?.status === 'accepted';
                  const isPending = existingConn?.status === 'pending';

                  return (
                    <article
                      key={u.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-soft)] text-[14px] font-bold text-[var(--brand)]">
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            u.client_name.slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="truncate text-[14px] font-semibold text-[var(--text)]">
                              {u.client_name}
                            </h4>
                            {u.role === 'admin' && (
                              <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--brand)]">
                                Admin
                              </span>
                            )}
                            {isAccepted && (
                              <span className="inline-flex items-center gap-1 rounded bg-[var(--info-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--info)]">
                                <UserCheck className="size-3" aria-hidden />
                                Kolega
                              </span>
                            )}
                          </div>
                          <p className="tnum text-[11px] text-[var(--text-muted)]">
                            @{u.username}
                            {u.emailMasked ? ` · ${u.emailMasked}` : ''}
                          </p>
                          {u.bio && (
                            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
                              {u.bio}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-2.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<MessageCircle className="size-3.5" />}
                          onClick={() =>
                            openFullChatWith({
                              id: u.id,
                              client_name: u.client_name,
                              avatar_url: u.avatar_url,
                            })
                          }
                        >
                          Chat
                        </Button>

                        {!existingConn && (
                          <Button
                            size="sm"
                            loading={busyConnId === u.id}
                            icon={<UserPlus className="size-3.5" />}
                            onClick={async () => {
                              setBusyConnId(u.id);
                              try {
                                await connections.request(u.id);
                                toast.success(
                                  `Permintaan kolega dikirim ke ${u.client_name}`
                                );
                              } catch (e) {
                                toast.error(
                                  e instanceof Error
                                    ? e.message
                                    : 'Gagal mengirim permintaan'
                                );
                              } finally {
                                setBusyConnId(null);
                              }
                            }}
                          >
                            Tambah Kolega
                          </Button>
                        )}

                        {isPending && existingConn?.direction === 'outgoing' && (
                          <span className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                            Menunggu Konfirmasi
                          </span>
                        )}

                        {isPending && existingConn?.direction === 'incoming' && (
                          <Button
                            size="sm"
                            loading={busyConnId === existingConn.id}
                            icon={<Check className="size-3.5" />}
                            onClick={async () => {
                              setBusyConnId(existingConn.id);
                              try {
                                await connections.respond(existingConn.id, 'accept');
                                toast.success(tConn('accepted'));
                              } finally {
                                setBusyConnId(null);
                              }
                            }}
                          >
                            Terima Kolega
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =====================================================================
          SUB-MENU 5: BERITA (LIVE RSS CNBC ID, ANTARA, COINTELEGRAPH & KURS)
      ===================================================================== */}
      {sub === 'news' && (
        <div className="space-y-4">
          {/* Ticker Ringkasan Pasar Live */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {liveTickers.slice(0, 6).map((tk) => (
              <div
                key={tk.label}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {tk.label}
                  </span>
                  <TrendingUp
                    className={cn(
                      'size-3',
                      tk.up ? 'text-[var(--brand)]' : 'text-[var(--out)]'
                    )}
                    aria-hidden
                  />
                </div>
                <p className="tnum mt-1 text-[13px] font-semibold text-[var(--text)]">
                  {tk.price}
                </p>
                <p
                  className={cn(
                    'tnum text-[11px] font-medium',
                    tk.up ? 'text-[var(--brand)]' : 'text-[var(--out)]'
                  )}
                >
                  {tk.delta}
                </p>
              </div>
            ))}
          </div>

          {/* Filter Wilayah / Topik Berita + Segarkan */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'lokal', label: 'Indonesia (CNBC & Antara)' },
                  { id: 'crypto', label: 'Crypto (CoinTelegraph)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNewsFilter(tab.id)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition',
                    newsFilter === tab.id
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                      : 'border-[var(--line)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw className="size-3.5" />}
              loading={newsLoading}
              onClick={loadMarketNews}
            >
              Segarkan
            </Button>
          </div>

          {/* Daftar Artikel Berita Live */}
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {filteredNews.map((item) => (
              <article
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                      <Globe className="size-3 text-[var(--info)]" aria-hidden />
                      {item.regionLabel}
                    </span>
                    <span className="text-[11px] text-[var(--text-faint)]">
                      {item.publishedAt}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-semibold leading-snug text-[var(--text)]">
                    {item.title}
                  </h3>

                  <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                    {item.summary}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5 text-[11px] text-[var(--text-faint)]">
                  <span>{item.source}</span>
                  <div className="flex items-center gap-3">
                    {item.url && item.url !== '#' && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        Baca
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFeedPrefill(
                          `${item.title}\n${item.url !== '#' ? item.url : ''}\n\nPendapat kalian?`
                        );
                        setFeedAutoFocus(true);
                        onSubChange('feed');
                      }}
                      className="font-semibold text-[var(--brand)] hover:underline"
                    >
                      Diskusikan →
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      {/* Modal Atur Grup untuk Satu Kolega (Pilih Grup Mana Saja + Batalkan Invite) */}
      <Modal
        open={assigningColleague !== null}
        onClose={() => setAssigningColleague(null)}
        title={
          assigningColleague
            ? `Atur Grup: ${assigningColleague.name}`
            : 'Atur Grup Kolega'
        }
        description="Pilih grup mana saja yang ingin kamu bagikan dengan kolega ini. Undangan memerlukan persetujuan 2 arah."
        size="md"
        footer={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAssigningColleague(null)}
          >
            Tutup
          </Button>
        }
      >
        {assigningColleague && (
          <div className="space-y-2.5">
            {kolega.groups
              .filter((g) => g.isOwner)
              .map((g) => {
                const membership = g.members.find(
                  (m) => m.user_id === assigningColleague.userId
                );
                const isActive = membership?.status === 'active';
                const isPending = membership?.status === 'pending';

                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                        {g.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {isActive
                          ? 'Anggota aktif'
                          : isPending
                            ? 'Undangan menunggu persetujuan'
                            : 'Belum bergabung'}
                      </p>
                    </div>

                    {isActive ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyGroupAction === `rm-${g.id}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Keluarkan dari Grup?',
                            description: `Keluarkan ${assigningColleague.name} dari grup "${g.name}"?`,
                            confirmLabel: 'Ya, Keluarkan',
                            tone: 'danger',
                            audit: {
                              action: 'Keluarkan Anggota Grup',
                              category: 'group',
                              detail: `Mengeluarkan ${assigningColleague.name} dari grup ${g.name}`,
                              targetUserId: assigningColleague.userId,
                            },
                          });
                          if (!ok) return;
                          setBusyGroupAction(`rm-${g.id}`);
                          try {
                            await kolega.remove(g.id, assigningColleague.userId);
                            toast.success(`Dikeluarkan dari ${g.name}.`);
                          } finally {
                            setBusyGroupAction(null);
                          }
                        }}
                      >
                        Keluarkan
                      </Button>
                    ) : isPending ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyGroupAction === `cancel-${g.id}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Batalkan Undangan?',
                            description: `Batalkan undangan ${assigningColleague.name} ke grup "${g.name}"?`,
                            confirmLabel: 'Ya, Batalkan',
                            tone: 'danger',
                            audit: {
                              action: 'Batalkan Undangan Grup',
                              category: 'group',
                              detail: `Membatalkan undangan ${assigningColleague.name} ke grup ${g.name}`,
                              targetUserId: assigningColleague.userId,
                            },
                          });
                          if (!ok) return;
                          setBusyGroupAction(`cancel-${g.id}`);
                          try {
                            await kolega.cancelInvite(
                              g.id,
                              assigningColleague.userId
                            );
                            toast.success('Undangan dibatalkan.');
                          } finally {
                            setBusyGroupAction(null);
                          }
                        }}
                      >
                        Batalkan
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        loading={busyGroupAction === `inv-${g.id}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Undang ke Grup?',
                            description: `Kirim undangan ke ${assigningColleague.name} untuk bergabung ke grup "${g.name}"?`,
                            confirmLabel: 'Ya, Undang',
                            audit: {
                              action: 'Undang ke Grup',
                              category: 'group',
                              detail: `Mengundang ${assigningColleague.name} ke grup ${g.name}`,
                              targetUserId: assigningColleague.userId,
                            },
                          });
                          if (!ok) return;
                          setBusyGroupAction(`inv-${g.id}`);
                          try {
                            await kolega.invite(g.id, assigningColleague.email);
                            toast.success(`Undangan ke ${g.name} dikirim.`);
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : 'Gagal mengundang.'
                            );
                          } finally {
                            setBusyGroupAction(null);
                          }
                        }}
                      >
                        Undang
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </Modal>

      {/* Pop-up Bagikan Momen Koneksi ke Feed StashinMe atau Media Sosial */}
      <Modal
        open={Boolean(shareConnName)}
        onClose={() => {
          setShareConnName(null);
          setShareConnText('');
        }}
        title={`Terhubung dengan ${shareConnName ?? 'Kolega'}!`}
        description="Mau bagikan momen koneksi baru ini ke Feed StashinMe atau ke media sosial Anda?"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="share-conn-textarea"
              className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]"
            >
              Teks Postingan
            </label>
            <textarea
              id="share-conn-textarea"
              name="shareConnectionText"
              rows={3}
              value={shareConnText}
              onChange={(e) => setShareConnText(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              loading={shareConnPosting}
              disabled={!shareConnText.trim()}
              icon={<Send className="size-3.5" />}
              onClick={() => void handleShareConnectionToFeed()}
            >
              Posting ke Feed StashinMe
            </Button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareConnText)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--text)] transition hover:border-[var(--brand)]"
            >
              <Share2 className="size-3.5 text-[var(--brand)]" aria-hidden />
              WhatsApp
            </a>

            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareConnText)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--text)] transition hover:border-[var(--brand)]"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              X / Twitter
            </a>

            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(shareConnText);
                toast.success('Teks disalin, siap dibagikan ke medsos!');
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--text)] transition hover:border-[var(--brand)]"
            >
              <Copy className="size-3.5" aria-hidden />
              Salin Teks
            </button>
          </div>

          <div className="flex justify-end border-t border-[var(--line)] pt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShareConnName(null);
                setShareConnText('');
              }}
            >
              Nanti Saja
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
