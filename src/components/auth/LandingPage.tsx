'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bitcoin,
  Building2,
  FlaskConical,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Plug,
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
  { sym: 'BTC', price: '1,54 M', delta: '+3,4%', up: true },
  { sym: 'ETH', price: '49,3 Jt', delta: '+2,1%', up: true },
  { sym: 'SOL', price: '3,42 Jt', delta: '+5,8%', up: true },
  { sym: 'USDT', price: '15.870', delta: '+0,1%', up: true },
  { sym: 'USD', price: '15.865', delta: '-0,1%', up: false },
  { sym: 'IHSG', price: '7.284', delta: '+0,6%', up: true },
];

const DEMO_SCOPES = {
  personal: {
    label: 'Pribadi',
    balance: 'Rp 48.500.000',
    inflow: '+18,2 Jt',
    outflow: '-6,4 Jt',
    debtLabel: 'KPR · Tgl 25',
    debtAmount: 'Rp 3,2 Jt/bln',
    bars: [
      { m: 'Mei', h: 36, val: 'Rp 24,1 Jt' },
      { m: 'Jun', h: 48, val: 'Rp 29,4 Jt' },
      { m: 'Jul', h: 42, val: 'Rp 27,8 Jt' },
      { m: 'Agu', h: 64, val: 'Rp 35,2 Jt' },
      { m: 'Sep', h: 58, val: 'Rp 33,9 Jt' },
      { m: 'Okt', h: 78, val: 'Rp 42,6 Jt' },
      { m: 'Nov', h: 94, val: 'Rp 48,5 Jt' },
    ],
  },
  company: {
    label: 'PT Nusantara',
    balance: 'Rp 325.400.000',
    inflow: '+142,0 Jt',
    outflow: '-54,8 Jt',
    debtLabel: 'Vendor Server · Tgl 15',
    debtAmount: 'Rp 18,5 Jt/bln',
    bars: [
      { m: 'Mei', h: 50, val: 'Rp 190 Jt' },
      { m: 'Jun', h: 62, val: 'Rp 218 Jt' },
      { m: 'Jul', h: 74, val: 'Rp 245 Jt' },
      { m: 'Agu', h: 68, val: 'Rp 232 Jt' },
      { m: 'Sep', h: 84, val: 'Rp 280 Jt' },
      { m: 'Okt', h: 90, val: 'Rp 304 Jt' },
      { m: 'Nov', h: 100, val: 'Rp 325 Jt' },
    ],
  },
  family: {
    label: 'Keluarga',
    balance: 'Rp 22.750.000',
    inflow: '+12,0 Jt',
    outflow: '-4,1 Jt',
    debtLabel: 'Tanpa pinjaman aktif',
    debtAmount: 'Rp 0',
    bars: [
      { m: 'Mei', h: 40, val: 'Rp 12,4 Jt' },
      { m: 'Jun', h: 46, val: 'Rp 14,1 Jt' },
      { m: 'Jul', h: 50, val: 'Rp 15,8 Jt' },
      { m: 'Agu', h: 62, val: 'Rp 17,9 Jt' },
      { m: 'Sep', h: 58, val: 'Rp 17,2 Jt' },
      { m: 'Okt', h: 72, val: 'Rp 20,4 Jt' },
      { m: 'Nov', h: 82, val: 'Rp 22,7 Jt' },
    ],
  },
} as const;

type DemoScopeKey = keyof typeof DEMO_SCOPES;

