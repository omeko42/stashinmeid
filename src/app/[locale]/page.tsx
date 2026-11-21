import type { Locale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';
import { verifySuperadminToken } from '@/lib/jwt';
import DashboardClient from '@/components/DashboardClient';
import { DashboardSkeleton } from '@/components/shell/DashboardSkeleton';
import { Transaction, Debt } from '@/types/finance';

const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: 'demo-1',
    type: 'inflow',
    amount: 10000000,
    category: 'Gaji',
    description: 'Contoh Pemasukan Bulanan',
    transaction_date: '2026-11-01',
    source: 'manual',
  },
  {
    id: 'demo-2',
    type: 'outflow',
    amount: 50000,
    category: 'Makan & Minum',
    description: 'Contoh Pengeluaran Harian',
    transaction_date: '2026-11-19',
    source: 'ai_scan',
  },
];

const DEMO_DEBTS: Debt[] = [
  {
    id: 'debt-demo-1',
    platform: 'Contoh Pinjaman A',
    contract_no: 'DEMO-001',
    total_tenor: 12,
    remaining_tenor: 8,
    due_day: 1,
    remaining_balance: 4000000,
    monthly_installment: 500000,
    status: 'active',
    notes: 'Data contoh untuk Demo Mode.',
  },
  {
    id: 'debt-demo-2',
    platform: 'Contoh PayLater B',
    contract_no: 'DEMO-002',
    total_tenor: 6,
    remaining_tenor: 3,
    due_day: 15,
    remaining_balance: 900000,
    monthly_installment: 300000,
    status: 'active',
    notes: 'Data contoh untuk Demo Mode.',
  },
];

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

async function DashboardLoader({ locale }: { locale: Locale }) {
  setRequestLocale(locale);
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('stashinme_session')?.value;
  const superadminSession = await verifySuperadminToken(sessionToken);

  if (superadminSession) {
    const adminClient = createAdminClient();
    const targetUserId =
      superadminSession.impersonateUserId || (await getOrCreateSuperadminUserId());

    if (adminClient && targetUserId) {
      const [{ data: profile }, { data: transactions }, { data: debts }] = await Promise.all([
        adminClient
          .from('profiles')
          .select('email, client_name')
          .eq('id', targetUserId)
          .single(),
        adminClient
          .from('transactions')
          .select('*')
          .eq('user_id', targetUserId)
          .order('transaction_date', { ascending: false }),
        adminClient
          .from('debts')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false }),
      ]);

      return (
        <DashboardClient
          initialTransactions={(transactions as Transaction[]) || []}
          initialDebts={(debts as Debt[]) || []}
          userEmail={superadminSession.impersonateEmail ?? profile?.email ?? superadminSession.sub}
          clientName={
            superadminSession.impersonateClientName ?? profile?.client_name ?? 'Superadmin Personal'
          }
          userRole="admin"
          isDemoMode={false}
          isSuperadmin={true}
          impersonatingEmail={superadminSession.impersonateEmail ?? null}
        />
      );
    }

    return (
      <DashboardClient
        initialTransactions={DEMO_TRANSACTIONS}
        initialDebts={DEMO_DEBTS}
        userEmail={superadminSession.sub}
        clientName="Superadmin Workspace"
        userRole="admin"
        isDemoMode={true}
        isSuperadmin={true}
        impersonatingEmail={null}
      />
    );
  }

  const supabase = await createClient();

  if (!supabase) {
    return (
      <DashboardClient
        initialTransactions={DEMO_TRANSACTIONS}
        initialDebts={DEMO_DEBTS}
        userEmail={null}
        clientName="Personal (Demo)"
        userRole="admin"
        isDemoMode={true}
      />
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: '/login', locale });
  } else {
    const [{ data: profile }, { data: transactions }, { data: debts }] = await Promise.all([
      supabase.from('profiles').select('client_name, role').eq('id', user.id).single(),
      supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false }),
      supabase
        .from('debts')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    return (
      <DashboardClient
        initialTransactions={(transactions as Transaction[]) || []}
        initialDebts={(debts as Debt[]) || []}
        userEmail={user.email ?? null}
        clientName={profile?.client_name ?? 'Personal'}
        userRole={(profile?.role as 'admin' | 'member' | 'viewer') ?? 'member'}
        isDemoMode={false}
      />
    );
  }
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: rawLocale } = await params;
  const locale = routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale;
  setRequestLocale(locale);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text-muted)]">
          <main className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8">
            <DashboardSkeleton />
          </main>
        </div>
      }
    >
      <DashboardLoader locale={locale} />
    </Suspense>
  );
}
