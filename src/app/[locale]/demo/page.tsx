import type { Locale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import { setRequestLocale } from 'next-intl/server';
import DashboardClient from '@/components/DashboardClient';
import {
  createDemoDebts,
  createDemoTransactions,
  getDemoUser,
} from '@/lib/demoData';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale;
  setRequestLocale(locale);

  const lang = locale === 'en' ? 'en' : 'id';
  const demoUser = getDemoUser(lang);

  return (
    <DashboardClient
      initialTransactions={createDemoTransactions(lang)}
      initialDebts={createDemoDebts(lang)}
      userEmail={demoUser.email}
      clientName={demoUser.clientName}
      userRole="user"
      initialBio={demoUser.bio}
      isDemoMode={true}
      isSuperadmin={false}
    />
  );
}
