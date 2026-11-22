import type { Locale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import { setRequestLocale } from 'next-intl/server';
import DashboardClient from '@/components/DashboardClient';
import {
  createDemoDebts,
  createDemoTransactions,
  DEMO_USER,
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

  return (
    <DashboardClient
      initialTransactions={createDemoTransactions()}
      initialDebts={createDemoDebts()}
      userEmail={DEMO_USER.email}
      clientName={DEMO_USER.clientName}
      userRole="user"
      initialBio={DEMO_USER.bio}
      isDemoMode={true}
      isSuperadmin={false}
    />
  );
}