const ASSETS_SAMPLE = [
  { code: 'BTC', amount: '0,085 BTC', idr: 'Rp 131,1 Jt', pct: 58 },
  { code: 'USDT', amount: '3.200 USDT', idr: 'Rp 50,7 Jt', pct: 24 },
  { code: 'USD', amount: '$2.450', idr: 'Rp 38,8 Jt', pct: 18 },
];

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
      className={`group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0f1419]/90 transition-colors duration-300 hover:border-emerald-500/35 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(34, 197, 139, 0.085), transparent 45%)',
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
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [liveMarket, setLiveMarket] = useState(MARKET_STRIP);
  const [apiSwitches, setApiSwitches] = useState<Record<string, boolean>>({
    payment: true,
    kyc: true,
    news: true,
  });

  useEffect(() => {
    let alive = true;
    fetch('/api/market-news')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive || !Array.isArray(json?.tickers) || json.tickers.length === 0) {
          return;
        }
        setLiveMarket(
          json.tickers.map(
            (t: { sym: string; price: string; delta: string; up: boolean }) => ({
              sym: t.sym,
              price: t.price.replace(/^Rp\s*/, ''),
              delta: t.delta,
              up: t.up,
            })
          )
        );
      })
      .catch(() => {
        // Tetap tampilkan fallback jika offline
      });
    return () => {
      alive = false;
    };
  }, []);

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
      setMessage({ type: 'error', text: t('auth.passwordWeak') });
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
        text: 'Supabase belum dikonfigurasi.',
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
          text: 'Akun dibuat. Cek email untuk verifikasi atau langsung masuk.',
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
        text: 'Isi email dulu, lalu klik Lupa Password.',
      });
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setMessage({ type: 'error', text: t('errors.generic') });
    } else {
      setMessage({
        type: 'success',
        text: `Link reset dikirim ke ${email}.`,
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
    if (!supabase) return;

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
    <div className="relative min-h-screen overflow-x-hidden bg-[#0b0f13] text-[#e8eef1] selection:bg-emerald-500/25 selection:text-emerald-200">
      {/* Subtle Top Light */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_65%_45%_at_50%_-15%,rgba(34,197,139,0.13),transparent)]"
      />

      {/* Minimal Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b0f13]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={32} />
            <span className="text-[16px] font-bold tracking-tight text-white">
              stashinmeid
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/demo"
              className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white sm:inline-flex"
            >
              <FlaskConical className="size-3.5 text-emerald-400" />
              Coba Demo
            </Link>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => openAuthModal('signin')}
              className="rounded-xl px-3.5 py-2 text-[13px] font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              Masuk
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => openAuthModal('signup')}
              className="inline-flex items-center gap-1 rounded-xl bg-[#22c58b] px-4 py-2 text-[13px] font-semibold text-[#06120d] transition hover:bg-[#35d69c]"
            >
              Daftar
              <ArrowUpRight className="size-3.5" />
            </motion.button>
          </div>
        </div>

        {/* Clean Market Strip */}
        <div className="border-t border-white/[0.04] bg-[#090d11]/85 px-4 py-1.5">
          <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto text-[11px] whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              PASAR
            </span>
            {liveMarket.map((m) => (
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
        </div>
      </header>

      {/* Hero Stage */}
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left: Clean Headline & 2 Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-6 lg:col-span-5"
          >
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-[48px]">
              Kas, grup, dan aset digital.
            </h1>

            <p className="max-w-md text-[15px] leading-relaxed text-zinc-400">
              Pisahkan keuangan pribadi, keluarga, dan bisnis. Pantau saldo
              fisik, bank, valas, sampai crypto dari satu layar.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#22c58b] px-6 py-3 text-[13px] font-semibold text-[#06120d] shadow-lg shadow-emerald-500/15 transition hover:bg-[#35d69c]"
              >
                Mulai Gratis
                <ArrowRight className="size-4" />
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => openAuthModal('signin')}
                className="rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                Masuk
              </motion.button>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-3 text-[13px] font-semibold text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/15"
              >
                <FlaskConical className="size-3.5" />
                Coba Demo
              </Link>
            </div>
          </motion.div>

          {/* Right: Interactive Live Workspace Preview */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
            className="lg:col-span-7"
          >
            <SpotlightCard className="p-5 shadow-2xl sm:p-6">
              {/* Interactive Scope Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-4">
                <div className="flex rounded-xl border border-white/[0.08] bg-[#0a0d11] p-1">
                  {(Object.keys(DEMO_SCOPES) as DemoScopeKey[]).map((key) => {
                    const active = demoScope === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setDemoScope(key);
                          setHoveredBarIdx(null);
                        }}
                        className={`relative rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                          active
                            ? 'text-[#06120d]'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="hero-scope-pill"
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
                <span className="font-mono text-[11px] text-zinc-500">
                  Interaktif · Klik ruang
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={demoScope}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="mt-5 space-y-5"
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                        Total Saldo
                      </p>
                      <p className="tnum mt-1 text-3xl font-bold tracking-tight text-white">
                        {currentDemo.balance}
                      </p>
                    </div>
                    <div className="flex gap-5 text-right text-[12px]">
                      <div>
                        <p className="text-[10px] uppercase text-zinc-500">
                          Masuk
                        </p>
                        <p className="tnum font-semibold text-emerald-400">
                          {currentDemo.inflow}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-zinc-500">
                          Keluar
                        </p>
                        <p className="tnum font-semibold text-rose-400">
                          {currentDemo.outflow}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Hover-Scrub Bar Chart */}
                  <div className="relative rounded-2xl border border-white/[0.06] bg-[#0a0d11]/90 px-4 pb-3 pt-8">
                    <AnimatePresence>
                      {hoveredBarIdx !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="tnum pointer-events-none absolute right-4 top-2.5 rounded-lg bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300"
                        >
                          {currentDemo.bars[hoveredBarIdx].m} ·{' '}
                          {currentDemo.bars[hoveredBarIdx].val}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex h-24 items-end gap-2">
                      {currentDemo.bars.map((bar, idx) => {
                        const active =
                          hoveredBarIdx === idx ||
                          (hoveredBarIdx === null &&
                            idx === currentDemo.bars.length - 1);
                        return (
                          <button
                            key={bar.m}
                            type="button"
                            onMouseEnter={() => setHoveredBarIdx(idx)}
                            onMouseLeave={() => setHoveredBarIdx(null)}
                            onFocus={() => setHoveredBarIdx(idx)}
                            onBlur={() => setHoveredBarIdx(null)}
                            aria-label={`${bar.m} ${bar.val}`}
                            className="flex flex-1 flex-col items-center gap-1.5 focus:outline-none"
                          >
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.round(bar.h * 0.62)}px` }}
                              transition={{
                                type: 'spring',
                                stiffness: 320,
                                damping: 26,
                                delay: idx * 0.025,
                              }}
                              className={`w-full rounded-lg transition-colors ${
                                active
                                  ? 'bg-[#22c58b]'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/40'
                              }`}
                            />
                            <span className="font-mono text-[10px] text-zinc-500">
                              {bar.m}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Debt Row */}
                  <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px]">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Building2 className="size-4 text-emerald-400" />
                      <span>{currentDemo.debtLabel}</span>
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

        {/* 3 Compact Interactive Bento Tiles */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4 }}
          className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-12"
        >
          {/* Tile 1: Valas & Crypto */}
          <SpotlightCard className="p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bitcoin className="size-4 text-amber-400" />
                <h2 className="text-[14px] font-semibold text-white">
                  Valas &amp; Crypto
                </h2>
              </div>
              <span className="font-mono text-[10px] text-emerald-400">
                Kurs Live
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {ASSETS_SAMPLE.map((a) => (
                <div
                  key={a.code}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#0a0d11]/85 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 font-mono text-[11px] font-bold text-zinc-200">
                      {a.code}
                    </span>
                    <span className="tnum text-[11px] text-zinc-400">
                      {a.amount}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-white/10 sm:block">
                      <div
                        className="h-full rounded-full bg-[#22c58b]"
                        style={{ width: `${a.pct}%` }}
                      />
                    </div>
                    <span className="tnum text-[12px] font-semibold text-white">
                      {a.idr}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* Tile 2: Koneksi API Modular */}
          <SpotlightCard className="p-5 lg:col-span-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plug className="size-4 text-emerald-400" />
                <h2 className="text-[14px] font-semibold text-white">
                  Koneksi API
                </h2>
              </div>
              <span className="font-mono text-[10px] text-zinc-400">
                Gratis · Modular
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {[
                { id: 'news', name: 'Berita & Kurs Live', sub: 'CNBC ID · CoinGecko · ECB' },
                { id: 'kyc', name: 'Verifikasi KYC', sub: 'Didit.me · Verihubs' },
                { id: 'payment', name: 'Pembayaran', sub: 'Midtrans · Xendit · Tripay' },
              ].map((api) => {
                const on = apiSwitches[api.id];
                return (
                  <button
                    key={api.id}
                    type="button"
                    onClick={() =>
                      setApiSwitches((prev) => ({
                        ...prev,
                        [api.id]: !prev[api.id],
                      }))
                    }
                    className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-[#0a0d11]/85 px-3.5 py-2.5 text-left transition hover:border-white/15"
                  >
                    <div>
                      <p className="text-[12px] font-semibold text-white">
                        {api.name}
                      </p>
                      <p className="text-[10px] text-zinc-500">{api.sub}</p>
                    </div>
                    <span
                      className={`size-2 rounded-full transition ${
                        on
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                          : 'bg-zinc-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </SpotlightCard>

          {/* Tile 3: Sosial & Kolega */}
          <SpotlightCard className="flex flex-col justify-between p-5 lg:col-span-3">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-cyan-400" />
                <h2 className="text-[14px] font-semibold text-white">
                  Sosial &amp; Kolega
                </h2>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
                Ringkasan grup, obrolan cepat, feed, pencarian kolega, dan
                berita pasar.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {['Grup', 'Fast Chat', 'Feed', 'Find', 'Berita'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-xl border border-white/[0.08] bg-[#0a0d11] px-2.5 py-1 text-[11px] font-medium text-zinc-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </SpotlightCard>
        </motion.section>

        {/* Minimalist Release Rail: v3.0 Live + Next TBA */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.35 }}
          className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="flex items-center justify-between gap-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.04] px-6 py-4">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                v3.0 · LIVE
              </span>
              <p className="mt-0.5 text-[13px] font-medium text-zinc-200">
                Multi-ruang kas · Valas &amp; crypto · OCR struk · Koneksi API
              </p>
            </div>
            <span className="size-2 shrink-0 rounded-full bg-emerald-400" />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/[0.07] bg-[#0f1419]/80 px-6 py-4">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                NEXT PHASE
              </span>
              <p className="mt-0.5 font-mono text-[13px] font-semibold text-zinc-300">
                TBA
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] text-zinc-400">
              <Lock className="size-3" />
              PRIVATE
            </span>
          </div>
        </motion.section>
      </main>

      {/* Footer Profesional */}
      <footer className="border-t border-white/[0.07] bg-[#080c10]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
            {/* Brand */}
            <div className="space-y-3 lg:col-span-5">
              <div className="flex items-center gap-2.5">
                <BrandLogo size={30} />
                <span className="text-[15px] font-bold tracking-tight text-white">
                  stashinmeid
                </span>
              </div>
              <p className="max-w-xs text-[12px] leading-relaxed text-zinc-400">
                Buku kas pribadi, ruang grup kolega, dan pelacak aset digital
                dalam satu workspace.
              </p>
              <a
                href="mailto:hello@stashinmeid.app"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-400 transition hover:text-emerald-300"
              >
                <Mail className="size-3.5" />
                hello@stashinmeid.app
              </a>
            </div>

            {/* Produk */}
            <div className="space-y-2.5 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Produk
              </p>
              <ul className="space-y-2 text-[13px] text-zinc-400">
                <li>
                  <Link href="/demo" className="transition hover:text-white">
                    Coba Demo
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signin')}
                    className="transition hover:text-white"
                  >
                    Masuk
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signup')}
                    className="transition hover:text-white"
                  >
                    Daftar Akun
                  </button>
                </li>
              </ul>
            </div>

            {/* Komunitas & Kemitraan */}
            <div className="space-y-2.5 lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Kolaborasi
              </p>
              <ul className="space-y-2 text-[13px] text-zinc-400">
                <li>
                  <a
                    href="https://github.com/omeko42/stashinmeid"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 transition hover:text-white"
                  >
                    Contribute (GitHub)
                    <ArrowUpRight className="size-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:partner@stashinmeid.app?subject=Partnership%20stashinmeid"
                    className="inline-flex items-center gap-1 transition hover:text-white"
                  >
                    Become a Partner
                    <ArrowUpRight className="size-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/omeko42/stashinmeid/issues"
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-white"
                  >
                    Laporkan Bug &amp; Masukan
                  </a>
                </li>
              </ul>
            </div>

            {/* Kontak Perusahaan */}
            <div className="space-y-2.5 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Kontak
              </p>
              <ul className="space-y-2 text-[12px] text-zinc-400">
                <li>
                  <a
                    href="mailto:hello@stashinmeid.app"
                    className="transition hover:text-white"
                  >
                    hello@stashinmeid.app
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:partner@stashinmeid.app"
                    className="transition hover:text-white"
                  >
                    partner@stashinmeid.app
                  </a>
                </li>
                <li className="text-zinc-500">Indonesia · WIB</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-[12px] text-zinc-500 sm:flex-row">
            <span>© 2026 stashinmeid. All rights reserved.</span>
            <span>v3.0 · Built in Indonesia</span>
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
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="relative w-full max-w-md rounded-3xl border border-white/12 bg-[#10161c] p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                aria-label="Tutup modal"
                className="absolute right-5 top-5 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-white"
              >
                <X className="size-4" />
              </button>

              <div className="mb-5 flex items-center gap-3">
                <BrandLogo size={36} />
                <span className="text-base font-bold tracking-tight text-white">
                  stashinmeid
                </span>
              </div>

              {/* Sliding Tab Switcher */}
              <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-[#090c10] p-1">
                {[
                  { id: 'signin' as const, label: 'Masuk', signup: false },
                  { id: 'signup' as const, label: 'Daftar', signup: true },
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
                        active
                          ? 'text-[#06120d]'
                          : 'text-zinc-400 hover:text-white'
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
                      Password
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
                      placeholder="Min. 8 karakter, huruf & angka"
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
                          Bio (Opsional)
                        </label>
                        <input
                          id="signup-bio"
                          name="bio"
                          type="text"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Pekerjaan atau catatan singkat"
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
                    Passkey
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
