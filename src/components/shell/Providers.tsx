'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useLocale } from 'next-intl';
import { RegisterPwa } from './RegisterPwa';

/**
 * Provider global: tema (terang/gelap) dan toast.
 *
 * `next-themes` mencegah kilatan tema salah sebelum hydration selesai.
 * `sonner` menangani toast global untuk seluruh aplikasi.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useLocale();

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="stashinme-theme"
    >
      {children}
      <RegisterPwa />
      <Toaster
        position="bottom-right"
        richColors={false}
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'bg-[var(--surface-1)] text-[var(--text)] border border-[var(--line)] shadow-[var(--shadow-md)]',
            description: 'text-[var(--text-muted)]',
            actionButton: 'bg-[var(--brand)] text-[var(--brand-contrast)]',
            cancelButton: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
          },
        }}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
      />
    </ThemeProvider>
  );
}
