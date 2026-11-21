'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/BrandLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { Loader2, KeyRound, ArrowRight, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const locale = useLocale();
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [clientName, setClientName] = useState('Personal');
  const [bio, setBio] = useState('');

  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpStep, setSignUpStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  /** Token captcha Turnstile. Null = belum diselesaikan. */
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Captcha hanya diperlukan kalau widget-nya benar-benar terpasang.
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
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

    // Captcha wajib diselesaikan sebelum credentials dicek.
    if (captchaEnabled && !captchaToken) {
      setMessage({ type: 'error', text: t('auth.captchaRequired') });
      setLoading(false);
      return;
    }

    // Superadmin username login (no '@' in input)
    if (!isSignUp && !email.includes('@')) {
      // Jalur superadmin tidak lewat Supabase Auth, jadi captcha
      // diverifikasi manual lewat endpoint khusus.
      if (captchaEnabled) {
        const capRes = await fetch('/api/auth/captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: captchaToken }),
        });
        if (!capRes.ok) {
          const capJson = await capRes.json().catch(() => ({}));
          setMessage({
            type: 'error',
            text: capJson.error || 'Verifikasi captcha gagal.',
          });
          setLoading(false);
          return;
        }
      }

      const res = await fetch('/api/auth/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error || 'Login gagal.' });
      } else {
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
        text: 'Supabase belum dikonfigurasi di .env.local. Kamu bisa langsung pakai mode Demo di halaman utama.',
      });
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // GoTrue memverifikasi token captcha ini di sisi server.
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
        setMessage({ type: 'error', text: t('errors.generic') });
      } else {
        setMessage({
          type: 'success',
          text: 'Akun berhasil dibuat! Cek email untuk verifikasi atau langsung masuk.',
        });
        setIsSignUp(false);
        setSignUpStep(1);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: captchaToken ?? undefined },
      });
      if (error) {
        setMessage({ type: 'error', text: t('errors.generic') });
      } else {
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

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    if (!supabase) {
      setMessage({ type: 'error', text: 'Supabase belum dikonfigurasi.' });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setMessage({ type: 'error', text: error.message });
  };

  const handlePasskeyLogin = async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setMessage({ type: 'error', text: 'Browser ini belum mendukung Passkeys (WebAuthn).' });
      return;
    }
    setMessage({
      type: 'error',
      text: 'Passkey WebAuthn siap di browser. Aktifkan WebAuthn/Passkeys di Supabase Auth untuk menghubungkan ke akun.',
    });
  };

  return (
    <div className="relative min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 overflow-hidden">
      {/* Ambient Emerald-Teal Glassmorphism Glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-teal-500/15 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md bg-zinc-900/75 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3.5 mb-7">
          <BrandLogo size={44} />
          <div>
            <h1 className="text-xl font-bold tracking-tight lowercase text-white">stashinmeid</h1>
            <p className="text-xs text-zinc-400">aplikasi manajemen keuanganmu</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-1">
          {isSignUp
            ? signUpStep === 1
              ? 'Buat Akun Baru (Step 1/2)'
              : 'Lengkapi Bio (Step 2/2)'
            : 'Masuk ke Akun'}
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          {isSignUp
            ? signUpStep === 1
              ? 'Masukkan email dan buat password yang kuat.'
              : 'Lengkapi data diri dan nama workspace client-mu.'
            : 'Kelola keuangan pribadi dengan aman.'}
        </p>

        {message && (
          <div
            className={`mb-4 p-3 rounded-xl text-sm border ${
              message.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {isSignUp && signUpStep === 1 ? (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Password (min. 8 karakter, huruf & angka)
              </label>
              <PasswordInput
                unstyled
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Ulangi Password
              </label>
              <PasswordInput
                unstyled
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              Lanjut Lengkapi Bio <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nama lengkap kamu"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Nama Client / Workspace
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Personal / PT Maju"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Bio Singkat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Contoh: Freelancer / Karyawan Swasta"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {captchaEnabled && (
                  <div className="pt-1">
                    <TurnstileWidget onToken={setCaptchaToken} theme="dark" />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSignUpStep(1)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm flex items-center gap-1.5 transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Daftar Sekarang
                  </button>
                </div>              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Email atau Username
                  </label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com / username"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-400">Password</label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Lupa Password?
                    </button>
                  </div>
                  <PasswordInput
                    unstyled
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {captchaEnabled && (
                  <div className="pt-1">
                    <TurnstileWidget onToken={setCaptchaToken} theme="dark" />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Masuk
                </button>
              </>
            )}
          </form>
        )}

        {!isSignUp && (
          <div className="mt-4 space-y-2.5">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800" />
              <span className="shrink mx-3 text-xs text-slate-500">atau</span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              Lanjutkan dengan Google
            </button>

            <button
              type="button"
              onClick={handlePasskeyLogin}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-emerald-400" />
              Login dengan Passkey
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setSignUpStep(1);
              setMessage(null);
            }}
            className="text-sm text-slate-400 hover:text-emerald-400 transition"
          >
            {isSignUp ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
