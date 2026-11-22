'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bitcoin,
  Bot,
  Building2,
  CheckCircle2,
  CreditCard,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  Plug,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/BrandLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { GoogleButton } from '@/components/auth/GoogleButton';

interface LandingPageProps {
  /** Jika dibuka dari /login, modal bisa tetap tertutup atau dibuka sesuai interaksi. */
  defaultModalOpen?: boolean;
  defaultMode?: 'signin' | 'signup';
}

const LIVE_TICKERS = [
  { pair: 'BTC/IDR', price: 'Rp 1.542.850.000', change: '+3,42%', up: true },
  { pair: 'ETH/IDR', price: 'Rp 49.310.000', change: '+2,18%', up: true },
  { pair: 'SOL/IDR', price: 'Rp 3.425.000', change: '+5,84%', up: true },
  { pair: 'USDT/IDR', price: 'Rp 15.870', change: '+0,12%', up: true },
  { pair: 'USD/IDR', price: 'Rp 15.865', change: '-0,08%', up: false },
  { pair: 'IHSG', price: '7.284,50', change: '+0,64%', up: true },
  { pair: 'EMAS ANTAM', price: 'Rp 1.485.000/gr', change: '+0,95%', up: true },
];

const SHOWCASE_TABS = [
  {
    id: 'isolation',
    label: 'Isolasi Kas & Grup',
    badge: 'Multi-Workspace',
    title: 'Pisahkan Kas Pribadi, Keluarga, dan Perusahaan Secara Presisi',
    desc: 'Tidak ada lagi utang perusahaan yang tercampur dengan pengeluaran rumah tangga. Beralih antar ruang keuangan hanya dengan satu klik.',
    metrics: [
      { label: 'Ruang Pribadi (Saldo Fisik & Bank)', value: 'Rp 48.500.000', delta: '+18% tabungan bersih' },
      { label: 'Grup: PT Nusantara Digital', value: 'Rp 325.400.000', delta: '14 transaksi tim aktif' },
      { label: 'Grup: Keluarga', value: 'Rp 22.750.000', delta: '0 tunggakan cicilan' },
    ],
  },
  {
    id: 'crypto',
    label: 'Crypto & Multi-Valas',
    badge: 'Web3 Ready',
    title: 'Pantau Aset Kripto, Valuta Asing & Dompet Fisik Real-Time',
    desc: 'Konversi otomatis nilai portofolio Bitcoin, USDT, USD, SGD, dan Euro ke mata uang utama Anda menggunakan kurs live ECB & CoinGecko.',
    metrics: [
      { label: 'Portofolio Crypto (BTC · ETH · USDT)', value: 'Rp 184.200.000', delta: 'Live CoinGecko Oracle' },
      { label: 'Rekening Valas (USD · SGD · EUR)', value: 'Rp 96.450.000', delta: 'Auto-FX Frankfurter ECB' },
      { label: 'Kas Fisik & E-Wallet Lokal', value: 'Rp 31.800.000', delta: 'Terhubung Arus Kas' },
    ],
  },
  {
    id: 'ai_debt',
    label: 'AI OCR & Simulasi Utang',
    badge: 'Smart Engine',
    title: 'Pindai Struk Belanja dengan AI & Simulasikan Pelunasan Pinjaman',
    desc: 'Foto struk belanja Anda untuk pengisian transaksi otomatis, dan gunakan simulator pelunasan untuk memangkas beban cicilan bulanan.',
    metrics: [
      { label: 'Ekstraksi Struk AI Vision', value: '< 2,5 Detik', delta: 'Deteksi nominal & kategori otomatis' },
      { label: 'Penghematan Simulasi Pelunasan', value: 'Rp 4.250.000/bln', delta: 'Prioritas bunga & tenor terdekat' },
      { label: 'Pengingat Jatuh Tempo', value: 'H-7 & H-1', delta: 'Notifikasi aplikasi & WhatsApp API' },
    ],
  },
  {
    id: 'api_hub',
    label: 'Social & 3rd-Party API',
    badge: 'Zero DB Bloat',
    title: 'Hub Koneksi API Pihak Ketiga & Kolaborasi Sosial Finansial',
    desc: 'Integrasikan Payment Gateway, e-KYC Dukcapil, dan API Berita secara stateless agar database Anda tetap ringan, cepat, dan hemat kuota.',
    metrics: [
      { label: 'Payment Gateway (Midtrans / Xendit)', value: 'QRIS & VA Ready', delta: 'Auto-debet cicilan & split bill' },
      { label: 'Third-Party e-KYC (Verihubs / Privy)', value: '0 KB File Beban DB', delta: 'Hanya simpan token verifikasi' },
      { label: 'Social Hub & Fast Chat', value: 'Real-Time', delta: 'Obrolan kolega, feed & berita pasar' },
    ],
  },
] as const;

