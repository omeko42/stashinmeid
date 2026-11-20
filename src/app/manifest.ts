import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'stashinmeid - Aplikasi Manajemen Keuanganmu',
    short_name: 'stashinmeid',
    description:
      'Catat inflow, outflow, cicilan debt, dan scan struk otomatis dengan AI.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0c1013',
    theme_color: '#0c1013',
    lang: 'id',
    dir: 'ltr',
    categories: ['finance', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192x192.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
