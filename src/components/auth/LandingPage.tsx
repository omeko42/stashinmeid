'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bitcoin,
  Building2,
  Check,
  KeyRound,
  Loader2,
  Lock,
  MessageSquare,
  Plug,
  Wallet,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/BrandLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { GoogleButton } from '@/components/auth/GoogleButton';

interface LandingPageProps {
  defaultModalOpen?: boolean;
  defaultMode?: 'signin' | 'signup';
}

const MARKET_STRIP = [
  { sym: 'BTC', price: 'Rp 1.542,8 Jt', delta: '+3,4%', up: true },
  { sym: 'ETH', price: 'Rp 49,3 Jt', delta: '+2,1%', up: true },
  { sym: 'SOL', price: 'Rp 3,42 Jt', delta: '+5,8%', up: true },
  { sym: 'USDT', price: 'Rp 15.870', delta: '+0,1%', up: true },
  { sym: 'USD', price: 'Rp 15.865', delta: '-0,1%', up: false },
  { sym: 'IHSG', price: '7.284,5', delta: '+0,6%', up: true },
];

const DEMO_SCOPES = {
  personal: {
    label: 'Pribadi',
    tag: 'Kas & Bank Utama',
    balance: 'Rp 48.500.000',
    inflow: '+Rp 18.200.000',
    outflow: '-Rp 6.450.000',
    debtLabel: 'Cicilan KPR · Jatuh tempo tgl 25',
    debtAmount: 'Rp 3.200.000/bln',
    bars: [38, 52, 44, 68, 61, 82, 94],
  },
  company: {
    label: 'PT Nusantara',
    tag: 'Grup Operasional Tim',
    balance: 'Rp 325.400.000',
    inflow: '+Rp 142.000.000',
    outflow: '-Rp 54.800.000',
    debtLabel: 'Invoice Vendor Server · Tempo tgl 15',
    debtAmount: 'Rp 18.500.000/bln',
    bars: [55, 64, 78, 70, 88, 92, 100],
  },
  family: {
    label: 'Keluarga',
    tag: 'Kas Rumah Tangga',
    balance: 'Rp 22.750.000',
    inflow: '+Rp 12.000.000',
    outflow: '-Rp 4.150.000',
    debtLabel: 'Semua pinjaman lunas',
    debtAmount: 'Rp 0',
    bars: [42, 48, 50, 62, 58, 72, 79],
  },
} as const;

type DemoScopeKey = keyof typeof DEMO_SCOPES;

const CRYPTO_HOLDINGS = [
  { code: 'BTC', name: 'Bitcoin', amount: '0,085 BTC', idr: 'Rp 131.142.000', pct: 58 },
  { code: 'USDT', name: 'Tether USD', amount: '3.200 USDT', idr: 'Rp 50.784.000', pct: 24 },
  { code: 'USD', name: 'US Dollar Cash', amount: '$2.450', idr: 'Rp 38.869.000', pct: 18 },
];

/**
 * Kartu Bento dengan efek pantulan cahaya kursor (spotlight) yang halus.
 */
function SpotlightCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e1318]/90 transition-colors duration-300 hover:border-emerald-500/35 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(480px circle at var(--mx, 50%) var(--my, 50%), rgba(34, 197, 139, 0.09), transparent 40%)',
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