const ROADMAP_ITEMS = [
  {
    phase: 'PHASE 01 · LIVE SEKARANG',
    status: 'live',
    title: 'Core Financial OS, Group Isolation & 3rd-Party API Hub',
    desc: 'Sinkronisasi Saldo Fisik/Non-Fisik dengan Arus Kas, isolasi ruang grup kolega, multi-currency & crypto tracker, AI OCR struk, Fast Chat, dan manajemen koneksi API eksternal.',
    tags: ['Multi-Scope Finance', 'AI Receipt OCR', 'Social Hub', 'Modular API Manager'],
  },
  {
    phase: 'PHASE 02 · Q1 PENGEMBANGAN',
    status: 'building',
    title: 'Payment Gateway Checkout, Auto-Debet Cicilan & Split-Bill QRIS',
    desc: 'Bayar cicilan pinjaman dan patungan kas grup kolega langsung dari dashboard menggunakan Midtrans, Xendit, atau QRIS Dinamis dengan rekonsiliasi webhook otomatis.',
    tags: ['QRIS Dinamis', 'Virtual Account', 'Auto-Settlement', 'Split-Bill Kolega'],
  },
  {
    phase: 'PHASE 03 · Q2 WEB3 & ON-CHAIN',
    status: 'upcoming',
    title: 'Non-Custodial Web3 Wallet Sync & DeFi Portfolio Analytics',
    desc: 'Hubungkan MetaMask, Phantom, atau WalletConnect (Read-Only) untuk memantau aset on-chain (Ethereum, Solana, L2, Bitcoin), riwayat gas fee, dan estimasi yield staking.',
    tags: ['WalletConnect', 'EVM & Solana Sync', 'DeFi Yield Tracker', 'On-Chain Net Worth'],
  },
  {
    phase: 'PHASE 04 · Q3 ENTERPRISE & AI CFO',
    status: 'upcoming',
    title: 'Multi-Sig Group Treasury, Biometric e-KYC & Autonomous AI CFO',
    desc: 'Persetujuan berlapis (multi-signature) untuk pencairan dana grup perusahaan, verifikasi biometrik pihak ketiga instan, dan asisten AI prediktif arus kas 12 bulan.',
    tags: ['Multi-Sig Treasury', 'Biometric e-KYC', 'AI Cashflow Forecast', 'Tax Export'],
  },
];

