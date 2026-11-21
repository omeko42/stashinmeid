'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';

/**
 * Tombol "Lanjutkan dengan Google".
 *
 * Dipakai di halaman login DAN signup. Supabase yang mengurus sisanya:
 * kalau email-nya belum terdaftar, akun otomatis dibuat (signup via
 * Google). Karena itu tombol yang sama bisa dipakai untuk dua keperluan.
 *
 * Redirect balik ke /auth/callback, yang menukar kode PKCE dengan
 * session.
 */
export function GoogleButton({
  className,
  label = 'Lanjutkan dengan Google',
  onError,
}: {
  className?: string;
  label?: string;
  onError?: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        onError?.('Supabase belum dikonfigurasi.');
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error) {
        onError?.(error.message);
        return;
      }

      // Kalau tidak ada error, browser diarahkan ke halaman Google.
      // Jangan set loading false - halaman sedang dimuat.
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Gagal masuk dengan Google.');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'w-full py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50',
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3.02h3.86c2.26-2.09 3.56-5.17 3.56-8.89z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.08 7.93-2.91l-3.86-3.02c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.28a12 12 0 0 0 0 10.72l3.99-3.09z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.64l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75z"
          />
        </svg>
      )}
      {label}
    </button>
  );
}
