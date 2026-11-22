'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bitcoin,
  Building2,
  Check,
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
import { LocaleSwitcher } from '@/components/shell/LocaleSwitcher';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { MEMBERSHIP_PLANS, type MembershipTier } from '@/lib/membership';
import { formatRp } from '@/lib/format';

interface LandingPageProps {
  defaultModalOpen?: boolean;
  defaultMode?: 'signin' | 'signup';
}

interface TickerItem {
  sym: string;
  price: string;
  delta: string;
  up: boolean;
}

const BASE_CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD'] as const;
type BaseCurrency = (typeof BASE_CURRENCIES)[number];

const FALLBACK_TICKERS: Record<BaseCurrency, TickerItem[]> = {
  IDR: [
    { sym: 'BTC/IDR', price: 'Rp 1,54 M', delta: '+2.4%', up: true },
    { sym: 'ETH/IDR', price: 'Rp 49,3 Jt', delta: '+1.8%', up: true },
    { sym: 'SOL/IDR', price: 'Rp 3,42 Jt', delta: '+4.1%', up: true },
    { sym: 'USDT/IDR', price: 'Rp 15.870', delta: '+0.1%', up: true },
    { sym: 'USD/IDR', price: 'Rp 15.865', delta: 'ECB', up: true },
    { sym: 'EUR/IDR', price: 'Rp 16.920', delta: 'ECB', up: true },
    { sym: 'SGD/IDR', price: 'Rp 11.820', delta: 'ECB', up: true },
  ],
  USD: [
    { sym: 'BTC/USD', price: '$97,200', delta: '+2.4%', up: true },
    { sym: 'ETH/USD', price: '$3,110', delta: '+1.8%', up: true },
    { sym: 'SOL/USD', price: '$216.00', delta: '+4.1%', up: true },
    { sym: 'EUR/USD', price: '$1.07', delta: 'ECB', up: true },
    { sym: 'GBP/USD', price: '$1.27', delta: 'ECB', up: true },
    { sym: 'SGD/USD', price: '$0.74', delta: 'ECB', up: true },
    { sym: 'IDR/USD', price: '$0.0001', delta: 'ECB', up: true },
  ],
  EUR: [
    { sym: 'BTC/EUR', price: '€91,100', delta: '+2.4%', up: true },
    { sym: 'ETH/EUR', price: '€2,915', delta: '+1.8%', up: true },
    { sym: 'USD/EUR', price: '€0.94', delta: 'ECB', up: true },
    { sym: 'GBP/EUR', price: '€1.19', delta: 'ECB', up: true },
    { sym: 'SGD/EUR', price: '€0.70', delta: 'ECB', up: true },
  ],
  SGD: [
    { sym: 'BTC/SGD', price: 'S$130,400', delta: '+2.4%', up: true },
    { sym: 'ETH/SGD', price: 'S$4,170', delta: '+1.8%', up: true },
    { sym: 'USD/SGD', price: 'S$1.34', delta: 'ECB', up: true },
    { sym: 'EUR/SGD', price: 'S$1.43', delta: 'ECB', up: true },
    { sym: 'GBP/SGD', price: 'S$1.70', delta: 'ECB', up: true },
  ],
};

