import { defineRouting } from 'next-intl/routing';

export const locales = ['id', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'id';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // `as-needed` = URL tetap polos (/) untuk bahasa default, dan prefix /en
  // hanya dipakai untuk bahasa non-default. Ini menjaga URL lama tetap valid.
  localePrefix: 'as-needed',
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  },
});

export const localeLabels: Record<Locale, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
};

export const localeShortLabels: Record<Locale, string> = {
  id: 'ID',
  en: 'EN',
};
