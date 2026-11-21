'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          'timeout-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          appearance?: 'always' | 'execute' | 'interaction-only';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  /** Callback dipanggil dengan token kalau captcha berhasil. */
  onToken: (token: string | null) => void;
  /** Server key untuk render explicit (opsional, dipakai untuk reset). */
  widgetId?: string;
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Widget Cloudflare Turnstile.
 *
 * Script dimuat manual (bukan via next/script) supaya bisa menunggu
 * `window.turnstile` siap sebelum merender - kalau render duluan, widget
 * tidak muncul.
 *
 * Kalau `NEXT_PUBLIC_TURNSTILE_SITE_KEY` belum diset, widget tidak
 * dirender sama sekali dan form tetap bisa dipakai (mode development).
 */
export function TurnstileWidget({
  onToken,
  theme = 'dark',
}: TurnstileWidgetProps) {
  const t = useTranslations('auth');
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  useEffect(() => {
    if (!siteKey) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => {
          setFailed(false);
          onToken(token);
        },
        'expired-callback': () => onToken(null),
        'error-callback': () => {
          setFailed(true);
          onToken(null);
        },
        'timeout-callback': () => onToken(null),
      });
      setLoading(false);
    };

    // Script mungkin sudah ada (hot reload di dev).
    if (window.turnstile) {
      render();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-stashinmeid-turnstile]'
    );

    if (existing) {
      existing.addEventListener('load', render);
      // Script sudah dimuat tapi mungkin belum selesai dieksekusi.
      const poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll);
          render();
        }
      }, 100);
      return () => {
        clearInterval(poll);
        existing.removeEventListener('load', render);
      };
    }

    const script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.stashinmeidTurnstile = 'true';
    script.addEventListener('load', render);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener('load', render);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, onToken]);

  if (!siteKey) return null;

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[65px]" />
      {loading && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-faint)]">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          <span>{t('captchaLoading')}</span>
        </div>
      )}
      {failed && (
        <p className="text-[12px] text-[var(--out)]">{t('captchaFailed')}</p>
      )}
    </div>
  );
}
