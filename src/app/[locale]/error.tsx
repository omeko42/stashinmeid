'use client';

import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Error boundary untuk area locale.
 *
 * Tanpa boundary, error saat render di server bikin Next.js tampilkan
 * halaman "This page couldn't load" yang kosong - user tidak tahu apa
 * yang salah dan tidak punya jalan keluar selain refresh.
 *
 * Boundary ini menangkap error itu dan menampilkan pesan yang bisa
 * ditindaklanjuti: reload, atau kembali ke login.
 *
 * Catatan: `reset` hanya berfungsi untuk error yang terjadi di client.
 * Error di server butuh full reload - itu sebabnya ada tombol reload
 * dan bukan sekadar `reset()`.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log ke console supaya mudah dicek saat development.
    console.error('[stashinmeid] render error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-1)] p-6 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--out)]/10 text-[var(--out)]">
          <TriangleAlert className="size-6" aria-hidden />
        </div>

        <h1 className="text-[17px] font-semibold text-[var(--text)]">
          Halaman gagal dimuat
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
          Ada kesalahan saat merender halaman ini. Coba muat ulang dulu -
          kalau masih gagal, error ini akan muncul di log server.
        </p>

        {error.digest && (
          <p className="mt-3 break-all rounded-lg bg-[var(--surface-2)] px-3 py-2 font-mono text-[10px] text-[var(--text-faint)]">
            digest: {error.digest}
          </p>
        )}

        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="secondary"
            onClick={() => reset()}
            icon={<RotateCcw className="size-3.5" />}
          >
            Coba lagi
          </Button>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-contrast)] transition hover:opacity-90"
          >
            Ke halaman login
          </Link>
        </div>
      </div>
    </div>
  );
}
