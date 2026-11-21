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
import type { Transaction, Debt } from '@/types/finance';

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

    // Superadmin tetap masuk dashboard meski data belum ada. Yang penting
    // jangan jatuh ke mode demo: data contoh menyesatkan karena terlihat
    // seperti data asli padahal tidak ada di database.
    return (
      <DashboardClient
        initialTransactions={[]}
        initialDebts={[]}
        userEmail={superadminSession.sub}
        clientName="Superadmin Workspace"
        userRole="admin"
        isDemoMode={false}
        isSuperadmin={true}
        impersonatingEmail={null}
      />
    );
  }

  const supabase = await createClient();

  if (!supabase) {
    // Env Supabase belum diset (mis. di Vercel). Tampilkan kondisi ini secara
    // terbuka, bukan data contoh - data contoh terlihat seperti data asli.
    return (
      <div className="min-h-screen bg-[var(--bg)] px-4 py-16 text-center text-[var(--text-muted)]">
        <p className="text-[13px] font-semibold text-[var(--text)]">
          Database belum terhubung
        </p>
        <p className="mt-2 text-[12px]">
          Variabel lingkungan Supabase (NEXT_PUBLIC_SUPABASE_URL dan
          NEXT_PUBLIC_SUPABASE_ANON_KEY) belum diset untuk environment ini.
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: '/login', locale });
  } else {
    const [{ data: profile }, { data: transactions }, { data: debts }] = await Promise.all([
      supabase
        .from('profiles')
        .select('client_name, role, bio, avatar_url, banner_url')
        .eq('id', user.id)
        .single(),
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
        userRole={(profile?.role as 'admin' | 'user') ?? 'user'}
        initialBio={(profile?.bio as string) || ''}
        initialAvatarUrl={(profile?.avatar_url as string) || null}
        initialBannerUrl={(profile?.banner_url as string) || null}
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