export function LandingPage({
  defaultModalOpen = false,
  defaultMode = 'signin',
}: LandingPageProps) {
  const t = useTranslations();
  const router = useRouter();

  const [authModalOpen, setAuthModalOpen] = useState(defaultModalOpen);
  const [showcaseTab, setShowcaseTab] = useState<string>('isolation');

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [clientName, setClientName] = useState('Personal');
  const [bio, setBio] = useState('');

  const [isSignUp, setIsSignUp] = useState(defaultMode === 'signup');
  const [signUpStep, setSignUpStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const captchaEnabled = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  );

  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaResetKey((k) => k + 1);
  };

  const openAuthModal = (mode: 'signin' | 'signup') => {
    setIsSignUp(mode === 'signup');
    setSignUpStep(1);
    setMessage(null);
    setAuthModalOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && authModalOpen) {
        setAuthModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authModalOpen]);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setMessage({
        type: 'error',
        text: t('auth.passwordWeak'),
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: t('auth.passwordMismatch') });
      return;
    }

    setSignUpStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (captchaEnabled && !captchaToken) {
      setMessage({ type: 'error', text: t('auth.captchaRequired') });
      setLoading(false);
      return;
    }

    // Superadmin username login (no '@' in input)
    if (!isSignUp && !email.includes('@')) {
      const res = await fetch('/api/auth/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email,
          password,
          captchaToken: captchaToken ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error || 'Login gagal.' });
        resetCaptcha();
      } else {
        setAuthModalOpen(false);
        router.push('/');
        router.refresh();
      }
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage({
        type: 'error',
        text: 'Supabase belum dikonfigurasi di environment ini.',
      });
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
          data: {
            full_name: fullName,
            client_name: clientName || 'Personal',
            bio,
            role: 'user',
          },
        },
      });
      if (error) {
        setMessage({
          type: 'error',
          text: error.message || t('errors.generic'),
        });
        resetCaptcha();
      } else {
        setMessage({
          type: 'success',
          text: 'Akun berhasil dibuat! Cek email untuk verifikasi atau langsung masuk.',
        });
        setIsSignUp(false);
        setSignUpStep(1);
        resetCaptcha();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: captchaToken ?? undefined },
      });
      if (error) {
        setMessage({
          type: 'error',
          text: error.message || t('errors.generic'),
        });
        resetCaptcha();
      } else {
        setAuthModalOpen(false);
        router.push('/');
        router.refresh();
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    setMessage(null);
    if (!email || !email.includes('@')) {
      setMessage({
        type: 'error',
        text: 'Masukkan alamat email akunmu dulu, lalu klik Lupa Password.',
      });
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setMessage({ type: 'error', text: 'Supabase belum dikonfigurasi.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setMessage({ type: 'error', text: t('errors.generic') });
    } else {
      setMessage({
        type: 'success',
        text: `Link reset password telah dikirim ke ${email}. Cek inbox / folder spam.`,
      });
    }
    setLoading(false);
  };

  const handlePasskeyLogin = async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setMessage({ type: 'error', text: t('auth.passkeyUnsupported') });
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setMessage({ type: 'error', text: 'Supabase belum dikonfigurasi.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        if (error.message?.toLowerCase().includes('abort')) {
          setLoading(false);
          return;
        }
        setMessage({ type: 'error', text: error.message });
      } else {
        setAuthModalOpen(false);
        router.push('/');
        router.refresh();
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : t('auth.passkeyFailed'),
      });
    } finally {
      setLoading(false);
    }
  };

  const activeShowcase =
    SHOWCASE_TABS.find((s) => s.id === showcaseTab) ?? SHOWCASE_TABS[0];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070a0d] text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Ambient Web3 Mesh Glows */}
      <div className="pointer-events-none fixed -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-emerald-500/12 blur-[140px]" />
      <div className="pointer-events-none fixed -right-40 top-1/3 h-[520px] w-[520px] rounded-full bg-teal-500/10 blur-[150px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-cyan-500/8 blur-[140px]" />

      {/* Sticky Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070a0d]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo size={38} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">
                  stashinmeid
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  v3.0 Web3 &amp; AI
                </span>
              </div>
              <p className="hidden text-[11px] text-zinc-400 sm:block">
                Personal, Collaborative &amp; Crypto Finance Operating System
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-medium text-zinc-300 md:flex">
            <a
              href="#features"
              className="transition hover:text-emerald-400"
            >
              Fitur Utama
            </a>
            <a
              href="#showcase"
              className="transition hover:text-emerald-400"
            >
              Showcase Ekosistem
            </a>
            <a
              href="#api-architecture"
              className="transition hover:text-emerald-400"
            >
              Arsitektur API
            </a>
            <a
              href="#roadmap"
              className="transition hover:text-emerald-400"
            >
              Roadmap Web3
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-emerald-500/50 hover:bg-white/10"
            >
              Masuk (Sign In)
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('signup')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
            >
              Daftar Gratis
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Live Market & Crypto Strip */}
        <div className="border-t border-white/5 bg-zinc-950/70 px-4 py-1.5">
          <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto text-[11px] whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              LIVE MARKET ORACLE
            </span>
            {LIVE_TICKERS.map((item) => (
              <div
                key={item.pair}
                className="inline-flex items-center gap-1.5 text-zinc-300"
              >
                <span className="font-semibold text-white">{item.pair}</span>
                <span className="tnum text-zinc-400">{item.price}</span>
                <span
                  className={`tnum font-semibold ${
                    item.up ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {item.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300">
              <Sparkles className="size-3.5 text-emerald-400" />
              Platform Manajemen Keuangan Pribadi, Kolega &amp; Web3
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              Satu Workspace untuk{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Arus Kas, Grup Kolega, Pinjaman &amp; Aset Crypto.
              </span>
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base">
              <strong>stashinmeid</strong> membantu individu, keluarga, dan tim
              perusahaan mengelola saldo fisik maupun non-fisik, memisahkan
              pembukuan utang grup secara ketat, memindai struk belanja dengan
              AI, serta menghubungkan API pihak ketiga (Payment Gateway, e-KYC,
              dan Market News) tanpa membebani database.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:brightness-110"
              >
                Buat Akun Gratis (Sign Up)
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-emerald-500/50 hover:bg-white/10"
              >
                <KeyRound className="size-4 text-emerald-400" />
                Masuk ke Akun (Sign In)
              </button>
            </div>

            {/* Key Value Pills */}
            <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
              <div>
                <p className="tnum text-xl font-bold text-white">100%</p>
                <p className="text-xs text-zinc-400">
                  Isolasi Kas Pribadi vs Grup
                </p>
              </div>
              <div>
                <p className="tnum text-xl font-bold text-emerald-400">
                  Multi-Asset
                </p>
                <p className="text-xs text-zinc-400">
                  IDR, Valas &amp; Crypto Live FX
                </p>
              </div>
              <div>
                <p className="tnum text-xl font-bold text-cyan-400">0 KB Bloat</p>
                <p className="text-xs text-zinc-400">
                  Stateless 3rd-Party API Hub
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Product & Crypto Showcase Card */}
          <div id="showcase" className="lg:col-span-6">
            <div className="rounded-3xl border border-white/15 bg-zinc-900/75 p-5 shadow-2xl backdrop-blur-2xl sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-rose-500/80" />
                  <span className="size-2.5 rounded-full bg-amber-400/80" />
                  <span className="size-2.5 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 font-mono text-xs text-zinc-400">
                    stashinmeid://workspace-showcase
                  </span>
                </div>
                <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  {activeShowcase.badge}
                </span>
              </div>

              {/* Tab Switcher inside Showcase */}
              <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-zinc-950/80 p-1.5 sm:grid-cols-4">
                {SHOWCASE_TABS.map((tab) => {
                  const active = tab.id === activeShowcase.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setShowcaseTab(tab.id)}
                      className={`rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                        active
                          ? 'bg-emerald-500 text-slate-950 shadow'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Active Showcase Body */}
              <div className="mt-5 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {activeShowcase.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                    {activeShowcase.desc}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {activeShowcase.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3"
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-300">
                          {m.label}
                        </p>
                        <p className="text-[11px] text-emerald-400">{m.delta}</p>
                      </div>
                      <span className="tnum text-sm font-bold text-white">
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs">
                  <span className="text-emerald-200">
                    Siap mencoba langsung di workspace Anda?
                  </span>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signup')}
                    className="font-bold text-emerald-300 underline hover:text-white"
                  >
                    Buka Akun Sekarang →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid: Apa itu stashinmeid? */}
      <section
        id="features"
        className="mx-auto max-w-7xl border-t border-white/10 px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            KENAPA STASHINMEID?
          </span>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            Dirancang untuk Kejelasan Finansial Pribadi, Tim &amp; Aset Digital
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Menggabungkan pencatatan arus kas harian, manajemen pinjaman,
            kolaborasi sosial grup kolega, dan pelacakan aset multi-mata uang.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <Building2 className="size-5 text-emerald-400" />,
              title: 'Isolasi Ruang Keuangan & Grup Kolega',
              desc: 'Pisahkan saldo, arus kas, dan daftar utang antara Ruang Pribadi, Grup Keluarga, dan Grup Perusahaan agar pembukuan tidak pernah tercampur.',
            },
            {
              icon: <Bitcoin className="size-5 text-amber-400" />,
              title: 'Multi-Dompet, Valas & Aset Crypto',
              desc: 'Kelola Saldo Fisik (Kas) dan Non-Fisik (Bank, E-Wallet, Bitcoin, USDT, USD, SGD) lengkap dengan sinkronisasi kurs otomatis.',
            },
            {
              icon: <Bot className="size-5 text-cyan-400" />,
              title: 'AI Receipt OCR & Pagu Anggaran',
              desc: 'Unggah foto struk belanja dan biarkan AI mengekstrak nominal beserta kategorinya secara instan, terhubung langsung dengan pantauan pagu anggaran.',
            },
            {
              icon: <TrendingUp className="size-5 text-teal-400" />,
              title: 'Simulator Pelunasan Pinjaman',
              desc: 'Pantau sisa tenor, tanggal jatuh tempo terdekat, dan simulasikan pelunasan dipercepat untuk melihat penghematan cicilan bulanan.',
            },
            {
              icon: <MessageSquare className="size-5 text-indigo-400" />,
              title: 'Social Finance Hub & Fast Chat',
              desc: 'Dilengkapi ringkasan grup kolega, obrolan cepat (Fast Chat), daftar kontak ala WhatsApp, direktori Find Colleague, dan berita pasar.',
            },
            {
              icon: <Plug className="size-5 text-rose-400" />,
              title: 'Koneksi API Pihak Ketiga Hemat DB',
              desc: 'Atur sendiri koneksi Payment Gateway, e-KYC Dukcapil, dan API Berita di menu Pengaturan agar beban file & pemrosesan ditangani pihak ketiga.',
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="group rounded-2xl border border-white/10 bg-zinc-900/60 p-6 transition hover:border-emerald-500/40 hover:bg-zinc-900/90"
            >
              <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-950">
                {feat.icon}
              </div>
              <h3 className="mt-4 text-base font-bold text-white">
                {feat.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Third-Party API & Zero-Bloat Architecture Highlight */}
      <section
        id="api-architecture"
        className="mx-auto max-w-7xl border-t border-white/10 px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-emerald-950/30 p-6 sm:p-10">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Zap className="size-3.5" />
                MODULAR THIRD-PARTY API ENGINE
              </span>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Arsitektur Ringan: Biarkan API Pihak Ketiga Menangani Pembayaran,
                e-KYC, dan Stream Berita
              </h2>
              <p className="text-sm leading-relaxed text-zinc-300">
                Melalui menu <strong>Pengaturan → Koneksi API</strong>, Anda
                memegang kendali penuh untuk menghubungkan provider eksternal.
                Dokumen KYC, pemrosesan transaksi pembayaran, dan ribuan artikel
                berita finansial tidak membebani database internal Anda.
              </p>
              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                {[
                  {
                    icon: <CreditCard className="size-4 text-emerald-400" />,
                    title: 'Payment Gateway API',
                    sub: 'Midtrans, Xendit, DOKU, Stripe & Custom QRIS',
                  },
                  {
                    icon: <ShieldCheck className="size-4 text-cyan-400" />,
                    title: 'Third-Party e-KYC API',
                    sub: 'Verihubs, PrivyID, VIDA & Sumsub (Token-Only)',
                  },
                  {
                    icon: <Globe className="size-4 text-amber-400" />,
                    title: 'Market & Finance News API',
                    sub: 'NewsAPI, Finnhub, Alpha Vantage & CoinGecko',
                  },
                  {
                    icon: <Users className="size-4 text-purple-400" />,
                    title: 'AI Vision & WhatsApp API',
                    sub: 'Gemini OCR, OpenAI & Fonnte/Wablas WA Gateway',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-950/60 p-3.5"
                  >
                    <div className="mt-0.5">{item.icon}</div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-zinc-400">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/90 p-5 font-mono text-xs lg:col-span-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-[11px] text-zinc-400">
                <span>API_GATEWAY_ROUTING.json</span>
                <span className="text-emerald-400">● STATELESS MODE</span>
              </div>
              <div className="space-y-2 text-[11px] leading-relaxed">
                <p className="text-zinc-400">
                  <span className="text-emerald-400">&quot;payment&quot;</span>:{' '}
                  <span className="text-amber-300">
                    &quot;midtrans_snap_v2 (QRIS / VA)&quot;
                  </span>
                  ,
                </p>
                <p className="text-zinc-400">
                  <span className="text-emerald-400">&quot;kyc_provider&quot;</span>:{' '}
                  <span className="text-cyan-300">
                    &quot;verihubs_dukcapil (0_KB_DB_STORAGE)&quot;
                  </span>
                  ,
                </p>
                <p className="text-zinc-400">
                  <span className="text-emerald-400">&quot;news_stream&quot;</span>:{' '}
                  <span className="text-purple-300">
                    &quot;direct_edge_stream (NO_DB_WRITE)&quot;
                  </span>
                  ,
                </p>
                <p className="text-zinc-400">
                  <span className="text-emerald-400">&quot;crypto_oracle&quot;</span>:{' '}
                  <span className="text-emerald-300">
                    &quot;coingecko + frankfurter_ecb&quot;
                  </span>
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => openAuthModal('signin')}
                  className="w-full rounded-xl bg-white/10 py-2.5 font-sans text-xs font-semibold text-white transition hover:bg-emerald-500 hover:text-slate-950"
                >
                  Konfigurasi di Dashboard Pengaturan →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Pengembangan Kedepan (Web3, Crypto & Open Banking) */}
      <section
        id="roadmap"
        className="mx-auto max-w-7xl border-t border-white/10 px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400">
              <Rocket className="size-3.5" />
              ROADMAP &amp; PENGEMBANGAN KEDEPAN
            </span>
            <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Evolusi Menuju Ekosistem Web3, Crypto &amp; Open Finance
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Peta jalan pengembangan stashinmeid dari manajemen arus kas
              kolaboratif menuju integrasi on-chain wallet dan pembayaran
              otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('signup')}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500 hover:text-slate-950"
          >
            Gabung Early Access
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {ROADMAP_ITEMS.map((item) => (
            <div
              key={item.phase}
              className={`rounded-2xl border p-6 transition ${
                item.status === 'live'
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : 'border-white/10 bg-zinc-900/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {item.phase}
                </span>
                {item.status === 'live' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    <CheckCircle2 className="size-3" />
                    ACTIVE
                  </span>
                ) : item.status === 'building' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                    <Layers className="size-3" />
                    IN DEVELOPMENT
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                    <Wallet className="size-3" />
                    WEB3 ROADMAP
                  </span>
                )}
              </div>

              <h3 className="mt-3 text-base font-bold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                {item.desc}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg border border-white/10 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-medium text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Footer */}
      <footer className="border-t border-white/10 bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo size={34} />
            <div>
              <p className="text-sm font-bold text-white">stashinmeid</p>
              <p className="text-xs text-zinc-400">
                © {new Date().getFullYear()} stashinmeid · Personal, Collaborative
                &amp; Web3 Finance
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              Masuk (Sign In)
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('signup')}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Buat Akun Baru (Sign Up)
            </button>
          </div>
        </div>
      </footer>

      {/* Sign In & Sign Up Modal Pop-up */}
      <AnimatePresence>
        {authModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isSignUp ? 'Daftar Akun Baru' : 'Masuk ke Akun'}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAuthModalOpen(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative w-full max-w-md rounded-3xl border border-white/15 bg-zinc-900/95 p-7 shadow-2xl backdrop-blur-2xl"
            >
              {/* Tombol Tutup Modal */}
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                aria-label="Tutup modal autentikasi"
                className="absolute right-5 top-5 rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:text-white"
              >
                <X className="size-4" />
              </button>

              <div className="mb-5 flex items-center gap-3">
                <BrandLogo size={40} />
                <div>
                  <p className="text-lg font-bold tracking-tight text-white">
                    stashinmeid
                  </p>
                  <p className="text-xs text-zinc-400">
                    aplikasi manajemen keuanganmu
                  </p>
                </div>
              </div>

              {/* Switcher Tab Masuk vs Daftar di dalam Modal */}
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-zinc-950 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setSignUpStep(1);
                    setMessage(null);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    !isSignUp
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Masuk (Sign In)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setSignUpStep(1);
                    setMessage(null);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    isSignUp
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Daftar (Sign Up)
                </button>
              </div>

              <h2 className="mb-1 text-base font-semibold text-white">
                {isSignUp
                  ? signUpStep === 1
                    ? 'Buat Akun Baru (Langkah 1/2)'
                    : 'Lengkapi Profil Workspace (Langkah 2/2)'
                  : 'Masuk ke Workspace Anda'}
              </h2>
              <p className="mb-5 text-xs text-slate-400">
                {isSignUp
                  ? signUpStep === 1
                    ? 'Masukkan email aktif dan buat password yang aman.'
                    : 'Tentukan nama lengkap dan nama workspace keuangan Anda.'
                  : 'Kelola arus kas pribadi, grup kolega, dan aset dengan aman.'}
              </p>

              {message && (
                <div
                  className={`mb-4 rounded-xl border p-3 text-xs ${
                    message.type === 'error'
                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  {message.text}
                </div>
              )}

              {isSignUp && signUpStep === 1 ? (
                <form onSubmit={handleNextStep} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="signup-email"
                      className="mb-1.5 block text-xs font-medium text-slate-400"
                    >
                      Email
                    </label>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-password"
                      className="mb-1.5 block text-xs font-medium text-slate-400"
                    >
                      Password (min. 8 karakter, huruf &amp; angka)
                    </label>
                    <PasswordInput
                      id="signup-password"
                      name="password"
                      autoComplete="new-password"
                      unstyled
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-confirm-password"
                      className="mb-1.5 block text-xs font-medium text-slate-400"
                    >
                      Ulangi Password
                    </label>
                    <PasswordInput
                      id="signup-confirm-password"
                      name="confirmPassword"
                      autoComplete="new-password"
                      unstyled
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                  >
                    Lanjut Lengkapi Bio <ArrowRight className="size-4" />
                  </button>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-slate-800" />
                    <span className="mx-3 shrink text-xs text-slate-500">
                      atau
                    </span>
                    <div className="flex-grow border-t border-slate-800" />
                  </div>

                  <GoogleButton
                    label="Daftar dengan Google"
                    onError={(msg) => setMessage({ type: 'error', text: msg })}
                  />
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {isSignUp ? (
                    <>
                      <div>
                        <label
                          htmlFor="signup-full-name"
                          className="mb-1.5 block text-xs font-medium text-slate-400"
                        >
                          Nama Lengkap
                        </label>
                        <input
                          id="signup-full-name"
                          name="fullName"
                          type="text"
                          autoComplete="name"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Nama lengkap kamu"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="signup-client-name"
                          className="mb-1.5 block text-xs font-medium text-slate-400"
                        >
                          Nama Client / Workspace
                        </label>
                        <input
                          id="signup-client-name"
                          name="clientName"
                          type="text"
                          autoComplete="organization"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Personal / PT Maju"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="signup-bio"
                          className="mb-1.5 block text-xs font-medium text-slate-400"
                        >
                          Bio Singkat (Opsional)
                        </label>
                        <input
                          id="signup-bio"
                          name="bio"
                          type="text"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Contoh: Freelancer / Karyawan Swasta"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      {captchaEnabled && (
                        <div className="pt-1">
                          <TurnstileWidget
                            resetSignal={captchaResetKey}
                            onToken={setCaptchaToken}
                            theme="dark"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSignUpStep(1)}
                          className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-700"
                        >
                          <ArrowLeft className="size-4" /> Kembali
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {loading && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          Daftar Sekarang
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label
                          htmlFor="login-identifier"
                          className="mb-1.5 block text-xs font-medium text-slate-400"
                        >
                          Email atau Username
                        </label>
                        <input
                          id="login-identifier"
                          name="identifier"
                          type="text"
                          autoComplete="username"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@email.com / username"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label
                            htmlFor="login-password"
                            className="block text-xs font-medium text-slate-400"
                          >
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-xs text-emerald-400 hover:underline"
                          >
                            Lupa Password?
                          </button>
                        </div>
                        <PasswordInput
                          id="login-password"
                          name="password"
                          autoComplete="current-password"
                          unstyled
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••"
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      {captchaEnabled && (
                        <div className="pt-1">
                          <TurnstileWidget
                            resetSignal={captchaResetKey}
                            onToken={setCaptchaToken}
                            theme="dark"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {loading && <Loader2 className="size-4 animate-spin" />}
                        Masuk
                      </button>
                    </>
                  )}
                </form>
              )}

              {!isSignUp && (
                <div className="mt-4 space-y-2.5">
                  <div className="relative flex items-center py-1.5">
                    <div className="flex-grow border-t border-slate-800" />
                    <span className="mx-3 shrink text-xs text-slate-500">
                      atau
                    </span>
                    <div className="flex-grow border-t border-slate-800" />
                  </div>

                  <GoogleButton
                    onError={(msg) => setMessage({ type: 'error', text: msg })}
                  />

                  <button
                    type="button"
                    onClick={handlePasskeyLogin}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <KeyRound className="size-4 text-emerald-400" />
                    )}
                    Login dengan Passkey
                  </button>
                </div>
              )}

              <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
                <Lock className="size-3 text-emerald-400" />
                Dilindungi enkripsi TLS, Cloudflare Turnstile &amp; 2FA/Passkey
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