function getDemoScopes(isEn: boolean) {
  if (isEn) {
    return {
      personal: {
        label: 'Personal',
        balance: '$3,150.00',
        inflow: '+$1,240',
        outflow: '-$410',
        debtLabel: 'Mortgage · Due 25th',
        debtAmount: '$210/mo',
        bars: [
          { m: 'May', h: 36, val: '$1,580' },
          { m: 'Jun', h: 48, val: '$1,910' },
          { m: 'Jul', h: 42, val: '$1,790' },
          { m: 'Aug', h: 64, val: '$2,290' },
          { m: 'Sep', h: 58, val: '$2,180' },
          { m: 'Oct', h: 78, val: '$2,760' },
          { m: 'Nov', h: 94, val: '$3,150' },
        ],
      },
      company: {
        label: 'Acme Corp',
        balance: '$20,840.00',
        inflow: '+$9,120',
        outflow: '-$3,450',
        debtLabel: 'Cloud Vendor · Due 15th',
        debtAmount: '$1,180/mo',
        bars: [
          { m: 'May', h: 50, val: '$12.1k' },
          { m: 'Jun', h: 62, val: '$14.0k' },
          { m: 'Jul', h: 74, val: '$15.7k' },
          { m: 'Aug', h: 68, val: '$14.9k' },
          { m: 'Sep', h: 84, val: '$17.9k' },
          { m: 'Oct', h: 90, val: '$19.4k' },
          { m: 'Nov', h: 100, val: '$20.8k' },
        ],
      },
      family: {
        label: 'Family',
        balance: '$1,480.00',
        inflow: '+$780',
        outflow: '-$260',
        debtLabel: 'No active loans',
        debtAmount: '$0',
        bars: [
          { m: 'May', h: 40, val: '$810' },
          { m: 'Jun', h: 46, val: '$920' },
          { m: 'Jul', h: 50, val: '$1,020' },
          { m: 'Aug', h: 62, val: '$1,160' },
          { m: 'Sep', h: 58, val: '$1,110' },
          { m: 'Oct', h: 72, val: '$1,320' },
          { m: 'Nov', h: 82, val: '$1,480' },
        ],
      },
    } as const;
  }

  return {
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
}

type DemoScopeKey = 'personal' | 'company' | 'family';

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

/** Logo-logo partner infrastruktur (monokrom halus, terang saat hover). */
function PartnerLogoStrip() {
  return (
    <section
      aria-label="Technology Partners"
      className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 rounded-3xl border border-white/[0.06] bg-[#0d1217]/70 px-6 py-6 sm:gap-x-14">
        {/* GitHub */}
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          title="GitHub"
          className="text-zinc-500 transition hover:text-white"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.66.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
          </svg>
        </a>

        {/* Vercel */}
        <a
          href="https://vercel.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Vercel"
          title="Vercel"
          className="text-zinc-500 transition hover:text-white"
        >
          <svg className="h-5 w-6" viewBox="0 0 24 22" fill="currentColor" aria-hidden="true">
            <path d="M12 0L24 21.5H0L12 0Z" />
          </svg>
        </a>

        {/* Supabase */}
        <a
          href="https://supabase.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Supabase"
          title="Supabase"
          className="text-zinc-500 transition hover:text-emerald-400"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13.6 22.8c-.6.8-1.9.3-1.9-.7V13h9.1c1 0 1.6 1.2.9 2l-8.1 7.8Z" />
            <path d="M10.4 1.2c.6-.8 1.9-.3 1.9.7V11H3.2c-1 0-1.6-1.2-.9-2l8.1-7.8Z" opacity="0.65" />
          </svg>
        </a>

        {/* Cloudflare */}
        <a
          href="https://www.cloudflare.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Cloudflare"
          title="Cloudflare"
          className="text-zinc-500 transition hover:text-amber-400"
        >
          <svg className="h-6 w-9" viewBox="0 0 36 24" fill="currentColor" aria-hidden="true">
            <path d="M26.8 18.5H9.2a4.6 4.6 0 0 1-.8-9.1 7.2 7.2 0 0 1 13.7-2.2 5.4 5.4 0 0 1 7.6 4.9c0 .3 0 .6-.1.9a3.2 3.2 0 0 1-2.8 5.5Z" />
          </svg>
        </a>

        {/* Google */}
        <a
          href="https://cloud.google.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Google"
          title="Google"
          className="text-zinc-500 transition hover:text-white"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6Z" />
            <path d="M12 22c2.8 0 5.1-.9 6.8-2.5l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.8v2.7A10 10 0 0 0 12 22Z" opacity="0.85" />
            <path d="M6.2 13.6a6 6 0 0 1 0-3.2V7.7H2.8a10 10 0 0 0 0 8.6l3.4-2.7Z" opacity="0.7" />
            <path d="M12 6.1c1.5 0 2.9.5 3.9 1.5l2.9-2.9A10 10 0 0 0 2.8 7.7l3.4 2.7c.8-2.5 3.1-4.3 5.8-4.3Z" opacity="0.9" />
          </svg>
        </a>
      </div>
    </section>
  );
}

export function LandingPage({
  defaultModalOpen = false,
  defaultMode = 'signin',
}: LandingPageProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const t = useTranslations();
  const router = useRouter();

  const [authModalOpen, setAuthModalOpen] = useState(defaultModalOpen);
  const [demoScope, setDemoScope] = useState<DemoScopeKey>('personal');
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency>(
    isEn ? 'USD' : 'IDR'
  );
  const [liveMarket, setLiveMarket] = useState<TickerItem[]>(
    FALLBACK_TICKERS[isEn ? 'USD' : 'IDR']
  );
  const [marketLiveOk, setMarketLiveOk] = useState(false);
  const [apiSwitches, setApiSwitches] = useState<Record<string, boolean>>({
    news: true,
    kyc: true,
    payment: true,
  });

  const fetchLiveMarket = useCallback(async (base: BaseCurrency) => {
    try {
      const res = await fetch(`/api/market-news?base=${base}&news=0`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.tickers) && json.tickers.length > 0) {
        setLiveMarket(
          json.tickers.map(
            (tk: { sym: string; price: string; delta: string; up: boolean }) => ({
              sym: tk.sym,
              price: tk.price,
              delta: tk.delta,
              up: tk.up,
            })
          )
        );
        setMarketLiveOk(true);
      }
    } catch {
      // Fallback tetap tampil
    }
  }, []);

  useEffect(() => {
    setLiveMarket(FALLBACK_TICKERS[baseCurrency]);
    void fetchLiveMarket(baseCurrency);
    const interval = setInterval(() => {
      void fetchLiveMarket(baseCurrency);
    }, 60_000);
    return () => clearInterval(interval);
  }, [baseCurrency, fetchLiveMarket]);

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
        setMessage({
          type: 'error',
          text: json.error || (isEn ? 'Sign in failed.' : 'Login gagal.'),
        });
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
        text: isEn
          ? 'Supabase is not configured.'
          : 'Supabase belum dikonfigurasi.',
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
            membership_tier: 'free',
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
          text: isEn
            ? 'Account created. Check your email or sign in now.'
            : 'Akun dibuat. Cek email untuk verifikasi atau langsung masuk.',
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
        text: isEn
          ? 'Enter your email first, then click Forgot Password.'
          : 'Isi email dulu, lalu klik Lupa Password.',
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
        text: isEn
          ? `Reset link sent to ${email}.`
          : `Link reset dikirim ke ${email}.`,
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

  const demoScopes = getDemoScopes(isEn);
  const currentDemo = demoScopes[demoScope];

  const assetsSample = isEn
    ? [
        { code: 'BTC', amount: '0.085 BTC', val: '$8,260', pct: 58 },
        { code: 'USDT', amount: '3,200 USDT', val: '$3,200', pct: 24 },
        { code: 'EUR', amount: '€2,100', val: '$2,240', pct: 18 },
      ]
    : [
        { code: 'BTC', amount: '0,085 BTC', val: 'Rp 131,1 Jt', pct: 58 },
        { code: 'USDT', amount: '3.200 USDT', val: 'Rp 50,7 Jt', pct: 24 },
        { code: 'USD', amount: '$2.450', val: 'Rp 38,8 Jt', pct: 18 },
      ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0b0f13] text-[#e8eef1] selection:bg-emerald-500/25 selection:text-emerald-200">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_65%_45%_at_50%_-15%,rgba(34,197,139,0.13),transparent)]"
      />

      {/* Minimal Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b0f13]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={32} />
            <span className="text-[16px] font-bold tracking-tight text-white">
              stashinmeid
            </span>
          </div>

          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Link
              href="/demo"
              className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white sm:inline-flex"
            >
              <FlaskConical className="size-3.5 text-emerald-400" />
              {isEn ? 'Try Demo' : 'Coba Demo'}
            </Link>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => openAuthModal('signin')}
              className="rounded-xl px-3 py-2 text-[12px] font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
            >
              {isEn ? 'Sign In' : 'Masuk'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => openAuthModal('signup')}
              className="inline-flex items-center gap-1 rounded-xl bg-[#22c58b] px-3.5 py-2 text-[12px] font-semibold text-[#06120d] transition hover:bg-[#35d69c]"
            >
              {isEn ? 'Sign Up' : 'Daftar'}
              <ArrowUpRight className="size-3.5" />
            </motion.button>
          </div>
        </div>

        {/* Live Auto-Scrolling Market Strip dengan Pilihan Mata Uang Dasar */}
        <div className="border-t border-white/[0.05] bg-[#080c10]">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5 sm:px-6">
            <div className="flex shrink-0 items-center gap-2 border-r border-white/10 pr-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold text-emerald-400">
                <span
                  className={`size-1.5 rounded-full bg-emerald-400 ${
                    marketLiveOk ? 'animate-pulse' : ''
                  }`}
                />
                LIVE
              </span>
              <label htmlFor="landing-base-currency" className="sr-only">
                Base currency
              </label>
              <select
                id="landing-base-currency"
                name="landingBaseCurrency"
                value={baseCurrency}
                onChange={(e) =>
                  setBaseCurrency(e.target.value as BaseCurrency)
                }
                className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-200 focus:border-emerald-400 focus:outline-none"
              >
                {BASE_CURRENCIES.map((c) => (
                  <option key={c} value={c} className="bg-[#0b0f13]">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-0 flex-1 overflow-hidden">
              <div className="market-marquee flex w-max items-center text-[11px]">
                {[0, 1].map((trackIdx) => (
                  <div
                    key={trackIdx}
                    aria-hidden={trackIdx === 1 ? true : undefined}
                    className="flex shrink-0 items-center gap-6 pr-6"
                  >
                    {liveMarket.map((m) => (
                      <span
                        key={`${trackIdx}-${m.sym}`}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
                      >
                        <span className="font-semibold text-zinc-200">
                          {m.sym}
                        </span>
                        <span className="tnum text-zinc-400">{m.price}</span>
                        <span
                          className={`tnum font-medium ${
                            m.up ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {m.delta}
                        </span>
                        <span className="ml-3 text-white/15">·</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Stage */}
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left: Clean Headline & CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-6 lg:col-span-5"
          >
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-[48px]">
              {isEn
                ? 'Cash, groups, and digital assets.'
                : 'Kas, grup, dan aset digital.'}
            </h1>

            <p className="max-w-md text-[15px] leading-relaxed text-zinc-400">
              {isEn
                ? 'Keep personal, family, and company finances separate. Track cash, bank, FX, and crypto in one screen.'
                : 'Pisahkan keuangan pribadi, keluarga, dan bisnis. Pantau saldo fisik, bank, valas, sampai crypto dari satu layar.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#22c58b] px-6 py-3 text-[13px] font-semibold text-[#06120d] shadow-lg shadow-emerald-500/15 transition hover:bg-[#35d69c]"
              >
                {isEn ? 'Start Free' : 'Mulai Gratis'}
                <ArrowRight className="size-4" />
              </motion.button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => openAuthModal('signin')}
                className="rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-3 text-[13px] font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                {isEn ? 'Sign In' : 'Masuk'}
              </motion.button>
              <Link
                href="/demo"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-3 text-[13px] font-semibold text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/15"
              >
                <FlaskConical className="size-3.5" />
                {isEn ? 'Try Demo' : 'Coba Demo'}
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-4">
                <div className="flex rounded-xl border border-white/[0.08] bg-[#0a0d11] p-1">
                  {(['personal', 'company', 'family'] as DemoScopeKey[]).map(
                    (key) => {
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
                            {demoScopes[key].label}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
                <span className="font-mono text-[11px] text-zinc-500">
                  {isEn ? 'Interactive preview' : 'Interaktif · Klik ruang'}
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${locale}-${demoScope}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="mt-5 space-y-5"
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                        {isEn ? 'Total Balance' : 'Total Saldo'}
                      </p>
                      <p className="tnum mt-1 text-3xl font-bold tracking-tight text-white">
                        {currentDemo.balance}
                      </p>
                    </div>
                    <div className="flex gap-5 text-right text-[12px]">
                      <div>
                        <p className="text-[10px] uppercase text-zinc-500">
                          {isEn ? 'Inflow' : 'Masuk'}
                        </p>
                        <p className="tnum font-semibold text-emerald-400">
                          {currentDemo.inflow}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-zinc-500">
                          {isEn ? 'Outflow' : 'Keluar'}
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
                              animate={{
                                height: `${Math.round(bar.h * 0.62)}px`,
                              }}
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
          {/* Tile 1: FX & Crypto */}
          <SpotlightCard className="p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bitcoin className="size-4 text-amber-400" />
                <h2 className="text-[14px] font-semibold text-white">
                  {isEn ? 'FX & Crypto' : 'Valas & Crypto'}
                </h2>
              </div>
              <span className="font-mono text-[10px] text-emerald-400">
                {isEn ? 'Live Rates' : 'Kurs Live'}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {assetsSample.map((a) => (
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
                      {a.val}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* Tile 2: API Connectors */}
          <SpotlightCard className="p-5 lg:col-span-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plug className="size-4 text-emerald-400" />
                <h2 className="text-[14px] font-semibold text-white">
                  {isEn ? 'API Connectors' : 'Koneksi API'}
                </h2>
              </div>
              <span className="font-mono text-[10px] text-zinc-400">
                {isEn ? 'Free · Modular' : 'Gratis · Modular'}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {[
                {
                  id: 'news',
                  name: isEn ? 'Live News & FX' : 'Berita & Kurs Live',
                  sub: 'CoinGecko · ECB · RSS',
                },
                {
                  id: 'kyc',
                  name: isEn ? 'Identity KYC' : 'Verifikasi KYC',
                  sub: 'Didit.me · Verihubs',
                },
                {
                  id: 'payment',
                  name: isEn ? 'Payments' : 'Pembayaran',
                  sub: 'Midtrans · Xendit · Tripay',
                },
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

          {/* Tile 3: Social & Colleagues */}
          <SpotlightCard className="flex flex-col justify-between p-5 lg:col-span-3">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-cyan-400" />
                <h2 className="text-[14px] font-semibold text-white">
                  {isEn ? 'Social & Groups' : 'Sosial & Kolega'}
                </h2>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
                {isEn
                  ? 'Group summaries, fast chat, feed, colleague finder, and market news.'
                  : 'Ringkasan grup, obrolan cepat, feed, cari kolega, dan berita pasar.'}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {(isEn
                ? ['Groups', 'Fast Chat', 'Feed', 'Find', 'News']
                : ['Grup', 'Fast Chat', 'Feed', 'Find', 'Berita']
              ).map((tag) => (
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

        {/* Membership Plans (Free 3 Groups · Pro 5 Groups · Enterprise 9 Groups) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4 }}
          className="mt-14"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white sm:text-xl">
                {isEn ? 'Membership Plans' : 'Paket Membership'}
              </h2>
              <p className="mt-0.5 text-[12px] text-zinc-400">
                {isEn
                  ? 'Start free with up to 3 groups, upgrade anytime.'
                  : 'Mulai gratis hingga 3 grup, upgrade kapan saja.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(['free', 'pro', 'enterprise'] as MembershipTier[]).map(
              (tierId) => {
                const plan = MEMBERSHIP_PLANS[tierId];
                const highlight = tierId === 'pro';
                const price = isEn
                  ? plan.priceUsd === 0
                    ? '$0'
                    : `$${plan.priceUsd}/mo`
                  : plan.priceIdr === 0
                    ? 'Rp 0'
                    : `${formatRp(plan.priceIdr)}/bln`;

                return (
                  <SpotlightCard
                    key={tierId}
                    className={`p-5 ${
                      highlight ? 'border-emerald-500/40' : ''
                    }`}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-semibold text-white">
                            {isEn ? plan.labelEn : plan.labelId}
                          </span>
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                            {isEn ? plan.badgeEn : plan.badgeId}
                          </span>
                        </div>
                        <p className="tnum mt-2 text-2xl font-bold text-white">
                          {price}
                        </p>
                        <p className="mt-1 text-[12px] text-zinc-400">
                          {isEn ? plan.summaryEn : plan.summaryId}
                        </p>

                        <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3 text-[12px] text-zinc-300">
                          {(isEn ? plan.featuresEn : plan.featuresId).map(
                            (f) => (
                              <li key={f} className="flex items-start gap-2">
                                <Check className="mt-0.5 size-3.5 shrink-0 text-[#22c58b]" />
                                <span>{f}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAuthModal('signup')}
                        className={`mt-5 w-full rounded-xl py-2.5 text-[12px] font-semibold transition ${
                          highlight
                            ? 'bg-[#22c58b] text-[#06120d] hover:bg-[#35d69c]'
                            : 'border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.09]'
                        }`}
                      >
                        {tierId === 'free'
                          ? isEn
                            ? 'Start Free'
                            : 'Mulai Gratis'
                          : isEn
                            ? `Choose ${plan.labelEn}`
                            : `Pilih ${plan.labelId}`}
                      </button>
                    </div>
                  </SpotlightCard>
                );
              }
            )}
          </div>
        </motion.section>

        {/* Minimalist Release Rail: v3.0 Live + Next TBA */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.35 }}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="flex items-center justify-between gap-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.04] px-6 py-4">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                v3.0 · LIVE
              </span>
              <p className="mt-0.5 text-[13px] font-medium text-zinc-200">
                {isEn
                  ? 'Multi-group cashflow · FX & crypto · OCR · API hub'
                  : 'Multi-ruang kas · Valas & crypto · OCR struk · Koneksi API'}
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

      {/* Partner Infrastructure Logos (Logo-only above Footer) */}
      <PartnerLogoStrip />

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
                {isEn
                  ? 'Personal cashbook, shared group workspaces, and digital asset tracker.'
                  : 'Buku kas pribadi, ruang grup kolega, dan pelacak aset digital dalam satu workspace.'}
              </p>
              <a
                href="mailto:stashinmeid@gmail.com"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-400 transition hover:text-emerald-300"
              >
                <Mail className="size-3.5" />
                stashinmeid@gmail.com
              </a>
            </div>

            {/* Produk */}
            <div className="space-y-2.5 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {isEn ? 'Product' : 'Produk'}
              </p>
              <ul className="space-y-2 text-[13px] text-zinc-400">
                <li>
                  <Link href="/demo" className="transition hover:text-white">
                    {isEn ? 'Try Demo' : 'Coba Demo'}
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signin')}
                    className="transition hover:text-white"
                  >
                    {isEn ? 'Sign In' : 'Masuk'}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openAuthModal('signup')}
                    className="transition hover:text-white"
                  >
                    {isEn ? 'Sign Up' : 'Daftar Akun'}
                  </button>
                </li>
              </ul>
            </div>

            {/* Komunitas & Kemitraan */}
            <div className="space-y-2.5 lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {isEn ? 'Collaborate' : 'Kolaborasi'}
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
                    href="mailto:stashinmeid@gmail.com?subject=Partnership%20stashinmeid"
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
                    {isEn ? 'Report Issue' : 'Laporkan Bug & Masukan'}
                  </a>
                </li>
              </ul>
            </div>

            {/* Kontak Perusahaan */}
            <div className="space-y-2.5 lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {isEn ? 'Contact' : 'Kontak'}
              </p>
              <ul className="space-y-2 text-[12px] text-zinc-400">
                <li>
                  <a
                    href="mailto:stashinmeid@gmail.com"
                    className="transition hover:text-white"
                  >
                    stashinmeid@gmail.com
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:stashinmeid@gmail.com?subject=Partnership%20stashinmeid"
                    className="transition hover:text-white"
                  >
                    {isEn ? 'Partnerships' : 'Kemitraan & Media'}
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
            aria-label={isSignUp ? 'Sign Up' : 'Sign In'}
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
                aria-label="Close modal"
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
                  {
                    id: 'signin' as const,
                    label: isEn ? 'Sign In' : 'Masuk',
                    signup: false,
                  },
                  {
                    id: 'signup' as const,
                    label: isEn ? 'Sign Up' : 'Daftar',
                    signup: true,
                  },
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
                      placeholder="name@email.com"
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
                      placeholder={
                        isEn
                          ? 'Min. 8 chars, letters & numbers'
                          : 'Min. 8 karakter, huruf & angka'
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-confirm-password"
                      className="mb-1.5 block text-xs font-medium text-zinc-400"
                    >
                      {isEn ? 'Confirm Password' : 'Ulangi Password'}
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
                    {isEn ? 'Continue' : 'Lanjut'}{' '}
                    <ArrowRight className="size-4" />
                  </button>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-white/10" />
                    <span className="mx-3 shrink text-xs text-zinc-500">
                      {isEn ? 'or' : 'atau'}
                    </span>
                    <div className="flex-grow border-t border-white/10" />
                  </div>

                  <GoogleButton
                    label={isEn ? 'Continue with Google' : 'Daftar dengan Google'}
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
                          {isEn ? 'Full Name' : 'Nama Lengkap'}
                        </label>
                        <input
                          id="signup-full-name"
                          name="fullName"
                          type="text"
                          autoComplete="name"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder={isEn ? 'Your name' : 'Nama lengkap'}
                          className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="signup-client-name"
                          className="mb-1.5 block text-xs font-medium text-zinc-400"
                        >
                          {isEn ? 'Workspace Name' : 'Nama Workspace'}
                        </label>
                        <input
                          id="signup-client-name"
                          name="clientName"
                          type="text"
                          autoComplete="organization"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder={isEn ? 'Personal / Company' : 'Personal / Nama Tim'}
                          className="w-full rounded-xl border border-white/10 bg-[#090c10] px-3.5 py-2.5 text-sm text-white focus:border-[#22c58b] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="signup-bio"
                          className="mb-1.5 block text-xs font-medium text-zinc-400"
                        >
                          {isEn ? 'Short Bio (Optional)' : 'Bio (Opsional)'}
                        </label>
                        <input
                          id="signup-bio"
                          name="bio"
                          type="text"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder={isEn ? 'Role or short note' : 'Pekerjaan atau catatan singkat'}
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
                          <ArrowLeft className="size-4" />{' '}
                          {isEn ? 'Back' : 'Kembali'}
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#22c58b] py-2.5 text-sm font-semibold text-[#06120d] transition hover:bg-[#35d69c] disabled:opacity-50"
                        >
                          {loading && (
                            <Loader2 className="size-4 animate-spin" />
                          )}
                          {isEn ? 'Create Account' : 'Buat Akun'}
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
                          {isEn ? 'Email or Username' : 'Email atau Username'}
                        </label>
                        <input
                          id="login-identifier"
                          name="identifier"
                          type="text"
                          autoComplete="username"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={
                            isEn ? 'name@email.com / username' : 'nama@email.com / username'
                          }
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
                            {isEn ? 'Forgot Password?' : 'Lupa Password?'}
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
                        {isEn ? 'Sign In' : 'Masuk'}
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
                      {isEn ? 'or' : 'atau'}
                    </span>
                    <div className="flex-grow border-t border-white/10" />
                  </div>

                  <GoogleButton
                    label={isEn ? 'Continue with Google' : undefined}
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