export function LandingPage({
  defaultModalOpen = false,
  defaultMode = 'signin',
}: LandingPageProps) {
  const t = useTranslations();
  const router = useRouter();

  const [authModalOpen, setAuthModalOpen] = useState(defaultModalOpen);
  const [demoScope, setDemoScope] = useState<DemoScopeKey>('personal');
  const [activeApiToggle, setActiveApiToggle] = useState<Record<string, boolean>>({
    payment: true,
    kyc: true,
    news: true,
  });

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
        text: `Link reset password telah dikirim ke ${email}.`,
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

  const currentDemo = DEMO_SCOPES[demoScope];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0e12] text-[#e8eef1] selection:bg-emerald-500/25 selection:text-emerald-200">
      {/* Subtle Top Radial Light (Bukan hitam murni / bukan neon berlebihan) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[460px] bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(34,197,139,0.12),transparent)]"
      />

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0a0e12]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo size={34} />
            <span className="text-[16px] font-bold tracking-tight text-white">
              stashinmeid
            </span>
            <span className="hidden rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline-block">
              v3.0
            </span>
          </div>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-zinc-400 md:flex">
            <a href="#preview" className="transition-colors hover:text-white">
              Preview
            </a>
            <a href="#ekosistem" className="transition-colors hover:text-white">
              Ekosistem
            </a>
            <a href="#roadmap" className="transition-colors hover:text-white">
              Rilis
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => openAuthModal('signin')}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[12px] font-semibold text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.07]"
            >
              Masuk
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => openAuthModal('signup')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#22c58b] px-4 py-2 text-[12px] font-semibold text-[#06120d] transition hover:bg-[#35d69c]"
            >
              Daftar
              <ArrowUpRight className="size-3.5" />
            </motion.button>
          </div>
        </div>

        {/* Compact Market Bar */}
        <div className="border-t border-white/[0.05] bg-[#080b0e]/90 px-4 py-1.5">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 overflow-x-auto text-[11px] whitespace-nowrap">
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                PASAR LIVE
              </span>
              {MARKET_STRIP.map((m) => (
                <span key={m.sym} className="inline-flex items-center gap-1.5">
                  <span className="font-semibold text-zinc-200">{m.sym}</span>
                  <span className="tnum text-zinc-400">{m.price}</span>
                  <span
                    className={`tnum font-medium ${
                      m.up ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {m.delta}
                  </span>
                </span>
              ))}
            </div>
            <span className="hidden font-mono text-[10px] text-zinc-500 lg:inline">
              FX &amp; Crypto Oracle
            </span>
          </div>
        </div>
      </header>

      {/* Hero + Interactive Workspace Preview */}
      <section
        id="preview"
        className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:pt-16"
      >
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Left Copy: Ringkas, lugas, tanpa basa-basi AI */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-6 lg:col-span-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-zinc-300">
              <span className="size-1.5 rounded-full bg-[#22c58b]" />
              Manajemen Kas, Kolega &amp; Portofolio Digital
            </div>

            <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-[44px]">
              Satu buku kas untuk pribadi, grup, dan aset digital.
            </h1>

            <p className="max-w-lg text-[15px] leading-relaxed text-zinc-400">
              Catat arus kas harian, pisahkan utang bisnis dari kas keluarga,
              dan pantau saldo valas maupun crypto dalam satu dashboard.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#22c58b] px-6 py-3 text-[13px] font-semibold text-[#06120d] shadow-lg shadow-emerald-500/15 transition hover:bg-[#35d69c]"
              >
                Buat Akun Baru
                <ArrowRight className="size-4" />
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => openAuthModal('signin')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.03] px-6 py-3 text-[13px] font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                Masuk ke Workspace
              </motion.button>
            </div>

            <div className="flex flex-wrap items-center gap-6 border-t border-white/[0.08] pt-5 text-[12px] text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#22c58b]" />
                Isolasi kas per grup
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#22c58b]" />
                Multi-currency &amp; Crypto
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-[#22c58b]" />
                Koneksi API modular
              </span>
            </div>
          </motion.div>

          {/* Right Interactive Live Sandbox */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
            className="lg:col-span-6"
          >
            <SpotlightCard className="p-5 shadow-2xl sm:p-6">
              {/* Top Bar with Interactive Scope Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Ruang Keuangan
                </span>
                <div className="flex rounded-xl border border-white/10 bg-[#090c10] p-1">
                  {(Object.keys(DEMO_SCOPES) as DemoScopeKey[]).map((key) => {
                    const active = demoScope === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDemoScope(key)}
                        className={`relative rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                          active ? 'text-[#06120d]' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="landing-scope-pill"
                            transition={{
                              type: 'spring',
                              stiffness: 420,
                              damping: 32,
                            }}
                            className="absolute inset-0 rounded-lg bg-[#22c58b]"
                          />
                        )}
                        <span className="relative z-10">
                          {DEMO_SCOPES[key].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Animated Balance & Cashflow Bars */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={demoScope}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="mt-5 space-y-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-zinc-400">
                        Total Saldo · {currentDemo.tag}
                      </p>
                      <p className="tnum mt-1 text-2xl font-bold text-white sm:text-3xl">
                        {currentDemo.balance}
                      </p>
                    </div>
                    <div className="flex gap-4 text-right text-[11px]">
                      <div>
                        <p className="text-zinc-500">Masuk</p>
                        <p className="tnum font-semibold text-emerald-400">
                          {currentDemo.inflow}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Keluar</p>
                        <p className="tnum font-semibold text-rose-400">
                          {currentDemo.outflow}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mini Bar Chart */}
                  <div className="flex h-24 items-end gap-2 rounded-2xl border border-white/[0.06] bg-[#090c10]/90 px-4 pb-3 pt-5">
                    {currentDemo.bars.map((h, i) => (
                      <div
                        key={i}
                        className="flex flex-1 flex-col items-center gap-1.5"
                      >
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.round(h * 0.55)}px` }}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 26,
                            delay: i * 0.03,
                          }}
                          className={`w-full rounded-md ${
                            i === currentDemo.bars.length - 1
                              ? 'bg-[#22c58b]'
                              : 'bg-emerald-500/25'
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Isolated Debt Status Row */}
                  <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12px]">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="size-4 text-emerald-400" />
                      <span className="text-zinc-300">
                        {currentDemo.debtLabel}
                      </span>
                    </div>
                    <span className="tnum font-semibold text-white">
                      {currentDemo.debtAmount}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </SpotlightCard>
          </motion.div>
        </div>
      </section>

      {/* Asymmetric Bento Grid: Ekosistem & Showcase */}
      <section
        id="ekosistem"
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Dirancang untuk kecepatan dan privasi data.
            </h2>
            <p className="mt-1 text-[13px] text-zinc-400">
              Klik komponen di bawah untuk melihat cara kerja workspace.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Bento 1: Crypto & Multi-Currency Portfolio (7 cols) */}
          <SpotlightCard className="p-6 lg:col-span-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <Bitcoin className="size-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white">
                    Portofolio Crypto &amp; Valas
                  </h3>
                  <p className="text-[12px] text-zinc-400">
                    Konversi otomatis kurs CoinGecko &amp; ECB ke Rupiah.
                  </p>
                </div>
              </div>
              <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-emerald-400">
                Auto-FX
              </span>
            </div>

            <div className="mt-5 space-y-2.5">
              {CRYPTO_HOLDINGS.map((asset) => (
                <div
                  key={asset.code}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#090c10]/80 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-white/[0.05] font-mono text-[11px] font-bold text-white">
                      {asset.code}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-white">
                        {asset.name}
                      </p>
                      <p className="tnum text-[11px] text-zinc-400">
                        {asset.amount}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[13px] font-semibold text-white">
                      {asset.idr}
                    </p>
                    <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#22c58b]"
                        style={{ width: `${asset.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* Bento 2: Modular 3rd-Party API Hub (5 cols) */}
          <SpotlightCard className="p-6 lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Plug className="size-4" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white">
                  Koneksi API Pihak Ketiga
                </h3>
                <p className="text-[12px] text-zinc-400">
                  Offload pembayaran, e-KYC, dan berita agar DB tetap ringan.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {[
                {
                  id: 'payment',
                  name: 'Payment Gateway',
                  sub: 'Midtrans · Xendit · QRIS',
                },
                {
                  id: 'kyc',
                  name: 'e-KYC Pihak Ketiga',
                  sub: 'Verihubs · PrivyID (Simpan token saja)',
                },
                {
                  id: 'news',
                  name: 'Stream Berita & Kurs',
                  sub: '0 KB beban database internal',
                },
              ].map((api) => {
                const on = activeApiToggle[api.id];
                return (
                  <button
                    key={api.id}
                    type="button"
                    onClick={() =>
                      setActiveApiToggle((prev) => ({
                        ...prev,
                        [api.id]: !prev[api.id],
                      }))
                    }
                    className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-[#090c10]/80 px-4 py-3 text-left transition hover:border-white/15"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-white">
                        {api.name}
                      </p>
                      <p className="text-[11px] text-zinc-400">{api.sub}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                        on
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-white/5 text-zinc-500'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          on ? 'bg-emerald-400' : 'bg-zinc-500'
                        }`}
                      />
                      {on ? 'Connected' : 'Standby'}
                    </span>
                  </button>
                );
              })}
            </div>
          </SpotlightCard>

          {/* Bento 3: Social Hub & Fast Chat (6 cols) */}
          <SpotlightCard className="p-6 lg:col-span-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white">
                  Sosial, Kolega &amp; Obrolan Cepat
                </h3>
                <p className="text-[12px] text-zinc-400">
                  Ringkasan kas grup yang dipilih, kontak kolega, feed, dan
                  berita pasar.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'Ringkasan Grup',
                'Obrolan & Kontak',
                '+ Post Feed',
                'Find Colleague',
                'Berita Finansial',
              ].map((pill) => (
                <span
                  key={pill}
                  className="rounded-xl border border-white/[0.08] bg-[#090c10] px-3 py-1.5 text-[11px] font-medium text-zinc-300"
                >
                  {pill}
                </span>
              ))}
            </div>
          </SpotlightCard>

          {/* Bento 4: AI Receipt Scanner & Loan Simulator (6 cols) */}
          <SpotlightCard className="p-6 lg:col-span-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <Wallet className="size-4" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white">
                  Pindai Struk AI &amp; Simulasi Pelunasan
                </h3>
                <p className="text-[12px] text-zinc-400">
                  Catat transaksi otomatis dari foto struk dan hitung penghematan
                  pelunasan pinjaman.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-[12px]">
              <div className="rounded-2xl border border-white/[0.06] bg-[#090c10] px-3.5 py-2.5">
                <p className="text-[11px] text-zinc-400">Saldo Fisik &amp; Bank</p>
                <p className="mt-0.5 font-semibold text-white">
                  Tersinkronisasi Otomatis
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#090c10] px-3.5 py-2.5">
                <p className="text-[11px] text-zinc-400">Keamanan Akses</p>
                <p className="mt-0.5 font-semibold text-white">
                  Passkey · 2FA · PIN
                </p>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </section>

      {/* Roadmap / Status Rilis: Phase selanjutnya TBA */}
      <section
        id="roadmap"
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6"
      >
        <div className="rounded-3xl border border-white/[0.08] bg-[#0e1318]/90 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                STATUS PENGEMBANGAN
              </span>
              <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">
                Rilis &amp; Peta Jalan
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-400">
              <Lock className="size-3 text-emerald-400" />
              Core Roadmap Private
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Phase 01: Live */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-emerald-400">
                  PHASE 01 · v3.0
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  LIVE
                </span>
              </div>
              <h3 className="mt-2.5 text-[14px] font-semibold text-white">
                Multi-Scope Finance, Crypto &amp; Modular API
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">
                Isolasi saldo pribadi vs grup kolega, pelacak aset valas &amp;
                crypto, obrolan cepat, serta manajemen koneksi API pihak ketiga.
              </p>
            </div>

            {/* Phase 02: TBA */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#090c10]/70 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-zinc-400">
                  PHASE 02
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-300">
                  <Lock className="size-2.5" />
                  TBA
                </span>
              </div>
              <h3 className="mt-2.5 text-[14px] font-semibold text-zinc-200">
                To Be Announced
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                Spesifikasi modul dan integrasi tahap kedua disimpan secara
                internal hingga jadwal peluncuran resmi.
              </p>
            </div>

            {/* Phase 03: TBA */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#090c10]/70 p-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-zinc-400">
                  PHASE 03
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-300">
                  <Lock className="size-2.5" />
                  TBA
                </span>
              </div>
              <h3 className="mt-2.5 text-[14px] font-semibold text-zinc-200">
                To Be Announced
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                Ekspansi ekosistem berikutnya dikunci pada repositori privat
                pengembang utama.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="border-t border-white/[0.07] bg-[#080b0e]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={28} />
            <span className="text-[13px] font-semibold text-white">
              stashinmeid
            </span>
            <span className="text-[12px] text-zinc-500">
              · Manajemen Keuangan &amp; Aset
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[12px] font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('signup')}
              className="rounded-xl bg-[#22c58b] px-3.5 py-1.5 text-[12px] font-semibold text-[#06120d] transition hover:bg-[#35d69c]"
            >
              Daftar Akun
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
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative w-full max-w-md rounded-3xl border border-white/12 bg-[#10161c] p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                aria-label="Tutup modal autentikasi"
                className="absolute right-5 top-5 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-white"
              >
                <X className="size-4" />
              </button>

              <div className="mb-5 flex items-center gap-3">
                <BrandLogo size={38} />
                <div>
                  <p className="text-base font-bold tracking-tight text-white">
                    stashinmeid
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Workspace keuangan pribadi &amp; kolega
                  </p>
                </div>
              </div>

              {/* Sliding Pill Auth Switcher */}
              <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-[#090c10] p-1">
                {[
                  { id: 'signin' as const, label: 'Masuk', signup: false },
                  { id: 'signup' as const, label: 'Daftar Baru', signup: true },
                ].map((tab) => {
                  const active = isSignUp === tab.signup;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setIsSignUp(tab.signup);
                        setSignUpStep(1);
                        setMessage(null);
                      }}
                      className={`relative rounded-lg py-2 text-xs font-semibold transition-colors ${
                        active ? 'text-[#06120d]' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="auth-modal-tab-pill"
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 32,
                          }}
                          className="absolute inset-0 rounded-lg bg-[#22c58b]"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {message && (
                <div
                  className={`mb-4 rounded-xl border p-3 text-xs ${
                    message.type === 'error'
                      ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
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
                      className="mb-1.5 block text-xs font-medium text-zinc-400"
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
                      className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-password"
                      className="mb-1.5 block text-xs font-medium text-zinc-400"
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
                      className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-confirm-password"
                      className="mb-1.5 block text-xs font-medium text-zinc-400"
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
                      className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#22c58b] py-2.5 text-sm font-semibold text-[#06120d] transition hover:bg-[#35d69c]"
                  >
                    Lanjut <ArrowRight className="size-4" />
                  </button>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-white/10" />
                    <span className="mx-3 shrink text-xs text-zinc-500">
                      atau
                    </span>
                    <div className="flex-grow border-t border-white/10" />
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
                          className="mb-1.5 block text-xs font-medium text-zinc-400"
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
                          placeholder="Nama lengkap"
                          className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="signup-client-name"
                          className="mb-1.5 block text-xs font-medium text-zinc-400"
                        >
                          Nama Workspace
                        </label>
                        <input
                          id="signup-client-name"
                          name="clientName"
                          type="text"
                          autoComplete="organization"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Personal / Nama Tim"
                          className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="signup-bio"
                          className="mb-1.5 block text-xs font-medium text-zinc-400"
                        >
                          Bio Singkat (Opsional)
                        </label>
                        <input
                          id="signup-bio"
                          name="bio"
                          type="text"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Mis. Wiraswasta / Engineer"
                          className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
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
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.08]"
                        >
                          <ArrowLeft className="size-4" /> Kembali
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#22c58b] py-2.5 text-sm font-semibold text-[#06120d] transition hover:bg-[#35d69c] disabled:opacity-50"
                        >
                          {loading && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          Buat Akun
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label
                          htmlFor="login-identifier"
                          className="mb-1.5 block text-xs font-medium text-zinc-400"
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
                          className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label
                            htmlFor="login-password"
                            className="block text-xs font-medium text-zinc-400"
                          >
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-xs text-[#22c58b] hover:underline"
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
                          className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#22c58b] py-2.5 text-sm font-semibold text-[#06120d] transition hover:bg-[#35d69c] disabled:opacity-50"
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
                    <div className="flex-grow border-t border-white/10" />
                    <span className="mx-3 shrink text-xs text-zinc-500">
                      atau
                    </span>
                    <div className="flex-grow border-t border-white/10" />
                  </div>

                  <GoogleButton
                    onError={(msg) => setMessage({ type: 'error', text: msg })}
                  />

                  <button
                    type="button"
                    onClick={handlePasskeyLogin}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#090c10] py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.05] disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <KeyRound className="size-4 text-[#22c58b]" />
                    )}
                    Login dengan Passkey
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
