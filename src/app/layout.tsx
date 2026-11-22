import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const DEFAULT_SITE_URL = 'https://stashinme.biz.id';
const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      new URL(raw);
      return raw;
    } catch {
      // Fallback jika env tidak valid.
    }
  }
  return DEFAULT_SITE_URL;
})();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'stashinmeid - Aplikasi Manajemen Keuanganmu',
    template: '%s - stashinmeid',
  },
  description:
    'Catat inflow, outflow, cicilan pinjaman, dan scan struk otomatis dengan AI. Kelola keuangan pribadi dengan rapi.',
  applicationName: 'stashinmeid',
  authors: [{ name: 'omeko42' }],
  keywords: ['keuangan pribadi', 'cashflow', 'pinjaman', 'anggaran', 'stashinmeid'],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'stashinmeid',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    alternateLocale: 'en_US',
    url: SITE_URL,
    siteName: 'stashinmeid',
    title: 'stashinmeid - Aplikasi Manajemen Keuanganmu',
    description:
      'Catat inflow, outflow, cicilan pinjaman, dan scan struk otomatis dengan AI.',
    images: [
      {
        url: '/icon-192x192.png',
        width: 192,
        height: 192,
        alt: 'stashinmeid',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'stashinmeid - Aplikasi Manajemen Keuanganmu',
    description: 'Catat inflow, outflow, cicilan pinjaman, dan scan struk otomatis dengan AI.',
    images: ['/icon-192x192.png'],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // PWA standalone iPhone: hormati notch/safe-area kalau konten sampai tepi.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1013' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
